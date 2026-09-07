# Auditoría Integral de Inventario y Sistemas: Urban Noise
**Periodo Auditado:** Martes 01 de Septiembre al Domingo 06 de Septiembre de 2026  
**Fuentes de Datos:** Loyverse POS API (`/receipts`, `/inventory`, `/shifts`, `/items`) y Cloudflare Pages  
**Tiendas Evaluadas:** Tienda Noise Urban *(Principal)* y Tienda Neos *(Secundaria)*  

---

## 📈 1. Resumen Financiero y Comportamiento de Ventas

Durante la semana del 1 al 6 de septiembre se procesaron **95 recibos de venta** por un total de **223 prendas vendidas**.

| Métrica | Tienda Noise Urban | Tienda Neos | TOTAL CONSOLIDADO |
| :--- | :---: | :---: | :---: |
| **Ventas Totales Brutas** | **$ 13.343.350** | **$ 2.055.100** | **$ 15.398.450 COP** |
| **Recibos Generados** | 78 transacciones | 17 transacciones | **95 transacciones** |
| **Participación de Ventas** | **86.7%** | **13.3%** | **100%** |
| **Ticket Promedio por Venta** | $ 171.068 | $ 120.888 | **$ 162.088 COP** |
| **Reembolsos / Devoluciones** | $ 0 | $ 0 | **$ 0 (Cero devoluciones)** |

### Ventas por Día de la Semana
* **Martes 01-Sep:** $ 2.455.500
* **Miércoles 02-Sep:** $ 3.160.500
* **Jueves 03-Sep:** $ 1.564.350
* **Viernes 04-Sep:** $ 1.313.600
* **Sábado 05-Sep:** **$ 4.377.000** *(🔥 Día récord de ventas de la semana)*
* **Domingo 06-Sep:** $ 2.527.500

### Métodos de Pago Preferidos por los Clientes
1. **Efectivo:** $ 5.696.500 (37.0%)
2. **NEQUI:** $ 5.441.700 (35.3%)
3. **NU (NuBank):** $ 3.592.750 (23.3%)
4. **Tarjeta / Datáfono:** $ 403.500 (2.6%)
5. **Daviplata:** $ 264.000 (1.7%)

> 💡 **Hallazgo:** El **60.3% del dinero** ingresó por transferencias digitales directas (Nequi, Nu, Daviplata).

---

## 🏆 2. Top 10 Prendas Más Vendidas de la Semana

Estas 10 prendas generaron **$ 9.789.000 COP** (el **63.5% de todas las ventas de la semana**):

| Posición | Prenda / Producto | Unidades Vendidas | Total Facturado |
| :-: | :--- | :-: | :-: |
| **1** | **CLOTHING 07** | **21 unds** | **$ 2.274.000** |
| **2** | **URBNSTD** | **19 unds** | **$ 1.951.000** |
| **3** | **NOISE TRACK** | **14 unds** | **$ 1.787.000** |
| **4** | **All Things Urban** | **13 unds** | $ 494.000 |
| **5** | **CALAVERA FLOWER** | **12 unds** | $ 616.000 |
| **6** | **NO RISK URBAN** | **11 unds** | $ 513.000 |
| **7** | **Cargo** | **10 unds** | $ 675.000 |
| **8** | **Born To Loun** | **9 unds** | $ 471.000 |
| **9** | **Grafity Urbano** | **8 unds** | $ 405.000 |
| **10** | **PANTALON UNISEX ESTAM** | **7 unds** | $ 333.000 |

---

## 🚨 3. Análisis de Anomalías y "Cambios Raros" Detectados

Al cruzar los recibos de venta con los movimientos de stock, se encontraron **5 anomalías críticas**:

### Anomalía A: Venta "a ciegas" de las prendas estrella (Stock en 0 que pasa a Negativo)
* **Qué ocurrió:** Las dos prendas más vendidas del negocio (*CLOTHING 07* con 21 ventas y *URBNSTD* con 19 ventas) fueron vendidas en caja física **cuando el sistema marcaba 0 existencias**.
* **Efecto:** El fin de semana se generaron **9 variantes en saldo negativo**:
  * *CLOTHING 07 (Cobre/Azul):* Talla L Cobre (`-1`), Talla L Azul (`-1`), Talla XL Cobre (`-1`), Talla XL Azul (`-1`).
  * *URBNSTD:* Talla M Negro (`-1`), Talla M Gris (`-1`).
  * *URB PASLEY PERSA:* Talla M Negro (`-1`).
  * *Otros:* Talla L Varios (`-1`).
  * *Cargo:* Talla 6 Negro (`-3`).
