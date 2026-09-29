// Achar bugs só com o cérebro, sem corpo (docs/plano-treino-robusto.md, B-abstrata). Worker real em thread Node.
// A cada passo, 4 ações visíveis do sistema de Pedidos (web/qa/pedidos.js); a mosca sente o cheiro de cada uma
// (4 glomérulos, 100 Hz bilateral) por 0,3 s e escolhe pela valência das saídas do corpo cogumelar (aproximar -
// evitar, Hz por neurônio) com softmax: a escolha é regra nossa, a valência é do cérebro. A decisão usa o quanto a
// valência de cada cheiro mudou desde a primeira vez (medida logo depois do reset): a parte aprendida. Sem isso, o
// viés de nascença do nosso mapeamento ação -> cheiro (de -0,66 a +1,49) dominava e ela nunca tentava as repetidas. O executor roda a ação, o
// verificador confere os contratos; uma violação nova (bug distinto) é pareada com o cheiro da ação (2 s, PAM a
// 100 Hz nos últimos 0,5 s, como no protocolo de treino). Ação sem bug não tem punição.
// Condições: ativa (treino + teste, plasticidade ligada), congelada (mesma exposição e recompensas, pesos parados),
// ingenua (só o teste, cérebro novo), aleatoria e novidade (sem cérebro). As ações visíveis de cada passo vêm de uma
// sequência sorteada antes, igual para todas as condições (comparação pareada).
//
//   node scripts/qa_abstrato.mjs [--sementes 1,2,3] [--orcamento 30] [--treinos 4] [--condicoes ativa,congelada,...]
// Acrescenta em docs/medicoes/qa-abstrato.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
const Q = createRequire(import.meta.url)('../web/qa/pedidos.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEMENTES = arg('sementes', '1,2,3').split(',').map(Number);
const ORCAMENTO = +arg('orcamento', 40), TREINOS = +arg('treinos', 4), VISIVEIS = 4, T_SOFTMAX = 0.15;
const CONDICOES = arg('condicoes', 'ativa,congelada,ingenua,aleatoria,novidade').split(',');
const SENTIR_S = 0.3, PAUSA_S = 0.2;
const meta = JSON.parse(readFileSync('web/data/meta.json', 'utf8')), G = meta.groups;

// ── worker real (mesma ponte de t0_cerebro.mjs) ──
let w, receptor = () => {}, passo = 0;
async function abreWorker() {
  const codigo = readFileSync('web/sim-worker.js', 'utf8');
  const ponte = `const {parentPort}=require('node:worker_threads');const {readFileSync}=require('node:fs');let onmessage;
globalThis.postMessage=m=>parentPort.postMessage(m);
globalThis.fetch=async url=>{const b=readFileSync('web/'+url.split('?')[0]);let lido=false;
return {ok:true,headers:{get:()=>String(b.length)},json:async()=>JSON.parse(b),body:{getReader:()=>({read:async()=>lido?{done:true}:(lido=true,{done:false,value:new Uint8Array(b)})})}};};`;
  const rodape = `parentPort.on('message',data=>{if(data.type==='semente'){let s=data.valor;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}else onmessage({data});});`;
  w = new Worker(ponte + codigo + rodape, { eval: true });
  w.on('message', m => receptor(m)); w.on('error', e => { console.error(e); process.exit(1); });
  await new Promise((ok, fail) => { receptor = m => { if (m.type === 'ready') ok(); if (m.type === 'error') fail(Error(m.message)); }; w.postMessage({ type: 'load' }); });
}
const tique = rates => new Promise(ok => { receptor = m => { if (m.type === 'tick') ok(m); }; w.postMessage({ type: 'rates', rates }); w.postMessage({ type: 'passoDuplo', passo: passo++ }); });
const odor = acao => Object.fromEntries(Q.cheiroDe(acao).flatMap(g => ['L', 'R'].map(l => ['ORN_' + g + '_' + l, 100])));
async function roda(s, rates) {
  const c = { mbon_aprox: 0, mbon_evitar: 0, mbon_evitar_rec: 0 };
  for (let i = 0; i < Math.round(s * 100); i++) { const m = await tique(rates); for (const g in c) c[g] += m.counts[g] || 0; }
  const hz = g => c[g] / G[g].length / s;
  return hz('mbon_aprox') - (hz('mbon_evitar') + hz('mbon_evitar_rec')) / 2;
}
async function sentir(acao) { const v = await roda(SENTIR_S, odor(acao)); await roda(PAUSA_S, {}); return v; }
async function recompensar(acao) {
  const o = odor(acao);
  for (let i = 0; i < 200; i++) await tique(i >= 150 ? { ...o, recompensa: 100 } : o);
  await roda(PAUSA_S, {});
}
const gerador = semente => { let s = semente >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };

// ações visíveis de cada passo, sorteadas antes (iguais para todas as condições)
function visiveis(semente, n) {
  const r = gerador(semente), out = [];
  for (let i = 0; i < n; i++) { const ids = [...Q.ACOES]; for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } out.push(ids.slice(0, VISIVEIS)); }
  return out;
}
// um episódio: devolve o passo de cada bug distinto achado
let BASE = {};   // valência de nascença de cada ação (a parte inata, descontada na decisão)
async function episodio(defeitos, vistas, politica, rnd, comCerebro) {
  const sis = Q.criar(defeitos), achados = new Set(), bugs = [], tentadas = {};
  for (let p = 0; p < ORCAMENTO; p++) {
    const opcoes = vistas[p];
    let escolha;
    if (politica === 'aleatoria') escolha = opcoes[Math.floor(rnd() * opcoes.length)];
    else if (politica === 'novidade') { const min = Math.min(...opcoes.map(a => tentadas[a.id] || 0)); const menos = opcoes.filter(a => (tentadas[a.id] || 0) === min); escolha = menos[Math.floor(rnd() * menos.length)]; }
    else {
      const v = []; for (const a of opcoes) v.push((await sentir(a)) - (BASE[a.id] ?? 0));
      const e = v.map(x => Math.exp(x / T_SOFTMAX)), soma = e.reduce((a, b) => a + b, 0);
      let u = rnd() * soma, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++;
      escolha = opcoes[k];
    }
    tentadas[escolha.id] = (tentadas[escolha.id] || 0) + 1;
    sis.executar(escolha.id);
    const novos = Q.verificar(sis).filter(x => !achados.has(x));
    if (novos.length) {
      for (const x of novos) { achados.add(x); bugs.push({ passo: p + 1, contrato: x, acao: escolha.id }); }
      if (comCerebro) await recompensar(escolha);
    }
  }
  return bugs;
}
async function valencias() { const r = {}; for (const a of Q.ACOES) r[a.id] = +(await sentir(a)).toFixed(3); return r; }

