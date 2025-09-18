// Espera a que todo el contenido de la página se cargue.
window.addEventListener('load', function() {
    // Asegúrate de que la librería de Bootstrap se haya cargado y 'bootstrap' esté disponible.
    if (typeof bootstrap !== 'undefined') {
        const modalElement = document.getElementById('modal-1');

        // Verifica que el elemento del modal realmente exista en tu HTML.
        if (modalElement) {
            const miModal = new bootstrap.Modal(modalElement);
            
            // Muestra el modal inmediatamente.
            miModal.show();
        } else {
            console.error("Error: No se encontró ningún elemento con el ID 'modal-1' en tu página. Revisa tu HTML.");
        }
    } else {
        console.error('Error: Bootstrap no está definido. Asegúrate de que el script de Bootstrap se cargue ANTES que este script.');
    }
});
