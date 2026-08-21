/**
 * Cloudflare Pages Function: /api/catalog
 * High-Performance Loyverse Catalog Endpoint with Edge Cache API
 * Response time: ~15ms (Cached) / Stale-While-Revalidate
 */

export async function onRequestGet(context) {
    const cacheUrl = new URL(context.request.url);
    // Normalize cache key without random timestamp params to maximize CDN cache hit ratio
    cacheUrl.searchParams.delete('t');
    cacheUrl.searchParams.delete('_');
    const cacheKey = new Request(cacheUrl.toString(), context.request);
    const cache = caches.default;

    // 1. Check Cloudflare Edge Cache first
    let cachedResponse = await cache.match(cacheKey);
    const isFreshRequested = new URL(context.request.url).searchParams.get('fresh') === 'true';

    if (cachedResponse && !isFreshRequested) {
        return cachedResponse;
    }

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8",
        // Cache at Edge for 60 seconds, browser for 30 seconds, serve stale up to 10 minutes
        "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=600"
    };

    const API_KEY = (context.env && context.env.LOYVERSE_API_KEY) ? context.env.LOYVERSE_API_KEY : "ccc26aa2d00a48a4a8d8b4606cf7531e";
    const STORE_ID = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

    const authHeaders = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    async function fetchLoyversePage(endpoint, cursor = null) {
        let url = `https://api.loyverse.com/v1.0/${endpoint}?limit=250`;
        if (cursor) {
            url += `&cursor=${cursor}`;
        }
        const res = await fetch(url, { headers: authHeaders });
        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Loyverse API error on ${endpoint}: ${err}`);
        }
        return await res.json();
    }

    try {
        // 1. Fetch Modifiers & Categories in parallel
        const [modData, catData] = await Promise.all([
            fetchLoyversePage('modifiers').catch(() => ({ modifiers: [] })),
            fetchLoyversePage('categories').catch(() => ({ categories: [] }))
        ]);

        const modifiers = modData.modifiers || [];
        const categories = catData.categories || [];
        const categoryMap = {};
        categories.forEach(c => {
            if (c.id && c.name) categoryMap[c.id] = c.name;
        });

        // 2. Fetch all items (handle pagination)
        let allItems = [];
        let cursor = null;
        do {
            const itemData = await fetchLoyversePage('items', cursor);
            if (itemData.items && Array.isArray(itemData.items)) {
                allItems = allItems.concat(itemData.items);
            }
            cursor = itemData.cursor;
        } while (cursor);

        // 3. Fetch all inventory levels (handle pagination)
        let allInventory = [];
        cursor = null;
        do {
            const invData = await fetchLoyversePage('inventory', cursor);
            if (invData.inventory_levels && Array.isArray(invData.inventory_levels)) {
                allInventory = allInventory.concat(invData.inventory_levels);
            }
            cursor = invData.cursor;
        } while (cursor);

        // 4. Map stock by variant_id for Noise Urban store
        const stockMap = {};
        allInventory.forEach(inv => {
            if (inv.variant_id && inv.store_id === STORE_ID) {
                stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
            }
        });

        // 5. Map Loyverse items to our Catalog schema
        const mappedProducts = allItems.map(item => {
            const defaultVariant = item.variants && item.variants[0] ? item.variants[0] : null;
            const retailBasePrice = defaultVariant ? defaultVariant.default_price : 0;
            
            // Calculate Wholesale discount from "X Mayor" modifiers
            const itemMods = (item.modifier_ids || []).map(mid => modifiers.find(m => m.id === mid)).filter(Boolean);
            let mayorDiscount = 0;
            let modifierNameApplied = null;

            for (const m of itemMods) {
                if (m.modifier_options) {
                    const opt = m.modifier_options.find(o => /x mayor/i.test(o.name) || /mayor/i.test(o.name));
                    if (opt) {
                        mayorDiscount = opt.price || 0;
                        modifierNameApplied = m.name;
                        break;
                    }
                }
            }

            const wholesalePrice = Math.max(0, retailBasePrice + mayorDiscount);

            // Determine clean category
            let categoryName = 'Oversize';
            if (item.category_id && categoryMap[item.category_id]) {
                const cName = categoryMap[item.category_id].trim();
                const cNameLower = cName.toLowerCase();
                if (cNameLower.includes('dama')) categoryName = 'Linea de Damas';
                else if (cNameLower.includes('buzo') || cNameLower.includes('hoodie')) categoryName = 'Buzos';
                else if (cNameLower.includes('acid') || cNameLower.includes('wash')) categoryName = 'Acidwash';
                else if (cNameLower.includes('conjunto')) categoryName = 'Conjuntos';
                else if (cNameLower.includes('pantalon') || cNameLower.includes('jogger') || cNameLower.includes('cargo') || cNameLower.includes('bermuda') || cNameLower.includes('short')) categoryName = 'Pantalones';
                else if (cNameLower.includes('oversize') || cNameLower.includes('t-shirt') || cNameLower.includes('camiseta')) categoryName = 'Oversize';
                else categoryName = cName;
            } else {
                const nameLower = (item.item_name || '').toLowerCase();
                if (nameLower.includes('dama')) categoryName = 'Linea de Damas';
                else if (nameLower.includes('buzo') || nameLower.includes('hoodie')) categoryName = 'Buzos';
                else if (nameLower.includes('acid') || nameLower.includes('wash')) categoryName = 'Acidwash';
                else if (nameLower.includes('conjunto')) categoryName = 'Conjuntos';
            }

            // Extract variant sizes and colors
            const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
            const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

            const variantsMapped = item.variants ? item.variants.map(v => {
                const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                
                const totalStock = stockMap[v.variant_id] !== undefined ? stockMap[v.variant_id] : 0;
                const trackStock = item.track_stock !== false;
                const inStock = trackStock ? (totalStock > 0) : true;
                const variantWholesalePrice = Math.max(0, (v.default_price || retailBasePrice) + mayorDiscount);

                return {
                    id: v.variant_id,
                    sku: v.sku || '',
                    size: sizeVal || 'U',
                    color: colorVal,
                    price: variantWholesalePrice,
                    retailPrice: v.default_price || retailBasePrice,
                    inStock: inStock,
                    stock: totalStock
                };
            }) : [];

            // Images
            const primaryImage = item.image_url || 'https://urbannoise.cc/assets/img/logo/LOGO_WEB.png';
            const imagesList = item.image_url ? [item.image_url] : [];

            return {
                id: item.id,
                title: item.item_name || 'Prenda Urban Noise',
                description: item.description || 'Sin descripción disponible.',
                price: wholesalePrice > 0 ? wholesalePrice : retailBasePrice,
                retailPrice: retailBasePrice,
                modifierApplied: modifierNameApplied,
                image: primaryImage,
                images: imagesList,
                category: categoryName,
                rawCategory: item.category_id ? (categoryMap[item.category_id] || '') : '',
                variants: variantsMapped
            };
        });

        // Filter: only show items with at least one variant in stock
        const availableProducts = mappedProducts.filter(p => {
            if (!p.variants || p.variants.length === 0) return true;
            return p.variants.some(v => v.stock > 0);
        });

        const response = new Response(JSON.stringify(availableProducts), {
            status: 200,
            headers: corsHeaders
        });

        // Save to Cloudflare Edge Cache in background
        context.waitUntil(cache.put(cacheKey, response.clone()));

        return response;

    } catch (error) {
        // Fallback: If Loyverse API failed, return cached data if available
        if (cachedResponse) return cachedResponse;

        return new Response(JSON.stringify({
            error: error.message || "Error al sincronizar con Loyverse API",
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "public, max-age=86400"
        }
    });
}
