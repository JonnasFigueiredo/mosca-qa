// Resume uma série da caça a bugs só com o cérebro (docs/medicoes/<prefixo>*.json): diferença pareada por semente
// entre duas condições no número de ações até o primeiro bug do teste (menor é melhor), nos bugs distintos do teste,
// e, na bancada 2, nas versões de transferência, no controle e em cada versão de teste. Para cada diferença: média,
// IC95 percentil de bootstrap (2000 reamostragens das sementes, só com 5 ou mais), p bilateral do mesmo bootstrap
// (2 × a menor fração das médias reamostradas de um lado do zero; é a inversão do IC) e tamanho do efeito dz (média /
// desvio-padrão das diferenças). Também a mudança de valência das ações da característica premiada contra as outras,
// e a fração das vezes em que ela escolheu uma ação premiada visível no teste.
//   uso: node scripts/qa_resumo.mjs [--prefixo qa-b2]      grava docs/medicoes/<prefixo>-resumo.json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
// junta <prefixo>.json e <prefixo>-pN.json (processos em paralelo), menos o próprio resumo
const PREFIXO = process.argv.includes('--prefixo') ? process.argv[process.argv.indexOf('--prefixo') + 1] : 'qa-abstrato';
const arquivos = readdirSync('docs/medicoes').filter(f => new RegExp('^' + PREFIXO + '(-p\\d+)?\\.json$').test(f));
const rod = arquivos.flatMap(f => JSON.parse(readFileSync('docs/medicoes/' + f, 'utf8')).rodadas).filter(r => PREFIXO !== 'qa-abstrato' || (r.sentir_s === 1 && r.orcamento_treino === 60));   // na série antiga, só a versão calibrada
const media = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const r2 = v => (v == null || Number.isNaN(v) ? null : +v.toFixed(2));
function bootstrap(a) {
  if (a.length < 5) return null;
  let s = 982451653; const v = [];
  for (let k = 0; k < 2000; k++) { let t = 0; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; t += a[Math.floor(s / 4294967296 * a.length)]; } v.push(t / a.length); }
  v.sort((x, y) => x - y);
  const abaixo = v.filter(x => x <= 0).length / v.length, acima = v.filter(x => x >= 0).length / v.length;
  return { ic95: [r2(v[49]), r2(v[1949])], p: +Math.min(1, 2 * Math.min(abaixo, acima)).toFixed(4) };
}
function estat(dif) {
  const m = media(dif), b = bootstrap(dif);
  const dp = dif.length > 1 ? Math.sqrt(dif.reduce((t, x) => t + (x - m) ** 2, 0) / (dif.length - 1)) : null;
  return { media: r2(m), ic95: b?.ic95 ?? null, p_bootstrap: b?.p ?? null, dz: dp ? r2(m / dp) : null, por_semente: dif.map(r2) };
}
const pega = (sem, c) => rod.findLast(r => r.semente === sem && r.condicao === c);
const sementes = [...new Set(rod.map(r => r.semente))].sort((a, b) => a - b);
const condicoes = [...new Set(rod.map(r => r.condicao))];
const b2 = rod.some(r => r.resumo_b2);
const ORC = rod[0]?.orcamento ?? 30;
// primeiro bug de cada versão de teste (31 quando não achou)
// (com --repeticoes-teste, a mesma versão aparece várias vezes: média das repetições)
function porVersao(r) {
  const ac = {};
  r.teste.forEach((b, i) => (ac[r.teste_versoes?.[i] ?? 'versao' + (i + 1)] ||= []).push(b.length ? b[0].passo : ORC + 1));
  return Object.fromEntries(Object.entries(ac).map(([k, v]) => [k, v.reduce((a, x) => a + x, 0) / v.length]));
}

const por = Object.fromEntries(condicoes.map(c => {
  const rs = sementes.map(s => pega(s, c)).filter(Boolean);
  const o = {
    sementes: rs.length,
    primeiro_bug_media: r2(media(rs.map(r => r.resumo.primeiro_bug_teste_media))),
    bugs_teste_media: r2(media(rs.map(r => r.resumo.bugs_teste))),
    bugs_treino_media: r2(media(rs.map(r => r.resumo.bugs_treino))),
  };
  if (b2) {
    o.transferencia_media = r2(media(rs.map(r => r.resumo_b2.primeiro_bug_transferencia)));
    o.controle_media = r2(media(rs.map(r => r.resumo_b2.primeiro_bug_controle)));
    const vs = rs.map(porVersao);
    o.por_versao = Object.fromEntries(Object.keys(vs[0] || {}).map(k => [k, r2(media(vs.map(v => v[k])))]));
  }
  if (rs.some(r => r.decepcoes_teste != null)) o.decepcoes_teste_media = r2(media(rs.map(r => r.decepcoes_teste ?? 0)));
  return [c, o];
}));

