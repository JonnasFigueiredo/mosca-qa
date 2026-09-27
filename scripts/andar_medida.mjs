// Mede o andar da mosca na Cozinha 3D e compara com moscas reais (docs/plano-sentidos-e-medicao.md, parte 2).
// Abre a página num Chrome sem janela (perfil em _tmp/, apagado no fim), amostra o corpo a cada tique do cérebro
// (10 ms, embrulhando stepBody) e calcula frações do tempo, velocidades, trechos andando, paradas, viradas rápidas e
// reorientação depois das paradas. Acrescenta o resultado em docs/medicoes/andar-vs-moscas.json.
//
//   node scripts/andar_medida.mjs [--segundos 90] [--fisico] [--sentidos] [--sem-olhos] [--janela 100] [--rotulo nome]
//
// --segundos: de relógio (o cérebro anda ~0,3-1x o tempo real). --fisico: corpo físico (servidor na 8766).
// --sentidos: passa ?sentidos=1 (parte 1 do plano). --sem-olhos: ?headless=1 (sem desenhar; os olhos reais não
// funcionam e a visão usa a aproximação da página).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const tem = k => process.argv.includes('--' + k);
const segundos = +arg('segundos', 90), porta = +arg('porta', 8765), janelaMs = +arg('janela', 100), fisico = tem('fisico'), sentidos = tem('sentidos'), semOlhos = tem('sem-olhos');
if (fisico && tem('sonda-mofo')) throw new Error('a sonda do mofo reinicia apenas o corpo simples; não usar com --fisico');
if (fisico && tem('sonda-cheiro')) throw new Error('a sonda do cheiro reinicia apenas o corpo simples; não usar com --fisico');
const rotulo = arg('rotulo', `${fisico ? 'fisico' : 'simples'}${sentidos ? '-sentidos' : ''}${semOlhos ? '-sem-olhos' : ''}`);
const chrome = arg('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TMP = join(RAIZ, '_tmp'); mkdirSync(TMP, { recursive: true });
const versao = Object.fromEntries(await Promise.all(['index.html', 'sandbox.js', 'corpo-natural.js', 'sim-worker.js'].map(async f => {
  const resposta = await fetch(`http://localhost:${porta}/${f}`);
  if (!resposta.ok) throw new Error(`não foi possível identificar a versão servida de ${f}`);
  return [f, createHash('sha256').update(Buffer.from(await resposta.arrayBuffer())).digest('hex')];
})));
const perfil = mkdtempSync(join(TMP, 'mosca-andar-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cdp = 9300 + Math.floor(Math.random() * 600);
const busca = [semOlhos ? 'headless=1' : '', sentidos ? 'sentidos=1' : '', `r=${Date.now()}`].filter(Boolean).join('&');

// alvos da literatura (docs/plano-sentidos-e-medicao.md)
const ALVOS = {
  escopo: 'Valente 2007: uma única mosca por duas horas, sem generalização para a espécie. Geurten 2014: estados por agrupamento de velocidades, não pelo mesmo classificador deste script. Referências exploratórias, não critérios de equivalência biológica.',
  velocidade_andando_mm_s: 'picos em ~11,4 (junto à parede) e ~14,8 (centro); faixa 7,2-44,7 [Valente 2007; Mendes 2013]',
  trecho_andando_s: 'exponencial, constante ~1,37 (parede) a ~2,1 (centro) [Valente 2007]',
  paradas: '~76% < 0,3 s (parede); no centro algumas > 5 s [Valente 2007]',
  reorientacao_depois_de_parar: 'na maioria das vezes ~0° [Valente 2007]',
  viradas: 'sacadas de ~15° em 40-120 ms (mediana 90), > 200°/s; rumo quase parado entre elas [Geurten 2014]',
  orcamento_de_tempo: 'parada 63%, andando reto 29%, virando 9% (arena sem comida) [Geurten 2014]',
};

const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${perfil}`,
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader',
  '--window-size=1400,1000', '--hide-scrollbars', '--no-first-run', `http://localhost:${porta}/?${busca}`], { stdio: 'ignore' });
let ws;
try {
  let url;
  for (let i = 0; i < 60 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${cdp}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* abrindo */ }
    if (!url) await sleep(500);
  }
  if (!url) throw new Error('o Chrome não abriu a página');
  ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let seq = 0; const espera = new Map(), erros = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]);
    if (espera.has(m.id)) { espera.get(m.id)(m); espera.delete(m.id); } };
  const send = (method, params = {}) => new Promise(ok => { const id = ++seq; espera.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erro na página'); return r.result?.result?.value; };
  await send('Runtime.enable');
  const t0 = Date.now();
  while (!(await ev('typeof brainReady !== "undefined" && brainReady'))) {
    if (Date.now() - t0 > 180000) throw new Error('o cérebro não carregou em 3 min');
    await sleep(1000);
  }
  const prep = await ev(`(async () => {
    document.querySelector('#appTabs button[data-app="cozinha"]').click();
    document.querySelector('#modeTabs button[data-mode="3d"]').click();
    await new Promise(r => setTimeout(r, 1500));
    if (typeof animCarregar === 'function') await animCarregar();
    LAB.busy = true; LAB.events = [];
    ${fisico ? "if (!(await corpoPing())) return 'sem servidor do corpo'; await corpoSet(true);" : ''}
    window.__reg = [];
    // Alguns eventos usam t para duração do voo; guardar o relógio absoluto em campo distinto.
    const registrar0 = labEvent;
    labEvent = (tipo, dados) => { registrar0(tipo, dados);
      if (LAB.busy && LAB.events.length) LAB.events[LAB.events.length - 1].relogio_cerebral_s = brainClock / 1000; };
    window.__visao = { tempo_s: 0, olhos_reais_s: 0, corpo_fisico_s: 0, alvo_real: 0, alvo_aproximado: 0, sem_alvo: 0 };
    const visual0 = sbAlvoVisual;
    sbAlvoVisual = f => { const a = visual0(f); __visao[a ? (a.olhos ? 'alvo_real' : 'alvo_aproximado') : 'sem_alvo']++; return a; };
    const sb0 = stepBody;
    stepBody = (dt, c) => { sb0(dt, c); const f = fly;
      __visao.tempo_s += dt;
      if (SB.fisico) __visao.corpo_fisico_s += dt;
      if (f.olhoReal && performance.now() - f.olhoReal.t < 600) __visao.olhos_reais_s += dt;
      window.__reg.push([dt, f.x, f.y, f.z || 0, f.th, f.flying ? 1 : 0, f.naParede ? 1 : 0, f.boca || 0, f.hunger, f.presa ? 1 : 0, f.buscaR ? ({ dentro: 1, perdeu: 2 }[f.buscaR.modo] || 0) : 0]); };
    return 'ok';
  })()`);
  if (prep !== 'ok') throw new Error(prep);
  const inicio = await ev('brainClock / 1000');
  const mofo = tem('sonda-mofo') ? await ev(readFileSync(join(RAIZ, 'scripts/mofo_sonda.js'), 'utf8')) : null;
  // sonda de busca pelo cheiro (docs/plano-busca-cheiro.md, B1)
  const cheiro = tem('sonda-cheiro') ? await ev(readFileSync(join(RAIZ, 'scripts/cheiro_sonda.js'), 'utf8')) : null;
  if (cheiro) console.log('sonda do cheiro:', JSON.stringify({ chegadas: cheiro.chegadas, de: cheiro.de, tempo_mediano_s: cheiro.tempo_mediano_s }));
  const prazo = Date.now() + segundos * 1000;
  while (Date.now() < prazo) {
    await sleep(Math.min(50000, prazo - Date.now()));
    console.log('progresso:', JSON.stringify(await ev(`({ cerebro_s: brainClock / 1000 - ${inicio},
      eventos: LAB.events.length, voando: !!fly.flying, fisico: !!SB.fisico })`)));
  }
  const [reg, detalhes, cerebro, fim] = await ev(`(() => { const r = window.__reg; window.__reg = []; return [r, LAB.events, brainT / 1000,
    { fome: fly.hunger, visao: __visao, olhos_reais_recentes: !!fly.olhoReal && performance.now() - fly.olhoReal.t < 600 }]; })()`);
  const eventos = detalhes.map(e => e.type);
  if (fisico) await ev('corpoSet(false).then(() => 1)');
  if (erros.length) console.log('erros na página:', erros);

  // ── estatísticas (tempo do cérebro) ──
  const S = 7, n = reg.length, dt = reg.map(r => r[0]), tTot = dt.reduce((a, b) => a + b, 0);
  // velocidade e giro numa janela de ~100 ms: tira o balanço de cada passada (trípode a ~9 Hz; no corpo físico a pose
  // chega a cada ~40 ms), como a filmagem a 25 Hz das medidas de referência
  const J = Math.max(2, Math.round(janelaMs / 10)), vel = new Array(n).fill(0), gir = new Array(n).fill(0);
  for (let i = J; i < n; i++) {
    let T = 0; for (let k = i - J + 1; k <= i; k++) T += dt[k];
    const a = reg[i - J], b = reg[i];
    vel[i] = Math.hypot(b[1] - a[1], b[2] - a[2]) / S / T;
    let d = b[4] - a[4]; d = Math.atan2(Math.sin(d), Math.cos(d));
    gir[i] = Math.abs(d) / T * 180 / Math.PI;
  }
  const noChao = i => !reg[i][5] && !reg[i][9] && !reg[i][6];
  // andando/parada com folga (passa a andar acima de 2,5 mm/s e a parar abaixo de 1,5), para o ruído não picar trechos
  const est = new Array(n).fill('fora');
  for (let i = J, ult = 'parada'; i < n; i++) {
    if (!noChao(i)) { est[i] = 'fora'; continue; }
    ult = ult === 'andando' ? (vel[i] < 1.5 ? 'parada' : 'andando') : (vel[i] > 2.5 ? 'andando' : 'parada');
    est[i] = ult;
  }
  const estado = i => est[i];
  const frac = {}; const soma = (k, v) => { frac[k] = (frac[k] || 0) + v; };
  for (let i = J; i < n; i++) {
    if (reg[i][5]) soma('voando', dt[i]);
    else if (reg[i][9]) soma('presa', dt[i]);
    else if (reg[i][6]) soma('escalando', dt[i]);
    else if (reg[i][7] > 0.9) soma('comendo', dt[i]);
    else if (gir[i] > 200) soma('virando', dt[i]);
    else if (est[i] === 'andando') soma('andando_reto', dt[i]);
    else soma('parada', dt[i]);
  }
  for (const k in frac) frac[k] = +(frac[k] / tTot).toFixed(3);
  // trechos: sequências de andando/parada no chão (o voo corta o trecho)
  const trechos = { andando: [], parada: [] };
  let cur = null, dur = 0, rumoAntes = null, reor = [];
  const rumoMedio = (i0, i1) => { let sx = 0, sy = 0; for (let k = Math.max(0, i0); k <= Math.min(n - 1, i1); k++) { sx += Math.cos(reg[k][4]); sy += Math.sin(reg[k][4]); } return Math.atan2(sy, sx); };
  for (let i = J; i < n; i++) {
    const e = estado(i);
    if (e !== cur) {
      if (cur === 'andando' || cur === 'parada') trechos[cur].push(dur);
      if (cur === 'andando' && e === 'parada') rumoAntes = rumoMedio(i - 10, i - 1);
      if (cur === 'parada' && e === 'andando' && rumoAntes !== null) { const d = rumoMedio(i, i + 10) - rumoAntes; reor.push(Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) * 180 / Math.PI); }
      if (e === 'fora') rumoAntes = null;
      cur = e; dur = 0;
    }
    dur += dt[i];
  }
  if (cur === 'andando' || cur === 'parada') trechos[cur].push(dur);   // o trecho que ainda estava em curso no fim
  const ord = a => [...a].sort((x, y) => x - y), q = (a, p) => a.length ? +ord(a)[Math.floor(p * (a.length - 1))].toFixed(3) : null;
  const media = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null;
  // viradas rápidas: trechos com giro > 200°/s no chão
  const sac = []; let ini = -1;
  for (let i = J; i < n; i++) {
    const on = noChao(i) && gir[i] > 200;
    if (on && ini < 0) ini = i;
    if (!on && ini >= 0) { let T = 0; for (let k = ini; k < i; k++) T += dt[k]; let d = reg[i - 1][4] - reg[ini - 1][4]; d = Math.atan2(Math.sin(d), Math.cos(d)); sac.push([T, Math.abs(d) * 180 / Math.PI]); ini = -1; }
  }
  let tAndando = 0; for (let i = J; i < n; i++) if (estado(i) === 'andando') tAndando += dt[i];
  const vAnd = []; for (let i = J; i < n; i++) if (estado(i) === 'andando') vAnd.push(vel[i]);
  const resultado = {
    rotulo, data: new Date().toISOString(), versao, configuracao: { porta, fisico, sentidos, semOlhos, sonda_mofo: !!mofo, sonda_cheiro: !!cheiro },
    metodo_da_rodada: 'Janela de movimento informada abaixo; escalada explícita separada de repouso e excluída de trechos/velocidade no chão. Comendo significa boca estendida, não ingestão confirmada; ingestão usa eventos comeu.',
    inicio_cerebro_s: inicio, fim, detalhes_eventos: detalhes, erros, mofo, cheiro,
    janela_ms: J * 10, relogio_s: segundos, cerebro_s: +tTot.toFixed(1), amostras: n,
    fracoes_do_tempo: frac,
    busca_pelo_cheiro: (() => { let d = 0, p = 0; for (let i = 0; i < n; i++) { if (reg[i][10] === 1) d += dt[i]; if (reg[i][10] === 2) p += dt[i]; }
      return { dentro: +(d / tTot).toFixed(3), perdeu: +(p / tTot).toFixed(3) }; })(),
    velocidade_andando_mm_s: { mediana: q(vAnd, 0.5), p10: q(vAnd, 0.1), p90: q(vAnd, 0.9) },
    trecho_andando_s: { n: trechos.andando.length, media: media(trechos.andando), mediana: q(trechos.andando, 0.5) },
    paradas_s: { n: trechos.parada.length, media: media(trechos.parada), mediana: q(trechos.parada, 0.5),
      frac_menos_0_3s: trechos.parada.length ? +(trechos.parada.filter(d => d < 0.3).length / trechos.parada.length).toFixed(2) : null,
      frac_mais_5s: trechos.parada.length ? +(trechos.parada.filter(d => d > 5).length / trechos.parada.length).toFixed(2) : null },
    reorientacao_depois_de_parar_graus: { n: reor.length, mediana: q(reor, 0.5), p90: q(reor, 0.9) },
    viradas_rapidas: { por_s_andando: tAndando ? +(sac.length / tAndando).toFixed(2) : null, duracao_ms_mediana: sac.length ? Math.round(q(sac.map(s => s[0]), 0.5) * 1000) : null,
      amplitude_graus_mediana: sac.length ? Math.round(q(sac.map(s => s[1]), 0.5)) : null },
    eventos: eventos.reduce((a, e) => (a[e] = (a[e] || 0) + 1, a), {}),
  };
  console.log(JSON.stringify(resultado, null, 1));
  const arq = join(RAIZ, 'docs/medicoes/andar-vs-moscas.json');
  const antigo = existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : { metodo: 'scripts/andar_medida.mjs: Cozinha 3D, Chrome sem janela, amostras a cada tique do cérebro (10 ms); velocidade e giro em janelas de ~100 ms; andando = acima de 2,5 mm/s no chão (volta a parada abaixo de 1,5); virando = acima de 200°/s. Uma realização por linha.', alvos: ALVOS, medidas: [] };
  antigo.alvos = ALVOS; antigo.medidas.push(resultado);
  writeFileSync(arq, JSON.stringify(antigo, null, 1) + '\n');
  console.log('gravado em docs/medicoes/andar-vs-moscas.json');
  if (erros.length) throw new Error('medição registrada com erros da página; não usar como validação');
  if (fisico && fim.visao.corpo_fisico_s < tTot * 0.99) throw new Error('corpo físico desligou durante a medição; não usar como validação');
} catch (e) {
  console.log('falhou:', e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  proc.kill();
  await sleep(1500);
  const relativo = relative(resolve(TMP), resolve(perfil));
  if (!relativo || relativo.startsWith('..') || isAbsolute(relativo)) throw new Error('perfil fora de _tmp; limpeza recusada');
  for (let i = 0; i < 10; i++) { try { rmSync(perfil, { recursive: true, force: true }); break; } catch { await sleep(700); } }
}
