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
const KCSET = new Set(G.kc), ULTIMO = { kcs: new Set(), rec: 0 }; let CONTA_KC = false;   // KCs e evitar_rec da última amostra (calibração)

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
  const c = { mbon_aprox: 0, mbon_evitar: 0, mbon_evitar_rec: 0 }; ULTIMO.kcs.clear();
  for (let i = 0; i < Math.round(s * 100); i++) { const m = await tique(rates); for (const g in c) c[g] += m.counts[g] || 0; if (CONTA_KC) for (const x of m.spikes || []) if (KCSET.has(x)) ULTIMO.kcs.add(x); }
  const hz = g => c[g] / G[g].length / s; ULTIMO.rec = hz('mbon_evitar_rec');
  return hz('mbon_aprox') - (hz('mbon_evitar') + hz('mbon_evitar_rec')) / 2;
}
async function sentir(acao) { const v = await roda(SENTIR_S, odor(acao)); await roda(PAUSA_S, {}); return v; }
async function recompensar(acao, grupo = 'recompensa') {
  const o = odor(acao);
  for (let i = 0; i < 200; i++) await tique(i >= 150 ? { ...o, [grupo]: 100 } : o);
  await roda(PAUSA_S, {});
}
// decepção (01/10): o mesmo pareamento, com a dopamina de punição (PPL1, grupo 'dor') no lugar da PAM. Nas moscas, o
// cheiro que prometia açúcar e veio sem ele ativa a PPL1 e forma uma memória oposta (Felsenberg et al., 2017, 2018)
const decepcionar = acao => recompensar(acao, 'dor');
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
// --bancada 2 (01/10): repetidas sem pré-condição, teste com 2 versões de transferência (cupom, estoque) e 1 controle
// (quantidade negativa, que a memória não ajuda); no teste, sem recompensa (como o teste sem açúcar das moscas reais) e
// o episódio acaba no primeiro bug (menos tempo para esquecer)
// --caracteristica normal (contrabalanço, 01/10): defeitos nas ações "normal" em vez de "repetida" (VERSOES2N)
const CAR = arg('caracteristica', 'repetida');
const BANCADA = +arg('bancada', 1), VERSOES = BANCADA === 2 ? (CAR === 'normal' ? Q.VERSOES2N : Q.VERSOES2) : Q.VERSOES;
// condição ativa_decepcao: treino igual ao da ativa; no teste, escolher uma ação com valência acima do limiar (ela
// "esperava" bug) e não achar bug novo dispara a decepção. Limiar escrito antes: 0,6 (acima da maior valência de
// nascença, +0,50, e do ruído, 0,15). Regra nossa: quando disparar; o efeito da PPL1 é do worker
const LIMIAR_DECEPCAO = +arg('limiar-decepcao', 0.6);
let DECEP = false, NDECEP = 0;
// curiosidade (01/10, docs/plano-treino-robusto.md, "Memória + curiosidade"): nas condições *_curiosa, no teste, a
// escolha usa valência − H × vezes que ela já tentou aquela ação neste episódio (habituação ao que já provou, como a
// visão da página faz). H 2,5 escolhido antes no oráculo (qa-curiosidade-oraculo.json): a partir daí o resultado
// estabiliza; na prática, ela tenta primeiro o que ainda não tentou e, entre as novas, escolhe pela memória. Regra
// nossa: a forma de somar; a valência é do cérebro. O treino é idêntico ao da condição sem curiosidade
const H_CURIOSIDADE = +arg('curiosidade', 2.5);
let CURIOSA = false;
// --repeticoes-teste K: cada versão de teste K vezes, com ações visíveis diferentes (a primeira é a de sempre)
const REP_TESTE = +arg('repeticoes-teste', 1);
let BASE = {};
// escolhas no teste: quantas vezes uma repetida estava visível e quantas vezes foi escolhida (a memória vira ação?)
// (premiada = a característica premiada no treino, CAR)
let ESC = { passos: 0, premiada_visivel: 0, premiada_escolhida: 0 };
// --retencao-teste s: depois do treino, s segundos cheirando ações que não são repetidas antes do teste (retenção)
const RET_TESTE = +arg('retencao-teste', 0);
async function episodio(defeitos, vistas, politica, rnd, comCerebro, orcamento = ORCAMENTO, teste = false) {
  const sis = Q.criar(defeitos, { bancada: BANCADA }), achados = new Set(), bugs = [], tentadas = {};
  for (let p = 0; p < orcamento; p++) {
    const opcoes = vistas[p];
    let escolha, vEscolha = 0;
    if (politica === 'aleatoria') escolha = opcoes[Math.floor(rnd() * opcoes.length)];
    else if (politica === 'novidade') { const min = Math.min(...opcoes.map(a => tentadas[a.id] || 0)); const menos = opcoes.filter(a => (tentadas[a.id] || 0) === min); escolha = menos[Math.floor(rnd() * menos.length)]; }
    else {
      const v = []; for (const a of opcoes) v.push((await sentir(a)) - (DESCONTO ? BASE[a.id] ?? 0 : 0));
      const pontos = teste && CURIOSA ? v.map((x, i) => x - H_CURIOSIDADE * (tentadas[opcoes[i].id] || 0)) : v;
      const e = pontos.map(x => Math.exp(x / T_SOFTMAX)), soma = e.reduce((a, b) => a + b, 0);
      let u = rnd() * soma, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++;
      escolha = opcoes[k]; vEscolha = v[k];
    }
    if (teste) { ESC.passos++; if (opcoes.some(a => a.entrada === CAR)) { ESC.premiada_visivel++; if (escolha.entrada === CAR) ESC.premiada_escolhida++; } }
    tentadas[escolha.id] = (tentadas[escolha.id] || 0) + 1;
    sis.executar(escolha.id);
    const novos = Q.verificar(sis).filter(x => !achados.has(x));
    if (novos.length) {
      for (const x of novos) { achados.add(x); bugs.push({ passo: p + 1, contrato: x, acao: escolha.id }); }
      if (teste && BANCADA === 2) break;
      if (comCerebro) await recompensar(escolha);
    } else if (teste && DECEP && vEscolha > LIMIAR_DECEPCAO) { NDECEP++; await decepcionar(escolha); }
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
  // --com-kcs: além de neutra, cada ação precisa acender KCs e mbon_evitar_rec como o cheiro A (117 KCs, 1,57 Hz),
  // senão a dopamina não tem o que enfraquecer (qa-kcs.json). Penalidade quadrática abaixo de 90 KCs e 1,3 Hz.
  const COM_KCS = process.argv.includes('--com-kcs'); CONTA_KC = COM_KCS;
  const avalia = async () => {
    const v = {}, k = {}, e = {};
    for (const a of Q.ACOES) { v[a.id] = +(await roda(SENTIR_S, odor(a))).toFixed(3); k[a.id] = ULTIMO.kcs.size; e[a.id] = +ULTIMO.rec.toFixed(2); await roda(PAUSA_S, {}); }
    const n = Q.ACOES.length; let q = Object.values(v).reduce((a, x) => a + x * x, 0) / n;
    if (COM_KCS) q += Q.ACOES.reduce((t, a) => t + Math.max(0, (90 - k[a.id]) / 90) ** 2 + Math.max(0, (1.3 - e[a.id]) / 1.3) ** 2, 0) / n;
    return { custo: q, v, kcs: k, evitar_rec: e };
  };
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
    writeFileSync(arg('saida-cheiros', COM_KCS ? 'docs/medicoes/qa-cheiros-kcs.json' : 'docs/medicoes/qa-cheiros.json'), JSON.stringify({ metodo: 'Busca local: a cada iteração troca um glomérulo de uma característica por outro livre (sem os da atração inata da Cozinha e da bancada A/B, com 6+ ORNs); aceita se a média dos quadrados da valência das 15 ações cai. Pesos congelados, semente 5, aquecimento de 15 cheiros; valência com amostra de 1 s. Uma medida por ação por iteração (ruído ~0,15).', inicial: { mapa: inicial.mapa, custo: inicial.custo, valencias: inicial.v }, melhor: atual, custo_melhor: melhor.custo, valencias_melhor: melhor.v, kcs_melhor: melhor.kcs, evitar_rec_melhor: melhor.evitar_rec, com_kcs: COM_KCS, historico }, null, 1) + '\n');
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
// --dose (suspeita 1 da caça honesta): quanto a valência de UMA ação sobe com 1, 2, 4 e 8 pareamentos, e quanto
// sobra depois de 60 e 180 s cheirando outras ações (o treino dura ~10 min e o esquecimento tem τ 90 s).
// Alvo cancelamento:repetida (a mais premiada no treino), controle carrinho:normal. Ativa contra congelada.
// --kcs: quantas células de Kenyon e quanto de mbon_evitar_rec cada ação acende (1 s), contra o cheiro A da bancada
// (VA2+DM4), que aprende bem. Sem KCs ou sem evitar_rec não há o que a dopamina enfraquecer.
if (process.argv.includes('--kcs')) {
  const kcSet = new Set(G.kc), res = {};
  w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: false }); w.postMessage({ type: 'semente', valor: 11 });
  await roda(1, {});
  const itens = [...Q.ACOES.map(a => [a.id, odor(a)]), ['A (VA2+DM4)', Object.fromEntries(['VA2', 'DM4'].flatMap(g => ['L', 'R'].map(l => ['ORN_' + g + '_' + l, 100])))]];
  for (const [id, rates] of itens) {
    const kcs = new Set(); let rec = 0;
    for (let i = 0; i < 100; i++) { const m = await tique(rates); rec += m.counts.mbon_evitar_rec || 0; for (const s of m.spikes || []) if (kcSet.has(s)) kcs.add(s); }
    await roda(1, {});
    res[id] = { kcs: kcs.size, evitar_rec_hz: +(rec / G.mbon_evitar_rec.length).toFixed(2) }; console.log(id, JSON.stringify(res[id]));
  }
  writeFileSync('docs/medicoes/qa-kcs.json', JSON.stringify({ metodo: 'Worker real, pesos congelados, semente 11. Cada cheiro (100 Hz bilateral) por 1 s, 1 s sem odor entre eles. kcs = KCs distintos que dispararam; evitar_rec_hz = Hz por neurônio de mbon_evitar_rec (a saída que o açúcar enfraquece).', cheiros: arg('cheiros', 'padrao'), res }, null, 1) + '\n');
  await w.terminate(); process.exit(0);
}
// --glomerulos: cada glomérulo do conjunto permitido sozinho (1 s, 100 Hz bilateral): KCs acesos, mbon_evitar_rec e
// valência. Para escolher pares fortes para as características (cheiros com poucos KCs não aprendem, qa-dose-kcs.json).
if (process.argv.includes('--glomerulos')) {
  const INATOS = ['DM1', 'VA2', 'DM2', 'DM3', 'DM4', 'DP1m', 'DA2', 'V', 'DP1l'];
  const POOL = Object.keys(G).filter(k => k.startsWith('ORN_') && k.endsWith('_L')).map(k => k.slice(4, -2)).filter(g => !INATOS.includes(g) && G['ORN_' + g + '_L'].length >= 6);
  CONTA_KC = true; const res = {};
  w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: false }); w.postMessage({ type: 'semente', valor: 11 });
  await roda(1, {});
  for (const g of POOL) {
    const v = await roda(1, Object.fromEntries(['L', 'R'].map(l => ['ORN_' + g + '_' + l, 100])));
    res[g] = { kcs: ULTIMO.kcs.size, evitar_rec: +ULTIMO.rec.toFixed(2), valencia: +v.toFixed(3) }; await roda(0.5, {});
    console.log(g, JSON.stringify(res[g]));
  }
  writeFileSync('docs/medicoes/qa-glomerulos.json', JSON.stringify({ metodo: 'Worker real, pesos congelados, semente 11. Cada glomérulo permitido (sem os inatos da Cozinha e da bancada, 6+ ORNs) sozinho a 100 Hz bilateral por 1 s, 0,5 s sem odor entre eles. kcs = KCs distintos; evitar_rec = Hz por neurônio; valencia = aproximar - evitar.', res }, null, 1) + '\n');
  await w.terminate(); process.exit(0);
}
if (process.argv.includes('--dose')) {
  const ALVO = Q.ACOES.find(a => a.id === arg('alvo', 'cancelamento:repetida')), CTRL = Q.ACOES.find(a => a.id === 'carrinho:normal');
  const OUTRAS = Q.ACOES.filter(a => a !== ALVO && a !== CTRL);
  const mede = async () => { let a = 0, c = 0; for (let k = 0; k < 3; k++) { a += await sentir(ALVO) / 3; c += await sentir(CTRL) / 3; } return { alvo: +a.toFixed(3), ctrl: +c.toFixed(3) }; };
  const res = [];
  for (const semente of SEMENTES) for (const plast of [true, false]) {
    w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: plast }); w.postMessage({ type: 'semente', valor: semente });
    await roda(1, {});
    const ra = gerador(semente + 5); for (let i = 0; i < 15; i++) await sentir(Q.ACOES[Math.floor(ra() * Q.ACOES.length)]);
    const linha = { semente, plasticidade: plast, antes: await mede(), pareamentos: {}, depois_de_outras: {} };
    let feitos = 0;
    for (const n of [1, 2, 4, 8]) { while (feitos < n) { await recompensar(ALVO); feitos++; } linha.pareamentos[n] = await mede(); }
    let passados = 0;
    for (const s of [60, 180]) { while (passados < s) { await sentir(OUTRAS[Math.floor(ra() * OUTRAS.length)]); passados += SENTIR_S + PAUSA_S; } linha.depois_de_outras[s] = await mede(); }
    res.push(linha); console.log(JSON.stringify(linha));
    writeFileSync(arg('saida-dose', 'docs/medicoes/qa-dose.json'), JSON.stringify({ alvo: ALVO.id, cheiros: arg('cheiros', 'padrao'), metodo: 'Worker real, cheiros calibrados se --cheiros. Depois de reset e aquecimento (15 cheiros), mede a valência (3 amostras de 1 s intercaladas) do alvo cancelamento:repetida e do controle carrinho:normal; pareia o alvo (2 s de cheiro, PAM 100 Hz nos últimos 0,5 s) até somar 1, 2, 4 e 8 vezes, medindo a cada etapa; depois cheira outras ações por 60 e 180 s e mede de novo. Ativa (plasticidade) contra congelada.', res }, null, 1) + '\n');
  }
  await w.terminate(); process.exit(0);
}
for (const semente of SEMENTES) {
  const rMundo = gerador(semente * 7919 + 1);
  const treinos = Array.from({ length: TREINOS }, (_, i) => ({ defeitos: VERSOES.treino[i % VERSOES.treino.length], vistas: visiveis(semente * 100 + i, ORC_TREINO) }));
  const testes = Array.from({ length: REP_TESTE }, (_, k) => VERSOES.teste.map((d, i) => ({ defeitos: d, vistas: visiveis(semente * 100 + 50 + i + 10 * k, ORCAMENTO) }))).flat();
  for (const cond of CONDICOES) {
    const comCerebro = ['ativa', 'ativa_decepcao', 'ativa_curiosa', 'congelada', 'congelada_curiosa', 'ingenua'].includes(cond);
    CURIOSA = cond.endsWith('_curiosa');
    DECEP = cond === 'ativa_decepcao'; NDECEP = 0;
    const rnd = gerador(semente * 31 + 17);
    const r = { semente, condicao: cond, caracteristica: CAR, ...(DECEP ? { limiar_decepcao: LIMIAR_DECEPCAO } : {}), orcamento: ORCAMENTO, orcamento_treino: ORC_TREINO, visiveis: VISIVEIS, sentir_s: SENTIR_S, desconto: DESCONTO, cheiros: arg('cheiros', 'padrao'), treino: [], teste: [] };
    if (comCerebro) {
      w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: !cond.startsWith('congelada') }); w.postMessage({ type: 'semente', valor: semente });
      await roda(1, {});
      { const ra = gerador(semente + 5); for (let i = 0; i < 15; i++) await sentir(Q.ACOES[Math.floor(ra() * Q.ACOES.length)]); }   // aquecimento
      r.valencia_antes = await valencias(2); BASE = r.valencia_antes;
    }
    if (cond !== 'ingenua') for (const t of treinos) r.treino.push(await episodio(t.defeitos, t.vistas, cond, rnd, comCerebro, ORC_TREINO));
    if (comCerebro) r.valencia_depois_do_treino = await valencias(2);
    if (RET_TESTE > 0) {
      const nr = Q.ACOES.filter(a => a.entrada !== CAR), rr = gerador(semente + 77);
      for (let t = 0; t < RET_TESTE; t += SENTIR_S + PAUSA_S) if (comCerebro) await sentir(nr[Math.floor(rr() * nr.length)]);
      r.retencao_teste_s = RET_TESTE;
    }
    ESC = { passos: 0, premiada_visivel: 0, premiada_escolhida: 0 };
    for (const t of testes) r.teste.push(await episodio(t.defeitos, t.vistas, cond, rnd, comCerebro, ORCAMENTO, true));
    r.escolhas_teste = { ...ESC }; if (DECEP) r.decepcoes_teste = NDECEP;
    const primeiro = r.teste.map(b => (b.length ? b[0].passo : ORCAMENTO + 1));
    if (BANCADA === 2) {
      const ctrl = testes.map(t => t.defeitos.join('+') === VERSOES.controle.join('+'));
      const tr = primeiro.filter((_, i) => !ctrl[i]), ct = primeiro.filter((_, i) => ctrl[i]);
      r.bancada = 2; r.teste_versoes = testes.map(t => t.defeitos.join('+')); if (REP_TESTE > 1) r.repeticoes_teste = REP_TESTE; if (CURIOSA) r.curiosidade = H_CURIOSIDADE;
      r.resumo_b2 = { primeiro_bug_transferencia: +(tr.reduce((a, b) => a + b, 0) / tr.length).toFixed(2), primeiro_bug_controle: +(ct.reduce((a, b) => a + b, 0) / ct.length).toFixed(2) };
    }
    r.resumo = { primeiro_bug_teste_media: +(primeiro.reduce((a, b) => a + b, 0) / primeiro.length).toFixed(2), bugs_teste: r.teste.reduce((a, b) => a + b.length, 0), bugs_treino: r.treino.reduce((a, b) => a + b.length, 0) };
    dados.rodadas.push({ data: new Date().toISOString(), ...r });
    writeFileSync(arquivo, JSON.stringify(dados, null, 1) + '\n');
    console.log(JSON.stringify({ semente, cond, ...r.resumo }));
  }
}
await w.terminate();
