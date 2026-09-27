// Roda o worker do cérebro (web/sim-worker.js) no Node, com os dados reais e um estímulo fixo, e mede a velocidade
// e as taxas de disparo de cada grupo. Serve para conferir que uma otimização não muda o comportamento.
//
//   node scripts/worker_teste.mjs [arquivo do worker] [segundos de cérebro]
//
// Estímulo: gosto doce, cheiro (DM1 e VA2), olhos (LC10a) e tato numa pata, por todo o teste.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = process.argv[2] || join(raiz, 'web/sim-worker.js');
const segundos = +(process.argv[3] || 3);

const msgs = [];
let aoReceber = null;
const ctx = {
  // só o que o navegador dá e o JavaScript puro não tem; Math, vetores etc. ficam os da própria caixa (atravessar a
  // fronteira entre as duas a cada operação deixava tudo 10x mais lento)
  console, performance, setTimeout, clearTimeout, MessageChannel,
  postMessage: m => { msgs.push(m); if (aoReceber) aoReceber(m); },
  // fetch mínimo: lê os arquivos de web/ (o worker lê o meta com .json() e os binários por stream)
  fetch: async url => {
    const bytes = readFileSync(join(raiz, 'web', url.replace(/\?.*$/, '')));
    return {
      ok: true, headers: { get: () => String(bytes.length) },
      json: async () => JSON.parse(bytes.toString('utf8')),
      body: { getReader: () => { let dado = false; return { read: async () => dado ? { done: true } : (dado = true, { done: false, value: new Uint8Array(bytes) }) }; } },
    };
  },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(arquivo, 'utf8'), ctx, { filename: arquivo });
const envia = data => ctx.onmessage({ data });
const espera = tipo => new Promise(ok => { aoReceber = m => { if (m.type === tipo || m.type === 'error') { aoReceber = null; ok(m); } }; });

const pronto = espera('ready');
envia({ type: 'load' });
const r = await pronto;
if (r.type === 'error') throw new Error(r.message);
await new Promise(ok => setTimeout(ok, 0));   // na página, o "pronto" chega numa mensagem; o worker ainda termina de montar
const meta = JSON.parse(readFileSync(join(raiz, 'web/data/meta.json'), 'utf8'));
const tam = Object.fromEntries(Object.entries(meta.groups).map(([k, v]) => [k, v.length]));
envia({ type: 'rates', rates: { doce: 120, ORN_DM1_L: 100, ORN_DM1_R: 100, ORN_VA2_L: 80, ORN_VA2_R: 80, olho_L: 60, olho_R: 20, tato_lf: 20 } });

const cont = {}, grupos = ['kc', 'mbon_aprox', 'mbon_evitar', 'proboscide', 'dirige_L', 'dirige_R', 'dn_L', 'dn_R', 'fibra_gigante', 'recompensa', 'dor'];
let ativos = 0, ticks = 0, spikes = 0, t0 = null, w0 = 0, tFim = 0;
await new Promise(ok => {
  aoReceber = m => {
    if (m.type !== 'tick') return;
    if (t0 === null) { t0 = m.t; w0 = performance.now(); return; }
    ticks++; ativos += m.nActive; spikes += m.spikes.length;
    for (const g of grupos) cont[g] = (cont[g] || 0) + (m.counts[g] || 0);
    if (m.t - t0 >= segundos * 1000) { tFim = m.t; envia({ type: 'run', on: false }); aoReceber = null; ok(); }
  };
  envia({ type: 'run', on: true });
});
const s = (tFim - t0) / 1000, parede = (performance.now() - w0) / 1000;
console.log(JSON.stringify({
  worker: arquivo.replace(raiz, '.'), cerebro_s: +s.toFixed(2), parede_s: +parede.toFixed(1), velocidade: +(s / parede).toFixed(3),
  ativos_medio: Math.round(ativos / ticks), spikes_por_s: Math.round(spikes / s),
  hz_por_neuronio: Object.fromEntries(grupos.map(g => [g, +(cont[g] / s / tam[g]).toFixed(2)])),
}));
process.exit(0);
