// Simulação LIF do sistema nervoso central da mosca (Male CNS v1.0, Janelia),
// nos moldes de Shiu et al. 2024 (Nature). Roda numa thread separada.
'use strict';

const V_REST = -52, V_TH = -45, V_RESET = -52;
const TAU_M = 20, TAU_SYN = 5, T_REF = 2.2, DELAY = 1.8; // ms
const W_SYN = 0.275;            // mV por sinapse
const GAIN = 0.5;               // este mapa é mais denso que o FlyWire; calibrado para não entrar em convulsão
const W_EXT = 250 * W_SYN;      // entrada Poisson forte, como em Shiu et al.
const DT = 0.25;                // ms
const REPORT_MS = 10;           // relatório para a página a cada 10 ms de tempo cerebral
const EPS = 5e-3;
const EPS_A = 0.05;             // abaixo disso a adaptação é desprezível (0,05 mV)
// adaptação lenta: cada spike deixa o neurônio um pouco "cansado" (hiperpolariza).
// Só pesa em quem dispara sem parar, e é o que desliga os circuitos que se sustentam sozinhos.
let A_INC = 0.3, TAU_A = 1000;   // mV por spike, ms

// Aprendizado no corpo cogumelar (a "dor"):
// - as saídas (MBONs) ficam perto do limiar, como as reais, que disparam espontaneamente
// - cada célula de Kenyon deixa um rastro quando dispara (quem estava sentindo o cheiro)
// - quando a dopamina de punição (PPL1) chega, as conexões Kenyon -> MBON "aproximar"
//   das células com rastro enfraquecem. Da próxima vez, aquele cheiro atrai menos.
const MBON_BIAS = 6.8;           // mV
const TAU_E = 400;               // ms, duração do rastro (só conta quem cheirava na hora da dor)
let ETA = 0.006;                 // enfraquecimento por spike de dopamina
let W_FLOOR = 0.1;               // a conexão nunca cai abaixo desta fração do original
let bias, isKC, kcIds, kcTrace, plastK, plastPre, w0plast, plStart, plEnd, memory = 0;

let N, indptr, idx, w, sign;
let v, g, ad, ref, isActive, active, nActive = 0;
let ring, ringLen, ringSlot = 0, D;
let groups = {}, outGroups = {}, rates = {};
let t = 0, running = false;
let spikeBuf, spikeCount = 0;
let lastWall = 0, simSinceWall = 0;

async function fetchBytes(url, onBytes, tries = 3) {
  try { return await fetchOnce(url, onBytes); }
  catch (err) {
    if (tries <= 1) throw err;
    await new Promise(r => setTimeout(r, 800));
    return fetchBytes(url, onBytes, tries - 1);
  }
}

// os binários vêm em base64 (a hospedagem só serve texto); decodifica direto dos bytes ASCII
const B64 = new Uint8Array(128);
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((c, i) => { B64[c.charCodeAt(0)] = i; });
function b64decode(src) {
  let len = src.length;
  while (len && (src[len - 1] === 61 || src[len - 1] === 10 || src[len - 1] === 13)) len--;
  const out = new Uint8Array(Math.floor(len * 3 / 4));
  let o = 0, i = 0;
  for (; i + 4 <= len; i += 4) {
    const n = (B64[src[i]] << 18) | (B64[src[i + 1]] << 12) | (B64[src[i + 2]] << 6) | B64[src[i + 3]];
    out[o++] = n >> 16; out[o++] = (n >> 8) & 255; out[o++] = n & 255;
  }
  const r = len - i;
  if (r >= 2) {
    const n = (B64[src[i]] << 18) | (B64[src[i + 1]] << 12) | (r === 3 ? B64[src[i + 2]] << 6 : 0);
    out[o++] = n >> 16;
    if (r === 3) out[o++] = (n >> 8) & 255;
  }
  return out;
}

