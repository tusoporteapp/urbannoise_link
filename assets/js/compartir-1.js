// Muestra una caja de mensaje personalizada
function showMessage(text) {
    const messageBox = document.getElementById('message-box');
    const messageText = document.getElementById('message-text');
    messageText.textContent = text;
    messageBox.classList.remove('hidden');
    messageBox.classList.add('flex');

    document.getElementById('close-message').onclick = () => {
        messageBox.classList.remove('flex');
        messageBox.classList.add('hidden');
    };
}

document.getElementById('compartir').addEventListener('click', async function() {
    const currentUrl = window.location.href;
    const productDiv = document.querySelector('div[data-reflow-type="product"]');
    
    // Verificar si el div del producto existe
    if (!productDiv) {
        console.error("No se encontró el div del producto con 'data-reflow-type=\"product\"'.");
        showMessage('Error: No se encontró la información del producto para compartir.');
        return;
    }

    // Extraer la información del producto desde los elementos internos
    const productName = productDiv.querySelector('.product-name')?.textContent.trim() || 'Producto';
    const productDescription = productDiv.querySelector('.product-description')?.textContent.trim() || 'Sin descripción';
    const productImage = productDiv.querySelector('.product-image')?.src || '';

    const shareTitle = `UrbanNoise | ${productName}`;
    const shareText = `¡Mira esta ${productName} de UrbanNoise! ${productDescription}. Descubre más en: ${currentUrl}`;
    
    // Intenta usar la API de compartir del navegador si está disponible.
    if (navigator.share) {
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: currentUrl,
                // Se puede intentar incluir la imagen, aunque no es compatible universalmente
                files: productImage ? [await (await fetch(productImage)).blob()] : []
            });
            console.log('Contenido compartido con éxito.');
            showMessage('¡Compartido con éxito!');
        } catch (error) {
            // Maneja el error si el usuario cancela la acción.
            console.error('Error al compartir:', error);
            // No mostrar mensaje si el error es por cancelación del usuario
            if (error.name !== 'AbortError') {
                showMessage('Hubo un error al compartir.');
            }
        }
    } else {
        // En caso de que la Web Share API no sea compatible
        console.log('La Web Share API no es compatible con este navegador. Proporcionando un plan de respaldo.');
        const fallbackMessage = `${shareText}\n${currentUrl}`;
        // Fallback: copiar al portapapeles o mostrar un mensaje
        if (navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(fallbackMessage);
                showMessage('El enlace y la descripción del producto se han copiado al portapapeles.');
            } catch (err) {
                console.error('Error al copiar al portapapeles:', err);
                showMessage('La Web Share API no es compatible. Copia el siguiente texto manualmente:\n' + fallbackMessage);
            }
        } else {
            showMessage('La Web Share API no es compatible con este navegador. El siguiente texto se puede copiar manualmente:\n' + fallbackMessage);
        }
    }
});
