// T0 (docs/plano-treino-robusto.md): antes de treinar o comportamento, o treino muda o cérebro? A e B são equivalentes?
// Worker real em thread Node (mesma ponte de treino_memoria_triagem.mjs). Para cada semente e condição (plasticidade
// ligada e congelada): apresenta A e B sozinhos (sonda, sem recompensa), faz o treino do protocolo com A recompensado,
// e apresenta A e B de novo. Mede:
//  1. a resposta das saídas do corpo cogumelar (MBONs) e de alguns descendentes a cada pista, antes e depois;
//  2. quantas células de Kenyon (KCs) cada pista liga e a sobreposição dos dois padrões (Jaccard).
// Grava docs/medicoes/t0-cerebro.json.   uso: node scripts/t0_cerebro.mjs [sementes, ex.: 29,101,202]
import { readFileSync, writeFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import '../web/treino-protocolo.js';

const sementes = (process.argv[2] || '29,101,202').split(',').map(Number);
const meta = JSON.parse(readFileSync('web/data/meta.json', 'utf8'));
const G = meta.groups, kcSet = new Set(G.kc);
const SONDA_S = 2, PAUSA_S = 3, REPS_SONDA = 2;   // cada pista 2 s, 3 s sem odor entre sondas, 2 vezes cada
const GRUPOS = ['mbon_aprox', 'mbon_evitar', 'mbon_evitar_rec', 'kc', 'dirige_L', 'dirige_R', 'moonwalker', 'proboscide'].filter(g => G[g]);

const codigo = readFileSync('web/sim-worker.js', 'utf8');
const ponte = `
const {parentPort}=require('node:worker_threads');
const {readFileSync}=require('node:fs');
let onmessage;
globalThis.postMessage=m=>parentPort.postMessage(m);
globalThis.fetch=async url=>{
 const b=readFileSync('web/'+url.split('?')[0]);let lido=false;
 return {ok:true,headers:{get:()=>String(b.length)},json:async()=>JSON.parse(b),
 body:{getReader:()=>({read:async()=>lido?{done:true}:(lido=true,{done:false,value:new Uint8Array(b)})})}};
};`;
const rodape = `
parentPort.on('message',data=>{
 if(data.type==='semente'){let s=data.valor;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
 else onmessage({data});
});`;
const w = new Worker(ponte + codigo + rodape, { eval: true });
let receptor = () => {};
w.on('message', m => receptor(m)); w.on('error', e => { console.error(e); process.exit(1); });
const envia = d => w.postMessage(d);
await new Promise((ok, fail) => { receptor = m => { if (m.type === 'ready') ok(); if (m.type === 'error') fail(Error(m.message)); }; envia({ type: 'load' }); });

let passo = 0;
const tique = rates => new Promise(ok => { receptor = m => { if (m.type === 'tick') ok(m); }; envia({ type: 'rates', rates }); envia({ type: 'passoDuplo', passo: passo++ }); });
const odor = p => Object.fromEntries(ProtocoloMemoria.cheiros[p].flatMap(g => ['L', 'R'].map(l => ['ORN_' + g + '_' + l, 100])));
// roda `s` segundos com as taxas; devolve Hz por neurônio de cada grupo e o conjunto de KCs que dispararam
async function roda(s, rates) {
  const cont = Object.fromEntries(GRUPOS.map(g => [g, 0])), kcs = new Set();
  let ultimo;
  for (let i = 0; i < Math.round(s * 100); i++) {
    ultimo = await tique(rates);
    for (const g of GRUPOS) cont[g] += ultimo.counts[g] || 0;
    for (const id of ultimo.spikes) if (kcSet.has(id)) kcs.add(id);
  }
  return { hz: Object.fromEntries(GRUPOS.map(g => [g, cont[g] / G[g].length / s])), kcs, memoryR: ultimo.memoryR };
}
async function sonda() {
  const r = { A: [], B: [] };
  for (let k = 0; k < REPS_SONDA; k++) for (const p of ['A', 'B']) { r[p].push(await roda(SONDA_S, odor(p))); await roda(PAUSA_S, {}); }
  const junta = p => ({ hz: Object.fromEntries(GRUPOS.map(g => [g, r[p].reduce((a, x) => a + x.hz[g], 0) / REPS_SONDA])),
    kcs: new Set(r[p].flatMap(x => [...x.kcs])), kcsPorApresentacao: r[p].map(x => x.kcs.size) });
  return { A: junta('A'), B: junta('B') };
}
const jaccard = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1); };
const arred = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(3)]));

