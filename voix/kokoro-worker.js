/* Voix neuronale Kokoro (voix française ff_siwis) exécutée dans le navigateur.
   Texte → phonèmes (eSpeak NG en WebAssembly) → audio 24 kHz (Kokoro-82M, ONNX Runtime Web).
   Messages reçus : {type:'init'} puis {type:'synth', id, text}. */
import * as ort from './ort.wasm.min.mjs';
import ESpeakNg from './espeak-ng.js';

const BASE = new URL('./', import.meta.url).href;
const CACHE = 'pp-kokoro-v1';
const MODEL_PARTS = 7, ESPEAK_PARTS = 2;

let session = null, vocab = null, voice = null, espeakModule = null;

async function getFile(name, onBytes) {
  // Les hébergeurs statiques (dont les Artifacts) ne servent pas toujours les extensions binaires inconnues :
  // les fichiers de données binaires sont publiés avec le suffixe .wasm (contenu inchangé).
  const url = BASE + name + (name.endsWith('.json') ? '' : '.wasm');
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) { const b = await hit.arrayBuffer(); onBytes && onBytes(b.byteLength); return b; } } catch (e) { cache = null; }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
  const b = await res.arrayBuffer();
  onBytes && onBytes(b.byteLength);
  if (cache) try { await cache.put(url, new Response(b)); } catch (e) {}
  return b;
}

async function getParts(prefix, n, onBytes) {
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => getFile(`${prefix}${i}`, onBytes)));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.byteLength, 0));
  let o = 0; for (const p of parts) { out.set(new Uint8Array(p), o); o += p.byteLength; }
  return out;
}

async function init() {
  const TOTAL = 111.4e6; let done = 0;
  const onBytes = n => { done += n; postMessage({ type: 'progress', ratio: Math.min(1, done / TOTAL) }); };
  const [model, espeakWasm, voiceBuf, vocabBuf] = await Promise.all([
    getParts('kokoro-q8.part', MODEL_PARTS, onBytes),
    getParts('espeak-ng.wasm.part', ESPEAK_PARTS, onBytes),
    getFile('ff_siwis.bin', onBytes),
    getFile('vocab.json'),
  ]);
  voice = new Float32Array(voiceBuf);
  vocab = JSON.parse(new TextDecoder().decode(vocabBuf));
  espeakModule = await WebAssembly.compile(espeakWasm);
  ort.env.wasm.wasmPaths = BASE;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
  session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  await synth('Bonjour.');  // premier passage plus lent : on le fait pendant le chargement
}

async function phonemize(text) {
  const es = await ESpeakNg({
    arguments: ['--phonout', 'o', '-q', '--ipa', '-v', 'fr-fr', text],
    instantiateWasm: (imports, cb) => { WebAssembly.instantiate(espeakModule, imports).then(i => cb(i)); return {}; },
    print: () => {}, printErr: () => {},
  });
  const lines = es.FS.readFile('o', { encoding: 'utf8' }).trim().split('\n').map(l => l.trim()).filter(Boolean);
  // eSpeak coupe à chaque ponctuation : on la remet pour garder les pauses et l'intonation.
  const punct = (text.match(/[.,!?;:…]+/g) || []).map(p => p[0] === '…' ? '…' : p[p.length - 1] === '?' ? '?' : p[p.length - 1] === '!' ? '!' : p[0]);
  const ps = lines.map((l, i) => l + (punct[i] || (i === lines.length - 1 ? '.' : ','))).join(' ');
  return [...ps].filter(c => c in vocab).join('');
}

async function synth(text) {
  const ps = (await phonemize(text)).slice(0, 510);
  const ids = [0, ...[...ps].map(c => vocab[c]), 0];
  const n = ids.length - 2;
  const style = voice.slice(n * 256, n * 256 + 256);
  const r = await session.run({
    input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    style: new ort.Tensor('float32', style, [1, 256]),
    speed: new ort.Tensor('float32', new Float32Array([1.05]), [1]),
  });
  const raw = r[session.outputNames[0]].data;
  // Retire les silences de début et de fin pour enchaîner les phrases sans trou.
  let a = 0, b = raw.length;
  while (a < b && Math.abs(raw[a]) < 0.01) a++;
  while (b > a && Math.abs(raw[b - 1]) < 0.01) b--;
  return raw.slice(Math.max(0, a - 240), Math.min(raw.length, b + 1200));
}

// Une seule synthèse à la fois : ONNX Runtime n'aime pas les exécutions concurrentes.
let chain = Promise.resolve();
self.onmessage = e => {
  const m = e.data;
  if (m.type === 'init') {
    init().then(() => postMessage({ type: 'ready', threads: ort.env.wasm.numThreads }), err => postMessage({ type: 'error', message: String(err && err.message || err) }));
  } else if (m.type === 'synth') {
    chain = chain.then(async () => {
      const t = performance.now();
      try {
        const audio = await synth(m.text);
        postMessage({ type: 'audio', id: m.id, audio, ms: performance.now() - t }, [audio.buffer]);
      } catch (err) { postMessage({ type: 'audio', id: m.id, error: String(err && err.message || err) }); }
    });
  }
};
