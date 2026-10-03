// Rotina automática da caça a bugs no mundo da mosca (web/caca-mundo.js), escrita antes de rodar (03/10;
// docs/plano-treino-robusto.md, "Série no mundo da mosca"). Nada é escolhido olhando o resultado do teste:
//  1. calibração do mundo (só treino, condição ativa): escada d1 → d2 (antes: m0, c1, c2; ver o plano); fica o primeiro degrau em que ela acha o
//     bug em pelo menos 60% das versões de treino (sem recompensa no treino não há o que transferir);
//  2. piloto (4 sementes, treinada e congelada): só estima a variação para escolher o número de sementes;
//  3. série confirmatória: treinada − congelada na fração das provas do teste na característica premiada, IC95 > 0
//     (até 03/10, 19h30: o tempo até o primeiro bug; trocado depois do piloto, antes da série; ver o plano);
//  4. se passar, replicação com sementes novas; se não, uma alternativa escrita antes (treino com 9 versões), com a
//     própria replicação.
// Cada etapa anota no plano, grava em docs/medicoes e commita (autor: o dono do repositório).
//   node scripts/madrugada_mundo.mjs [--paralelos 3] [--desde confirmatoria]
import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync, writeFileSync, cpSync } from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PARALELOS = +arg('paralelos', 3);
// a rotina mede uma cópia congelada de web/ (_tmp/_web_mundo, servida na porta 8767): mudanças na página durante a
// série não entram na medida. A cópia é feita uma vez, no início (ou reaproveitada ao retomar)
const PORTA = '8767', COPIA = '_tmp/_web_mundo';
if (!existsSync(COPIA)) { cpSync('web', COPIA, { recursive: true }); }
let servidor = null;
async function garanteServidor() {
  try { if ((await fetch(`http://localhost:${PORTA}/index.html`)).ok) return; } catch { /* sobe abaixo */ }
  servidor = spawn('python', ['scripts/servir.py', PORTA, COPIA], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 1000)); try { if ((await fetch(`http://localhost:${PORTA}/index.html`)).ok) return; } catch { /* esperando */ } }
  throw new Error('o servidor da cópia congelada não subiu');
}
const LOG = '_tmp/_madrugada_mundo.log', ESTADO = '_tmp/_madrugada_mundo.json';
const log = m => { const l = new Date().toLocaleString('pt-BR') + ' ' + m; console.log(l); appendFileSync(LOG, l + '\n'); };
const seq = (a, n) => Array.from({ length: n }, (_, i) => a + i);
const f = n => String(n).replace('.', ',');
// estado salvo entre reinícios (etapa concluída, degrau escolhido, N)
const est = existsSync(ESTADO) ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {};
const salva = () => writeFileSync(ESTADO, JSON.stringify(est, null, 1));

// a escada do mundo, escrita antes
const ESCADA = [
  // Histórico (ver as notas no plano): m0 interrompido; c1 (bandeja, subida, 841–843) e c2 (plaquinhas de 13 mm,
  // alcance 20 mm, 881–883) não passaram: ela nunca chegava às plataformas das famílias do treino (pagamento,
  // cancelamento), do lado oposto ao início. (03/10, 14h50) escada nova, escrita antes de rodar: as plataformas em
  // círculo em volta do início, todas a 38 mm, trocando de lugar por sorteio a cada versão. (15h10) d1 refeito com
  // sementes novas: ela volta ao centro a cada versão (a d1 de 931–933 foi descartada, ver o plano)
  { id: 'd1', extra: '&placa=13&alcance=20', desc: 'plataformas em círculo com lugares sorteados a cada versão, plaquinhas de 13 mm, alcance de 20 mm, 240 s por versão de treino', sementes: seq(971, 3) },
  { id: 'd2', extra: '&placa=13&alcance=20&limtreino=420', desc: 'como d1, com 420 s por versão de treino', sementes: seq(981, 3) },
];
const LIMIAR_CALIB = 0.6, MINIMO_CALIB = 0.4;

