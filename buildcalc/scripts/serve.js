#!/usr/bin/env node
/** Minimal static server for ./docs (dev/preview + e2e). Usage: node scripts/serve.js [port] */
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const method = req.method || 'GET';
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' });
        return res.end();
      }
      const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(ROOT, '.' + urlPath);
      const rel = path.relative(ROOT, file);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        res.writeHead(403, SECURITY_HEADERS);
        return res.end();
      }
      let stat = await fs.stat(file).catch(() => null);
      if (stat && stat.isDirectory()) {
        if (!urlPath.endsWith('/')) {
          const safeLoc = '/' + urlPath.replace(/^\/+/, '') + '/';
          res.writeHead(301, { ...SECURITY_HEADERS, Location: safeLoc });
          return res.end();
        }
        file = path.join(file, 'index.html');
        stat = await fs.stat(file).catch(() => null);
      }
      if (!stat || !stat.isFile()) {
        const nf = await fs.readFile(path.join(ROOT, '404.html')).catch(() => 'Not found');
        res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        return res.end(method === 'HEAD' ? undefined : nf);
      }
      const body = method === 'HEAD' ? undefined : await fs.readFile(file);
      res.writeHead(200, {
        ...SECURITY_HEADERS,
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache',
      });
      res.end(body);
    } catch (err) {
      if (err instanceof URIError) {
        res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Bad Request');
      }
      res.writeHead(500, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  });
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')) {
  const port = Number(process.argv[2] || process.env.PORT || 4173);
  createServer().listen(port, '0.0.0.0', () => console.log(`BuildCalc preview → http://0.0.0.0:${port}/`));
}
