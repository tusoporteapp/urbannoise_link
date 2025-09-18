document.getElementById('btwhatsapp').addEventListener('click', function() {
    // Obtiene la URL de la página actual
    const currentUrl = window.location.href;
    
    // Define el número de teléfono y el mensaje
    // Reemplaza '1234567890' con el número de teléfono completo, incluyendo el código de país.
    const phoneNumber = '573108720491'; 
    const message = `Necesito más información sobre esta prenda: ${currentUrl}`;
    
    // Codifica el mensaje para la URL
    const encodedMessage = encodeURIComponent(message);
    
    // Crea la URL de WhatsApp
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // Abre la URL en una nueva ventana
    window.open(whatsappUrl, '_blank');
});