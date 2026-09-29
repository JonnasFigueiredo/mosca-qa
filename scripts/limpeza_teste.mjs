// Prioridades e relógio da limpeza; não é validação biológica.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx = vm.createContext({});
vm.runInContext(readFileSync(new URL('../web/limpeza.js', import.meta.url), 'utf8') + ';globalThis.L=LimpezaMosca', ctx);
const L = ctx.L, seguro = {habilitada: true, apoiada: true, pausa: true};
const passo = (f, o = seguro, dt = .01) => L.passo(f, dt, o, () => .5);
function inicia() {
  const f = {limpeza: {ativa: false, espera: 0, pausa: 0, t: 0}};
  for (let i = 0; i < 15; i++) passo(f);
  assert.ok(f.limpeza.ativa);
  return f;
}
for (const o of [{...seguro, perigo: true}, {...seguro, provando: true}, {...seguro, apoiada: false}]) {
  const f = inicia(); passo(f, o);
  assert.equal(f.limpeza.ativa, false, 'prioridade interrompe no mesmo passo');
  assert.equal(f.limpeza.peso, 0); assert.equal(f.limpeza.evento, 'interrompida');
}
const f = inicia(), etapas = new Set();
for (let i = 0; i < 400; i++) { const e = passo(f); if (e.ativa) etapas.add(e.etapa); }
assert.deepEqual([...etapas], ['cabeca', 'patas', 'antenas']);
assert.equal(f.limpeza.ativa, false, 'a limpeza termina e não se repete imediatamente');
const andando = {limpeza: {ativa: false, espera: 0, pausa: 0, t: 0}};
for (let i = 0; i < 1000; i++) passo(andando, {...seguro, pausa: false});
assert.equal(andando.limpeza.ativa, false, 'não inicia andando');
const pausada = inicia(), t = pausada.limpeza.t;
for (let i = 0; i < 1000; i++) passo(pausada, seguro, 0);
assert.equal(pausada.limpeza.t, t, 'renderizações sem tempo cerebral não avançam a limpeza');
passo(pausada, {...seguro, habilitada: false});
assert.equal(pausada.limpeza, null, 'trocar de modo descarta o estado');
// Com a marcha real, a limpeza pode surgir sem antecipar o intervalo e libera a marcha ao terminar.
vm.runInContext(readFileSync(new URL('../web/corpo-natural.js', import.meta.url), 'utf8') + ';globalThis.C=CorpoNatural', ctx);
const livre = {}, vistos = new Set(); let inicios = 0, finais = 0;
let semente = 28;
const sorteia = () => {semente = (Math.imul(semente,1664525)+1013904223)>>>0;return semente/4294967296;};
for (let i=0;i<12000;i++) {
  const marcha = ctx.C.marcha(livre,.01,false,sorteia);
  const e = L.passo(livre,.01,{...seguro,pausa:livre.marcha==='pausa' && marcha.andar===0},sorteia);
  if (e.evento==='inicio') inicios++;
  if (e.evento==='fim') finais++;
  if (e.ativa) {livre.marcha='limpar';livre.marchaT=.2;}
  vistos.add(livre.marcha);
}
assert.ok(inicios >= 2 && finais >= 2 && vistos.has('andar') && vistos.has('limpar'), 'limpa espontaneamente e volta a andar');
console.log('Limpeza: sequência, prioridades, apoio, pausa, intervalo e relógio cerebral passaram.');
