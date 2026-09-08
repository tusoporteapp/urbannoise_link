/**
 * Cloudflare Pages Function: /api/catalog
 * High-performance real-time Loyverse catalog aggregator with Cloudflare Edge Caching & Cache-Busting Image Versions
 * Tienda Noise Urban (fee704a4-ff11-43ae-903e-d2f9cf0a9a25)
 */

function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
}

function classifyItemCategory(itemName, rawCat) {
    const name = (itemName || '').toLowerCase();
    const raw = (rawCat || '').toLowerCase();

    let family = 'Camisetas';
    let sub = 'Oversize Clásica';
    let cleanCategory = rawCat || 'Oversize';

    // 1. BUZOS & HOODIES
    if (raw.includes('buzo') || raw.includes('hoodie') || name.includes('buzo') || name.includes('hoodie')) {
        family = 'Buzos';
        if (raw.includes('acid') || name.includes('acid')) {
            sub = 'Acid Wash';
            cleanCategory = 'Buzo AcidWash';
        } else if (raw.includes('capotero') || name.includes('capotero')) {
            sub = 'Capotero';
            cleanCategory = 'Buzo Capotero';
        } else if (raw.includes('gold') || name.includes('gold')) {
            sub = 'Gold';
            cleanCategory = 'Buzo Gold';
        } else if (raw.includes('new/b') || name.includes('new/b')) {
            sub = 'New/B';
            cleanCategory = 'Buzo New/B';
        } else {
            sub = 'Clásico';
            cleanCategory = 'Buzo Clásico';
        }
    }
    // 2. ESQUELETOS
    else if (raw.includes('esqueleto') || name.includes('esqueleto')) {
        family = 'Esqueletos';
        if (raw.includes('acid') || name.includes('acid')) {
            sub = 'Acid Wash';
            cleanCategory = 'Esqueleto AcidWash';
        } else {
            sub = 'Clásico';
            cleanCategory = 'Esqueleto Clásico';
        }
    }
    // 3. CONJUNTOS & BERMUDAS
    else if (raw.includes('conjunto') || raw.includes('bermuda') || raw.includes('sudadera') || name.includes('bermuda') || name.includes('conjunto') || name.includes('pantalon acid')) {
        family = 'Conjuntos';
        if (raw.includes('bermuda') || name.includes('bermuda')) {
            sub = (raw.includes('acid') || name.includes('acid')) ? 'Bermuda AcidWash' : 'Bermudas';
            cleanCategory = sub;
        } else if (raw.includes('sudadera') || name.includes('sudadera') || name.includes('pantalon acid')) {
            sub = 'Sudadera / Pantalón';
            cleanCategory = 'Conjunto Sudadera';
        } else {
            sub = 'Conjuntos';
            cleanCategory = 'Conjuntos';
        }
    }
    // 4. LÍNEA DE DAMAS
    else if (raw.includes('dama') || raw.includes('body') || raw.includes('dm') || name.includes('dama') || name.includes('body')) {
        family = 'Damas';
        if (raw.includes('over dama') || name.includes('over dama')) {
            sub = 'Oversize Dama';
            cleanCategory = 'Over Dama';
        } else if (raw.includes('body') || name.includes('body')) {
            sub = 'Body';
            cleanCategory = 'Body';
        } else if (raw.includes('pantalon') || name.includes('pantalon')) {
            sub = 'Pantalón Dama';
            cleanCategory = 'Pantalón Dama';
        } else {
            sub = 'Línea Damas';
            cleanCategory = 'Línea de Damas';
        }
    }
    // 5. NIÑO & UNISEX
    else if (raw.includes('niño') || raw.includes('unisex') || name.includes('niño') || name.includes('pesquero') || name.includes('gorra')) {
        family = 'Otros';
        if (raw.includes('niño') || name.includes('niño')) {
            sub = 'Niño';
            cleanCategory = 'Línea Infantil';
        } else {
            sub = 'Unisex / Accesorios';
            cleanCategory = 'Unisex & Accesorios';
        }
    }
    // 6. CAMISETAS OVERSIZE
    else {
        family = 'Camisetas';
        if (raw.includes('acid') || name.includes('acid')) {
            sub = 'Acid Wash';
            cleanCategory = 'Oversize AcidWash';
        } else if (raw.includes('burda') || name.includes('burda')) {
            sub = 'Burda Fría';
            cleanCategory = 'Oversize Burda';
        } else if (raw.includes('algodon') || name.includes('algodon')) {
            sub = 'Algodón';
            cleanCategory = 'Oversize Algodón';
        } else if (raw.includes('boxi') || name.includes('boxi') || raw.includes('boxy') || name.includes('boxy')) {
            sub = 'Boxy Fit';
            cleanCategory = 'Boxy Fit';
        } else if (raw.includes('pedreria') || name.includes('pedreria') || name.includes('piedra')) {
            sub = 'Pedrería';
            cleanCategory = 'Oversize Pedrería';
        } else if (raw.includes('premium') || name.includes('premium')) {
            sub = 'Premium';
            cleanCategory = 'Oversize Premium';
        } else if (raw.includes('t-shirt') || name.includes('polo')) {
            sub = 'T-Shirt / Polo';
            cleanCategory = 'T-Shirt';
        } else {
            sub = 'Oversize Clásica';
            cleanCategory = 'Oversize Streetwear';
        }
    }

    return { family, sub, cleanCategory };
}

