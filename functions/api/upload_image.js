// Cloudflare Pages Function: /api/upload_image
// Secure mobile camera photo upload directly to Loyverse item API

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
        const { pin, item_id, image, content_type } = body;

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

        // 2. Validate input parameters
        if (!item_id || !image) {
            return new Response(JSON.stringify({
                success: false,
                error: "Falta el ID de la prenda (item_id) o la imagen."
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // 3. Parse base64 and determine mime type
        let base64Data = image;
        let mimeType = content_type || "image/jpeg";
        if (base64Data.startsWith("data:")) {
            const parts = base64Data.split(",");
            const header = parts[0];
            base64Data = parts[1];
            if (header.includes("image/png")) mimeType = "image/png";
            else if (header.includes("image/jpeg") || header.includes("image/jpg")) mimeType = "image/jpeg";
            else if (header.includes("image/webp")) mimeType = "image/webp";
        }

        // Convert base64 string into binary Uint8Array
        const binaryString = atob(base64Data);
        const binaryBuffer = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            binaryBuffer[i] = binaryString.charCodeAt(i);
        }

        const API_KEY = getSecretKey(context.env);

        // 4. Send image binary stream to Loyverse Items API
        const loyverseUrl = `https://api.loyverse.com/v1.0/items/${encodeURIComponent(item_id)}/image`;
        const loyverseRes = await fetch(loyverseUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": mimeType,
                "Content-Length": binaryBuffer.byteLength.toString()
            },
            body: binaryBuffer
        });

        if (!loyverseRes.ok) {
            const errText = await loyverseRes.text();
            return new Response(JSON.stringify({
                success: false,
                error: `Error de Loyverse al guardar foto (${loyverseRes.status}): ${errText}`
            }), {
                status: 502,
                headers: corsHeaders
            });
        }

        // 5. Fetch updated item to retrieve the new image_url
        let newImageUrl = null;
        try {
            const getItemRes = await fetch(`https://api.loyverse.com/v1.0/items/${encodeURIComponent(item_id)}`, {
                headers: { "Authorization": `Bearer ${API_KEY}` }
            });
            if (getItemRes.ok) {
                const itemData = await getItemRes.json();
                newImageUrl = itemData.image_url || null;
            }
        } catch (_) {
            // Ignore error fetching item detail; upload itself succeeded
        }

        return new Response(JSON.stringify({
            success: true,
            item_id: item_id,
            image_url: newImageUrl,
            message: "¡Foto del estampado subida y vinculada exitosamente a la prenda en Loyverse!"
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: "Error interno al procesar la imagen: " + (err.message || String(err))
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
