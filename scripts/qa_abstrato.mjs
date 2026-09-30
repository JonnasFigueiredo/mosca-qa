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
const ORCAMENTO = +arg('orcamento', 30), ORC_TREINO = +arg('orcamento-treino', 60), TREINOS = +arg('treinos', 3), VISIVEIS = +arg('visiveis', 3), T_SOFTMAX = 0.15;
const CONDICOES = arg('condicoes', 'ativa,congelada,aleatoria,novidade').split(',');
// 1 s por cheiro: com 0,3 s o ruído da valência (desvio 0,38, até 1,0) era do tamanho do efeito do aprendizado
// (~0,75); com 1 s, 0,15 (qa-calibracao.json)
let SENTIR_S = +arg('sentir', 1.0), PAUSA_S = 0.2;
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
// --desconto: a decisão desconta a valência de nascença de cada ação, medida no início e guardada numa tabela fora do
// cérebro. É memória externa (atalho); fica só para reproduzir as primeiras rodadas. O caminho honesto é calibrar os
// cheiros para nascerem com valência parecida (--calibrar-cheiros) e rodar sem desconto (--cheiros arquivo)
const DESCONTO = process.argv.includes('--desconto');
let BASE = {};
async function episodio(defeitos, vistas, politica, rnd, comCerebro, orcamento = ORCAMENTO) {
  const sis = Q.criar(defeitos), achados = new Set(), bugs = [], tentadas = {};
  for (let p = 0; p < orcamento; p++) {
    const opcoes = vistas[p];
    let escolha;
    if (politica === 'aleatoria') escolha = opcoes[Math.floor(rnd() * opcoes.length)];
    else if (politica === 'novidade') { const min = Math.min(...opcoes.map(a => tentadas[a.id] || 0)); const menos = opcoes.filter(a => (tentadas[a.id] || 0) === min); escolha = menos[Math.floor(rnd() * menos.length)]; }
    else {
      const v = []; for (const a of opcoes) v.push((await sentir(a)) - (DESCONTO ? BASE[a.id] ?? 0 : 0));
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
async function valencias(passadas = 1) { const r = {}; for (let k = 0; k < passadas; k++) for (const a of Q.ACOES) r[a.id] = (r[a.id] || 0) + (await sentir(a)) / passadas; for (const k in r) r[k] = +r[k].toFixed(3); return r; }

// --saida: outro arquivo, para rodar processos em paralelo sem um apagar os resultados do outro (qa_resumo junta todos)
const arquivo = arg('saida', 'docs/medicoes/qa-abstrato.json');
const dados = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : {
  metodo: `Worker real em thread Node. Sistema de Pedidos em memória (web/qa/pedidos.js), contratos no estado. ${VISIVEIS} ações visíveis por passo (sequência pré-sorteada por semente, igual entre condições); cheiro de cada ação = 4 glomérulos a 100 Hz bilateral por ${SENTIR_S} s, ${PAUSA_S} s sem odor; escolha por softmax da valência (mbon_aprox - média de mbon_evitar e mbon_evitar_rec, Hz por neurônio) menos a valência de nascença da ação (medida logo depois do reset), T = ${T_SOFTMAX}. Bug novo (contrato violado pela primeira vez no episódio): cheiro da ação por 2 s, PAM a 100 Hz nos últimos 0,5 s. Treino nas versões de treino (defeitos de repetição em pagamento e cancelamento), teste nas reservadas (repetição em cupom e estoque, quantidade negativa). A escolha por softmax e o pareamento são regras nossas; a valência e a plasticidade são do worker.`,
  rodadas: [] };
// --cheiros: usa os pares de glomérulos calibrados (o 'melhor' do arquivo)
if (arg('cheiros', '')) Q.usarCheiros(JSON.parse(readFileSync(arg('cheiros'), 'utf8')).melhor);
await abreWorker();
// --calibrar-cheiros: busca local nos pares de glomérulos de cada característica para que as 15 ações nasçam com
// valência perto de zero (média dos quadrados), pesos congelados, amostra de 1 s, depois de um aquecimento
if (process.argv.includes('--calibrar-cheiros')) {
  const INATOS = ['DM1', 'VA2', 'DM2', 'DM3', 'DM4', 'DP1m', 'DA2', 'V', 'DP1l'];   // cheiros da Cozinha e da bancada A/B
  const POOL = Object.keys(G).filter(k => k.startsWith('ORN_') && k.endsWith('_L')).map(k => k.slice(4, -2))
    .filter(g => !INATOS.includes(g) && G['ORN_' + g + '_L'].length >= 6);
  const r = gerador(+arg('semente-cal', 3)), ITER = +arg('iteracoes', 40);
  w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: false }); w.postMessage({ type: 'semente', valor: 5 });
  for (let i = 0; i < 15; i++) await sentir(Q.ACOES[Math.floor(r() * Q.ACOES.length)]);
  const avalia = async () => { const v = await valencias(1); const q = Object.values(v).reduce((a, x) => a + x * x, 0) / Object.keys(v).length; return { custo: q, v }; };
  let atual = JSON.parse(JSON.stringify(Q.CHEIRO)), melhor = await avalia();
  const inicial = { mapa: JSON.parse(JSON.stringify(atual)), ...melhor }, historico = [{ iter: 0, custo: +melhor.custo.toFixed(4) }];
  console.log('inicial', melhor.custo.toFixed(4));
  for (let it = 1; it <= ITER; it++) {
    const car = Object.keys(atual)[Math.floor(r() * Object.keys(atual).length)], usados = new Set(Object.values(atual).flat());
    const livres = POOL.filter(g => !usados.has(g)); if (livres.length < 1) break;
    const tentativa = JSON.parse(JSON.stringify(atual));
    tentativa[car][Math.floor(r() * 2)] = livres[Math.floor(r() * livres.length)];
    Q.usarCheiros(tentativa);
    const t = await avalia();
    if (t.custo < melhor.custo) { atual = tentativa; melhor = t; } else Q.usarCheiros(atual);
    historico.push({ iter: it, custo: +t.custo.toFixed(4), aceito: t === melhor });
    console.log(it, car, t.custo.toFixed(4), t === melhor ? 'aceito' : '', 'melhor', melhor.custo.toFixed(4));
    writeFileSync('docs/medicoes/qa-cheiros.json', JSON.stringify({ metodo: 'Busca local: a cada iteração troca um glomérulo de uma característica por outro livre (sem os da atração inata da Cozinha e da bancada A/B, com 6+ ORNs); aceita se a média dos quadrados da valência das 15 ações cai. Pesos congelados, semente 5, aquecimento de 15 cheiros; valência com amostra de 1 s. Uma medida por ação por iteração (ruído ~0,15).', inicial: { mapa: inicial.mapa, custo: inicial.custo, valencias: inicial.v }, melhor: atual, custo_melhor: melhor.custo, valencias_melhor: melhor.v, historico }, null, 1) + '\n');
  }
  await w.terminate(); process.exit(0);
}
// --calibrar: com os pesos congelados, mede o ruído da valência de cada ação (3 passadas em ordem sorteada) para
// durações de amostra diferentes, depois de um aquecimento com cheiros aleatórios
if (process.argv.includes('--calibrar')) {
  const res = {};
  w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: false }); w.postMessage({ type: 'semente', valor: 5 });
  const r = gerador(99);
  for (let i = 0; i < 20; i++) { SENTIR_S = 0.5; await sentir(Q.ACOES[Math.floor(r() * Q.ACOES.length)]); }   // aquecimento
  for (const dur of [0.3, 0.6, 1.0]) {
    SENTIR_S = dur; const med = {};
    for (let pass = 0; pass < 3; pass++) {
      const ord = [...Q.ACOES].sort(() => r() - 0.5);
      for (const a of ord) (med[a.id] ||= []).push(await sentir(a));
    }
    const dp = Object.values(med).map(v => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)); });
    res[dur] = { desvio_medio: +(dp.reduce((a, b) => a + b, 0) / dp.length).toFixed(3), desvio_max: +Math.max(...dp).toFixed(3),
      medias: Object.fromEntries(Object.entries(med).map(([k, v]) => [k, +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)])) };
    console.log(dur, 's: desvio médio', res[dur].desvio_medio, 'máx', res[dur].desvio_max);
  }
  writeFileSync('docs/medicoes/qa-calibracao.json', JSON.stringify({ metodo: 'Pesos congelados, semente 5, aquecimento de 20 cheiros aleatórios de 0,5 s; depois, para cada duração de amostra, 3 passadas pelas 15 ações em ordem sorteada; desvio-padrão da valência de cada ação entre passadas. Comparar com o efeito do aprendizado no T0 (~+0,75 Hz por neurônio com sondas de 2 s).', res }, null, 1) + '\n');
  await w.terminate(); process.exit(0);
}
for (const semente of SEMENTES) {
  const rMundo = gerador(semente * 7919 + 1);
  const treinos = Array.from({ length: TREINOS }, (_, i) => ({ defeitos: Q.VERSOES.treino[i % Q.VERSOES.treino.length], vistas: visiveis(semente * 100 + i, ORC_TREINO) }));
  const testes = Q.VERSOES.teste.map((d, i) => ({ defeitos: d, vistas: visiveis(semente * 100 + 50 + i, ORCAMENTO) }));
  for (const cond of CONDICOES) {
    const comCerebro = ['ativa', 'congelada', 'ingenua'].includes(cond);
    const rnd = gerador(semente * 31 + 17);
    const r = { semente, condicao: cond, orcamento: ORCAMENTO, orcamento_treino: ORC_TREINO, visiveis: VISIVEIS, sentir_s: SENTIR_S, treino: [], teste: [] };
    if (comCerebro) {
      w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: cond !== 'congelada' }); w.postMessage({ type: 'semente', valor: semente });
      await roda(1, {});
      { const ra = gerador(semente + 5); for (let i = 0; i < 15; i++) await sentir(Q.ACOES[Math.floor(ra() * Q.ACOES.length)]); }   // aquecimento
      r.valencia_antes = await valencias(2); BASE = r.valencia_antes;
    }
    if (cond !== 'ingenua') for (const t of treinos) r.treino.push(await episodio(t.defeitos, t.vistas, cond, rnd, comCerebro, ORC_TREINO));
    if (comCerebro) r.valencia_depois_do_treino = await valencias(2);
    for (const t of testes) r.teste.push(await episodio(t.defeitos, t.vistas, cond, rnd, comCerebro));
    const primeiro = r.teste.map(b => (b.length ? b[0].passo : ORCAMENTO + 1));
    r.resumo = { primeiro_bug_teste_media: +(primeiro.reduce((a, b) => a + b, 0) / primeiro.length).toFixed(2), bugs_teste: r.teste.reduce((a, b) => a + b.length, 0), bugs_treino: r.treino.reduce((a, b) => a + b.length, 0) };
    dados.rodadas.push({ data: new Date().toISOString(), ...r });
    writeFileSync(arquivo, JSON.stringify(dados, null, 1) + '\n');
    console.log(JSON.stringify({ semente, cond, ...r.resumo }));
  }
}
await w.terminate();
