// Roda um teste do laboratório num Chrome sem janela e salva o resultado em JSON.
// Várias instâncias podem rodar em paralelo (uma simulação por núcleo), cada uma com um --inicio diferente.
//
//   python -m http.server 8765 --directory web        (em outro terminal)
//   node scripts/lab_headless.mjs --cenario bloqueio --reps 2 --inicio 0 --out docs/medicoes/lab-a.json
//
// Opções: --cenario (transferencia ou bloqueio), --reps (1 a 5), --secs (duração do teste no Financeiro),
// --app (bloqueio: pedidos ou financeiro), --inicio (primeiro ponto de partida), --olhos 0 (desliga a visão), --url (parâmetros a mais, ex.: cheiro=60),
// --porta (do servidor local), --chrome (caminho do executável).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const cenario = arg('cenario', 'transferencia');
if (!['transferencia', 'bloqueio'].includes(cenario)) throw new Error('--cenario deve ser transferencia ou bloqueio');
const olhos = arg('olhos', '1') !== '0';
const extra = arg('url', '');
const app = arg('app', '');     // bloqueio: sistema do teste (padrão: financeiro)   // parâmetros a mais na URL da página, ex.: cheiro=60
const reps = +arg('reps', 3), secs = +arg('secs', 90), inicio = +arg('inicio', 0), porta = +arg('porta', 8765);
const out = arg('out', `lab-${Date.now()}.json`);
const chrome = arg('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const cdp = 9300 + Math.floor(Math.random() * 600);
const TMP = process.env.MOSCA_TMP || new URL('../_tmp', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(TMP, { recursive: true });
// apaga o próprio perfil do Chrome (em _tmp, no D): espera o Chrome soltar os arquivos e tenta de novo
async function limpaPerfil(dir) {
  for (let i = 0; i < 10; i++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { await new Promise(r => setTimeout(r, 700)); }
  }
}
const perfil = mkdtempSync(join(TMP, 'mosca-lab-'));
const url = `http://localhost:${porta}/?headless=1${olhos ? '' : '&olhos=0'}${extra ? '&' + extra : ''}&r=${Date.now()}#lab`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toLocaleTimeString('pt-BR'), `[${cenario} ${inicio}${olhos ? '' : ' sem olhos'}]`, ...a);

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${perfil}`,
  // sem isso o Chrome desacelera a página quando ela não está em primeiro plano
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--enable-unsafe-swiftshader', '--window-size=1280,900', '--no-first-run', '--no-default-browser-check', url,
], { stdio: 'ignore' });

async function pageSocket() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${cdp}/json`)).json();
      const page = list.find(t => t.type === 'page' && t.url.includes(`localhost:${porta}`));
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* o Chrome ainda está abrindo */ }
    await sleep(500);
  }
  throw new Error('o Chrome não abriu a página');
}

let ws;
try {
  ws = new WebSocket(await pageSocket());
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let seq = 0;
  const waiting = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
  const evaluate = expression => new Promise((ok, fail) => {
    const id = ++seq;
    waiting.set(id, m => {
      const r = m.result;
      if (m.error || r?.exceptionDetails) fail(new Error(m.error?.message || r.exceptionDetails.exception?.description || 'erro na página'));
      else ok(r.result.value);
    });
    ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });

  log('esperando o cérebro carregar');
  const t0 = Date.now();
  const loaderStage = `JSON.stringify({ etapa: document.querySelector('#ldStage')?.textContent, erro: document.querySelector('#loader')?.classList.contains('err') })`;
  while (!(await evaluate(`!!document.querySelector('#labTransfBtn') && !document.querySelector('#labTransfBtn').disabled`))) {
    if (Date.now() - t0 > 180000) throw new Error('o cérebro não carregou em 3 min: ' + await evaluate(loaderStage));
    if ((Date.now() - t0) % 30000 < 1000) log('carregando:', await evaluate(loaderStage));
    await sleep(1000);
  }
  await evaluate(`LAB.app = ${JSON.stringify(app)}; LAB.startOffset = ${inicio}; $('#labSecs').value = ${secs}; $('#labReps').value = ${reps}; $('${cenario === 'bloqueio' ? '#labBloqBtn' : '#labTransfBtn'}').click(); true`);
  let last = '';
  for (;;) {
    await sleep(15000);
    const { busy, status } = JSON.parse(await evaluate(`JSON.stringify({ busy: LAB.busy, status: $('#labStatus').textContent })`));
    if (status !== last) { log(status); last = status; }
    if (!busy) break;
  }
  const res = JSON.parse(await evaluate(`JSON.stringify(LAB.results.${cenario})`));
  writeFileSync(out, JSON.stringify({ cenario, olhos, url: extra, app: app || 'financeiro', inicio, reps, secs, fim: new Date().toISOString(), [cenario]: res }, null, 2));
  log('salvo em', out);
} catch (e) {
  log('falhou:', e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  proc.kill();
  await sleep(1500);
  await limpaPerfil(perfil);
}
