// Verifica os limites do servo visual com omatídeos sintéticos, sem carregar outro cérebro.
// Uso: node scripts/visao_voo_teste.mjs [antes|depois]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const fonte = readFileSync(new URL('../web/sandbox.js', import.meta.url), 'utf8');
const codigo = fonte.slice(fonte.indexOf('function sbAlvoVisual(f)'), fonte.indexOf('function sbFly(f, dt)'));
if (!codigo) throw new Error('função visual não encontrada');
const casos = [
  { nome: 'frente', direcoes: [[0, 0]], valores: [1], esperado_graus: 0 },
  { nome: 'brilho acima de 15 graus não entra na média', direcoes: [[0, 0], [10, 16]], valores: [0.1, 1], esperado_graus: 0 },
  { nome: 'brilho lateral além de 80 graus não entra na média', direcoes: [[79, 0], [90, 0]], valores: [0.1, 1], esperado_graus: -79 },
  { nome: 'brilho abaixo de menos 60 graus não entra na média', direcoes: [[0, -59], [10, -65]], valores: [0.1, 1], esperado_graus: 0 },
  { nome: 'sem mancha nos olhos reais não consulta objetos da aproximação', direcoes: [[0, 0]], valores: [0], esperado_graus: null },
];
const resultados = casos.map(c => {
  const OLHO = { mapa: { direcao: [c.direcoes, []] }, obj: [c.valores, []] };
  const f = { olhoReal: { t: 1000 }, seen: [[{ id: 'objeto-que-nao-deve-ser-lido' }, 1, 1, 1, 100]] };
  const alvo = runInNewContext(codigo + '\nsbAlvoVisual(f)', { OLHO, f, performance: { now: () => 1000 } });
  const observado = alvo ? alvo.a * 180 / Math.PI : null;
  return { ...c, observado_graus: observado, passou: c.esperado_graus === null ? observado === null : observado !== null && Math.abs(observado - c.esperado_graus) < 1e-9 };
});
const arq = new URL('../docs/medicoes/voo-limites-visuais.json', import.meta.url);
const dados = existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8')) : {
  metodo: 'Função sbAlvoVisual do sandbox avaliada isoladamente com intensidades e direções sintéticas de omatídeos. Verifica aplicação dos limites angulares também à média da mancha. Não testa a rede, a frequência de voo nem o sucesso de pouso.', medidas: [] };
dados.medidas.push({ fase: process.argv[2] || 'verificacao', data: new Date().toISOString(), resultados });
writeFileSync(arq, JSON.stringify(dados, null, 2) + '\n');
console.log(JSON.stringify(resultados, null, 2));
if (resultados.some(r => !r.passou)) process.exitCode = 1;
