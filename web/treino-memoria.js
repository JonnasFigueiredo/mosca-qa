// Primeira etapa do treinamento para QA: associação olfativa, escolha, troca de lados e reversão.
// O protocolo e a arena são projetados; o aprendizado ocorre nas sinapses do worker real.
(() => {
  const objetos=Object.fromEntries(['A','B'].map((p,i)=>['t-'+p,{r:'Pista '+p,x:i?111:89,y:100,w:12,d:12,h:0,
    forma:'pista',gosto:null,porcoes:0,alcance:15,cheiro:Object.fromEntries(ProtocoloMemoria.cheiros[p].map(g=>[g,1]))}]));
  APPS.treino={...APPS.cozinha,id:'treino',nome:'Treinamento da memória',url:'treino.exemplo',objetos,
    elementos:Object.fromEntries(Object.entries(objetos).map(([id,o])=>[id,{r:o.r,notas:[],acao:()=>{}}]))};
  for(const [id,o] of Object.entries(objetos)){ODORS[id]=Object.keys(o.cheiro);ODOR_PESO[id]=o.cheiro;}
  const botao=document.createElement('button');botao.textContent='Treinamento';botao.dataset.app='treino';
  botao.onclick=()=>{if(!LAB.busy){switchApp('treino');sbSet(true);Treino.mostrar();}};$('#appTabs').append(botao);
  const painel=document.createElement('div');painel.id='treinoPainel';painel.hidden=true;
  painel.style.cssText='padding:14px;border:1px solid #48745b;border-radius:8px;margin:10px 0;font-size:13px';
  painel.innerHTML=`<strong>Treinamento da memória · preparação para Pedidos</strong>
    <p>Duas pistas de mesma aparência. Antes do treino → pareamento → teste → lados trocados → reversão → teste final.
    O teste não entrega recompensa. Uma sessão isolada não comprova melhora na caça a bugs.</p>
    <div class="app-tabs" style="flex-wrap:wrap;gap:8px">
      <label>Condição <select id="treinoCond"><option value="ativa">Com aprendizado</option><option value="controle">Controle sem aprendizado</option></select></label>
      <label>Primeira pista recompensada <select id="treinoAlvo"><option>A</option><option>B</option></select></label>
      <label>Teste <select id="treinoDur"><option value="15">15 s</option><option value="30">30 s</option><option value="60">60 s</option></select></label>
      <button id="treinoIniciar">Iniciar do zero</button><button id="treinoContinuar">Treinar memória guardada</button>
      <button id="treinoSair" disabled>Encerrar treino</button>
      <button id="treinoGuardar" disabled>Guardar memória do treino</button><button id="treinoExportar" disabled>Exportar resultados</button>
    </div><p id="treinoStatus" role="status">Pronto. O início guarda temporariamente sua memória anterior.</p>
    <progress id="treinoProgresso" max="1" value="0" style="width:100%"></progress>
    <div id="treinoResultados"></div>
    <p>Várias sessões automáticas: execute <b>iniciar-experimentos.cmd</b> na pasta do projeto e abra
    <a href="http://127.0.0.1:8770" target="_blank" rel="noopener">o painel de campanhas</a>.
    Ele mantém a fila, salva resultados e compara condições com sementes pareadas.</p>
    <small>Relógio cerebral; corpo cinemático no chão, área limitada e posição reiniciada entre fases.
    Pareamento com posição fixa e estimulação direta de odor/PAM. Preferência inata por frutas desligada;
    ponte entre memória e movimento continua sendo regra. A/B podem ter respostas neurais diferentes.
    A memória deste treino é guardada separadamente; ao sair, a memória anterior é restaurada.</small>`;
  $('#worldBox').after(painel);
})();
window.Treino={
  ativa:false,sessao:false,indice:0,t:0,total:0,resultados:[],historico:[],pendente:null,
  chave:'mosca-treino-memoria-v1',
  mostrar(){
    $('#treinoPainel').hidden=APP.id!=='treino';
    document.body.classList.toggle('treinamento',APP.id==='treino');
  },
  mensagem(s){$('#treinoStatus').textContent=s;},
  memoria(){
    return new Promise((resolve,reject)=>{
      if(this.pendente)return reject(Error('Aguarde a leitura da memória'));
      const timer=setTimeout(()=>{this.pendente=null;reject(Error('O cérebro não devolveu a memória'));},10000);
      this.pendente=m=>{clearTimeout(timer);this.pendente=null;resolve(m);};
      worker.postMessage({type:'getMemory'});
    });
  },
  receber(m){
    if(m.type==='tick'&&this.manual&&!m._treinoManual){
      const b=this.blocoAguardado;
      if(!b||m.passoDuplo!==b.id)return true;
      this.blocoAguardado=null;clearTimeout(b.timer);
      try{worker.onmessage({data:{...m,passoDuplo:undefined,_treinoManual:true}});b.resolve(true);}
      catch(e){b.reject(e);}
      return true;
    }
    if(m.type==='memoryDump'){
      if(this.pendente){this.pendente(m.memory);return true;}
      if(this.sessao)return true; // nunca sobrescrever a memória normal por salvamento atrasado
    }
    if(m.type==='memoryLoaded'&&this.restaurando){
      this.restaurando=false;memory=m.strength||0;renderMemory();
      if(!m.ok){this.mensagem('Memória incompatível com este mapa.');if(this.sessao)this.sair();}
      return true;
    }
    return false;
  },
  async iniciar(opcoes={}){
    if(this.sessao||!brainReady||LAB.busy)return;
    let guardada=null;
    try{if(opcoes.continuar){const p=JSON.parse(store.get(this.chave)||'null');if(!p)throw Error('Ainda não há memória de treino guardada');guardada=this.decodificar(p.memoria);}}
    catch(e){this.mensagem(e.message);return;}
    Colonia.desligar();if(SB.fisico)corpoSet(false);if(PRED.on)predSet(false);
    if(APP.id!=='treino')switchApp('treino');
    const acaso=Math.random;
    if(opcoes.sementes)Math.random=ProtocoloMemoria.gerador(opcoes.sementes.mundo);
    try{sbSet(true);}finally{Math.random=acaso;}
    this.mostrar();
    sbCamMode('fantasma');Object.assign(FANT,{x:0,y:190,z:150,yaw:0,pitch:-Math.atan2(190,150)});
    this.sessao=true;this.ativa=false;this.geracao=(this.geracao||0)+1;const gen=this.geracao;
    this.anterior={running,freeze:LAB.freeze,memo};setRunning(false);
    clearTimeout(saveTimer);saveTimer=null;this.controles(true);this.mensagem('Preparando o cérebro…');
    try {
      const anterior=await this.memoria();if(gen!==this.geracao)return;this.anterior.memoria=anterior;
      this.config={segundos:+$('#treinoDur').value,repeticoes:3,alvo:$('#treinoAlvo').value,
        plasticidade:$('#treinoCond').value==='ativa',continuacao:!!guardada,...opcoes};
      this.config.segundos=clamp(this.config.segundos,.1,120);this.config.repeticoes=clamp(Math.round(this.config.repeticoes),1,10);
      this.config.retencao=clamp(+this.config.retencao||0,0,600);
      if(this.config.ponte)PONTE=this.config.ponte==='mbon'?'mbon':'sinapses';
      this.manual=!!this.config.manual;this.blocos=0;this.amostra=-1;
      this.acasoCorpo=this.config.sementes?ProtocoloMemoria.gerador(this.config.sementes.corpo):null;
      worker.postMessage({type:'semente',valor:this.config.sementes?.cerebro??null});
      this.fases=ProtocoloMemoria.fases(this.config);this.resultados=[];this.historico=[];this.total=0;this.indice=-1;
      worker.postMessage({type:'reset',keepMemory:false});
      if(guardada){this.restaurando=true;worker.postMessage({type:'setMemory',memory:guardada});}
      worker.postMessage({type:'params',plasticidade:this.config.plasticidade,tauF:this.config.tauF??90000});
      brainT=0;memory=memoryR=0;memo={};outRate={};
      if(lastAttr){lastAttr.array.fill(-1e6);lastAttr.needsUpdate=true;}
      this.ativa=true;this.proxima();setRunning(true);
    }catch(e){this.sair();this.mensagem(e.message);}
  },
  controles(on){
    const ids=['btnReset','memKeep','memForget','corpoBtn','predBtn','coloniaBtn','labTransfBtn','labBloqBtn','labSessBtn'];
    if(on)this.desabilitados=Object.fromEntries(ids.map(id=>[id,$('#'+id).disabled]));
    for(const id of ids)$('#'+id).disabled=on?true:!!this.desabilitados?.[id];
    for(const id of ['treinoIniciar','treinoContinuar','treinoCond','treinoAlvo','treinoDur'])$('#'+id).disabled=on;
    $('#treinoSair').disabled=!on;
  },
  proxima(){
    this.indice++;this.t=0;this.fase=this.fases[this.indice];
    if(!this.fase){
      this.ativa=false;LAB.freeze=true;setRunning(false);
      worker.postMessage({type:'rates',rates:{}});
      this.mensagem('Sessão concluída. Compare as escolhas; ausência de escolha também é resultado. Guarde a memória ou exporte a sessão antes de encerrar.');
      $('#treinoGuardar').disabled=false;$('#treinoExportar').disabled=false;$('#treinoProgresso').value=1;return;
    }
    const f=this.fase;
    for(const [i,p] of ['A','B'].entries())APPS.treino.objetos['t-'+p].x=(f.troca?1-i:i)?111:89;
    SB.app=null;renderShop();measure();
    fly=freshFly();Object.assign(fly,{x:700,y:750,z:0,th:0,hunger:1,voarCd:1e6});
    Object.assign(disp,{x:fly.x,y:fly.y,th:fly.th});outRate={};
    LAB.freeze=f.tipo!=='teste';
    this.medida={fase:f.nome,tipo:f.tipo,troca:!!f.troca,tempoA:0,tempoB:0,primeira:null,latencia:null,
      fora:0,duracao:0,recompensa_s:0,memoryR_inicio:memoryR};
    this.resultados.push(this.medida);
    const entrada=this.entradas({},null);rates=entrada.rates;worker.postMessage({type:'rates',...entrada});
    this.mensagem(`${f.nome} · ${f.duracao} s cerebrais${f.tipo==='pareamento'?(f.recompensa?' · recompensa no final':' · sem recompensa'):''}`);
  },
  antesPasso(){
    if(!this.ativa)return;
    LAB.freeze=this.fase.tipo!=='teste';fly.flying=false;fly.pain=fly.reward=fly.sweet=0;fly.omission=null;
    fly.hunger=1;fly.voarCd=1e6;
  },
  executarCorpo(dt,counts){
    const anterior=Math.random;
    if(this.acasoCorpo)Math.random=this.acasoCorpo;
    try{stepBody(dt,counts);}finally{Math.random=anterior;}
  },
  async avancar(quantidade=100){
    for(let i=0;i<quantidade&&this.ativa&&running;i++){
      if(this.blocoAguardado)throw Error('Já há um bloco de treino pendente');
      if(this.blocos%10===0){
        // Sensores em cadência cerebral fixa, independente dos quadros e da concorrência do PC.
        if(!OLHO.rf||!ANIM.poses)throw Error('Os olhos ou a malha ainda não carregaram');
        const anterior=Math.random;
        if(this.config.sementes)Math.random=ProtocoloMemoria.gerador(this.config.sementes.mundo);
        try{sbUpdate(0,performance.now());olhoAmostrar(fly);}finally{Math.random=anterior;}
      }
      await new Promise((resolve,reject)=>{
        const id=++this.blocos;
        const timer=setTimeout(()=>{this.blocoAguardado=null;reject(Error('O cérebro não respondeu ao bloco'));},30000);
        this.blocoAguardado={id,resolve,reject,timer};worker.postMessage({type:'passoDuplo',passo:id});
      });
    }
    return {ativa:this.ativa,t:this.total,fase:this.fase?.nome||'Concluída',indice:this.indice};
  },
  entradas(r,vetor){
    if(this.fase.tipo!=='teste')return {rates:ProtocoloMemoria.taxas(this.fase,this.t,this.config),vetor:null};
    const taxas={...r};delete taxas.doce;delete taxas.recompensa;delete taxas.dor;
    return {rates:taxas,vetor};
  },
  passo(dt,m){
    if(!this.ativa)return;
    this.t+=dt;this.total+=dt;const f=this.fase,d=this.medida;
    d.duracao+=dt;d.memoryR_fim=m.memoryR||0;
    if((rates.recompensa||0)>0)d.recompensa_s+=dt;
    if(f.tipo==='teste'){
      // Região de escolha circular de 8 mm; o restante conta como nenhuma pista.
      let pista=null;
      for(const p of ['A','B']){const o=APPS.treino.objetos['t-'+p];if(Math.hypot(fly.x-o.x*7,fly.y-o.y*7)<56)pista=p;}
      if(pista){d['tempo'+pista]+=dt;if(!d.primeira){d.primeira=pista;d.latencia=this.t;}}
      else d.fora+=dt;
      // Parede virtual quadrada, sem escolher o destino. Reflexão do rumo ao ultrapassar o limite.
      if(fly.x<540||fly.x>860){fly.x=clamp(fly.x,540,860);fly.th=-fly.th;}
      if(fly.y<540||fly.y>860){fly.y=clamp(fly.y,540,860);fly.th=Math.PI-fly.th;}
    }else {fly.speed=0;fly.giroCorpo=0;}
    if(Math.floor(this.total*5)!==this.amostra){
      this.amostra=Math.floor(this.total*5);
      this.historico.push({t:+this.total.toFixed(2),fase:this.indice,x:fly.x,y:fly.y,memory:m.memory,memoryR:m.memoryR});
      this.tabela();$('#treinoProgresso').value=this.total/this.fases.reduce((s,f)=>s+f.duracao,0);
    }
    if(this.t+1e-7>=f.duracao)this.proxima();
  },
  tabela(){
    $('#treinoResultados').innerHTML='<table style="width:100%;text-align:left"><thead><tr><th>Teste</th><th>Primeira escolha</th><th>A / B (s)</th><th>Preferência A</th></tr></thead><tbody>'+
      this.resultados.filter(d=>d.tipo==='teste').map(d=>`<tr><td>${d.fase}</td><td>${d.primeira||'Nenhuma'}</td><td>${d.tempoA.toFixed(1)} / ${d.tempoB.toFixed(1)}</td><td>${d.tempoA+d.tempoB>0?((d.tempoA-d.tempoB)/(d.tempoA+d.tempoB)).toFixed(2):'—'}</td></tr>`).join('')+'</tbody></table>';
  },
  codificar(m){const parte=p=>({n:p.n,idx:toB64(new Uint8Array(p.idx.buffer)),r:toB64(p.r),c:toB64(p.c)});return {v:m.v,edges:m.edges,A:parte(m.A),R:parte(m.R)};},
  decodificar(m){const parte=p=>({n:p.n,idx:new Int32Array(fromB64(p.idx).buffer),r:fromB64(p.r),c:fromB64(p.c)});return {...m,A:parte(m.A),R:parte(m.R)};},
  async guardar(){
    if(!this.sessao||this.ativa)return;const gen=this.geracao;
    try{const m=await this.memoria();if(gen!==this.geracao)return;
      const ok=store.set(this.chave,JSON.stringify({data:new Date().toISOString(),config:this.config,memoria:this.codificar(m)}));
      this.mensagem(ok?'Memória do treino guardada neste navegador. Encerre e use “Treinar memória guardada” para continuar.':'Não foi possível guardar a memória.');
    }catch(e){this.mensagem(e.message);}
  },
  relatorio(){return {versao:1,data:new Date().toISOString(),concluido:!this.ativa&&this.indice===this.fases?.length,
    metodo:'Uma mosca, duas pistas olfativas. Pareamento direto de ORNs e PAM, testes livres sem recompensa, posição inicial igual e lados trocados. Corpo no chão; fome fixa; atração inata de frutas desligada. Sem equivalência sensorial demonstrada. Sementes e relógio manual, quando usados, constam na configuração; interface interativa não semeada. Pesos congelados no controle. Preferência A=(tempoA-tempoB)/(tempoA+tempoB), indefinida se não visitou pistas. Memória sináptica não equivale a aprendizado comportamental.',config:this.config,resultados:this.resultados,historico:this.historico};},
  exportar(){const url=URL.createObjectURL(new Blob([JSON.stringify(this.relatorio(),null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='treino-memoria-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  sair(){
    if(!this.sessao){this.mostrar();return;}
    this.geracao++;this.ativa=false;this.sessao=false;setRunning(false);
    this.manual=false;this.acasoCorpo=null;
    worker.postMessage({type:'params',plasticidade:true,tauF:90000});worker.postMessage({type:'semente',valor:null});
    worker.postMessage({type:'rates',rates:{}});
    if(this.anterior?.memoria){
      worker.postMessage({type:'reset',keepMemory:false});
      this.restaurando=true;worker.postMessage({type:'setMemory',memory:this.anterior.memoria});
    }
    memo=this.anterior?.memo||{};LAB.freeze=!!this.anterior?.freeze;brainT=0;fly=freshFly();outRate={};
    if(lastAttr){lastAttr.array.fill(-1e6);lastAttr.needsUpdate=true;}
    this.controles(false);$('#treinoGuardar').disabled=true;
    $('#treinoExportar').disabled=!this.resultados.length;
    this.mensagem('Treino encerrado. Memória anterior restaurada; o relatório da sessão continua disponível.');
    setRunning(!!this.anterior?.running);this.mostrar();
  },
};
$('#treinoIniciar').onclick=()=>Treino.iniciar();$('#treinoContinuar').onclick=()=>Treino.iniciar({continuar:true});
$('#treinoSair').onclick=()=>Treino.sair();$('#treinoGuardar').onclick=()=>Treino.guardar();$('#treinoExportar').onclick=()=>Treino.exportar();
// A visibilidade acompanha a aba, sem depender de uma sessão em execução.
new MutationObserver(()=>Treino.mostrar()).observe($('#url'),{childList:true});
