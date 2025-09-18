document.getElementById('compartir').addEventListener('click', async function() {
    const currentUrl = window.location.href;
    const shareMessage = `Te recomienda este catalogo, de UrbanNoise, es una marca urbana colombiana con excelente calidad. ${currentUrl}`;

    // Intenta usar la API de compartir del navegador si está disponible.
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'UrbanNoise',
                text: shareMessage,
                url: currentUrl
            });
            console.log('Contenido compartido con éxito.');
        } catch (error) {
            // Maneja el error si el usuario cancela la acción.
            console.error('Error al compartir:', error);
        }
    } else {
        // En este caso no hay un plan de respaldo, simplemente se muestra un mensaje en la consola.
        console.log('La Web Share API no es compatible con este navegador.');
    }
});
