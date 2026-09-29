// Cada sessão usa Chrome e perfil próprios; a fila limita os cérebros simultâneos.
import {spawn} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {resolve,relative,join,basename} from 'node:path';
const dormir=ms=>new Promise(r=>setTimeout(r,ms));
export async function executar({raiz,url,config,signal,limiteMs=1200000,guardarMemoria=true,progresso=()=>{}}){
  const tmp=resolve(raiz,'_tmp');mkdirSync(tmp,{recursive:true});
  const chrome=process.env.MOSCA_CHROME||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  if(!chrome)throw Error('Chrome/Edge não encontrado. Defina MOSCA_CHROME com o caminho do executável.');
  const perfil=mkdtempSync(join(tmp,'_lote-'));
  let ws,seq=0,saida='',encerrando=false;const pendentes=new Map(),erros=[];
  const proc=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${perfil}`,
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--enable-unsafe-swiftshader',
    '--no-first-run','--no-default-browser-check','--window-size=1400,1000',url],
    {windowsHide:true,stdio:['ignore','ignore','pipe']});
  let terminou=false,erroProcesso=null;
  proc.on('exit',()=>{terminou=true;});proc.on('error',e=>{erroProcesso=e;terminou=true;});
  proc.stderr.on('data',b=>{saida=(saida+b.toString()).slice(-3000);});
  const inicio=Date.now();
  const conferir=()=>{if(signal?.aborted)throw Error('Sessão cancelada');if(Date.now()-inicio>limiteMs)throw Error('Tempo máximo da sessão excedido');if(terminou)throw Error(erroProcesso?.message||'Chrome encerrou: '+saida);};
  const rejeitar=e=>{for(const p of pendentes.values()){clearTimeout(p.timer);p.reject(e);}pendentes.clear();};
  const abortar=()=>{rejeitar(Error('Sessão cancelada'));ws?.close();};signal?.addEventListener('abort',abortar);
  const limite=setTimeout(()=>{rejeitar(Error('Tempo máximo da sessão excedido'));ws?.close();proc.kill();},limiteMs);
  try{
    let porta;
    while(!porta){
      conferir();try{porta=+readFileSync(join(perfil,'DevToolsActivePort'),'utf8').split('\n')[0];}catch{}
      if(Date.now()-inicio>60000)throw Error('Chrome não abriu o controle de teste: '+saida);
      if(!porta)await dormir(300);
    }
    let alvo;
    while(!alvo){conferir();try{alvo=(await(await fetch(`http://127.0.0.1:${porta}/json`,{signal:AbortSignal.timeout(3000)})).json()).find(p=>p.type==='page'&&p.url.startsWith(url.split('?')[0]));}catch{}if(!alvo)await dormir(200);}
    ws=new WebSocket(alvo.webSocketDebuggerUrl);
    await new Promise((ok,fail)=>{const t=setTimeout(()=>fail(Error('Sem conexão com Chrome')),10000);ws.onopen=()=>{clearTimeout(t);ok();};ws.onerror=()=>{clearTimeout(t);fail(Error('Falha de conexão com Chrome'));};});
    ws.onclose=()=>{if(!encerrando)rejeitar(Error('Conexão com Chrome encerrada'));};
    ws.onmessage=e=>{
      const m=JSON.parse(e.data);
      if(m.method==='Runtime.exceptionThrown')erros.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
      const p=pendentes.get(m.id);if(p){pendentes.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
    };
    const enviar=(method,params={})=>new Promise((resolve,reject)=>{
      conferir();const id=++seq;
      const timer=setTimeout(()=>{pendentes.delete(id);reject(Error('Sem resposta de '+method));},60000);
      pendentes.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
    });
    const avaliar=async expression=>{
      const r=await enviar('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
      return r.result.value;
    };
    await enviar('Runtime.enable');const versao=await enviar('Browser.getVersion');
    while(!await avaliar('typeof brainReady!=="undefined"&&brainReady')){
      if(erros.length)throw Error(erros[0]);
      const falha=await avaliar('document.querySelector("#loader.err")?.textContent||null');
      if(falha)throw Error(falha);await dormir(400);conferir();
    }
    await avaliar(`Treino.iniciar(${JSON.stringify({...config,manual:true})})`);
    if(!await avaliar('Treino.ativa'))throw Error(await avaliar('document.querySelector("#treinoStatus").textContent'));
    await avaliar('animCarregar()');await avaliar('olhoCarregar()');
    while(!await avaliar('!!OLHO.rf&&!!ANIM.poses')){
      if(Date.now()-inicio>120000)throw Error('Malha/olhos não carregaram');await dormir(200);conferir();
    }
    let p;
    do {
      conferir();if(erros.length)throw Error(erros[0]);
      p=await avaliar('Treino.avancar(50)');await progresso({...p,pid:proc.pid,tempoRealS:(Date.now()-inicio)/1000});
    }while(p.ativa);
    const relatorio=await avaliar('Treino.relatorio()');
    const memoria=guardarMemoria?await avaliar('(async()=>Treino.codificar(await Treino.memoria()))()'):null;
    if(erros.length)throw Error(erros[0]);
    return {relatorio,memoria,ambiente:{node:process.version,plataforma:process.platform,navegador:versao},
      tempoRealS:(Date.now()-inicio)/1000,erros};
  }finally{
    encerrando=true;clearTimeout(limite);signal?.removeEventListener('abort',abortar);rejeitar(Error('Sessão encerrada'));
    if(ws?.readyState===1){try{ws.send(JSON.stringify({id:++seq,method:'Browser.close'}));}catch{}}
    await dormir(300);ws?.close();if(!terminou)proc.kill();
    for(let i=0;i<15&&!terminou;i++)await dormir(200);
    // Remove somente o perfil temporário criado nesta chamada, nunca arquivos de resultados ou do usuário.
    const rel=relative(tmp,resolve(perfil));
    if(rel&&!rel.startsWith('..')&&!rel.includes('/')&&!rel.includes('\\')&&basename(perfil).startsWith('_lote-')){
      for(let i=0;i<5;i++){try{rmSync(perfil,{recursive:true,force:true});break;}catch{await dormir(300);}}
    }
  }
}
