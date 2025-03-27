document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.getElementById("searchInput");
    const blogPostsContainer = document.getElementById("blogPosts");

    // 🔹 Función para filtrar los posts por título o modelo
    function filterPosts() {
        let query = searchInput.value.toLowerCase();
        let posts = blogPostsContainer.getElementsByClassName("blog-post");

        Array.from(posts).forEach(post => {
            let title = post.getAttribute("data-title")?.toLowerCase() || "";
            let model = post.getAttribute("data-model")?.toLowerCase() || "";

            if (title.includes(query) || model.includes(query)) {
                post.style.display = "block"; // 🔹 Muestra el post si coincide
            } else {
                post.style.display = "none"; // 🔹 Oculta el post si no coincide
            }
        });
    }

    // 🔹 Asegurar que el input se activa correctamente en móviles
    searchInput.addEventListener("click", function () {
        this.focus(); // 🔹 Forzar el foco en cualquier caso
    });

    searchInput.addEventListener("touchend", function (event) {
        event.preventDefault(); // 🚀 Evita cualquier bloqueo táctil
        this.focus(); // 🔹 Activa el teclado inmediatamente
    });

    // 🔹 Activar la búsqueda en tiempo real mientras se escribe
    searchInput.addEventListener("input", filterPosts);

    // 🔹 Mostrar todos los posts cuando el campo está vacío
    searchInput.addEventListener("keyup", function () {
        if (searchInput.value.trim() === "") {
            let posts = blogPostsContainer.getElementsByClassName("blog-post");
            Array.from(posts).forEach(post => post.style.display = "block");
        }
    });

    // 🔹 Asegurar que el input no tenga estilos que bloqueen interacción
    searchInput.style.pointerEvents = "auto";
});
