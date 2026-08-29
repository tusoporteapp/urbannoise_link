/**
 * Urban Noise - Fast Direct Loyverse POS Catalog Synchronizer
 * Usage: node sync_loyverse.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = "ccc26aa2d00a48a4a8d8b4606cf7531e";
const STORE_ID = "fee704a4-ff11-43ae-903e-d2f9cf0a9a25"; // Tienda Noise Urban

async function fetchLoyverse(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.loyverse.com',
            path: `/v1.0/${endpoint}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function sync() {
    console.log("⚡ Starting 1-Click Loyverse POS Direct Sync...");
    const startTime = Date.now();

    console.log("1. Fetching Modifiers & Categories...");
    const [modData, catData] = await Promise.all([
        fetchLoyverse('modifiers').catch(() => ({ modifiers: [] })),
        fetchLoyverse('categories').catch(() => ({ categories: [] }))
    ]);

    const modifiers = modData.modifiers || [];
    const categoryMap = {};
    (catData.categories || []).forEach(c => { categoryMap[c.id] = c.name; });

    console.log("2. Fetching Items...");
    let allItems = [];
    let cursor = null;
    do {
        let ep = 'items?limit=250';
        if (cursor) ep += `&cursor=${cursor}`;
        const data = await fetchLoyverse(ep);
        if (data.items) allItems = allItems.concat(data.items);
        cursor = data.cursor;
    } while (cursor);
    console.log(`- Fetched ${allItems.length} items.`);

    console.log("3. Fetching Inventory Levels...");
    let allInventory = [];
    cursor = null;
    do {
        let ep = 'inventory?limit=250';
        if (cursor) ep += `&cursor=${cursor}`;
        const data = await fetchLoyverse(ep);
        if (data.inventory_levels) allInventory = allInventory.concat(data.inventory_levels);
        cursor = data.cursor;
    } while (cursor);
    console.log(`- Fetched ${allInventory.length} inventory records.`);

    const stockMap = {};
    allInventory.forEach(inv => {
        if (inv.variant_id && inv.store_id === STORE_ID) {
            stockMap[inv.variant_id] = (stockMap[inv.variant_id] || 0) + (inv.in_stock || 0);
        }
    });

    console.log("4. Mapping Products with direct Loyverse images...");
    const mapped = allItems.map(item => {
        const defaultVariant = item.variants && item.variants[0] ? item.variants[0] : null;
        const retailBasePrice = defaultVariant ? defaultVariant.default_price : 0;

        const itemMods = (item.modifier_ids || []).map(mid => modifiers.find(m => m.id === mid)).filter(Boolean);
        let mayorDiscount = 0;
        let modifierNameApplied = null;

        for (const m of itemMods) {
            if (m.modifier_options) {
                const opt = m.modifier_options.find(o => /x mayor/i.test(o.name) || /mayor/i.test(o.name));
                if (opt) {
                    mayorDiscount = opt.price || 0;
                    modifierNameApplied = m.name;
                    break;
                }
            }
        }

        const wholesalePrice = Math.max(0, retailBasePrice + mayorDiscount);

        let categoryName = 'Oversize';
        if (item.category_id && categoryMap[item.category_id]) {
            const cName = categoryMap[item.category_id];
            if (/acid/i.test(cName)) categoryName = 'Acidwash';
            else if (/buzo|hoodie/i.test(cName)) categoryName = 'Buzos';
            else if (/conjunto|bermuda/i.test(cName)) categoryName = 'Conjuntos';
            else if (/dama|body/i.test(cName)) categoryName = 'Linea de Damas';
            else if (/oversize|burda|boxi|t-shirt/i.test(cName)) categoryName = 'Oversize';
            else categoryName = cName;
        }

        const sizeOptionIdx = item.option1_name === 'Tallas' ? 1 : (item.option2_name === 'Tallas' ? 2 : (item.option3_name === 'Tallas' ? 3 : -1));
        const colorOptionIdx = item.option1_name === 'Color' ? 1 : (item.option2_name === 'Color' ? 2 : (item.option3_name === 'Color' ? 3 : -1));

        const variants = (item.variants || []).map(v => {
            const sizeVal = sizeOptionIdx === 1 ? v.option1_value : (sizeOptionIdx === 2 ? v.option2_value : (sizeOptionIdx === 3 ? v.option3_value : 'U'));
            const colorVal = colorOptionIdx === 1 ? v.option1_value : (colorOptionIdx === 2 ? v.option2_value : (colorOptionIdx === 3 ? v.option3_value : null));
            const variantWholesalePrice = wholesalePrice > 0 ? wholesalePrice : (v.default_price || retailBasePrice);
            const currentStock = stockMap[v.variant_id] !== undefined ? stockMap[v.variant_id] : 0;

            return {
                id: v.variant_id,
                sku: v.sku || '',
                size: sizeVal || 'U',
                color: colorVal,
                price: variantWholesalePrice,
                retailPrice: v.default_price || retailBasePrice,
                inStock: currentStock > 0,
                stock: currentStock
            };
        });

        // Direct Loyverse image URL with updated_at timestamp version
        const vParam = item.updated_at ? `?v=${new Date(item.updated_at).getTime()}` : '';
        const primaryImage = item.image_url ? `${item.image_url}${vParam}` : 'https://urbannoise.cc/assets/img/logo/LOGO_WEB.png';

        return {
            id: item.id,
            title: item.item_name || 'Prenda Urban Noise',
            description: item.description || 'Sin descripción disponible.',
            price: wholesalePrice > 0 ? wholesalePrice : retailBasePrice,
            retailPrice: retailBasePrice,
            modifierApplied: modifierNameApplied,
            image: primaryImage,
            images: item.image_url ? [`${item.image_url}${vParam}`] : [],
            category: categoryName,
            rawCategory: item.category_id ? (categoryMap[item.category_id] || '') : '',
            variants: variants,
            created_at: item.created_at || '',
                created_at: item.created_at,
                updated_at: item.updated_at || ''
        };
    });

    console.log(`5. Saving ${mapped.length} products to loyverse_products.json...`);
    const jsonPaths = [
        path.join(__dirname, 'catalogo', 'loyverse_products.json'),
        path.join(__dirname, 'loyverse_products.json')
    ];

    jsonPaths.forEach(p => {
        fs.writeFileSync(p, JSON.stringify(mapped, null, 2), 'utf8');
        console.log(`- Updated ${p}`);
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Direct Sync Complete in ${elapsed}s! Total: ${mapped.length} products.`);
}

sync().catch(console.error);