async function fetchOnce(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  const parts = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length; onBytes(value.length, total);
  }
  const out = new Uint8Array(got); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function load() {
  const meta = await (await fetch('data/meta.json', { cache: 'no-cache' })).json();
  N = meta.neurons;
  const files = ['neurons.b64.txt', 'indptr.b64.txt', 'w.b64.txt', ...meta.chunks.map(c => c.file)];
  let loaded = 0; const totalGuess = 26e6;
  const bufs = {};
  await Promise.all(files.map(async f => {
    bufs[f] = await fetchBytes('data/' + f, n => {
      loaded += n;
      postMessage({ type: 'progress', loaded, total: totalGuess, stage: 'Baixando o conectoma' });
    });
  }));
  postMessage({ type: 'progress', loaded: totalGuess, total: totalGuess, stage: 'Montando as conexões' });
  for (const f of files) bufs[f] = b64decode(bufs[f]);

  const nb = bufs['neurons.b64.txt'];
  const dv = new DataView(nb.buffer);
  rawSign = new Int8Array(N);
  for (let i = 0; i < N; i++) rawSign[i] = dv.getInt8(i * 8 + 7);
  sign = new Float32Array(N);
  setGain(gain);
  indptr = new Uint32Array(bufs['indptr.b64.txt'].buffer);
  w = Float32Array.from(bufs['w.b64.txt']);   // float para poder mudar com o aprendizado
  idx = new Int32Array(meta.edges);
  // varint + delta por linha
  let e = 0, row = 0, prev = 0;
  for (const c of meta.chunks) {
    const b = bufs[c.file];
    let p = 0;
    for (let k = 0; k < c.edges; k++) {
      let val = 0, shift = 0, byte;
      do { byte = b[p++]; val += (byte & 0x7f) * 2 ** shift; shift += 7; } while (byte & 0x80);
      while (indptr[row + 1] <= e) { row++; }
      const rowStart = e === indptr[row];
      prev = rowStart ? val : prev + val;
      idx[e++] = prev;
    }
  }

  groups = {};
  for (const [k, ids] of Object.entries(meta.groups)) groups[k] = Int32Array.from(ids);
  setGain(gain);
  v = new Float32Array(N).fill(V_REST);
  g = new Float32Array(N);
  ad = new Float32Array(N);
  ref = new Float32Array(N);
  isActive = new Uint8Array(N);
  active = new Int32Array(N);
  D = Math.round(DELAY / DT);
  ringLen = D + 1;
  ring = Array.from({ length: ringLen }, () => ({ ids: new Int32Array(N), n: 0 }));
  spikeBuf = new Int32Array(N);
  for (const k of Object.keys(groups)) outGroups[k] = 0;
  bias = new Float32Array(N);
  for (const k of ['mbon_aprox', 'mbon_evitar']) for (const i of groups[k]) bias[i] = MBON_BIAS;
  restState();
  buildPlastic();
  postMessage({ type: 'ready', neurons: N, edges: meta.edges, odorPool: meta.odorPool,
    sizes: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])) });
}

let rawSign, gain = GAIN;
function setGain(k) {
  gain = k;
  for (let i = 0; i < N; i++) sign[i] = rawSign[i] * W_SYN * gain;
  // a dopamina não é um transmissor rápido: os PPL1 agem só pelo aprendizado (em learn)
  if (groups.dor) for (const i of groups.dor) sign[i] = 0;
}

function restState() {
  v.fill(V_REST); g.fill(0); ad.fill(0); ref.fill(0); isActive.fill(0); nActive = 0;
  for (let i = 0; i < N; i++) if (bias[i]) v[i] = V_REST + bias[i];
}

function buildPlastic() {
  const isAprox = new Uint8Array(N);
  for (const i of groups.mbon_aprox) isAprox[i] = 1;
  isKC = new Uint8Array(N);
  kcIds = groups.kc;
  for (const i of kcIds) isKC[i] = 1;
  const ks = [], ps = [];
  plStart = new Int32Array(N); plEnd = new Int32Array(N);
  for (const j of kcIds) {
    plStart[j] = ks.length;
    for (let k = indptr[j]; k < indptr[j + 1]; k++) if (isAprox[idx[k]]) { ks.push(k); ps.push(j); }
    plEnd[j] = ks.length;
  }
  plastK = Int32Array.from(ks); plastPre = Int32Array.from(ps);
  w0plast = Float32Array.from(ks, k => w[k]);
  kcTrace = new Float32Array(N);
}

