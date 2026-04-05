const contenedor = document.getElementById("contenedor");
const searchInput = document.querySelector(".search");
const searchResults = document.querySelector(".search-results");
const btnLogo = document.getElementById("btn-logo");
const btnGeneros = document.getElementById("btn-generos");
const menuGeneros = document.getElementById("menu-generos");
const btnInicio = document.getElementById("btn-inicio");
const btnPeliculas = document.getElementById("btn-peliculas");
const btnSolicitar = document.getElementById("btn-solicitar");
const btnNotificaciones = document.getElementById("btn-notificaciones");
const notificationsCount = document.getElementById("notifications-count");
const heroTitle = document.getElementById("hero-title");
const heroDesc = document.getElementById("hero-desc");
const heroBtn = document.getElementById("hero-btn");
const menuToggle = document.getElementById("menu-toggle");
const mainNav = document.getElementById("main-nav");
const toastStack = document.getElementById("toast-stack");
const notificationsPanel = document.getElementById("notifications-panel");
const notificationsList = document.getElementById("notifications-list");
const notificationsClose = document.getElementById("notifications-close");
const requestSection = document.getElementById("request-section");
const requestForm = document.getElementById("request-form");
const requestStatus = document.getElementById("request-status");
const requestSubmit = document.getElementById("request-submit");
const requestClose = document.getElementById("request-close");
const requestContactType = document.getElementById("request-contact-type");
const requestWhatsappFields = document.getElementById("request-whatsapp-fields");
const requestEmailFields = document.getElementById("request-email-fields");
const requestCountry = document.getElementById("request-country");
const requestCountryCode = document.getElementById("request-country-code");
const requestWhatsapp = document.getElementById("request-whatsapp");
const requestEmail = document.getElementById("request-email");

const TOAST_MESSAGES = [
  {
    id: "request-tip",
    title: "Tip rapido",
    message: "Recuerda que puedes pedir una pelicula si no la encuentras en el catalogo.",
    tone: "info",
    action: "request"
  },
  {
    id: "list-tip",
    title: "Mi lista",
    message: "Guarda tus favoritas en Mi lista para encontrarlas mas rapido despues.",
    tone: "accent",
    action: "list"
  },
  {
    id: "search-tip",
    title: "Busca por genero",
    message: "Si no recuerdas el titulo exacto, revisa Generos o usa el buscador.",
    tone: "info",
    action: "search"
  }
];
const TOAST_INITIAL_DELAY_MS = 10 * 1000;
const TOAST_INTERVAL_MS = 5 * 60 * 1000;
const TOAST_CYCLE_PAUSE_MS = 30 * 60 * 1000;

let toastTimeoutId = 0;
let toastMessageIndex = 0;
let notificationsStore = [];

function renderEstadoPagina(mensaje, tipo = "cargando") {
  contenedor.innerHTML = `<div class="estado-pagina estado-${tipo}">${mensaje}</div>`;
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function similitud(a, b) {
  a = normalizar(a);
  b = normalizar(b);

  if (a.includes(b) || b.includes(a)) {
    return true;
  }

  let errores = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      errores++;
    }
  }

  return errores <= 2;
}

