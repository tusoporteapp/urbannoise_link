document.addEventListener("DOMContentLoaded", function () {
    const API_KEY = "AIzaSyC2gil5B_kl_qRxDtmon8qJ4TdAAHZs4D0"; // 🔹 Reemplázalo con tu API Key de Blogger
    const BLOG_ID = "4307581421676951430"; // 🔹 Reemplázalo con tu ID de Blog
    const POST_LIMIT = 500; // 🔹 Número de posts a mostrar
    const blogContainer = document.getElementById("blogPosts");

    // 🔹 Obtener los posts del API de Blogger
    function fetchPosts() {
        const apiUrl = `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts?key=${API_KEY}&maxResults=${POST_LIMIT}`;

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.items) {
                    let cardsHtml = data.items.map((post, index) => createCard(post, index)).join("");
                    blogContainer.innerHTML = cardsHtml;
                    initializeCarousels();
                    setupModalEventListeners(data.items);
                }
            })
            .catch(error => console.error("Error al obtener los posts:", error));
    }

    // 🔹 Crear cada tarjeta con su carrusel
    function createCard(post, index) {
        const title = post.title;
        let content = post.content;
        const postId = post.id;

        // 🔹 Extraer imágenes del contenido del post
        const imgMatches = content.match(/<img[^>]+src=["'](.*?)["']/g);
        const images = imgMatches ? imgMatches.map(img => img.match(/src=["'](.*?)["']/)[1]) : [];

        // 🔹 Extraer el modelo de la camisa si está en el contenido (Ejemplo: "Modelo UN-001")
        const modelMatch = content.match(/Modelo\s+([\w-]+)/i);
        const model = modelMatch ? modelMatch[0] : "Modelo no especificado";

        // 🔹 Remover imágenes del contenido del post para que no aparezcan en la parte de abajo del modal
        content = content.replace(/<img[^>]*>/g, '');

        const carouselId = `carousel-${index}`;

        return `
            <div class="col-6 col-sm-4 col-md-4 col-lg-3 blog-post" 
                 data-title="${title}" 
                 data-model="${model}">
                <div class="card bg-black text-light">
                    <div id="${carouselId}" class="carousel slide blog-carousel" data-bs-ride="false">
                        <div class="carousel-inner">
                            ${images.length > 0 ? images.map((imgSrc, imgIndex) => `
                                <div class="carousel-item ${imgIndex === 0 ? 'active' : ''}">
                                    <img class="w-100 d-block" src="${imgSrc}">
                                </div>`).join("") :
                                `<div class="carousel-item active">
                                    <img class="w-100 d-block" src="https://via.placeholder.com/1400x800">
                                </div>`}
                        </div>
                        <a class="carousel-control-prev" href="#${carouselId}" role="button" data-bs-slide="prev">
                            <span class="carousel-control-prev-icon"></span>
                            <span class="visually-hidden">Previous</span>
                        </a>
                        <a class="carousel-control-next" href="#${carouselId}" role="button" data-bs-slide="next">
                            <span class="carousel-control-next-icon"></span>
                            <span class="visually-hidden">Next</span>
                        </a>
                    </div>
                    <div class="card-footer p-4 py-3">
                        <a href="#" class="blog-link text-light" data-bs-toggle="modal" data-bs-target="#modal-1" data-post-id="${postId}">
                            Ver Más
                        </a>
                    </div>
                </div>
            </div>`;
    }

    // 🔹 Inicializar Bootstrap Carousel en todas las tarjetas de #blogPosts
    function initializeCarousels() {
        document.querySelectorAll(".blog-carousel").forEach(carousel => {
            new bootstrap.Carousel(carousel, {
                interval: false,
                ride: false
            });
        });
    }

    // 🔹 Configurar eventos para abrir el modal con la información del post
    function setupModalEventListeners(posts) {
        document.querySelectorAll(".blog-link").forEach(button => {
            button.addEventListener("click", function () {
                const postId = this.getAttribute("data-post-id");
                const post = posts.find(p => p.id === postId);
                if (post) {
                    handleModalContent(post);
                }
            });
        });
    }

    // 🔹 Cargar contenido en el modal
    function handleModalContent(post) {
        document.getElementById("modal-title").innerText = post.title;

        // 🔹 Limpiar el carrusel antes de agregar nuevas imágenes
        const modalCarouselInner = document.getElementById("modal-carousel-inner");
        modalCarouselInner.innerHTML = "";

        // 🔹 Extraer imágenes del contenido del post y agregarlas al carrusel
        const imgMatches = post.content.match(/<img[^>]+src=["'](.*?)["']/g);
        const images = imgMatches ? imgMatches.map(img => img.match(/src=["'](.*?)["']/)[1]) : [];

        if (images.length > 0) {
            images.forEach((imgSrc, index) => {
                modalCarouselInner.innerHTML += `
                    <div class="carousel-item ${index === 0 ? 'active' : ''}">
                        <img class="w-100 d-block" src="${imgSrc}">
                    </div>`;
            });

            // 🔹 Configurar el carrusel del modal con intervalos de 3 segundos
            let modalCarousel = new bootstrap.Carousel(document.getElementById("modal-carousel"), {
                interval: 3000,
                ride: false
            });
            modalCarousel.cycle();
        } else {
            modalCarouselInner.innerHTML = `<p class="text-center">No hay imágenes en este post.</p>`;
        }

        // 🔹 Insertar el contenido del post sin imágenes
        document.getElementById("modal-content").innerHTML = post.content.replace(/<img[^>]*>/g, '');
    }

    // 🔹 Llamamos a la función principal para obtener los posts
    fetchPosts();
});
