const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT_DIR = path.resolve(__dirname, "..");
const ADMIN_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "peliculas.json");
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ASSET_EXTENSIONS = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);
const DEFAULT_PHRASE = "Tu próxima película ya está lista";
const ADMIN_USER = "@Zazo";
const ADMIN_PASSWORD = "Zazo020623";
const SESSION_COOKIE = "pelisplus_admin_session";
const DEFAULT_SESSION_MS = 5 * 60 * 1000;
const CUEVANA_BASE_URL = "https://wv3.cuevana3.eu";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const sessions = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store"
  });
  res.end();
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";

  return cookieHeader
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const separatorIndex = item.indexOf("=");

      if (separatorIndex === -1) {
        return acc;
      }

      const key = item.slice(0, separatorIndex);
      const value = item.slice(separatorIndex + 1);
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function getSessionToken(req) {
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE] || "";
}

function getSession(req) {
  const token = getSessionToken(req);
  const session = token ? sessions.get(token) : null;

  if (!token || !session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return {
    token,
    ...session
  };
}

function isAuthenticated(req) {
  return Boolean(getSession(req));
}

function createSession() {
  const token = crypto.randomUUID();
  const now = Date.now();
  sessions.set(token, {
    createdAt: now,
    expiresAt: now + DEFAULT_SESSION_MS
  });
  return token;
}

function extendSession(token, durationMs) {
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  session.expiresAt = Date.now() + durationMs;
  sessions.set(token, session);

  return {
    token,
    ...session
  };
}

function clearSession(req) {
  const token = getSessionToken(req);

  if (token) {
    sessions.delete(token);
  }
}

function sendText(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(message);
}

function readCatalog() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeCatalog(data) {
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("El cuerpo de la petición es demasiado grande."));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function getFileExtension(filename) {
  const ext = path.extname(String(filename || "")).toLowerCase();
  return ALLOWED_ASSET_EXTENSIONS.has(ext) ? ext : "";
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl || ""));

  if (!match) {
    throw new Error("Formato de archivo inválido.");
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function fetchRemote(url) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const transport = requestUrl.protocol === "https:" ? require("https") : require("http");

    transport.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36"
      }
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchRemote(new URL(res.headers.location, url).toString()));
        return;
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`No se pudo descargar el recurso remoto (${res.statusCode || "sin estado"}).`));
        return;
      }

      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: String(res.headers["content-type"] || "")
        });
      });
    }).on("error", reject);
  });
}

function getAssistantSystemPrompt(action) {
  const actionLabel = {
    chat: "responder preguntas simples",
    text: "acortar, resumir o mejorar texto"
  }[action] || "resolver tareas basicas de texto";

  return [
    "Eres un asistente interno de Pelis+ para el panel admin.",
    "Ayudas con tareas basicas de texto en español, de forma breve y util.",
    `En esta respuesta, enfocate principalmente en: ${actionLabel}.`,
    "Si el usuario comparte una descripcion larga, devuelvela lista para usar.",
    "No uses markdown complejo ni relleno innecesario."
  ].join(" ");
}

function buildAssistantUserPrompt(action, prompt, sourceText) {
  const parts = [`Accion solicitada: ${action || "chat"}.`];

  if (prompt) {
    parts.push(`Instruccion del usuario:\n${prompt}`);
  }

  if (sourceText) {
    parts.push(`Texto base:\n${sourceText}`);
  }

  return parts.join("\n\n");
}

function extractAssistantText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map(item => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeRemoteImageUrl(value, baseUrl) {
  if (!value) {
    return "";
  }

  return new URL(decodeHtml(String(value).trim()), baseUrl).toString();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractCuevanaPosterFromHtml(html, pageUrl, title) {
  const escapedTitle = escapeRegExp(title.trim());
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<img[^>]+alt=["'][^"']*${escapedTitle}[^"']*["'][^>]+src=["']([^"']+)["']`, "i"),
    /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i,
    /<img[^>]+data-src=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      return normalizeRemoteImageUrl(match[1], pageUrl);
    }
  }

  return "";
}