const resultados = [];
for (const semente of sementes) for (const ativa of [true, false]) {
  envia({ type: 'reset' }); envia({ type: 'params', plasticidade: ativa }); envia({ type: 'semente', valor: semente });
  await roda(2, {});   // assentar
  const antes = await sonda();
  const fases = ProtocoloMemoria.fases({ alvo: 'A', repeticoes: 3, segundos: 0 });
  const iTreino = fases.findIndex(f => f.nome.startsWith('Treino')), iDepois = fases.findIndex(f => f.nome === 'Depois do treino');
  let memoryR = 0;
  for (const f of fases.slice(iTreino, iDepois)) for (let i = 0; i < Math.round(f.duracao * 100); i++) memoryR = (await tique(ProtocoloMemoria.taxas(f, i / 100))).memoryR;
  await roda(PAUSA_S, {});
  const depois = await sonda();
  const delta = p => arred(Object.fromEntries(GRUPOS.map(g => [g, depois[p].hz[g] - antes[p].hz[g]])));
  const r = {
    semente, plasticidade: ativa, memoriaR_fim_treino: +memoryR.toFixed(5),
    kcs: { A: antes.A.kcs.size, B: antes.B.kcs.size, fracaoA: +(antes.A.kcs.size / G.kc.length).toFixed(4), fracaoB: +(antes.B.kcs.size / G.kc.length).toFixed(4),
      porApresentacao: { A: antes.A.kcsPorApresentacao, B: antes.B.kcsPorApresentacao }, jaccardAB: +jaccard(antes.A.kcs, antes.B.kcs).toFixed(4),
      jaccardA_antesDepois: +jaccard(antes.A.kcs, depois.A.kcs).toFixed(4) },
    hz_antes: { A: arred(antes.A.hz), B: arred(antes.B.hz) }, hz_depois: { A: arred(depois.A.hz), B: arred(depois.B.hz) },
    delta: { A: delta('A'), B: delta('B') },
  };
  resultados.push(r);
  console.log(JSON.stringify({ semente, plasticidade: ativa, memoriaR: r.memoriaR_fim_treino, kcs: r.kcs.A + '/' + r.kcs.B, jaccardAB: r.kcs.jaccardAB,
    dEvitarRec: { A: r.delta.A.mbon_evitar_rec, B: r.delta.B.mbon_evitar_rec }, dAprox: { A: r.delta.A.mbon_aprox, B: r.delta.B.mbon_aprox } }));
}
writeFileSync('docs/medicoes/t0-cerebro.json', JSON.stringify({
  metodo: `Worker real em thread Node, sementes ${sementes.join(', ')}. Sonda: cada pista (A = VA2+DM4, B = DP1l+DM2; ORNs a 100 Hz bilateral) por ${SONDA_S} s, ${REPS_SONDA} vezes, com ${PAUSA_S} s sem odor entre sondas, sem recompensa. Treino: fases de "Treino" do protocolo padrão com A recompensado (3 repetições de cada pista, PAM a 100 Hz nos últimos 500 ms do pareamento). Hz por neurônio de cada grupo, média das apresentações. KCs = neurônios do grupo kc que dispararam ao menos uma vez nas apresentações; Jaccard = interseção/união. delta = depois - antes. Esperado pela regra do modelo: o açúcar enfraquece KC -> mbon_evitar_rec; com plasticidade, a resposta de mbon_evitar_rec a A cai e a de B muda pouco; congelado, nada muda.`,
  resultados }, null, 1) + '\n');
console.log('gravado em docs/medicoes/t0-cerebro.json');
await w.terminate();
