const form = document.getElementById("movie-form");
const estado = document.getElementById("estado");
const listaPeliculas = document.getElementById("lista-peliculas");
const listaSolicitudes = document.getElementById("lista-solicitudes");
const buscador = document.getElementById("buscador");
const btnLimpiar = document.getElementById("btn-limpiar");
const btnRecargar = document.getElementById("btn-recargar");
const btnLogout = document.getElementById("btn-logout");
const btnSolicitudes = document.getElementById("btn-solicitudes");
const heroRequestCountBadge = document.getElementById("hero-request-count-badge");
const formCard = document.querySelector(".form-card");
const listCard = document.querySelector(".list-card");
const listTitle = document.getElementById("list-title");
const searchLabel = document.getElementById("search-label");
const requestCountBadge = document.getElementById("request-count-badge");
const panelTabs = Array.from(document.querySelectorAll(".panel-tab"));
const btnBuscarTodo = document.getElementById("btn-buscar-todo");
const btnClearPoster = document.getElementById("btn-clear-poster");
const btnClearBanner = document.getElementById("btn-clear-banner");
const btnGenerarVimeus = document.getElementById("btn-generar-vimeus");
const btnUsarVimeus = document.getElementById("btn-usar-vimeus");
const cuevanaSource = document.getElementById("cuevana-source");
const vimeusTmdb = document.getElementById("vimeus-tmdb");
const vimeusPreview = document.getElementById("vimeus-preview");
const posterStatus = document.getElementById("poster-status");
const bannerStatus = document.getElementById("banner-status");
const posterPreviewWrap = document.getElementById("poster-preview-wrap");
const posterPreview = document.getElementById("poster-preview");
const bannerPreviewWrap = document.getElementById("banner-preview-wrap");
const bannerPreview = document.getElementById("banner-preview");
const sessionModal = document.getElementById("session-modal");
const deleteRequestModal = document.getElementById("delete-request-modal");
const deleteRequestTitle = document.getElementById("delete-request-title");
const btnDeleteRequestConfirm = document.getElementById("btn-delete-request-confirm");
const btnDeleteRequestCancel = document.getElementById("btn-delete-request-cancel");
const sessionCountdown = document.getElementById("session-countdown");
const sessionPill = document.getElementById("session-pill");
const sessionPillTime = document.getElementById("session-pill-time");
const btnExtend5 = document.getElementById("btn-extend-5");
const btnExtend10 = document.getElementById("btn-extend-10");
const btnSessionClose = document.getElementById("btn-session-close");
const imagenFileInput = document.getElementById("imagenFile");
const bannerFileInput = document.getElementById("bannerFile");
const supabaseClient = window.supabaseAdmin;

let catalogo = [];
let solicitudes = [];
let currentView = "catalogo";
let sessionExpiresAt = 0;
let sessionTick = null;
let warningVisible = false;
let pendingRequestDelete = null;
let imagenSourceUrl = "";
let bannerSourceUrl = "";
let cuevanaPageUrl = "";
let vimeusGeneratedUrl = "";
let heightSyncFrame = 0;

const STORAGE_BUCKET = "movie-assets";
const VIMEUS_DEFAULTS = {
  viewKey: "GVW7Je4obF9FT749y4y5MdUAQOVh-j4BhH05eZNGCdE",
  title: "PELIS",
  theme: "blue",
  font: "v3",
  overlay: "v2"
};

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFileExtension(filename) {
  const dotIndex = String(filename || "").lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function valueOf(name) {
  return form.elements[name].value.trim();
}

function setEstado(message, type = "") {
  estado.textContent = message;
  estado.className = `estado ${type}`.trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(fallbackMessage);
  }
}

function normalizeMovies(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id || "",
    titulo: row.titulo || "",
    archivo: row.archivo || "",
    imagen: row.imagen || "",
    banner: row.banner || "",
    categoria: Array.isArray(row.categoria) ? row.categoria : [],
    descripcion: row.descripcion || ""
  }));
}

function normalizeRequests(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    id: row.id || "",
    titulo: row.titulo || "",
    contacto: row.contacto || "",
    detalle: row.detalle || "",
    estado: row.estado || "pendiente",
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  }));
}

function resetFileInputs() {
  imagenFileInput.value = "";
  bannerFileInput.value = "";
}

