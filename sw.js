/* Service worker de Pion Passé : l'application fonctionne hors ligne une fois ouverte. */
const VERSION = '2ac2e20edf';
const CORE = `pp-core-${VERSION}`;
const RUNTIME = 'pp-runtime';
const ASSETS = ['./', './index.html', './chess.js', './stockfish.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS))
    .then(() => cacheFonts().catch(() => {}))
    .then(() => self.skipWaiting()));
});

// Les polices Google sont mises en cache dès l'installation pour que l'app reste jolie hors ligne.
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;600&family=Noto+Sans+Symbols+2&display=swap';
async function cacheFonts() {
  const c = await caches.open(RUNTIME);
  const res = await fetch(FONTS_CSS);
  await c.put(FONTS_CSS, res.clone());
  const urls = [...(await res.text()).matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(urls.map(u => fetch(u).then(r => r.ok && c.put(u, r))));
}

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('pp-core-') && k !== CORE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Page : le réseau d'abord (pour recevoir les mises à jour), le cache si hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CORE).then(x => x.put('./index.html', c)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Polices Google et fichiers audio : servis depuis le cache, rafraîchis en arrière-plan.
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => {
      const net = fetch(req).then(r => {
        if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(url.origin === location.origin ? CORE : RUNTIME).then(x => x.put(req, c)); }
        return r;
      }).catch(() => hit);
      return hit || net;
    }));
  }
});
