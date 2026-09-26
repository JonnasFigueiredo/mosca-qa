// Fotografa a página num Chrome sem janela: um painel (ou a página inteira) depois de N segundos.
// Útil para conferir o 3D e para gerar imagens do projeto.
//
//   python -m http.server 8765 --directory web        (em outro terminal)
//   node scripts/captura.mjs --vista olhos --modo spec --espera 20 --out captura.png
//
// Opções: --vista (cerebro, olhos ou sandbox), --modo (spec, olhos ou cima), --espera (s depois de carregar),
// --alvo (seletor CSS a fotografar; padrão .brain-box), --app (pedidos ou financeiro), --tema (claro ou escuro),
// --js (código a rodar antes da espera), --porta, --chrome.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const vista = arg('vista', 'olhos'), modo = arg('modo', 'spec'), espera = +arg('espera', 15);
const alvo = arg('alvo', vista === 'sandbox' ? '#worldBox' : '.brain-box'), app = arg('app', ''), porta = +arg('porta', 8765);
const out = arg('out', 'captura.png');
const tema = arg('tema', '');
const js = arg('js', '');       // código a rodar na página antes da espera (ex.: sbTakeoff(fly, 'beira'))   // claro ou escuro; vazio = o do sistema
const chrome = arg('chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const cdp = 9300 + Math.floor(Math.random() * 600);
const perfil = mkdtempSync(join(tmpdir(), 'mosca-cap-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${perfil}`,
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader',
  '--window-size=1400,1000', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `http://localhost:${porta}/?r=${Date.now()}`,
], { stdio: 'ignore' });

let ws;
try {
  let url;
  for (let i = 0; i < 60 && !url; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${cdp}/json`)).json();
      url = list.find(t => t.type === 'page' && t.url.includes(`localhost:${porta}`))?.webSocketDebuggerUrl;
    } catch { /* abrindo */ }
    if (!url) await sleep(500);
  }
  if (!url) throw new Error('o Chrome não abriu a página');
  ws = new WebSocket(url);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let seq = 0;
  const waiting = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq;
    waiting.set(id, m => (m.error ? fail(new Error(m.error.message)) : ok(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'erro na página');
    return r.result.value;
  };

  if (tema) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema === 'escuro' ? 'dark' : 'light' }] });
  const t0 = Date.now();
  const stage = `JSON.stringify({ etapa: document.querySelector('#ldStage')?.textContent, texto: document.querySelector('#ldText')?.textContent, erro: document.querySelector('#loader')?.classList.contains('err') })`;
  while (!(await evaluate('typeof brainReady !== "undefined" && brainReady'))) {
    if (Date.now() - t0 > 180000) throw new Error('o cérebro não carregou em 3 min: ' + await evaluate(stage));
    if ((Date.now() - t0) % 20000 < 1000) console.log('carregando:', await evaluate(stage));
    await sleep(1000);
  }
  if (app) await evaluate(`document.querySelector('#appTabs button[data-app="${app}"]').click(); true`);
  if (vista === 'sandbox') {
    await evaluate(`document.querySelector('#modeTabs button[data-mode="3d"]').click();
      document.querySelector('#sbModes button[data-mode="${modo}"]').click(); true`);
  } else if (vista === 'olhos') {
    await evaluate(`document.querySelector('#viewTabs button[data-view="olhos"]').click();
      document.querySelector('#evModes button[data-mode="${modo}"]').click(); true`);
  }
  if (js) await evaluate(js + '; true');
  await sleep(espera * 1000);
  const rect = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(alvo)}); e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log('salvo em', out, `(${Math.round(rect.width)}×${Math.round(rect.height)})`);
} catch (e) {
  console.log('falhou:', e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  proc.kill();
  await sleep(1500);
  try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Chrome às vezes segura arquivos */ }
}
