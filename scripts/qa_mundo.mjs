// Série medida da caça a bugs no mundo da mosca (web/caca-mundo.js, aba "Caça a bugs" da página). Cada sessão abre a
// página num Chrome sem janela, com os olhos reais amostrados (?headless=1&olhosHeadless=1), e roda o modo automático:
// treino (versões de treino, recompensa em bug novo) e teste (3 versões novas, sem recompensa, até o primeiro bug).
// O resultado de cada sessão (window.__cacaFim) vai para o arquivo de saída. Sessões em fila, poucas por vez, em
// prioridade abaixo do normal (o Chrome herda). O servidor da página (scripts/servir.py, porta 8765) precisa estar no ar.
//   node scripts/qa_mundo.mjs --sementes 1,2 --condicoes ativa,congelada --saida docs/medicoes/qa-mundo-piloto.json
//        [--car repetida] [--treinos 6] [--paralelos 1] [--timeout-min 150] [--curto]
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SEMENTES = arg('sementes', '1').split(',').map(Number);
const CONDICOES = arg('condicoes', 'ativa,congelada').split(',');
const CAR = arg('car', 'repetida'), TREINOS = arg('treinos', '6'), PARALELOS = +arg('paralelos', 1);
const SAIDA = arg('saida', 'docs/medicoes/qa-mundo-piloto.json'), TIMEOUT = +arg('timeout-min', 150) * 60e3, CURTO = process.argv.includes('--curto');
// --so treino: só o treino (calibração do mundo); --extra '&chave=valor': parâmetros do mundo na URL (variantes da escada)
const SO = arg('so', ''), EXTRA = arg('extra', '');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
try { os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* sem permissão: segue normal */ }
mkdirSync('_tmp', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString('pt-BR');

function grava(sessao) {
  const dados = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')) : {
    metodo: 'Caça a bugs no mundo da mosca (web/caca-mundo.js). Página num Chrome sem janela com os olhos reais amostrados; modo automático: treino com as versões de treino da bancada 2 (cada versão até achar o bug, +10 s, ou 240 s de cérebro; bug novo = açúcar + PAM) e teste com as 3 versões de teste (sem recompensa; cada versão até o primeiro bug ou 180 s). Mundo: cinco plataformas de cozinha por família, plaquinhas em cima. Semente fixa para o cérebro, o mapa e os sorteios da página; o relógio de parede ainda varia. "provadas" = ações provadas na ordem.',
    sessoes: [] };
  dados.sessoes.push(sessao);
  writeFileSync(SAIDA, JSON.stringify(dados, null, 1) + '\n');
}

async function sessao(semente, condicao) {
  // o perfil do Chrome vai para _tmp do projeto (o disco C está quase cheio), com caminho absoluto
  const porta = 9300 + Math.floor(Math.random() * 600), perfil = mkdtempSync(resolve('_tmp/mosca-mundo-'));
  const url = `http://localhost:8765/?headless=1&olhosHeadless=1&caca=auto&cond=${condicao}&car=${CAR}&semente=${semente}&treinos=${TREINOS}${CURTO ? '&curto=1' : ''}${SO ? '&so=' + SO : ''}${EXTRA}&r=${Date.now()}`;
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--enable-unsafe-swiftshader', '--window-size=1400,1000', '--hide-scrollbars', '--no-first-run', url], { stdio: 'ignore' });
  const erros = [], t0 = Date.now();
  let ws;
  try {
    let wsUrl;
    for (let i = 0; i < 60 && !wsUrl; i++) { try { wsUrl = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* ainda subindo */ } if (!wsUrl) await sleep(500); }
    if (!wsUrl) throw new Error('o Chrome não abriu');
    ws = new WebSocket(wsUrl); await new Promise((ok, falha) => { ws.onopen = ok; ws.onerror = falha; });
    let seq = 0; const espera = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description?.split('\n')[0]);
      if (espera.has(m.id)) { espera.get(m.id)(m); espera.delete(m.id); }
    };
    const envia = (method, params = {}) => new Promise(ok => { const id = ++seq; espera.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
    const avalia = async expr => { const r = await envia('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value; };
    await envia('Runtime.enable');
    let ultimo = 0;
    for (;;) {
      await sleep(15000);
      const fim = await avalia('window.__cacaFim ? JSON.stringify(window.__cacaFim) : null');
      if (fim) { const r = JSON.parse(fim); r.erros = erros.slice(0, 20); r.minutosParede = +((Date.now() - t0) / 60e3).toFixed(1); return r; }
      if (Date.now() - ultimo > 120e3) {
        ultimo = Date.now();
        console.log(`${hora()} semente ${semente} ${condicao}: ${await avalia('(typeof brainT !== "undefined" ? (brainT/1000).toFixed(0) + " s de cérebro · " : "") + (document.getElementById("cacaStatus")?.textContent || "carregando")')}`);
      }
      if (Date.now() - t0 > TIMEOUT) throw new Error('passou do tempo limite');
    }
  } catch (e) {
    return { semente, condicao, erro: e.message, erros: erros.slice(0, 20), minutosParede: +((Date.now() - t0) / 60e3).toFixed(1) };
  } finally {
    try { ws?.close(); } catch { /* já fechado */ }
    proc.kill();
    for (let i = 0; i < 10; i++) { try { rmSync(perfil, { recursive: true, force: true }); break; } catch { await sleep(700); } }
  }
}

// retomada: pula as sessões que já estão no arquivo de saída sem erro
const feitas = new Set(existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, 'utf8')).sessoes.filter(x => !x.erro).map(x => x.semente + ':' + x.condicao) : []);
const fila = SEMENTES.flatMap(s => CONDICOES.map(c => [s, c])).filter(([s, c]) => !feitas.has(s + ':' + c));
console.log(`${hora()} ${fila.length} sessões (${SEMENTES.length} sementes × ${CONDICOES.join('/')}), ${PARALELOS} por vez → ${SAIDA}`);
let proxima = 0;
async function trabalhador() {
  while (proxima < fila.length) {
    const [s, c] = fila[proxima++];
    console.log(`${hora()} começa semente ${s} ${c}`);
    const r = await sessao(s, c);
    r.semente ??= s; r.condicao ??= c; r.extra = EXTRA; r.so = SO || null;
    grava(r);
    const t = r.teste?.map(v => v.primeiro ?? '—').join(' / ');
    console.log(`${hora()} fim semente ${s} ${c}: ${r.erro ? 'ERRO ' + r.erro : `teste (provas até o 1º bug) ${t} · ${r.minutosParede} min`}`);
  }
}
await Promise.all(Array.from({ length: PARALELOS }, trabalhador));
console.log(`${hora()} fim da fila`);
