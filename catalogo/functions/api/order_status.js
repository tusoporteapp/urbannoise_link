// Cloudflare Pages Function: /api/order_status
// Checks whether a shared wholesale order has already been dispatched in Loyverse POS

function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
}

function getCorsHeaders(request) {
    const origin = request.headers.get("Origin") || "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=10, s-maxage=10"
    };
}

export async function onRequestOptions(context) {
    const corsHeaders = getCorsHeaders(context.request);
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    });
}

export async function onRequestGet(context) {
    const corsHeaders = getCorsHeaders(context.request);

    try {
        const url = new URL(context.request.url);
        const orderId = (url.searchParams.get('oid') || url.searchParams.get('order_id') || '').trim();

        if (!orderId) {
            return new Response(JSON.stringify({
                success: false,
                dispatched: false,
                error: "Falta el parámetro 'oid' de la orden."
            }), { status: 400, headers: corsHeaders });
        }

        const API_KEY = getSecretKey(context.env);

        // Consultar los recibos de los últimos 14 días en Loyverse
        const minDate = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
        let cursor = null;
        let matchedReceipt = null;

        do {
            let loyverseUrl = `https://api.loyverse.com/v1.0/receipts?created_at_min=${encodeURIComponent(minDate)}&limit=100`;
            if (cursor) loyverseUrl += `&cursor=${encodeURIComponent(cursor)}`;

            const res = await fetch(loyverseUrl, {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (!res.ok) {
                break;
            }

            const data = await res.json();
            const receipts = data.receipts || [];

            matchedReceipt = receipts.find(r => 
                (r.order && r.order.trim() === orderId) ||
                (r.note && r.note.includes(orderId))
            );

            if (matchedReceipt) break;
            cursor = data.cursor;
        } while (cursor);

        if (matchedReceipt) {
            return new Response(JSON.stringify({
                success: true,
                dispatched: true,
                receipt_number: matchedReceipt.receipt_number || "REGISTRADO",
                receipt_date: matchedReceipt.receipt_date,
                total_money: matchedReceipt.total_money,
                order_id: orderId
            }), { status: 200, headers: corsHeaders });
        }

        return new Response(JSON.stringify({
            success: true,
            dispatched: false,
            order_id: orderId
        }), { status: 200, headers: corsHeaders });

    } catch (err) {
        console.error("Order status check error:", err);
        return new Response(JSON.stringify({
            success: false,
            dispatched: false,
            error: err.message
        }), { status: 500, headers: corsHeaders });
    }
}
