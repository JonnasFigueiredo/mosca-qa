// Testa o sistema de Pedidos do treino (web/qa/pedidos.js): a versão correta nunca viola contrato (sem falso positivo)
// e cada defeito das versões de treino e teste é alcançável por ações aleatórias e detectado pelo verificador.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../web/qa/pedidos.js');

let s = 7;
const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
const sorteia = () => Q.ACOES[Math.floor(rnd() * Q.ACOES.length)].id;

// 1. correta: 200 episódios de 200 ações, nenhuma violação
for (let e = 0; e < 200; e++) {
  const sis = Q.criar([]);
  for (let i = 0; i < 200; i++) { const a = sorteia(); sis.executar(a); assert.deepEqual(Q.verificar(sis), [], `falso positivo depois de ${a}`); }
}
// 2. cada defeito: ações aleatórias até violar; mediana de ações necessárias (dificuldade)
const defeitos = [...new Set([...Q.VERSOES.treino, ...Q.VERSOES.teste].flat())];
const dificuldade = {};
for (const d of defeitos) {
  const n = [];
  for (let e = 0; e < 200; e++) {
    const sis = Q.criar([d]);
    for (let i = 1; i <= 400; i++) { sis.executar(sorteia()); if (Q.verificar(sis).length) { n.push(i); break; } }
  }
  assert.ok(n.length > 100, `defeito ${d} raramente alcançado (${n.length}/200)`);
  n.sort((a, b) => a - b);
  dificuldade[d] = { achado_em: n.length + '/200', mediana_acoes: n[Math.floor(n.length / 2)] };
}
// 3. cada ação tem cheiro de 4 glomérulos distintos
for (const a of Q.ACOES) assert.equal(new Set(Q.cheiroDe(a)).size, 4);
console.log('Pedidos: sem falso positivo em 40.000 ações; defeitos alcançáveis por ações aleatórias:', JSON.stringify(dificuldade));
