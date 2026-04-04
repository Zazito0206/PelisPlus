const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const bg = document.getElementById("bg");
const poster = document.getElementById("poster");
const frase = document.getElementById("frase");
const titulo = document.getElementById("titulo");
const desc = document.getElementById("desc");
const meta = document.getElementById("meta");
const etiquetas = document.getElementById("etiquetas");
const video = document.getElementById("video");
const playerFrame = document.getElementById("player-frame");
const estado = document.getElementById("detalle-estado");
const playerContainer = document.getElementById("player-container");
const relacionadas = document.getElementById("relacionadas");
const btnLista = document.getElementById("btn-lista");

const LISTA_KEY = "pelisplus-mi-lista";
const RECIENTES_KEY = "pelisplus-recientes";
const PROVEEDORES_PERMITIDOS = new Set(["vimeus.com", "www.vimeus.com"]);

function leerStorage(key) {
  try {
    const valor = JSON.parse(localStorage.getItem(key));
    return Array.isArray(valor) ? valor : [];
  } catch {
    return [];
  }
}

function guardarStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setEstado(mensaje, tipo = "cargando") {
  estado.textContent = mensaje;
  estado.className = `estado-detalle estado-${tipo}`;
  estado.classList.remove("oculto");
}

function ocultarEstado() {
  estado.classList.add("oculto");
}

function crearChip(texto) {
  const chip = document.createElement("span");
  chip.textContent = texto;
  return chip;
}

function esUrlExterna(ruta) {
  return /^https?:\/\//i.test(ruta || "");
}

