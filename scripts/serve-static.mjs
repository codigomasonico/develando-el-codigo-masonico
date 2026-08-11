import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'channels/web/public');
const port = Number(process.argv[3] || 4174);
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.webp':'image/webp','.pdf':'application/pdf'};

http.createServer(async (req,res)=>{
  try {
    const u = new URL(req.url,'http://localhost');
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (!rel) rel='index.html';
    let file = path.resolve(root, rel);
    if (!file.startsWith(root)) throw new Error('forbidden');
    try { if ((await stat(file)).isDirectory()) file=path.join(file,'index.html'); } catch {}
    const data=await readFile(file);
    res.writeHead(200, {'content-type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream','cache-control':'no-store'});
    res.end(data);
  } catch {
    res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}); res.end('Not found');
  }
}).listen(port,'127.0.0.1',()=>console.log(`Static test server: http://127.0.0.1:${port}`));
