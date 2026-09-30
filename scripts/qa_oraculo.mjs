// Diagnóstico da caça a bugs sem cérebro: se a mosca tivesse aprendido perfeitamente "repetida é boa", acharia os bugs
// de teste antes? Compara, nas versões de teste do Pedidos, com as mesmas regras de visibilidade de qa_abstrato.mjs
// (3 de 15 ações por passo, 30 passos): aleatória; "prefere repetida" (escolhe uma repetida visível, senão ao acaso);
// "só repetida" e novidade. Também conta, por versão, com que frequência uma repetida aparece e quantas vezes a
// repetida certa precisa ser feita. Grava docs/medicoes/qa-oraculo.json.   uso: node scripts/qa_oraculo.mjs
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../web/qa/pedidos.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = 4000, ORC = +arg('orcamento', 30), VIS = +arg('visiveis', 3), BANCADA = +arg('bancada', 1);
const VERS = BANCADA === 2 ? Q.VERSOES2.teste : Q.VERSOES.teste;
// memória imperfeita, como a do cérebro: valência = ganho nas repetidas + ruído gaussiano (desvio 0,15, qa-calibracao)
// e softmax com T 0,15, igual a qa_abstrato.mjs
const gauss = r => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const softmax = ganho => (op, r) => { const v = op.map(a => (a.entrada === 'repetida' ? ganho : 0) + 0.15 * gauss(r)); const e = v.map(x => Math.exp(x / 0.15)), t = e.reduce((a, b) => a + b, 0); let u = r() * t, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++; return op[k]; };
const gerador = s => () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
function vistas(r) {
  return Array.from({ length: ORC }, () => { const ids = [...Q.ACOES]; for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } return ids.slice(0, VIS); });
}
const POL = {
  aleatoria: (op, r) => op[Math.floor(r() * op.length)],
  prefere_repetida: (op, r) => { const rep = op.filter(a => a.entrada === 'repetida'); const c = rep.length ? rep : op; return c[Math.floor(r() * c.length)]; },
  memoria_0: softmax(0), memoria_025: softmax(0.25), memoria_055: softmax(0.55),
  novidade: (op, r, t) => { const m = Math.min(...op.map(a => t[a.id] || 0)); const c = op.filter(a => (t[a.id] || 0) === m); return c[Math.floor(r() * c.length)]; },
};
const res = {};
for (const defeitos of VERS) {
  const nome = defeitos.join('+'); res[nome] = {};
  for (const [pol, f] of Object.entries(POL)) {
    let soma = 0, achou = 0, reps = 0, acaoBug = {};
    for (let i = 0; i < N; i++) {
      const r = gerador(i * 7 + 1), v = vistas(gerador(i * 13 + 5)), sis = Q.criar(defeitos, { bancada: BANCADA }), t = {};
      let primeiro = ORC + 1;
      for (let p = 0; p < ORC; p++) {
        const a = f(v[p], r, t); t[a.id] = (t[a.id] || 0) + 1; if (a.entrada === 'repetida') reps++;
        sis.executar(a.id);
        if (Q.verificar(sis).length) { primeiro = p + 1; acaoBug[a.id] = (acaoBug[a.id] || 0) + 1; break; }
      }
      soma += primeiro; if (primeiro <= ORC) achou++;
    }
    res[nome][pol] = { primeiro_bug_media: +(soma / N).toFixed(2), achou: +(achou / N).toFixed(3), repetidas_por_passo: +(reps / N / ORC).toFixed(2), acao_que_revelou: acaoBug };
  }
}
const media = pol => +(Object.values(res).reduce((s, x) => s + x[pol].primeiro_bug_media, 0) / Object.keys(res).length).toFixed(2);
const out = { bancada: BANCADA, visiveis: VIS, orcamento: ORC, metodo: `Sem cérebro. memoria_X = softmax (T 0,15) com a valência das repetidas X acima das outras e ruído de desvio 0,15 (a memória medida no cérebro foi +0,17 a +0,55). ${N} episódios por versão de teste e política; ${VIS} de ${Q.ACOES.length} ações visíveis por passo, ${ORC} passos (31 quando não achou). "prefere_repetida" = a memória perfeita do treino (escolhe uma repetida visível, senão ao acaso). Uma repetida aparece entre as visíveis em ~${(1 - (12 * 11 * 10) / (15 * 14 * 13)).toFixed(2)} dos passos.`,
  por_versao: res, media_das_versoes: Object.fromEntries(Object.keys(POL).map(p => [p, media(p)])) };
writeFileSync(arg('saida', 'docs/medicoes/qa-oraculo.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out.media_das_versoes)); for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(Object.fromEntries(Object.entries(v).map(([p, x]) => [p, [x.primeiro_bug_media, x.achou, x.acao_que_revelou]]))));
