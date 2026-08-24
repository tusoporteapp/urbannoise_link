/**
 * Cloudflare Pages Function: /api/sync
 * 1-Click Secure Admin Synchronization Endpoint for Loyverse POS
 * Tienda Noise Urban (fee704a4-ff11-43ae-903e-d2f9cf0a9a25)
 */

export async function onRequestPost(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8"
    };

    try {
        let body = {};
        try {
            body = await context.request.json();
        } catch(e) {}

        const ADMIN_PIN = (context.env && context.env.ADMIN_PIN) ? context.env.ADMIN_PIN : "8624";
        if (body.pin !== ADMIN_PIN) {
            return new Response(JSON.stringify({
                success: false,
                error: "PIN de administrador incorrecto"
            }), {
                status: 401,
                headers: corsHeaders
            });
        }

        const API_KEY = (context.env && context.env.LOYVERSE_API_KEY) ? context.env.LOYVERSE_API_KEY : "ccc26aa2d00a48a4a8d8b4606cf7531e";
        const STORE_ID = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

        const authHeaders = {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        };

        // 1. Fetch Modifiers & Categories
        const [modData, catData] = await Promise.all([
            fetch("https://api.loyverse.com/v1.0/modifiers", { headers: authHeaders }).then(r => r.json()).catch(() => ({ modifiers: [] })),
            fetch("https://api.loyverse.com/v1.0/categories", { headers: authHeaders }).then(r => r.json()).catch(() => ({ categories: [] }))
        ]);

        const modifiers = modData.modifiers || [];
        const categoryMap = {};
        (catData.categories || []).forEach(c => { categoryMap[c.id] = c.name; });

        // 2. Fetch Items
        let allItems = [];
        let itemCursor = null;
        do {
            let itemUrl = `https://api.loyverse.com/v1.0/items?limit=250`;
            if (itemCursor) itemUrl += `&cursor=${itemCursor}`;
            const res = await fetch(itemUrl, { headers: authHeaders });
            const data = await res.json();
            if (data.items) allItems = allItems.concat(data.items);
            itemCursor = data.cursor;
        } while (itemCursor);

        // 3. Fetch Inventory
        let allInventory = [];
        let invCursor = null;
        do {
            let invUrl = `https://api.loyverse.com/v1.0/inventory?limit=250`;
            if (invCursor) invUrl += `&cursor=${invCursor}`;
            const res = await fetch(invUrl, { headers: authHeaders });
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

            const vParam = item.updated_at ? `?v=${encodeURIComponent(item.updated_at)}` : '';
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

        // Invalidate Cloudflare Cache
        try {
            const cache = caches.default;
            const cacheUrl = new URL(context.request.url);
            cacheUrl.pathname = '/api/catalog';
            cacheUrl.search = '';
            await cache.delete(new Request(cacheUrl.toString()));
        } catch(e) {}

        return new Response(JSON.stringify({
            success: true,
            message: `Sincronización completada exitosamente. ${mappedProducts.length} prendas actualizadas.`,
            count: mappedProducts.length,
            timestamp: new Date().toISOString(),
            products: mappedProducts
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || "Error al sincronizar con Loyverse"
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
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "public, max-age=86400"
        }
    });
}
