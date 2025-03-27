function shareCatalog() {
    // Obtener la URL de la página actual
    const pageUrl = window.location.href;

    // Número de WhatsApp al que se enviará el mensaje (opcional, se puede compartir sin número)
    const phoneNumber = ""; // Dejar vacío para que el usuario elija a quién enviarlo

    // Crear el mensaje de WhatsApp
    let message = `🔥 *¡Descubre UrbanNoise! 🔥*%0A%0A`;
    message += `💥 Estilo, exclusividad y tendencia en un solo lugar.%0A`;
    message += `Nuestra nueva colección ya está disponible, y sé que te encantará. *¡No te lo puedes perder!*%0A%0A`;
    message += `🔗 *Explora nuestro catálogo aquí:* ${pageUrl}%0A%0A`;
    message += `¡Cuéntame qué te parece y cuál es tu favorito! 😍`;

    // Crear el enlace de WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

    // Abrir el enlace en una nueva ventana
    window.open(whatsappUrl, "_blank");
}
