/**
 * Cloudflare Pages Advanced Mode Server: _worker.js
 * Serves as the Real-Time Server for Urban Noise & Loyverse POS
 * Tienda Noise Urban (fee704a4-ff11-43ae-903e-d2f9cf0a9a25)
 */

const API_KEY_DEFAULT = "ccc26aa2d00a48a4a8d8b4606cf7531e";
const STORE_ID_DEFAULT = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25";
const ADMIN_PIN_DEFAULT = "8624";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json; charset=utf-8"
};

async function handleLiveCatalog(request, env) {
    const API_KEY = (env && env.LOYVERSE_API_KEY) ? env.LOYVERSE_API_KEY : API_KEY_DEFAULT;
    const STORE_ID = STORE_ID_DEFAULT;

    const authHeaders = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        // 1. Fetch Modifiers & Categories in parallel
        const [modRes, catRes] = await Promise.all([
            fetch("https://api.loyverse.com/v1.0/modifiers", { headers: authHeaders }).then(r => r.ok ? r.json() : { modifiers: [] }).catch(() => ({ modifiers: [] })),
            fetch("https://api.loyverse.com/v1.0/categories", { headers: authHeaders }).then(r => r.ok ? r.json() : { categories: [] }).catch(() => ({ categories: [] }))
        ]);

        const modifiers = modRes.modifiers || [];
        const categoryMap = {};
        (catRes.categories || []).forEach(c => { categoryMap[c.id] = c.name; });

        // 2. Fetch Items
        let allItems = [];
        let itemCursor = null;
        do {
            let itemUrl = `https://api.loyverse.com/v1.0/items?limit=250`;
            if (itemCursor) itemUrl += `&cursor=${itemCursor}`;
            const res = await fetch(itemUrl, { headers: authHeaders });
            if (!res.ok) break;
            const data = await res.json();
            if (data.items) allItems = allItems.concat(data.items);
            itemCursor = data.cursor;
        } while (itemCursor);

        // 3. Fetch Inventory Levels
        let allInventory = [];
        let invCursor = null;
        do {
            let invUrl = `https://api.loyverse.com/v1.0/inventory?limit=250`;
            if (invCursor) invUrl += `&cursor=${invCursor}`;
            const res = await fetch(invUrl, { headers: authHeaders });
            if (!res.ok) break;
            const data = await res.json();
            if (data.inventory_levels) allInventory = allInventory.concat(data.inventory_levels);
            invCursor = data.cursor;
        } while (invCursor);

        const stockMap = {};
        allInventory.forEach(inv => {
            if (inv.variant_id && inv.store_id === STORE_ID) {
                stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
            }
        });

        // 4. Map Products
        const mappedProducts = allItems.map(item => {
            const defaultVariant = item.variants && item.variants[0] ? item.variants[0] : null;
            const retailBasePrice = defaultVariant ? defaultVariant.default_price : 0;

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

            const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
            const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

            const variants = (item.variants || []).map(v => {
                const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                const variantWholesalePrice = wholesalePrice > 0 ? wholesalePrice : (v.default_price || retailBasePrice);
                const currentStock = stockMap[v.variant_id] !== undefined ? stockMap[v.variant_id] : 0;

                return {
                    id: v.variant_id,
                    sku: v.sku || '',
                    size: sizeVal || 'U',
                    color: colorVal,
                    price: variantWholesalePrice,
                    retailPrice: v.default_price || retailBasePrice,
                    inStock: currentStock > 0,
                    stock: currentStock
                };
            });

            const vParam = item.updated_at ? `?v=${new Date(item.updated_at).getTime()}` : '';
            const primaryImage = item.image_url ? `${item.image_url}${vParam}` : 'https://urbannoise.cc/assets/img/logo/LOGO_WEB.png';

            return {
                id: item.id,
                title: item.item_name || 'Prenda Urban Noise',
                description: item.description || 'Sin descripción disponible.',
                price: wholesalePrice > 0 ? wholesalePrice : retailBasePrice,
                retailPrice: retailBasePrice,
                modifierApplied: modifierNameApplied,
                image: primaryImage,
                images: item.image_url ? [`${item.image_url}${vParam}`] : [],
                category: categoryName,
                rawCategory: item.category_id ? (categoryMap[item.category_id] || '') : '',
                variants: variants,
                updated_at: item.updated_at || ''
            };
        });

        return new Response(JSON.stringify(mappedProducts), {
            status: 200,
            headers: {
                ...corsHeaders,
                "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }
}

async function handleLiveStock(request, env) {
    const API_KEY = (env && env.LOYVERSE_API_KEY) ? env.LOYVERSE_API_KEY : API_KEY_DEFAULT;
    const STORE_ID = STORE_ID_DEFAULT;
    const url = new URL(request.url);
    const productId = url.searchParams.get("id");

    const authHeaders = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        if (productId) {
            const itemRes = await fetch(`https://api.loyverse.com/v1.0/items/${productId}`, { headers: authHeaders });
            if (!itemRes.ok) return new Response(JSON.stringify({ error: "Item no encontrado" }), { status: 404, headers: corsHeaders });
            
            const item = await itemRes.json();
            const variantIds = (item.variants || []).map(v => v.variant_id).join(',');

            let inventoryLevels = [];
            if (variantIds) {
                const invRes = await fetch(`https://api.loyverse.com/v1.0/inventory?variant_ids=${variantIds}`, { headers: authHeaders });
                if (invRes.ok) {
                    const invData = await invRes.json();
                    inventoryLevels = invData.inventory_levels || [];
                }
            }

            const stockMap = {};
            inventoryLevels.forEach(inv => {
                if (inv.variant_id && inv.store_id === STORE_ID) {
                    stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
                }
            });

            const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
            const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

            const variants = (item.variants || []).map(v => {
                const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                const currentStock = stockMap[v.variant_id] !== undefined ? stockMap[v.variant_id] : 0;
                
                return {
                    id: v.variant_id,
                    sku: v.sku || '',
                    size: sizeVal || 'U',
                    color: colorVal,
                    stock: currentStock,
                    inStock: currentStock > 0
                };
            });

            const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

            return new Response(JSON.stringify({
                id: item.id,
                title: item.item_name,
                totalStock,
                variants,
                timestamp: new Date().toISOString()
            }), {
                status: 200,
                headers: { ...corsHeaders, "Cache-Control": "no-cache, no-store, must-revalidate" }
            });
        }

        return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: corsHeaders });
    } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
    }
}

