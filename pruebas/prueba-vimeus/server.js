const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3020);
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8"
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Archivo no encontrado.");
      return;
    }

    res.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/" || requestUrl.pathname === "/pruebas/prueba-vimeus/" || requestUrl.pathname === "/pruebas/prueba-vimeus") {
    sendFile(res, path.join(ROOT_DIR, "index.html"));
    return;
  }

  if (requestUrl.pathname === "/style.css" || requestUrl.pathname === "/pruebas/prueba-vimeus/style.css") {
    sendFile(res, path.join(ROOT_DIR, "style.css"));
    return;
  }

  if (requestUrl.pathname === "/app.js" || requestUrl.pathname === "/pruebas/prueba-vimeus/app.js") {
    sendFile(res, path.join(ROOT_DIR, "app.js"));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Ruta no encontrada.");
});

server.listen(PORT, () => {
  console.log(`Prueba Vimeus disponible en http://localhost:${PORT}/pruebas/prueba-vimeus/`);
});
