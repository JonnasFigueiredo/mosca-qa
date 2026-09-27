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
const EPS = 5e-2;                // mV: abaixo disso o neurônio conta como parado (o limiar está 7 mV acima; 5e-3 mantinha 15% mais neurônios no laço sem mudar os disparos)
const EPS_A = 0.05;             // abaixo disso a adaptação é desprezível (0,05 mV)
// adaptação lenta: cada spike deixa o neurônio um pouco "cansado" (hiperpolariza).
// Só pesa em quem dispara sem parar, e é o que desliga os circuitos que se sustentam sozinhos.
let A_INC = 0.3, TAU_A = 1000;   // mV por spike, ms

// Aprendizado no corpo cogumelar:
// - as saídas (MBONs) ficam perto do limiar, como as reais, que disparam espontaneamente
// - cada célula de Kenyon deixa um rastro quando dispara (quem estava sentindo o cheiro)
// - dor: a dopamina de punição (PPL1) enfraquece Kenyon -> MBON "aproximar" das células com
//   rastro. Da próxima vez, aquele cheiro atrai menos.
// - açúcar: a dopamina de recompensa (PAM) enfraquece Kenyon -> MBON "evitar". Da próxima vez,
//   aquele cheiro repele menos, ou seja, atrai mais.
const MBON_BIAS = 6.8;           // mV
const DN_BIAS = 7.3;             // mV: neurônios de direção (DNa01-03) com tônus, como numa mosca andando
const TAU_E = 400;               // ms, duração do rastro (só conta quem cheirava na hora)
let ETA = 0.006;                 // enfraquecimento por spike de dopamina
let W_FLOOR = 0.1;               // a conexão nunca cai abaixo desta fração do original
// Fase 2: memória que muda com o tempo
// - esquecimento: a sinapse mudada volta aos poucos à força original
// - consolidação: cada nova dor (ou açúcar) na mesma sinapse deixa a memória mais estável
// - extinção: sentir o cheiro de novo sem dor (ou sem açúcar) apaga a memória mais rápido
let TAU_F = 90000;               // ms: constante de esquecimento; um erro isolado some em 2–3 min (45 s dava mais erros repetidos)
// cada episódio de dopamina consolida; normalizado por neurônio, para 12 PPL1 e 222 PAM valerem igual.
// Um erro dá ~0,35 de consolidação; três erros chegam perto de 1 (esquecimento 10× mais lento)
const CONS_PER_SPIKE_NEURON = 0.0035;
const EXT_RATE = 0.15;           // por segundo, para células de Kenyon bem ativas agora
let forgetting = true;
let bias, isKC, kcIds, kcTrace, setA, setR, memory = 0, memoryR = 0;

let N, indptr, idx, w, sign;
// estado de cada neurônio junto na memória (8 floats: voltagem, condutância, adaptação, refratário, tônus e folga):
// num passo, um neurônio ativo lê tudo de uma vez só. Com 5 vetores separados e acesso salteado, cada neurônio
// custava 5 buscas lentas na memória (medido: 37-68 ns por neurônio por passo; assim, 15-19 ns)
const F = 8, O_V = 0, O_G = 1, O_A = 2, O_R = 3, O_B = 4, O_T = 5;
// adaptação preguiçosa: um neurônio com voltagem e condutância paradas "dorme" mesmo com adaptação, guardando a hora
// (O_T = t + 1). Ao acordar, recebe o decaimento exato do tempo que passou, a·exp(-Δt/τA), e a voltagem volta ao
// equilíbrio rest - a (ela segue a adaptação com 20 ms de atraso: erro de ~2% de a). Antes, quem disparava uma vez
// ficava ~2 s no laço só para a adaptação decair
let S, act, nWords, nActive = 0;   // act: mapa de bits dos neurônios fora do repouso (percorrido em ordem crescente)
let ring, ringLen, ringSlot = 0, D;
let groups = {}, outGroups = {}, rates = {};
// entrada por neurônio (olhos reais: cada LC10a com a taxa do seu campo receptivo): ids e taxas acumuladas
let vetor = null;
let t = 0, running = false;
let spikeBuf, spikeCount = 0;
let lastWall = 0, simSinceWall = 0;
// ritmo: o cérebro corre no máximo esta fração do tempo real (com o corpo físico, a página baixa para a velocidade da física)
let ritmo = 1;
// medidor opcional (mensagem 'perf'): tempo em cada parte do passo, para achar o gargalo
let perfOn = false;
const PERF = { prop: 0, entrada: 0, integra: 0, aprende: 0, espera: 0, passos: 0, arestas: 0, ativos: 0, blocos: 0, fimBloco: 0 };

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
  S = new Float32Array(N * F);
  nWords = (N + 31) >> 5;
  act = new Uint32Array(nWords);
  D = Math.round(DELAY / DT);
  ringLen = D + 1;
  ring = Array.from({ length: ringLen }, () => ({ ids: new Int32Array(N), n: 0 }));
  spikeBuf = new Int32Array(N);
  for (const k of Object.keys(groups)) outGroups[k] = 0;
  bias = new Float32Array(N);
  for (const k of ['mbon_aprox', 'mbon_evitar']) for (const i of groups[k]) bias[i] = MBON_BIAS;
  for (const k of ['dirige_L', 'dirige_R']) for (const i of groups[k] || []) bias[i] = DN_BIAS;
  restState();
  buildPlastic();
  postMessage({ type: 'ready', neurons: N, edges: meta.edges, odorPool: meta.odorPool,
    sizes: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])) });
}

