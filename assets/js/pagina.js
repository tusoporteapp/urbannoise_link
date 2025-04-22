function shareCatalog1() {
  // Obtener la URL COMPLETA de la página actual
  const pageUrl = window.location.href;

  // Crear el mensaje con la URL
  const message = `¡Mira este catálogo te lo recomiendo! ${pageUrl}`;

  // Codificar el mensaje para que sea compatible con la URL
  const encodedMessage = encodeURIComponent(message);

  // Enlace de WhatsApp sin número de teléfono, usando el mensaje codificado
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;

  // Abrir en una nueva pestaña
  window.open(whatsappUrl, "_blank");
}