/* ====================== Voix naturelle Kokoro (côté page) ======================
   KokoroVoice.enable(onProgress)  télécharge (≈110 Mo, une seule fois) et prépare la voix ; à appeler sur un geste (clic).
   KokoroVoice.say(text)           lit le texte ; renvoie une promesse résolue à la fin de la lecture.
                                   Tant que la voix n'est pas prête, passe la main à KokoroVoice.fallback (voix du navigateur).
   KokoroVoice.prepare(text)       synthétise à l'avance (phrases fréquentes, meilleur coup déjà connu…).
   KokoroVoice.stop()              coupe la lecture en cours.
   Les fichiers sont chargés par URL relative depuis KokoroVoice.base (par défaut « voix/»). */
const KokoroVoice = (() => {
  const KEY = 'pionpasse:kokoro';
  const api = {
    base: 'voix/',
    status: 'off',          // off | loading | ready | error
    progress: 0,
    threads: 1,
    error: null,
    fallback: text => (typeof Voice !== 'undefined' && Voice.say ? Voice.say(text) : undefined),
    onchange: null,
    supported: typeof WebAssembly === 'object' && typeof Worker === 'function' && !!(window.AudioContext || window.webkitAudioContext),
  };
  let worker = null, ctx = null, loading = null, seq = 0, playing = [], token = 0, wake = () => {};
  const pending = new Map();           // id → {resolve, reject}
  const cache = new Map();             // phrase → Float32Array (les 80 dernières)
  const fixed = new Map();             // phrases fixes pré-enregistrées (phrases.json + phrases.pcm)
  let fixedLoading = null;

  const changed = () => { try { api.onchange && api.onchange(api); } catch (e) {} };
  const remember = v => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} };
  api.wanted = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };

  function audioContext() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // Les navigateurs mobiles n'autorisent le son qu'après un geste : on réveille l'audio au premier toucher.
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }, { passive: true }));

  // phrases.json : { files: [...], index: { phrase: [fichier, début, longueur] } } (ancien format : { phrase: [début, longueur] }).
  function loadFixed() {
    if (!fixedLoading) fixedLoading = fetch(api.base + 'phrases.json', { cache: 'no-cache' }).then(r => r.json()).then(meta => {
      const files = meta.files || ['phrases.pcm.wasm'], index = meta.index || meta;
      return Promise.all(files.map(f => fetch(api.base + f, { cache: 'no-cache' }).then(r => r.arrayBuffer()))).then(bufs => {
        const pcm = bufs.map(b => new Int16Array(b));
        for (const [text, e] of Object.entries(index)) {
          const [f, o, n] = e.length === 3 ? e : [0, e[0], e[1]];
          fixed.set(text, Float32Array.from(pcm[f].subarray(o, o + n), x => x / 32768));
        }
      });
    }).catch(() => {});
    return fixedLoading;
  }

  api.enable = function (onProgress) {
    if (!api.supported) return Promise.reject(new Error('Navigateur non compatible'));
    audioContext();
    loadFixed();
    if (loading) return loading;
    api.status = 'loading'; api.error = null; changed();
    worker = new Worker(api.base + 'kokoro-worker.js', { type: 'module' });
    loading = new Promise((resolve, reject) => {
      worker.onmessage = e => {
        const m = e.data;
        if (m.type === 'progress') { api.progress = m.ratio; onProgress && onProgress(m.ratio); changed(); }
        else if (m.type === 'ready') { api.status = 'ready'; api.threads = m.threads; api.progress = 1; remember(true); changed(); resolve(api); }
        else if (m.type === 'error') { api.status = 'error'; api.error = m.message; loading = null; worker.terminate(); worker = null; changed(); reject(new Error(m.message)); }
        else if (m.type === 'audio') {
          const p = pending.get(m.id); pending.delete(m.id);
          if (p) m.error ? p.reject(new Error(m.error)) : p.resolve(m.audio);
        }
      };
      worker.onerror = e => { api.status = 'error'; api.error = e.message || 'erreur du module vocal'; loading = null; changed(); reject(new Error(api.error)); };
      worker.postMessage({ type: 'init' });
    });
    return loading;
  };

  api.disable = function () { api.stop(); remember(false); if (worker) worker.terminate(); worker = null; loading = null; api.status = 'off'; changed(); };

  function clean(text) {
    return String(text).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  }
  // Une phrase par synthèse : la première est prête vite, les suivantes se calculent pendant la lecture.
  function sentences(text) {
    const out = [];
    for (const s of clean(text).split(/(?<=[.!?…])\s+/)) {
      if (!s) continue;
      if (s.length <= 220) { out.push(s); continue; }
      let cur = '';
      for (const part of s.split(/(?<=[,;:])\s+/)) { if ((cur + ' ' + part).length > 220 && cur) { out.push(cur); cur = part; } else cur = cur ? cur + ' ' + part : part; }
      if (cur) out.push(cur);
    }
    return out;
  }
  function synth(s) {
    if (fixed.has(s)) return Promise.resolve(fixed.get(s));
    if (cache.has(s)) { const a = cache.get(s); cache.delete(s); cache.set(s, a); return Promise.resolve(a); }
    const id = ++seq;
    const p = new Promise((resolve, reject) => pending.set(id, { resolve, reject })).then(a => {
      cache.set(s, a); if (cache.size > 80) cache.delete(cache.keys().next().value);
      return a;
    });
    worker.postMessage({ type: 'synth', id, text: s });
    return p;
  }

  api.prepare = function (text) {
    if (api.status !== 'ready') return Promise.resolve();
    return Promise.all(sentences(text).map(s => synth(s).catch(() => null)));
  };

  api.stop = function () {
    token++; wake();
    playing.forEach(src => { try { src.stop(); } catch (e) {} });
    playing = [];
  };

  api.say = async function (text) {
    api.stop();
    const parts = sentences(text);
    // Pas encore prête : seules les phrases pré-enregistrées peuvent être dites avec la voix naturelle.
    if (api.status !== 'ready' && !(api.status === 'loading' && parts.length && parts.every(s => fixed.has(s)))) return api.fallback(text);
    try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch (e) {}
    const my = token, ac = audioContext();
    const stopped = new Promise(r => { wake = r; });
    const jobs = parts.map(s => synth(s));
    let t = 0;
    for (const job of jobs) {
      let audio;
      try { audio = await Promise.race([job, stopped]); } catch (e) { continue; }
      if (my !== token) return;
      const buf = ac.createBuffer(1, audio.length, 24000);
      buf.getChannelData(0).set(audio);
      const src = ac.createBufferSource();
      src.buffer = buf; src.connect(ac.destination);
      t = Math.max(t, ac.currentTime + 0.02);
      src.start(t);
      t += buf.duration + 0.12;
      playing.push(src);
      src.onended = () => { playing = playing.filter(x => x !== src); };
    }
    // Attendre la fin de la dernière phrase.
    while (my === token && playing.length) await Promise.race([stopped, new Promise(r => setTimeout(r, 120))]);
  };

  // Si la voix a déjà été téléchargée, on la recharge (depuis le cache) au démarrage.
  if (api.supported && api.wanted()) setTimeout(() => api.enable().catch(() => {}), 1500);
  return api;
})();