// pares: a treinada contra cada outra (ativa_menos_X, o critério usa ativa_menos_congelada) e, com a decepção, a
// treinada com decepção contra a congelada e contra a treinada sem decepção
function par(A, B) {
  const val = f => sementes.map(s => [pega(s, A), pega(s, B)]).filter(([a, b]) => a && b && f(a) != null && f(b) != null).map(([a, b]) => f(a) - f(b));
  const o = { sementes: val(r => r.resumo.primeiro_bug_teste_media).length, primeiro_bug: estat(val(r => r.resumo.primeiro_bug_teste_media)), bugs_teste: estat(val(r => r.resumo.bugs_teste)) };
  if (b2) {
    o.transferencia = estat(val(r => r.resumo_b2?.primeiro_bug_transferencia));
    o.controle = estat(val(r => r.resumo_b2?.primeiro_bug_controle));
    const nomes = Object.keys(por[A]?.por_versao || {});
    o.por_versao = Object.fromEntries(nomes.map(k => [k, estat(val(r => porVersao(r)[k]))]));
  }
  return o;
}
const pares = {};
if (condicoes.includes('ativa')) for (const outra of condicoes.filter(c => c !== 'ativa')) pares['ativa_menos_' + outra] = par('ativa', outra);
// as variantes da treinada (ativa_decepcao, ativa_curiosa) contra as outras condições, menos a própria treinada
for (const v of condicoes.filter(c => c.startsWith('ativa_')))
  for (const outra of condicoes.filter(c => c !== v && c !== 'ativa')) pares[v + '_menos_' + outra] = par(v, outra);

// característica premiada (repetida, ou normal no contrabalanço) e a mudança de valência com o treino
const car = rod.find(r => r.caracteristica)?.caracteristica ?? 'repetida';
const valencia = {};
for (const c of ['ativa', 'congelada']) {
  const prem = [], rep = [], outras = [];
  for (const s of sementes) {
    const r = pega(s, c); if (!r?.valencia_depois_do_treino) continue;
    for (const [k, v] of Object.entries(r.valencia_depois_do_treino)) {
      const d = v - r.valencia_antes[k];
      (k.endsWith(':' + car) ? prem : outras).push(d);
      if (k.endsWith(':repetida')) rep.push(d);
    }
  }
  if (prem.length) valencia[c] = { premiadas: r2(media(prem)), outras: r2(media(outras)), repetidas: r2(media(rep)) };
}
// fração das vezes em que uma ação premiada estava visível no teste e foi escolhida (a memória vira ação?)
const escolhas = {};
for (const c of condicoes) {
  let v = 0, e = 0;
  for (const s of sementes) {
    const x = pega(s, c)?.escolhas_teste; if (!x) continue;
    v += x.premiada_visivel ?? x.repetida_visivel; e += x.premiada_escolhida ?? x.repetida_escolhida;
  }
  if (v) escolhas[c] = +(e / v).toFixed(3);
}
const out = {
  metodo: 'Diferença pareada por semente (primeira condição menos a segunda). Primeiro bug: ações até o primeiro bug de cada versão de teste (31 quando não achou em 30); média das versões (primeiro_bug), das versões de transferência (transferencia) e o controle à parte (bancada 2). Negativo = a primeira achou antes. IC95 percentil de bootstrap das sementes (2000 reamostragens; só com 5 ou mais); p_bootstrap bilateral do mesmo bootstrap; dz = média / desvio-padrão das diferenças. Valência: mudança (depois do treino - antes) das ações da característica premiada contra as outras. escolhas_teste: fração das vezes em que havia uma ação premiada visível no teste e ela foi escolhida.',
  caracteristica_premiada: car, sementes, por_condicao: por, pares, mudanca_de_valencia: valencia,
  ...(Object.keys(escolhas).length ? { escolhas_teste: escolhas } : {}),
};
writeFileSync('docs/medicoes/' + PREFIXO + '-resumo.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