export async function onRequestGet(context) {
    const cacheUrl = new URL(context.request.url);
    const isFresh = cacheUrl.searchParams.get('fresh') === 'true' || cacheUrl.searchParams.has('t');
    const targetStoreId = cacheUrl.searchParams.get('store_id') || "fee704a4-ff11-43ae-903e-d2f9cf0a9a25";
    
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
        "Cache-Control": isFresh ? "private, no-cache, no-store, must-revalidate" : "public, max-age=10, s-maxage=15, stale-while-revalidate=30"
    };

    const API_KEY = getSecretKey(context.env);
    const STORE_ID = targetStoreId;

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

        // Filter inventory specifically for the target store
        const stockMap = {};
        allInventory.forEach(inv => {
            if (inv.variant_id && inv.store_id === STORE_ID) {
                stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
            }
        });

        // 5. Aggregate & Map Products to Universal Unified Schema
        // Only include items available for sale in the target store
        const mappedProducts = allItems
            .filter(item => {
                const variants = item.variants || [];
                if (variants.length === 0) return true;
                const isAvailable = variants.some(v => {
                    const storeEntry = (v.stores || []).find(s => s.store_id === STORE_ID);
                    return !storeEntry || storeEntry.available_for_sale !== false;
                });
                return isAvailable;
            })
            .map(item => {
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

            // Determine hierarchical category, family, and finish/fabric
            const rawCat = item.category_id && categoryMap[item.category_id] ? categoryMap[item.category_id] : '';
            const classification = classifyItemCategory(item.item_name, rawCat);

            // Map Variants
            const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
            const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

            const variants = (item.variants || []).map(v => {
                const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                const variantWholesalePrice = wholesalePrice > 0 ? wholesalePrice : (v.default_price || retailBasePrice);
                const currentStock = Math.max(0, stockMap[v.variant_id] || 0);
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
                category: classification.cleanCategory,
                family: classification.family,
                subCategory: classification.sub,
                rawCategory: rawCat,
                store_id: STORE_ID,
                variants: variants,
                created_at: item.created_at || '',
                updated_at: item.updated_at || ''
            };
        });

        // Sort all products strictly from newest to oldest by created_at timestamp
        mappedProducts.sort((a, b) => {
            const timeA = new Date(a.created_at || a.updated_at || 0).getTime();
            const timeB = new Date(b.created_at || b.updated_at || 0).getTime();
            return timeB - timeA;
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
