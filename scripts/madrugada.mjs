// Rotina da madrugada para a caça a bugs só com o cérebro (docs/plano-treino-robusto.md). Roda uma escada de
// variantes ESCRITA ANTES (nada é escolhido olhando o resultado do teste), cada uma com 8 sementes em 4 processos,
// resume com o critério de sempre (treinada − congelada no primeiro bug de teste, IC95 < 0), anota no plano e
// commita as medições. Se uma variante passar, repete com 8 sementes NOVAS (replicação) antes de contar como achado.
// Todas as variantes testadas ficam registradas, inclusive as negativas (várias comparações: ver a nota no plano).
//
//   node scripts/madrugada.mjs            (espera a série qa-fortes em andamento terminar, depois segue a escada)
import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';

const CHEIROS = 'docs/medicoes/qa-cheiros-fortes.json';
const LOG = '_tmp/_madrugada.log';
const log = m => { const l = new Date().toISOString().slice(11, 19) + ' ' + m; console.log(l); appendFileSync(LOG, l + '\n'); };
// escada escrita antes: a série em andamento e duas variantes contra o esquecimento (τ 90 s; o treino padrão dura ~10 min)
let ESCADA = [
  { prefixo: 'qa-fortes', args: [], sementes: [11, 12, 13, 14, 15, 16, 17, 18], jaRodando: true, desc: 'cheiros fortes, treino padrão (3 × 60 ações)' },
  { prefixo: 'qa-fortes-curto', args: ['--treinos', '2', '--orcamento-treino', '30'], sementes: [21, 22, 23, 24, 25, 26, 27, 28], desc: 'treino curto (2 × 30 ações): menos tempo para esquecer' },
  { prefixo: 'qa-fortes-espacado', args: ['--treinos', '6', '--orcamento-treino', '20'], sementes: [31, 32, 33, 34, 35, 36, 37, 38], desc: 'treino em 6 episódios de 20 ações: mais episódios, cada um curto' },
];
let REPLICA = [41, 42, 43, 44, 45, 46, 47, 48];
// --plano b2: bancada 2 (01/10), escrita antes: uma série principal de 16 sementes, replicação com 16 novas
const SEGUINTES = process.argv.includes('seguintes');
const VALIDADE = process.argv.includes('validade');
const B2 = process.argv.includes('b2') || SEGUINTES || VALIDADE;
const seq = (a, n = 16) => Array.from({ length: n }, (_, i) => a + i);
const B2ARGS = ['--bancada', '2', '--treinos', '6', '--orcamento-treino', '20'];
if (B2) {
  ESCADA.length = 0;
  ESCADA.push({ prefixo: 'qa-b2', args: ['--bancada', '2', '--treinos', '6', '--orcamento-treino', '20'], sementes: Array.from({ length: 16 }, (_, i) => 51 + i), desc: 'bancada 2, treino espaçado 6 × 20, teste sem recompensa' });
  REPLICA = Array.from({ length: 16 }, (_, i) => 71 + i);
}
// --plano seguintes (escrito em 01/10, antes do resultado da bancada 2): espera a rotina b2 terminar e segue um ramo
// conforme ela tenha passado E replicado ou não. Cada degrau com sementes novas e replicação própria.
if (SEGUINTES) {
  ESCADA.length = 0;
  ESCADA.ramos = {
    replicou: [
      { prefixo: 'qa-b2-cheiro-trocado', args: B2ARGS, cheiros: 'docs/medicoes/qa-cheiros-trocados.json', sementes: seq(91), replica: seq(131), desc: 'controle sensorial: "repetida" com os glomérulos de "normal" e vice-versa (o aprendizado não depende de um cheiro específico)' },
      { prefixo: 'qa-b2-retencao', args: [...B2ARGS, '--retencao-teste', '180'], sementes: seq(111), replica: seq(151), desc: 'retenção: 180 s cheirando outras ações entre o treino e o teste' },
    ],
    falhou: [
      { prefixo: 'qa-b2-treino-longo', args: ['--bancada', '2', '--treinos', '12', '--orcamento-treino', '20'], sementes: seq(91), replica: seq(131), desc: 'treino mais longo: 12 × 20 ações' },
      { prefixo: 'qa-b2-vis5', args: [...B2ARGS, '--visiveis', '5'], sementes: seq(111), replica: seq(151), desc: '5 ações visíveis por passo (a memória tem mais chance de escolher)' },
    ],
  };
}
// --plano validade (escrito em 01/10, antes de rodar; docs/plano-treino-robusto.md, "Fila de validade"): espera a
// fila "seguintes" terminar e roda o contrabalanço (característica "normal" premiada) e a decepção no teste. Critérios
// próprios por degrau; replicação com sementes novas quando o principal passa.
const abaixo = x => !!(x?.ic95 && x.ic95[1] < 0), acima = x => !!(x?.ic95 && x.ic95[0] > 0);
const txt = (nome, x) => `${nome} ${x?.media} IC95 ${JSON.stringify(x?.ic95)}`;
if (VALIDADE) {
  ESCADA.length = 0;
  ESCADA.push(
    { prefixo: 'qa-b2-normal', args: [...B2ARGS, '--caracteristica', 'normal'], sementes: seq(211), replica: seq(231),
      desc: 'contrabalanço: defeitos nas ações "normal" (nascem com valência negativa), mesma estrutura de treino e teste',
      depois: ['node scripts/qa_linha_base.mjs --caracteristica normal'], saidasDepois: ['docs/medicoes/qa-linha-base-normal.json'] },
    { prefixo: 'qa-b2-decepcao', args: [...B2ARGS, '--condicoes', 'ativa,ativa_decepcao,congelada,aleatoria,novidade'], ncond: 5, sementes: seq(251), replica: seq(271),
      desc: 'decepção no teste: PPL1 quando escolhe com valência > 0,6 e não acha bug novo',
      criterio: r => {
        const ctrl = r.pares.ativa_menos_ativa_decepcao?.controle, tr = r.pares.ativa_decepcao_menos_congelada?.transferencia;
        // principal: a decepção reduz o custo no controle (treinada sem − com decepção > 0); secundário: com decepção,
        // continua transferindo (com decepção − congelada < 0)
        return { passou: acima(ctrl), pc: ctrl, texto: `${txt('controle, treinada sem − com decepção (principal, deve ser > 0):', ctrl)}; ${txt('transferência, com decepção − congelada (secundário, deve ser < 0; ' + (abaixo(tr) ? 'passou' : 'não passou') + '):', tr)}` };
      } },
  );
}
const NCOND = 4;

