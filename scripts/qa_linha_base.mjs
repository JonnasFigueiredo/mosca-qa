// Linha de base de aprendizado de máquina para a caça a bugs da bancada 2 (item 2 do plano, 01/10). Sem cérebro. Os
// mesmos episódios da mosca: mesmas sementes, mesmas ações visíveis (a mesma função de sorteio de qa_abstrato.mjs),
// treino 6 × 20 ações nas versões de treino com recompensa a cada bug novo, teste nas 3 versões sem recompensa e
// terminando no primeiro bug. Os agentes veem só o que a mosca vê: as duas características de cada ação visível.
// - rw: Rescorla–Wagner linear por característica (o modelo clássico do condicionamento; V = w[família] +
//   w[entrada]; atualiza a cada escolha no treino, com recompensa 1 no bug novo e 0 sem ele; α 0,3), softmax T 0,15;
// - rw_so_recompensa: o mesmo, mas só atualiza quando há recompensa (como a mosca, que não é punida sem bug no treino);
// - por_acao: valor por ação inteira, sem características (o mesmo RW, uma "característica" por ação): sem
//   generalização, não deve transferir;
// - prefere_premiada: o teto (escolhe uma ação da característica premiada visível, senão ao acaso).
// Compara com a mosca treinada, semente a semente, nas séries qa-b2 e qa-b2-replica.
//   uso: node scripts/qa_linha_base.mjs [--caracteristica normal --serie qa-b2-normal]
//   grava docs/medicoes/qa-linha-base[-<caracteristica>].json
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const Q = createRequire(import.meta.url)('../web/qa/pedidos.js');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const CAR = arg('caracteristica', 'repetida'), V = CAR === 'normal' ? Q.VERSOES2N : Q.VERSOES2;
const SERIES = arg('serie', CAR === 'normal' ? 'qa-b2-normal,qa-b2-normal-replica' : 'qa-b2,qa-b2-replica').split(',');
const TREINOS = 6, ORC_TREINO = 20, ORC = 30, VIS = 3, ALFA0 = 0.3, T0 = 0.15;   // escolhidos antes de rodar
// iguais a qa_abstrato.mjs
const gerador = semente => { let s = semente >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
function visiveis(semente, n) {
  const r = gerador(semente), out = [];
  for (let i = 0; i < n; i++) { const ids = [...Q.ACOES]; for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } out.push(ids.slice(0, VIS)); }
  return out;
}
const caracs = { rw: a => [a.familia, a.entrada], rw_so_recompensa: a => [a.familia, a.entrada], por_acao: a => [a.id] };
function agente(tipo, ALFA = ALFA0, T = T0) {
  const w = {};
  const valor = a => caracs[tipo](a).reduce((t, c) => t + (w[c] || 0), 0);
  return {
    escolhe(op, rnd) {
      if (tipo === 'prefere_premiada') { const c = op.filter(a => a.entrada === CAR); const x = c.length ? c : op; return x[Math.floor(rnd() * x.length)]; }
      const e = op.map(a => Math.exp(valor(a) / T)), soma = e.reduce((x, y) => x + y, 0);
      let u = rnd() * soma, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++; return op[k];
    },
    aprende(a, recompensa) {
      if (tipo === 'prefere_premiada' || (tipo === 'rw_so_recompensa' && !recompensa)) return;
      const erro = (recompensa ? 1 : 0) - valor(a);
      for (const c of caracs[tipo](a)) w[c] = (w[c] || 0) + ALFA * erro;
    },
  };
}
function episodio(defeitos, vistas, ag, rnd, orcamento, teste) {
  const sis = Q.criar(defeitos, { bancada: 2 }), achados = new Set(); let primeiro = orcamento + 1;
  for (let p = 0; p < orcamento; p++) {
    const a = ag.escolhe(vistas[p], rnd);
    sis.executar(a.id);
    const novos = Q.verificar(sis).filter(x => !achados.has(x));
    for (const x of novos) achados.add(x);
    if (novos.length && primeiro > orcamento) primeiro = p + 1;
    if (teste && novos.length) break;
    if (!teste) ag.aprende(a, novos.length > 0);
  }
  return primeiro;
}
// a mosca treinada, por semente, nas séries da bancada 2
const mosca = {};
for (const serie of SERIES) for (const f of readdirSync('docs/medicoes').filter(f => new RegExp('^' + serie + '-p\\d+\\.json$').test(f)))
  for (const r of JSON.parse(readFileSync('docs/medicoes/' + f, 'utf8')).rodadas) if (r.resumo_b2) (mosca[r.condicao] ||= {})[r.semente] = r.resumo_b2;
