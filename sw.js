/* Service worker de Pion Passé : l'application fonctionne hors ligne une fois ouverte,
   et la page est « isolée » (COOP/COEP) pour que la voix Kokoro puisse calculer sur plusieurs cœurs. */
const VERSION = '0eb6e511b7';
const CORE = `pp-core-${VERSION}`;
const ASSETS = ['./', './index.html', './chess.js', './stockfish.js', './manifest.webmanifest', './fonts.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
  './voix/kokoro-voice.js', './voix/phrases.json', './voix/phrases.pcm.wasm', './fonts/jetbrainsmono_v24_tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwgknk-6nFg.woff2', './fonts/jetbrainsmono_v24_tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwgknk-6nFg.woff2', './fonts/jetbrainsmono_v24_tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwgknk-4.woff2', './fonts/jetbrainsmono_v24_tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwgknk-6nFg.woff2', './fonts/jetbrainsmono_v24_tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwgknk-6nFg.woff2', './fonts/jetbrainsmono_v24_tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwgknk-6nFg.woff2', './fonts/notosanssymbols2_v25_I_uyMoGduATTei9eI8daxVHDyfisHr71-gTBWXPe4gsYIko.woff2', './fonts/notosanssymbols2_v25_I_uyMoGduATTei9eI8daxVHDyfisHr71-jrBWXPe4gsYIko.woff2', './fonts/notosanssymbols2_v25_I_uyMoGduATTei9eI8daxVHDyfisHr71-pTgfFz26AM.woff2', './fonts/notosanssymbols2_v25_I_uyMoGduATTei9eI8daxVHDyfisHr71-prgfFz26AMgGw.woff2', './fonts/notosanssymbols2_v25_I_uyMoGduATTei9eI8daxVHDyfisHr71-ujgfFz26AMgGw.woff2', './fonts/notosanssymbols2_v25_I_uyMoGduATTei9eI8daxVHDyfisHr71-vrgfFz26AMgGw.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxC0SmqXCzTrwvw.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxCQSmqXCzTrwvw.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxCUSmqXCzTrwvw.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxCYSmqXCzTrwvw.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxCcSmqXCzTrwvw.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxCkSmqXCzTo.woff2', './fonts/sourcesans3_v20_nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlOxCoSmqXCzTrwvw.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3w8aZejf5Hc.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3wAaZejf5HdF8Q.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3wEaZejf5HdF8Q.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3wIaZejf5HdF8Q.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3wMaZejf5HdF8Q.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3wsaZejf5HdF8Q.woff2', './fonts/sourcesans3_v20_nwpStKy2OAdR1K-IwhWudF-R3wwaZejf5HdF8Q.woff2', './fonts/zillaslab_v12_dFa5ZfeM_74wlPZtksIFYoEf6H2pW3pwfa3Efg.woff2', './fonts/zillaslab_v12_dFa5ZfeM_74wlPZtksIFYoEf6HOpW3pwfa0.woff2', './fonts/zillaslab_v12_dFa5ZfeM_74wlPZtksIFYskZ6H2pW3pwfa3Efg.woff2', './fonts/zillaslab_v12_dFa5ZfeM_74wlPZtksIFYskZ6HOpW3pwfa0.woff2', './fonts/zillaslab_v12_dFa5ZfeM_74wlPZtksIFYuUe6H2pW3pwfa3Efg.woff2', './fonts/zillaslab_v12_dFa5ZfeM_74wlPZtksIFYuUe6HOpW3pwfa0.woff2'];
// Gros fichiers de la voix : le module vocal les met lui-même en cache (pp-kokoro-v1), inutile de les doubler.
const BIG = /\/voix\/(kokoro-q8|espeak-ng\.wasm)\.part\d+\.wasm$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('pp-core-') && k !== CORE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function isolate(r) {
  if (!r || r.type === 'opaque' || r.status === 0) return r;
  const h = new Headers(r.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Page : le réseau d'abord (pour recevoir les mises à jour), le cache si hors ligne.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CORE).then(x => x.put('./index.html', c)); return isolate(r); })
      .catch(() => caches.match('./index.html').then(isolate)));
    return;
  }
  if (BIG.test(url.pathname)) { e.respondWith(fetch(req).then(isolate)); return; }
  // Le reste : depuis le cache, rafraîchi en arrière-plan.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CORE).then(x => x.put(req, c)); }
      return r;
    }).catch(() => hit);
    return (hit ? Promise.resolve(hit) : net).then(isolate);
  }));
});