let rawSign, gain = GAIN;
function setGain(k) {
  gain = k;
  for (let i = 0; i < N; i++) sign[i] = rawSign[i] * W_SYN * gain;
  // a dopamina não é um transmissor rápido: PPL1 e PAM agem só pelo aprendizado (em learn)
  for (const k of ['dor', 'recompensa']) if (groups[k]) for (const i of groups[k]) sign[i] = 0;
}

function restState() {
  S.fill(0); act.fill(0); nActive = 0;
  for (let i = 0; i < N; i++) { S[i * F + O_V] = V_REST + bias[i]; S[i * F + O_B] = bias[i]; }
}

// Um conjunto de sinapses que aprende: Kenyon -> um grupo de saídas, agrupadas por célula de Kenyon
function buildSet(targetGroup) {
  const isT = new Uint8Array(N);
  for (const i of groups[targetGroup]) isT[i] = 1;
  const ks = [], ps = [], start = new Int32Array(N), end = new Int32Array(N);
  for (const j of kcIds) {
    start[j] = ks.length;
    for (let k = indptr[j]; k < indptr[j + 1]; k++) if (isT[idx[k]]) { ks.push(k); ps.push(j); }
    end[j] = ks.length;
  }
  return { K: Int32Array.from(ks), pre: Int32Array.from(ps), w0: Float32Array.from(ks, k => w[k]),
    c: new Float32Array(ks.length), start, end, changed: 0 };
}
function buildPlastic() {
  isKC = new Uint8Array(N);
  kcIds = groups.kc;
  for (const i of kcIds) isKC[i] = 1;
  setA = buildSet('mbon_aprox');         // a dor enfraquece
  setR = buildSet('mbon_evitar_rec');    // o açúcar enfraquece
  kcTrace = new Float32Array(N);
}