function shuffle(array) {
  const copia = [...array];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

function closeMobileMenu() {
  if (!mainNav || !menuToggle) {
    return;
  }

  mainNav.classList.remove("nav-open");
  menuToggle.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function setRequestStatus(message, type = "") {
  if (!requestStatus) {
    return;
  }

  requestStatus.textContent = message;
  requestStatus.className = `request-status ${type}`.trim();
}

function scrollToRequests() {
  if (!requestSection) {
    return;
  }

  requestSection.hidden = false;
  requestSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openNotificationsPanel() {
  if (!notificationsPanel) {
    return;
  }

  notificationsPanel.hidden = false;
}

function closeNotificationsPanel() {
  if (!notificationsPanel) {
    return;
  }

  notificationsPanel.hidden = true;
}

function closeRequestSection() {
  if (!requestSection) {
    return;
  }

  requestSection.hidden = true;
}

function updateRequestContactFields() {
  if (!requestContactType) {
    return;
  }

  const type = requestContactType.value;
  const isWhatsapp = type === "whatsapp";
  const isCorreo = type === "correo";

  if (requestWhatsappFields) {
    requestWhatsappFields.hidden = !isWhatsapp;
  }

  if (requestEmailFields) {
    requestEmailFields.hidden = !isCorreo;
  }

  if (requestCountryCode && requestCountry) {
    requestCountryCode.textContent = requestCountry.value || "+";
  }

  if (requestCountry) {
    requestCountry.required = isWhatsapp;
    if (!isWhatsapp) {
      requestCountry.value = "";
    }
  }

  if (requestWhatsapp) {
    requestWhatsapp.required = isWhatsapp;
    if (!isWhatsapp) {
      requestWhatsapp.value = "";
    }
  }

  if (requestEmail) {
    requestEmail.required = isCorreo;
    if (!isCorreo) {
      requestEmail.value = "";
    }
  }
}

function buildRequestContact() {
  const type = requestContactType?.value || "";

  if (type === "whatsapp") {
    const code = String(requestCountry?.value || "").trim();
    const number = String(requestWhatsapp?.value || "")
      .replace(/[^\d\s-]/g, "")
      .trim();

    if (!code) {
      throw new Error("Selecciona tu pais para poder avisarte por WhatsApp.");
    }

    if (!number) {
      throw new Error("Escribe el numero de WhatsApp para poder avisarte.");
    }

    return `WhatsApp: ${code} ${number}`.trim();
  }

  if (type === "correo") {
    const email = String(requestEmail?.value || "").trim();

    if (!email) {
      throw new Error("Escribe el correo para poder avisarte.");
    }

    return `Correo: ${email}`;
  }

  return "";
}

function dismissToast(toast, notification) {
  if (!toast) {
    return;
  }

  if (notification && !toast.dataset.archived) {
    archiveNotification(notification);
    toast.dataset.archived = "true";
  }

  toast.classList.add("is-leaving");
  window.setTimeout(() => {
    toast.remove();
  }, 260);
}

function runNotificationAction(action) {
  if (action === "request") {
    scrollToRequests();
    return;
  }

  if (action === "list") {
    window.location.href = "milista/";
    return;
  }

  if (action === "search") {
    searchInput?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function updateNotificationsCount() {
  if (!notificationsCount) {
    return;
  }

  const total = notificationsStore.length;
  notificationsCount.textContent = String(total);
  notificationsCount.hidden = total === 0;
}

function renderNotificationsPanel() {
  if (!notificationsList) {
    return;
  }

  notificationsList.innerHTML = "";

  notificationsStore.forEach(item => {
    const card = document.createElement("article");
    card.className = `notification-card notification-${item.tone}`;
    card.innerHTML = `
      <button type="button" class="notification-delete" aria-label="Eliminar notificacion">×</button>
      <button type="button" class="notification-open">
        <span class="notification-dot"></span>
        <div class="notification-copy">
          <strong>${item.title}</strong>
          <p>${item.message}</p>
        </div>
      </button>
    `;

    const openButton = card.querySelector(".notification-open");
    const deleteButton = card.querySelector(".notification-delete");

    openButton?.addEventListener("click", () => {
      closeNotificationsPanel();
      runNotificationAction(item.action);
    });

    deleteButton?.addEventListener("click", () => {
      notificationsStore = notificationsStore.filter(entry => entry.id !== item.id);
      updateNotificationsCount();
      renderNotificationsPanel();
    });

    notificationsList.appendChild(card);
  });
}

function archiveNotification(notification) {
  if (!notification || !notification.id) {
    return;
  }

  if (notificationsStore.some(item => item.id === notification.id)) {
    return;
  }

  notificationsStore = [notification, ...notificationsStore];
  updateNotificationsCount();
  renderNotificationsPanel();
}

function addNotification(notification) {
  return {
    id: notification.id || `notification-${Date.now()}`,
    title: notification.title,
    message: notification.message,
    tone: notification.tone || "info",
    action: notification.action || ""
  };
}

function showToast(notification) {
  if (!toastStack || !notification) {
    return;
  }

  const { title, message, tone = "info", action = "" } = notification;
  const toast = document.createElement("article");
  toast.className = `toast-item toast-${tone}`;
  toast.innerHTML = `
    <div class="toast-icon" aria-hidden="true">✓</div>
    <button type="button" class="toast-body">
      <strong>${title}</strong>
      <p>${message}</p>
      <span class="toast-progress"></span>
    </button>
    <button type="button" class="toast-close" aria-label="Cerrar aviso">×</button>
  `;

  const closeButton = toast.querySelector(".toast-close");
  const bodyButton = toast.querySelector(".toast-body");
  closeButton?.addEventListener("click", () => dismissToast(toast, notification));
  bodyButton?.addEventListener("click", () => {
    dismissToast(toast, notification);
    closeNotificationsPanel();
    runNotificationAction(action);
  });

  toastStack.appendChild(toast);

  window.setTimeout(() => {
    dismissToast(toast, notification);
  }, 9000);
}

function queueNextToast(initialDelay = TOAST_INTERVAL_MS) {
  if (!toastStack) {
    return;
  }

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    const nextNotification = addNotification(TOAST_MESSAGES[toastMessageIndex]);
    showToast(nextNotification);
    toastMessageIndex += 1;

    if (toastMessageIndex >= TOAST_MESSAGES.length) {
      toastMessageIndex = 0;
      queueNextToast(TOAST_CYCLE_PAUSE_MS);
      return;
    }

    queueNextToast(TOAST_INTERVAL_MS);
  }, initialDelay);
}

function toggleMobileMenu() {
  if (!mainNav || !menuToggle) {
    return;
  }

  const willOpen = !mainNav.classList.contains("nav-open");
  mainNav.classList.toggle("nav-open", willOpen);
  menuToggle.classList.toggle("is-open", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
}

function crearCard(peli, index = 0, tipo = "default") {
  const card = document.createElement("div");
  card.className = "card";

  if (tipo === "default") {
    card.classList.add(`card-variant-${index % 4}`);

    if (index % 5 === 0) {
      card.classList.add("card-anchor");
    }
  }

  card.innerHTML = `
    <img src="${window.pelisData.resolveAssetUrl(peli.imagen)}" alt="${peli.titulo}" draggable="false" loading="lazy" decoding="async">
    <span>${peli.titulo}</span>
  `;

  card.onclick = () => {
    window.location.href = `ver/pelicula.html?id=${peli.id}`;
  };

  return card;
}

function smoothScroll(element, distance, duration = 650) {
  const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
  const start = element.scrollLeft;
  const target = Math.max(0, Math.min(maxScroll, start + distance));

  if (Math.abs(target - start) < 2) {
    return;
  }

  if (element._scrollAnimationFrame) {
    cancelAnimationFrame(element._scrollAnimationFrame);
  }

  const startTime = performance.now();
  element.classList.add("is-animating");

  function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 4);
    element.scrollLeft = start + (target - start) * ease;

    if (progress < 1) {
      element._scrollAnimationFrame = requestAnimationFrame(animate);
      return;
    }

    element.scrollLeft = target;
    element.classList.remove("is-animating");
    element._scrollAnimationFrame = null;
  }

  element._scrollAnimationFrame = requestAnimationFrame(animate);
}

function setupArrowState(carrusel, btnIzq, btnDer) {
  const sync = () => {
    const maxScroll = carrusel.scrollWidth - carrusel.clientWidth - 2;
    btnIzq.disabled = carrusel.scrollLeft <= 2;
    btnDer.disabled = carrusel.scrollLeft >= maxScroll;
  };

  carrusel.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  requestAnimationFrame(sync);
}

function crearCarrusel(titulo, peliculas, tipo = "default") {
  if (!peliculas.length) {
    return;
  }

  const section = document.createElement("div");
  section.className = `categoria categoria-${tipo}`;

  section.innerHTML = `
    <div class="categoria-head">
      <h2>${titulo}</h2>
    </div>
    <div class="carrusel-container">
      <button class="flecha izquierda">&#8249;</button>
      <div class="carrusel"></div>
      <button class="flecha derecha">&#8250;</button>
    </div>
  `;

  const carrusel = section.querySelector(".carrusel");
  const btnIzq = section.querySelector(".izquierda");
  const btnDer = section.querySelector(".derecha");

  const scrollAmount = () => carrusel.clientWidth * 0.82;

  btnIzq.onclick = () => smoothScroll(carrusel, -scrollAmount());
  btnDer.onclick = () => smoothScroll(carrusel, scrollAmount());
  setupArrowState(carrusel, btnIzq, btnDer);

  carrusel.addEventListener("wheel", event => {
    if (!event.shiftKey) {
      return;
    }

    event.preventDefault();
    carrusel.scrollLeft += event.deltaY + event.deltaX;
  }, { passive: false });

  peliculas.forEach((peli, index) => {
    carrusel.appendChild(crearCard(peli, index, tipo));
  });

  contenedor.appendChild(section);
}

function esTerrorAdulto(peli) {
  const categorias = peli.categoria || [];
  const tieneTerror = categorias.includes("Terror") || categorias.includes("Suspenso");
  const esFamiliar = categorias.includes("Familia");
  const esAnimada = categorias.includes("Animacion") || categorias.includes("Animación");

  return tieneTerror && !esFamiliar && !esAnimada;
}

function obtenerSeccionesInicio(lista) {
  const limitePorFila = 8;
  const usadas = new Set();
  const secciones = [];
  const reglas = [
    {
      titulo: "Lo mas nuevo",
      tipo: "featured",
      filtro: () => true
    },
    {
      titulo: "Terror para maraton",
      tipo: "default",
      filtro: peli => esTerrorAdulto(peli)
    },
    {
      titulo: "Para ver en familia",
      tipo: "default",
      filtro: peli =>
        (peli.categoria || []).includes("Familia") ||
        (peli.categoria || []).includes("Animacion") ||
        (peli.categoria || []).includes("Animación")
    },
    {
      titulo: "Aventuras que enganchan",
      tipo: "default",
      filtro: peli =>
        (peli.categoria || []).includes("Aventura") ||
        (peli.categoria || []).includes("Accion") ||
        (peli.categoria || []).includes("Acción")
    },
    {
      titulo: "Mundos raros",
      tipo: "default",
      filtro: peli =>
        (peli.categoria || []).includes("Fantasia") ||
        (peli.categoria || []).includes("Fantasía") ||
        (peli.categoria || []).includes("Animacion") ||
        (peli.categoria || []).includes("Animación")
    }
  ];

  const agregarSeccion = (titulo, peliculas, tipo) => {
    const disponibles = peliculas.filter(peli => !usadas.has(peli.id));
    let filtradas = shuffle(disponibles).slice(0, limitePorFila);

    if (filtradas.length < Math.min(limitePorFila, peliculas.length)) {
      const respaldo = shuffle(
        peliculas.filter(peli => !filtradas.some(item => item.id === peli.id))
      ).slice(0, limitePorFila - filtradas.length);

      filtradas = [...filtradas, ...respaldo];
    }

    if (!filtradas.length) {
      return;
    }

    filtradas.forEach(peli => usadas.add(peli.id));
    secciones.push({ titulo, peliculas: filtradas, tipo });
  };

  reglas.forEach(regla => {
    agregarSeccion(regla.titulo, lista.filter(regla.filtro), regla.tipo);
  });

  if (secciones.length < 4) {
    agregarSeccion("Mas para ver", lista, "default");
  }

  return secciones.slice(0, 5);
}

function crearUI(lista) {
  contenedor.innerHTML = "";

  if (!lista.length) {
    renderEstadoPagina("Todavia no hay peliculas para mostrar aqui.", "error");
    return;
  }

  const secciones = obtenerSeccionesInicio(lista);

  if (!secciones.length) {
    renderEstadoPagina("Todavia no hay secciones para mostrar aqui.", "error");
    return;
  }

  secciones.forEach(seccion => {
    crearCarrusel(seccion.titulo, seccion.peliculas, seccion.tipo);
  });
}

function inicializarBusqueda(data) {
  searchInput.addEventListener("input", event => {
    const valor = event.target.value.trim();

    if (valor === "") {
      searchResults.style.display = "none";
      searchResults.innerHTML = "";
      return;
    }

    const resultados = data.filter(peli => {
      const coincideTitulo = similitud(peli.titulo, valor);
      const coincideGenero = (peli.categoria || []).some(cat => similitud(cat, valor));
      return coincideTitulo || coincideGenero;
    });

    searchResults.innerHTML = "";

    resultados.slice(0, 6).forEach(peli => {
      const item = document.createElement("div");
      item.className = "search-item";

      item.innerHTML = `
        <img src="${window.pelisData.resolveAssetUrl(peli.imagen)}" alt="${peli.titulo}" loading="lazy" decoding="async">
        <span>${peli.titulo}</span>
      `;

      item.onclick = () => {
        window.location.href = `ver/pelicula.html?id=${peli.id}`;
      };

      searchResults.appendChild(item);
    });

    searchResults.style.display = resultados.length ? "block" : "none";
  });
}

function inicializarGeneros(data) {
  const generosUnicos = new Set();

  data.forEach(peli => {
    (peli.categoria || []).forEach(cat => generosUnicos.add(cat));
  });

  const listaGeneros = [...generosUnicos].sort((a, b) => a.localeCompare(b, "es"));

  listaGeneros.forEach(gen => {
    const item = document.createElement("span");
    item.textContent = gen;

    item.onclick = () => {
      window.location.href = `generos/?categoria=${encodeURIComponent(gen)}`;
      menuGeneros.style.display = "none";
    };

    menuGeneros.appendChild(item);
  });
}

function inicializarHero(data) {
  let currentBg = 1;
  let index = 0;
  let ultimaCategoria = null;
  let listaMezclada = shuffle(data);

  function getRandomMovie() {
    if (index >= listaMezclada.length) {
      listaMezclada = shuffle(data);
      index = 0;
    }

    let peli = listaMezclada[index];

    if (ultimaCategoria && (peli.categoria || []).includes(ultimaCategoria)) {
      const alternativa = listaMezclada
        .slice(index + 1)
        .find(item => !(item.categoria || []).includes(ultimaCategoria));

      if (alternativa) {
        const altIndex = listaMezclada.indexOf(alternativa);
        [listaMezclada[index], listaMezclada[altIndex]] = [listaMezclada[altIndex], listaMezclada[index]];
        peli = listaMezclada[index];
      }
    }

    ultimaCategoria = (peli.categoria || [])[0] || null;
    index++;
    return peli;
  }

  function cambiarHero(peli) {
    const bg1 = document.getElementById("bg1");
    const bg2 = document.getElementById("bg2");
    const next = currentBg === 1 ? bg2 : bg1;
    const current = currentBg === 1 ? bg1 : bg2;

    next.style.backgroundImage = `url(${window.pelisData.resolveAssetUrl(peli.banner || peli.imagen)})`;
    next.style.opacity = 1;
    current.style.opacity = 0;
    currentBg = currentBg === 1 ? 2 : 1;

    heroTitle.innerText = peli.titulo;
    heroDesc.innerText = peli.descripcion;
    heroBtn.innerText = "Ver ahora";
    heroBtn.disabled = false;
    heroBtn.onclick = () => {
      window.location.href = `ver/pelicula.html?id=${peli.id}`;
    };
  }

  cambiarHero(getRandomMovie());
  setInterval(() => cambiarHero(getRandomMovie()), 20000);
}

function inicializarSolicitudes() {
  if (!requestForm) {
    return;
  }

  if (requestContactType) {
    requestContactType.value = "";
  }

  updateRequestContactFields();

  requestContactType?.addEventListener("change", updateRequestContactFields);
  requestCountry?.addEventListener("change", updateRequestContactFields);
  requestClose?.addEventListener("click", closeRequestSection);
  notificationsClose?.addEventListener("click", closeNotificationsPanel);

  requestForm.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(requestForm);
    const titulo = String(formData.get("titulo") || "").trim();
    const detalle = String(formData.get("detalle") || "").trim();

    if (!titulo) {
      setRequestStatus("Escribe el titulo de la pelicula que quieres pedir.", "error");
      return;
    }

    requestSubmit.disabled = true;
    setRequestStatus("Enviando solicitud...", "loading");

    try {
      const client = window.supabasePublic;

      if (!client) {
        throw new Error("No se pudo conectar con la base de datos.");
      }

      const contacto = buildRequestContact();

      const { error } = await client
        .from("movie_requests")
        .insert({
          titulo,
          contacto: contacto || null,
          detalle: detalle || null
        });

      if (error) {
        throw error;
      }

      requestForm.reset();
      updateRequestContactFields();
      setRequestStatus("Solicitud enviada. Cuando la agreguen al catalogo, podran avisarte si dejaste contacto.", "ok");
      const requestNotification = addNotification({
        id: `request-sent-${Date.now()}`,
        title: "Solicitud enviada",
        message: "Tu pedido ya llego al panel. Si dejaste contacto, podran avisarte cuando este lista.",
        tone: "success",
        action: "request"
      });
      showToast(requestNotification);
      closeRequestSection();
    } catch (error) {
      setRequestStatus(
        error.message || "No se pudo enviar la solicitud en este momento.",
        "error"
      );
    } finally {
      requestSubmit.disabled = false;
    }
  });
}