async function handleDispatch(request, env) {
    try {
        const body = await request.json();
        const ADMIN_PIN = (env && env.ADMIN_PIN) ? env.ADMIN_PIN : ADMIN_PIN_DEFAULT;
        if (body.pin !== ADMIN_PIN) {
            return new Response(JSON.stringify({ success: false, error: "PIN incorrecto" }), { status: 401, headers: corsHeaders });
        }

        const API_KEY = (env && env.LOYVERSE_API_KEY) ? env.LOYVERSE_API_KEY : API_KEY_DEFAULT;
        const STORE_ID = STORE_ID_DEFAULT;
        const authHeaders = { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" };

        const items = body.items || [];
        const results = [];

        for (const it of items) {
            if (!it.id || !it.qty) continue;
            // Create inventory adjustment
            const adjPayload = {
                inventory_levels: [{
                    variant_id: it.id,
                    store_id: STORE_ID,
                    in_stock_difference: -Math.abs(Number(it.qty))
                }]
            };

            const adjRes = await fetch("https://api.loyverse.com/v1.0/inventory", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(adjPayload)
            });

            results.push({ variant_id: it.id, status: adjRes.status });
        }

        return new Response(JSON.stringify({ success: true, message: "Inventario descontado exitosamente", results }), {
            status: 200,
            headers: corsHeaders
        });
    } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500, headers: corsHeaders });
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    ...corsHeaders,
                    "Cache-Control": "public, max-age=86400"
                }
            });
        }

        // Live API Routes
        if (url.pathname.startsWith('/api/catalog')) {
            return handleLiveCatalog(request, env);
        }
        if (url.pathname.startsWith('/api/stock')) {
            return handleLiveStock(request, env);
        }
        if (url.pathname.startsWith('/api/dispatch')) {
            return handleDispatch(request, env);
        }
        if (url.pathname.startsWith('/api/sync')) {
            return handleLiveCatalog(request, env);
        }

        // Static Asset fallback
        if (env && env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return fetch(request);
    }
};
