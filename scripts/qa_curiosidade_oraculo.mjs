// Oráculo da memória + curiosidade (01/10), sem cérebro, antes de qualquer rodada com o cérebro. Pergunta: somar a
// habituação ("o que ela já tentou neste sistema atrai menos") à valência aprendida pode empatar com o explorador por
// novidade, ou ganhar dele, na média de todos os defeitos do teste? E com que peso H?
// A valência de cada ação vem do cérebro: a média medida depois do treino nas séries qa-b2 e qa-b2-replica (treinada e
// congelada; inclui o viés de nascença de cada cheiro), mais ruído de amostra de desvio 0,15 (qa-calibracao.json) a
// cada vez que ela cheira. Escolha: softmax com T 0,15 sobre (valência − H × vezes que já tentou a ação neste
// episódio). Mesmas versões de teste da bancada 2, 3 de 15 ações visíveis, 30 passos, fim no primeiro bug.
//   uso: node scripts/qa_curiosidade_oraculo.mjs       grava docs/medicoes/qa-curiosidade-oraculo.json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../web/qa/pedidos.js');
const N = 4000, ORC = 30, VIS = 3, T = 0.15, RUIDO = 0.15, HS = [0, 0.1, 0.2, 0.3, 0.5, 0.8, 1.2, 1.6, 2.5, 4, 8];
const gerador = s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
// valência média depois do treino, medida no cérebro
const rod = ['qa-b2', 'qa-b2-replica'].flatMap(p => readdirSync('docs/medicoes').filter(f => new RegExp('^' + p + '-p\\d+\\.json$').test(f)))
  .flatMap(f => JSON.parse(readFileSync('docs/medicoes/' + f, 'utf8')).rodadas);
function valMedia(cond) {
  const ac = {};
  for (const r of rod.filter(r => r.condicao === cond && r.valencia_depois_do_treino)) for (const [k, v] of Object.entries(r.valencia_depois_do_treino)) (ac[k] ||= []).push(v);
  return Object.fromEntries(Object.entries(ac).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
}
const VAL = { treinada: valMedia('ativa'), congelada: valMedia('congelada') };
const softmax = (x, r) => { const e = x.map(v => Math.exp(v / T)), t = e.reduce((a, b) => a + b, 0); let u = r() * t, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++; return k; };
const politica = (val, H) => (op, r, n) => op[softmax(op.map(a => val[a.id] + RUIDO * gauss(r) - H * (n[a.id] || 0)), r)];
const novidade = (op, r, n) => { const m = Math.min(...op.map(a => n[a.id] || 0)); const c = op.filter(a => (n[a.id] || 0) === m); return c[Math.floor(r() * c.length)]; };
const aleatoria = (op, r) => op[Math.floor(r() * op.length)];
function vistas(r) { return Array.from({ length: ORC }, () => { const ids = [...Q.ACOES]; for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } return ids.slice(0, VIS); }); }
const V = Q.VERSOES2, ctrl = V.teste.map(d => d.join('+') === V.controle.join('+'));
function mede(f) {
  const pv = V.teste.map(d => {
    let soma = 0;
    for (let i = 0; i < N; i++) {
      const r = gerador(i * 7 + 1), v = vistas(gerador(i * 13 + 5)), sis = Q.criar(d, { bancada: 2 }), n = {};
      let primeiro = ORC + 1;
      for (let p = 0; p < ORC; p++) { const a = f(v[p], r, n); n[a.id] = (n[a.id] || 0) + 1; sis.executar(a.id); if (Q.verificar(sis).length) { primeiro = p + 1; break; } }
      soma += primeiro;
    }
    return soma / N;
  });
  const m = a => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
  return { geral: m(pv), transferencia: m(pv.filter((_, i) => !ctrl[i])), controle: m(pv.filter((_, i) => ctrl[i])) };
}
const res = { aleatoria: mede(aleatoria), novidade: mede(novidade) };
for (const H of HS) { res['treinada_H' + H] = mede(politica(VAL.treinada, H)); res['congelada_H' + H] = mede(politica(VAL.congelada, H)); }
writeFileSync('docs/medicoes/qa-curiosidade-oraculo.json', JSON.stringify({
  metodo: `Sem cérebro. Valência de cada ação = média medida no cérebro depois do treino (qa-b2 e qa-b2-replica; treinada ou congelada) + ruído N(0; ${RUIDO}) a cada amostra; escolha softmax T ${T} sobre valência − H × tentativas da ação no episódio. ${N} episódios por versão de teste da bancada 2 (${V.teste.map(d => d.join('+')).join(', ')}); ${VIS} de 15 visíveis; ${ORC} passos; fim no primeiro bug (31 se não achou). geral = média das 3 versões; transferencia = as 2 primeiras; controle = quantidade negativa. Não inclui o esquecimento durante o teste.`,
  valencias: VAL, res,
}, null, 1) + '\n');
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(18), JSON.stringify(v));
