const fs = require("fs");
const path = require("path");

const PROJECT_URL = "https://vyaxptlskssstvcibfbi.supabase.co";
const ANON_KEY = "sb_publishable_G4lJ6o6BJqH32G_D6sXIog_34IBvjKi";
const MOVIES_PATH = path.join(__dirname, "..", "peliculas.json");

async function main() {
  const raw = fs.readFileSync(MOVIES_PATH, "utf8");
  const movies = JSON.parse(raw);

  if (!Array.isArray(movies) || !movies.length) {
    throw new Error("No hay peliculas para importar.");
  }

  const payload = movies.map(movie => ({
    id: movie.id,
    titulo: movie.titulo,
    archivo: movie.archivo,
    imagen: movie.imagen,
    banner: movie.banner,
    categoria: Array.isArray(movie.categoria) ? movie.categoria : [],
    descripcion: movie.descripcion || ""
  }));

  const response = await fetch(`${PROJECT_URL}/rest/v1/movies?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase respondio ${response.status}: ${text}`);
  }

  const result = text ? JSON.parse(text) : [];
  console.log(`Importacion completada: ${result.length} peliculas procesadas.`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
