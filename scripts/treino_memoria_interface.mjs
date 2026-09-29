// Integração real: um navegador, dois workers, perfis temporários somente no projeto.
import {spawn} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import assert from 'node:assert/strict';
const completo=process.argv.includes('--completo');
const tmp=resolve('_tmp');mkdirSync(tmp,{recursive:true});
const perfil=mkdtempSync(join(tmp,'_treino-')),cdp=9559;
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
  await ev(`(async()=>{setRunning(false);switchApp('treino');sbSet(true);await animCarregar();return true;})()`);
  if(completo)await ev('window._renderTreino=setInterval(()=>{if(SB.on)sbFrame(.066)},66)');
  const teste=async plasticidade=>{
    await ev(`Treino.iniciar({segundos:${completo?15:1},repeticoes:${completo?3:1},plasticidade:${plasticidade}})`);
    let passouPausa=false;
    while(await ev('Treino.ativa')){
      if(!passouPausa){
        await ev('setRunning(false)');await sleep(250);const t=await ev('Treino.total');await sleep(300);
        assert.equal(await ev('Treino.total'),t);await ev('setRunning(true)');passouPausa=true;
      }
      await sleep(1000);
    }
    const r=await ev('Treino.relatorio()');
    assert(r.concluido);assert.equal(r.resultados.filter(f=>f.tipo==='teste').length,4);
    assert(r.resultados.filter(f=>f.tipo==='teste').every(f=>f.recompensa_s===0));
    assert(r.resultados.filter(f=>f.tipo==='pareamento').some(f=>f.recompensa_s>.4));
    const ultima=r.resultados.at(-1).memoryR_fim;
    if(plasticidade)assert(ultima>0);else assert.equal(ultima,0);
    console.log(JSON.stringify({plasticidade,memoria:ultima,testes:r.resultados.filter(f=>f.tipo==='teste')}));
    return r;
  };
  const ativa=await teste(true);
  if(completo){
    writeFileSync('docs/medicoes/treino-memoria-sessao.json',JSON.stringify({metodo:'Uma sessão padrão de 96 s cerebrais, três repetições por pista, testes livres de 15 s, Chrome com renderização e olhos compostos. Sem semente controlada e sem replicações: resultado descritivo, não demonstra efeito causal do aprendizado.',ativa,erros},null,2)+'\n');
    await ev("$('#treinoPainel').scrollIntoView({block:'center'})");
    const img=await send('Page.captureScreenshot',{format:'png'});writeFileSync('_treino-completo.png',Buffer.from(img.data,'base64'));
    await ev('Treino.sair()');assert.deepEqual(erros,[]);
  }else{
  await ev('Treino.guardar()');assert(await ev('!!store.get(Treino.chave)'));
  const foto=await ev(`(()=>{sbFrame(.016);$('#treinoPainel').scrollIntoView({block:'center'});return true})()`);
  const img=await send('Page.captureScreenshot',{format:'png'});writeFileSync('_treino-interface.png',Buffer.from(img.data,'base64'));
  await ev('Treino.sair()');await sleep(300);
  await ev('Treino.iniciar({continuar:true,segundos:1,repeticoes:1})');
  await sleep(700);assert(await ev('Treino.sessao&&Treino.config.continuacao&&(memoryR>0||memory>0)'));
  await ev('switchApp("cozinha")');await sleep(300);
  assert(await ev('!Treino.sessao&&APP.id==="cozinha"&&!LAB.freeze'));
  await ev('switchApp("treino")');
  const controle=await teste(false);await ev('Treino.sair()');
  assert.deepEqual(erros,[]);
  writeFileSync('docs/medicoes/treino-memoria-interface.json',JSON.stringify({metodo:'Chrome sem janela com worker real. Protocolo curto (testes de 1 s e uma repetição por pista) para verificar integração; não demonstra aprendizado comportamental. Condições ativa/congelada, pausa, quatro testes sem recompensa, persistência separada, continuação e saída por troca de aplicativo. Figura da interface.',ativa,controle,erros},null,2)+'\n');
  }
  console.log('Treinamento: integração passou.');
}finally{
 clearTimeout(prazo);ws?.close();proc.kill();await sleep(1500);
 const rel=relative(tmp,resolve(perfil));
 if(!rel.startsWith('..')&&!rel.includes('\\')&&rel.startsWith('_treino-'))for(let i=0;i<5;i++){try{rmSync(perfil,{recursive:true,force:true});break;}catch{await sleep(500);}}
}