const arquivo = 'docs/medicoes/qa-abstrato.json';
const dados = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {
  metodo: `Worker real em thread Node. Sistema de Pedidos em memória (web/qa/pedidos.js), contratos no estado. ${VISIVEIS} ações visíveis por passo (sequência pré-sorteada por semente, igual entre condições); cheiro de cada ação = 4 glomérulos a 100 Hz bilateral por ${SENTIR_S} s, ${PAUSA_S} s sem odor; escolha por softmax da valência (mbon_aprox - média de mbon_evitar e mbon_evitar_rec, Hz por neurônio) menos a valência de nascença da ação (medida logo depois do reset), T = ${T_SOFTMAX}. Bug novo (contrato violado pela primeira vez no episódio): cheiro da ação por 2 s, PAM a 100 Hz nos últimos 0,5 s. Treino nas versões de treino (defeitos de repetição em pagamento e cancelamento), teste nas reservadas (repetição em cupom e estoque, quantidade negativa). A escolha por softmax e o pareamento são regras nossas; a valência e a plasticidade são do worker.`,
  rodadas: [] };
await abreWorker();
for (const semente of SEMENTES) {
  const rMundo = gerador(semente * 7919 + 1);
  const treinos = Array.from({ length: TREINOS }, (_, i) => ({ defeitos: Q.VERSOES.treino[i % Q.VERSOES.treino.length], vistas: visiveis(semente * 100 + i, ORCAMENTO) }));
  const testes = Q.VERSOES.teste.map((d, i) => ({ defeitos: d, vistas: visiveis(semente * 100 + 50 + i, ORCAMENTO) }));
  for (const cond of CONDICOES) {
    const comCerebro = ['ativa', 'congelada', 'ingenua'].includes(cond);
    const rnd = gerador(semente * 31 + 17);
    const r = { semente, condicao: cond, orcamento: ORCAMENTO, treino: [], teste: [] };
    if (comCerebro) {
      w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: cond !== 'congelada' }); w.postMessage({ type: 'semente', valor: semente });
      await roda(1, {});
      r.valencia_antes = await valencias(); BASE = r.valencia_antes;
    }
    if (cond !== 'ingenua') for (const t of treinos) r.treino.push(await episodio(t.defeitos, t.vistas, cond, rnd, comCerebro));
    if (comCerebro) r.valencia_depois_do_treino = await valencias();
    for (const t of testes) r.teste.push(await episodio(t.defeitos, t.vistas, cond, rnd, comCerebro));
    const primeiro = r.teste.map(b => (b.length ? b[0].passo : ORCAMENTO + 1));
    r.resumo = { primeiro_bug_teste_media: +(primeiro.reduce((a, b) => a + b, 0) / primeiro.length).toFixed(2), bugs_teste: r.teste.reduce((a, b) => a + b.length, 0), bugs_treino: r.treino.reduce((a, b) => a + b.length, 0) };
    dados.rodadas.push({ data: new Date().toISOString(), ...r });
    writeFileSync(arquivo, JSON.stringify(dados, null, 1) + '\n');
    console.log(JSON.stringify({ semente, cond, ...r.resumo }));
  }
}
await w.terminate();
