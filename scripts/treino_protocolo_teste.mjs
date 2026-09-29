// Invariantes do experimento: mesmas exposições, recompensa só no pareamento correto e reversão explícita.
import assert from 'node:assert/strict';
import '../web/treino-protocolo.js';
for(const alvo of ['A','B']) {
  const fases=ProtocoloMemoria.fases({alvo});
  assert.equal(fases.reduce((n,f)=>n+f.duracao,0),96);
  assert.equal(fases.filter(f=>f.tipo==='teste').length,4);
  const pareamentos=fases.filter(f=>f.tipo==='pareamento');
  assert.equal(pareamentos.filter(f=>f.pista==='A').length,6);
  assert.equal(pareamentos.filter(f=>f.pista==='B').length,6);
  for(const f of fases){
    for(const t of [0,1.49,1.5,1.99]){
      const r=ProtocoloMemoria.taxas(f,t);
      assert.equal(!!r.recompensa,f.tipo==='pareamento'&&f.recompensa&&t>=1.5);
      if(f.tipo!=='pareamento')assert.deepEqual(r,{});
      else assert.equal(Object.keys(r).filter(k=>k.startsWith('ORN_')).length,4);
    }
  }
  assert(pareamentos.slice(0,6).every(f=>f.recompensa===(f.pista===alvo)));
  assert(pareamentos.slice(6).every(f=>f.recompensa===(f.pista!==alvo)));
  assert.equal(fases.filter(f=>f.tipo==='teste'&&f.troca).length,1);
}
// retenção: um intervalo sem odor nem recompensa entre o treino e o teste "depois", só quando pedido
{
  const f=ProtocoloMemoria.fases({alvo:'A',retencao:120}), i=f.findIndex(x=>x.nome==='Depois do treino');
  assert.equal(f.reduce((n,x)=>n+x.duracao,0),96+120);
  assert.equal(f[i-1].tipo,'intervalo'); assert.equal(f[i-1].duracao,120); assert.deepEqual(ProtocoloMemoria.taxas(f[i-1],60),{});
  assert.equal(ProtocoloMemoria.fases({alvo:'A'}).some(x=>x.nome.startsWith('Retenção')),false);
}
console.log('Protocolo: duração, exposição, ausência de recompensa no teste, reversão e retenção passaram.');