* **Causa operativa:** Entró mercancía física recién salida de confección directo al gancho del local, y los clientes la compraron antes de que el administrador ingresara la entrada de mercancía en Loyverse.
* **Comportamiento en la Web:** Gracias a la regla `Math.max(0, stock)` que implementamos el viernes, **el catálogo web no se cayó ni restó unidades**, pero en el Backoffice físico de Loyverse quedan los números negativos.

### Anomalía B: Duplicación Estructural de Prendas (19 prendas repetidas)
* **Qué ocurrió:** Hay **19 nombres de prendas que están creados 2, 3 y hasta 4 veces** como productos independientes en Loyverse en lugar de ser un solo producto con varias tallas y colores.
  * *Ejemplo 1:* **"CLOTHING 07"** existe **4 veces** en Loyverse:
    * ID `537eae00`: Acidwash (Cobre y Azul).
    * ID `5fc2bea9`: Acidwash (MoraLeche).
    * ID `14be4863`: Acidwash (Negro y Gris).
    * ID `c552041d`: Esqueleto (Marfil y Negro).
  * *Ejemplo 2:* **"OVNNI URBAN"** existe **4 veces** con IDs distintos.
  * *Ejemplo 3:* **"UNTIED URBAN"**, **"Heaven Made"**, **"Arcangel Urbano"**, **"Closure Urban"**, **"Shield Urban"** y **"Bruit Urban"** existen **3 veces cada una**.
* **Impacto en el cliente:** En el catálogo web, al cliente le aparecen 4 tarjetas separadas de "CLOTHING 07" en vez de una sola prenda donde pueda elegir entre todos los colores disponibles.

### Anomalía C: Prendas sin Fotografía Oficial (24.2% del inventario)
* **Qué ocurrió:** De las 277 prendas registradas en Loyverse, **67 prendas no tienen fotografía** subida a la nube y muestran el logo de Urban Noise por defecto.
* **Impacto:** Ningún cliente en internet compra ropa a ciegas; estas 67 prendas tienen una tasa de rotación en el catálogo web cercana a cero.

### Anomalía D: Descuadres Frecuentes en Cierres de Caja (Turnos / Shifts)
* **Qué ocurrió:** De 50 turnos de caja analizados en la semana, **16 turnos tuvieron descuadre de efectivo**.
* **Saldo acumulado:** Se registraron **+$1.021.250 COP de dinero sobrante** en caja frente a lo que el sistema esperaba.
* **Causa común:** Ventas cobradas en efectivo que el cajero no marcó en la tablet de Loyverse (o apertura de turno con base de caja mal digitada).

### Anomalía E: Uso del comodín genérico "Otros"
* **Qué ocurrió:** La prenda llamada *"Otros"* (SKU 10683) tuvo ventas que la dejaron en `-1`.
* **Causa:** Cuando una prenda no tiene código de barras o no la encuentran en la tablet, el cajero cobra "Otros" para salir del paso, desajustando el inventario real.

---

## 🛠️ 4. Plan de Acción y Propuestas de Mejora Operativa

Para convertir este inventario en un sistema de alta precisión y preparar el negocio para una tienda online formal, se recomiendan las siguientes 4 acciones:

### 1. Protocolo de Taller: "Cero Ropa en Perchero sin Entrada en Loyverse"
* Ninguna tanda de camisetas, buzos o pantalones debe colgarse en el local sin antes haber registrado el documento de **"Entrada de mercancía / Ajuste de inventario"** en Loyverse con las cantidades por talla.
* Esto erradicará el 100% de los números negativos en la caja.

### 2. Unificación de Prendas Duplicadas en Loyverse
* Fusionar las prendas que tienen el mismo nombre en una sola ficha de producto.
* Por ejemplo: que exista un único producto **"CLOTHING 07 Acidwash"** que contenga dentro todas sus opciones de color (Cobre, Azul, MoraLeche, Negro, Gris).
* **Beneficio:** Tu catálogo web se verá mucho más limpio, profesional y elegante.

### 3. Jornada de Fotografía para las 67 Prendas sin Imagen
* Tomar fotos en percha o fondo neutro a las 67 prendas faltantes.
* Podemos subirlas por lotes a Loyverse mediante un script automático usando la API (`POST /items/{id}/image`).

### 4. Automatización de Cierre Diario de Caja y Stock
* Crear un script automático que a las 9:00 PM:
  1. Revise si algún cajero dejó prendas en `-1` y las notifique o ajuste automáticamente.
  2. Envíe el balance del día (Ventas en efectivo vs Nequi vs Nu) directamente al WhatsApp del administrador.
