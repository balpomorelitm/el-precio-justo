import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const base = path.resolve(process.argv.includes('--dist') ? 'dist' : '.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (name === '/') name = '/index.html';
    const file = path.resolve(base, `.${name}`);
    if (!file.startsWith(`${base}${path.sep}`)) throw Error('Forbidden');
    if (!(await stat(file)).isFile()) throw Error('Not found');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('No encontrado'); }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Vista previa: http://127.0.0.1:4173'));
