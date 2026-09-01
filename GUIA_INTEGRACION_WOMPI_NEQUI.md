# 💳 Guía de Integración Wompi (Bancolombia & Nequi) // Urban Noise

Este documento detalla la arquitectura, el flujo de usuario y la implementación técnica para conectar la pasarela de pagos **Wompi** con el catálogo mayorista de **Urban Noise** y el sistema POS **Loyverse**.

---

## 🏗️ 1. Arquitectura General del Sistema

El sistema opera bajo un flujo automatizado de 4 actores:

```
 ┌──────────────────────┐        ┌──────────────────────┐
 │  1. Catálogo Web     │ ─────► │  2. Servidor Cloud   │
 │     (Urban Noise)    │        │     (Cloudflare)     │
 └──────────────────────┘        └──────────┬───────────┘
            ▲                               │
            │                               ▼
 ┌──────────┴───────────┐        ┌──────────────────────┐
 │  4. Cliente / Nequi  │ ◄───── │  3. Wompi API        │
 │     (Aprueba Pago)   │        │     (Bancolombia)    │
 └──────────┬───────────┘        └──────────┬───────────┘
            │                               │
            ▼                               ▼
 ┌──────────────────────┐        ┌──────────────────────┐
 │  5. Loyverse POS     │ ◄──────┤  Webhook de          │
 │     (Stock & Recibo) │        │  Confirmación 100%   │
 └──────────────────────┘        └──────────────────────┘
```

---

## 📱 2. Métodos de Cobro Soportados

### Opción A: Cobro Directo por Notificación Push de Nequi *(Recomendado para Mayoristas)*
1. El cliente ingresa su número de celular Nequi en el carrito (ej. `310 123 4567`).
2. Al presionar **"Pagar con Nequi"**, a su teléfono le llega una notificación push oficial de Nequi:
   > **Nequi:** *"Urban Noise te solicita un pago de $246.000 COP. ¿Aceptar?"*
3. El cliente abre Nequi con su huella o reconocimiento facial y confirma.
4. El dinero entra inmediatamente a tu cuenta y el sistema procesa el pedido en automático.

### Opción B: Link de Pago / Widget Multimétodo
El catálogo genera un enlace seguro de Wompi con soporte para:
* 📲 **Nequi** (Push o Código QR).
* 🏦 **Botón Bancolombia / Transferencia**.
* 🌐 **PSE** (Cualquier banco en Colombia: Davivienda, BBVA, Banco de Bogotá, etc.).
* 💳 **Tarjetas de Crédito y Débito** (Visa, Mastercard, American Express).

---

## 🔄 3. Flujo Paso a Paso de una Compra Automatizada

```
Paso 1: Cliente arma su pedido mayorista (mínimo 6 prendas) en https://urbannoise.cc/
  │
Paso 2: En la pantalla de pago elige: "Nequi Directo" o "Link de Pago Wompi"
  │
Paso 3: El catálogo contacta a Cloudflare (/api/wompi/create-payment)
  │     └─ Genera la transacción con firma criptográfica SHA-256
  │
Paso 4: El cliente aprueba el pago en Nequi / PSE / Tarjeta
  │
Paso 5: Wompi envía un Webhook seguro a Cloudflare (/api/wompi/webhook)
  │     └─ Verifica que el estado sea "APPROVED"
  │
Paso 6: El servidor descuenta el stock en Loyverse POS y crea el recibo oficial
  │
Paso 7: Se envía confirmación automática por WhatsApp tanto al cliente como a la tienda
```

---

## 💻 4. Especificación Técnica de Endpoints

### 4.1. Endpoint de Creación de Cobro (`/api/wompi/create-payment`)
**Método:** `POST`  
**Función:** Genera la referencia única, calcula la firma de integridad y solicita la transacción a Wompi.