function resetAutoAssets() {
  imagenSourceUrl = "";
  bannerSourceUrl = "";
  cuevanaPageUrl = "";
  posterPreviewWrap.classList.add("oculto");
  bannerPreviewWrap.classList.add("oculto");
  posterPreview.removeAttribute("src");
  bannerPreview.removeAttribute("src");
  posterPreview.removeAttribute("alt");
  bannerPreview.removeAttribute("alt");
  cuevanaSource.value = "";
  posterStatus.textContent = "Escribe el titulo y usa el boton para traer la portada.";
  bannerStatus.textContent = "Usa el mismo titulo para intentar traer un banner panoramico.";
}

function clearPosterAuto() {
  imagenSourceUrl = "";
  form.elements.imagen.value = "";
  imagenFileInput.value = "";
  posterPreviewWrap.classList.add("oculto");
  posterPreview.removeAttribute("src");
  posterPreview.removeAttribute("alt");
  posterStatus.textContent = "Portada automatica quitada. Puedes subir una manual.";
}

function clearBannerAuto() {
  bannerSourceUrl = "";
  form.elements.banner.value = "";
  bannerFileInput.value = "";
  bannerPreviewWrap.classList.add("oculto");
  bannerPreview.removeAttribute("src");
  bannerPreview.removeAttribute("alt");
  bannerStatus.textContent = "Banner automatico quitado. Puedes subir uno manual.";
}

function resetVimeusGenerator() {
  vimeusGeneratedUrl = "";
  vimeusTmdb.value = "";
  vimeusPreview.value = "";
  form.elements.archivo.value = "";
  form.elements.archivo.readOnly = false;
  btnUsarVimeus.disabled = true;
}

function refreshAssetPaths() {
  const id = form.elements.id.value.trim() || slugify(form.elements.titulo.value);
  const imagenFile = imagenFileInput.files && imagenFileInput.files[0];
  const bannerFile = bannerFileInput.files && bannerFileInput.files[0];

  if (id && imagenFile) {
    form.elements.imagen.value = `${STORAGE_BUCKET}/${id}/portada${getFileExtension(imagenFile.name)}`;
  }

  if (id && bannerFile) {
    form.elements.banner.value = `${STORAGE_BUCKET}/${id}/banner${getFileExtension(bannerFile.name)}`;
  }
}

function syncCatalogHeight() {
  if (!formCard || !listCard) {
    return;
  }

  if (window.innerWidth <= 980) {
    listCard.style.height = "";
    return;
  }

  const nextHeight = Math.ceil(formCard.getBoundingClientRect().height);
  listCard.style.height = `${nextHeight}px`;
}

function queueCatalogHeightSync() {
  if (heightSyncFrame) {
    cancelAnimationFrame(heightSyncFrame);
  }

  heightSyncFrame = window.requestAnimationFrame(() => {
    heightSyncFrame = 0;
    syncCatalogHeight();
  });
}

function formatRequestDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-SV", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getRequestStatusLabel(status) {
  return status === "agregada" ? "Agregada" : "Pendiente";
}

function updateRequestBadge() {
  const pendientes = solicitudes.filter(item => item.estado !== "agregada").length;
  const total = String(pendientes);

  if (requestCountBadge) {
    requestCountBadge.textContent = total;
  }

  if (heroRequestCountBadge) {
    heroRequestCountBadge.textContent = total;
    heroRequestCountBadge.classList.toggle("is-empty", pendientes === 0);
  }
}

function setActiveView(view) {
  currentView = view === "solicitudes" ? "solicitudes" : "catalogo";
  const isRequestsView = currentView === "solicitudes";

  listaPeliculas.classList.toggle("oculto", isRequestsView);
  listaSolicitudes.classList.toggle("oculto", !isRequestsView);
  listTitle.textContent = isRequestsView ? "Solicitudes de peliculas" : "Catalogo actual";
  searchLabel.textContent = isRequestsView ? "Buscar solicitud" : "Buscar";
  buscador.placeholder = isRequestsView
    ? "Titulo, contacto o estado"
    : "Titulo o categoria";

  panelTabs.forEach(button => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });

  if (isRequestsView) {
    filterRequests();
  } else {
    filterCatalog();
  }

  queueCatalogHeightSync();
}

