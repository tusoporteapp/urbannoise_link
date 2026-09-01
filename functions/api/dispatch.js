// Cloudflare Pages Function: /api/dispatch
// Handles order dispatching and automatic inventory deduction in Loyverse API

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
        const { pin, items } = body;

        const ADMIN_PIN = getAdminPin(context.env);

        // 1. Verify Admin PIN
        if (!pin || pin.toString().trim() !== ADMIN_PIN) {
            return new Response(JSON.stringify({
                success: false,
                error: "Clave de administrador incorrecta. Acceso denegado."
            }), {
                status: 401,
                headers: corsHeaders
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "No se enviaron prendas en la solicitud de despacho."
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        const API_KEY = getSecretKey(context.env);
        const STORE_ID = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

        // 2. Fetch inventory records from Loyverse (handle pagination)
        let allInventory = [];
        let cursor = null;
        do {
            let invUrl = "https://api.loyverse.com/v1.0/inventory?limit=250";
            if (cursor) invUrl += `&cursor=${cursor}`;

            const invRes = await fetch(invUrl, {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (!invRes.ok) {
                const errText = await invRes.text();
                return new Response(JSON.stringify({
                    success: false,
                    error: `Error al consultar inventario en Loyverse API: ${errText}`
                }), {
                    status: 502,
                    headers: corsHeaders
                });
            }

            const invData = await invRes.json();
            if (invData.inventory_levels) {
                allInventory = allInventory.concat(invData.inventory_levels);
            }
            cursor = invData.cursor;
        } while (cursor);

        // 3. Fetch items to get variant attributes
        let allItems = [];
        cursor = null;
        do {
            let itemsUrl = "https://api.loyverse.com/v1.0/items?limit=250";
            if (cursor) itemsUrl += `&cursor=${cursor}`;

            const itemsRes = await fetch(itemsUrl, {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (!itemsRes.ok) {
                const errText = await itemsRes.text();
                return new Response(JSON.stringify({
                    success: false,
                    error: `Error al consultar productos en Loyverse API: ${errText}`
                }), {
                    status: 502,
                    headers: corsHeaders
                });
            }

            const itemsData = await itemsRes.json();
            if (itemsData.items) {
                allItems = allItems.concat(itemsData.items);
            }
            cursor = itemsData.cursor;
        } while (cursor);

        // 4. Map and calculate inventory deductions
        const updates = [];
        const logs = [];

        for (const orderItem of items) {
            const { id, size, color, qty } = orderItem;
            const quantityToDeduct = parseInt(qty, 10) || 1;

            const product = allItems.find(p => p.id === id);
            if (!product) {
                logs.push({
                    id,
                    status: "error",
                    message: "Prenda no encontrada en la base de datos de Loyverse"
                });
                continue;
            }

            const sizeOptionIdx = product.option1_name === 'Tallas' ? 1 : (product.option2_name === 'Tallas' ? 2 : (product.option3_name === 'Tallas' ? 3 : -1));
            const colorOptionIdx = product.option1_name === 'Color' ? 1 : (product.option2_name === 'Color' ? 2 : (product.option3_name === 'Color' ? 3 : -1));

            const variant = product.variants ? product.variants.find(v => {
                const s = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const c = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                
                const matchSize = (s || '').toString().trim().toLowerCase() === (size || 'U').toString().trim().toLowerCase();
                const matchColor = !color || (c || '').toString().trim().toLowerCase() === (color || '').toString().trim().toLowerCase();
                return matchSize && matchColor;
            }) : null;

            if (!variant) {
                logs.push({
                    title: product.item_name,
                    size,
                    color,
                    status: "error",
                    message: "No se encontró la combinación de talla/color en Loyverse"
                });
                continue;
            }

            // Find current stock in Noise Urban store
            const stockRecord = allInventory.find(inv => inv.variant_id === variant.variant_id && inv.store_id === STORE_ID);
            const currentStock = stockRecord ? (stockRecord.in_stock || 0) : 0;
            const newStock = Math.max(0, currentStock - quantityToDeduct);

            updates.push({
                variant_id: variant.variant_id,
                store_id: STORE_ID,
                stock_after: newStock
            });

            logs.push({
                id: product.id,
                variant_id: variant.variant_id,
                title: product.item_name,
                size: size || 'Única',
                color: color || null,
                deductedQty: quantityToDeduct,
                previousStock: currentStock,
                newStock: newStock,
                status: "ok"
            });
        }

        if (updates.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "No se encontraron prendas válidas para descontar inventario.",
                logs
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // 5. Send POST /v1.0/inventory to Loyverse API
        const postRes = await fetch("https://api.loyverse.com/v1.0/inventory", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inventory_levels: updates
            })
        });

        if (!postRes.ok) {
            const errBody = await postRes.text();
            return new Response(JSON.stringify({
                success: false,
                error: `Error al aplicar descuento en Loyverse: ${errBody}`,
                logs
            }), {
                status: 502,
                headers: corsHeaders
            });
        }

        const postData = await postRes.json();

        return new Response(JSON.stringify({
            success: true,
            message: `¡Pedido despachado exitosamente! Se descontaron ${updates.length} prendas en la tienda Noise Urban.`,
            logs,
            loyverseResponse: postData,
            timestamp: new Date().toISOString()
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message || "Error inesperado en el servidor de despacho."
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
