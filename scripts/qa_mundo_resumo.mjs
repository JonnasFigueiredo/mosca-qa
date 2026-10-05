// Resume uma série da caça a bugs no mundo (scripts/qa_mundo.mjs): por semente, treinada (ativa) menos congelada.
// Medidas do teste (cada versão vai até o primeiro bug ou 180 s de cérebro; sem recompensa):
// - provas até o primeiro bug nas versões de transferência (quando não achou: as provas feitas + 1), e no controle à parte;
// - tempo até o primeiro bug (s de cérebro; a duração da versão quando não achou);
// - fração das provas em plaquinhas da característica premiada (a memória vira escolha?).
// IC95 percentil de bootstrap das sementes (2000 reamostragens; só com 5 ou mais), p bilateral do mesmo bootstrap, dz.
// --calibracao: só o treino (sessões com &so=treino): fração das versões de treino em que achou o bug e o tempo até ele.
//   uso: node scripts/qa_mundo_resumo.mjs --prefixo qa-mundo-piloto      grava docs/medicoes/<prefixo>-resumo.json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const PREFIXO = process.argv.includes('--prefixo') ? process.argv[process.argv.indexOf('--prefixo') + 1] : 'qa-mundo-piloto';
const arquivos = readdirSync('docs/medicoes').filter(f => new RegExp('^' + PREFIXO + '(-p\\d+)?\\.json$').test(f));
const media = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r2 = v => (v == null || Number.isNaN(v) ? null : +v.toFixed(2));
const todasSess = arquivos.flatMap(f => JSON.parse(readFileSync('docs/medicoes/' + f, 'utf8')).sessoes);
if (process.argv.includes('--calibracao')) {
  // treino: achou o bug na versão? em quanto tempo (s de cérebro)? (tBug; nas sessões antigas, a duração − 10 s)
  const ok = todasSess.filter(s => !s.erro && s.treino?.length), vs = ok.flatMap(s => s.treino);
  const t = vs.filter(v => v.bugs > 0).map(v => v.tBug ?? v.tempo - 10).sort((a, b) => a - b);
  const out = { metodo: 'Calibração do mundo, só o treino: fração das versões de treino em que ela achou o bug (com recompensa), mediana do tempo até ele (s de cérebro), provas por versão.',
    sessoes: ok.length, erros: todasSess.length - ok.length, versoes: vs.length, fracao_achou: vs.length ? r2(vs.filter(v => v.bugs > 0).length / vs.length) : null,
    mediana_tempo_bug: t.length ? r2(t[Math.floor(t.length / 2)]) : null, provas_por_versao: r2(media(vs.map(v => v.provas))),
    por_sessao: ok.map(s => ({ semente: s.semente, achou: s.treino.map(v => v.bugs > 0 ? 1 : 0).join(''), provas: s.treino.map(v => v.provas).join(',') })) };
  writeFileSync('docs/medicoes/' + PREFIXO + '-resumo.json', JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
}
const sess = todasSess.filter(s => !s.erro && s.teste?.length);
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
  // arena de escolha (sessões com "tentativas"): primeiro = tentativas até o primeiro bug; 31 quando não achou em 30,
  // como as ações da bancada. escolha_premiada = fração das tentativas do teste com uma ação da característica premiada
  // visível em que ela escolheu uma dessas (a medida de escolha da bancada)
  const arena = !!s.teste[0]?.tentativas;
  const provas = v => v.primeiro ?? (arena ? 31 : v.provas + 1), tempo = v => v.tempo ?? v.duracao;
  const todas = s.teste.flatMap(v => v.provadas || []), prem = todas.filter(a => a.endsWith(':' + car)).length;
  const tent = arena ? s.teste.flatMap(v => v.tentativas).filter(t => t.escolha && t.opcoes.some(a => a.endsWith(':' + car))) : [];
  return {
    escolha_premiada: tent.length ? tent.filter(t => t.escolha.endsWith(':' + car)).length / tent.length : null,
    transferencia: media(tr.map(provas)), controle: media(ct.map(provas)),
    tempo_transferencia: media(tr.map(tempo)), tempo_controle: media(ct.map(tempo)),
    fracao_premiada: todas.length ? prem / todas.length : null,
    bugs_treino: (s.treino || []).reduce((t, v) => t + v.bugs, 0), provas_teste: todas.length,
  };
}
const pega = (sem, c) => sess.filter(s => s.semente === sem && s.condicao === c).at(-1);
const sementes = [...new Set(sess.map(s => s.semente))].sort((a, b) => a - b);
const condicoes = [...new Set(sess.map(s => s.condicao))];
const chaves = ['escolha_premiada', 'transferencia', 'controle', 'tempo_transferencia', 'tempo_controle', 'fracao_premiada', 'bugs_treino', 'provas_teste'];
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
  metodo: 'Treinada (ativa) menos congelada, pareado por semente. transferencia/controle: provas até o primeiro bug nas versões de teste (as provas feitas + 1 quando não achou em 180 s). tempo_*: s de cérebro até o primeiro bug (a duração da versão quando não achou). fracao_premiada: fração das provas do teste em plaquinhas da característica premiada. IC95 percentil de bootstrap (2000; só com 5 ou mais sementes), p bilateral do mesmo bootstrap, dz = média / desvio das diferenças.',
  sementes, sessoes_validas: sess.length, por_condicao: por, ativa_menos_congelada: pares,
};
writeFileSync('docs/medicoes/' + PREFIXO + '-resumo.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
