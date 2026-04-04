const DEFAULT_MOVIE_PHRASE = "Tu proxima pelicula ya esta lista";

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function normalizeRelativePath(value) {
  return String(value || "").replace(/^\.?\//, "");
}

function resolveAssetUrl(value, prefix = "") {
  if (!value) {
    return "";
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  return `${prefix}${normalizeRelativePath(value)}`;
}

function normalizeMovie(row) {
  return {
    id: row.id,
    titulo: decodeHtmlEntities(row.titulo || ""),
    archivo: row.archivo || "",
    imagen: row.imagen || "",
    banner: row.banner || row.imagen || "",
    categoria: Array.isArray(row.categoria) ? row.categoria : [],
    descripcion: decodeHtmlEntities(row.descripcion || ""),
    frase: decodeHtmlEntities(row.frase || DEFAULT_MOVIE_PHRASE),
    etiquetas: Array.isArray(row.etiquetas) ? row.etiquetas : [],
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

async function fetchMoviesFromSupabase() {
  const client = window.supabasePublic;

  if (!client) {
    throw new Error("No se pudo inicializar el catalogo.");
  }

  const { data, error } = await client
    .from("movies")
    .select("id, titulo, archivo, imagen, banner, categoria, descripcion, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "No se pudo cargar el catalogo.");
  }

  return (data || []).map(normalizeMovie);
}

window.pelisData = {
  DEFAULT_MOVIE_PHRASE,
  fetchMoviesFromSupabase,
  resolveAssetUrl
};
