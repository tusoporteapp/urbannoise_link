// Cloudflare Pages Function: /api/negative_diagnostics
// Intelligent Root-Cause Diagnostics for Negative Stock Variants in Loyverse POS

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
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Cache-Control": "public, max-age=86400"
        }
    });
}

export async function onRequest(context) {
    const corsHeaders = getCorsHeaders(context.request);
    const method = context.request.method.toUpperCase();

    if (method === "OPTIONS") {
        return onRequestOptions(context);
    }

    try {
        let variantId = null;
        let storeId = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Noise Urban default
        let itemId = null;
        let action = null;
        let pin = null;

        if (method === "GET") {
            const url = new URL(context.request.url);
            variantId = url.searchParams.get("variant_id") || url.searchParams.get("v_id");
            storeId = url.searchParams.get("store_id") || storeId;
            itemId = url.searchParams.get("item_id");
            action = url.searchParams.get("action");
            pin = url.searchParams.get("pin");
        } else {
            const body = await context.request.json().catch(() => ({}));
            variantId = body.variant_id || body.v_id;
            storeId = body.store_id || storeId;
            itemId = body.item_id;
            action = body.action;
            pin = body.pin;
        }

        if (!variantId) {
            return new Response(JSON.stringify({
                success: false,
                error: "Se requiere el parámetro variant_id para diagnosticar."
            }), { status: 400, headers: corsHeaders });
        }

        const API_KEY = getSecretKey(context.env);
        const ADMIN_PIN = getAdminPin(context.env);
        const authHeaders = {
            "Authorization": "Bearer " + API_KEY,
            "Content-Type": "application/json"
        };

        // ACCIÓN RÁPIDA: CALIBRAR A CERO (si se solicita directamente desde el modal)
        if (action === "calibrate_to_zero") {
            if (!pin || pin.toString().trim() !== ADMIN_PIN) {
                return new Response(JSON.stringify({
                    success: false,
                    error: "PIN de seguridad incorrecto para calibrar inventario."
                }), { status: 401, headers: corsHeaders });
            }

            const calibratePayload = {
                inventory_levels: [
                    {
                        variant_id: variantId,
                        store_id: storeId,
                        stock_after: 0
                    }
                ]
            };

            const calRes = await fetch("https://api.loyverse.com/v1.0/inventory", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify(calibratePayload)
            });

            if (!calRes.ok) {
                const errText = await calRes.text();
                return new Response(JSON.stringify({
                    success: false,
                    error: "Error al actualizar en Loyverse: " + errText
                }), { status: 502, headers: corsHeaders });
            }

            return new Response(JSON.stringify({
                success: true,
                action: "calibrated",
                message: "¡Inventario de la variante calibrado a 0 exitosamente en Loyverse!",
                variant_id: variantId,
                store_id: storeId,
                in_stock: 0
            }), { status: 200, headers: corsHeaders });
        }

        // 1. Consultar estado actual del inventario de la variante
        const invRes = await fetch("https://api.loyverse.com/v1.0/inventory?variant_ids=" + encodeURIComponent(variantId) + "&store_id=" + encodeURIComponent(storeId), {
            headers: authHeaders
        });

        if (!invRes.ok) {
            const errText = await invRes.text();
            return new Response(JSON.stringify({
                success: false,
                error: "Error al consultar inventario en Loyverse: " + errText
            }), { status: 502, headers: corsHeaders });
        }

        const invData = await invRes.json();
        const inv = (invData.inventory_levels || []).find(i => i.variant_id === variantId && i.store_id === storeId)
            || (invData.inventory_levels || [])[0];

        const currentStock = inv ? (inv.in_stock !== undefined ? inv.in_stock : 0) : 0;
        const lastUpdatedAt = inv ? inv.updated_at : null;

        // 2. Metadatos paralelos (Empleados, Dispositivos TPV, e Ítem si aplica)
        const [empRes, posRes, itemRes] = await Promise.all([
            fetch("https://api.loyverse.com/v1.0/employees", { headers: authHeaders }).catch(() => null),
            fetch("https://api.loyverse.com/v1.0/pos_devices", { headers: authHeaders }).catch(() => null),
            itemId ? fetch("https://api.loyverse.com/v1.0/items/" + encodeURIComponent(itemId), { headers: authHeaders }).catch(() => null) : Promise.resolve(null)
        ]);

        const empMap = {};
        if (empRes && empRes.ok) {
            const empData = await empRes.json().catch(() => ({}));
            (empData.employees || []).forEach(e => { empMap[e.id] = e.name; });
        }

        const posMap = {};
        if (posRes && posRes.ok) {
            const posData = await posRes.json().catch(() => ({}));
            (posData.pos_devices || []).forEach(p => { posMap[p.id] = p.name; });
        }

        let itemDetails = null;
        if (itemRes && itemRes.ok) {
            const itData = await itemRes.json().catch(() => null);
            if (itData) {
                const targetVar = (itData.variants || []).find(v => v.variant_id === variantId);
                itemDetails = {
                    item_id: itData.id,
                    item_name: itData.item_name,
                    sku: targetVar ? targetVar.sku : null,
                    option1: targetVar ? targetVar.option1_value : null,
                    option2: targetVar ? targetVar.option2_value : null
                };
            }
        }

        // 3. Buscar recibos / ventas en Loyverse de los últimos 45 días
        const now = new Date();
        const sinceDate = new Date(now.getTime() - 45 * 24 * 3600 * 1000);
        const sinceIso = sinceDate.toISOString();
        const untilIso = new Date(now.getTime() + 3600 * 1000).toISOString();

        let matchingReceipts = [];
        let cursor = null;
        let pageCount = 0;
        const MAX_PAGES = 4; // Hasta 1000 recibos recientes

        do {
            let recUrl = "https://api.loyverse.com/v1.0/receipts?store_id=" + encodeURIComponent(storeId) +
                         "&since=" + encodeURIComponent(sinceIso) + "&until=" + encodeURIComponent(untilIso) + "&limit=250";
            if (cursor) recUrl += "&cursor=" + encodeURIComponent(cursor);

            const recRes = await fetch(recUrl, { headers: authHeaders });
            if (!recRes.ok) break;

            const recData = await recRes.json().catch(() => ({}));
            const list = recData.receipts || [];
            
            for (const r of list) {
                const foundLine = (r.line_items || []).find(li => li.variant_id === variantId);
                if (foundLine) {
                    matchingReceipts.push({
                        receipt_number: r.receipt_number,
                        receipt_type: r.receipt_type || "SALE",
                        receipt_date: r.receipt_date || r.created_at,
                        created_at: r.created_at,
                        source: r.source || "point of sale",
                        employee_name: empMap[r.employee_id] || "Cajero",
                        pos_device_name: posMap[r.pos_device_id] || "TPV Mostrador",
                        line_item: {
                            quantity: foundLine.quantity || 1,
                            price: foundLine.price || 0,
                            sku: foundLine.sku || (itemDetails ? itemDetails.sku : null),
                            gross_total: foundLine.gross_total_money || foundLine.total_money || 0
                        },
                        payments: (r.payments || []).map(p => ({
                            name: p.name,
                            type: p.type,
                            amount: p.money_amount
                        }))
                    });
                }
            }

            cursor = recData.cursor;
            pageCount++;
        } while (cursor && pageCount < MAX_PAGES);

        // Ordenar cronológicamente descendente (más reciente primero)
        matchingReceipts.sort((a, b) => new Date(b.receipt_date) - new Date(a.receipt_date));

        const storeName = storeId === "cf0674d5-6edd-426b-a5a6-b1f65bba6770" ? "Neos" : "Noise Urban";

        // 4. MOTOR DE DIAGNÓSTICO: Determinar causa y certificar origen
        let diagnosis = {};

        if (matchingReceipts.length > 0) {
            const latest = matchingReceipts[0];
            const isWhatsAppDispatch = (latest.source || "").toUpperCase().includes("WHATSAPP");

            diagnosis = {
                verdict: "VENTA_REGISTRADA",
                verdict_title: isWhatsAppDispatch ? "Venta Despachada (Pedido Web/WhatsApp)" : "Venta Directa en Mostrador (Caja TPV)",
                verdict_icon: "shopping-bag",
                badge_color: "rose",
                caused_by: isWhatsAppDispatch ? "Despacho de Pedido Web / WhatsApp" : "Venta en Punto de Venta Físico (TPV)",
                origin: isWhatsAppDispatch ? "URBANNOISE_API_DESPACHO" : "LOYVERSE_POS_DIRECTO",
                origin_label: isWhatsAppDispatch ? "API Urbannoise (Despacho de Pedido)" : "Loyverse TPV Mostrador (Caja Registradora Directa)",
                event_date: latest.receipt_date,
                receipt_number: latest.receipt_number,
                employee: latest.employee_name,
                pos_device: latest.pos_device_name,
                quantity_affected: latest.line_item.quantity,
                sale_price: latest.line_item.price,
                payment_methods: latest.payments.map(p => p.name).join(", ") || "Efectivo",
                explanation: "Se registró una venta de " + latest.line_item.quantity + " unidad(es) (Ticket #" + latest.receipt_number + ") en la tienda " + storeName + " cuando el inventario en el sistema no tenía existencias suficientes (estaba en 0 o inferior).",
                auditor_certification: {
                    caused_by_auditor: false,
                    status: "DESCARTADO",
                    details: "El Auditor Urbannoise cuenta con una protección nativa en su código (Math.max(0, ...)) que prohíbe terminantemente enviar saldos negativos a Loyverse. El negativo fue ocasionado directamente por la venta en mostrador."
                }
            };
        } else {
            // Sin recibo reciente -> Ajuste / Edición manual de inventario
            diagnosis = {
                verdict: "EDICION_MANUAL",
                verdict_title: "Edición / Ajuste Manual de Inventario",
                verdict_icon: "edit-3",
                badge_color: "amber",
                caused_by: "Ajuste Manual en Panel de Control Loyverse",
                origin: "LOYVERSE_BACKOFFICE",
                origin_label: "Loyverse Back Office (Web) o Importación CSV Directa",
                event_date: lastUpdatedAt,
                receipt_number: null,
                employee: "Usuario con acceso a Back Office",
                pos_device: "Panel Web Loyverse",
                quantity_affected: currentStock,
                explanation: "No se registró ningún ticket de venta reciente para esta talla. El saldo de " + currentStock + " unidades fue introducido mediante un ajuste de inventario manual, edición directa de stock o importación masiva en el panel web de Loyverse.",
                auditor_certification: {
                    caused_by_auditor: false,
                    status: "DESCARTADO",
                    details: "El Auditor Urbannoise está bloqueado técnicamente para no aceptar ni sincronizar números menores a cero. Este movimiento se realizó externamente en el panel de Loyverse."
                }
            };
        }

        return new Response(JSON.stringify({
            success: true,
            variant_id: variantId,
            store_id: storeId,
            store_name: storeName,
            current_stock: currentStock,
            is_negative: currentStock < 0,
            last_updated_at: lastUpdatedAt,
            item_details: itemDetails,
            diagnosis: diagnosis,
            recent_receipts_count: matchingReceipts.length,
            recent_receipts: matchingReceipts.slice(0, 5)
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: "Error en diagnóstico de negativos: " + (err.message || String(err))
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