function fillForm(movie) {
  resetFileInputs();
  resetAutoAssets();
  resetVimeusGenerator();
  form.elements.id.dataset.manual = "true";
  form.elements.id.value = movie.id || "";
  form.elements.titulo.value = movie.titulo || "";
  form.elements.archivo.value = movie.archivo || "";
  form.elements.imagen.value = movie.imagen || "";
  form.elements.banner.value = movie.banner || "";
  form.elements.categoria.value = (movie.categoria || []).join(", ");
  form.elements.descripcion.value = movie.descripcion || "";
  queueCatalogHeightSync();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearForm() {
  form.reset();
  resetFileInputs();
  resetAutoAssets();
  resetVimeusGenerator();
  form.elements.titulo.value = "";
  form.elements.id.value = "";
  form.elements.id.dataset.manual = "";
  form.elements.categoria.value = "";
  form.elements.descripcion.value = "";
  form.elements.imagen.value = "";
  form.elements.banner.value = "";
  form.elements.archivo.value = "";
  form.elements.archivo.readOnly = false;
  queueCatalogHeightSync();
  setEstado("Formulario limpio.");
}

async function logout() {
  try {
    await supabaseClient.auth.signOut();
    await fetch("/api/logout", { method: "POST" });
  } finally {
    window.location.href = "/admin/login/";
  }
}

function hideSessionWarning() {
  warningVisible = false;
  sessionModal.classList.add("oculto");
}

function openDeleteRequestModal(request) {
  pendingRequestDelete = request || null;

  if (deleteRequestTitle) {
    deleteRequestTitle.textContent = request?.titulo
      ? `Eliminar la solicitud de "${request.titulo}"?`
      : "Quieres eliminar esta solicitud?";
  }

  deleteRequestModal?.classList.remove("oculto");
}

function closeDeleteRequestModal() {
  pendingRequestDelete = null;
  deleteRequestModal?.classList.add("oculto");
}

function showSessionWarning(seconds) {
  warningVisible = true;
  sessionCountdown.textContent = String(seconds);
  sessionModal.classList.remove("oculto");
}

function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateSessionPill(remainingMs) {
  sessionPillTime.textContent = formatRemainingTime(remainingMs);
  sessionPill.classList.remove("warning", "danger");

  if (remainingMs <= 10 * 1000) {
    sessionPill.classList.add("danger");
  } else if (remainingMs <= 60 * 1000) {
    sessionPill.classList.add("warning");
  }
}

async function refreshSessionStatus() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Debes iniciar sesion.");
  }

  const expiresAt = Number(data.session.expires_at || 0) * 1000;
  sessionExpiresAt = expiresAt;

  return {
    authenticated: true,
    expiresAt,
    remainingMs: Math.max(0, expiresAt - Date.now())
  };
}

function startSessionWatcher() {
  if (sessionTick) {
    clearInterval(sessionTick);
  }

  sessionTick = setInterval(async () => {
    const remainingMs = sessionExpiresAt - Date.now();
    updateSessionPill(remainingMs);

    if (remainingMs <= 0) {
      clearInterval(sessionTick);
      sessionTick = null;
      await logout();
      return;
    }

    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (remainingSeconds <= 10) {
      showSessionWarning(remainingSeconds);
    } else if (warningVisible) {
      hideSessionWarning();
    }
  }, 1000);
}

async function extendSession(minutes) {
  try {
    const sessionResponse = await fetch("/api/session/extend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes })
    });
    const sessionResult = await readJsonResponse(sessionResponse, "No se pudo extender la sesion.");

    if (!sessionResponse.ok || !sessionResult.ok) {
      throw new Error(sessionResult.error || "No se pudo extender la sesion.");
    }

    let refreshed = null;

    for (let index = 0; index < minutes; index += 1) {
      const { data, error } = await supabaseClient.auth.refreshSession();

      if (error) {
        throw error;
      }

      refreshed = data;
    }

    const expiresAt = Number(refreshed?.session?.expires_at || 0) * 1000;
    sessionExpiresAt = expiresAt;
    updateSessionPill(Math.max(0, expiresAt - Date.now()));
    hideSessionWarning();
    setEstado(`Sesion extendida ${minutes} minutos.`, "ok");
  } catch (error) {
    if (String(error.message || "").includes("Debes iniciar sesion")) {
      await logout();
      return;
    }

    setEstado(error.message || "No se pudo extender la sesion.", "error");
  }
}

function buildImagePath(kind, sourceUrl, title) {
  const urlPath = new URL(sourceUrl).pathname;
  const extension = getFileExtension(urlPath) || ".jpg";
  const id = valueOf("id") || slugify(title);
  return `${STORAGE_BUCKET}/${id}/${kind}${extension}`;
}

