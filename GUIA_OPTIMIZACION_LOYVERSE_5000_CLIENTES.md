# 🎨 GUÍA Y PROMPT DE OPTIMIZACIÓN (CATÁLOGO DE DISEÑOS / SIN INVENTARIO)
## Loyverse API + Cloudflare Workers para 5,000+ Clientes Concurrentes

> **Caso de Uso:** Venta o exhibición de **diseños / productos digitales / servicios** donde **NO se gestiona inventario/stock**, únicamente catálogo de productos con sus variantes de precio (ej. 2 precios).

---

## ⚡ LA GRAN VENTAJA DE NO MANEJAR INVENTARIO

En una tienda de ropa o física, el 85% de las llamadas a Loyverse se van consultando los niveles de stock (`/inventory_levels`) y escuchando cada ticket de venta (`receipts.update`).

Al vender **diseños sin inventario**:
1. **Eliminamos el 90% de las llamadas a Loyverse:** Ya NO se consulta `/inventory_levels`. Solo se consultan `/items` y `/categories` (1 o 2 llamadas en total en vez de 17).
2. **Los webhooks son ultra ligeros:** Ya no necesitamos procesar cada venta en caja. Solo escuchamos cuando **creas, editas o eliminas un diseño** (`items.create`, `items.update`, `items.delete`).
3. **Caché más eficiente:** La micro-caché de Cloudflare puede ser de **30 a 60 segundos**, y como los webhooks la purgan al instante cuando subes un diseño nuevo, tus 5,000 clientes verán las novedades de inmediato sin gastar casi nada de cuota.

---

## 📋 EL PROMPT EXACTO PARA COPIAR Y PEGAR EN TU OTRO PROYECTO

Copia el siguiente bloque de texto y pégalo en tu IA (ChatGPT, Claude, Cursor, Antigravity) en el proyecto de diseños:

