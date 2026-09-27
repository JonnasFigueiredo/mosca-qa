// Verifica as regras geométricas e as transições do corpo sem carregar outro cérebro.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx=vm.createContext({});
vm.runInContext(readFileSync(new URL('../web/corpo-natural.js',import.meta.url),'utf8')+';globalThis.C=CorpoNatural;',ctx);
const C=ctx.C, f={x:700,y:700,z:0,th:0,prob:100};
const a=C.antenas.map(p=>C.ponto(f,p));
assert.ok(a[0].x<f.x && a[1].x>f.x,'lado das antenas');
assert.ok(a.every(p=>p.y<f.y),'antenas à frente');
assert.ok(Math.abs(Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/7-0.28418)<1e-6);
const r={x:0,y:0,w:100,h:100,z:14};
assert.equal(C.contato({x:50,y:50,z:14},[r]),r);
assert.equal(C.contato({x:50,y:50,z:0},[r]),null,'sem comer por baixo');
assert.equal(C.contato({x:101,y:50,z:14},[r]),null,'sem contato além da borda');
// superfície redonda (meia-cúpula): o contato é com a altura da forma naquele ponto, não com o topo do retângulo
const cupula=(r2,x,y)=>{const u=((x-50)/50)**2+((y-50)/50)**2;return u<=1?70*Math.sqrt(1-u):-Infinity;};
const fr={x:0,y:0,w:100,h:100,z:70,id:'f'};
assert.equal(C.contato({x:50,y:50,z:70},[fr],0.25,cupula),fr,'no topo da cúpula');
assert.equal(C.contato({x:90,y:50,z:42},[fr],0.25,cupula),fr,'na encosta, na altura da forma');
assert.equal(C.contato({x:90,y:50,z:70},[fr],0.25,cupula),null,'no ar, na altura do topo, fora da forma');
assert.equal(C.contato({x:2,y:2,z:0},[fr],0.25,cupula),null,'no canto do retângulo, fora da cúpula');
for(let i=0;i<60;i++) C.boca(f,.01,true);
assert.ok(f.boca>.99);
assert.ok(C.bocaPontos(f).alcanca);
assert.ok(C.bocaPontos(f).ponta.z<.05);
f.flying=true; C.boca(f,.01,true); assert.equal(f.boca,0,'fuga recolhe imediatamente');
const h={x:700,y:700,z:0,th:0,prob:30};
C.boca(h,.01,true); assert.equal(h.bocaQuer,true,'estende acima de 25 Hz');
h.prob=15; C.boca(h,.01,true); assert.equal(h.bocaQuer,true,'mantém entre 12 e 25 Hz');
h.prob=10; C.boca(h,.01,true); assert.equal(h.bocaQuer,false,'recolhe abaixo de 12 Hz');
h.prob=20; C.boca(h,.01,true); assert.equal(h.bocaQuer,false,'recolhida, não estende abaixo de 25 Hz');
f.flying=false; f.prob=0;
let estados=new Set();
for(let i=0;i<2000;i++){C.marcha(f,.01,false,()=>.7);estados.add(f.marcha);}
assert.ok(estados.has('andar') && estados.has('pausa'));
f.marcha='pausa'; f.marchaT=10; f.threat=1;
assert.equal(C.marcha(f,.01,false).andar,1,'ameaça interrompe pausa');
f.threat=0; f.naParede={}; assert.equal(C.marcha(f,.01,true).andar,1,'não parar na parede');
f.naParede=null; assert.equal(C.marcha(f,.01,true).andar,0,'parar para provar');
// busca pelo cheiro (docs/plano-busca-cheiro.md): sem cheiro neutra; subindo acelera e não para; perdendo vira
{
  const B=C.buscaCheiro, fixo=()=>0.7;
  let e={}, r;
  for(let i=0;i<200;i++) r=B(e,.01,0,0,fixo);
  assert.equal(r.modo,'fora','sem cheiro, fora'); assert.equal(r.velocidade,1); assert.equal(r.semPausa,false);
  for(let i=0;i<100;i++) r=B(e,.01,.3+i*.005,.3+i*.005,fixo);
  assert.equal(r.modo,'dentro','cheiro subindo, dentro'); assert.ok(r.velocidade>1); assert.equal(r.semPausa,true); assert.ok(r.ruido<1);
  let giros=0;
  for(let i=0;i<100;i++){ r=B(e,.01,.8-i*.005,.8-i*.005,fixo); if(r.giro) giros++; }
  assert.equal(e.modo,'perdeu','cheiro caindo, perdeu'); assert.ok(giros>=1,'gira ao perder'); assert.ok(r.velocidade<1,'desacelera ao perder');
  e={modo:'perdeu',c:.5,dc:-.5,t:0}; let lado=0;
  for(let i=0;i<10&&!lado;i++){ r=B(e,.01,.55,.45,fixo); if(r.giro) lado=Math.sign(r.giro); }
  assert.equal(lado,-1,'vira para a antena com mais cheiro (esquerda)');
}
console.log('Antenas, contato (plano e redondo), extensão, inércia da boca, pausa, fuga, escalada e busca pelo cheiro: verificações passaram.');
