// Correção para várias comparações na caça a bugs (item 3 do plano, 01/10). Junta o critério principal de cada série
// confirmatória já resumida (treinada − congelada: na bancada 2, nas versões de transferência; antes, na média das
// versões de teste) e ajusta os p do bootstrap pelo método de Holm (controla a chance de qualquer falso positivo na
// família inteira). Uma série só entra na família se já tem resumo. p do bootstrap com 2000 reamostragens: 0 vira
// < 0,0005.   uso: node scripts/qa_comparacoes.mjs        grava docs/medicoes/qa-comparacoes.json
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// a família, na ordem em que as séries rodaram (a lista cresce com a fila; cada nova série entra aqui)
const FAMILIA = [
  ['qa-abstrato', 'bancada 1, com desconto (memória externa; referência)'],
  ['qa-honesto', 'bancada 1, cheiros calibrados fracos'],
  ['qa-fortes', 'bancada 1, cheiros fortes, treino padrão'],
  ['qa-fortes-curto', 'bancada 1, treino curto'],
  ['qa-fortes-espacado', 'bancada 1, treino espaçado'],
  ['qa-b2', 'bancada 2, principal'],
  ['qa-b2-replica', 'bancada 2, replicação'],
  ['qa-b2-cheiro-trocado', 'bancada 2, cheiros de repetida e normal trocados'],
  ['qa-b2-cheiro-trocado-replica', 'bancada 2, cheiros trocados, replicação'],
  ['qa-b2-retencao', 'bancada 2, retenção de 180 s'],
  ['qa-b2-retencao-replica', 'bancada 2, retenção, replicação'],
  ['qa-b2-normal', 'bancada 2, contrabalanço: característica normal premiada'],
  ['qa-b2-normal-replica', 'bancada 2, contrabalanço, replicação'],
  ['qa-b2-decepcao', 'bancada 2, decepção no teste (treinada com decepção − congelada)'],
  ['qa-b2-decepcao-replica', 'bancada 2, decepção, replicação'],
];
const linhas = [];
for (const [prefixo, desc] of FAMILIA) {
  const f = `docs/medicoes/${prefixo}-resumo.json`;
  if (!existsSync(f)) continue;
  const o = JSON.parse(readFileSync(f, 'utf8'));
  const par = prefixo.includes('decepcao') ? o.pares.ativa_decepcao_menos_congelada : o.pares.ativa_menos_congelada;
  const x = par?.transferencia ?? par?.primeiro_bug;
  if (!x || x.p_bootstrap == null) continue;
  linhas.push({ serie: prefixo, desc, medida: par.transferencia ? 'transferencia' : 'primeiro_bug', media: x.media, ic95: x.ic95, dz: x.dz, p: Math.max(x.p_bootstrap, 0.0005), sementes: par.sementes });
}
// Holm: ordena os p; o k-ésimo menor (de m) é multiplicado por (m − k + 1), e o ajustado nunca desce ao longo da ordem
const m = linhas.length, ord = [...linhas].sort((a, b) => a.p - b.p);
let maior = 0;
ord.forEach((l, k) => { maior = Math.max(maior, Math.min(1, (m - k) * l.p)); l.p_holm = +maior.toFixed(4); l.passa_holm = l.p_holm < 0.05 && l.media < 0; });
const out = {
  metodo: 'Critério principal de cada série confirmatória (diferença pareada treinada − congelada; na bancada 2, a média das versões de transferência; na decepção, treinada com decepção − congelada). p bilateral do bootstrap de qa_resumo.mjs (0 vira 0,0005, o menor valor que 2000 reamostragens resolvem) ajustado por Holm para a família inteira de séries rodadas até agora. Uma série "passa" com p de Holm < 0,05 e média negativa.',
  familia: m, series: linhas,
};
writeFileSync('docs/medicoes/qa-comparacoes.json', JSON.stringify(out, null, 1) + '\n');
for (const l of linhas) console.log(l.serie.padEnd(30), String(l.media).padStart(6), JSON.stringify(l.ic95).padEnd(16), 'p', l.p, 'Holm', l.p_holm, l.passa_holm ? 'PASSA' : '');