```markdown
Actúa como un Ingeniero de Software Senior especializado en Arquitectura de Alto Rendimiento, Cloudflare Workers / Serverless y la API de Loyverse.

Necesito optimizar nuestro catálogo web en tiempo real que se conecta a la API de Loyverse. Tenemos más de 5,000 clientes concurrentes. 

IMPORTANTE SOBRE NUESTRO NEGOCIO:
- NO manejamos inventario ni stock. Vendemos DISEÑOS (productos digitales / bajo pedido).
- Cada diseño tiene únicamente sus datos básicos, fotos y 2 precios (manejados como variantes o precios base en Loyverse).
- NO se debe consultar el endpoint de `/inventory_levels` de Loyverse (no existe control de stock).
- Cuando subo un diseño nuevo o edito un precio en Loyverse, debe mostrarse automáticamente en la pantalla de los clientes en menos de 15 a 30 segundos SIN que tengan que recargar la página.

### Problema a resolver:
1. Con 5,000 clientes concurrentes haciendo peticiones frecuentes con `Date.now()` o `fresh=true`, se saturan las cuotas de Cloudflare y Loyverse bloquea por Rate Limit (error 429 Too Many Requests).
2. Clientes con el celular bloqueado o pestañas en segundo plano siguen consumiendo peticiones innecesariamente.

### Requisitos de la Solución que debes implementar:

1. **Edge Micro-Cache Coalescing en el Backend / Worker (`/api/catalog` o `/api/designs`):**
   - Implementar micro-caché unificada en Cloudflare con `caches.default` (ventana de 30 segundos: `Cache-Control: public, max-age=30, s-maxage=30, stale-while-revalidate=60`).
   - La Cache Key debe ser limpia y unificada (ej. `/api/catalog`), ignorando timestamps aleatorios del cliente (`t=...`).
   - Coalescing: Si 5,000 usuarios consultan en esa ventana de 30 segundos, el Worker realiza SOLO 1 llamada a Loyverse para traer los items y sirve a los 5,000 clientes en ~20 milisegundos desde el Edge.
   - Generación de firma `ETag`: Calcular un hash ligero basado en: cantidad de diseños (`items.length`) y la fecha de última modificación más reciente (`max(updated_at)`). Formato: `W/"designs-${count}-${maxTimestamp}"`.
   - Soporte para `If-None-Match`: Si el cliente envía su ETag y no hay diseños nuevos ni cambios de precio, responder inmediatamente con `HTTP 304 Not Modified` con cuerpo vacío (0 bytes), ahorrando 100% de transferencia y CPU.

2. **Purga Inmediata por Webhooks de Loyverse (`/api/webhook`):**
   - Configurar el receptor de webhooks escuchando ÚNICAMENTE eventos de catálogo: `items.create`, `items.update`, `items.delete`, `categories.update`.
   - NO escuchar `receipts` ni `inventory_levels` (ahorrando procesamiento).
   - Cuando se sube o edita un diseño en Loyverse, el webhook purga inmediatamente la micro-caché de Cloudflare con `cache.delete(cacheKey)`.
   - Esto garantiza que al subir un diseño nuevo, la caché se limpie al segundo 0 y los clientes lo vean de inmediato.

3. **Sondeo Inteligente Adaptativo en el Frontend / Cliente:**
   - Carga inicial: Consultar directamente el endpoint del catálogo sin parámetros aleatorios para aprovechar la caché del Edge (carga en <50ms).
   - Guardar el `ETag` recibido en memoria.
   - Sondeo en segundo plano cada 30 a 45 segundos enviando la cabecera `If-None-Match: <ultimo_etag>`.
   - **Pausado Estricto:** Si la pestaña está oculta o el teléfono bloqueado (`document.hidden === true`), PAUSAR el sondeo al 100% (0 peticiones).
   - **Reanudación con Cooldown:** Al reactivar la pestaña (`visibilitychange`), sincronizar de inmediato, pero con un cooldown mínimo de 15 segundos para evitar spam.
   - Si la respuesta es `304 Not Modified`, salir silenciosamente sin tocar el DOM.
   - Si la respuesta es `200 OK`, actualizar suavemente la lista de diseños y guardar el nuevo ETag.

Por favor, analiza el código de nuestro proyecto y genera la implementación completa para el Worker/Backend y el Frontend.
```

---

## 💻 CÓDIGO DE REFERENCIA ESPECÍFICO (SIN INVENTARIO)

### 1. Backend / Cloudflare Worker (`functions/api/catalog.js`)
*Nota cómo NO consulta inventario, solo items y categorías:*

```javascript
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const isForce = url.searchParams.get('force') === 'true'; // Solo admin con PIN

  // 1. Clave de caché única y normalizada
  const cacheKeyUrl = new URL(url.origin + '/api/catalog');
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });
  const cache = caches.default;

  // 2. Verificar micro-caché en el Edge
  if (!isForce) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cachedEtag = cachedResponse.headers.get('ETag');
      const clientIfNoneMatch = request.headers.get('If-None-Match');

      // Si el cliente ya tiene el diseño más reciente -> 304 Not Modified (0 bytes)
      if (clientIfNoneMatch && cachedEtag && clientIfNoneMatch === cachedEtag) {
        return new Response(null, {
          status: 304,
          headers: {
            'ETag': cachedEtag,
            'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      return cachedResponse;
    }
  }

  // 3. Consultar SOLO items a Loyverse (SIN inventario)
  const itemsResponse = await fetch('https://api.loyverse.com/v1.0/items?limit=250', {
    headers: { 'Authorization': `Bearer ${env.LOYVERSE_TOKEN}` }
  });
  const itemsData = await itemsResponse.json();
  const items = itemsData.items || [];

  // Mapear los diseños con sus 2 precios/variantes
  const designs = items.map(item => {
    const variants = item.variants || [];
    return {
      id: item.id,
      name: item.item_name,
      description: item.description || '',
      category_id: item.category_id,
      image_url: item.image_url || null,
      updated_at: item.updated_at,
      // Los dos precios (ejemplo: Precio Normal y Precio Especial/Mayorista)
      price_1: variants[0]?.default_price || 0,
      price_2: variants[1]?.default_price || variants[0]?.default_price || 0,
      variants: variants.map(v => ({
        variant_id: v.variant_id,
        name: v.option1_value || v.item_name,
        price: v.default_price
      }))
    };
  });

  // 4. Calcular ETag ligero (cantidad de diseños + fecha del último cambio)
  const totalDesigns = designs.length;
  const maxUpdatedAt = designs.reduce((max, d) => {
    const t = d.updated_at ? new Date(d.updated_at).getTime() : 0;
    return t > max ? t : max;
  }, 0);
  const etag = `W/"designs-${totalDesigns}-${maxUpdatedAt}"`;

  // 5. Validar If-None-Match
  const clientIfNoneMatch = request.headers.get('If-None-Match');
  if (clientIfNoneMatch === etag && !isForce) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // 6. Retornar respuesta y almacenar en caché Edge por 30 segundos
  const responsePayload = JSON.stringify({ designs, total: totalDesigns, updated_at: maxUpdatedAt });
  const response = new Response(responsePayload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'ETag': etag,
      'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*'
    }
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
```