function buildStorageObjectPath(movieId, baseName, filename) {
  const extension = getFileExtension(filename) || ".jpg";
  return `${movieId}/${baseName}${extension}`;
}

function extractStorageObjectPath(publicUrl) {
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const normalized = String(publicUrl || "");
  const markerIndex = normalized.indexOf(marker);

  if (markerIndex === -1) {
    return "";
  }

  return normalized.slice(markerIndex + marker.length);
}

async function uploadAssetToSupabase(file, movieId, baseName) {
  if (!file) {
    return "";
  }

  const objectPath = buildStorageObjectPath(movieId, baseName, file.name);
  const { error: uploadError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, file, {
      upsert: true,
      contentType: file.type || undefined
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function resolveAssetUrl({ fileInput, sourceUrl, currentValue, movieId, baseName }) {
  const file = fileInput.files && fileInput.files[0];

  if (file) {
    return uploadAssetToSupabase(file, movieId, baseName);
  }

  if (sourceUrl) {
    return sourceUrl;
  }

  return currentValue || "";
}

async function removeStoredAssets(movie) {
  const paths = [
    extractStorageObjectPath(movie.imagen),
    extractStorageObjectPath(movie.banner)
  ].filter(Boolean);

  if (!paths.length) {
    return;
  }

  await supabaseClient.storage.from(STORAGE_BUCKET).remove(paths);
}

function buildVimeusUrl(tmdbCode) {
  const params = new URLSearchParams({
    tmdb: tmdbCode,
    view_key: VIMEUS_DEFAULTS.viewKey,
    title: VIMEUS_DEFAULTS.title,
    theme: VIMEUS_DEFAULTS.theme,
    font: VIMEUS_DEFAULTS.font,
    overlay: VIMEUS_DEFAULTS.overlay
  });

  return `https://vimeus.com/e/movie?${params.toString()}`;
}

function generateVimeusUrl() {
  const tmdbCode = vimeusTmdb.value.trim();

  if (!/^\d+$/.test(tmdbCode)) {
    vimeusGeneratedUrl = "";
    vimeusPreview.value = "";
    form.elements.archivo.readOnly = false;
    btnUsarVimeus.disabled = true;
    setEstado("Escribe un codigo TMDb valido para generar el enlace.", "error");
    return;
  }

  vimeusGeneratedUrl = buildVimeusUrl(tmdbCode);
  vimeusPreview.value = vimeusGeneratedUrl;
  form.elements.archivo.value = vimeusGeneratedUrl;
  form.elements.archivo.readOnly = true;
  btnUsarVimeus.disabled = false;
  setEstado("Enlace de Vimeus generado.", "ok");
}

function applyVimeusUrl() {
  if (!vimeusGeneratedUrl) {
    setEstado("Primero genera el enlace de Vimeus.", "error");
    return;
  }

  form.elements.archivo.value = vimeusGeneratedUrl;
  setEstado("Enlace de Vimeus aplicado al campo del reproductor.", "ok");
  queueCatalogHeightSync();
}

function applyCuevanaSource(pageUrl) {
  cuevanaPageUrl = pageUrl || "";
  cuevanaSource.value = cuevanaPageUrl;
}

async function buscarTodoCuevana() {
  const titulo = valueOf("titulo");

  if (!titulo) {
    setEstado("Escribe primero el titulo de la pelicula.", "error");
    return;
  }

  setEstado("Buscando portada, banner, categorias y descripcion...");

  try {
    const response = await fetch(`/api/cuevana-data?title=${encodeURIComponent(titulo)}`, {
      cache: "no-store"
    });
    const result = await readJsonResponse(response, "No se pudo buscar la informacion en Cuevana.");

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "No se pudo buscar la informacion en Cuevana.");
    }

    applyCuevanaSource(result.pageUrl || "");

    if (result.poster) {
      imagenSourceUrl = result.poster;
      form.elements.imagen.value = buildImagePath("portada", result.poster, titulo);
      posterPreview.src = result.poster;
      posterPreview.alt = `Portada de ${result.title}`;
      posterPreviewWrap.classList.remove("oculto");
      posterStatus.textContent = "Portada encontrada. Se usara al guardar si no subes una manual.";
    }

    if (result.banner) {
      bannerSourceUrl = result.banner;
      form.elements.banner.value = buildImagePath("banner", result.banner, titulo);
      bannerPreview.src = result.banner;
      bannerPreview.alt = `Banner de ${result.title}`;
      bannerPreviewWrap.classList.remove("oculto");
      bannerStatus.textContent = "Banner encontrado. Se usara al guardar si no subes uno manual.";
    }

    if (Array.isArray(result.genres) && result.genres.length) {
      form.elements.categoria.value = result.genres.join(", ");
    }

    if (result.description) {
      form.elements.descripcion.value = result.description;
    }

    setEstado("Datos encontrados. Revisa la fuente y corrige manualmente si algo no coincide.", "ok");
    queueCatalogHeightSync();
  } catch (error) {
    setEstado(error.message || "No se pudo buscar la informacion en Cuevana.", "error");
  }
}

function renderList(items) {
  listaPeliculas.innerHTML = "";

  if (!items.length) {
    listaPeliculas.innerHTML = '<div class="movie-item"><p class="movie-meta">No encontramos peliculas con ese filtro.</p></div>';
    return;
  }

  items.forEach(movie => {
    const item = document.createElement("article");
    item.className = "movie-item";
    const titulo = escapeHtml(movie.titulo);
    const movieId = escapeHtml(movie.id);
    const categorias = escapeHtml((movie.categoria || []).join(", ") || "Sin categorias");

    item.innerHTML = `
      <h3>${titulo}</h3>
      <p class="movie-meta"><strong>ID:</strong> ${movieId}</p>
      <p class="movie-meta"><strong>Categorias:</strong> ${categorias}</p>
      <div class="movie-actions">
        <button type="button" data-action="edit">Editar</button>
        <button type="button" class="delete" data-action="delete">Eliminar</button>
      </div>
    `;

    item.querySelector('[data-action="edit"]').addEventListener("click", () => {
      fillForm(movie);
      setEstado(`Editando "${movie.titulo}".`);
    });

    item.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      const confirmed = window.confirm(`Eliminar "${movie.titulo}" del catalogo?`);

      if (!confirmed) {
        return;
      }

      try {
        await removeStoredAssets(movie);
        const { error } = await supabaseClient
          .from("movies")
          .delete()
          .eq("id", movie.id);

        if (error) {
          throw error;
        }

        await loadCatalog();
        clearForm();
        setEstado(`"${movie.titulo}" fue eliminada.`, "ok");
      } catch (error) {
        setEstado(error.message || "No se pudo eliminar la pelicula.", "error");
      }
    });

    listaPeliculas.appendChild(item);
  });
}

