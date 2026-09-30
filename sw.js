const C = 'teevi-v3';
const CORE = ['./', 'index.html', 'manifest.json', 'pwa.js', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(C).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
// Cache d'abord (rapide + hors-ligne), mise à jour en arrière-plan
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith('http') || /tiktok/.test(new URL(r.url).hostname)) return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(r, { ignoreSearch: r.mode === 'navigate' });
    const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || (r.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});