function roda(saida, sementes, condicoes, extra, outros = []) {
  return new Promise(ok => {
    const args = ['scripts/qa_mundo.mjs', '--sementes', sementes.join(','), '--condicoes', condicoes, '--paralelos', String(PARALELOS),
      '--timeout-min', '150', '--porta', PORTA, '--saida', saida, ...(extra ? ['--extra', extra] : []), ...outros];
    log('roda: node ' + args.join(' '));
    const p = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', d => appendFileSync(LOG, d));
    p.stderr.on('data', d => appendFileSync(LOG, d));
    p.on('exit', ok);
  });
}
// sessões com erro (Chrome que não abriu, tempo limite) são refeitas uma vez (o runner pula as que já deram certo)
async function rodaCompleto(saida, sementes, condicoes, extra, outros) {
  await garanteServidor();
  for (let t = 0; t < 2; t++) await roda(saida, sementes, condicoes, extra, outros);
}
const resumo = (prefixo, calib = false) => JSON.parse(execSync(`node scripts/qa_mundo_resumo.mjs --prefixo ${prefixo}${calib ? ' --calibracao' : ''}`, { encoding: 'utf8', maxBuffer: 1 << 24 }));
function anota(texto, arquivos, msg) {
  appendFileSync('docs/plano-treino-robusto.md', '\n' + texto + '\n');
  try {
    execSync(`git add docs/plano-treino-robusto.md ${arquivos.join(' ')}`);
    execSync(`git commit -qm "${msg}"`);
    execSync('git push -q');
  } catch (e) { log('git: ' + e.message.split('\n')[0]); }
}
const dia = () => new Date().toLocaleDateString('pt-BR').slice(0, 5);

if (!existsSync(COPIA + '/VERSAO.txt')) try { execSync('git rev-parse --short HEAD > ' + COPIA + '/VERSAO.txt'); } catch { /* sem git */ }
log('início da rotina do mundo' + (est.etapa ? ` (retomando depois de "${est.etapa}")` : ''));

// 1. calibração
if (!est.degrau) {
  let melhor = null;
  for (const d of ESCADA) {
    const prefixo = `qa-mundo-calib-${d.id}`;
    await rodaCompleto(`docs/medicoes/${prefixo}.json`, d.sementes, 'ativa', d.extra, ['--so', 'treino', '--treinos', '3']);
    const r = resumo(prefixo, true);
    const passou = r.fracao_achou != null && r.fracao_achou >= LIMIAR_CALIB;
    log(`${prefixo}: achou o bug em ${r.fracao_achou} das versões de treino (mediana ${r.mediana_tempo_bug} s) → ${passou ? 'PASSOU' : 'não passou'}`);
    anota(`**${dia()}, rotina do mundo, calibração ${d.id} (${d.desc}): ${passou ? 'passou' : 'não passou'}.** Só o treino, condição ativa, ` +
      `3 versões por sessão, sementes ${d.sementes.join(', ')}. Achou o bug em ${f(r.fracao_achou)} das ${r.versoes} versões (critério: ≥ ${f(LIMIAR_CALIB)}); ` +
      `mediana do tempo até o bug ${f(r.mediana_tempo_bug)} s de cérebro; ${f(r.provas_por_versao)} provas por versão. Por sessão: ` +
      r.por_sessao.map(s => `${s.semente} ${s.achou}`).join(', ') + `. \`docs/medicoes/${prefixo}.json\`.`,
      [`docs/medicoes/${prefixo}.json`, `docs/medicoes/${prefixo}-resumo.json`], `Rotina do mundo: calibração ${d.id} ${passou ? 'passou' : 'não passou'}`);
    if (!melhor || (r.fracao_achou ?? 0) > melhor.fracao) melhor = { ...d, fracao: r.fracao_achou ?? 0 };
    if (passou) { est.degrau = d.id; break; }
  }
  if (!est.degrau) {
    if (melhor.fracao < MINIMO_CALIB) {
      log(`nenhum degrau chegou a ${MINIMO_CALIB}: paro (o mundo não dá recompensa suficiente no treino)`);
      anota(`**${dia()}, rotina do mundo: parou na calibração.** Nenhum degrau da escada chegou a ${f(MINIMO_CALIB)} das versões de treino com bug ` +
        `(melhor: ${melhor.id}, ${f(melhor.fracao)}). Sem recompensa no treino, a série não mediria aprendizado: negativo do mundo, não do cérebro.`, [], 'Rotina do mundo: parou na calibração');
      process.exit(0);
    }
    est.degrau = melhor.id;
    log(`nenhum degrau passou de ${LIMIAR_CALIB}; sigo com o melhor (${melhor.id}, ${melhor.fracao}), como escrito antes`);
  }
  est.etapa = 'calibracao'; salva();
}
const D = ESCADA.find(d => d.id === est.degrau);

