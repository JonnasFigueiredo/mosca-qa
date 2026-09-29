// Protocolo experimental, em segundos cerebrais. Não é uma sequência inferida do conectoma.
globalThis.ProtocoloMemoria = {
  gerador(semente){let s=semente>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};},
  cheiros:{A:['VA2','DM4'],B:['DP1l','DM2']},
  // retencao: segundos cerebrais sem odor e sem recompensa entre o treino e o teste seguinte (corpo parado), para
  // medir quanto da memória sobra depois do esquecimento do worker (docs/plano-treino-robusto.md, T2)
  fases({segundos=15,repeticoes=3,alvo='A',retencao=0}={}) {
    const fases=[],outro=alvo==='A'?'B':'A';
    const prova=(nome,troca=false)=>fases.push({nome,tipo:'teste',duracao:segundos,troca});
    const treino=(nome,recompensado)=>{
      for(let i=0;i<repeticoes;i++)for(const pista of (i%2?['B','A']:['A','B'])) {
        fases.push({nome:`${nome} ${i+1}/${repeticoes} · ${pista}`,tipo:'pareamento',pista,
          recompensa:pista===recompensado,duracao:2,troca:false});
        fases.push({nome:'Intervalo sem odor',tipo:'intervalo',duracao:1,troca:false});
      }
    };
    prova('Antes do treino');treino('Treino',alvo);
    if(retencao>0)fases.push({nome:`Retenção: ${retencao} s sem odor`,tipo:'intervalo',duracao:retencao,troca:false});
    prova('Depois do treino');
    prova('Teste com lados trocados',true);treino('Reversão',outro);prova('Depois da reversão');
    return fases;
  },
  taxas(fase,t,{odorHz=100,recompensaHz=100}={}) {
    const r={};
    if(fase.tipo==='pareamento') {
      for(const g of this.cheiros[fase.pista])for(const lado of ['L','R'])r['ORN_'+g+'_'+lado]=odorHz;
      // Estimulação direta de PAM; o corpo não recebe alimento/punição nesta sonda isolada.
      if(fase.recompensa&&t>=1.5)r.recompensa=recompensaHz;
    }
    return r;
  },
};
