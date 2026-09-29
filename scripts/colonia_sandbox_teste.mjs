// Integração real: um navegador, dois workers, perfis temporários somente no projeto.
import {spawn} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import assert from 'node:assert/strict';
const tmp=resolve('_tmp');mkdirSync(tmp,{recursive:true});
const perfil=mkdtempSync(join(tmp,'_colonia-')),cdp=9558;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const proc=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new',`--remote-debugging-port=${cdp}`,`--user-data-dir=${perfil}`,
  '--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-unsafe-swiftshader',
  '--no-first-run','--no-default-browser-check','--window-size=1400,1000',
  `http://localhost:8765/?headless=1&r=${Date.now()}`],{stdio:'ignore'});
let ws,seq=0;const pendentes=new Map(),erros=[];
const prazo=setTimeout(()=>{proc.kill();console.error('Limite de 6 minutos');process.exit(1);},360000);
try{
  let url;
  for(let i=0;i<60&&!url;i++){
    try{url=(await(await fetch(`http://127.0.0.1:${cdp}/json`)).json()).find(p=>p.type==='page'&&p.url.includes('localhost:8765'))?.webSocketDebuggerUrl;}catch{}
    if(!url)await sleep(500);
  }
  if(!url)throw Error('Chrome não abriu');
  ws=new WebSocket(url);await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.method==='Runtime.exceptionThrown')erros.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(pendentes.has(m.id)){pendentes.get(m.id)(m);pendentes.delete(m.id);}
  };
  const send=(method,params={})=>new Promise((ok,fail)=>{const id=++seq;pendentes.set(id,m=>m.error?fail(Error(m.error.message)):ok(m.result));ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  await send('Runtime.enable');
  while(!await ev('typeof brainReady!=="undefined"&&brainReady'))await sleep(1000);
  await ev(`(async()=>{switchApp('cozinha');sbSet(true);setRunning(false);await animCarregar();
    if(!ANIM.poses)throw Error(ANIM.erro);await olhoCarregar();Colonia.ligar();return true;})()`);
  while(!await ev('Colonia.pronta')){await sleep(1000);if(!await ev('Colonia.ativa'))throw Error(await ev("$('#coloniaEstado').textContent"));}
  console.log('Dois cérebros carregados.');
  const inicial=await ev(`(async()=>{
    LAB.freeze=true;
    const ac=rects.find(r=>r.id==='k-acucar');
    Object.assign(fly,{x:ac.x+ac.w/2,y:ac.y+ac.h/2,z:ac.z,th:0,hunger:1,voarCd:100});
    Object.assign(Colonia.segundo.fly,{x:1100,y:1200,z:0,th:Math.PI,hunger:.4,voarCd:100});
    setRunning(true);await waitBrain(2500);setRunning(false);await sleep(500);
    return {tempo:Colonia.tempo,h1:fly.hunger,h2:Colonia.segundo.fly.hunger,refeicoes,
      r1:rates.doce||0,r2:Colonia.segundo.rates.doce||0,
      estadosSeparados:fly!==Colonia.segundo.fly&&outRate!==Colonia.segundo.outRate&&memo!==Colonia.segundo.memo,
      olhosSeparados:fly.olhoReal.celulas!==Colonia.segundo.fly.olhoReal.celulas,
      malhas:!!Colonia.visual,erros:$('#coloniaEstado').textContent};})()`);
  console.log(JSON.stringify(inicial));
  assert(inicial.estadosSeparados&&inicial.olhosSeparados&&inicial.malhas);
  assert(inicial.refeicoes.some(m=>m.mosca===1)&&!inicial.refeicoes.some(m=>m.mosca===2));
  assert(inicial.h1<1&&inicial.h2>.4&&inicial.h2<.5&&inicial.r2===0);
  const pausado=await ev('Colonia.tempo');await sleep(500);assert.equal(await ev('Colonia.tempo'),pausado);
  const contato=await ev(`(async()=>{
    Object.assign(fly,{x:1100,y:1200,z:0,th:Math.PI/2,flying:false,voarCd:100});
    Object.assign(Colonia.segundo.fly,{x:1114,y:1200,z:0,th:-Math.PI/2,flying:false,voarCd:100});
    setRunning(true);await waitBrain(200);setRunning(false);await sleep(200);
    return {t1:rates.tato_lf,t2:Colonia.segundo.rates.tato_lf,encontros:Colonia.encontros,
      barreira:!Colonia.permitePasso(fly,1101,1200,0),afastar:Colonia.permitePasso(fly,1099,1200,0)};})()`);
  assert(contato.t1===20&&contato.t2===20&&contato.encontros>0&&contato.barreira&&contato.afastar);
  const visao=await ev(`(()=>{
    Object.assign(fly,{x:1100,y:1200,z:0,th:Math.PI/2});
    Object.assign(Colonia.segundo.fly,{x:1122,y:1200,z:0,th:-Math.PI/2});
    sbUpdate(0,performance.now());
    SBR.r.setSize(SBR.r.domElement.clientWidth,SBR.r.domElement.clientHeight,false);
    SBR.r.setScissorTest(false);
    const testes=[];
    for(const [f,outro] of [[fly,Colonia.visual.malha.group],[Colonia.segundo.fly,CORPO.malha.group]]){
      outro.visible=true;olhoAmostrar(f);const com=f.olhoReal.celulas.slice();
      outro.visible=false;olhoAmostrar(f);const sem=f.olhoReal.celulas;
      testes.push({somaDiferencas:com.reduce((s,v,i)=>s+Math.abs(v-sem[i]),0)});outro.visible=true;
    }
    return testes;})()`);
  console.log('Visão:',JSON.stringify(visao));assert(visao.every(t=>t.somaDiferencas>0));
  const comida=await ev(`(()=>{const id='k-acucar',n=refeicoes.length,antes=fly,antigo=Colonia.segundo.fly;
    restos[id]=1;comer(id);fly=antigo;try{comer(id);}finally{fly=antes;}
    return {resto:restos[id],mordidas:refeicoes.length-n};})()`);
  assert(comida.resto===0&&comida.mordidas===1);
  const figura=await ev(`(()=>{
    sbUpdate(0,performance.now());const cena=new THREE.Scene();cena.background=new THREE.Color('#ece7dc');
    cena.add(CORPO.malha.group.clone(true),Colonia.visual.malha.group.clone(true));
    cena.add(new THREE.HemisphereLight('#ffffff','#514b40',1.2));
    const luz=new THREE.DirectionalLight('#ffffff',.8);luz.position.set(0,100,50);cena.add(luz);
    const centro=new THREE.Box3().setFromObject(cena).getCenter(new THREE.Vector3());
    SBR.cam.position.copy(centro).add(new THREE.Vector3(20,32,55));SBR.cam.lookAt(centro);
    const w=SBR.r.domElement.clientWidth,h=SBR.r.domElement.clientHeight;
    SBR.cam.near=.2;SBR.cam.aspect=w/h;SBR.cam.updateProjectionMatrix();
    SBR.r.setRenderTarget(null);SBR.r.setViewport(0,0,w,h);SBR.r.setScissorTest(false);SBR.r.clear();SBR.r.render(cena,SBR.cam);
    return SBR.r.domElement.toDataURL('image/png').split(',')[1];})()`);
  writeFileSync('_colonia-duas-moscas.png',Buffer.from(figura,'base64'));
  const reinicio=await ev(`(async()=>{$('#btnReset').click();await sleep(200);const zerou=Colonia.tempo===0;
    setRunning(true);await waitBrain(200);setRunning(false);await sleep(200);
    return {zerou,t1:Colonia.primeiroUltimo.t,t2:Colonia.segundo.ultimo.t};})()`);
  assert(reinicio.zerou&&reinicio.t1===reinicio.t2);
  const livre=await ev(`(async()=>{
    LAB.freeze=false;Colonia.aproximar();
    const inicio=[{x:fly.x,y:fly.y},{x:Colonia.segundo.fly.x,y:Colonia.segundo.fly.y}];
    const t0=Colonia.tempo,w0=performance.now();setRunning(true);await waitBrain(5000);setRunning(false);await sleep(200);
    const f=[fly,Colonia.segundo.fly];
    sbFrame(.016);$('#coloniaBtn').scrollIntoView({block:'center'});
    const b=$('#coloniaBtn').getBoundingClientRect();
    return {duracao:Colonia.tempo-t0,tempo_real_s:(performance.now()-w0)/1000,
      deslocamentos:f.map((p,i)=>Math.hypot(p.x-inicio[i].x,p.y-inicio[i].y)),
      finitos:f.every(p=>[p.x,p.y,p.z,p.th].every(Number.isFinite)),encontros:Colonia.encontros,
      botaoAcessivel:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.id==='coloniaBtn'};})()`);
  console.log('Livre:',JSON.stringify(livre));
  assert(livre.finitos&&livre.deslocamentos.every(d=>d>1)&&livre.botaoAcessivel);
  const captura=await send('Page.captureScreenshot',{format:'png'});writeFileSync('_colonia-interface.png',Buffer.from(captura.data,'base64'));
  const desligou=await ev(`(async()=>{Colonia.desligar();const ok=!Colonia.segundo&&!Colonia.visual&&!Colonia.pendente;
    setRunning(true);await waitBrain(150);setRunning(false);return ok;})()`);
  assert(desligou);assert.deepEqual(erros,[]);
  writeFileSync('docs/medicoes/colonia-sandbox.json',JSON.stringify({metodo:'Chrome sem janela, uma página com dois workers reais. Corpo congelado apenas nas sondas para isolar sentidos: mosca 1 no açúcar e 2 longe por 2,5 s cerebrais; contato a 14 px; diferença na entrada LC10a com/sem a outra malha em ambas as direções. Última porção exercitada diretamente no controlador alimentar. Pausa, reinício dos dois, 5 s livres e retorno a um worker. Figura isola as duas malhas animadas para conferência. Não valida interação social espontânea nem desempenho em sessão longa. A rodada livre tem posições iniciais escolhidas e aleatoriedade não semeada.',inicial,contato,visao,comida,reinicio,livre,desligou,erros,figura:'_colonia-duas-moscas.png'},null,2)+'\n');
  console.log('Integração da dupla passou.');
}finally{
  clearTimeout(prazo);ws?.close();proc.kill();await sleep(1500);
  const rel=relative(tmp,resolve(perfil));
  if(!rel.startsWith('..')&&!rel.includes('\\')&&rel.startsWith('_colonia-'))for(let i=0;i<5;i++){try{rmSync(perfil,{recursive:true,force:true});break;}catch{await sleep(500);}}
}
