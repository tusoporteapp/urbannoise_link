document.addEventListener("DOMContentLoaded", function () {
  const botonCompartir = document.getElementById("btnCompartirWhatsapp");

  if (botonCompartir) {
    botonCompartir.addEventListener("click", function () {
      const mensaje = encodeURIComponent(
        "🧨 Esto no es ropa.\nEs UrbanNoise. Es calle. Es fuego.\nSi te atreves a vestir diferente...\n👉 Toca y descúbrelo:"
      );
      const url = encodeURIComponent(window.location.href);
      const mensajeCompleto = `${mensaje}%0A${url}`;
      const urlWhatsApp = `https://wa.me/?text=${mensajeCompleto}`;
      window.open(urlWhatsApp, "_blank");
    });
  }
});
