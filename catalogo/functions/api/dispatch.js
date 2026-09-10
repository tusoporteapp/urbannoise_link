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

        // 4. Map and calculate receipt line items & inventory
        const receiptLineItems = [];
        const logs = [];
        let totalMoney = 0;

        for (const orderItem of items) {
            const { id, size, color, qty, price } = orderItem;
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
                if (orderItem.variant_id && (v.variant_id === orderItem.variant_id || v.id === orderItem.variant_id)) {
                    return true;
                }
                const s = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
                const c = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
                
                const matchSize = (s || '').toString().trim().toLowerCase() === (size || 'U').toString().trim().toLowerCase();
                const isNoColor = !color || color === 'U' || color === 'null' || color === 'undefined' || color === '';
                const matchColor = isNoColor || (c || '').toString().trim().toLowerCase() === (color || '').toString().trim().toLowerCase();
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

            // Determine item price (variant price > product price > orderItem price > wholesale default)
            const itemPrice = typeof variant.price === 'number' && variant.price > 0 
                ? variant.price 
                : (typeof product.price === 'number' && product.price > 0 ? product.price : (parseInt(price, 10) || 33000));

            const lineTotal = itemPrice * quantityToDeduct;
            totalMoney += lineTotal;

            receiptLineItems.push({
                variant_id: variant.variant_id,
                quantity: quantityToDeduct,
                price: itemPrice
            });

            // Find current stock in Noise Urban store
            const stockRecord = allInventory.find(inv => inv.variant_id === variant.variant_id && inv.store_id === STORE_ID);
            const currentStock = stockRecord ? (stockRecord.in_stock || 0) : 0;
            const newStock = Math.max(0, currentStock - quantityToDeduct);

            logs.push({
                id: product.id,
                variant_id: variant.variant_id,
                title: product.item_name,
                size: size || 'Única',
                color: color || null,
                deductedQty: quantityToDeduct,
                unitPrice: itemPrice,
                lineTotal: lineTotal,
                previousStock: currentStock,
                newStock: newStock,
                status: "ok"
            });
        }

        if (receiptLineItems.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: "No se encontraron prendas válidas para crear el recibo en Loyverse.",
                logs
            }), {
                status: 400,
                headers: corsHeaders
            });
        }

        // 5. Build and Send Official Sales Receipt to Loyverse (POST /v1.0/receipts)
        const selectedPaymentTypeId = body.payment_type_id || "d9037a50-284f-4ba9-a659-5eef8e5fb26b"; // Default NEQUI
        const selectedPaymentName = body.payment_name || "NEQUI";
        const DEFAULT_CUSTOMER_ID = "82dc9980-a758-4d82-8c6b-b72fa8c0d51c"; // URBANNOISE WHATSAPP
        const activeCustomerId = body.customer_id || DEFAULT_CUSTOMER_ID;
        const custName = body.customer_name ? body.customer_name.trim() : "";
        const custCode = body.customer_code ? body.customer_code.trim() : "";
        const receiptNote = custName ? `Cliente: ${custName}${custCode ? ` (CC: ${custCode})` : ''} | URBANNOISE WHATSAPP` : "URBANNOISE WHATSAPP";

        const nowIso = new Date().toISOString();
        const receiptPayload = {
            store_id: STORE_ID, // Noise Urban exclusiva
            order: `WA-${Date.now().toString().slice(-6)}`,
            customer_id: activeCustomerId,
            source: "URBANNOISE WHATSAPP",
            receipt_date: nowIso,
            note: receiptNote,
            line_items: receiptLineItems,
            payments: [
                {
                    payment_type_id: selectedPaymentTypeId,
                    paid_at: nowIso,
                    money_amount: totalMoney
                }
            ]
        };

        const receiptRes = await fetch("https://api.loyverse.com/v1.0/receipts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(receiptPayload)
        });

        if (!receiptRes.ok) {
            const errBody = await receiptRes.text();
            return new Response(JSON.stringify({
                success: false,
                error: `Error al crear recibo oficial en Loyverse: ${errBody}`,
                logs
            }), {
                status: 502,
                headers: corsHeaders
            });
        }

        const receiptData = await receiptRes.json();

        // 6. Purge Cloudflare Edge Cache so all clients immediately see updated stock
        try {
            const cache = caches.default;
            const origin = new URL(context.request.url).origin;
            const storeIds = ["fee704a4-ff11-43ae-903e-d2f9cf0a9a25", "cf0674d5-6edd-426b-a5a6-b1f65bba6770"];
            for (const sId of storeIds) {
                const purgeUrl = new URL(`${origin}/api/catalog?store_id=${sId}`);
                context.waitUntil(cache.delete(new Request(purgeUrl.toString(), { method: 'GET' })));
            }
            context.waitUntil(cache.delete(new Request(`${origin}/api/catalog`, { method: 'GET' })));
        } catch (cErr) {
            console.warn("Could not purge edge cache on dispatch:", cErr);
        }

        return new Response(JSON.stringify({
            success: true,
            message: `¡Recibo #${receiptData.receipt_number || ''} generado exitosamente en Loyverse para URBANNOISE WHATSAPP!`,
            receipt_number: receiptData.receipt_number || "REGISTRADO",
            total_money: totalMoney,
            payment_name: selectedPaymentName,
            customer_name: "URBANNOISE WHATSAPP",
            store_name: "Noise Urban",
            logs,
            receipt: receiptData,
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