function depress(set, danSpikes, nDan) {
  const cons = CONS_PER_SPIKE_NEURON * danSpikes / nDan;
  let changed = false;
  for (let p = 0; p < set.K.length; p++) {
    const tr = kcTrace[set.pre[p]];
    if (tr < 0.2) continue;
    const k = set.K[p], w0 = set.w0[p], before = w[k];
    w[k] = Math.max(W_FLOOR * w0, before * (1 - ETA * danSpikes * tr));
    set.c[p] = Math.min(1, set.c[p] + cons * tr);
    changed = true;
  }
  if (changed) set.changed = 1;
  return changed;
}
// esquecimento e extinção: a cada passo, a sinapse mudada recupera parte da força perdida
function relax(set, withDopamine) {
  if (!set.changed) return;
  const dtS = REPORT_MS / 1000;
  let still = 0;
  for (let p = 0; p < set.K.length; p++) {
    const k = set.K[p], w0 = set.w0[p], gap = w0 - w[k];
    if (gap <= 1e-4 * w0) continue;
    const c = set.c[p];
    let rec = forgetting ? gap * REPORT_MS / (TAU_F * (1 + 9 * c * c)) : 0;
    // extinção: o cheiro está aqui (célula de Kenyon bem ativa) e a dopamina deste lado não veio
    if (!withDopamine && kcTrace[set.pre[p]] >= 0.6) rec += gap * EXT_RATE * dtS * (1 - 0.7 * c);
    w[k] += rec;
    if (w0 - w[k] > 1e-4 * w0) still++;
  }
  set.changed = still ? 1 : 0;
}
function learn(dor, acucar) {
  const decay = Math.exp(-REPORT_MS / TAU_E);
  for (const j of kcIds) kcTrace[j] *= decay;
  // cada disparo soma 1/3 (no máximo 1): só fica bem marcada quem disparou várias vezes,
  // ou seja, quem sentia o cheiro forte; o cheiro fraco de um botão vizinho quase não conta
  for (let s = 0; s < spikeCount; s++) { const i = spikeBuf[s]; if (isKC[i]) kcTrace[i] = Math.min(1, kcTrace[i] + 0.34); }
  let changed = false;
  if (dor) changed = depress(setA, dor, groups.dor.length) || changed;
  if (acucar) changed = depress(setR, acucar, groups.recompensa.length) || changed;
  relax(setA, dor > 0);
  relax(setR, acucar > 0);
  if (changed || ++statClock % 50 === 0) updateMemoryStat();
  return changed;
}
let statClock = 0;

function weakened(set) {
  let a = 0, b = 0;
  for (let p = 0; p < set.K.length; p++) { a += w[set.K[p]]; b += set.w0[p]; }
  return 1 - a / b;
}
function updateMemoryStat() { memory = weakened(setA); memoryR = weakened(setR); }

// força que as células de Kenyon ativas agora passam a um conjunto, e a força original delas
function drive(set) {
  let d = 0, b = 0;
  for (let s = 0; s < spikeCount; s++) {
    const j = spikeBuf[s];
    if (!isKC[j]) continue;
    for (let p = set.start[j]; p < set.end[j]; p++) { d += w[set.K[p]]; b += set.w0[p]; }
  }
  return [d, b];
}

// Memória para guardar: só as sinapses que mudaram, como fração da força original (0–255)
function exportSet(set) {
  const idx = [], r = [], c = [];
  for (let p = 0; p < set.K.length; p++) {
    const f = w[set.K[p]] / set.w0[p];
    if (f < 0.995 || set.c[p] > 0.01) { idx.push(p); r.push(Math.round(Math.min(1, f) * 255)); c.push(Math.round(set.c[p] * 255)); }
  }
  return { n: set.K.length, idx: Int32Array.from(idx), r: Uint8Array.from(r), c: Uint8Array.from(c) };
}
function exportMemory() {
  return { v: 3, edges: w.length, A: exportSet(setA), R: exportSet(setR) };
}
function importMemory(m) {
  // mapa ou formato diferente: ignora
  if (!m || !(m.v === 2 || m.v === 3) || m.edges !== w.length || m.A.n !== setA.K.length || m.R.n !== setR.K.length) return false;
  forget();
  for (const [set, part] of [[setA, m.A], [setR, m.R]]) {
    for (let i = 0; i < part.idx.length; i++) {
      const p = part.idx[i];
      w[set.K[p]] = set.w0[p] * part.r[i] / 255;
      if (part.c) set.c[p] = part.c[i] / 255;   // formato 2 não tinha consolidação
    }
    set.changed = 1;
  }
  updateMemoryStat();
  return true;
}
function forget() {
  for (const set of [setA, setR]) {
    for (let p = 0; p < set.K.length; p++) w[set.K[p]] = set.w0[p];
    set.c.fill(0); set.changed = 0;
  }
  kcTrace.fill(0); memory = 0; memoryR = 0;
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
  act[i >> 5] |= 1 << (i & 31);
}