function inicializarNavegacion(data) {
  btnInicio.addEventListener("click", event => {
    event.preventDefault();
    searchInput.value = "";
    searchResults.style.display = "none";
    searchResults.innerHTML = "";
    crearUI(data);
    closeMobileMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  btnLogo.addEventListener("click", () => {
    window.location.reload();
  });

  btnPeliculas.addEventListener("click", event => {
    event.preventDefault();
    closeMobileMenu();
    window.location.href = "peliculas/";
  });

  if (btnSolicitar) {
    btnSolicitar.addEventListener("click", event => {
      event.preventDefault();
      closeMobileMenu();
      scrollToRequests();
    });
  }

  btnNotificaciones?.addEventListener("click", event => {
    event.preventDefault();
    const willOpen = notificationsPanel?.hidden;
    closeMobileMenu();

    if (willOpen) {
      openNotificationsPanel();
      return;
    }

    closeNotificationsPanel();
  });

  btnGeneros.addEventListener("click", event => {
    event.preventDefault();
    menuGeneros.style.display = menuGeneros.style.display === "grid" ? "none" : "grid";
  });

  if (menuToggle) {
    menuToggle.addEventListener("click", event => {
      event.stopPropagation();
      toggleMobileMenu();
    });
  }

  mainNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768 && link.id !== "btn-generos") {
        closeMobileMenu();
      }
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".dropdown")) {
      menuGeneros.style.display = "none";
    }

    if (
      notificationsPanel &&
      !event.target.closest("#notifications-panel") &&
      !event.target.closest("#btn-notificaciones")
    ) {
      closeNotificationsPanel();
    }

    if (!event.target.closest(".header-left")) {
      closeMobileMenu();
    }

    if (!event.target.closest(".search-box")) {
      searchResults.style.display = "none";
    }
  });
}

async function init() {
  renderEstadoPagina("Cargando catalogo...", "cargando");
  inicializarSolicitudes();
  notificationsStore = [];
  updateNotificationsCount();
  renderNotificationsPanel();

  try {
    const data = await window.pelisData.fetchMoviesFromSupabase();

    if (!Array.isArray(data) || !data.length) {
      throw new Error("No hay peliculas disponibles para mostrar.");
    }

    inicializarHero(data);
    inicializarGeneros(data);
    inicializarBusqueda(data);
    inicializarNavegacion(data);
    crearUI(data);
    queueNextToast(TOAST_INITIAL_DELAY_MS);
  } catch (error) {
    heroTitle.innerText = "No pudimos cargar Pelis+";
    heroDesc.innerText = error.message || "Intenta recargar la pagina.";
    heroBtn.innerText = "Intentar de nuevo";
    heroBtn.disabled = false;
    heroBtn.onclick = () => window.location.reload();
    renderEstadoPagina("No pudimos cargar el catalogo. Recarga la pagina para intentarlo otra vez.", "error");
  }
}

init();
