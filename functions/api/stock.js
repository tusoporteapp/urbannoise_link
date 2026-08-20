/**
 * Cloudflare Pages Function: /api/stock
 * Ultralight real-time inventory verification endpoint for single product or all active variants
 * Tienda Noise Urban (fee704a4-ff11-43ae-903e-d2f9cf0a9a25)
 */

export async function onRequestGet(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    };

    const API_KEY = (context.env && context.env.LOYVERSE_API_KEY) ? context.env.LOYVERSE_API_KEY : "ccc26aa2d00a48a4a8d8b4606cf7531e";
    const STORE_ID = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

    const url = new URL(context.request.url);
    const productId = url.searchParams.get("id");

    const authHeaders = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        // 1. Fetch Inventory Levels directly from Loyverse
        let allInventory = [];
        let cursor = null;
        do {
            let invUrl = `https://api.loyverse.com/v1.0/inventory?limit=250`;
            if (cursor) invUrl += `&cursor=${cursor}`;

            const invRes = await fetch(invUrl, { headers: authHeaders });
            if (!invRes.ok) {
                const errText = await invRes.text();
                throw new Error(`Loyverse Inventory API error: ${errText}`);
            }
            const invData = await invRes.json();
            if (invData.inventory_levels && Array.isArray(invData.inventory_levels)) {
                allInventory = allInventory.concat(invData.inventory_levels);
            }
            cursor = invData.cursor;
        } while (cursor);

        // Filter inventory for Noise Urban store
        const stockMap = {};
        allInventory.forEach(inv => {
            if (inv.variant_id && inv.store_id === STORE_ID) {
                stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
            }
        });

        // 2. If single productId requested, fetch item to map variants
        if (productId) {
            const itemRes = await fetch(`https://api.loyverse.com/v1.0/items/${productId}`, { headers: authHeaders });
            if (itemRes.ok) {
                const item = await itemRes.json();
                const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
                const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

                const variants = (item.variants || []).map(v => {
                    const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                    const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                    const currentStock = stockMap[v.variant_id] !== undefined ? stockMap[v.variant_id] : 0;
                    
                    return {
                        id: v.variant_id,
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
                    headers: corsHeaders
                });
            }
        }

        // 3. Return full stockMap
        return new Response(JSON.stringify({
            stockMap,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message || "Error al verificar stock en Loyverse",
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
