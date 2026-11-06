/*
 * Static server for the tests. Besides serving the repo, it can pretend the network is slow or that
 * a new release was published, so the offline and update behaviour can be tested.
 *
 * Each test serves the app under its own prefix, /t/<id>/..., so settings for one test never affect
 * another running at the same time. Under that prefix, /t/<id>/__ctl?... changes the settings:
 *   delay=<ms>   wait this long before answering every request
 *   release=<x>  serve sw.js with BUILD replaced by <x>, like a newly published version
 *   fail=<path>  answer <path> with a 404, like a file that failed to download
 * Without a prefix the app is served as is.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = +(process.argv[3] || 8765);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const settings = new Map(); // id -> { delay, release, fail }

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname);
    let id = null;
    const m = rel.match(/^\/t\/([\w-]+)(\/.*)$/);
    if (m) [, id, rel] = m;
    const s = (id && settings.get(id)) || {};

    if (id && rel === '/__ctl') {
      const next = { ...s };
      for (const [k, v] of url.searchParams) next[k] = k === 'delay' ? +v : v;
      settings.set(id, next);
      res.writeHead(204).end();
      return;
    }

    const send = () => {
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(ROOT, rel);
      if (
        !file.startsWith(ROOT) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile() ||
        rel.slice(1) === s.fail
      ) {
        res.writeHead(404).end('not found');
        return;
      }
      let body = fs.readFileSync(file);
      if (rel === '/sw.js' && s.release)
        body = body.toString().replace(/const BUILD = '[^']*';/, `const BUILD = '${s.release}';`);
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    };
    if (s.delay) setTimeout(send, s.delay);
    else send();
  })
  .listen(PORT, '127.0.0.1');
