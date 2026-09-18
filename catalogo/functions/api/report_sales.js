// Cloudflare Pages Function: /api/report_sales
// Aggregates sales and receipts metrics from Loyverse API for report generation

function getSecretKey(env) {
    if (env && env.LOYVERSE_API_KEY) return env.LOYVERSE_API_KEY;
    return atob("Y2NjMjZhYTJkMDBhNDhhNGE4ZDhiNDYwNmNmNzUzMWU=");
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
        const body = await context.request.json().catch(() => ({}));
        const {
            store_id = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25",
            since,
            until,
            item_ids = [],
            variant_ids = []
        } = body;

        const API_KEY = getSecretKey(context.env);

        // Normalize dates
        let sinceIso = since;
        if (!sinceIso) {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            sinceIso = d.toISOString();
        } else if (!sinceIso.includes("T")) {
            sinceIso = new Date(sinceIso + "T00:00:00.000Z").toISOString();
        }

        let untilIso = until;
        if (!untilIso) {
            untilIso = new Date().toISOString();
        } else if (!untilIso.includes("T")) {
            untilIso = new Date(untilIso + "T23:59:59.999Z").toISOString();
        }

        // Fetch receipts paginated from Loyverse API
        let allReceipts = [];
        let cursor = null;
        let pageCount = 0;
        const MAX_PAGES = 8; // Safety ceiling (up to 2000 receipts)

        do {
            let url = "https://api.loyverse.com/v1.0/receipts?since=" + encodeURIComponent(sinceIso) +
                      "&until=" + encodeURIComponent(untilIso) + "&limit=250";
            if (cursor) url += "&cursor=" + encodeURIComponent(cursor);

            const res = await fetch(url, {
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error("Loyverse API Error: " + res.status + " " + errText);
            }

            const data = await res.json();
            const receipts = data.receipts || [];
            allReceipts = allReceipts.concat(receipts);
            cursor = data.cursor;
            pageCount++;
        } while (cursor && pageCount < MAX_PAGES);

        // Filter and aggregate sales
        const itemIdsSet = new Set(Array.isArray(item_ids) && item_ids.length > 0 ? item_ids : []);
        const variantIdsSet = new Set(Array.isArray(variant_ids) && variant_ids.length > 0 ? variant_ids : []);

        let totalUnitsSold = 0;
        let totalGrossSales = 0;
        let totalNetSales = 0;
        let totalDiscounts = 0;
        let totalCost = 0;
        let filteredReceiptsCount = 0;

        const byItem = {};
        const byVariant = {};
        const byDate = {};
        const bySize = {};
        const byColor = {};

        for (const r of allReceipts) {
            // Filter by store
            if (store_id && r.store_id && r.store_id !== store_id) continue;

            const receiptDateStr = (r.receipt_date || "").slice(0, 10);
            let hasMatchedItem = false;

            for (const line of (r.line_items || [])) {
                const itemId = line.item_id;
                const variantId = line.variant_id;

                if (itemIdsSet.size > 0 && !itemIdsSet.has(itemId)) continue;
                if (variantIdsSet.size > 0 && !variantIdsSet.has(variantId)) continue;

                hasMatchedItem = true;
                const qty = Number(line.quantity) || 0;
                const gross = Number(line.gross_total_money) || (Number(line.price || 0) * qty);
                const net = Number(line.total_money) || gross;
                const disc = Number(line.total_discount) || 0;
                const cost = Number(line.cost_total) || 0;

                totalUnitsSold += qty;
                totalGrossSales += gross;
                totalNetSales += net;
                totalDiscounts += disc;
                totalCost += cost;

                // Item breakdown
                if (!byItem[itemId]) {
                    byItem[itemId] = {
                        item_id: itemId,
                        item_name: line.item_name || "Sin Nombre",
                        quantity: 0,
                        gross_sales: 0,
                        net_sales: 0,
                        variants: {}
                    };
                }
                byItem[itemId].quantity += qty;
                byItem[itemId].gross_sales += gross;
                byItem[itemId].net_sales += net;

                // Variant breakdown
                if (!byItem[itemId].variants[variantId]) {
                    byItem[itemId].variants[variantId] = {
                        variant_id: variantId,
                        variant_name: line.variant_name || "Única",
                        sku: line.sku || "",
                        quantity: 0,
                        net_sales: 0
                    };
                }
                byItem[itemId].variants[variantId].quantity += qty;
                byItem[itemId].variants[variantId].net_sales += net;

                // Flat variant lookup
                if (!byVariant[variantId]) {
                    byVariant[variantId] = {
                        variant_id: variantId,
                        item_id: itemId,
                        item_name: line.item_name,
                        variant_name: line.variant_name || "Única",
                        sku: line.sku || "",
                        quantity: 0,
                        net_sales: 0
                    };
                }
                byVariant[variantId].quantity += qty;
                byVariant[variantId].net_sales += net;

                // Timeline
                if (receiptDateStr) {
                    if (!byDate[receiptDateStr]) byDate[receiptDateStr] = { date: receiptDateStr, quantity: 0, sales: 0 };
                    byDate[receiptDateStr].quantity += qty;
                    byDate[receiptDateStr].sales += net;
                }

                // Size & Color heuristics from variant_name (e.g. 'XXL / Negro' or 'M')
                if (line.variant_name) {
                    const parts = line.variant_name.split("/").map(s => s.trim());
                    if (parts.length >= 1 && parts[0]) {
                        const s = parts[0];
                        bySize[s] = (bySize[s] || 0) + qty;
                    }
                    if (parts.length >= 2 && parts[1]) {
                        const c = parts[1];
                        byColor[c] = (byColor[c] || 0) + qty;
                    }
                }
            }

            if (hasMatchedItem) filteredReceiptsCount++;
        }

        return new Response(JSON.stringify({
            success: true,
            period: {
                since: sinceIso,
                until: untilIso
            },
            store_id: store_id,
            summary: {
                total_receipts: filteredReceiptsCount,
                total_units_sold: totalUnitsSold,
                gross_sales: totalGrossSales,
                net_sales: totalNetSales,
                total_discounts: totalDiscounts,
                total_cost: totalCost,
                average_ticket: filteredReceiptsCount > 0 ? Math.round(totalNetSales / filteredReceiptsCount) : 0
            },
            items: byItem,
            variants: byVariant,
            trends: {
                by_date: byDate,
                by_size: bySize,
                by_color: byColor
            }
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        return new Response(JSON.stringify({
            success: false,
            error: err.message || "Error al procesar ventas"
        }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