function extractAssetByPatterns(html, pageUrl, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      return normalizeRemoteImageUrl(match[1], pageUrl);
    }
  }

  return "";
}

function extractCuevanaBannerFromHtml(html, pageUrl, title) {
  const escapedTitle = escapeRegExp(title.trim());
  const patterns = [
    /"backdrop_path"\s*:\s*"([^"]+)"/i,
    /"backdrop"\s*:\s*"([^"]+)"/i,
    /"fanart"\s*:\s*"([^"]+)"/i,
    /data-backdrop=["']([^"']+)["']/i,
    /data-bg=["']([^"']+)["']/i,
    /style=["'][^"']*background-image:\s*url\((?:&quot;|["'])?([^"')&]+)(?:&quot;|["'])?\)/i,
    /<img[^>]+(?:class|id)=["'][^"']*(?:backdrop|banner|hero|cover|fanart)[^"']*["'][^>]+(?:src|data-src)=["']([^"']+)["']/i,
    new RegExp(`<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]+alt=["'][^"']*${escapedTitle}[^"']*(?:banner|fondo|cover)[^"']*["']`, "i"),
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  ];

  return extractAssetByPatterns(html, pageUrl, patterns);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function stripTags(value) {
  return decodeHtml(String(value || ""))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCuevanaGenresFromHtml(html) {
  const genres = [];
  const blockPatterns = [
    /G[ée]nero:\s*([^<\n\r]+?)(?=\s*(?:Actores?:|Director:|Reparto:|$))/i,
    /G[ée]neros:\s*([^<\n\r]+?)(?=\s*(?:Actores?:|Director:|Reparto:|$))/i,
    /<strong[^>]*>\s*G[ée]nero(?:s)?\s*:?\s*<\/strong>\s*([^<]+?)(?=<|Actores?:|Director:|Reparto:|$)/i,
    /<b[^>]*>\s*G[ée]nero(?:s)?\s*:?\s*<\/b>\s*([^<]+?)(?=<|Actores?:|Director:|Reparto:|$)/i
  ];

  for (const pattern of blockPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      stripTags(match[1])
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
        .forEach(item => genres.push(item));
    }
  }

  if (genres.length) {
    return unique(genres);
  }

  const compactText = stripTags(html);
  const textMatch = compactText.match(/G[ée]nero:\s*([^.]+?)(?=\s*(?:Actores?:|Director:|Reparto:|Calidad:|$))/i);

  if (textMatch && textMatch[1]) {
    return unique(
      textMatch[1]
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
    );
  }

  return [];
}

function extractCuevanaDescriptionFromHtml(html) {
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<p[^>]+class=["'][^"']*(?:overview|description|sinopsis|summary)[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
    /<div[^>]+class=["'][^"']*(?:overview|description|sinopsis|summary)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = stripTags(match[1]);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

async function extractCuevanaPoster(title) {
  const slug = slugify(title);

  if (!slug) {
    throw new Error("Escribe un título válido para buscar la portada.");
  }

  const pageUrl = `${CUEVANA_BASE_URL}/ver-pelicula/${slug}`;
  const { buffer } = await fetchRemote(pageUrl);
  const html = buffer.toString("utf8");
  const poster = extractCuevanaPosterFromHtml(html, pageUrl, title);

  if (!poster) {
    throw new Error("No encontré una portada en Cuevana para ese título.");
  }

  return {
    title,
    slug,
    pageUrl,
    poster
  };
}

async function extractCuevanaBanner(title) {
  const slug = slugify(title);

  if (!slug) {
    throw new Error("Escribe un tÃ­tulo vÃ¡lido para buscar el banner.");
  }

  const pageUrl = `${CUEVANA_BASE_URL}/ver-pelicula/${slug}`;
  const { buffer } = await fetchRemote(pageUrl);
  const html = buffer.toString("utf8");
  const banner = extractCuevanaBannerFromHtml(html, pageUrl, title);

  if (!banner) {
    throw new Error("No encontrÃ© un banner en Cuevana para ese tÃ­tulo.");
  }

  return {
    title,
    slug,
    pageUrl,
    banner
  };
}

async function extractCuevanaData(title) {
  const slug = slugify(title);

  if (!slug) {
    throw new Error("Escribe un tÃ­tulo vÃ¡lido para buscar en Cuevana.");
  }

  const pageUrl = `${CUEVANA_BASE_URL}/ver-pelicula/${slug}`;
  const { buffer } = await fetchRemote(pageUrl);
  const html = buffer.toString("utf8");
  const poster = extractCuevanaPosterFromHtml(html, pageUrl, title);
  const banner = extractCuevanaBannerFromHtml(html, pageUrl, title);
  const genres = extractCuevanaGenresFromHtml(html);
  const description = extractCuevanaDescriptionFromHtml(html);

  if (!poster && !banner && !genres.length && !description) {
    throw new Error("No encontrÃ© datos Ãºtiles en Cuevana para ese tÃ­tulo.");
  }

  return {
    title,
    slug,
    pageUrl,
    poster,
    banner,
    genres,
    description
  };
}

function getExtensionFromContentType(contentType) {
  const normalized = String(contentType || "").toLowerCase();

  if (normalized.includes("image/avif")) return ".avif";
  if (normalized.includes("image/webp")) return ".webp";
  if (normalized.includes("image/png")) return ".png";
  if (normalized.includes("image/jpeg")) return ".jpg";
  if (normalized.includes("image/jpg")) return ".jpg";

  return "";
}

function saveAsset(movieId, baseName, asset) {
  if (!asset || !asset.name || !asset.dataUrl) {
    return "";
  }

  const extension = getFileExtension(asset.name);

  if (!extension) {
    throw new Error(`Formato no permitido para ${baseName}.`);
  }

  const { buffer } = parseDataUrl(asset.dataUrl);
  const folderName = movieId.toUpperCase();
  const relativePath = path.posix.join("images", folderName, `${baseName}${extension}`);
  const targetDir = path.join(ROOT_DIR, "images", folderName);
  const targetPath = path.join(targetDir, `${baseName}${extension}`);

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, buffer);

  return relativePath;
}

async function saveRemoteAsset(movieId, baseName, assetUrl) {
  if (!assetUrl) {
    return "";
  }

  const { buffer, contentType } = await fetchRemote(assetUrl);
  const urlObject = new URL(assetUrl);
  const extensionFromUrl = getFileExtension(urlObject.pathname);
  const extension = extensionFromUrl || getExtensionFromContentType(contentType) || ".jpg";
  const folderName = movieId.toUpperCase();
  const relativePath = path.posix.join("images", folderName, `${baseName}${extension}`);
  const targetDir = path.join(ROOT_DIR, "images", folderName);
  const targetPath = path.join(targetDir, `${baseName}${extension}`);

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetPath, buffer);

  return relativePath;
}

async function normalizeMovie(input, existingMovie = null) {
  const titulo = String(input.titulo || "").trim();
  const archivo = String(input.archivo || "").trim();
  const descripcion = String(input.descripcion || "").trim();
  const categoria = Array.isArray(input.categoria) ? input.categoria : splitTags(input.categoria);
  const id = slugify(input.id || titulo);

  if (!titulo || !archivo || !descripcion) {
    throw new Error("Faltan campos obligatorios.");
  }

  if (!id) {
    throw new Error("No se pudo generar un id válido para la película.");
  }

  const imagen =
    saveAsset(id, "portada", input.imagenAsset) ||
    await saveRemoteAsset(id, "portada", String(input.imagenSourceUrl || "").trim()) ||
    String(input.imagen || existingMovie?.imagen || "").trim();
  const banner =
    saveAsset(id, "banner", input.bannerAsset) ||
    await saveRemoteAsset(id, "banner", String(input.bannerSourceUrl || "").trim()) ||
    String(input.banner || existingMovie?.banner || "").trim();

  if (!imagen || !banner) {
    throw new Error("Debes subir la portada y el banner o conservar las rutas existentes.");
  }

  return {
    id,
    titulo,
    archivo,
    imagen,
    banner,
    categoria,
    frase: DEFAULT_PHRASE,
    descripcion
  };
}

function isPathInsideRoot(filePath) {
  const relative = path.relative(ROOT_DIR, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function serveFile(res, filePath) {
  if (!isPathInsideRoot(filePath) && filePath !== path.join(ROOT_DIR, "index.html")) {
    sendText(res, 403, "Acceso denegado.");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendText(res, 404, "No encontrado.");
        return;
      }

      sendText(res, 500, "No se pudo leer el archivo.");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    res.end(content);
  });
}

function resolveStaticFile(urlPath) {
  if (urlPath === "/") {
    return path.join(ROOT_DIR, "index.html");
  }

  if (urlPath === "/peliculas" || urlPath === "/peliculas/") {
    return path.join(ROOT_DIR, "peliculas", "index.html");
  }

  if (urlPath === "/generos" || urlPath === "/generos/") {
    return path.join(ROOT_DIR, "generos", "index.html");
  }

  if (urlPath === "/milista" || urlPath === "/milista/") {
    return path.join(ROOT_DIR, "milista", "index.html");
  }

  if (urlPath === "/admin" || urlPath === "/admin/") {
    return path.join(ADMIN_DIR, "index.html");
  }

  if (urlPath === "/admin/login" || urlPath === "/admin/login/") {
    return path.join(ADMIN_DIR, "login.html");
  }

  const normalizedPath = decodeURIComponent(urlPath);

  if (normalizedPath.endsWith("/")) {
    const safeDirPath = path.normalize(normalizedPath).replace(/^([/\\])+/, "");
    return path.join(ROOT_DIR, safeDirPath, "index.html");
  }

  const safePath = path.normalize(normalizedPath).replace(/^([/\\])+/, "");
  return path.join(ROOT_DIR, safePath);
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/login" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const input = JSON.parse(body || "{}");
      const username = String(input.username || "").trim();
      const password = String(input.password || "").trim();

      if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
        sendJson(res, 401, {
          ok: false,
          error: "Usuario o contraseña incorrectos."
        });
        return true;
      }

      const token = createSession();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`
      });
      res.end(JSON.stringify({ ok: true }, null, 2));
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo iniciar sesión."
      });
    }

    return true;
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    clearSession(req);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`
    });
    res.end(JSON.stringify({ ok: true }, null, 2));
    return true;
  }

  if (pathname === "/api/session" && req.method === "GET") {
    const session = getSession(req);
    sendJson(res, 200, {
      ok: true,
      authenticated: Boolean(session),
      expiresAt: session ? session.expiresAt : null,
      remainingMs: session ? Math.max(0, session.expiresAt - Date.now()) : 0
    });
    return true;
  }

  if (pathname === "/api/session/extend" && req.method === "POST") {
    const session = getSession(req);

    if (!session) {
      sendJson(res, 401, {
        ok: false,
        error: "Debes iniciar sesiÃ³n."
      });
      return true;
    }

    try {
      const body = await readBody(req);
      const input = JSON.parse(body || "{}");
      const minutes = Number(input.minutes);
      const allowedMinutes = new Set([5, 10]);

      if (!allowedMinutes.has(minutes)) {
        throw new Error("Tiempo de extensiÃ³n invÃ¡lido.");
      }

      const updatedSession = extendSession(session.token, minutes * 60 * 1000);
      sendJson(res, 200, {
        ok: true,
        expiresAt: updatedSession.expiresAt,
        remainingMs: Math.max(0, updatedSession.expiresAt - Date.now())
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo extender la sesiÃ³n."
      });
    }

    return true;
  }

  if (pathname === "/api/cuevana-poster" && req.method === "GET") {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const title = requestUrl.searchParams.get("title") || "";
      const result = await extractCuevanaPoster(title);
      sendJson(res, 200, {
        ok: true,
        ...result
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo buscar la portada en Cuevana."
      });
    }

    return true;
  }

  if (pathname === "/api/cuevana-banner" && req.method === "GET") {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const title = requestUrl.searchParams.get("title") || "";
      const result = await extractCuevanaBanner(title);
      sendJson(res, 200, {
        ok: true,
        ...result
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo buscar el banner en Cuevana."
      });
    }

    return true;
  }

  if (pathname === "/api/cuevana-data" && req.method === "GET") {
    try {
      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const title = requestUrl.searchParams.get("title") || "";
      const result = await extractCuevanaData(title);
      sendJson(res, 200, {
        ok: true,
        ...result
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo buscar la informaciÃ³n en Cuevana."
      });
    }

    return true;
  }

  if (pathname.startsWith("/api/") && !isAuthenticated(req)) {
    sendJson(res, 401, {
      ok: false,
      error: "Debes iniciar sesión."
    });
    return true;
  }

  if (pathname === "/api/admin-assistant" && req.method === "POST") {
    try {
      const apiKey = String(process.env.OPENROUTER_API_KEY || process.env.PELIS_API_KEY || "").trim();

      if (!apiKey) {
        throw new Error("Falta configurar la API key del asistente.");
      }

      const body = await readBody(req);
      const input = JSON.parse(body || "{}");
      const action = String(input.action || "chat").trim();
      const prompt = String(input.prompt || "").trim();
      const sourceText = String(input.sourceText || "").trim();

      if (!prompt && !sourceText) {
        throw new Error("Debes enviar una instruccion o un texto base.");
      }

      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000/admin/",
          "X-Title": "Pelis+ Admin Assistant Local"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: getAssistantSystemPrompt(action)
            },
            {
              role: "user",
              content: buildAssistantUserPrompt(action, prompt, sourceText)
            }
          ]
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message || payload?.error || "No se pudo usar OpenRouter.");
      }

      const text = extractAssistantText(payload);

      if (!text) {
        throw new Error("La IA no devolvio una respuesta util.");
      }

      sendJson(res, 200, {
        ok: true,
        text
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo usar el asistente."
      });
    }

    return true;
  }

  if (pathname === "/api/peliculas" && req.method === "GET") {
    const catalog = readCatalog();
    sendJson(res, 200, catalog);
    return true;
  }

  if (pathname === "/api/peliculas" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const input = JSON.parse(body || "{}");
      const catalog = readCatalog();
      const normalizedId = slugify(input.id || input.titulo);
      const existingIndex = catalog.findIndex(item => item.id === normalizedId);
      const movie = await normalizeMovie(input, existingIndex >= 0 ? catalog[existingIndex] : null);

      if (existingIndex >= 0) {
        catalog[existingIndex] = movie;
      } else {
        catalog.push(movie);
      }

      writeCatalog(catalog);
      sendJson(res, 200, {
        ok: true,
        mode: existingIndex >= 0 ? "updated" : "created",
        movie
      });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo guardar la película."
      });
    }

    return true;
  }

  if (pathname.startsWith("/api/peliculas/") && req.method === "DELETE") {
    const id = slugify(pathname.split("/").pop());

    if (!id) {
      sendJson(res, 400, { ok: false, error: "ID inválido." });
      return true;
    }

    const catalog = readCatalog();
    const nextCatalog = catalog.filter(item => item.id !== id);

    if (nextCatalog.length === catalog.length) {
      sendJson(res, 404, { ok: false, error: "Película no encontrada." });
      return true;
    }

    writeCatalog(nextCatalog);
    sendJson(res, 200, { ok: true, deletedId: id });
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const { pathname } = requestUrl;

    if (await handleApi(req, res, pathname)) {
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Método no permitido.");
      return;
    }

    const filePath = resolveStaticFile(pathname);
    serveFile(res, filePath);
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message || "Error interno del servidor."
    });
  }
});

server.listen(PORT, () => {
  console.log(`Panel disponible en http://localhost:${PORT}/admin/`);
});
