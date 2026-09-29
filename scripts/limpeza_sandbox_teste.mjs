// Integração da limpeza na página real. Um Chrome, perfil no D, sem alterar o servidor físico do usuário.
// Sonda controlada: mantém a mosca num ponto sem comida e antecipa o intervalo da limpeza.
import {spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {resolve, relative, join} from 'node:path';
const porta = 8765, cdp = 9557;
const tmp = resolve('_tmp'); mkdirSync(tmp, {recursive: true});
const perfil = mkdtempSync(join(tmp, 'mosca-limpeza-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const proc = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', `--remote-debugging-port=${cdp}`, `--user-data-dir=${perfil}`,
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--window-size=1400,1000',
  `http://localhost:${porta}/?headless=1&r=${Date.now()}`,
], {stdio: ['ignore', 'ignore', 'pipe']});
let chromeErro = '';
proc.stderr.on('data', b => {chromeErro = (chromeErro + b.toString()).slice(-2000);});
proc.on('error', e => {chromeErro += e.message;});
let ws, seq = 0;
const pendentes = new Map(), erros = [];
const prazo = setTimeout(() => {console.error('Limite de 4 min no teste.'); proc.kill(); process.exit(1);}, 240000);
try {
  let url;
  for (let i = 0; i < 60 && !url; i++) {
    try {url = (await (await fetch(`http://127.0.0.1:${cdp}/json`)).json()).find(p => p.type === 'page' && p.url.includes(`localhost:${porta}`))?.webSocketDebuggerUrl;} catch {}
    if (!url) await sleep(500);
  }
  if (!url) throw new Error('Chrome não abriu. Saída: ' + proc.exitCode + ' ' + chromeErro);
  ws = new WebSocket(url); await new Promise((ok, fail) => {ws.onopen = ok; ws.onerror = e => fail(new Error('WebSocket: ' + (e.message || e.error?.message || '') + ' ' + chromeErro));});
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (pendentes.has(m.id)) {pendentes.get(m.id)(m); pendentes.delete(m.id);}
  };
  const send = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++seq; pendentes.set(id, m => m.error ? fail(new Error(m.error.message)) : ok(m.result));
    ws.send(JSON.stringify({id, method, params}));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Runtime.enable');
  while (!await evaluate('typeof brainReady !== "undefined" && brainReady')) await sleep(1000);
  console.log('Cérebro carregado.');
  await evaluate(`(async()=>{
    $('#appTabs button[data-app="cozinha"]').click(); $('#modeTabs button[data-mode="3d"]').click();
    await animCarregar(); if(!ANIM.limpeza) throw new Error(ANIM.erroLimpeza || 'sem poses de limpeza');
    LAB.busy=true; LAB.freeze=true; LAB.events=[];
    Object.assign(fly,{x:1100,y:1200,z:0,th:Math.PI/2,flying:false,presa:false,back:0,threat:0,loom:0,hunger:.3,voarCd:100});
    await waitBrain(1500);
    fly.marcha='pausa';fly.marchaT=10;fly.limpeza={ativa:false,espera:0,t:0,pausa:0};
    true;
  })()`);
  const fotos = [], etapas = new Set();
  for (const [nome, espera] of [['cabeca',450],['patas',850],['antenas',750]]) {
    const estado = await evaluate(`(async()=>{await waitBrain(${espera}); worker.postMessage({type:'run',on:false}); running=false;
      sbUpdate(0,performance.now()); return {nome:fly.limpeza?.etapa,ativa:fly.limpeza?.ativa,tempo:fly.limpeza?.t,
        velocidade:fly.speed,boca:fly.boca,eventos:LAB.events.filter(e=>e.type==='limpeza')};})()`);
    console.log(JSON.stringify(estado));
    if (!estado.ativa || estado.nome !== nome || estado.velocidade !== 0) throw new Error('fase/repouso incorretos: ' + JSON.stringify(estado));
    etapas.add(estado.nome);
    const figura = await evaluate(`(()=>{window._frameLimpeza=sbFrame;sbFrame=()=>{};
      sbUpdate(0,performance.now());
      // Cena de conferência: só a malha já animada, para a bancada/frutas não obstruírem a câmera próxima.
      const cena=new THREE.Scene();cena.background=new THREE.Color('#ede9df');
      cena.add(CORPO.malha.group.clone(true));cena.add(new THREE.HemisphereLight('#ffffff','#514b40',1.2));
      const luz=new THREE.DirectionalLight('#ffffff',.8);luz.position.set(0,100,50);cena.add(luz);
      const centro=new THREE.Box3().setFromObject(CORPO.malha.group).getCenter(new THREE.Vector3());
      SBR.cam.position.copy(centro).add(new THREE.Vector3(28,12,30));SBR.cam.lookAt(centro);SBR.camReady=true;
      SBR.r.setSize(SBR.r.domElement.clientWidth,SBR.r.domElement.clientHeight,false);
      SBR.cam.near=.2;SBR.cam.aspect=SBR.r.domElement.clientWidth/SBR.r.domElement.clientHeight;SBR.cam.updateProjectionMatrix();
      SBR.r.setRenderTarget(null);SBR.r.setViewport(0,0,SBR.r.domElement.clientWidth,SBR.r.domElement.clientHeight);SBR.r.setScissorTest(false);SBR.r.clear();SBR.r.render(cena,SBR.cam);
      return SBR.r.domElement.toDataURL('image/png').split(',')[1];})()`);
    const arquivo = `_limpeza-${nome}.png`; writeFileSync(arquivo, Buffer.from(figura,'base64')); fotos.push(arquivo);
    await evaluate(`sbFrame=window._frameLimpeza;running=true;worker.postMessage({type:'run',on:true});true`);
  }
  const fim = await evaluate(`(async()=>{await waitBrain(1500);return{ativa:fly.limpeza.ativa,espera:fly.limpeza.espera,eventos:LAB.events.filter(e=>e.type==='limpeza')}})()`);
  if (fim.ativa || !fim.eventos.some(e => e.estado === 'fim')) throw new Error('limpeza não terminou');
  const interrupcoes = await evaluate(`(async()=>{
    const res=[];
    for(const chave of ['threat','flying','presa','back','naParede']){
      fly.limpeza={ativa:true,t:1,etapa:'patas',anterior:'cabeca',mistura:1,peso:1,espera:0,pausa:0};
      fly[chave]=chave==='naParede'?{}:chave==='flying'||chave==='presa'?true:1;
      await waitBrain(30);res.push({chave,ativa:fly.limpeza?.ativa});
      fly[chave]=chave==='naParede'?null:chave==='flying'||chave==='presa'?false:0;
    }
    worker.postMessage({type:'run',on:false});running=false;return res;
  })()`);
  if (interrupcoes.some(x => x.ativa) || erros.length) throw new Error(JSON.stringify({interrupcoes,erros}));
  const alimentacao = await evaluate(`(async()=>{
    const ac=rects.find(r=>r.id==='k-acucar'), n=refeicoes.length;
    Object.assign(fly,{x:ac.x+ac.w/2,y:ac.y+ac.h/2,z:ac.z,th:0,hunger:1,flying:false,presa:false,naParede:null,back:0,threat:0,loom:0});
    fly.limpeza={ativa:true,t:1,etapa:'patas',anterior:'cabeca',mistura:1,peso:1,espera:0,pausa:0};
    running=true;worker.postMessage({type:'run',on:true});await waitBrain(2500);
    worker.postMessage({type:'run',on:false});running=false;
    return{limpando:fly.limpeza?.ativa,mordidas:refeicoes.length-n};
  })()`);
  if (alimentacao.limpando || !(alimentacao.mordidas > 0) || erros.length) throw new Error(JSON.stringify({alimentacao,erros}));
  const resultado = {metodo:'Chrome sem janela, worker real, Cozinha 3D no modo padrão só sentidos. LAB.freeze mantém a posição num ponto sem comida; intervalo antecipado para iniciar numa pausa. Sequência avança pelo relógio cerebral. Ameaça, voo, captura, ré e escalada injetados para testar interrupção. Depois posicionada no açúcar durante a limpeza para verificar prioridade da alimentação. Imagens: mesma malha animada, isolada numa cena de conferência com iluminação neutra. Não mede frequência espontânea nem valida realismo biológico. Corpo físico não ligado.',
    etapas: [...etapas], fim, interrupcoes, alimentacao, erros, fotos};
  writeFileSync('docs/medicoes/limpeza-sandbox.json', JSON.stringify(resultado,null,2)+'\n');
  console.log('Sequência, repouso e interrupções passaram.');
} finally {
  clearTimeout(prazo); ws?.close(); proc.kill(); await sleep(1500);
  const rel = relative(tmp, resolve(perfil));
  if (!rel.startsWith('..') && !rel.includes('\\') && rel.startsWith('mosca-limpeza-')) {
    for (let i=0;i<5;i++) {try {rmSync(perfil,{recursive:true,force:true});break;} catch {await sleep(500);}}
  }
}