const linhas = arq => existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')).rodadas.length : 0;
const espera = ms => new Promise(ok => setTimeout(ok, ms));

async function rodaSerie(prefixo, args, sementes, jaRodando, cheiros = CHEIROS, ncond = NCOND, criterio = null) {
  const por = Math.ceil(sementes.length / 4);
  const partes = [0, 1, 2, 3].map(i => ({ arq: `docs/medicoes/${prefixo}-p${i + 1}.json`, sem: sementes.slice(i * por, i * por + por) }));
  if (!jaRodando) {
    for (const p of partes) {
      if (linhas(p.arq) >= p.sem.length * ncond) continue;   // já feita (retomada)
      spawn('node', ['scripts/qa_abstrato.mjs', '--sementes', p.sem.join(','), '--cheiros', cheiros, '--saida', p.arq, ...args], { stdio: 'ignore', detached: false });
    }
  }
  log(`${prefixo}: esperando ${sementes.length} sementes`);
  // cada processo grava uma linha por condição; termina quando todos têm 2 sementes × 4 condições (limite 10 h)
  const inicio = Date.now();
  while (partes.some(p => linhas(p.arq) < p.sem.length * ncond)) {
    if (Date.now() - inicio > 14 * 3600e3) { log(`${prefixo}: passou de 10 h, sigo com o que tem`); break; }
    await espera(60e3);
  }
  const out = execSync(`node scripts/qa_resumo.mjs --prefixo ${prefixo}`, { encoding: 'utf8' });
  const r = JSON.parse(out);
  if (criterio) { const c = criterio(r); log(`${prefixo}: ${c.texto} → ${c.passou ? 'PASSOU' : 'não passou'}`); return { r, ...c }; }
  const pc = B2 ? r.pares.ativa_menos_congelada.transferencia : r.pares.ativa_menos_congelada.primeiro_bug;
  const passou = !!(pc.ic95 && pc.ic95[1] < 0);
  log(`${prefixo}: treinada − congelada ${pc.media} IC95 ${JSON.stringify(pc.ic95)} → ${passou ? 'PASSOU' : 'não passou'}`);
  return { r, pc, passou };
}