function renderRequests(items) {
  listaSolicitudes.innerHTML = "";

  if (!items.length) {
    listaSolicitudes.innerHTML = '<div class="movie-item"><p class="movie-meta">No encontramos solicitudes con ese filtro.</p></div>';
    return;
  }

  items.forEach(request => {
    const item = document.createElement("article");
    item.className = "movie-item request-item";
    const titulo = escapeHtml(request.titulo);
    const contacto = escapeHtml(request.contacto || "No dejo contacto");
    const detalle = escapeHtml(request.detalle || "Sin detalle adicional");
    const statusClass = request.estado === "agregada" ? "is-done" : "is-pending";

    item.innerHTML = `
      <div class="request-item-head">
        <h3>${titulo}</h3>
        <span class="request-badge ${statusClass}">${escapeHtml(getRequestStatusLabel(request.estado))}</span>
      </div>
      <p class="movie-meta"><strong>Contacto:</strong> ${contacto}</p>
      <p class="movie-meta"><strong>Detalle:</strong> ${detalle}</p>
      <p class="movie-meta"><strong>Recibida:</strong> ${escapeHtml(formatRequestDate(request.created_at))}</p>
      <div class="movie-actions">
        <button type="button" data-action="mark-added">Marcar agregada</button>
        <button type="button" data-action="mark-pending">Pendiente</button>
        <button type="button" class="delete" data-action="delete">Eliminar</button>
      </div>
    `;

    item.querySelector('[data-action="mark-added"]').addEventListener("click", async () => {
      await updateRequestStatus(request, "agregada");
    });

    item.querySelector('[data-action="mark-pending"]').addEventListener("click", async () => {
      await updateRequestStatus(request, "pendiente");
    });

    item.querySelector('[data-action="delete"]').addEventListener("click", () => {
      openDeleteRequestModal(request);
    });

    listaSolicitudes.appendChild(item);
  });
}

