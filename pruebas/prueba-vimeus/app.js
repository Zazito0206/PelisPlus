const DEFAULTS = {
  viewKey: "GVW7Je4obF9FT749y4y5MdUAQOVh-j4BhH05eZNGCdE",
  brandTitle: "PELIS",
  theme: "blue",
  font: "v3",
  overlay: "v2"
};

const form = document.getElementById("form");
const btnClear = document.getElementById("btn-clear");
const btnOpenSearch = document.getElementById("btn-open-search");
const statusNode = document.getElementById("status");
const resultNode = document.getElementById("result");
const titleInput = document.getElementById("title");
const tmdbInput = document.getElementById("tmdb");
const resultQuery = document.getElementById("result-query");
const resultTmdb = document.getElementById("result-tmdb");
const resultBrand = document.getElementById("result-brand");
const resultConfig = document.getElementById("result-config");
const resultLink = document.getElementById("result-link");
const resultUrl = document.getElementById("result-url");

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

function resetResult() {
  resultNode.classList.add("hidden");
  resultQuery.textContent = "";
  resultTmdb.textContent = "";
  resultBrand.textContent = "";
  resultConfig.textContent = "";
  resultLink.href = "#";
  resultLink.textContent = "Abrir enlace";
  resultUrl.value = "";
}

function buildUrl(tmdb) {
  const params = new URLSearchParams({
    tmdb,
    view_key: DEFAULTS.viewKey,
    title: DEFAULTS.brandTitle,
    theme: DEFAULTS.theme,
    font: DEFAULTS.font,
    overlay: DEFAULTS.overlay
  });

  return `https://vimeus.com/e/movie?${params.toString()}`;
}

async function openVimeusSearch() {
  const title = titleInput.value.trim();

  if (!title) {
    setStatus("Escribe primero el titulo para buscarlo en Vimeus.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(title);
    setStatus("Titulo copiado. Se abrira Vimeus para que pegues y busques el TMDb ID.", "ok");
  } catch {
    setStatus("Se abrira Vimeus. Si no se copio el titulo, pegalo manualmente.", "ok");
  }

  window.open("https://vimeus.com/dashboard/search#", "_blank", "noopener,noreferrer");
}

form.addEventListener("submit", event => {
  event.preventDefault();
  resetResult();

  const title = titleInput.value.trim();
  const tmdb = tmdbInput.value.trim();

  if (!title || !tmdb) {
    setStatus("Completa el titulo y el TMDb ID.", "error");
    return;
  }

  const url = buildUrl(tmdb);

  resultQuery.textContent = title;
  resultTmdb.textContent = tmdb;
  resultBrand.textContent = DEFAULTS.brandTitle;
  resultConfig.textContent = `${DEFAULTS.theme} / ${DEFAULTS.font} / ${DEFAULTS.overlay}`;
  resultLink.href = url;
  resultLink.textContent = url;
  resultUrl.value = url;
  resultNode.classList.remove("hidden");
  setStatus("Enlace generado con los valores por defecto.", "ok");
});

btnOpenSearch.addEventListener("click", openVimeusSearch);

btnClear.addEventListener("click", () => {
  form.reset();
  resetResult();
  setStatus("Formulario limpio.");
});
