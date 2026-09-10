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
        "Cache-Control": "public, max-age=5, s-maxage=5"
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
        const rawOrder = (url.searchParams.get('order') || '').trim();

        if (!orderId && !rawOrder) {
            return new Response(JSON.stringify({
                success: false,
                dispatched: false,
                error: "Falta el parámetro 'oid' o 'order'."
            }), { status: 400, headers: corsHeaders });
        }

        const API_KEY = getSecretKey(context.env);

        // Parse rawOrder items if provided (format "id:size:color:qty,id2:size2:color2:qty2")
        let parsedOrderItems = [];
        if (rawOrder) {
            try {
                parsedOrderItems = rawOrder.split(',').map(str => {
                    const parts = str.split(':');
                    if (parts.length >= 4) {
                        return {
                            id: parts[0].trim(),
                            size: (parts[1] || 'U').trim().toLowerCase(),
                            color: (parts[2] || '').trim().toLowerCase(),
                            qty: parseInt(parts[3], 10) || 1
                        };
                    }
                    return null;
                }).filter(Boolean);
            } catch(e) {}
        }

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

            if (!res.ok) break;

            const data = await res.json();
            const receipts = data.receipts || [];

            for (const r of receipts) {
                // 1. Coincidencia por OID exacto
                if (orderId && (
                    (r.order && r.order.trim() === orderId) ||
                    (r.note && r.note.includes(orderId))
                )) {
                    matchedReceipt = r;
                    break;
                }

                // 2. Coincidencia inteligente por prendas si el recibo es de URBANNOISE WHATSAPP
                if (parsedOrderItems.length > 0 && r.source === "URBANNOISE WHATSAPP" && r.line_items) {
                    if (r.line_items.length === parsedOrderItems.length) {
                        const allMatch = parsedOrderItems.every(po => {
                            return r.line_items.some(li => {
                                if (li.item_id !== po.id) return false;
                                if (li.quantity !== po.qty) return false;
                                const vn = (li.variant_name || '').toLowerCase();
                                if (!vn.includes(po.size)) return false;
                                if (po.color && po.color !== 'u' && po.color !== 'null' && !vn.includes(po.color)) return false;
                                return true;
                            });
                        });
                        if (allMatch) {
                            matchedReceipt = r;
                            break;
                        }
                    }
                }
            }

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
                order_id: orderId || matchedReceipt.order
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