```javascript
// Payload enviado desde el Frontend:
{
  "customer_phone": "3101234567",
  "customer_email": "comprador@gmail.com",
  "payment_method": "NEQUI", // o "PAYMENT_LINK"
  "items": [
    { "id": "uuid-prenda-1", "title": "Buzo Acid Wash", "size": "M", "qty": 3, "price": 60000 },
    { "id": "uuid-prenda-2", "title": "Oversize Noise", "size": "L", "qty": 3, "price": 22000 }
  ]
}
```

```javascript
// Cálculo de Firma de Integridad SHA-256 (Requerida por Wompi):
const reference = `UN-${Date.now()}`;
const amountInCents = totalAmount * 100;
const currency = "COP";
const integritySecret = context.env.WOMPI_INTEGRITY_SECRET;

const rawSignature = `${reference}${amountInCents}${currency}${integritySecret}`;
const signatureHex = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawSignature));
```

---

### 4.2. Endpoint Webhook de Confirmación (`/api/wompi/webhook`)
**Método:** `POST`  
**Función:** Recibe las notificaciones en tiempo real emitidas por Wompi cuando una transacción cambia de estado.

```javascript
export async function onRequestPost(context) {
    const payload = await context.request.json();
    const event = payload.data.transaction;

    // 1. Validar que el pago esté APROBADO
    if (payload.event === "transaction.updated" && event.status === "APPROVED") {
        const orderReference = event.reference;
        const totalPaid = event.amount_in_cents / 100;
        const customerPhone = event.customer_data ? event.customer_data.phone_number : null;

        // 2. Descontar Inventario en Loyverse POS (API Loyverse)
        await applyLoyverseStockDeduction(event.customer_data.order_items);

        // 3. Registrar Recibo Oficial de Venta en Loyverse POS
        await createLoyverseReceipt({
            reference: orderReference,
            total: totalPaid,
            paymentType: "Wompi / Nequi"
        });

        return new Response(JSON.stringify({ received: true }), { status: 200 });
    }

    return new Response(JSON.stringify({ ignored: true }), { status: 200 });
}
```

---

## 🔑 5. Credenciales y Requisitos de Wompi

Para activar la pasarela en producción se requieren las siguientes llaves que entrega el panel de Wompi:

| Variable de Entorno | Descripción | Ejemplo de Formato |
| :--- | :--- | :--- |
| `WOMPI_PUBLIC_KEY` | Llave pública para inicializar el widget | `pub_prod_xxxxxxxxxxxx` |
| `WOMPI_PRIVATE_KEY` | Llave privada para backend | `prv_prod_xxxxxxxxxxxx` |
| `WOMPI_INTEGRITY_SECRET` | Secreto para firmar montos y evitar alteraciones | `prod_integrity_xxxxxxxx` |
| `WOMPI_EVENTS_SECRET` | Secreto para verificar autenticidad de Webhooks | `prod_events_xxxxxxxx` |

---

## 💰 6. Tarifas y Tiempos de Abono (Wompi Colombia)

* **Comisión por Nequi:** ~**1.5% a 2.65%** + IVA por transacción exitosa.
* **Comisión por Tarjeta / PSE:** ~**2.65% + $700 COP** + IVA.
* **Dispersión a tu cuenta:** El dinero se transfiere automáticamente a tu cuenta de **Nequi** o **Bancolombia** registrada (usualmente al día siguiente hábil sin costo adicional de retiro).

---

## 🏆 7. Beneficios para Urban Noise

1. **Ventas 24/7 en Automático:** El cliente puede comprar y pagar a las 11:00 PM; el sistema cobra, descuenta el stock y guarda el pedido sin requerir atención humana inmediata.
2. **Cero Comprobantes Falsos:** Elimina el riesgo de "pantallazos de transferencia editados", ya que el pedido solo se procesa cuando la API de Wompi confirma que el dinero ingresó.
3. **Control Contable en Loyverse:** Cada venta online queda registrada en el arqueo diario de caja de Loyverse con la etiqueta exacta *"Pago Wompi/Nequi"*.
