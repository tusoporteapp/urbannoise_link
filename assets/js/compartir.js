function shareCatalog() {
  // Obtener el título del producto
  const productTitle = document.querySelector("section .container h1")?.innerText || "Modelo sin título";

  // Obtener la URL COMPLETA actual (incluye parámetros, anclas, etc.)
  const pageUrl = window.location.href;

  // Armar el mensaje con branding + producto + URL real
  let message = `👊 Te comparto esto de la marca *UrbanNoise*.%0A%0A`;
  message += `🚨 No es moda. Es actitud.%0A🔥 Esto es *UrbanNoise*%0A`;
  message += `👕 Modelo: *${productTitle}*%0A%0A`;
  message += `💥 Estilo, exclusividad y tendencia en un solo lugar.%0A`;
  message += `*¡No te lo puedes perder!*%0A%0A`;
  message += `🔗 *Descúbrelo aquí:* ${pageUrl}%0A%0A`;
  message += `¿Cuál sería tu favorito? 😍`;

  // Enlace WhatsApp sin número, para compartir
  const whatsappUrl = `https://wa.me/?text=${message}`;

  // Abrir en nueva pestaña
  window.open(whatsappUrl, "_blank");
}
