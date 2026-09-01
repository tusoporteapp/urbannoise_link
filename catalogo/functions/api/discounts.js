function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
}

function getCorsHeaders(request) {
    const origin = request.headers.get("Origin") || "";
    const isAllowed = origin.includes("urbannoise.cc") || origin.includes("localhost") || origin.includes("127.0.0.1");
    const allowedOrigin = isAllowed ? origin : "https://urbannoise.cc";

    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
    };
}

export async function onRequestOptions(context) {
    return new Response(null, {
        status: 204,
        headers: getCorsHeaders(context.request)
    });
}

export async function onRequestGet(context) {
    const corsHeaders = getCorsHeaders(context.request);
    const token = getSecretKey(context.env);

    try {
        const response = await fetch("https://api.loyverse.com/v1.0/discounts", {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ discounts: [] }), {
                status: response.status,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                }
            });
        }

        const data = await response.json();
        const rawDiscounts = data.discounts || [];
        
        // Filter active non-deleted discounts
        const activeDiscounts = rawDiscounts
            .filter(d => !d.deleted_at)
            .map(d => ({
                id: d.id,
                name: d.name,
                type: d.type, // "FIXED_PERCENT" or "FIXED_AMOUNT"
                percent: d.discount_percent || 0,
                value: d.discount_amount || 0,
                restricted: d.restricted_access || false
            }));

        return new Response(JSON.stringify({ discounts: activeDiscounts }), {
            status: 200,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
            }
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message, discounts: [] }), {
            status: 500,
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            }
        });
    }
}
