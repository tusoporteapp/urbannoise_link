/**
 * Cloudflare Pages Function: /api/webhook
 * Real-Time Webhook Listener for Loyverse POS Events
 * Handles items.update, inventory_levels.update, and receipts.update
 */

export async function onRequestPost(context) {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json; charset=utf-8"
    };

    try {
        let payload = {};
        try {
            payload = await context.request.json();
        } catch(e) {}

        const eventType = payload.type || payload.event || context.request.headers.get("X-Loyverse-Event") || "unknown";
        console.log(`⚡ Received real-time Loyverse Webhook [${eventType}]:`, JSON.stringify(payload));

        // 1. Invalidate Cloudflare Edge Cache for /api/catalog and /api/stock
        try {
            const cache = caches.default;
            const url = new URL(context.request.url);
            
            // Delete /api/catalog cache
            url.pathname = '/api/catalog';
            url.search = '';
            await cache.delete(new Request(url.toString()));

            // Delete /api/stock cache
            url.pathname = '/api/stock';
            url.search = '';
            await cache.delete(new Request(url.toString()));

            console.log("Cleared Cloudflare Edge Cache for catalog and stock endpoints.");
        } catch (cacheErr) {
            console.warn("Edge cache invalidation error:", cacheErr);
        }

        // 2. Respond 200 OK to Loyverse POS
        return new Response(JSON.stringify({
            success: true,
            received: true,
            event: eventType,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || "Error al procesar webhook de Loyverse"
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
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "public, max-age=86400"
        }
    });
}
