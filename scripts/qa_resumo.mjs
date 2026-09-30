// Resume docs/medicoes/qa-abstrato.json: diferença pareada por semente (treinada - outra condição) no número de ações
// até o primeiro bug do teste (menor é melhor) e nos bugs distintos do teste, com intervalo percentil de bootstrap
// (2000 reamostragens das sementes, só com 5 ou mais). Também a mudança de valência das ações "repetidas" contra as
// outras, depois do treino. Grava docs/medicoes/qa-abstrato-resumo.json.   uso: node scripts/qa_resumo.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
// junta qa-abstrato.json e qa-abstrato-*.json (processos em paralelo), menos o próprio resumo
const arquivos = readdirSync('docs/medicoes').filter(f => /^qa-abstrato(-p\d+)?\.json$/.test(f));
const rod = arquivos.flatMap(f => JSON.parse(readFileSync('docs/medicoes/' + f, 'utf8')).rodadas).filter(r => r.sentir_s === 1 && r.orcamento_treino === 60);   // só a versão calibrada
const media = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
function ic(a) {
  if (a.length < 5) return null;
  let s = 982451653; const v = [];
  for (let k = 0; k < 2000; k++) { let t = 0; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; t += a[Math.floor(s / 4294967296 * a.length)]; } v.push(t / a.length); }
  v.sort((x, y) => x - y); return [+v[49].toFixed(2), +v[1949].toFixed(2)];
}
const pega = (sem, c) => rod.findLast(r => r.semente === sem && r.condicao === c);
const sementes = [...new Set(rod.map(r => r.semente))].sort((a, b) => a - b);
const condicoes = [...new Set(rod.map(r => r.condicao))];
const por = Object.fromEntries(condicoes.map(c => [c, {
  primeiro_bug_media: +media(sementes.map(s => pega(s, c)?.resumo.primeiro_bug_teste_media).filter(v => v != null)).toFixed(2),
  bugs_teste_media: +media(sementes.map(s => pega(s, c)?.resumo.bugs_teste).filter(v => v != null)).toFixed(2),
  bugs_treino_media: +media(sementes.map(s => pega(s, c)?.resumo.bugs_treino).filter(v => v != null)).toFixed(2),
}]));
const pares = {};
for (const outra of condicoes.filter(c => c !== 'ativa')) {
  const dif = [], difBugs = [];
  for (const s of sementes) { const a = pega(s, 'ativa'), b = pega(s, outra); if (a && b) { dif.push(a.resumo.primeiro_bug_teste_media - b.resumo.primeiro_bug_teste_media); difBugs.push(a.resumo.bugs_teste - b.resumo.bugs_teste); } }
  pares['ativa_menos_' + outra] = { sementes: dif.length, primeiro_bug: { media: +media(dif)?.toFixed(2), ic95: ic(dif), por_semente: dif.map(v => +v.toFixed(2)) },
    bugs_teste: { media: +media(difBugs)?.toFixed(2), ic95: ic(difBugs) } };
}
const valencia = {};
for (const c of ['ativa', 'congelada']) {
  const rep = [], outras = [];
  for (const s of sementes) {
    const r = pega(s, c); if (!r?.valencia_depois_do_treino) continue;
    for (const [k, v] of Object.entries(r.valencia_depois_do_treino)) (k.endsWith(':repetida') ? rep : outras).push(v - r.valencia_antes[k]);
  }
  valencia[c] = { repetidas: +media(rep)?.toFixed(3), outras: +media(outras)?.toFixed(3) };
}
const out = { metodo: 'Diferença pareada por semente: ativa menos a outra condição. Primeiro bug: média, entre as 3 versões de teste, das ações até o primeiro bug (31 quando não achou em 30). Negativo = a treinada achou antes. IC95 percentil de bootstrap das sementes (2000 reamostragens; só com 5 ou mais). Valência: mudança (depois do treino - antes) da média das ações repetidas e das outras.', sementes, por_condicao: por, pares, mudanca_de_valencia: valencia };
writeFileSync('docs/medicoes/qa-abstrato-resumo.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
