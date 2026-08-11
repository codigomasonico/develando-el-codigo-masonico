import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');

const publicArg = process.argv[2] || 'channels/web/public';
const port = Number(process.argv[3] || 4174);
const host = '127.0.0.1';
const publicDir = path.resolve(projectRoot, publicArg);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8'
};

function safePathFromUrl(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const relative = pathname.replace(/^\/+/, '');
  const candidate = path.resolve(publicDir, relative);
  const rel = path.relative(publicDir, candidate);

  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return candidate;
}

async function sendFile(res, filePath) {
  try {
    let stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      stat = await fs.stat(filePath);
    }
    if (!stat.isFile()) throw new Error('Not a file');

    const body = await fs.readFile(filePath);
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': body.length,
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const filePath = safePathFromUrl(req.url);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  await sendFile(res, filePath);
});

server.listen(port, host, () => {
  console.log(`Cartes static test server: http://${host}:${port}`);
  console.log(`Serving: ${publicDir}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
