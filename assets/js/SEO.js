        // Esperamos a que el contenido inicial de la página esté listo.
        document.addEventListener('DOMContentLoaded', () => {
        
            // Paso 1: Seleccionar el contenedor principal del producto.
            // Usamos el atributo 'data-reflow-type="product"' porque es único.
            const productContainer = document.querySelector('div[data-reflow-type="product"]');

            // Nos aseguramos de que el contenedor del producto exista en la página.
            if (productContainer) {

                // Paso 2: Crear un "observador" que vigile los cambios dentro del contenedor.
                // Esto es crucial porque el contenido del producto se carga dinámicamente (después de la carga inicial).
                // Sin esto, el script se ejecutaría antes de que el título del producto exista y no encontraría nada.
                const observer = new MutationObserver((mutationsList, obs) => {
                    // Este código se ejecuta CADA VEZ que algo cambia dentro de 'productContainer'.

                    // Paso 3: Buscar el elemento que contiene el nombre del producto.
                    // La clase '.ref-name' es la que usa comúnmente el sistema Reflow para el título.
                    // ---
                    // ¡IMPORTANTE! Si no funciona, inspecciona el título de tu producto en el navegador
                    // (clic derecho -> Inspeccionar) y reemplaza '.ref-name' por el selector correcto (ej: 'h1', '.product-title', etc.).
                    // ---
                    const productTitleElement = productContainer.querySelector('.ref-name');

                    // Paso 4: Comprobar si encontramos el elemento y si tiene texto.
                    if (productTitleElement && productTitleElement.textContent.trim() !== '') {
                        
                        // Obtenemos el texto del nombre del producto y lo limpiamos de espacios extra.
                        const productName = productTitleElement.textContent.trim();
                        
                        // Paso 5: Actualizar el título de la página (la etiqueta <title> en el <head>).
                        // Esto es lo que ven los motores de búsqueda (SEO) y los usuarios en la pestaña del navegador.
                        document.title = productName;
                        
                        console.log(`Título de la página (SEO) actualizado a: "${productName}"`);

                        // Paso 6: (Recomendado) Detener el observador.
                        // Ya hemos encontrado el título, no necesitamos seguir vigilando la página.
                        // Esto ahorra recursos del navegador.
                        obs.disconnect();
                    }
                });

                // Paso 7: Iniciar el observador.
                // Le decimos que vigile si se añaden o quitan elementos hijos ('childList: true')
                // y que también revise dentro de los sub-elementos ('subtree: true').
                observer.observe(productContainer, {
                    childList: true,
                    subtree: true
                });

            } else {
                console.error("Error: No se pudo encontrar el contenedor del producto 'data-reflow-type=\"product\"'.");
            }
        });