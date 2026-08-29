# 📘 MANUAL TÉCNICO Y FUNCIONAL COMPLETO
## Catálogo Mayorista en Tiempo Real — Urban Noise Streetwear

---

## 📑 Tabla de Contenido
1. [Visión General y Propósito del Sistema](#1-visión-general-y-propósito-del-sistema)
2. [Arquitectura de Infraestructura: SERVIDOR 1 & LOYVERSE](#2-arquitectura-de-infraestructura-servidor-1--loyverse)
3. [Estrategia de Mitigación de Límites de Peticiones de LOYVERSE](#3-estrategia-de-mitigación-de-límites-de-peticiones-de-loyverse)
4. [Motor de Sincronización Inteligente en Tiempo Real](#4-motor-de-sincronización-inteligente-en-tiempo-real)
   - [Ciclo de Caché de 24 Horas y Loader Arcade (Snake Game)](#ciclo-de-caché-de-24-horas-y-loader-arcade-snake-game)
   - [Escudo de Arranque Inmediato de 0ms (Zero Flicker)](#escudo-de-arranque-inmediato-de-0ms-zero-flicker)
   - [Sincronización Silenciosa Diferencial cada 5 Minutos](#sincronización-silenciosa-diferencial-cada-5-minutos)
   - [Sincronización Predictiva por Scroll (Swarm Sync)](#sincronización-predictiva-por-scroll-swarm-sync)
   - [Micro-Verificación Quirúrgica por Prenda](#micro-verificación-quirúrgica-por-prenda)
5. [Experiencia de Usuario (UI/UX) Mayorista](#5-experiencia-de-usuario-uiux-mayorista)
   - [Indicadores de Color en Cuadrícula 2x2](#indicadores-de-color-en-cuadrícula-2x2)
   - [Curva Mayorista Compacta y Ultra-Limpia](#curva-mayorista-compacta-y-ultra-limpia)
   - [Efectos Skeleton Shimmer en Carruseles y Cuadrícula](#efectos-skeleton-shimmer-en-carruseles-y-cuadrícula)
   - [Buscador Inteligente Instantáneo](#buscador-inteligente-instantáneo)
6. [Sistema de Pedidos, Enlace Compartido y MODO ADMIN (PIN 8624)](#6-sistema-de-pedidos-enlace-compartido-y-modo-admin-pin-8624)
   - [Flujo de Pedido del Cliente](#flujo-de-pedido-del-cliente)
   - [Enlace Compartido de WhatsApp](#enlace-compartido-de-whatsapp)
   - [MODO ADMIN: Edición Maestra de Pedidos](#modo-admin-edición-maestra-de-pedidos)
   - [Despacho Automatizado en LOYVERSE](#despacho-automatizado-en-loyverse)
7. [Resumen de Endpoints y Operaciones de Datos](#7-resumen-de-endpoints-y-operaciones-de-datos)

---

## 1. Visión General y Propósito del Sistema

El **Catálogo Mayorista Urban Noise** es una Progressive Web App (PWA) de alto rendimiento diseñada específicamente para la venta al por mayor de moda urbana streetwear en Colombia.

### Objetivos Clave:
* **Inventario 100% Real:** Mostrar disponibilidad exacta de stock físico por prenda, color y talla directamente desde el punto de venta de la marca.
* **Velocidad Extrema (0ms):** Carga instantánea para clientes recurrentes sin pantallas en blanco ni esperas.
* **Autonomía Mayorista:** Los clientes pueden armar su curva de tallas, verificar el valor total de su inversión y enviar su pedido formateado por WhatsApp.
* **Control Administrativo Total (MODO ADMIN):** Capacidad para que la administración edite, agregue o elimine prendas de pedidos ya armados por clientes y descuente el inventario físico automáticamente.

---

## 2. Arquitectura de Infraestructura: SERVIDOR 1 & LOYVERSE

El sistema opera bajo una arquitectura desacoplada y distribuida compuesta por dos capas principales:

```
┌─────────────────────────────────────────────────────────────┐
│                   DISPOSITIVOS DE CLIENTES                  │
│       (Teléfonos Móviles / Tablets / Computadores)          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      Peticiones Ultra-Rápidas
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVIDOR 1                           │
│  • Aceleración perimetral y entrega de contenido            │
│  • Caché Global Compartida con Cache-Busting                │
│  • Capa Serverless de Seguridad, Mapeo y Despacho           │
│  • Escudo Protector contra Límites de LOYVERSE              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    Consultas Consolidadas
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    API OFICIAL DE LOYVERSE                  │
│  • Base de datos central del sistema POS                    │
│  • Registro de prendas, categorías, modificadores y fotos   │
│  • Niveles de stock en tiempo real (Tienda Noise Urban)     │
└─────────────────────────────────────────────────────────────┘
```

### Componentes de la Arquitectura:
1. **LOYVERSE:** Es el software punto de venta (POS) y la fuente de verdad del inventario físico. En él se registran las prendas, fotos, precios retail, modificadores de descuento mayorista y existencias por tienda.
2. **SERVIDOR 1:** Actúa como el cerebro intermedio inteligente. Consolida las peticiones, procesa los modificadores mayoristas, almacena en caché perimetral los datos procesados y despacha las operaciones para proteger a LOYVERSE de saturación.

---

## 3. Estrategia de Mitigación de Límites de Peticiones de LOYVERSE

> [!IMPORTANT]
> **Naturaleza de las Limitaciones:** La API oficial de **LOYVERSE** impone cuotas estrictas de límite de frecuencia (*rate limits*) en la cantidad de peticiones por minuto. Si decenas de clientes consultaran directamente a LOYVERSE de manera simultánea, la API bloquearía las consultas por exceso de tráfico.

### ¿Cómo soluciona esto SERVIDOR 1?
Para neutralizar por completo estas restricciones de LOYVERSE y garantizar servicio continuo las 24 horas del día, **SERVIDOR 1** implementa 4 barreras de optimización:

1. **Caché Agregada Perimetral (*Edge Cache*):** Cuando un cliente consulta el catálogo o una prenda, SERVIDOR 1 almacena la respuesta procesada. Las siguientes 500 personas que consulten reciben la respuesta directamente desde SERVIDOR 1 en menos de 30 milisegundos, **consumiendo exactamente 0 peticiones a LOYVERSE**.
2. **Sincronización Predictiva Agrupada:** En lugar de pedir todo el inventario, se consultan únicamente pequeños lotes de variantes solo cuando es estrictamente necesario.
3. **Cabecera `stale-while-revalidate`:** Permite que SERVIDOR 1 entregue datos frescos de inmediato mientras renueva silenciosamente su caché en segundo plano.
4. **Cero Re-Descargas Innecesarias:** Si una prenda no ha sufrido cambios de stock o precio, el sistema no vuelve a descargar su imagen ni redibuja su estructura.

---

## 4. Motor de Sincronización Inteligente en Tiempo Real

### Ciclo de Caché de 24 Horas y Loader Arcade (Snake Game)
* **Primera Visita o Caché Vencida (> 24 Horas):**
  * Se activa la pantalla interactiva de carga con el juego clásico retro de la **Culebrita (Snake Arcade)** adaptado al tema claro del catálogo.
  * Mientras el usuario juega, en segundo plano SERVIDOR 1 sincroniza las **274 prendas** con LOYVERSE y precarga las imágenes prioritarias en la memoria del dispositivo.
  * Una vez finalizada la sincronización y la precarga, aparece de forma estática y elegante el botón **`[ 🚀 VER CATÁLOGO ]`**.
  * El usuario decide cuándo terminar el juego y entrar al catálogo.
  * Se guarda una marca temporal de 24 horas en el almacenamiento local (`localStorage`).

* **Visitas Recurrentes (< 24 Horas):**
  * El catálogo detecta la vigencia de los datos y **omite por completo la pantalla de carga**, mostrando el catálogo de inmediato en **0 milisegundos**.

---

### Escudo de Arranque Inmediato de 0ms (Zero Flicker)
Para evitar cualquier destello o parpadeo visual (*FOUC*) al presionar F5 o recargar en el teléfono:
* Un script ultra-rápido en el `<head>` evalúa la marca temporal antes de que el cuerpo de la página comience a renderizarse.
* Si los datos están vigentes, aplica una regla atómica `html.has-fresh-catalog #snake-loading-screen { display: none !important; }`.
* **Resultado:** Entrada 100% limpia y sin ningún parpadeo visual.

---

### Sincronización Silenciosa Diferencial cada 5 Minutos
* En segundo plano, un temporizador discreto consulta cada 5 minutos si han surgido cambios en LOYVERSE (por ejemplo, una venta realizada en la tienda física).
* **Si NO hubo cambios:** No se ejecuta ninguna acción, protegiendo la memoria del teléfono y la cuota de LOYVERSE.
* **Si una prenda cambió de stock:** Solo se actualiza quirúrgicamente la tarjeta de esa prenda específica en pantalla (insignias y chips de color) sin recargar la página.
* **Si se añadió una prenda nueva:** Se inserta suavemente en la cuadrícula y en los carruseles.

---

### Sincronización Predictiva por Scroll (Swarm Sync)
* Mediante un sensor perimetral `IntersectionObserver`, el sistema detecta con **250 píxeles de anticipación** las prendas a las que el cliente se aproxima al hacer scroll.
* Realiza una micro-verificación silenciosa del stock exacto de esa prenda a través de SERVIDOR 1.
* **Beneficio Colectivo:** La respuesta queda grabada en la caché de SERVIDOR 1, por lo que **todos los demás usuarios que vean esa prenda en los siguientes minutos reciben el stock actualizado en 0ms sin consumir nuevas peticiones a LOYVERSE**.

---

### Micro-Verificación Quirúrgica por Prenda
* Al abrir el modal de detalles de cualquier prenda, el sistema ejecuta una verificación puntual e inmediata contra `/api/stock?id=...` para reconfirmar que las tallas y colores seleccionados estén disponibles antes de armar el pedido.

---

## 5. Experiencia de Usuario (UI/UX) Mayorista

### Indicadores de Color en Cuadrícula 2x2
* Debajo del nombre de cada prenda se ubica una cuadrícula compacta responsive `grid grid-cols-2 gap-1.5`.
* **Colores Disponibles:** Fondo suave con punto verde esmeralda y nombre legible completo (ej: `🟢 Cobre`, `🟢 Negro`).
* **Colores Agotados:** Fondo rojizo sutil con texto tachado y punto indicador (ej: `❌ ~~Gris~~`).
* Ningún nombre de color sale recortado con puntos suspensivos (`...`).

---

### Curva Mayorista Compacta y Ultra-Limpia
Dentro de la ventana de detalles de la prenda:
* **Ahorro del 70% de Espacio:** Se eliminaron las filas gigantes de tallas en cero.
* **Micro-Indicador Elegante:** Las tallas agotadas se informan en un micro-banner informativo: `ℹ️ Tallas agotadas en este tono: M, L, XL`.
* **Colores 100% Agotados:** Se resumen en un aviso colapsado de 1 sola línea, permitiendo que el mayorista solo interactúe con el inventario disponible.

---

### Efectos Skeleton Shimmer en Carruseles y Cuadrícula
* Durante la primera carga, los carruseles horizontales (*Top 10 Más Vendidos* y *Nuevos Lanzamientos*) y la cuadrícula general muestran tarjetas animadas con efecto de brillo pulsante (*Skeleton shimmer pulse*), brindando una percepción de carga moderna y profesional.

---

### Buscador Inteligente Instantáneo
* Barra de búsqueda superior con filtrado en tiempo real por nombre de prenda, categoría o tipo de tela (ej: *Acidwash, Buzos, Oversize, Conjuntos*).
* Filtra en milisegundos directamente en la memoria del navegador.

---

## 6. Sistema de Pedidos, Enlace Compartido y MODO ADMIN (PIN 8624)

### Flujo de Pedido del Cliente
1. El cliente selecciona colores y tallas en la curva mayorista de cada prenda.
2. Un **Gatekeeper Mayorista** valida que el pedido cumpla con las condiciones mínimas requeridas.
3. El cliente puede revisar su lista en el botón flotante inferior con el resumen de prendas y valor total estimado en COP.
4. Al presionar **`[ 📲 Enviar Pedido por WhatsApp ]`**, el sistema genera un enlace web único codificado en Base64 que contiene exactamente los IDs, tallas, colores y cantidades seleccionadas.

---

### Enlace Compartido de WhatsApp
Cuando el asesor o la administración abre el enlace enviado por el cliente:
* Se despliega la ventana emergente **`Pedido de Cliente`** con la lista exacta de prendas que el cliente desea comprar.
* Muestra el resumen de unidades totales y el valor estimado en COP.

---

### MODO ADMIN: Edición Maestra de Pedidos
Dentro del pedido del cliente (o desde el menú lateral), el administrador puede presionar el botón **`⚡ MODO ADMIN (PIN 8624)`**:

```
┌──────────────────────────────────────────────────────────────┐
│  📋 PEDIDO DEL CLIENTE (Enlace de WhatsApp)                  │
│                                                              │
│  [ ⚡ MODO ADMIN (PIN 8624) ]                                │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  👑 MODO ADMIN ACTIVO                                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ [FOTO] BERMUDA ACIDWASH                                │  │
│  │ Talla: M  |  Color: Negro                              │  │
│  │ [ - ]   7   [ + ]        $ 322.000       [ 🗑️ Quitar ] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ➕ Añadir Prenda a este Pedido                         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ──────────────────────────────────────────────────────────  │
│  Total: 18 Prendas  |  Valor: $ 828.000 COP                  │
│                                                              │
│  [ 📲 Reenviar Pedido Editado a WhatsApp ]                   │
│  [ 📦 Despachar Inventario en Loyverse ]                     │
└──────────────────────────────────────────────────────────────┘
```

#### Capacidades del Administrador:
1. **Ajuste de Cantidades:** Botones interactivos `[ - ]` y `[ + ]` en cada prenda para subir o bajar unidades con recálculo de precios en vivo.
2. **Eliminación de Prendas:** Botón `[ 🗑️ ]` para quitar del pedido cualquier prenda agotada o descartada.
3. **Adición de Nuevas Prendas:** Botón `[ ➕ Añadir Prenda a este Pedido ]` que abre un selector del catálogo para buscar cualquier prenda, elegir color, talla y cantidad, e insertarla al pedido.
4. **Reenvío Inmediato a WhatsApp:** Botón `[ 📲 Reenviar Pedido Editado a WhatsApp ]` que genera el nuevo enlace actualizado y abre el chat del cliente con el mensaje estructurado de confirmación.

---

### Despacho Automatizado en LOYVERSE
* Una vez que el pedido está verificado y confirmado, el administrador presiona **`[ 📦 Despachar Inventario en Loyverse ]`**.
* SERVIDOR 1 se conecta con la API de LOYVERSE y descuenta automáticamente las unidades correspondientes del stock físico de la tienda, manteniendo el inventario sincronizado sin necesidad de ajustes manuales en caja.

---

## 7. Resumen de Endpoints y Operaciones de Datos

| Endpoint en SERVIDOR 1 | Método | Función Principal | Integración con LOYVERSE |
| :--- | :---: | :--- | :--- |
| `/api/catalog` | `GET` | Entrega el dataset maestro de las 274 prendas con fotos, precios mayoristas y variantes procesadas. | Consulta masiva paginada con almacenamiento en Edge Cache. |
| `/api/stock` | `GET` | Micro-verificación de stock en vivo para 1 prenda y sus variantes. | Consulta puntual por IDs de variante con caché de 30 segundos. |
| `/api/sync` | `POST` | Sincronización forzada manual con PIN `8624` que purga la caché perimetral. | Re-indexación total de items, modificadores y categorías en LOYVERSE. |
| `/api/dispatch` | `POST` | Despacho de pedidos y deducción de existencias físicas con PIN `8624`. | Ejecuta el decremento de inventario en la tienda física de LOYVERSE. |

---

> **Urban Noise Streetwear** — *Tecnología de Alto Rendimiento para el Comercio Mayorista.*