function filterCatalog() {
  const query = buscador.value.trim().toLowerCase();

  if (!query) {
    renderList(catalogo);
    return;
  }

  const filtered = catalogo.filter(movie => {
    const hayTitulo = movie.titulo.toLowerCase().includes(query);
    const hayId = movie.id.toLowerCase().includes(query);
    const hayCategoria = (movie.categoria || []).some(item => item.toLowerCase().includes(query));
    return hayTitulo || hayId || hayCategoria;
  });

  renderList(filtered);
}

function filterRequests() {
  const query = buscador.value.trim().toLowerCase();

  if (!query) {
    renderRequests(solicitudes);
    return;
  }

  const filtered = solicitudes.filter(request => {
    const hayTitulo = request.titulo.toLowerCase().includes(query);
    const hayContacto = request.contacto.toLowerCase().includes(query);
    const hayDetalle = request.detalle.toLowerCase().includes(query);
    const hayEstado = getRequestStatusLabel(request.estado).toLowerCase().includes(query);
    return hayTitulo || hayContacto || hayDetalle || hayEstado;
  });

  renderRequests(filtered);
}

async function updateRequestStatus(request, estado) {
  if (!request?.id) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("movie_requests")
      .update({ estado })
      .eq("id", request.id);

    if (error) {
      throw error;
    }

    await loadRequests();
    setEstado(`Solicitud "${request.titulo}" marcada como ${getRequestStatusLabel(estado).toLowerCase()}.`, "ok");
  } catch (error) {
    setEstado(error.message || "No se pudo actualizar la solicitud.", "error");
  }
}

async function loadCatalog() {
  setEstado("Cargando catalogo...");

  try {
    const { data, error } = await supabaseClient
      .from("movies")
      .select("id, titulo, archivo, imagen, banner, categoria, descripcion")
      .order("titulo", { ascending: true });

    if (error) {
      throw error;
    }

    catalogo = normalizeMovies(data);
    filterCatalog();
    queueCatalogHeightSync();
    setEstado(`Catalogo cargado: ${catalogo.length} peliculas.`);
    const session = await refreshSessionStatus();
    updateSessionPill(session.remainingMs || 0);
    startSessionWatcher();
  } catch (error) {
    if (String(error.message || "").includes("Debes iniciar sesion")) {
      window.location.href = "/admin/login/";
      return;
    }

    setEstado(error.message || "No se pudo cargar el catalogo.", "error");
  }
}

async function loadRequests() {
  try {
    const { data, error } = await supabaseClient
      .from("movie_requests")
      .select("id, titulo, contacto, detalle, estado, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    solicitudes = normalizeRequests(data);
    updateRequestBadge();
    filterRequests();
    queueCatalogHeightSync();
  } catch (error) {
    if (String(error.message || "").includes("Debes iniciar sesion")) {
      window.location.href = "/admin/login/";
      return;
    }

    setEstado(error.message || "No se pudieron cargar las solicitudes.", "error");
  }
}

async function startPanel() {
  await loadCatalog();
  await loadRequests();
  setActiveView(currentView);
}

form.elements.titulo.addEventListener("input", () => {
  if (!form.elements.id.dataset.manual) {
    form.elements.id.value = slugify(form.elements.titulo.value);
  }

  refreshAssetPaths();
  queueCatalogHeightSync();
});

form.elements.id.addEventListener("input", () => {
  form.elements.id.dataset.manual = form.elements.id.value.trim() ? "true" : "";
  refreshAssetPaths();
  queueCatalogHeightSync();
});

imagenFileInput.addEventListener("change", refreshAssetPaths);
bannerFileInput.addEventListener("change", refreshAssetPaths);
form.elements.archivo.addEventListener("input", queueCatalogHeightSync);
form.elements.categoria.addEventListener("input", queueCatalogHeightSync);
form.elements.descripcion.addEventListener("input", queueCatalogHeightSync);
window.addEventListener("resize", queueCatalogHeightSync);

if (window.ResizeObserver && formCard) {
  const formObserver = new ResizeObserver(() => {
    queueCatalogHeightSync();
  });

  formObserver.observe(formCard);
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const movieId = valueOf("id") || slugify(valueOf("titulo"));
  const currentMovie = catalogo.find(movie => movie.id === movieId) || null;

  if (!movieId) {
    setEstado("No se pudo generar un ID valido para la pelicula.", "error");
    return;
  }

  form.elements.id.value = movieId;
  setEstado("Guardando pelicula...");

  try {
    const imagen = await resolveAssetUrl({
      fileInput: imagenFileInput,
      sourceUrl: imagenSourceUrl,
      currentValue: currentMovie?.imagen || "",
      movieId,
      baseName: "portada"
    });

    const banner = await resolveAssetUrl({
      fileInput: bannerFileInput,
      sourceUrl: bannerSourceUrl,
      currentValue: currentMovie?.banner || "",
      movieId,
      baseName: "banner"
    });

    const payload = {
      id: movieId,
      titulo: valueOf("titulo"),
      archivo: valueOf("archivo"),
      categoria: valueOf("categoria")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean),
      descripcion: valueOf("descripcion"),
      imagen,
      banner
    };

    const { data, error } = await supabaseClient
      .from("movies")
      .upsert(payload, { onConflict: "id" })
      .select("id, titulo, archivo, imagen, banner, categoria, descripcion")
      .single();

    if (error) {
      throw error;
    }

    await loadCatalog();
    clearForm();
    setEstado(
      currentMovie
        ? `"${data.titulo}" fue actualizada.`
        : `"${data.titulo}" fue agregada.`,
      "ok"
    );
  } catch (error) {
    if (String(error.message || "").includes("Debes iniciar sesion")) {
      window.location.href = "/admin/login/";
      return;
    }

    setEstado(error.message || "No se pudo guardar la pelicula.", "error");
  }
});