function learn(danSpikes) {
  const decay = Math.exp(-REPORT_MS / TAU_E);
  for (const j of kcIds) kcTrace[j] *= decay;
  // cada disparo soma 1/3 (no máximo 1): só fica bem marcada quem disparou várias vezes,
  // ou seja, quem sentia o cheiro forte; o cheiro fraco de um botão vizinho quase não conta
  for (let s = 0; s < spikeCount; s++) { const i = spikeBuf[s]; if (isKC[i]) kcTrace[i] = Math.min(1, kcTrace[i] + 0.34); }
  if (!danSpikes) return false;
  let changed = false;
  for (let p = 0; p < plastK.length; p++) {
    const tr = kcTrace[plastPre[p]];
    if (tr < 0.2) continue;
    const k = plastK[p];
    w[k] = Math.max(W_FLOOR * w0plast[p], w[k] * (1 - ETA * danSpikes * tr));
    changed = true;
  }
  if (changed) updateMemoryStat();
  return changed;
}

function updateMemoryStat() {
  let a = 0, b = 0;
  for (let p = 0; p < plastK.length; p++) { a += w[plastK[p]]; b += w0plast[p]; }
  memory = 1 - a / b;
}

// Memória para guardar: só as sinapses que a dor mudou, como fração da força original (0–255)
function exportMemory() {
  const idx = [], r = [];
  for (let p = 0; p < plastK.length; p++) {
    const f = w[plastK[p]] / w0plast[p];
    if (f < 0.995) { idx.push(p); r.push(Math.round(f * 255)); }
  }
  return { n: plastK.length, edges: w.length, idx: Int32Array.from(idx), r: Uint8Array.from(r) };
}
function importMemory(m) {
  if (!m || m.n !== plastK.length || m.edges !== w.length) return false;   // mapa diferente: ignora
  forget();
  for (let i = 0; i < m.idx.length; i++) { const p = m.idx[i]; w[plastK[p]] = w0plast[p] * m.r[i] / 255; }
  updateMemoryStat();
  return true;
}
function forget() {
  for (let p = 0; p < plastK.length; p++) w[plastK[p]] = w0plast[p];
  kcTrace.fill(0); memory = 0;
}

function poisson(mean) {
  if (mean <= 0) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss()));
  const L = Math.exp(-mean);
  let k = 0, p = Math.random();
  while (p > L) { k++; p *= Math.random(); }
  return k;
}
function gauss() {
  return Math.sqrt(-2 * Math.log(Math.random() || 1e-12)) * Math.cos(2 * Math.PI * Math.random());
}

function touch(i) {
  if (!isActive[i]) { isActive[i] = 1; active[nActive++] = i; }
}

function step() {
  // 1) spikes que chegam agora (atraso sináptico)
  const slot = ring[ringSlot];
  for (let s = 0; s < slot.n; s++) {
    const j = slot.ids[s], sj = sign[j];
    for (let k = indptr[j], end = indptr[j + 1]; k < end; k++) {
      const post = idx[k];
      g[post] += w[k] * sj;
      touch(post);
    }
  }
  slot.n = 0;

  // 2) entrada sensorial (Poisson)
  // sorteia QUANTOS neurônios do grupo recebem um spike (Poisson) e depois QUAIS;
  // equivale a sortear um por um, mas custa proporcional aos spikes, não ao tamanho do grupo
  for (const k in rates) {
    const r = rates[k];
    if (!(r > 0)) continue;
    const ids = groups[k];
    const n = poisson(ids.length * r * DT / 1000);
    for (let s = 0; s < n; s++) { const i = ids[(Math.random() * ids.length) | 0]; g[i] += W_EXT; touch(i); }
  }

  // 3) integra só quem está fora do repouso
  const out = ring[(ringSlot + D) % ringLen];
  const kM = DT / TAU_M, kS = DT / TAU_SYN, kA = DT / TAU_A;
  let n = 0;
  for (let a = 0; a < nActive; a++) {
    const i = active[a];
    let vi = v[i];
    const gi = g[i], ai = ad[i];
    if (ref[i] > 0) ref[i] -= DT;
    else vi += kM * ((V_REST - vi) + gi - ai + bias[i]);
    g[i] = gi - kS * gi;
    ad[i] = ai - kA * ai;
    if (vi >= V_TH) {
      vi = V_RESET; ref[i] = T_REF; ad[i] += A_INC;
      out.ids[out.n++] = i;
      if (spikeCount < N) spikeBuf[spikeCount++] = i;
    }
    v[i] = vi;
    const rest = V_REST + bias[i];
    if (ref[i] <= 0 && Math.abs(g[i]) < EPS && Math.abs(vi - rest) < EPS && ad[i] < EPS_A) {
      v[i] = rest; g[i] = 0; ad[i] = 0; isActive[i] = 0;
    } else {
      active[n++] = i;
    }
  }
  nActive = n;
  ringSlot = (ringSlot + 1) % ringLen;
  t += DT;
}