function registra(prefixo, desc, { r, pc, passou, texto }, extras = []) {
  const c = r.por_condicao, v = r.mudanca_de_valencia.ativa;
  const f = n => String(n).replace('.', ',');
  const nota = `\n**${new Date().toISOString().slice(0, 10)}, madrugada: ${prefixo} (${desc}): ${passou ? 'PASSOU' : 'negativo'}.** ` +
    `Sementes ${r.sementes.join(', ')}. Primeiro bug de teste: treinada ${f(c.ativa?.primeiro_bug_media)}, congelada ${f(c.congelada?.primeiro_bug_media)}, ` +
    `aleatória ${f(c.aleatoria?.primeiro_bug_media)}, novidade ${f(c.novidade?.primeiro_bug_media)}. Treinada − congelada ${f(pc.media)}, IC95 ${JSON.stringify(pc.ic95)}. ` +
    (B2 ? `Transferência: treinada ${f(c.ativa?.transferencia_media)}, congelada ${f(c.congelada?.transferencia_media)}, aleatória ${f(c.aleatoria?.transferencia_media)}, novidade ${f(c.novidade?.transferencia_media)}; controle (não deve melhorar): treinada − congelada ${f(r.pares.ativa_menos_congelada.controle.media)} ${JSON.stringify(r.pares.ativa_menos_congelada.controle.ic95)}. ` : '') +
    (texto ? `Critério: ${texto}. ` : '') +
    (c.ativa_decepcao ? `Com decepção: transferência ${f(c.ativa_decepcao.transferencia_media)}, controle ${f(c.ativa_decepcao.controle_media)}, decepções por sessão ${f(c.ativa_decepcao.decepcoes_teste_media)}. ` : '') +
    (r.escolhas_teste ? `Fração das vezes em que escolheu uma ação da característica premiada (${r.caracteristica_premiada ?? 'repetida'}) visível no teste: ${JSON.stringify(r.escolhas_teste)}. ` : '') +
    `Valência depois do treino (treinada): premiadas ${f(v.premiadas ?? v.repetidas)}, outras ${f(v.outras)}. \`docs/medicoes/${prefixo}-resumo.json\`.\n`;
  appendFileSync('docs/plano-treino-robusto.md', nota);
  try {
    // correção de Holm para todas as séries rodadas até agora (qa_comparacoes.mjs) e as saídas dos passos extras
    try { execSync('node scripts/qa_comparacoes.mjs'); } catch (e) { log('comparações: ' + e.message.split('\n')[0]); }
    execSync(`git add docs/plano-treino-robusto.md docs/medicoes/${prefixo}-p*.json docs/medicoes/${prefixo}-resumo.json docs/medicoes/qa-comparacoes.json ${extras.join(' ')}`);
    execSync(`git commit -qm "Madrugada: ${prefixo} ${passou ? 'passou' : 'negativo'}"`);
    execSync('git push -q');
  } catch (e) { log('git: ' + e.message.split('\n')[0]); }
}

log('início' + (SEGUINTES ? ' (seguintes)' : VALIDADE ? ' (validade)' : ''));
if (VALIDADE) {
  // espera a fila "seguintes" terminar: "fim" depois da escolha do ramo
  for (;;) { const t = readFileSync(LOG, 'utf8'); const i = t.lastIndexOf('sigo o ramo escrito antes'); if (i >= 0 && /\d fim\s*$/.test(t.slice(i))) break; await espera(120e3); }
  log('fila seguintes terminou: começo a de validade');
}
if (SEGUINTES) {
  // espera a rotina b2 terminar: o log tem "fim" depois do início dela
  for (;;) { const t = readFileSync(LOG, 'utf8'); const i = t.lastIndexOf('qa-b2: esperando'); if (i >= 0 && /\d fim\s*$/.test(t.slice(i))) break; await espera(120e3); }
  const le = p => existsSync(`docs/medicoes/${p}-resumo.json`) ? JSON.parse(readFileSync(`docs/medicoes/${p}-resumo.json`, 'utf8')).pares.ativa_menos_congelada.transferencia : null;
  const ok = x => !!(x?.ic95 && x.ic95[1] < 0);
  const ramo = ok(le('qa-b2')) && ok(le('qa-b2-replica')) ? 'replicou' : 'falhou';
  log('bancada 2 ' + ramo + ': sigo o ramo escrito antes');
  ESCADA.push(...ESCADA.ramos[ramo]);
}
for (const e of ESCADA) {
  if (e.replica) REPLICA = e.replica;
  const depois = () => { for (const cmd of e.depois || []) try { execSync(cmd); } catch (x) { log('depois: ' + x.message.split('\n')[0]); } };
  const res = await rodaSerie(e.prefixo, e.args, e.sementes, e.jaRodando, e.cheiros, e.ncond, e.criterio);
  depois(); registra(e.prefixo, e.desc, res, e.saidasDepois);
  if (res.passou) {
    const rep = await rodaSerie(e.prefixo + '-replica', e.args, REPLICA, false, e.cheiros, e.ncond, e.criterio);
    depois(); registra(e.prefixo + '-replica', e.desc + ', replicação com sementes novas', rep, e.saidasDepois);
    if (rep.passou && !SEGUINTES && !VALIDADE) { log('replicou: paro a escada aqui'); break; }
  }
}
log('fim');
