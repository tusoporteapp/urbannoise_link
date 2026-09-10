// Cloudflare Pages Function: /api/customer
// Handles customer creation and updating in Loyverse POS API

function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
}

function getCorsHeaders(request) {
    const origin = request.headers.get("Origin") || "*";
    return {
        "Access-Control-Allow-Origin": origin,
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
        const { name, cedula, city, address, phone } = body || {};

        if (!name || !name.trim()) {
            return new Response(JSON.stringify({
                success: false,
                error: "El nombre completo es obligatorio."
            }), { status: 400, headers: corsHeaders });
        }

        if (!cedula || !cedula.toString().trim()) {
            return new Response(JSON.stringify({
                success: false,
                error: "El número de cédula es obligatorio."
            }), { status: 400, headers: corsHeaders });
        }

        const cleanName = name.trim();
        const cleanCedula = cedula.toString().trim();
        const cleanPhone = phone ? phone.toString().trim() : "";
        const cleanAddress = address ? address.trim() : "";
        const cleanCity = city ? city.trim() : "";

        const API_KEY = getSecretKey(context.env);

        const payload = {
            name: cleanName,
            customer_code: cleanCedula,
            phone_number: cleanPhone || undefined,
            address: cleanAddress || undefined,
            city: cleanCity || undefined,
            note: `CC: ${cleanCedula} | Dir: ${cleanAddress} - ${cleanCity} | Catálogo Mayorista Web`
        };

        const loyverseHeaders = {
            "Authorization": `Bearer ${API_KEY}`,
            "Content-Type": "application/json"
        };

        // 1. Intentar creación directa
        const postRes = await fetch("https://api.loyverse.com/v1.0/customers", {
            method: "POST",
            headers: loyverseHeaders,
            body: JSON.stringify(payload)
        });

        if (postRes.ok) {
            const customerData = await postRes.json();
            return new Response(JSON.stringify({
                success: true,
                action: "created",
                customer: customerData
            }), { status: 200, headers: corsHeaders });
        }

        const errText = await postRes.text();

        // 2. Si el código/cédula ya existe, buscar y actualizar cliente
        if (postRes.status === 400 && errText.includes("already exists")) {
            let cursor = null;
            let existingCustomer = null;

            do {
                let url = "https://api.loyverse.com/v1.0/customers?limit=250";
                if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

                const getRes = await fetch(url, {
                    headers: loyverseHeaders
                });

                if (getRes.ok) {
                    const getData = await getRes.json();
                    const list = getData.customers || [];
                    existingCustomer = list.find(c => c.customer_code === cleanCedula);
                    if (existingCustomer) break;
                    cursor = getData.cursor;
                } else {
                    break;
                }
            } while (cursor);

            if (existingCustomer && existingCustomer.id) {
                const updateRes = await fetch("https://api.loyverse.com/v1.0/customers", {
                    method: "POST",
                    headers: loyverseHeaders,
                    body: JSON.stringify({
                        id: existingCustomer.id,
                        ...payload
                    })
                });

                if (updateRes.ok) {
                    const updatedData = await updateRes.json();
                    return new Response(JSON.stringify({
                        success: true,
                        action: "updated",
                        customer: updatedData
                    }), { status: 200, headers: corsHeaders });
                }
            }

            return new Response(JSON.stringify({
                success: true,
                action: "already_registered",
                customer_code: cleanCedula
            }), { status: 200, headers: corsHeaders });
        }

        return new Response(JSON.stringify({
            success: false,
            error: `Loyverse Error: ${errText}`
        }), { status: 502, headers: corsHeaders });

    } catch (err) {
        console.error("Customer API Error:", err);
        return new Response(JSON.stringify({
            success: false,
            error: `Error interno en servidor: ${err.message}`
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
