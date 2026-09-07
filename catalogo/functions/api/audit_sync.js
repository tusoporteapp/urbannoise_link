// Cloudflare Pages Function: /api/audit_sync
// Real-time batch inventory calibration from Store Physical Audit to Loyverse API

function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
}

function getAdminPin(env) {
    if (env && env.ADMIN_PIN) return env.ADMIN_PIN;
    return atob("ODYyNA==");
}

function getCorsHeaders(request) {
    const origin = request.headers.get("Origin") || "";
    const allowed = [
        "https://urbannoise.cc",
        "https://www.urbannoise.cc",
        "http://localhost",
        "http://127.0.0.1"
    ];
    const isAllowed = allowed.some(o => origin === o || origin.startsWith(o + ":"));
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin : "https://urbannoise.cc",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Content-Type": "application/json; charset=utf-8"
    };
}

export async function onRequestOptions(context) {
    const corsHeaders = getCorsHeaders(context.request);
    return new Response(null, {
        status: 204,
        headers: {
            ...corsHeaders,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "public, max-age=86400"
        }
    });
}

export async function onRequestPost(context) {
    const corsHeaders = getCorsHeaders(context.request);

    try {
        const body = await context.request.json();
        const { pin, store_id, inventory_levels } = body;

        const ADMIN_PIN = getAdminPin(context.env);

        // 1. Verify Admin PIN (8624)
        if (!pin || pin.toString().trim() !== ADMIN_PIN) {
            return new Response(JSON.stringify({
                success: false,
                error: "PIN de administrador incorrecto. Acceso denegado."
            }), {
                status: 401,
                headers: corsHeaders
            });
        }

        // 2. Validate input array
        if (!inventory_levels || !Array.isArray(inventory_levels) || inventory_levels.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "No se proporcionaron niveles de inventario para actualizar."
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const API_KEY = getSecretKey(context.env);
        const targetStoreId = store_id || "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban por defecto

        // 3. Format and sanitize levels
        const sanitizedLevels = [];
        for (const item of inventory_levels) {
            if (!item.variant_id) continue;
            const stockVal = Math.max(0, parseInt(item.stock_after, 10) || 0);
            sanitizedLevels.push({
                variant_id: item.variant_id,
                store_id: item.store_id || targetStoreId,
                stock_after: stockVal
            });
        }

        if (sanitizedLevels.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "Ningún registro contiene variant_id válido."
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // 4. Chunk in batches of 100 for Loyverse API safety
        const BATCH_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < sanitizedLevels.length; i += BATCH_SIZE) {
            chunks.push(sanitizedLevels.slice(i, i + BATCH_SIZE));
        }

        let updatedCount = 0;
        const errors = [];

        for (let idx = 0; idx < chunks.length; idx++) {
            const chunk = chunks[idx];
            const loyverseRes = await fetch("https://api.loyverse.com/v1.0/inventory", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ inventory_levels: chunk })
            });

            if (!loyverseRes.ok) {
                const errText = await loyverseRes.text();
                errors.push(`Lote ${idx + 1}/${chunks.length} falló: ${errText}`);
            } else {
                updatedCount += chunk.length;
            }
        }

        if (errors.length > 0 && updatedCount === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "Error al actualizar en Loyverse: " + errors.join("; ")
            }), {
                status: 502,
                headers: corsHeaders
            });
        }

        return new Response(JSON.stringify({
            success: true,
            updated_count: updatedCount,
            total_requested: sanitizedLevels.length,
            batches: chunks.length,
            warnings: errors.length > 0 ? errors : undefined,
            message: `¡Inventario calibrado exitosamente! Se actualizaron ${updatedCount} variantes en Loyverse.`
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: "Error interno del servidor: " + (err.message || String(err))
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
