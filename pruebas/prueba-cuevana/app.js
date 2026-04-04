const titleInput = document.getElementById("title");
const statusNode = document.getElementById("status");
const btnSearch = document.getElementById("btn-search");

const posterResult = document.getElementById("poster-result");
const posterImage = document.getElementById("poster-image");
const posterTitle = document.getElementById("poster-title");
const posterSlug = document.getElementById("poster-slug");
const posterPage = document.getElementById("poster-page");
const posterLink = document.getElementById("poster-link");

const bannerResult = document.getElementById("banner-result");
const bannerImage = document.getElementById("banner-image");
const bannerTitle = document.getElementById("banner-title");
const bannerSlug = document.getElementById("banner-slug");
const bannerPage = document.getElementById("banner-page");
const bannerLink = document.getElementById("banner-link");

const detailsResult = document.getElementById("details-result");
const detailsTitle = document.getElementById("details-title");
const detailsSlug = document.getElementById("details-slug");
const detailsPage = document.getElementById("details-page");
const detailsGenres = document.getElementById("details-genres");
const detailsDescription = document.getElementById("details-description");

function setStatus(message, type = "") {
  statusNode.textContent = message;
  statusNode.className = `status ${type}`.trim();
}

function getTitleValue() {
  return titleInput.value.trim();
}

function resetAll() {
  posterResult.classList.add("hidden");
  bannerResult.classList.add("hidden");
  detailsResult.classList.add("hidden");
  posterImage.removeAttribute("src");
  posterImage.removeAttribute("alt");
  bannerImage.removeAttribute("src");
  bannerImage.removeAttribute("alt");
}

function fillCard(kind, result) {
  const resultNode = kind === "poster" ? posterResult : bannerResult;
  const imageNode = kind === "poster" ? posterImage : bannerImage;
  const titleNode = kind === "poster" ? posterTitle : bannerTitle;
  const slugNode = kind === "poster" ? posterSlug : bannerSlug;
  const pageNode = kind === "poster" ? posterPage : bannerPage;
  const linkNode = kind === "poster" ? posterLink : bannerLink;
  const assetUrl = kind === "poster" ? result.poster : result.banner;

  titleNode.textContent = result.title;
  slugNode.textContent = result.slug;
  pageNode.href = result.pageUrl;
  pageNode.textContent = result.pageUrl;
  linkNode.href = assetUrl;
  linkNode.textContent = assetUrl;
  imageNode.src = assetUrl;
  imageNode.alt = `${kind === "poster" ? "Portada" : "Banner"} de ${result.title}`;
  resultNode.classList.remove("hidden");
}

function fillDetails(result) {
  detailsTitle.textContent = result.title || "";
  detailsSlug.textContent = result.slug || "";
  detailsPage.href = result.pageUrl || "#";
  detailsPage.textContent = result.pageUrl || "Abrir";
  detailsGenres.textContent = Array.isArray(result.genres) && result.genres.length
    ? result.genres.join(", ")
    : "No encontrados";
  detailsDescription.textContent = result.description || "No encontrada";
  detailsResult.classList.remove("hidden");
}

async function buscarTodo() {
  const title = getTitleValue();

  if (!title) {
    setStatus("Escribe un titulo para probar.", "error");
    resetAll();
    return;
  }

  setStatus("Buscando portada, banner e informacion...");
  resetAll();

  try {
    const response = await fetch(`/api/cuevana-data?title=${encodeURIComponent(title)}`, {
      cache: "no-store"
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "No se pudo extraer la informacion.");
    }

    fillCard("poster", result);
    fillCard("banner", result);
    fillDetails(result);
    setStatus("Portada, banner e informacion encontrados.", "ok");
  } catch (error) {
    setStatus(error.message || "No se pudo extraer la informacion.", "error");
  }
}

btnSearch.addEventListener("click", buscarTodo);

titleInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarTodo();
  }
});
