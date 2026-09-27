// Triagem funcional anterior às mudanças do corpo: repouso, açúcar, retirada e ameaça.
// Executa o worker real da página, com seus próprios parâmetros e arquivos de dados.
// Uso: node scripts/realismo_triagem.mjs [worker]; grava docs/medicoes/realismo-triagem.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = process.argv[2] || join(raiz, 'web/sim-worker.js');

const msgs = [];
let aoReceber = null;
const ctx = {
  // só o que o navegador dá e o JavaScript puro não tem; Math, vetores etc. ficam os da própria caixa (atravessar a
  // fronteira entre as duas a cada operação deixava tudo 10x mais lento)
  console, performance, setTimeout, clearTimeout, MessageChannel,
  postMessage: m => { msgs.push(m); if (aoReceber) aoReceber(m); },
  // fetch mínimo: lê os arquivos de web/ (o worker lê o meta com .json() e os binários por stream)
  fetch: async url => {
    const bytes = readFileSync(join(raiz, 'web', url.replace(/\?.*$/, '')));
    return {
      ok: true, headers: { get: () => String(bytes.length) },
      json: async () => JSON.parse(bytes.toString('utf8')),
      body: { getReader: () => { let dado = false; return { read: async () => dado ? { done: true } : (dado = true, { done: false, value: new Uint8Array(bytes) }) }; } },
    };
  },
};
vm.createContext(ctx);
vm.runInContext(readFileSync(arquivo, 'utf8'), ctx, { filename: arquivo });
const envia = data => ctx.onmessage({ data });
const espera = tipo => new Promise(ok => { aoReceber = m => { if (m.type === tipo || m.type === 'error') { aoReceber = null; ok(m); } }; });

const pronto = espera('ready');
envia({ type: 'load' });
const r = await pronto;
if (r.type === 'error') throw new Error(r.message);
await new Promise(ok => setTimeout(ok, 0));   // na página, o "pronto" chega numa mensagem; o worker ainda termina de montar
const meta = JSON.parse(readFileSync(join(raiz, 'web/data/meta.json'), 'utf8'));
const tam = Object.fromEntries(Object.entries(meta.groups).map(([k, v]) => [k, v.length]));

const grupos = ['proboscide', 'fibra_gigante', 'dirige_L', 'dirige_R'];
async function medir(nome, rates, ms) {
  envia({type:'rates', rates});
  const cont = {}, inicio = msgs.filter(m => m.type === 'tick').at(-1)?.t || 0;
  let primeiro = null, pico = 0;
  await new Promise(ok => {
    aoReceber = m => {
      if (m.type !== 'tick') return;
      for (const g of grupos) cont[g] = (cont[g] || 0) + (m.counts[g] || 0);
      if (m.counts.proboscide && primeiro === null) primeiro = m.t - inicio;
      pico = Math.max(pico, m.counts.fibra_gigante || 0);
      if (m.t - inicio >= ms) { envia({type:'run', on:false}); aoReceber = null; ok(); }
    };
    envia({type:'run', on:true});
  });
  return {nome, duracao_ms:ms, entrada_hz:rates, primeiro_proboscide_ms:primeiro,
    pico_fibra_por_10ms:pico, disparos:cont,
    hz_grupo:Object.fromEntries(grupos.map(g=>[g, (cont[g] || 0)*1000/ms]))};
}
const fases = [];
for (const [nome, taxas, ms] of [['repouso',{},1000],['acucar',{doce:160},1500],['retirada',{},1500],['ameaca',{ameaca:200},500]]) {
  fases.push(await medir(nome,taxas,ms));
}
const saida = {metodo:'Worker real da pagina em VM Node, sem mudar parametros; fases consecutivas, taxas de entrada em Hz por neuronio. Uma realizacao Poisson, triagem funcional, nao validacao biologica. Taxas de saida somadas por grupo.', fases};
writeFileSync(join(raiz,'docs/medicoes/realismo-triagem.json'),JSON.stringify(saida,null,2)+'\n');
console.log(JSON.stringify(saida));
process.exit(0);
