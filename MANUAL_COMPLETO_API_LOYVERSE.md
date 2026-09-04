# Diccionario Exhaustivo y Manual de la API de Loyverse POS

Este documento es una referencia técnica y operativa completa de **todas y cada una de las funciones disponibles en la API oficial de Loyverse POS (v1.0)**. 

---

## 🔑 Datos de Conexión y Protocolo

* **URL Base de la API:** `https://api.loyverse.com/v1.0/`
* **Formato de datos:** `JSON` (UTF-8)
* **Autenticación:** `Bearer Token` vía cabecera HTTP:
  ```http
  Authorization: Bearer <TU_API_TOKEN>
  ```
* **Límite de peticiones:** Hasta 10 solicitudes por segundo por cuenta.
* **Paginación:** Basada en cursores (`limit=250&cursor=...`).

---

## 🧭 Índice de Módulos de la API

La API de Loyverse cuenta con **17 módulos de gestión integral**:

1. [Artículos y Prendas (`/items`)](#1-artículos-y-prendas-items)
2. [Variantes (Tallas y Colores) (`/variants`)](#2-variantes-tallas-y-colores-variants)
3. [Inventario y Existencias (`/inventory`)](#3-inventario-y-existencias-inventory)
4. [Ventas y Recibos (`/receipts`)](#4-ventas-y-recibos-receipts)
5. [Clientes y CRM (`/customers`)](#5-clientes-y-crm-customers)
6. [Descuentos y Promociones (`/discounts`)](#6-descuentos-y-promociones-discounts)
7. [Categorías (`/categories`)](#7-categorías-categories)
8. [Modificadores (`/modifiers`)](#8-modificadores-modifiers)
9. [Webhooks en Tiempo Real (`/webhooks`)](#9-webhooks-en-tiempo-real-webhooks)
10. [Tipos y Métodos de Pago (`/payment_types`)](#10-tipos-y-métodos-de-pago-payment_types)
11. [Tiendas y Sucursales (`/stores`)](#11-tiendas-y-sucursales-stores)
12. [Cajas y Dispositivos TPV (`/pos_devices`)](#12-cajas-y-dispositivos-tpv-pos_devices)
13. [Turnos y Arqueos de Caja (`/shifts`)](#13-turnos-y-arqueos-de-caja-shifts)
14. [Empleados y Cajeros (`/employees`)](#14-empleados-y-cajeros-employees)
15. [Proveedores (`/suppliers`)](#15-proveedores-suppliers)
16. [Impuestos (`/taxes`)](#16-impuestos-taxes)
17. [Perfil del Comercio (`/merchant`)](#17-perfil-del-comercio-merchant)

---

## Detalle Exhaustivo Módulo por Módulo

---

### 1. Artículos y Prendas (`/items`)

Controla las prendas maestras creadas en tu catálogo.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/items` | Lista todas las prendas registradas (con filtro por fecha `updated_at_min`). |
| `POST` | `/v1.0/items` | **Crea una nueva prenda** o actualiza por lotes las existentes (nombre, precio base, categoría, SKU). |
| `GET` | `/v1.0/items/{item_id}` | Obtiene toda la información detallada de una sola prenda por su ID. |
| `DELETE` | `/v1.0/items/{item_id}` | Elimina una prenda del sistema Loyverse. |
| `POST` | `/v1.0/items/{item_id}/image` | **Sube o cambia la foto oficial de una prenda** enviando el archivo binario de la imagen. |
| `DELETE` | `/v1.0/items/{item_id}/image` | Borra la foto de una prenda. |

> 💡 **Caso de uso:** Puedes crear un script que, al tomar fotos de las prendas nuevas con tu celular, las suba automáticamente a Loyverse y les asigne el nombre y precio sin tocar el computador.

---

### 2. Variantes (Tallas y Colores) (`/variants`)

Controla cada una de las combinaciones físicas de una prenda.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/variants` | Lista todas las variantes de la tienda con sus precios, costos, códigos de barra y opciones. |
| `POST` | `/v1.0/variants` | **Crea o modifica variantes** (ej. agregar talla XXL a un modelo existente, cambiar el costo de producción o cambiar el precio al detal). |
| `GET` | `/v1.0/variants/{variant_id}` | Consulta una variante específica por su ID. |
| `DELETE` | `/v1.0/variants/{variant_id}` | Elimina una variante (ej. si ya nunca más se fabricará esa talla). |

---

### 3. Inventario y Existencias (`/inventory`)

Controla el conteo de existencias en todas tus tiendas físicas.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/inventory` | Consulta el stock en tiempo real por tienda (`store_id`), variante (`variant_ids`) o cambios recientes. |
| `POST` | `/v1.0/inventory` | **Ajuste masivo de stock directo.** Permite fijar el número exacto de existencias (`stock_after: X`) por comando o código. |

> 💡 **Caso de uso:** Fue la función que ejecutamos hoy para limpiar en 5 segundos las 28 variantes negativas y dejarlas en 0. También sirve para sumar la producción del taller semanal en 1 clic.

---

### 4. Ventas y Recibos (`/receipts`)

Controla el registro de ventas, tickets y facturas.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/receipts` | Descarga el historial completo de ventas con filtros de fecha, cajero, tienda o cliente. |
| `POST` | `/v1.0/receipts` | **Crea una venta oficial por programa.** Le dices qué prendas se vendieron, a qué precio y cómo pagó el cliente. **Loyverse descuenta el inventario físico en el mismo segundo.** |
| `GET` | `/v1.0/receipts/{receipt_number}` | Consulta un recibo específico (desglose de prendas, descuentos aplicados, impuestos y hora). |
| `POST` | `/v1.0/receipts/{receipt_number}/refund` | **Ejecuta un reembolso/devolución:** Reintegra las prendas devueltas al inventario físico de la tienda. |

> 💡 **Caso de uso:** Cuando un cliente pague en tu futura página web con Wompi o Nequi, tu servidor ejecuta `POST /receipts`. Al cajero de tu local le aparece la venta pagada y el stock se descuenta para que nadie en el mostrador venda la misma prenda.

---

### 5. Clientes y CRM (`/customers`)

Base de datos de compradores y fidelización.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/customers` | Lista todos los clientes registrados o busca por teléfono, correo o nombre. |
| `POST` | `/v1.0/customers` | **Registra un nuevo cliente** o actualiza sus datos (nombre, WhatsApp, email, ciudad, dirección, código de cliente). |
| `GET` | `/v1.0/customers/{customer_id}` | Consulta el perfil completo de un cliente, sus notas y su saldo de puntos. |
| `DELETE` | `/v1.0/customers/{customer_id}` | Elimina un cliente. |

> 💡 **Caso de uso:** Cuando alguien hace un pedido mayorista en tu catálogo, puedes guardarlo automáticamente como cliente en Loyverse para saber cuántas veces te ha comprado en el año.

---

### 6. Descuentos y Promociones (`/discounts`)

Controla cupones y rebajas configuradas en el sistema.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/discounts` | Lista los descuentos activos (porcentajes como 5% o 10%, o montos fijos como -$20.000). |
| `POST` | `/v1.0/discounts` | Crea nuevos descuentos por código o campaña (ej. "CYBER_LUNES", "MAYOR_MADRUGON"). |

---

### 7. Categorías (`/categories`)

Estructura de departamentos de la tienda.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/categories` | Lista todas las categorías (Acidwash, Oversize, Buzos, Esqueleto, etc.). |
| `POST` | `/v1.0/categories` | Crea una categoría nueva o cambia su color/nombre. |
| `GET` | `/v1.0/categories/{category_id}` | Consulta una categoría en particular. |
| `DELETE` | `/v1.0/categories/{category_id}` | Elimina una categoría. |

---

### 8. Modificadores (`/modifiers`)

Controla opciones adicionales de cobro sobre las prendas.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/modifiers` | Lista los modificadores (ej. grupo "X Mayor" con descuento de -$19.000 o -$22.000). |
| `POST` | `/v1.0/modifiers` | Crea nuevos grupos de modificadores o precios al por mayor. |
| `DELETE` | `/v1.0/modifiers/{modifier_id}` | Elimina un grupo de modificadores. |

---

### 9. Webhooks en Tiempo Real (`/webhooks`) ⚡

Permite que **Loyverse le "hable" a tu página web** de forma proactiva cada vez que sucede algo en la tienda física.

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/webhooks` | Lista todas las alertas y webhooks configurados. |
| `POST` | `/v1.0/webhooks` | **Registra una URL receptora.** Ejemplo: `"https://urbannoise.cc/api/webhook"` |
| `DELETE` | `/v1.0/webhooks/{webhook_id}` | Elimina una suscripción de webhook. |

#### Eventos que Loyverse puede avisar al instante:
* `items.update` / `items.delete` (Prenda creada o eliminada).
* `inventory.update` (Alguien vendió una prenda en caja física o se ajustó stock).
* `receipts.create` (Se generó una venta en el almacén).
* `customers.create` / `customers.update` (Nuevo cliente registrado).

---

### 10. Tipos y Métodos de Pago (`/payment_types`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/payment_types` | Consulta los métodos de pago habilitados (Efectivo, Tarjeta, Nequi, Bancolombia, etc.). |
| `GET` | `/v1.0/payment_types/{id}` | Consulta los detalles de un método de pago. |

---

### 11. Tiendas y Sucursales (`/stores`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/stores` | Lista tus sucursales (ID, nombre: "Noise Urban", "Neos", país, moneda COP). |
| `GET` | `/v1.0/stores/{store_id}` | Obtiene la configuración de una sucursal específica. |

---

### 12. Cajas y Dispositivos TPV (`/pos_devices`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/pos_devices` | Lista las tablets y celulares donde está instalada la app de caja. |
| `POST` | `/v1.0/pos_devices` | Da de alta un nuevo dispositivo de punto de venta. |
| `DELETE` | `/v1.0/pos_devices/{id}` | Desvincula una tablet de la cuenta. |

---

### 13. Turnos y Arqueos de Caja (`/shifts`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/shifts` | **Auditoría de caja:** Descarga los cierres de turno, dinero base inicial, dinero en efectivo recolectado, descuadres de caja y cajero responsable. |
| `GET` | `/v1.0/shifts/{shift_id}` | Consulta el reporte detallado de un turno de caja específico. |

---

### 14. Empleados y Cajeros (`/employees`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/employees` | Lista todos los empleados, roles asignados y tiendas donde tienen permiso. |
| `GET` | `/v1.0/employees/{id}` | Consulta la información de un empleado. |

---

### 15. Proveedores (`/suppliers`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/suppliers` | Lista los talleres de confección y proveedores registrados. |
| `POST` | `/v1.0/suppliers` | Crea o actualiza datos de proveedores (contacto, notas). |
| `DELETE` | `/v1.0/suppliers/{id}` | Elimina un proveedor. |

---

### 16. Impuestos (`/taxes`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/taxes` | Lista las reglas de impuestos configuradas (IVA 19%, exento, etc.). |
| `POST` | `/v1.0/taxes` | Crea o actualiza tarifas de impuestos. |
| `DELETE` | `/v1.0/taxes/{id}` | Elimina un impuesto. |

---

### 17. Perfil del Comercio (`/merchant`)

| Método | Endpoint | ¿Qué hace? |
| :--- | :--- | :--- |
| `GET` | `/v1.0/merchant` | Consulta la información general de la cuenta (nombre del negocio, correo principal, zona horaria `America/Bogota`, moneda `COP`). |

---

## 🚀 5 Proyectos Increíbles que puedes Automatizar con esta API

1. **Bot de WhatsApp que responde existencias en vivo:**  
   Un cliente escribe: *"¿Tienen CLOTHING 07 en talla M Gris?"* ➔ El bot consulta `GET /inventory` y le responde automáticamente en 1 segundo: *"Sí, nos quedan 2 unidades"*.
2. **Reporte Diario a tu WhatsApp a las 9:00 PM:**  
   Un script consulta `GET /shifts` y `GET /receipts` y te manda un mensaje automático: *"Hoy se vendieron $3.450.000 en Tienda Noise Urban en 42 recibos"*.
3. **Alerta de Stock Bajo al Taller de Confección:**  
   Cuando una prenda llegue a menos de 5 unidades, el sistema envía un correo al taller: *"Faltan buzos negros, iniciar corte de 50 unds"*.
4. **Carga masiva de colecciones desde Excel:**  
   Creas 30 prendas con tallas y precios en una hoja de cálculo, corres un script y se suben todas a Loyverse en 10 segundos.
5. **Tienda Online 100% sincronizada:**  
   Ventas web que descuentan stock del local al instante y emiten recibos automáticos.