function esProveedorPermitido(ruta) {
  if (!esUrlExterna(ruta)) {
    return true;
  }

  try {
    const url = new URL(ruta);
    return PROVEEDORES_PERMITIDOS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function actualizarBotonLista(movieId) {
  const miLista = leerStorage(LISTA_KEY);
  const estaGuardada = miLista.includes(movieId);

  btnLista.textContent = estaGuardada ? "Quitar de mi lista" : "Guardar en mi lista";
  btnLista.dataset.active = estaGuardada ? "true" : "false";
  btnLista.dataset.movieId = movieId;
}

function alternarMiLista() {
  const movieId = btnLista.dataset.movieId;

  if (!movieId) {
    return;
  }

  const miLista = leerStorage(LISTA_KEY);
  const existe = miLista.includes(movieId);
  const siguienteLista = existe
    ? miLista.filter(item => item !== movieId)
    : [...miLista, movieId];

  guardarStorage(LISTA_KEY, siguienteLista);
  actualizarBotonLista(movieId);
}

function registrarReciente(movieId) {
  const recientes = leerStorage(RECIENTES_KEY).filter(item => item !== movieId);
  recientes.unshift(movieId);
  guardarStorage(RECIENTES_KEY, recientes.slice(0, 8));
}

function puntuarRelacion(base, otra) {
  const categoriasBase = new Set(base.categoria || []);
  const etiquetasBase = new Set(base.etiquetas || []);

  let score = 0;

  (otra.categoria || []).forEach(cat => {
    if (categoriasBase.has(cat)) {
      score += 3;
    }
  });

  (otra.etiquetas || []).forEach(tag => {
    if (etiquetasBase.has(tag)) {
      score += 1;
    }
  });

  return score;
}

function renderRelacionadas(base, data) {
  const lista = data
    .filter(peli => peli.id !== base.id)
    .map(peli => ({
      ...peli,
      score: puntuarRelacion(base, peli)
    }))
    .sort((a, b) => b.score - a.score || a.titulo.localeCompare(b.titulo, "es"))
    .slice(0, 4);

  relacionadas.innerHTML = "";

  if (!lista.length) {
    relacionadas.innerHTML = `
      <div class="relacionada-vacia">
        No encontramos titulos relacionados por ahora.
      </div>
    `;
    return;
  }

  lista.forEach(peli => {
    const card = document.createElement("a");
    card.className = "relacionada-card";
    card.href = `pelicula.html?id=${peli.id}`;

    card.innerHTML = `
      <img src="${window.pelisData.resolveAssetUrl(peli.imagen, "../")}" alt="${peli.titulo}">
      <div class="relacionada-info">
        <p class="relacionada-tag">${(peli.categoria || [])[0] || "Pelicula"}</p>
        <h3>${peli.titulo}</h3>
        <p>${peli.frase || peli.descripcion}</p>
      </div>
    `;

    relacionadas.appendChild(card);
  });
}

function renderMeta(peli) {
  meta.innerHTML = "";
  etiquetas.innerHTML = "";

  ["HD", ...(peli.categoria || [])].forEach(item => {
    meta.appendChild(crearChip(item));
  });

  (peli.etiquetas || []).forEach(item => {
    etiquetas.appendChild(crearChip(item));
  });
}

function renderPelicula(peli, data) {
  document.title = `${peli.titulo} | Pelis+`;

  if (!esProveedorPermitido(peli.archivo)) {
    throw new Error("El reproductor de esta pelicula fue bloqueado por seguridad.");
  }

  frase.textContent = peli.frase || "Tu proxima pelicula ya esta lista";
  titulo.textContent = peli.titulo;
  desc.textContent = peli.descripcion;

  poster.src = window.pelisData.resolveAssetUrl(peli.imagen, "../");
  poster.alt = `Poster de ${peli.titulo}`;

  bg.style.backgroundImage = `url(${window.pelisData.resolveAssetUrl(peli.banner || peli.imagen, "../")})`;

  renderMeta(peli);
  renderRelacionadas(peli, data);
  actualizarBotonLista(peli.id);
  registrarReciente(peli.id);

  if (esUrlExterna(peli.archivo)) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.classList.add("oculto");

    playerFrame.src = peli.archivo;
    playerFrame.classList.remove("oculto");
    setEstado("Preparando reproduccion externa...", "cargando");
  } else {
    playerFrame.src = "";
    playerFrame.classList.add("oculto");

    video.src = window.pelisData.resolveAssetUrl(peli.archivo, "../");
    video.removeAttribute("poster");
    video.classList.remove("oculto");
    setEstado("Preparando reproduccion...", "cargando");
  }

  playerContainer.classList.remove("oculto");
}

function renderError(mensaje) {
  document.title = "Pelicula no disponible | Pelis+";
  frase.textContent = "Algo salio mal";
  titulo.textContent = "No pudimos abrir esta pelicula";
  desc.textContent = mensaje;
  meta.innerHTML = "";
  etiquetas.innerHTML = "";
  relacionadas.innerHTML = `
    <div class="relacionada-vacia">
      Vuelve al inicio y elige otra pelicula para continuar viendo.
    </div>
  `;
  poster.removeAttribute("src");
  poster.alt = "Pelicula no disponible";
  bg.style.backgroundImage = "";
  playerContainer.classList.add("oculto");
  playerFrame.src = "";
  btnLista.disabled = true;
  btnLista.textContent = "Mi lista";
  setEstado(mensaje, "error");
}

btnLista.addEventListener("click", alternarMiLista);

video.addEventListener("loadeddata", () => {
  ocultarEstado();
});

video.addEventListener("error", () => {
  setEstado("No se pudo cargar el video de esta pelicula.", "error");
});

playerFrame.addEventListener("load", () => {
  ocultarEstado();
});

async function initDetalle() {
  setEstado("Cargando pelicula...", "cargando");

  try {
    const data = await window.pelisData.fetchMoviesFromSupabase();

    if (!id) {
      throw new Error("El enlace de esta pelicula no es valido.");
    }

    const peli = data.find(item => item.id === id);

    if (!peli) {
      throw new Error("Esta pelicula ya no esta disponible o fue movida.");
    }

    renderPelicula(peli, data);
  } catch (error) {
    renderError(error.message || "Ocurrio un problema inesperado.");
  }
}

initDetalle();
