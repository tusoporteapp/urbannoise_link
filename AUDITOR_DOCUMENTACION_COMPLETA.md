# 📋 URBAN NOISE — MANUAL Y DOCUMENTACIÓN TÉCNICA DEL AUDITOR EN VIVO

Este documento contiene toda la información técnica, funcional, operativa y de arquitectura del **Auditor de Inventario en Vivo** de Urban Noise (`urbannoise.cc/auditor`). Diseñado para ser entregado a un nuevo agente o desarrollador para continuar cualquier trabajo, soporte o ampliación.

---

## 1. Información General y Acceso

* **URL de Producción:** [https://urbannoise.cc/auditor](https://urbannoise.cc/auditor)
* **PIN Administrativo de Acceso:** `8624` (almacenado de forma segura en `sessionStorage` para no pedirlo continuamente).
* **Tema Visual:** Clean Light (Tema claro de alto contraste, legible bajo luz solar y luces de tienda física).
* **Dispositivos Objetivo:** Celulares (Android / iOS), tablets y laptops.
* **Propósito Central:** Permitir al equipo de tienda auditar percheros físicos a máxima velocidad (1 toque por prenda), identificar descuadres frente a Loyverse POS, tomar fotos a estampados con la cámara del celular y calibrar el inventario en Loyverse en 1 a 3 segundos sin cerrar la tienda.

---

## 2. Archivos del Proyecto y Rutas en el Repositorio

El proyecto se despliega en **Cloudflare Pages** desde el repositorio `urbannoise_link` (rama `master`). Por compatibilidad de enrutamiento estático en Cloudflare, el auditor se replica de forma idéntica en 4 rutas:

| Archivo | Ruta Relativa | Propósito |
| :--- | :--- | :--- |
| **Principal** | `auditor.html` | Archivo fuente de la aplicación del auditor |
| **Mirror 1** | `catalogo/auditor.html` | Espejo en subcarpeta `catalogo/` |
| **Mirror 2** | `auditor/index.html` | Permite acceder como carpeta `/auditor/` |
| **Mirror 3** | `catalogo/auditor/index.html` | Espejo dentro de `catalogo/auditor/` |

> ⚠️ **Regla importante:** Cualquier cambio en la interfaz de `auditor.html` debe copiarse a las otras 3 rutas para mantener el 100% de consistencia en Cloudflare Pages.

### Endpoints Backend (Cloudflare Pages Functions):
* `functions/api/catalog.js` (y `catalogo/functions/api/catalog.js`):
  * Carga catálogo unificado desde Loyverse API (`GET /v1.0/items`, `/v1.0/inventory`, `/v1.0/categories`, `/v1.0/modifiers`).
  * Parámetros: `?store_id=[id]` (para segmentar por tienda) y `?fresh=true` (para evadir caché de borde).
* `functions/api/audit_sync.js` (y `catalogo/functions/api/audit_sync.js`):
  * Calibra el inventario en Loyverse (`POST /v1.0/inventory`).
  * Valida PIN `8624` y procesa en lotes seguros de 100 variantes para máxima velocidad y estabilidad.
* `functions/api/upload_image.js` (y `catalogo/functions/api/upload_image.js`):
  * Sube imágenes de estampados tomadas con la cámara a Loyverse (`POST /v1.0/items/{item_id}/image`).
  * Valida PIN `8624` y convierte el buffer base64 en `multipart/form-data`.

---

## 3. Configuración de Tiendas y Segmentación Multi-Tienda

La cuenta de Loyverse maneja dos tiendas oficiales:

| Tienda | Store ID Oficial en Loyverse | Estado Actual de Inventario |
| :--- | :--- | :--- |
| **Noise Urban** *(Principal)* | `fee704a4-ff11-43ae-903e-d2f9cf0a9a25` | ~1.556 unidades registradas en Loyverse (~386 variantes con stock). |
| **Neos** *(Sucursal)* | `cf0674d5-6edd-426b-a5a6-b1f65bba6770` | 13 unidades con stock positivo en Loyverse (*Bermuda AcidWash* [5] y *Body* [8]). 18 variantes con saldo negativo (-1) por ventas recientes en caja sin stock inicial cargado. |

### Persistencia Aislada en el Celular:
Para evitar que auditar Neos altere o borre los datos contados de Noise Urban, los conteos se guardan en llaves separadas de `localStorage`:
* Conteos físicos: `urbannoise_physical_counts_${selectedStoreId}`
* Prendas marcadas: `urbannoise_audited_items_${selectedStoreId}`
* Tienda activa recordada: `urbannoise_audit_store_id`

---

## 4. Funcionalidades Clave del Auditor

### A. Selector Táctil de Categorías (1 Toque, Cero Nombres, Sin Escribir)
* **Cero formularios de nombres:** El personal de tienda no necesita identificarse ni escribir su nombre.
* **Banner Activo:** Muestra la categoría actual y la cantidad de prendas (`currentAuditCategoryTitle` y `currentAuditCategoryCount`).
* **Modal de Categorías (`openCategoryModal()`):** 
  * Analiza en tiempo real las categorías del catálogo (`fullCatalog`).
  * Muestra botones táctiles grandes con icono temático (🧥 Buzos, ⚡ Acidwash, 👕 Oversize, 🎽 Esqueletos, 👖 Conjuntos, 👗 Damas) y el conteo de prendas de cada una.
  * Primera opción: **✨ Todas las Categorías**.
* **Aislamiento Estricto:** Al tocar una categoría, la pantalla se filtra **exclusivamente a esa categoría**, recalculando métricas, progreso y filtros secundarios (*Con Stock*, *Pendientes*, *Con Descuadre*, *Sin Foto*).

### B. Rendimiento Ultrarrápido a 60 FPS (Renderizado en Lotes)
* Para evitar congelamientos en teléfonos móviles con 277 prendas y 1.500 variantes, se implementó renderizado en lotes de 25 prendas (`BATCH_RENDER_SIZE = 25`).
* Al deslizar hacia abajo, aparece el botón dinámico *"Cargar más prendas"* si quedan pendientes.

### C. Conteo Ergonómico de Alta Velocidad
* **Botón `✓ Coincide`:** Audita la prenda en 1 toque cuando el perchero físico coincide con el sistema.
* **Botón `0 Agotado`:** Pone todas las tallas en 0 en 1 toque.
* **Entradas Numéricas con Auto-Selección (`this.select()`):** Al tocar una casilla, el número anterior queda seleccionado automáticamente para reemplazarlo al instante en el teclado móvil sin tener que borrar con backspace.
* **Botones táctiles gigantes `[-]` y `[+]` de 40px** para sumar o restar con precisión con una sola mano.

### D. Visor de Fotos en Pantalla Completa con Lupa y Cámara Directa 📸
* **Apertura:** Al tocar la foto de cualquier prenda, se abre un visor en pantalla completa (`imageModal`).
* **Lupa y Zoom Interactivo:**
  * **En Celular:** Botón `[ 🔍 Lupa ]` (zoom 2.5x directo), doble toque rápido, pellizcar con 2 dedos (*pinch-to-zoom* de 1x a 4.5x) y arrastre fluido con 1 dedo.
  * **En PC:** Rueda del ratón (*mouse wheel*), clic y arrastre, botones flotantes `[-]`, `100%` y `[+]`.
* **Cámara Directa del Celular:**
  * Disparador nativo con `capture="environment"`.
  * Compresión automática en un elemento `<canvas>` oculto a calidad 0.82 y dimensión máxima de 1200px (~120 KB en ~50ms).
  * Subida en segundo plano a Loyverse vía `/api/upload_image`. Al terminar, la foto se actualiza en el modal, en la tarjeta de la lista y en el POS de Loyverse de inmediato.

### E. Calibración Segura en Loyverse (Delta Sync / Tienda Abierta) 💾
Al pulsar **"Guardar en Loyverse"**, se abre el modal de confirmación con 3 alcances:
1. **"Solo mis variantes con cambios" (Por Defecto / Recomendado):** Solo envía a Loyverse las prendas que tuvieron diferencias físicas reales en ese celular. Permite que varios empleados auditen percheros distintos al mismo tiempo sin pisarse entre sí y protege las ventas que se hagan en caja durante el día.
2. **"Solo la categoría seleccionada":** Sincroniza todas las variantes de la categoría activa (ej. solo *Buzos* o solo *Acidwash*).
3. **"Toda la tienda":** Envía todo el inventario completo. Diseñado para cuando la tienda está cerrada al público.

* **Velocidad de guardado:** Tarda entre **1 y 3 segundos**. Una vez confirmado por Loyverse, el auditor ejecuta automáticamente un `loadCatalog(true)` con `fresh=true` para descargar el stock oficial actualizado.

---

## 5. Casos Especiales y Notas Críticas

### Situación de la Tienda Neos:
* En Loyverse, el inventario de Neos no se había cargado inicialmente. Solo figuraban 13 unidades positivas (Bermuda Acidwash [5] y Body [8]) y 18 variantes con saldo negativo (-1) por ventas hechas en caja registradora.
* En Loyverse existen 277 productos que por defecto están asignados a ambas tiendas.
* En la tienda física de Neos **sí hay prendas**. Por ello, el catálogo de Neos muestra las referencias para que el equipo pueda auditar perchero por perchero, colocar las cantidades reales que encuentren en tienda y calibrarlas en Loyverse.

---

## 6. Suite de Pruebas Automatizadas

El archivo `scratch/test_auditor_suite.js` contiene la suite de pruebas unitarias que valida:
* Integridad de los 8 archivos de frontend y backend.
* Presencia del PIN `8624`, endpoints `/api/catalog`, `/api/audit_sync`, `/api/upload_image`.
* Verificación del selector de categorías sin nombres (`categoryModal`, `selectAuditCategory`).
* Validación de seguridad de los Workers (rechazo de PIN inválido con 401, rechazo de payloads vacíos con 400).

Ejecución de la suite:
```bash
node scratch/test_auditor_suite.js
```

---

## 7. Instrucciones para la Nueva Conversación

Si en una nueva conversación se desea trabajar en el **Auditor**:
1. Proveer este archivo (`AUDITOR_DOCUMENTACION_COMPLETA.md`) como contexto inicial.
2. El archivo de desarrollo principal es `auditor.html`.
3. Al realizar modificaciones en `auditor.html`, recordar replicarlas a:
   * `catalogo/auditor.html`
   * `auditor/index.html`
   * `catalogo/auditor/index.html`
4. Ejecutar la suite de pruebas `node scratch/test_auditor_suite.js`.
5. Hacer `git commit` y `git push origin master` para desplegar en vivo en `https://urbannoise.cc/auditor`.
