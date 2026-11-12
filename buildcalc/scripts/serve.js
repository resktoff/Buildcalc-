#!/usr/bin/env node
/** Minimal static server for ./docs (dev/preview + e2e). Usage: node scripts/serve.js [port] */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = path.normalize(path.join(ROOT, urlPath));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      let stat = await fs.stat(file).catch(() => null);
      if (stat && stat.isDirectory()) {
        if (!urlPath.endsWith('/')) { res.writeHead(301, { Location: urlPath + '/' }); return res.end(); }
        file = path.join(file, 'index.html');
        stat = await fs.stat(file).catch(() => null);
      }
      if (!stat) {
        const nf = await fs.readFile(path.join(ROOT, '404.html')).catch(() => 'Not found');
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(nf);
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(await fs.readFile(file));
    } catch (err) {
      res.writeHead(500); res.end(String(err));
    }
  });
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  const port = Number(process.argv[2] || process.env.PORT || 4173);
  createServer().listen(port, '0.0.0.0', () => console.log(`BuildCalc preview → http://0.0.0.0:${port}/`));
}
