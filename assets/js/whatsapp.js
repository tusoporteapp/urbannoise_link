function sendWhatsAppMessage() {
    // Obtener el título del modal
    const productTitle = document.getElementById("modal-title").innerText;

    // Obtener la URL de la página actual
    const pageUrl = window.location.href;

    // Número de WhatsApp al que se enviará el mensaje
    const phoneNumber = "+573108720491";

    // Crear el mensaje bien estructurado
    let message = `Hola un gusto, me ha fascinado sus productos.%0A%0A`;
    message += `Me interesó este modelo: *${productTitle}*%0A%0A`;
    message += `Es muy bonito, ¿puedo saber su precio?%0A%0A`;
    message += `🔗 *URL:* ${pageUrl}`;

    // Crear el enlace de WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    // Abrir el enlace en una nueva ventana
    window.open(whatsappUrl, "_blank");
}