function step() {
  const p0 = perfOn ? performance.now() : 0;
  // referências locais: no laço quente, o JavaScript não precisa reler as variáveis globais a cada volta
  const S_ = S, act_ = act, idx_ = idx, w_ = w, ip = indptr;
  // 1) spikes que chegam agora (atraso sináptico)
  const slot = ring[ringSlot], sids = slot.ids;
  for (let s = 0, ns = slot.n; s < ns; s++) {
    const j = sids[s], sj = sign[j];
    for (let k = ip[j], end = ip[j + 1]; k < end; k++) {
      const post = idx_[k];
      S_[post * F + O_G] += w_[k] * sj;
      act_[post >> 5] |= 1 << (post & 31);
    }
  }
  if (perfOn) { for (let s = 0; s < slot.n; s++) { const j = slot.ids[s]; PERF.arestas += indptr[j + 1] - indptr[j]; } }
  slot.n = 0;
  const p1 = perfOn ? performance.now() : 0;

  // 2) entrada sensorial (Poisson)
  // sorteia QUANTOS neurônios do grupo recebem um spike (Poisson) e depois QUAIS;
  // equivale a sortear um por um, mas custa proporcional aos spikes, não ao tamanho do grupo
  for (const k in rates) {
    const r = rates[k];
    if (!(r > 0)) continue;
    const ids = groups[k];
    const n = poisson(ids.length * r * DT / 1000);
    for (let s = 0; s < n; s++) { const i = ids[(Math.random() * ids.length) | 0]; S[i * F + O_G] += W_EXT; touch(i); }
  }
  // mesma ideia com taxa própria por neurônio: sorteia quantos spikes no total e, para cada um, qual neurônio
  // (proporcional à taxa dele, por busca binária na soma acumulada)
  if (vetor) {
    const n = poisson(vetor.total * DT / 1000), c = vetor.cum;
    for (let s = 0; s < n; s++) {
      const u = Math.random() * vetor.total;
      let lo = 0, hi = c.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < u) lo = m + 1; else hi = m; }
      const i = vetor.ids[lo]; S[i * F + O_G] += W_EXT; touch(i);
    }
  }

  const p2 = perfOn ? performance.now() : 0;
  // 3) integra só quem está fora do repouso
  const out = ring[(ringSlot + D) % ringLen];
  const kM = DT / TAU_M, kS = DT / TAU_SYN, kA = DT / TAU_A;
  let n = 0, nSp = spikeCount, nOut = out.n;
  const oids = out.ids, sbuf = spikeBuf, NW = nWords, aInc = A_INC, tAgora = t;
  for (let wi = 0; wi < NW; wi++) {
    let word = act_[wi];
    if (word === 0) continue;
    let keep = word;
    while (word !== 0) {
      const low = word & -word;
      word ^= low;
      const i = (wi << 5) | (31 - Math.clz32(low)), o = i * F;
      let vi = S_[o], gi = S_[o + O_G], ai = S_[o + O_A], ri = S_[o + O_R];
      const bi = S_[o + O_B];
      const dormiu = S_[o + O_T];
      if (dormiu > 0) {   // acordou: a adaptação decaiu enquanto dormia
        ai *= Math.exp(-(tAgora - (dormiu - 1)) / TAU_A);
        if (ai < EPS_A) ai = 0;
        vi = V_REST + bi - ai;
        S_[o + O_T] = 0;
      }
      if (ri > 0) ri -= DT;
      else vi += kM * ((V_REST - vi) + gi - ai + bi);
      gi -= kS * gi;
      ai -= kA * ai;
      if (vi >= V_TH) {
        vi = V_RESET; ri = T_REF; ai += aInc;
        oids[nOut++] = i;
        if (nSp < N) sbuf[nSp++] = i;
      }
      const rest = V_REST + bi;
      if (ri <= 0 && Math.abs(gi) < EPS && Math.abs(vi - (rest - ai)) < EPS + 0.03 * ai) {
        // parado: dorme (com a adaptação guardada, se ainda houver)
        if (ai < EPS_A) { S_[o] = rest; S_[o + O_A] = 0; }
        else { S_[o] = rest - ai; S_[o + O_A] = ai; S_[o + O_T] = tAgora + 1; }
        S_[o + O_G] = 0; S_[o + O_R] = ri;
        keep ^= low;
      } else {
        S_[o] = vi; S_[o + O_G] = gi; S_[o + O_A] = ai; S_[o + O_R] = ri;
        n++;
      }
    }
    act_[wi] = keep;
  }
  out.n = nOut; spikeCount = nSp;
  nActive = n;
  ringSlot = (ringSlot + 1) % ringLen;
  t += DT;
  if (perfOn) { const p3 = performance.now(); PERF.prop += p1 - p0; PERF.entrada += p2 - p1; PERF.integra += p3 - p2; PERF.passos++; PERF.ativos += n; }
}

