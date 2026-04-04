const { URL } = require("url");
const https = require("https");
const http = require("http");

const CUEVANA_BASE_URL = "https://wv3.cuevana3.eu";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload, null, 2));
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fetchRemote(url) {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const transport = requestUrl.protocol === "https:" ? https : http;

    transport
      .get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36"
        }
      }, response => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          resolve(fetchRemote(new URL(response.headers.location, url).toString()));
          return;
        }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`No se pudo descargar el recurso remoto (${response.statusCode || "sin estado"}).`));
          return;
        }

        const chunks = [];
        response.on("data", chunk => chunks.push(chunk));
        response.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      })
      .on("error", reject);
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

function normalizeRemoteImageUrl(value, baseUrl) {
  if (!value) {
    return "";
  }

  return new URL(decodeHtml(String(value).trim()), baseUrl).toString();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripTags(value) {
  return decodeHtml(String(value || ""))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
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

function extractCuevanaPosterFromHtml(html, pageUrl, title) {
  const escapedTitle = escapeRegExp(title.trim());
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    new RegExp(`<img[^>]+alt=["'][^"']*${escapedTitle}[^"']*["'][^>]+src=["']([^"']+)["']`, "i"),
    /<img[^>]+src=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i,
    /<img[^>]+data-src=["']([^"']+)["'][^>]+alt=["'][^"']*["']/i
  ];

  return extractAssetByPatterns(html, pageUrl, patterns);
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

function extractCuevanaGenresFromHtml(html) {
  const genres = [];
  const blockPatterns = [
    /G(?:e|é)nero:\s*([^<\n\r]+?)(?=\s*(?:Actores?:|Director:|Reparto:|$))/i,
    /G(?:e|é)neros:\s*([^<\n\r]+?)(?=\s*(?:Actores?:|Director:|Reparto:|$))/i,
    /<strong[^>]*>\s*G(?:e|é)nero(?:s)?\s*:?\s*<\/strong>\s*([^<]+?)(?=<|Actores?:|Director:|Reparto:|$)/i,
    /<b[^>]*>\s*G(?:e|é)nero(?:s)?\s*:?\s*<\/b>\s*([^<]+?)(?=<|Actores?:|Director:|Reparto:|$)/i
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
  const textMatch = compactText.match(/G(?:e|é)nero:\s*([^.]+?)(?=\s*(?:Actores?:|Director:|Reparto:|Calidad:|$))/i);

  if (!textMatch || !textMatch[1]) {
    return [];
  }

  return unique(
    textMatch[1]
      .split(",")
      .map(item => item.trim())
      .filter(Boolean)
  );
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

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, {
      ok: false,
      error: "Metodo no permitido."
    });
    return;
  }

  try {
    const title = String(req.query.title || "").trim();
    const slug = slugify(title);

    if (!slug) {
      throw new Error("Escribe un titulo valido para buscar en Cuevana.");
    }

    const pageUrl = `${CUEVANA_BASE_URL}/ver-pelicula/${slug}`;
    const html = await fetchRemote(pageUrl);
    const poster = extractCuevanaPosterFromHtml(html, pageUrl, title);
    const banner = extractCuevanaBannerFromHtml(html, pageUrl, title);
    const genres = extractCuevanaGenresFromHtml(html);
    const description = extractCuevanaDescriptionFromHtml(html);

    if (!poster && !banner && !genres.length && !description) {
      throw new Error("No encontre datos utiles en Cuevana para ese titulo.");
    }

    sendJson(res, 200, {
      ok: true,
      title,
      slug,
      pageUrl,
      poster,
      banner,
      genres,
      description
    });
  } catch (error) {
    sendJson(res, 400, {
      ok: false,
      error: error.message || "No se pudo buscar la informacion en Cuevana."
    });
  }
};
