function sendWhatsAppMessage() {
    // Obtener el título del producto (primer <h1> dentro de .container)
    const productTitle = document.querySelector("section .container h1")?.innerText || "Modelo sin título";

    // Obtener la URL completa de la página
    const pageUrl = window.location.href;

    // Número de WhatsApp al que se enviará el mensaje
    const phoneNumber = "+573108720491";

    // Crear mensaje formateado para WhatsApp
    let message = `👋 Hola, un gusto! Me ha fascinado su catálogo de camisetas.%0A%0A`;
    message += `Me interesó este modelo: *${productTitle}* 👕%0A%0A`;
    message += `✨ Está brutal. ¿Podría indicarme el precio?%0A%0A`;
    message += `🔖 *Categoría:* Oversized%0A`;
    message += `🔗 *URL:* ${pageUrl}`;

    // Generar enlace de WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    // Abrir enlace en una nueva pestaña
    window.open(whatsappUrl, "_blank");
}