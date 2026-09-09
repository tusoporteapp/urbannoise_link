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
        console.log(`⚡ Received real-time Loyverse Webhook [${eventType}]`);

        // Instant Invalidation of Cloudflare Edge Micro-Cache for /api/catalog
        try {
            const cache = caches.default;
            const storeIds = ["fee704a4-ff11-43ae-903e-d2f9cf0a9a25", "cf0674d5-6edd-426b-a5a6-b1f65bba6770"];
            for (const sid of storeIds) {
                const purgableUrl = new URL(context.request.url);
                purgableUrl.pathname = '/api/catalog';
                purgableUrl.search = `?store_id=${sid}`;
                await cache.delete(new Request(purgableUrl.toString(), { method: 'GET' }));
            }
            console.log(`⚡ [Webhook] Edge cache invalidated successfully for Loyverse event: ${eventType}`);
        } catch(cErr) {
            console.warn("Could not invalidate edge cache from webhook:", cErr);
        }

        // Trigger GitHub Repository Dispatch if GITHUB_TOKEN is available
        const GITHUB_TOKEN = (context.env && context.env.GITHUB_TOKEN) ? context.env.GITHUB_TOKEN : null;
        if (GITHUB_TOKEN) {
            try {
                await fetch("https://api.github.com/repos/tusoporteapp/urbannoise_link/dispatches", {
                    method: "POST",
                    headers: {
                        "Authorization": `token ${GITHUB_TOKEN}`,
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "Loyverse-Webhook-Relay",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        event_type: "loyverse_update",
                        client_payload: { event: eventType, time: new Date().toISOString() }
                    })
                });
                console.log("Triggered GitHub Actions auto-sync dispatch successfully.");
            } catch(ghErr) {
                console.warn("GitHub dispatch trigger error:", ghErr);
            }
        }

        // Respond 200 OK immediately to Loyverse POS
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