const sementes = Object.keys(mosca.ativa || {}).map(Number).sort((a, b) => a - b);
const ctrlIdx = V.teste.map(d => d.join('+') === V.controle.join('+'));
function roda(tipo, alfa, t) {
  const r = {};
  for (const s of sementes) {
    const ag = agente(tipo, alfa, t), rnd = gerador(s * 31 + 17);
    for (let i = 0; i < TREINOS; i++) episodio(V.treino[i % V.treino.length], visiveis(s * 100 + i, ORC_TREINO), ag, rnd, ORC_TREINO, false);
    const pr = V.teste.map((d, i) => episodio(d, visiveis(s * 100 + 50 + i, ORC), ag, rnd, ORC, true));
    const tr = pr.filter((_, i) => !ctrlIdx[i]), ct = pr.filter((_, i) => ctrlIdx[i]);
    r[s] = { transferencia: tr.reduce((a, b) => a + b, 0) / tr.length, controle: ct.reduce((a, b) => a + b, 0) / ct.length };
  }
  return r;
}
const res = Object.fromEntries(['rw', 'rw_so_recompensa', 'por_acao', 'prefere_premiada'].map(t => [t, roda(t)]));
const media = a => a.reduce((x, y) => x + y, 0) / a.length, r2 = v => +v.toFixed(2);
function ic(a) {
  let s = 982451653; const v = [];
  for (let k = 0; k < 2000; k++) { let t = 0; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; t += a[Math.floor(s / 4294967296 * a.length)]; } v.push(t / a.length); }
  v.sort((x, y) => x - y); return [r2(v[49]), r2(v[1949])];
}
const resumo = { mosca_treinada: { transferencia: r2(media(sementes.map(s => mosca.ativa[s].primeiro_bug_transferencia))), controle: r2(media(sementes.map(s => mosca.ativa[s].primeiro_bug_controle))) } };
const pares = {};
for (const tipo of Object.keys(res)) {
  resumo[tipo] = { transferencia: r2(media(sementes.map(s => res[tipo][s].transferencia))), controle: r2(media(sementes.map(s => res[tipo][s].controle))) };
  const dt = sementes.map(s => mosca.ativa[s].primeiro_bug_transferencia - res[tipo][s].transferencia);
  const dc = sementes.map(s => mosca.ativa[s].primeiro_bug_controle - res[tipo][s].controle);
  pares['mosca_menos_' + tipo] = { transferencia: { media: r2(media(dt)), ic95: ic(dt) }, controle: { media: r2(media(dc)), ic95: ic(dc) } };
}
// sensibilidade: a conclusão não pode depender de α e T escolhidos por nós
const sensibilidade = [];
for (const tipo of ['rw', 'rw_so_recompensa']) for (const alfa of [0.1, 0.3, 0.6]) for (const t of [0.05, 0.15, 0.5]) {
  const r = roda(tipo, alfa, t);
  sensibilidade.push({ tipo, alfa, T: t, transferencia: r2(media(sementes.map(s => r[s].transferencia))), controle: r2(media(sementes.map(s => r[s].controle))) });
}
const out = {
  metodo: `Sem cérebro. Mesmas sementes (${sementes.length}, das séries ${SERIES.join(' e ')}) e mesmas ações visíveis da mosca; treino ${TREINOS} × ${ORC_TREINO} ações com recompensa em bug novo, teste nas versões ${V.teste.map(d => d.join('+')).join(', ')} sem aprendizado, terminando no primeiro bug (31 se não achou). RW: V = soma dos pesos das características da ação, Δw = α(recompensa − V), α ${ALFA0}, softmax T ${T0} (a tabela sensibilidade varia os dois). Diferença pareada mosca treinada − agente (negativo = a mosca achou antes), IC95 bootstrap. Descritivo: sem critério de passar, escrito antes em docs/plano-treino-robusto.md.`,
  caracteristica: CAR, sementes, resumo, pares, sensibilidade,
};
const saida = `docs/medicoes/qa-linha-base${CAR === 'repetida' ? '' : '-' + CAR}.json`;
writeFileSync(saida, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(resumo)); for (const l of sensibilidade) console.log(JSON.stringify(l));
