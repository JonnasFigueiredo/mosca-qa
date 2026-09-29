// Duas cópias do conectoma, com uma barreira de 10 ms. Comida e cenário são compartilhados.
// A distância de encontro e a exclusão geométrica são regras nossas, não saídas sociais do mapa.
window.Colonia = {
  ativa:false, pronta:false, segundo:null, sequencia:0, pendente:null, timer:null, visual:null,
  tempo:0, perto:0, encontros:0, contato:false, alterna:false,
  estado(texto) { document.getElementById('coloniaEstado').textContent=texto; },
  ligar() {
    if(window.Treino?.sessao)return;
    if(this.ativa || !brainReady || LAB.busy)return;
    if(APP.id!=='cozinha')switchApp('cozinha');
    if(!SB.on)sbSet(true);
    if(!SB.on)return;
    if(SB.fisico)corpoSet(false);
    if(PRED.on)predSet(false);
    this.ativa=true;this.pronta=false;
    worker.postMessage({type:'run',on:false});
    this.estado('Carregando o segundo cérebro…');this.controles();
    const w=new Worker('sim-worker.js');
    this.segundo={worker:w,fly:this.novaMosca(),rates:{},outRate:{},memo:{},ultimo:null};
    w.onmessage=({data:m})=>{if(this.segundo?.worker===w)this.receber(1,m);};
    w.onerror=e=>this.falhar(e.message || 'Falha no segundo cérebro');
    this.carga=setTimeout(()=>this.falhar('O segundo cérebro não carregou em 90 s'),90000);
    w.postMessage({type:'load'});
  },
  novaMosca() {
    const f=freshFly();f.numero=2;
    // Começa perto da primeira, num apoio do mesmo nível, sem sobrepor os corpos.
    let achou=false;
    for(let raio=35;raio<=140&&!achou;raio+=35)for(let k=0;k<16;k++){
      const a=k*Math.PI/8,x=fly.x+raio*Math.cos(a),y=fly.y+raio*Math.sin(a);
      if(x<15||x>SB.W-15||y<15||y>SB.H-15)continue;
      const z=sbSurface(x,y);
      if(Math.abs(z-(fly.z||0))>2)continue;
      Object.assign(f,{x,y,z,th:fly.th+Math.PI/2});achou=true;break;
    }
    return f;
  },
  controles() {
    $('#coloniaBtn').textContent=this.ativa?'Voltar a uma mosca':'Adicionar uma mosca';
    $('#coloniaBtn').classList.toggle('on',this.ativa);
    $('#coloniaEncontro').hidden=!this.pronta;
    for(const id of ['predBtn','corpoBtn','labTransfBtn','labBloqBtn','labSessBtn'])
      $('#'+id).disabled=this.ativa || (id==='corpoBtn'?!CORPO.ok:!brainReady);
  },
  falhar(mensagem) {this.desligar();this.estado(mensagem+'. Voltou a uma mosca.');},
  desligar() {
    if(!this.ativa)return;
    this.ativa=false;this.pronta=false;clearTimeout(this.carga);clearTimeout(this.timer);
    this.pendente=null;this.segundo?.worker.terminate();this.segundo=null;
    if(this.visual){
      SBR.scene.remove(this.visual.malha.group);
      // Geometrias da malha são compartilhadas com a primeira; só os leques são exclusivos.
      for(const l of this.visual.anim.leques){SBR.scene.remove(l);l.geometry.dispose();l.material.dispose();}
      this.visual=null;
    }
    if(this.simples){
      SBR.scene.remove(this.simples);
      const geos=new Set(),mats=new Set();
      this.simples.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of [].concat(o.material))mats.add(m);});
      for(const g of geos)g.dispose();for(const m of mats)m.dispose();this.simples=null;
    }
    for(const m of this.marcas||[]){SBR.scene.remove(m);m.geometry.dispose();m.material.dispose();}
    this.marcas=null;if(fly)fly.toqueMosca=false;
    if(SBR.mode==='dupla')sbCamMode('spec');
    this.controles();this.estado('Uma mosca.');
    worker.postMessage({type:'run',on:running});
  },
  reiniciar() {
    if(!this.ativa)return;
    clearTimeout(this.timer);this.pendente=null;this.tempo=0;this.perto=0;this.encontros=0;this.contato=false;
    this.segundo.worker.postMessage({type:'reset',keepMemory});
    this.segundo.worker.postMessage({type:'rates',rates:{}});
    worker.postMessage({type:'rates',rates:{}});
    this.segundo.outRate={};this.segundo.rates={};
    if(!keepMemory)this.segundo.memo={};
    this.timer=setTimeout(()=>{if(this.ativa){this.segundo.fly=this.novaMosca();this.executar(running);}},0);
  },
  executar(on) {
    clearTimeout(this.timer);
    if(!on||!this.pronta||this.pendente)return;
    this.pendente={id:++this.sequencia,recebidos:[],inicio:performance.now()};
    for(const w of [worker,this.segundo.worker])w.postMessage({type:'passoDuplo',passo:this.pendente.id});
  },
  receber(indice,m) {
    if(!this.ativa)return m.passoDuplo!==undefined;
    if(m._dupla)return false;
    if(indice===1&&m.type==='error'){this.falhar(m.message);return true;}
    if(indice===1&&m.type==='ready'){
      clearTimeout(this.carga);this.pronta=true;
      this.tempo=0;this.perto=0;this.encontros=0;this.contato=false;
      this.controles();sbCamMode('dupla');this.estado('Duas moscas • cérebros independentes');this.executar(running);return true;
    }
    if(m.type!=='tick')return indice===1;
    const p=this.pendente;
    if(!p||m.passoDuplo!==p.id)return true;
    p.recebidos[indice]=m;
    if(p.recebidos.filter(Boolean).length<2)return true;
    try {
      this.atualizar(p.recebidos);
      this.pendente=null;
      // Nunca mais rápido que o tempo real; espera sempre os dois cérebros.
      this.timer=setTimeout(()=>this.executar(running),Math.max(0,10-(performance.now()-p.inicio)));
    } catch(e){console.error(e);this.falhar('Falha na dupla: '+e.message);}
    return true;
  },
  passoSegundo(m) {
    const c=this.segundo;
    // O controlador legado é síncrono. Só o contexto individual muda durante esta chamada;
    // callbacks do navegador só podem rodar depois de restaurar o contexto da primeira mosca.
    const salvo=[fly,rates,outRate,memo,kcDrive,kcBase,kcDriveR,kcBaseR,kcLossA,kcLossR,brainT];
    [fly,rates,outRate,memo]=[c.fly,c.rates,c.outRate,c.memo];
    kcDrive=m.kcDrive||0;kcBase=m.kcBase||0;kcDriveR=m.kcDriveR||0;kcBaseR=m.kcBaseR||0;
    kcLossA=kcBase-kcDrive;kcLossR=kcBaseR-kcDriveR;
    brainT=this.primeiroTempo;
    try {stepBody(m.dtSim/1000,m.counts,c.worker);checkOmission();}
    finally {
      c.rates=rates;c.outRate=outRate;c.ultimo={t:m.t,counts:m.counts,memory:m.memory,memoryR:m.memoryR};
      [fly,rates,outRate,memo,kcDrive,kcBase,kcDriveR,kcBaseR,kcLossA,kcLossR,brainT]=salvo;
    }
  },
  atualizar(ms) {
    const dt=ms[0].dtSim/1000;
    if(ms[1].dtSim!==ms[0].dtSim)throw Error('relógios incompatíveis');
    this.primeiroTempo=ms[0].t;
    this.tempo+=dt;this.primeiroUltimo={t:ms[0].t,counts:ms[0].counts};
    this.principal=fly;
    // Os olhos olham a mesma cena antes de qualquer corpo avançar. Sem realce artificial das moscas.
    if(OLHO.rf&&this.sequencia%10===0){sbUpdate(0,performance.now());olhoAmostrar(this.segundo.fly);olhoAmostrar(fly);}
    const a=fly,b=this.segundo.fly,dist=Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
    const perto=dist<35;
    if(perto&&!this.contato)this.encontros++;
    this.contato=perto;if(perto)this.perto+=dt;
    a.toqueMosca=b.toqueMosca=dist<15;
    const antes=[{x:a.x,y:a.y,z:a.z},{x:b.x,y:b.y,z:b.z}];
    // Alternar a ordem evita dar sempre à mesma mosca a última porção disponível.
    this.alterna=!this.alterna;
    if(this.alterna)this.passoSegundo(ms[1]);
    worker.onmessage({data:{...ms[0],_dupla:true}});
    if(!this.alterna)this.passoSegundo(ms[1]);
    // Regra geométrica de exclusão: se um passo aproximou demais, desfaz as duas translações.
    const depois=Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
    if(depois<14&&depois<dist){Object.assign(a,antes[0]);Object.assign(b,antes[1]);a.toqueMosca=b.toqueMosca=true;}
    if(this.sequencia%20===0)this.estado(`Duas moscas • ${this.encontros} encontros a menos de 5 mm • ${this.perto.toFixed(1)} s próximas • distância ${(dist/7).toFixed(1)} mm • fome: ${Math.round(a.hunger*100)}% / ${Math.round(b.hunger*100)}%.`);
  },
  prepararVisual() {
    if(this.visual||!ANIM.poses||!CORPO.malha)return;
    const group=CORPO.malha.group.clone(true),meshes=group.children;
    const leques=ANIM.leques.map(l=>{const n=l.clone();n.geometry=l.geometry.clone();n.material=l.material.clone();SBR.scene.add(n);return n;});
    this.visual={malha:{...CORPO.malha,group,meshes},anim:{...ANIM,recolhe:0,fase:0,faseAsa:0,cabeca:0,leques,bocaSimples:null}};
    SBR.scene.add(group);
    this.marcas=['#49c7ff','#f7b34a'].map(cor=>{
      const m=new THREE.Mesh(new THREE.RingGeometry(10,11,32),new THREE.MeshBasicMaterial({color:cor,side:THREE.DoubleSide,depthWrite:false}));
      m.rotation.x=-Math.PI/2;SBR.scene.add(m);return m;
    });
  },
  permitePasso(f,x,y,z) {
    if(!this.pronta)return true;
    const outra=f===this.segundo.fly?this.principal:this.segundo.fly;
    if(!outra)return true;
    const antes=Math.hypot(f.x-outra.x,f.y-outra.y,(f.z||0)-(outra.z||0));
    const depois=Math.hypot(x-outra.x,y-outra.y,z-(outra.z||0));
    return depois>=14 || depois>=antes;
  },
  desenhar(dt) {
    if(!this.pronta)return;
    this.prepararVisual();
    if(!this.visual){
      if(!this.simples){this.simples=evFly();this.simples.scale.setScalar(1.7);SBR.scene.add(this.simples);}
      const f=this.segundo.fly;this.simples.visible=true;
      this.simples.position.set(f.x-SB.W/2,f.z,f.y-SB.H/2);this.simples.rotation.y=-f.th;
      return;
    }
    if(this.simples)this.simples.visible=false;
    const anterior=ANIM,malha=CORPO.malha;
    ANIM=this.visual.anim;CORPO.malha=this.visual.malha;
    try {animPose(this.segundo.fly,dt);animBoca(this.segundo.fly);animLimpeza(this.segundo.fly);}
    finally {ANIM=anterior;CORPO.malha=malha;}
    [fly,this.segundo.fly].forEach((f,i)=>this.marcas[i].position.set(f.x-SB.W/2,(f.z||0)+.5,f.y-SB.H/2));
  },
  // Todas as anotações somem dos olhos. Cada mosca esconde só o próprio corpo.
  esconderDosOlhos(f) {
    const v=this.visual;
    if(!v)return f===this.segundo?.fly&&this.simples?[this.simples]:[];
    return [...(this.marcas||[]),...ANIM.leques,...v.anim.leques,
      ...(f===this.segundo.fly?[v.malha.group]:[])];
  },
  aproximar() {
    if(!this.pronta)return;
    const novo=this.novaMosca();Object.assign(this.segundo.fly,novo);
    this.segundo.fly.th=Math.atan2(fly.x-novo.x,-(fly.y-novo.y));
    this.segundo.fly.olhoReal=null;
    this.estado('Mosca 2 colocada perto da 1. Posição escolhida pelo observador.');
  },
};
const faixa=document.createElement('div');faixa.className='app-tabs colonia-painel';
faixa.innerHTML='<button id="coloniaBtn">Adicionar uma mosca</button><button id="coloniaEncontro" hidden>Aproximar moscas</button><span id="coloniaEstado" role="status">Uma mosca.</span><small>Dupla experimental na Cozinha: dois cérebros completos, corpos cinemáticos. Azul: mosca 1; laranja: 2. Comida compartilhada; contato geométrico é regra. Sem namoro, agressão ou feromônio social. Os olhos e painéis mostram a mosca 1; só a memória dela é salva entre visitas. Até duas moscas para limitar a memória.</small>';
$('#worldBox').after(faixa);
$('#coloniaBtn').onclick=()=>Colonia.ativa?Colonia.desligar():Colonia.ligar();
$('#coloniaEncontro').onclick=()=>Colonia.aproximar();
const verDupla=document.createElement('button');verDupla.dataset.mode='dupla';verDupla.textContent='Ver dupla';
verDupla.onclick=()=>{if(Colonia.pronta)sbCamMode('dupla');};$('#sbModes').append(verDupla);
