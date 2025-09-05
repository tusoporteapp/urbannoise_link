document.addEventListener('DOMContentLoaded', function() {
    // Selecciona todos los elementos que tienen el atributo 'data-glightbox'.
    // Estos son los elementos que Glightbox utiliza para abrir la galería.
    const glightboxElements = document.querySelectorAll('[data-glightbox]');

    // Itera sobre cada elemento y elimina el atributo 'data-glightbox'.
    // Esto evita que Glightbox los reconozca y se active.
    glightboxElements.forEach(element => {
        element.removeAttribute('data-glightbox');
    });
});