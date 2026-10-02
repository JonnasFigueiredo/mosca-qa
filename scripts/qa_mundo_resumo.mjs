// Resume uma série da caça a bugs no mundo (scripts/qa_mundo.mjs): por semente, treinada (ativa) menos congelada.
// Medidas do teste (cada versão vai até o primeiro bug, 15 provas ou 120 s; sem recompensa):
// - provas até o primeiro bug nas versões de transferência (16 quando não achou), e no controle à parte;
// - tempo até o primeiro bug (s de cérebro; a duração da versão quando não achou);
// - fração das provas em plaquinhas da característica premiada (a memória vira escolha?).
// IC95 percentil de bootstrap das sementes (2000 reamostragens; só com 5 ou mais), p bilateral do mesmo bootstrap, dz.
//   uso: node scripts/qa_mundo_resumo.mjs --prefixo qa-mundo-piloto      grava docs/medicoes/<prefixo>-resumo.json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const PREFIXO = process.argv.includes('--prefixo') ? process.argv[process.argv.indexOf('--prefixo') + 1] : 'qa-mundo-piloto';
const arquivos = readdirSync('docs/medicoes').filter(f => new RegExp('^' + PREFIXO + '(-p\\d+)?\\.json$').test(f));
const sess = arquivos.flatMap(f => JSON.parse(readFileSync('docs/medicoes/' + f, 'utf8')).sessoes).filter(s => !s.erro && s.teste?.length);
const media = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r2 = v => (v == null || Number.isNaN(v) ? null : +v.toFixed(2));
function bootstrap(a) {
  if (a.length < 5) return null;
  let s = 982451653; const v = [];
  for (let k = 0; k < 2000; k++) { let t = 0; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; t += a[Math.floor(s / 4294967296 * a.length)]; } v.push(t / a.length); }
  v.sort((x, y) => x - y);
  const ab = v.filter(x => x <= 0).length / v.length, ac = v.filter(x => x >= 0).length / v.length;
  return { ic95: [r2(v[49]), r2(v[1949])], p: +Math.min(1, 2 * Math.min(ab, ac)).toFixed(4) };
}
function estat(d) {
  const m = media(d), b = bootstrap(d), dp = d.length > 1 ? Math.sqrt(d.reduce((t, x) => t + (x - m) ** 2, 0) / (d.length - 1)) : null;
  return { n: d.length, media: r2(m), ic95: b?.ic95 ?? null, p_bootstrap: b?.p ?? null, dz: dp ? r2(m / dp) : null, por_semente: d.map(r2) };
}
// medidas de uma sessão
function medidas(s) {
  const car = s.caracteristica || 'repetida', tr = s.teste.filter(v => !v.controle), ct = s.teste.filter(v => v.controle);
  const provas = v => v.primeiro ?? 16, tempo = v => v.tempo ?? v.duracao;
  const todas = s.teste.flatMap(v => v.provadas || []), prem = todas.filter(a => a.endsWith(':' + car)).length;
  return {
    transferencia: media(tr.map(provas)), controle: media(ct.map(provas)),
    tempo_transferencia: media(tr.map(tempo)), tempo_controle: media(ct.map(tempo)),
    fracao_premiada: todas.length ? prem / todas.length : null,
    bugs_treino: (s.treino || []).reduce((t, v) => t + v.bugs, 0), provas_teste: todas.length,
  };
}
const pega = (sem, c) => sess.filter(s => s.semente === sem && s.condicao === c).at(-1);
const sementes = [...new Set(sess.map(s => s.semente))].sort((a, b) => a - b);
const condicoes = [...new Set(sess.map(s => s.condicao))];
const chaves = ['transferencia', 'controle', 'tempo_transferencia', 'tempo_controle', 'fracao_premiada', 'bugs_treino', 'provas_teste'];
const por = Object.fromEntries(condicoes.map(c => {
  const ms = sementes.map(s => pega(s, c)).filter(Boolean).map(medidas);
  return [c, { sementes: ms.length, ...Object.fromEntries(chaves.map(k => [k, r2(media(ms.map(m => m[k]).filter(v => v != null)))])) }];
}));
const pares = {};
if (condicoes.includes('ativa') && condicoes.includes('congelada')) {
  const ps = sementes.map(s => [pega(s, 'ativa'), pega(s, 'congelada')]).filter(([a, b]) => a && b).map(([a, b]) => [medidas(a), medidas(b)]);
  for (const k of chaves) pares[k] = estat(ps.filter(([a, b]) => a[k] != null && b[k] != null).map(([a, b]) => a[k] - b[k]));
}
const out = {
  metodo: 'Treinada (ativa) menos congelada, pareado por semente. transferencia/controle: provas até o primeiro bug nas versões de teste (16 quando não achou em 15 provas ou 120 s). tempo_*: s de cérebro até o primeiro bug (a duração da versão quando não achou). fracao_premiada: fração das provas do teste em plaquinhas da característica premiada. IC95 percentil de bootstrap (2000; só com 5 ou mais sementes), p bilateral do mesmo bootstrap, dz = média / desvio das diferenças.',
  sementes, sessoes_validas: sess.length, por_condicao: por, ativa_menos_congelada: pares,
};
writeFileSync('docs/medicoes/' + PREFIXO + '-resumo.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