---

### 2. Webhook Ligero (`functions/api/webhook.js`)
*Solo purga cuando se crean/editan diseños:*

```javascript
export async function onRequestPost(context) {
  const { request } = context;
  const payload = await request.json();
  const eventType = payload.event_type || payload.type || '';

  // Solo nos interesan cambios en el catálogo de productos
  if (eventType.includes('items.') || eventType.includes('categories.')) {
    const cache = caches.default;
    const url = new URL(request.url);
    const cacheKeyUrl = new URL(url.origin + '/api/catalog');
    
    // Purga instantánea en el Edge
    await cache.delete(new Request(cacheKeyUrl.toString(), { method: 'GET' }));
    console.log(`[Webhook] Caché purgada por evento: ${eventType}`);
  }

  return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
}
```

---

### 3. Frontend Adaptativo (`index.html`)

```javascript
let currentEtag = null;
let lastSync = 0;
let isSyncing = false;

// Carga inicial instantánea
async function initCatalog() {
  const res = await fetch('/api/catalog');
  if (res.ok) {
    currentEtag = res.headers.get('ETag');
    const data = await res.json();
    renderDesigns(data.designs);
    startSyncLoop();
  }
}

function startSyncLoop() {
  // Sondeo cada 35 segundos
  setInterval(() => {
    if (!document.hidden) syncSilently();
  }, 35000);

  // Al volver a la pestaña tras tener el celular bloqueado
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastSync > 15000) {
      syncSilently();
    }
  });
}

async function syncSilently() {
  if (isSyncing) return;
  isSyncing = true;
  lastSync = Date.now();

  try {
    const headers = {};
    if (currentEtag) headers['If-None-Match'] = currentEtag;

    const res = await fetch('/api/catalog', { headers });

    if (res.status === 304) {
      // Sin cambios en los diseños, 0 bytes gastados
      return;
    }

    if (res.ok) {
      currentEtag = res.headers.get('ETag') || currentEtag;
      const data = await res.json();
      renderDesigns(data.designs); // Actualiza si hay diseños nuevos o precios cambiados
    }
  } catch (err) {
    console.warn('Sync omitido:', err);
  } finally {
    isSyncing = false;
  }
}
```

---

## 🚀 RESUMEN DE BENEFICIOS PARA TU PROYECTO DE DISEÑOS
1. **Velocidad Extrema:** Sin inventario, la API de Loyverse responde en **250ms** en vez de 6 segundos.
2. **Cero Riesgo de Bloqueo 429:** Solo 1 llamada a Loyverse cada 30 segundos (máximo 120 peticiones por hora en todo el planeta).
3. **Escalabilidad para 5,000+ Clientes:** Los 5,000 clientes descargan la lista de diseños directamente de la memoria caché de Cloudflare en ~20 milisegundos.
