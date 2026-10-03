import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

async function walk(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await walk(`${dir}/${entry.name}`, `${name}/`));
    else if (entry.name !== 'sw.js') result.push(name);
  }
  return result.sort();
}
const files = await walk('dist');
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(`dist/${file}`));
const version = hash.digest('hex').slice(0, 16);
const worker = `
const CACHE = 'kinetics-${version}';
const ROOT = new URL('./', self.location.href);
const FILES = ${JSON.stringify(files)}.map(path => new URL(path, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('kinetics-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      // Serve the shell belonging to this worker's version, preserving asset consistency.
      return await cache.match(new URL('index.html', ROOT).href) || fetch(request);
    }
    const cached = await cache.match(url.href, { ignoreSearch: true });
    if (!cached) return fetch(request);
    const range = request.headers.get('range');
    if (!range) return cached;
    // Audio seeks need byte-range responses even when the whole song is cached.
    const bytes = await cached.arrayBuffer();
    const match = /^bytes=(\\d*)-(\\d*)$/.exec(range);
    let start = match && match[1] ? Number(match[1]) : 0;
    let end = match && match[2] ? Number(match[2]) : bytes.byteLength - 1;
    if (match && !match[1] && match[2]) {
      start = Math.max(0, bytes.byteLength - Number(match[2]));
      end = bytes.byteLength - 1;
    }
    end = Math.min(end, bytes.byteLength - 1);
    if (!match || start > end || start >= bytes.byteLength) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + bytes.byteLength } });
    }
    const headers = new Headers(cached.headers);
    headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + bytes.byteLength);
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Accept-Ranges', 'bytes');
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
  })());
});
`;
await writeFile('dist/sw.js', worker);
console.log(`PWA: precached ${files.length} files (${version})`);
