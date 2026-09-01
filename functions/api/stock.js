/**
 * Cloudflare Pages Function: /api/stock
 * Ultra-fast micro-endpoint to verify real-time inventory for a single item/variants in Loyverse POS
 * Tienda Noise Urban (fee704a4-ff11-43ae-903e-d2f9cf0a9a25)
 */

function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
}

export async function onRequestGet(context) {
    const url = new URL(context.request.url);
    const itemId = url.searchParams.get('item_id') || url.searchParams.get('id');
    const variantIdsParam = url.searchParams.get('variants') || url.searchParams.get('variant_ids');
    const storeId = url.searchParams.get('store_id') || "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=10, s-maxage=30, stale-while-revalidate=60"
    };

    if (!variantIdsParam && !itemId) {
        return new Response(JSON.stringify({ ok: false, error: "Missing item_id or variants parameter" }), {
            status: 400,
            headers: corsHeaders
        });
    }

    const API_KEY = getSecretKey(context.env);

    const authHeaders = {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
    };

    try {
        let variantIds = variantIdsParam ? variantIdsParam.split(',') : [];

        // If only itemId was passed, fetch the item variants first
        if (variantIds.length === 0 && itemId) {
            const itemRes = await fetch(`https://api.loyverse.com/v1.0/items/${itemId}`, { headers: authHeaders });
            if (itemRes.ok) {
                const itemData = await itemRes.json();
                if (itemData.variants && Array.isArray(itemData.variants)) {
                    variantIds = itemData.variants.map(v => v.variant_id);
                }
            }
        }

        if (variantIds.length === 0) {
            return new Response(JSON.stringify({ ok: false, error: "No variants found for item" }), {
                status: 404,
                headers: corsHeaders
            });
        }

        // Fetch inventory levels for these variants
        const invUrl = `https://api.loyverse.com/v1.0/inventory?variant_ids=${variantIds.join(',')}&store_id=${storeId}`;
        const invRes = await fetch(invUrl, { headers: authHeaders });

        if (!invRes.ok) {
            const errText = await invRes.text();
            throw new Error(`Loyverse Inventory API error: ${errText}`);
        }

        const invData = await invRes.json();
        const inventoryMap = {};
        let totalStock = 0;

        (invData.inventory_levels || []).forEach(inv => {
            if (inv.store_id === storeId) {
                const qty = Math.max(0, inv.in_stock || 0);
                inventoryMap[inv.variant_id] = qty;
                totalStock += qty;
            }
        });

        // Ensure all queried variants are in map (default 0 if missing)
        variantIds.forEach(vId => {
            if (inventoryMap[vId] === undefined) {
                inventoryMap[vId] = 0;
            }
        });

        const responsePayload = {
            ok: true,
            item_id: itemId,
            store_id: storeId,
            inventory: inventoryMap,
            total_stock: totalStock,
            is_sold_out: totalStock <= 0,
            checked_at: new Date().toISOString()
        };

        return new Response(JSON.stringify(responsePayload), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), {
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