btnLimpiar.addEventListener("click", clearForm);
btnRecargar.addEventListener("click", async () => {
  await loadCatalog();
  await loadRequests();
  setEstado("Catalogo y solicitudes recargados.", "ok");
});
btnLogout.addEventListener("click", logout);
btnSolicitudes.addEventListener("click", () => {
  setActiveView("solicitudes");
  listCard.scrollIntoView({ behavior: "smooth", block: "start" });
});
btnBuscarTodo.addEventListener("click", buscarTodoCuevana);
btnClearPoster.addEventListener("click", clearPosterAuto);
btnClearBanner.addEventListener("click", clearBannerAuto);
btnGenerarVimeus.addEventListener("click", generateVimeusUrl);
btnUsarVimeus.addEventListener("click", applyVimeusUrl);
btnExtend5.addEventListener("click", () => extendSession(5));
btnExtend10.addEventListener("click", () => extendSession(10));
btnSessionClose.addEventListener("click", logout);
btnDeleteRequestCancel?.addEventListener("click", closeDeleteRequestModal);
btnDeleteRequestConfirm?.addEventListener("click", async () => {
  if (!pendingRequestDelete?.id) {
    closeDeleteRequestModal();
    return;
  }

  const request = pendingRequestDelete;
  closeDeleteRequestModal();

  try {
    const { error } = await supabaseClient
      .from("movie_requests")
      .delete()
      .eq("id", request.id);

    if (error) {
      throw error;
    }

    await loadRequests();
    setEstado(`Solicitud de "${request.titulo}" eliminada.`, "ok");
  } catch (error) {
    setEstado(error.message || "No se pudo eliminar la solicitud.", "error");
  }
});
buscador.addEventListener("input", () => {
  if (currentView === "solicitudes") {
    filterRequests();
    return;
  }

  filterCatalog();
});

panelTabs.forEach(button => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view);
  });
});

vimeusTmdb.addEventListener("input", () => {
  if (vimeusGeneratedUrl) {
    vimeusGeneratedUrl = "";
    vimeusPreview.value = "";
    form.elements.archivo.value = "";
    form.elements.archivo.readOnly = false;
    btnUsarVimeus.disabled = true;
  }
});

vimeusPreview.addEventListener("click", () => {
  if (!vimeusGeneratedUrl) {
    return;
  }

  window.open(vimeusGeneratedUrl, "_blank", "noopener,noreferrer");
});

cuevanaSource.addEventListener("click", () => {
  if (!cuevanaPageUrl) {
    return;
  }

  window.open(cuevanaPageUrl, "_blank", "noopener,noreferrer");
});

if (window.__PELISPLUS_SESSION_READY__) {
  startPanel();
} else {
  window.addEventListener("pelisplus:session-ready", startPanel, { once: true });
}