// 2. piloto
if (!est.N) {
  const prefixo = `qa-mundo-piloto-${D.id}`;
  await rodaCompleto(`docs/medicoes/${prefixo}.json`, seq(831, 4), 'ativa,congelada', D.extra, ['--treinos', '6']);
  const r = resumo(prefixo), x = r.ativa_menos_congelada.tempo_transferencia || {};
  const dp = x.por_semente?.length > 1 ? Math.sqrt(x.por_semente.reduce((t, v) => t + (v - x.media) ** 2, 0) / (x.por_semente.length - 1)) : null;
  const dz = dp ? x.media / dp : null;
  // N para 80% de poder (bilateral 5%): (1,96 + 0,84)² / dz² + 2, entre 12 e 20; sem efeito na direção esperada, 20
  est.N = dz != null && dz < -0.2 ? Math.min(20, Math.max(12, Math.ceil(7.85 / (dz * dz)) + 2)) : 20;
  log(`${prefixo}: treinada − congelada no tempo de transferência ${x.media} s (dz ${dz?.toFixed(2)}) → N = ${est.N}`);
  anota(`**${dia()}, rotina do mundo, piloto (${D.id}; exploratório, não conta como resultado).** Sementes 831–834, treinada e congelada, ` +
    `6 versões de treino. Tempo até o primeiro bug na transferência, treinada − congelada: ${f(x.media)} s (por semente ${JSON.stringify(x.por_semente)}; dz ${dz != null ? f(dz.toFixed(2)) : '—'}). ` +
    `Bugs no treino por sessão: treinada ${f(r.por_condicao.ativa?.bugs_treino)}, congelada ${f(r.por_condicao.congelada?.bugs_treino)}. N da série confirmatória pela regra escrita antes: ${est.N}.`,
    [`docs/medicoes/${prefixo}.json`, `docs/medicoes/${prefixo}-resumo.json`], `Rotina do mundo: piloto ${D.id}`);
  est.etapa = 'piloto'; salva();
}

// 3 e 4. confirmatória e replicação (e a alternativa escrita antes, se a principal não passar)
const SERIES = [
  { prefixo: `qa-mundo-${D.id}`, treinos: '6', sementes: seq(901, est.N), replica: seq(951, est.N), desc: `mundo ${D.id} (${D.desc}), 6 versões de treino` },
  { prefixo: `qa-mundo-${D.id}-t9`, treinos: '9', sementes: seq(1001, est.N), replica: seq(1051, est.N), desc: `mundo ${D.id}, 9 versões de treino (alternativa escrita antes)` },
];
est.feitas ||= {};
function criterio(r) {
  // (03/10, 19h30, antes de qualquer sessão da série confirmatória) principal trocado depois do piloto: o tempo até o
  // primeiro bug ficou no teto (180 s sem achar na maioria das versões de teste, nas duas condições) e quase não varia;
  // a fração das provas do teste em plaquinhas da característica premiada mede direto se a memória guia as escolhas.
  // O tempo segue relatado como secundário. Ver a nota no plano
  const p = r.ativa_menos_congelada, fp = p.fracao_premiada || {};
  const passou = !!(fp.ic95 && fp.ic95[0] > 0);
  const txt = (n, x) => `${n} ${f(x?.media)} IC95 ${JSON.stringify(x?.ic95)} p ${x?.p_bootstrap} dz ${x?.dz}`;
  return { passou, texto: `${txt('fração das provas do teste na característica premiada, treinada − congelada (principal, IC95 > 0):', fp)}; ` +
    `${txt('tempo até o 1º bug na transferência (secundário, deve ser < 0):', p.tempo_transferencia)}; ` +
    `${txt('provas até o 1º bug na transferência:', p.transferencia)}; ${txt('controle (não deve melhorar), tempo:', p.tempo_controle)}; ` +
    `bugs no treino, treinada ${f(r.por_condicao.ativa?.bugs_treino)} e congelada ${f(r.por_condicao.congelada?.bugs_treino)}` };
}
async function serie(prefixo, sementes, treinos, desc) {
  if (est.feitas[prefixo]) return est.feitas[prefixo];
  await rodaCompleto(`docs/medicoes/${prefixo}.json`, sementes, 'ativa,congelada', D.extra, ['--treinos', treinos]);
  const r = resumo(prefixo), c = criterio(r);
  log(`${prefixo}: ${c.texto} → ${c.passou ? 'PASSOU' : 'não passou'}`);
  anota(`**${dia()}, rotina do mundo: ${prefixo} (${desc}): ${c.passou ? 'PASSOU' : 'negativo'}.** Sementes ${sementes[0]}–${sementes.at(-1)} ` +
    `(${r.sessoes_validas} sessões válidas). ${c.texto}. Resumo: \`docs/medicoes/${prefixo}-resumo.json\`.`,
    [`docs/medicoes/${prefixo}.json`, `docs/medicoes/${prefixo}-resumo.json`], `Rotina do mundo: ${prefixo} ${c.passou ? 'passou' : 'negativo'}`);
  est.feitas[prefixo] = { passou: c.passou }; salva();
  return est.feitas[prefixo];
}
for (const s of SERIES) {
  const r = await serie(s.prefixo, s.sementes, s.treinos, s.desc);
  if (!r.passou) continue;
  const rep = await serie(s.prefixo + '-replica', s.replica, s.treinos, s.desc + ', replicação com sementes novas');
  log(rep.passou ? 'replicou: fim da escada' : 'não replicou: fim da escada (registrado)');
  break;
}
est.etapa = 'fim'; salva();
log('fim da rotina do mundo');
servidor?.kill();