// próximo bloco: MessageChannel devolve a vez às mensagens da página (taxas) sem a espera mínima de 4 ms que o
// navegador impõe a setTimeout(0) encadeado (medido: ~0,5 s de espera por segundo de cérebro)
const proximo = new MessageChannel();
proximo.port1.onmessage = () => loop();
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
  if (perfOn && PERF.fimBloco) PERF.espera += wall0 - PERF.fimBloco;
  // não deixa o cérebro correr mais rápido que o tempo real
  const now = wall0;
  if (lastWall) simSinceWall -= (now - lastWall) * ritmo;
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
  const pa = perfOn ? performance.now() : 0;
  const learned = learn(counts.dor || 0, counts.recompensa || 0);
  // quanto da força original as sinapses do cheiro atual têm, para "aproximar" e para "evitar"
  const [kcDrive, kcBase] = drive(setA);
  const [kcDriveR, kcBaseR] = drive(setR);
  const spikes = spikeBuf.slice(0, spikeCount);
  spikeCount = 0;
  const wallMs = performance.now() - wall0;
  if (perfOn) { PERF.aprende += performance.now() - pa; PERF.blocos++; PERF.fimBloco = performance.now(); }
  simSinceWall += REPORT_MS;
  postMessage({ type: 'tick', t, dtSim: t - tStart, wallMs, nActive, counts, spikes, memory, memoryR, learned, kcDrive, kcBase, kcDriveR, kcBaseR }, [spikes.buffer]);
  proximo.port2.postMessage(0);
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
    if (data.tauF != null) TAU_F = data.tauF;
    if (data.forgetting != null) forgetting = !!data.forgetting;
  } else if (data.type === 'ritmo') {
    ritmo = Math.max(0.05, Math.min(1, +data.v || 1));
  } else if (data.type === 'perf') {
    if (data.on != null) { perfOn = !!data.on; for (const k in PERF) PERF[k] = 0; }
    postMessage({ type: 'perf', perf: { ...PERF } });
  } else if (data.type === 'rates') {
    rates = data.rates;
    vetor = null;
    if (data.vetor) {
      const { ids, taxas } = data.vetor, cum = new Float64Array(ids.length);
      let s = 0;
      for (let k = 0; k < ids.length; k++) { s += taxas[k] > 0 ? taxas[k] : 0; cum[k] = s; }
      if (s > 0) vetor = { ids, cum, total: s };
    }
  } else if (data.type === 'run') {
    if (!running && data.on) { running = true; lastWall = 0; simSinceWall = 0; loop(); }
    running = data.on;
  } else if (data.type === 'reset') {
    if (!setA) return;   // ainda carregando
    restState();
    for (const s of ring) s.n = 0;
    spikeCount = 0; t = 0;
    if (data.keepMemory) kcTrace.fill(0); else forget();
  } else if (data.type === 'getMemory') {
    if (!setA) return;
    const m = exportMemory();
    postMessage({ type: 'memoryDump', memory: m, strength: memory }, [m.A.idx.buffer, m.A.r.buffer, m.A.c.buffer, m.R.idx.buffer, m.R.r.buffer, m.R.c.buffer]);
  } else if (data.type === 'setMemory') {
    if (!setA) return;
    const ok = importMemory(data.memory);
    postMessage({ type: 'memoryLoaded', ok, strength: memory, changed: ok ? data.memory.A.idx.length + data.memory.R.idx.length : 0 });
  } else if (data.type === 'forget') {
    if (!setA) return;
    forget();
  }
};
