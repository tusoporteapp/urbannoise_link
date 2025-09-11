// Espera a que todo el contenido de la página se cargue
window.addEventListener('load', function() {
    // Obtiene la última vez que el modal se mostró desde el almacenamiento local.
    const modalLastShown = localStorage.getItem('modalLastShown');
    // Obtiene la hora actual en milisegundos.
    const currentTime = new Date().getTime();
    // Define la duración de 24 horas en milisegundos.
    const twentyFourHours = 24 * 60 * 60 * 1000; 

    // Comprueba si el modal debe mostrarse.
    // Se mostrará si:
    // 1. Nunca se ha mostrado antes (modalLastShown es null).
    // 2. O si ha pasado más de 24 horas desde la última vez que se mostró.
    if (!modalLastShown || (currentTime - modalLastShown > twentyFourHours)) {
        
        // Asegúrate de que la librería de Bootstrap se haya cargado y 'bootstrap' esté disponible.
        if (typeof bootstrap !== 'undefined') {
            const modalElement = document.getElementById('modal-1');

            // Verifica que el elemento del modal realmente exista en tu HTML.
            if (modalElement) {
                const miModal = new bootstrap.Modal(modalElement);
                
                // Muestra el modal
                miModal.show();

                // ¡NUEVO! Escucha el evento 'hidden.bs.modal'.
                // Este evento se dispara justo después de que el modal se cierra.
                modalElement.addEventListener('hidden.bs.modal', function () {
                    // Guarda la hora actual en el almacenamiento local.
                    // El contador de 24h empieza ahora.
                    localStorage.setItem('modalLastShown', new Date().getTime());
                }, { once: true }); // Se usa { once: true } para que este evento solo se active una vez.

            } else {
                console.error("Error: No se encontró ningún elemento con el ID 'modal-1' en tu página. Revisa tu HTML.");
            }
        } else {
            console.error('Error: Bootstrap no está definido. Asegúrate de que el script de Bootstrap se cargue ANTES que este script.');
        }
    }
});