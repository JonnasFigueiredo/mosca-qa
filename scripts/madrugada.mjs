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
const ESCADA = [
  { prefixo: 'qa-fortes', args: [], sementes: [11, 12, 13, 14, 15, 16, 17, 18], jaRodando: true, desc: 'cheiros fortes, treino padrão (3 × 60 ações)' },
  { prefixo: 'qa-fortes-curto', args: ['--treinos', '2', '--orcamento-treino', '30'], sementes: [21, 22, 23, 24, 25, 26, 27, 28], desc: 'treino curto (2 × 30 ações): menos tempo para esquecer' },
  { prefixo: 'qa-fortes-espacado', args: ['--treinos', '6', '--orcamento-treino', '20'], sementes: [31, 32, 33, 34, 35, 36, 37, 38], desc: 'treino em 6 episódios de 20 ações: mais episódios, cada um curto' },
];
const REPLICA = [41, 42, 43, 44, 45, 46, 47, 48];
const NCOND = 4;

const linhas = arq => existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')).rodadas.length : 0;
const espera = ms => new Promise(ok => setTimeout(ok, ms));

async function rodaSerie(prefixo, args, sementes, jaRodando) {
  const partes = [0, 1, 2, 3].map(i => ({ arq: `docs/medicoes/${prefixo}-p${i + 1}.json`, sem: sementes.slice(i * 2, i * 2 + 2) }));
  if (!jaRodando) {
    for (const p of partes) {
      if (linhas(p.arq) >= p.sem.length * NCOND) continue;   // já feita (retomada)
      spawn('node', ['scripts/qa_abstrato.mjs', '--sementes', p.sem.join(','), '--cheiros', CHEIROS, '--saida', p.arq, ...args], { stdio: 'ignore', detached: false });
    }
  }
  log(`${prefixo}: esperando ${sementes.length} sementes`);
  // cada processo grava uma linha por condição; termina quando todos têm 2 sementes × 4 condições (limite 10 h)
  const inicio = Date.now();
  while (partes.some(p => linhas(p.arq) < p.sem.length * NCOND)) {
    if (Date.now() - inicio > 10 * 3600e3) { log(`${prefixo}: passou de 10 h, sigo com o que tem`); break; }
    await espera(60e3);
  }
  const out = execSync(`node scripts/qa_resumo.mjs --prefixo ${prefixo}`, { encoding: 'utf8' });
  const r = JSON.parse(out), pc = r.pares.ativa_menos_congelada.primeiro_bug;
  const passou = !!(pc.ic95 && pc.ic95[1] < 0);
  log(`${prefixo}: treinada − congelada ${pc.media} IC95 ${JSON.stringify(pc.ic95)} → ${passou ? 'PASSOU' : 'não passou'}`);
  return { r, pc, passou };
}

function registra(prefixo, desc, { r, pc, passou }) {
  const c = r.por_condicao, v = r.mudanca_de_valencia.ativa;
  const f = n => String(n).replace('.', ',');
  const nota = `\n**${new Date().toISOString().slice(0, 10)}, madrugada: ${prefixo} (${desc}): ${passou ? 'PASSOU' : 'negativo'}.** ` +
    `Sementes ${r.sementes.join(', ')}. Primeiro bug de teste: treinada ${f(c.ativa?.primeiro_bug_media)}, congelada ${f(c.congelada?.primeiro_bug_media)}, ` +
    `aleatória ${f(c.aleatoria?.primeiro_bug_media)}, novidade ${f(c.novidade?.primeiro_bug_media)}. Treinada − congelada ${f(pc.media)}, IC95 ${JSON.stringify(pc.ic95)}. ` +
    `Valência depois do treino (treinada): repetidas ${f(v.repetidas)}, outras ${f(v.outras)}. \`docs/medicoes/${prefixo}-resumo.json\`.\n`;
  appendFileSync('docs/plano-treino-robusto.md', nota);
  try {
    execSync(`git add docs/plano-treino-robusto.md docs/medicoes/${prefixo}-p*.json docs/medicoes/${prefixo}-resumo.json`);
    execSync(`git commit -qm "Madrugada: ${prefixo} ${passou ? 'passou' : 'negativo'}"`);
    execSync('git push -q');
  } catch (e) { log('git: ' + e.message.split('\n')[0]); }
}

log('início');
for (const e of ESCADA) {
  const res = await rodaSerie(e.prefixo, e.args, e.sementes, e.jaRodando);
  registra(e.prefixo, e.desc, res);
  if (res.passou) {
    const rep = await rodaSerie(e.prefixo + '-replica', e.args, REPLICA, false);
    registra(e.prefixo + '-replica', e.desc + ', replicação com sementes novas', rep);
    if (rep.passou) { log('replicou: paro a escada aqui'); break; }
  }
}
log('fim');
