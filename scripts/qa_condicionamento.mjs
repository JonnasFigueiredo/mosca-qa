// Teste curto de condicionamento no mundo da caça a bugs (arena), para validar o aprendizado antes de séries longas.
// Na página (Chrome sem janela, olhos reais): a mosca é colocada em cima de uma plaquinha da característica premiada
// (R) e de uma de controle (O), parada, e a valência dos MBONs (a leitura da bancada) é medida em cada uma; depois, um
// pareamento como o da bancada (cheiro de R e, no fim, açúcar + PAM, com ela parada em cima de R); e a valência de novo
// 20 s e 200 s depois (parada longe das duas, sem cheiro). Registra também o cheiro que chega às antenas no pareamento.
//   node scripts/qa_condicionamento.mjs --cond ativa|congelada --esquecimento 90 --semente 1 --saida docs/medicoes/x.json
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const COND = arg('cond', 'ativa'), ESQ = +arg('esquecimento', 0), SEM = +arg('semente', 1), PORTA = arg('porta', '8765');
const R = arg('premiada', 'q-pagamento-repetida'), O = arg('controle', 'q-carrinho-normal'), PARES = +arg('pareamentos', 1);
const SAIDA = arg('saida', ''), REP = +arg('repeticoes', 3);   // cada valência medida REP vezes, alternando R e O
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
mkdirSync('_tmp', { recursive: true });
const porta = 9300 + Math.floor(Math.random() * 600), perfil = mkdtempSync(resolve('_tmp/mosca-cond-'));
const url = `http://localhost:${PORTA}/?headless=1${arg('olhos', '1') === '0' ? '&olhos=0' : '&olhosHeadless=1'}&arena=1${arg('cheiros', 'fortes') === 'trocados' ? '&cheiros=trocados' : ''}&r=${Date.now()}`;
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--enable-unsafe-swiftshader', '--window-size=1400,1000', '--no-first-run', url], { stdio: 'ignore' });
try {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* subindo */ } if (!wsUrl) await sleep(500); }
  const ws = new WebSocket(wsUrl); await new Promise(ok => ws.onopen = ok);
  let seq = 0; const espera = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (espera.has(m.id)) { espera.get(m.id)(m); espera.delete(m.id); } };
  const avalia = (expression, awaitPromise = false) => new Promise(ok => { const id = ++seq; espera.set(id, m => ok(m.result?.result?.value ?? m.result?.exceptionDetails?.exception?.description)); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise } })); });
  for (let i = 0; i < 240; i++) { if (await avalia('typeof brainReady !== "undefined" && brainReady')) break; await sleep(1000); }
  const r = await avalia(`(async () => {
    const S = CORPO.S, espera = ms => new Promise(ok => setTimeout(ok, ms));
    const ate = async s => { const t = brainT + s * 1000; while (brainT < t) await espera(50); };
    switchApp('caca'); sbSet(true); await espera(1500);
    worker.postMessage({ type: 'semente', valor: ${SEM} });
    worker.postMessage({ type: 'params', plasticidade: ${COND !== 'congelada'}${ESQ ? `, tauF: ${ESQ * 1000}` : ''} });
    const R = APP.objetos['${R}'], O = APP.objetos['${O}'];
    R.x = 85; R.y = 108.6; O.x = 115; O.y = 108.6;
    SB.app = null; SBR.built = ''; sbBuild(); renderShop(); measure();
    const por = (o, z) => Object.assign(fly, { x: o.x * S, y: o.y * S, z: z || 0, th: 0, flying: false, jumping: false, vz: 0, lateral: null, cheirando: true, speed: 0, alvoArena: null });
    const longe = () => por({ x: 100, y: 75 });
    const glom = id => Object.keys(APP.objetos[id].cheiro);
    const nas = id => { const g = glom(id); return Object.fromEntries(Object.entries(rates).filter(([k]) => g.some(x => k === 'ORN_' + x + '_L' || k === 'ORN_' + x + '_R')).map(([k, v]) => [k, Math.round(v)])); };
    const medir1 = async o => { por(o); await ate(0.5); let s = 0, n = 0; const t = brainT + 1000; while (brainT < t) { s += fly.valencia || 0; n++; await espera(50); } longe(); await ate(3); return s / n; };
    const par = async () => { let r = 0, q = 0; for (let k = 0; k < ${REP}; k++) { r += await medir1(R); q += await medir1(O); } return { R: +(r / ${REP}).toFixed(3), O: +(q / ${REP}).toFixed(3) }; };
    longe(); await ate(5);
    const res = { antes: await par() };
    res.antenas = [];
    for (let k = 0; k < ${PARES}; k++) {
      por(R); await ate(1.5); res.antenas.push(nas('${R}'));
      fly.reward = 0.5; fly.sweet = 0.4; await ate(2);
      longe(); await ate(3);
    }
    const t0 = brainT;
    res.d20 = await par();
    while (brainT < t0 + 200000) await espera(200);
    res.d200 = await par();
    res.kc = +(fly.kc || 0).toFixed(0); res.tempoCerebro = +(brainT / 1000).toFixed(0);
    return JSON.stringify(res);
  })()`, true);
  const res = JSON.parse(r);
  const dif = x => +(x.R - x.O).toFixed(3);
  const out = { cond: COND, cheiros: arg('cheiros', 'fortes'), olhos: arg('olhos', '1') !== '0', esquecimento_s: ESQ || 90, semente: SEM, premiada: R, controle: O, pareamentos: PARES, ...res,
    mudanca_20s: +(dif(res.d20) - dif(res.antes)).toFixed(3), mudanca_200s: +(dif(res.d200) - dif(res.antes)).toFixed(3) };
  console.log(JSON.stringify(out));
  if (SAIDA) {
    const d = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : { metodo: 'Condicionamento no mundo (scripts/qa_condicionamento.mjs): valência dos MBONs (mbon_aprox − média de mbon_evitar e mbon_evitar_rec, Hz por neurônio) com a mosca parada 1,5 s em cima de cada plaquinha (média do último 1 s), antes e 20 s e 200 s depois dos pareamentos (cada valência: média de REP medidas alternando R e O) (1,5 s em cima da premiada, depois açúcar + PAM por 0,5 s, 2 s em cima). mudanca = (R − O) depois − (R − O) antes. Na bancada, o mesmo tipo de pareamento muda a valência do cheiro premiado em +1,03.', rodadas: [] };
    d.rodadas.push(out); writeFileSync(SAIDA, JSON.stringify(d, null, 1) + '\n');
  }
  ws.close();
} finally {
  proc.kill(); await sleep(1500); try { rmSync(perfil, { recursive: true, force: true }); } catch { /* ok */ }
}
