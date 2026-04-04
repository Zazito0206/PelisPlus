const contenedor = document.getElementById("contenedor");
const searchInput = document.querySelector(".search");
const searchResults = document.querySelector(".search-results");
const btnLogo = document.getElementById("btn-logo");
const btnGeneros = document.getElementById("btn-generos");
const menuGeneros = document.getElementById("menu-generos");
const btnInicio = document.getElementById("btn-inicio");
const btnPeliculas = document.getElementById("btn-peliculas");
const heroTitle = document.getElementById("hero-title");
const heroDesc = document.getElementById("hero-desc");
const heroBtn = document.getElementById("hero-btn");
const menuToggle = document.getElementById("menu-toggle");
const mainNav = document.getElementById("main-nav");

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

function toggleMobileMenu() {
  if (!mainNav || !menuToggle) {
    return;
  }

  const willOpen = !mainNav.classList.contains("nav-open");
  mainNav.classList.toggle("nav-open", willOpen);
  menuToggle.classList.toggle("is-open", willOpen);
  menuToggle.setAttribute("aria-expanded", String(willOpen));
}

function crearCard(peli) {
  const card = document.createElement("div");
  card.className = "card";

  card.innerHTML = `
    <img src="${window.pelisData.resolveAssetUrl(peli.imagen)}" alt="${peli.titulo}" draggable="false">
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

  peliculas.forEach(peli => {
    carrusel.appendChild(crearCard(peli));
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
  const limitePorFila = 12;
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
      tipo: "spotlight",
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
        <img src="${window.pelisData.resolveAssetUrl(peli.imagen)}" alt="${peli.titulo}">
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
  setInterval(() => cambiarHero(getRandomMovie()), 7000);
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
