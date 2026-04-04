const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3010);
const BASE_URL = "https://wv3.cuevana3.eu";
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { ok: false, error: "Archivo no encontrado." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    res.end(content);
  });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36"
      }
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchText(new URL(res.headers.location, url).toString()));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Cuevana respondio con estado ${res.statusCode}.`));
        return;
      }

      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => {
        data += chunk;
      });
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeImageUrl(value, baseUrl) {
  if (!value) {
    return "";
  }

  return new URL(decodeHtml(String(value).trim()), baseUrl).toString();
}

function extractAssetByPatterns(html, pageUrl, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match && match[1]) {
      return normalizeImageUrl(match[1], pageUrl);
    }
  }

  return "";
}

function extractPosterFromHtml(html, pageUrl, title) {
  const escapedTitle = escapeRegExp(title.trim());
  const patterns = [
    new RegExp(`<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<img[^>]+alt=["'][^"']*${escapedTitle}[^"']*["'][^>]+src=["']([^"']+)["']`, "i"),
    /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i,
    /<img[^>]+data-src=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i
  ];

  return extractAssetByPatterns(html, pageUrl, patterns);
}

function extractBannerFromHtml(html, pageUrl, title) {
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

function extractGenresFromHtml(html) {
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

function extractDescriptionFromHtml(html) {
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

async function extractPageData(title) {
  const slug = slugify(title);

  if (!slug) {
    throw new Error("Escribe un titulo valido.");
  }

  const pageUrl = `${BASE_URL}/ver-pelicula/${slug}`;
  const html = await fetchText(pageUrl);
  const poster = extractPosterFromHtml(html, pageUrl, title);
  const banner = extractBannerFromHtml(html, pageUrl, title);
  const genres = extractGenresFromHtml(html);
  const description = extractDescriptionFromHtml(html);

  if (!poster && !banner && !genres.length && !description) {
    throw new Error("No encontre datos utiles en esa pagina con este metodo.");
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

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/" || requestUrl.pathname === "/prueba-cuevana/" || requestUrl.pathname === "/prueba-cuevana") {
    sendFile(res, path.join(ROOT_DIR, "index.html"));
    return;
  }

  if (requestUrl.pathname === "/style.css" || requestUrl.pathname === "/prueba-cuevana/style.css") {
    sendFile(res, path.join(ROOT_DIR, "style.css"));
    return;
  }

  if (requestUrl.pathname === "/app.js" || requestUrl.pathname === "/prueba-cuevana/app.js") {
    sendFile(res, path.join(ROOT_DIR, "app.js"));
    return;
  }

  if (requestUrl.pathname === "/api/cuevana-poster") {
    try {
      const title = requestUrl.searchParams.get("title") || "";
      const result = await extractPageData(title);
      if (!result.poster) {
        throw new Error("No se pudo extraer la portada.");
      }
      sendJson(res, 200, { ok: true, title: result.title, slug: result.slug, pageUrl: result.pageUrl, poster: result.poster });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo extraer la portada."
      });
    }
    return;
  }

  if (requestUrl.pathname === "/api/cuevana-banner") {
    try {
      const title = requestUrl.searchParams.get("title") || "";
      const result = await extractPageData(title);
      if (!result.banner) {
        throw new Error("No se pudo extraer el banner.");
      }
      sendJson(res, 200, { ok: true, title: result.title, slug: result.slug, pageUrl: result.pageUrl, banner: result.banner });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo extraer el banner."
      });
    }
    return;
  }

  if (requestUrl.pathname === "/api/cuevana-data") {
    try {
      const title = requestUrl.searchParams.get("title") || "";
      const result = await extractPageData(title);
      sendJson(res, 200, { ok: true, ...result });
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error.message || "No se pudo extraer la informacion."
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Ruta no encontrada." });
});

server.listen(PORT, () => {
  console.log(`Prueba Cuevana disponible en http://localhost:${PORT}/prueba-cuevana/`);
});