let isOut;
function buildOutIndex() {
  // mapeia neurônio -> lista de grupos (poucos neurônios pertencem a algum grupo)
  isOut = new Map();
  for (const [k, ids] of Object.entries(groups)) {
    for (const i of ids) {
      if (!isOut.has(i)) isOut.set(i, []);
      isOut.get(i).push(k);
    }
  }
}

function loop() {
  if (!running) return;
  const wall0 = performance.now();
  // não deixa o cérebro correr mais rápido que o tempo real
  const now = wall0;
  if (lastWall) simSinceWall -= (now - lastWall);
  lastWall = now;
  if (simSinceWall > 50) { setTimeout(loop, 4); return; }

  const tStart = t;
  const counts = {};
  const steps = Math.round(REPORT_MS / DT);
  for (let s = 0; s < steps; s++) step();
  for (let s = 0; s < spikeCount; s++) {
    const gs = isOut.get(spikeBuf[s]);
    if (gs) for (const k of gs) counts[k] = (counts[k] || 0) + 1;
  }
  const learned = learn(counts.dor || 0);
  // força que as células de Kenyon ativas agora passam às saídas "aproximar", comparada com a
  // força original dessas mesmas sinapses: 1 = cheiro nunca punido, menos = enfraquecido pela dor
  let kcDrive = 0, kcBase = 0;
  for (let s = 0; s < spikeCount; s++) {
    const j = spikeBuf[s];
    if (!isKC[j]) continue;
    for (let p = plStart[j]; p < plEnd[j]; p++) { kcDrive += w[plastK[p]]; kcBase += w0plast[p]; }
  }
  const spikes = spikeBuf.slice(0, spikeCount);
  spikeCount = 0;
  const wallMs = performance.now() - wall0;
  simSinceWall += REPORT_MS;
  postMessage({ type: 'tick', t, dtSim: t - tStart, wallMs, nActive, counts, spikes, memory, learned, kcDrive, kcBase }, [spikes.buffer]);
  setTimeout(loop, 0);
}

onmessage = async ({ data }) => {
  if (data.type === 'load') {
    try { await load(); buildOutIndex(); }
    catch (err) { postMessage({ type: 'error', message: String(err && err.message || err) }); }
  } else if (data.type === 'params') {
    if (data.gain != null) setGain(data.gain);
    if (data.aInc != null) A_INC = data.aInc;
    if (data.tauA != null) TAU_A = data.tauA;
    if (data.eta != null) ETA = data.eta;
    if (data.floor != null) W_FLOOR = data.floor;
  } else if (data.type === 'rates') {
    rates = data.rates;
  } else if (data.type === 'run') {
    if (!running && data.on) { running = true; lastWall = 0; simSinceWall = 0; loop(); }
    running = data.on;
  } else if (data.type === 'reset') {
    if (!plastK) return;   // ainda carregando
    restState();
    for (const s of ring) s.n = 0;
    spikeCount = 0; t = 0;
    if (data.keepMemory) kcTrace.fill(0); else forget();
  } else if (data.type === 'getMemory') {
    if (!plastK) return;
    const m = exportMemory();
    postMessage({ type: 'memoryDump', memory: m, strength: memory }, [m.idx.buffer, m.r.buffer]);
  } else if (data.type === 'setMemory') {
    if (!plastK) return;
    const ok = importMemory(data.memory);
    postMessage({ type: 'memoryLoaded', ok, strength: memory, changed: ok ? data.memory.idx.length : 0 });
  } else if (data.type === 'forget') {
    if (!plastK) return;
    forget();
  }
};
