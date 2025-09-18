document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DEL DOM ---
    const chatToggleButton = document.getElementById('chat-toggle-button');
    const chatContainer = document.getElementById('chat-container');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const messagesContainer = document.getElementById('chat-messages');
    const optionsContainer = document.getElementById('chat-options');
    const chatCallout = document.getElementById('chat-callout'); // Elemento de la burbuja

    // Elementos del Modal
    const agentModalElement = document.getElementById('agentContactModal');
    const agentForm = document.getElementById('agent-form');
    const sendToWhatsappBtn = document.getElementById('send-to-whatsapp-btn');
    
    // Evita errores si los elementos no se encuentran
    if (!chatToggleButton || !chatContainer || !agentModalElement || !agentForm || !sendToWhatsappBtn || !chatCallout) {
        console.error("No se encontraron todos los elementos necesarios para el chatbot, el modal o la burbuja.");
        return;
    }

    // Instancia del Modal de Bootstrap
    const agentModal = new bootstrap.Modal(agentModalElement);
    let chatInitialized = false;

    // --- LÓGICA DEL CHAT ---
    const chatFlow = {
        start: {
            message: "🌟 ¡Hola y bienvenido(a) a Urban Noise! 👋🏻",
            options: {
                '1': { text: '🛍️ Compra por Unidad', next: 'unidad' },
                '2': { text: '📦 Surtir mi negocio', next: 'mayorista' },
                '3': { text: 'ℹ️ Más Información', next: 'info' },
                '4': { text: '🗣️ Hablar con un agente', next: 'agente' }
            }
        },
        unidad: {
            message: "Para mayor facilidad te dejo nuestra página. Acá puedes ver todos nuestros productos y realizar la compra directa 💳<br><a href='http://urbannoise.co' target='_blank'>urbannoise.co</a><br><br>O también puedes ver el producto de tu interés y me escribes y coordinamos tu compra. 🤩<br><br>Quedo atento a cualquier inquietud 🧐",
            options: { 'inicio': { text: '↩️ Volver al menú principal', next: 'start' } }
        },
        mayorista: {
            message: "¿Qué categoría buscas para tu negocio?",
            options: {
                '1': { text: '👕 Camisetas Oversize', next: 'mayorista_camisetas' },
                '2': { text: '🧥 Buzos', next: 'mayorista_buzos' },
                '3': { text: '💪 Esqueletos', next: 'mayorista_esqueletos' },
                '4': { text: '🩳 Bermudas', next: 'mayorista_bermudas' },
                '5': { text: '👖 Conjuntos', next: 'mayorista_conjuntos' },
                '6': { text: '👩 Ropa para Dama', next: 'mayorista_dama' },
                '7': { text: '👦 Ropa para Niño', next: 'mayorista_nino' },
                '8': { text: '↩️ Volver al menú principal', next: 'start' }
            }
        },
        mayorista_camisetas: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Camisetas Oversize al por mayor”:<br><u>Caballero:</u><br>Acid Wash $48.000 👉 <a href='http://urbannoise.cc/caballero#AcidWash' target='_blank'>Ver catálogo</a><br>Oversize Burda $33.000 👉 <a href='http://urbannoise.cc/caballero#OverBurda' target='_blank'>Ver catálogo</a><br>Oversize Galleta $33.000 👉 <a href='http://urbannoise.cc/catalogo/Hombre/OverBurda/Tex.Galleta' target='_blank'>Ver catálogo</a><br><u>Dama:</u><br>Camiseta Oversize $20.000 👉 <a href='http://urbannoise.cc/damas#Camiseta' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        mayorista_buzos: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Buzos al por mayor”:<br><u>Caballero:</u><br>Desde $70.000 👉 <a href='http://urbannoise.cc/caballero#Busos' target='_blank'>Ver catálogo</a><br><u>Dama:</u><br>$80.000 👉 <a href='http://urbannoise.cc/damas#Busos' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        mayorista_esqueletos: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Esqueletos al por mayor”:<br><u>Caballero:</u><br>$30.000 👉 <a href='http://urbannoise.cc/caballero#Esqueletos' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        mayorista_bermudas: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Bermudas al por mayor”:<br><u>Caballero:</u><br>$32.000 👉 <a href='http://urbannoise.cc/caballero#Bermudas' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        mayorista_conjuntos: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Conjuntos al por mayor”:<br><u>Caballero:</u><br>Desde $66.000 👉 <a href='http://urbannoise.cc/caballero#Conjuntos' target='_blank'>Ver catálogo</a><br><u>Dama:</u><br>$75.000 👉 <a href='http://urbannoise.cc/damas#Conjuntos' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        mayorista_dama: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Ropa para Dama al por mayor”:<br>Catálogo completo 👉 <a href='http://urbannoise.cc/damas' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        mayorista_nino: {
            message: "<b>Precios 🤑 - Catálogo 📖</b><br>“Ropa para Niño al por mayor”:<br>Conjunto Camisa $50.000 👉 <a href='http://urbannoise.cc/niños' target='_blank'>Ver catálogo</a><br><br><b>👀 ATENCION 👀</b><br>Para mayorista son compras superiores a 6 Unds.<br>Recuerda que tenemos más clientes en línea, por lo tanto, es necesario verificar si las prendas de tu elección aún están disponibles. 📲<br>No manejamos pagos contra entrega 💰<br>Debes asumir el costo del envió 🚚",
            options: {
                'productos': { text: '↩️ Volver a productos', next: 'mayorista' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        info: {
            message: "¿Qué información necesitas?",
            options: {
                '1': { text: '📍 Ubicación y Horarios', next: 'info_ubicacion' },
                '2': { text: '🚚 Envíos y Métodos de Pago', next: 'info_pagos' },
                '3': { text: '🔄 Políticas (Garantías y Cambios)', next: 'info_politicas' },
                '4': { text: '🏭 Info para Fabricación', next: 'info_fabricacion' },
                '5': { text: '↩️ Volver al menú principal', next: 'start' }
            }
        },
        info_ubicacion: {
            message: "<b>Nuestra información:</b><br>📍 Dirección: C.C. El Gran San, local 2268, Bogotá.<br>🗺️ Google Maps: <a href='https://maps.app.goo.gl/36494su6GifD9X9PA' target='_blank'>Ver en mapa</a><br>⏰ Horarios:<br>L-M-J-V: 9:00 a.m. - 5:30 p.m.<br>Miércoles y Sábados: 5:00 a.m. - 5:00 p.m.",
            options: { 'inicio': { text: '↩️ Volver al menú principal', next: 'start' } }
        },
        info_pagos: {
            message: "Selecciona una opción:",
            options: {
                '1': { text: '🛵 Pago Contra Entrega', next: 'pagos_contraentrega' },
                '2': { text: '💳 Métodos de Pago', next: 'pagos_metodos' },
                '3': { text: '✈️ Envíos Nacionales/Internacionales', next: 'pagos_envios' },
                '4': { text: '↩️ Volver', next: 'info' }
            }
        },
        info_politicas: {
            message: "<b>Resumen de políticas:</b><br><u>Garantía:</u> 60 días por defectos de fábrica.<br><u>Cambios:</u> Solo por talla o defecto.<br><u>Devolución de Dinero:</u> Solo por defecto de fábrica.",
            options: { 'inicio': { text: '↩️ Volver al menú principal', next: 'start' } }
        },
        info_fabricacion: {
            message: "<b>Sobre diseños propios:</b><br>No personalizamos al detal.<br>Para pedidos mayoristas (mínimo 80 prendas), se requiere un estudio previo. Un agente debe manejar estos casos para definir detalles y costos.",
            options: { 'inicio': { text: '↩️ Volver al menú principal', next: 'start' } }
        },
        pagos_contraentrega: {
            message: "<b>Sobre el pago contra entrega:</b><br><u>En Bogotá:</u> El envío a domicilio cuesta $11.000.<br><u>Fuera de Bogotá:</u> La transportadora cobra una comisión del 5% sobre el valor del producto.",
            options: {
                'pagos': { text: '↩️ Volver a envíos y pagos', next: 'info_pagos' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        pagos_metodos: {
            message: "<b>Métodos de pago aceptados:</b><br><u>Pedidos por WhatsApp:</u> Efectivo, Nequi, Daviplata.<br><u>Compras en la web:</u> Todos los métodos, incluyendo tarjetas de crédito/débito.",
            options: {
                'pagos': { text: '↩️ Volver a envíos y pagos', next: 'info_pagos' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        },
        pagos_envios: {
            message: "<b>Información de envíos:</b><br><u>Nacionales:</u> Hacemos envíos a todo el país. El costo depende del peso y volumen.<br><u>Internacionales:</u> Para envíos fuera de Colombia, es necesario que te atienda un agente.",
            options: {
                'pagos': { text: '↩️ Volver a envíos y pagos', next: 'info_pagos' },
                'inicio': { text: '🏠 Volver al inicio', next: 'start' }
            }
        }
    };
    
    // --- FUNCIONES AUXILIARES ---
    const toggleChat = () => {
        chatContainer.classList.toggle('active');
        // Oculta la burbuja permanentemente después del primer clic
        if (chatCallout) { 
            chatCallout.style.display = 'none'; 
        } 
        if (chatContainer.classList.contains('active') && !chatInitialized) {
            initializeChat();
        }
    };
    
    const initializeChat = () => {
        navigateTo('start');
        chatInitialized = true;
    };

    const addMessage = (sender, text) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.innerHTML = text;
        messageDiv.appendChild(contentDiv);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const renderOptions = (options) => {
        optionsContainer.innerHTML = '';
        optionsContainer.style.display = Object.keys(options).length === 0 ? 'none' : 'block';
        for (const key in options) {
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add('btn', 'btn-outline-primary'); 
            button.innerHTML = options[key].text;
            button.dataset.next = options[key].next;
            button.dataset.text = options[key].text;
            button.addEventListener('click', handleOptionClick);
            optionsContainer.appendChild(button);
        }
    };
    
    const handleOptionClick = (event) => {
        const nextState = event.currentTarget.dataset.next;
        const userMessageText = event.currentTarget.dataset.text;
        addMessage('user', userMessageText);

        if (nextState === 'agente') {
            addMessage('bot', "¡Perfecto! Por favor, completa el siguiente formulario para contactar a un agente.");
            setTimeout(() => {
                chatContainer.classList.remove('active'); // Cierra el chat
                agentModal.show(); // Abre el modal
            }, 1000);
        } else {
            setTimeout(() => navigateTo(nextState), 500);
        }
    };

    const navigateTo = (stateKey) => {
        const currentState = chatFlow[stateKey];
        if (currentState) {
            addMessage('bot', currentState.message);
            renderOptions(currentState.options);
        } else {
            addMessage('bot', "No he entendido tu solicitud. Por favor, elige una de las opciones.");
            renderOptions(chatFlow.start.options);
        }
    };
    
    const handleSendToWhatsapp = (event) => {
        agentForm.classList.add('was-validated');
        if (!agentForm.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        const fullName = document.getElementById('fullName').value;
        const reason = document.getElementById('reason').value;
        const customMessage = document.getElementById('customMessage').value;

        let formattedMessage = `*Nueva solicitud de asistencia:*\n\n`;
        formattedMessage += `*Nombre:* ${fullName}\n`;
        formattedMessage += `*Motivo:* ${reason}\n`;
        formattedMessage += `*Mensaje:*\n${customMessage}`;

        const phoneNumber = '573108720491'; 
        const message = encodeURIComponent(formattedMessage);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

        window.open(whatsappUrl, '_blank');

        agentModal.hide();
        agentForm.reset();
        agentForm.classList.remove('was-validated');
    };

    // --- EVENT LISTENERS ---
    chatToggleButton.addEventListener('click', toggleChat);
    closeChatBtn.addEventListener('click', toggleChat);
    sendToWhatsappBtn.addEventListener('click', handleSendToWhatsapp);

    agentModalElement.addEventListener('hidden.bs.modal', () => {
        agentForm.reset();
        agentForm.classList.remove('was-validated');
    });
});

