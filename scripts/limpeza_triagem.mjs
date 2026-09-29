// Triagem de limpeza no worker real, com os dados/ganho/adaptação da página.
// Rode limpeza_grupos.py antes. Não muda pesos nem adiciona tônus aos descendentes.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const raiz = new URL('../', import.meta.url);
const ler = p => readFileSync(new URL(p, raiz));
const {grupos} = JSON.parse(ler('docs/medicoes/limpeza-grupos.json'));
const codigo = ler('web/sim-worker.js').toString('utf8');
let receptor = () => {};
const ctx = vm.createContext({console, performance, setTimeout, clearTimeout, MessageChannel,
  postMessage: m => receptor(m),
  fetch: async url => {
    const bytes = ler('web/' + url.replace(/\?.*$/, ''));
    let lido = false;
    return {ok: true, headers: {get: () => String(bytes.length)}, json: async () => JSON.parse(bytes),
      body: {getReader: () => ({read: async () => lido ? {done: true} : (lido = true, {done: false, value: new Uint8Array(bytes)})})}};
  },
});
vm.runInContext(codigo, ctx);
const envia = data => ctx.onmessage({data});
await new Promise((ok, falha) => {
  receptor = m => {if (m.type === 'ready') ok(); if (m.type === 'error') falha(new Error(m.message));};
  envia({type: 'load'});
});
await new Promise(ok => setTimeout(ok, 0));
const sementes = [28, 29, 30], duracao = 1000;
const condicoes = ['repouso', 'antenas', 'cerdas_antenas', 'cerdas_cabeca'];
const resultados = [];
for (const semente of sementes) for (const condicao of condicoes) {
  envia({type: 'reset'});
  vm.runInContext(`{let s=${semente}; Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}`, ctx);
  const ids = grupos[condicao] || [];
  envia({type: 'rates', rates: {}, vetor: {ids, taxas: ids.map(() => 100)}});
  const disparos = {aDN1: 0, aDN2: 0}, primeiro = {aDN1: null, aDN2: null}, janelas = [];
  const saidas = Object.fromEntries(['aDN1', 'aDN2'].map(k => [k, new Set(grupos[k])]));
  await new Promise((ok, falha) => {
    receptor = m => {
      if (m.type === 'error') return falha(new Error(m.message));
      if (m.type !== 'tick') return;
      const janela = {t_ms: m.t, aDN1: 0, aDN2: 0};
      for (const id of m.spikes) for (const k of ['aDN1', 'aDN2']) if (saidas[k].has(id)) {
        disparos[k]++; janela[k]++; primeiro[k] ??= m.t;
      }
      janelas.push(janela);
      if (m.t >= duracao) {envia({type: 'run', on: false}); ok();}
    };
    envia({type: 'run', on: true});
  });
  // Deixa consumir a mensagem de agendamento pendente antes de reiniciar.
  await new Promise(ok => setTimeout(ok, 15));
  const r = {semente, condicao, entrada_hz: ids.length ? 100 : 0, n_entrada: ids.length,
    hz_por_neuronio: Object.fromEntries(Object.entries(disparos).map(([k, n]) => [k, n / grupos[k].length])),
    primeiro_ms: primeiro, janelas};
  resultados.push(r);
  console.log(JSON.stringify({...r, janelas: undefined}));
}
const saida = {metodo: 'Worker real da página em VM Node. 3 sementes determinísticas; repouso e três estímulos Poisson a 100 Hz/neurônio por 1 s; reset completo entre condições. Taxas somadas divididas pelo número de neurônios e por 1 s. Sem tônus extra, sem mudar parâmetros. Janelas de 10 ms. Atividade dos descendentes não demonstra uma sequência coordenada de movimentos.',
  worker_sha256: createHash('sha256').update(codigo).digest('hex'), sementes, duracao_ms: duracao, resultados};
writeFileSync(new URL('docs/medicoes/limpeza-triagem.json', raiz), JSON.stringify(saida, null, 2) + '\n');
process.exit(0);
