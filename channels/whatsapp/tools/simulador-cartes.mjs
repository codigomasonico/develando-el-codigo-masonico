import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { procesarEntradaLocal, crearSesionInicial } from "./simulador-logica.mjs";

const publicRoot = fileURLToPath(new URL("../../web/public/cartes-whatsapp/", import.meta.url));
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function bodyJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/api/simular") {
      const data = await bodyJson(req);
      return json(res, 200, procesarEntradaLocal({
        entrada: data.entrada,
        id: data.id,
        sesion: data.sesion || crearSesionInicial()
      }));
    }

    const requested = url.pathname === "/" ? "/simulador.html" : url.pathname;
    const safe = normalize(requested).replace(/^(\.\.[/\\])+/, "");
    const path = join(publicRoot, safe);
    const content = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream" });
    res.end(content);
  } catch (error) {
    if (error?.code === "ENOENT") {
      res.writeHead(404);
      res.end("No encontrado");
      return;
    }
    console.error(error);
    res.writeHead(500);
    res.end("Error interno");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Simulador local de Cartes: http://127.0.0.1:${port}`);
});
