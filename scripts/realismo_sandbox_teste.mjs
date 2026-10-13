// Teste integrado da Cozinha 3D com o worker real e perfil do Chrome em _tmp/.
// Uso: node scripts/realismo_sandbox_teste.mjs [--porta 8765] [--chrome caminho]
// Mede alimentação por contato, suspensão, captura e pausas. Se houver servidor na 8766,
// mede também uma sessão com corpo físico. Gera JSON em docs/medicoes/ e imagem na raiz (_).
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const vista = arg('vista', 'sandbox'), modo = arg('modo', 'spec'), espera = +arg('espera', 15);
const alvo = arg('alvo', vista === 'sandbox' ? '#worldBox' : '.brain-box'), app = arg('app', 'cozinha'), porta = +arg('porta', 8765);
const out = '_realismo_boca.png';
const tema = arg('tema', '');
const js = arg('js', '');       // código a rodar na página antes da espera (ex.: sbTakeoff(fly, 'beira'))   // claro ou escuro; vazio = o do sistema
const chrome = arg('chrome', (process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'));
const cdp = 9300 + Math.floor(Math.random() * 600);
const TMP = process.env.MOSCA_TMP || new URL('../_tmp', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(TMP, { recursive: true });
// apaga o próprio perfil do Chrome (em _tmp, no D): espera o Chrome soltar os arquivos e tenta de novo
async function limpaPerfil(dir) {
  for (let i = 0; i < 10; i++) {
    try { rmSync(dir, { recursive: true, force: true }); return; } catch { await new Promise(r => setTimeout(r, 700)); }
  }
}
const perfil = mkdtempSync(join(TMP, 'mosca-cap-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${perfil}`,
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader',
  '--window-size=1400,1000', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `http://localhost:${porta}/?headless=1&r=${Date.now()}`,
], { stdio: 'ignore' });

let ws;
const erros = [];
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
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } };
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

  await send('Runtime.enable');
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
  const resultados = await evaluate(`(async()=>{
    LAB.busy=true; LAB.noClick=false; LAB.freeze=true; LAB.events=[];
    await animCarregar();
    const acucar=rects.find(r=>r.id==='k-acucar');
    Object.assign(fly,{x:acucar.x+acucar.w/2,y:acucar.y+acucar.h/2,z:acucar.z,th:0,flying:false,presa:false,back:0,hunger:1});
    const inicio=brainT;
    await waitBrain(2500);
    const alimentacao={tempo_ms:brainT-inicio,prob:fly.prob,boca:fly.boca,contato:fly.bocaEl?.id,patas:fly.patasEl?.id,mordidas:refeicoes.length,antenas:sbAntenas(fly),pose:!!ANIM.poses,erroPose:ANIM.erro};
    const n=refeicoes.length;
    fly.z=acucar.z+20;
    await waitBrain(500);
    const suspensa={mordidas:refeicoes.length-n,patas:fly.patasEl?.id||null,boca:fly.bocaEl?.id||null};
    fly.z=acucar.z; fly.presa=true;
    await waitBrain(300);
    const presa={mordidas:refeicoes.length-n,boca:fly.boca,doce:rates.doce};
    fly.presa=false;
    Object.assign(fly,{x:1100,y:1200,z:0,th:0,prob:0,sweet:0,voarCd:100});
    const estados={}, fim=brainT+8000;
    while(brainT<fim){await waitBrain(100);estados[fly.marcha]=(estados[fly.marcha]||0)+1;}
    const semComida={mordidas:refeicoes.length-n,estados};
    Object.assign(fly,{x:acucar.x+acucar.w/2,y:acucar.y+acucar.h/2,z:acucar.z,th:0,hunger:1});
    await waitBrain(650);
    const fisico={disponivel:await corpoPing()};
    if (fisico.disponivel) {
      await corpoSet(true);
      const nFisico=refeicoes.length;
      await waitBrain(3000);
      Object.assign(fisico,{ligado:SB.fisico,mordidas:refeicoes.length-nFisico,antenas:sbAntenas(fly),patas:fly.patasEl?.id||null,boca:fly.boca,contato:fly.bocaEl?.id||null});
      await corpoSet(false);
      Object.assign(fly,{x:acucar.x+acucar.w/2,y:acucar.y+acucar.h/2,z:acucar.z,th:Math.PI/2,hunger:1});
      await waitBrain(400);
    }
    worker.postMessage({type:'run',on:false}); running=false;
    SBR.camReady=false;
    return {alimentacao,suspensa,presa,semComida,fisico,bocaFinal:fly.boca};
  })()`);
  writeFileSync('docs/medicoes/realismo-sandbox.json', JSON.stringify({metodo:'Chrome sem janela com headless=1 (sem renderização contínua dos olhos), worker real, Cozinha 3D; corpo mantido nas posições indicadas com LAB.freeze para testar alimentação, altura, captura e estados de caminhada. Uma realização, sem validação biológica. Pausas contadas a cada 100 ms cerebrais. Imagem final: extensão comandada manualmente apenas para conferir geometria; não usada para contar alimentação.',...resultados},null,2)+'\n');
  console.log(JSON.stringify(resultados));
  if (!resultados.alimentacao.pose || !(resultados.alimentacao.mordidas>0) || resultados.suspensa.mordidas || resultados.suspensa.patas || resultados.presa.boca || resultados.semComida.mordidas) throw new Error('falha no contato/alimentação');
  await evaluate(`// Pose comandada apenas para conferir a geometria na imagem; os resultados acima são da rede.
    fly.boca=1; fly.alarmeCorpo=false; fly.threat=0; fly.loom=0; fly.back=0; fly.flying=false; fly.presa=false;
    const ac=rects.find(r=>r.id==='k-acucar');
    Object.assign(fly,{x:ac.x+ac.w/2,y:ac.y+ac.h/2,z:ac.z,th:Math.PI/2,pisoBoca:ac.z});
    sbUpdate(0,performance.now());
    const cx=fly.x-SB.W/2, cz=fly.y-SB.H/2;
    SBR.cam.position.set(cx+15,fly.z+12,cz+28);
    SBR.cam.lookAt(cx+2,fly.z+5,cz);
    SBR.camReady=true;
    sbFrame=()=>{};
    SBR.r.setViewport(0,0,SBR.r.domElement.width,SBR.r.domElement.height);
    SBR.r.setScissorTest(false); SBR.r.render(SBR.scene,SBR.cam); true`);
  await sleep(800);
  const rect = await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(alvo)}); e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
  await sleep(500);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.data, 'base64'));
  if (erros.length) throw new Error(erros.join('\n'));
  console.log('salvo em', out, `(${Math.round(rect.width)}×${Math.round(rect.height)})`);
} catch (e) {
  console.log('falhou:', e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  proc.kill();
  await sleep(1500);
  await limpaPerfil(perfil);
}
