/**
 * Cloudflare Pages Function: /api/catalog
 * High-performance real-time Loyverse catalog aggregator with Cloudflare Edge Caching & Cache-Busting Image Versions
 * Tienda Noise Urban (fee704a4-ff11-43ae-903e-d2f9cf0a9a25)
 */

export async function onRequestGet(context) {
    const cacheUrl = new URL(context.request.url);
    const isFresh = cacheUrl.searchParams.get('fresh') === 'true' || cacheUrl.searchParams.has('t');
    
    cacheUrl.searchParams.delete('t');
    cacheUrl.searchParams.delete('_');
    cacheUrl.searchParams.delete('fresh');
    const cacheKey = new Request(cacheUrl.toString(), context.request);
    const cache = caches.default;

    if (!isFresh) {
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
    }

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60"
    };

    const API_KEY = (context.env && context.env.LOYVERSE_API_KEY) ? context.env.LOYVERSE_API_KEY : "ccc26aa2d00a48a4a8d8b4606cf7531e";
    const STORE_ID = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

    const authHeaders = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        // 1. Fetch Modifiers (parallel request)
        const modifiersPromise = fetch("https://api.loyverse.com/v1.0/modifiers", { headers: authHeaders })
            .then(res => res.ok ? res.json() : { modifiers: [] })
            .then(data => data.modifiers || []);

        // 2. Fetch Categories (parallel request)
        const categoriesPromise = fetch("https://api.loyverse.com/v1.0/categories", { headers: authHeaders })
            .then(res => res.ok ? res.json() : { categories: [] })
            .then(data => {
                const map = {};
                (data.categories || []).forEach(c => { map[c.id] = c.name; });
                return map;
            });

        // 3. Fetch Items with Cursor Pagination
        let allItems = [];
        let itemCursor = null;
        do {
            let itemUrl = `https://api.loyverse.com/v1.0/items?limit=250`;
            if (itemCursor) itemUrl += `&cursor=${itemCursor}`;
            
            const itemRes = await fetch(itemUrl, { headers: authHeaders });
            if (!itemRes.ok) {
                const errText = await itemRes.text();
                throw new Error(`Loyverse Items API error: ${errText}`);
            }
            const itemData = await itemRes.json();
            if (itemData.items && Array.isArray(itemData.items)) {
                allItems = allItems.concat(itemData.items);
            }
            itemCursor = itemData.cursor;
        } while (itemCursor);

        // 4. Fetch Inventory Levels with Cursor Pagination
        let allInventory = [];
        let invCursor = null;
        do {
            let invUrl = `https://api.loyverse.com/v1.0/inventory?limit=250`;
            if (invCursor) invUrl += `&cursor=${invCursor}`;

            const invRes = await fetch(invUrl, { headers: authHeaders });
            if (!invRes.ok) {
                const errText = await invRes.text();
                throw new Error(`Loyverse Inventory API error: ${errText}`);
            }
            const invData = await invRes.json();
            if (invData.inventory_levels && Array.isArray(invData.inventory_levels)) {
                allInventory = allInventory.concat(invData.inventory_levels);
            }
            invCursor = invData.cursor;
        } while (invCursor);

        // Await parallel metadata
        const [modifiers, categoryMap] = await Promise.all([modifiersPromise, categoriesPromise]);

        // Filter inventory specifically for Tienda Noise Urban
        const stockMap = {};
        allInventory.forEach(inv => {
            if (inv.variant_id && inv.store_id === STORE_ID) {
                stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
            }
        });

        // 5. Aggregate & Map Products to Universal Unified Schema
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
                const cName = categoryMap[item.category_id];
                if (/acid/i.test(cName)) categoryName = 'Acidwash';
                else if (/buzo|hoodie/i.test(cName)) categoryName = 'Buzos';
                else if (/conjunto|bermuda/i.test(cName)) categoryName = 'Conjuntos';
                else if (/dama|body/i.test(cName)) categoryName = 'Linea de Damas';
                else if (/oversize|burda|boxi|t-shirt/i.test(cName)) categoryName = 'Oversize';
                else categoryName = cName;
            }

            // Map Variants
            const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
            const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

            const variants = (item.variants || []).map(v => {
                const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                const variantWholesalePrice = wholesalePrice > 0 ? wholesalePrice : (v.default_price || retailBasePrice);
                const currentStock = stockMap[v.variant_id] !== undefined ? stockMap[v.variant_id] : 0;
                const inStock = currentStock > 0;

                return {
                    id: v.variant_id,
                    sku: v.sku || '',
                    size: sizeVal || 'U',
                    color: colorVal,
                    price: variantWholesalePrice,
                    retailPrice: v.default_price || retailBasePrice,
                    inStock: inStock,
                    stock: currentStock
                };
            });

            // Versioned Images with updated_at timestamp to bust CDN image caches on image changes
            const vParam = item.updated_at ? `?v=${encodeURIComponent(item.updated_at)}` : '';
            const primaryImage = item.image_url ? `${item.image_url}${vParam}` : 'https://urbannoise.cc/assets/img/logo/LOGO_WEB.png';
            const imagesList = item.image_url ? [`${item.image_url}${vParam}`] : [];

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
                variants: variants,
                created_at: item.created_at || '',
                created_at: item.created_at,
                updated_at: item.updated_at || ''
            };
        });

        const response = new Response(JSON.stringify(mappedProducts), {
            status: 200,
            headers: corsHeaders
        });

        // Store in Cloudflare Edge Cache
        context.waitUntil(cache.put(cacheKey, response.clone()));
        return response;

    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message || "Error al sincronizar catálogo con Loyverse POS",
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
