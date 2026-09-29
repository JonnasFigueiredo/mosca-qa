// Mesmo cérebro, mesmos estímulos e semente: o relógio em dupla deve conservar cada disparo.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const codigo=readFileSync('web/sim-worker.js','utf8');
let receptor=()=>{};
const ctx=vm.createContext({console,performance,setTimeout,clearTimeout,MessageChannel,
  postMessage:m=>receptor(m),fetch:async url=>{
    const b=readFileSync('web/'+url.replace(/\?.*$/,''));let lido=false;
    return {ok:true,headers:{get:()=>String(b.length)},json:async()=>JSON.parse(b),
      body:{getReader:()=>({read:async()=>lido?{done:true}:(lido=true,{done:false,value:new Uint8Array(b)})})}};
  }});
vm.runInContext(codigo,ctx);
const envia=data=>ctx.onmessage({data});
await new Promise((ok,fail)=>{receptor=m=>{if(m.type==='ready')ok();if(m.type==='error')fail(Error(m.message));};envia({type:'load'});});
await new Promise(r=>setTimeout(r,0));
const resultados=[];
for(const [condicao,rates] of Object.entries({repouso:{},contato:{tato_lf:20,tato_rf:20},visao:{olho_L:100},acucar:{doce:160}})){
  const modos=[];
  for(const manual of [false,true]){
    envia({type:'reset'});envia({type:'rates',rates});
    vm.runInContext('{let s=28;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}}',ctx);
    const hash=createHash('sha256'),somas={};let blocos=0;
    receptor=m=>{
      if(m.type!=='tick')return;
      blocos++;hash.update(JSON.stringify([m.t,m.counts,Array.from(m.spikes),m.memory,m.memoryR]));
      for(const [k,v] of Object.entries(m.counts))somas[k]=(somas[k]||0)+v;
      if(blocos===100)envia({type:'run',on:false});
    };
    if(manual)for(let i=0;i<100;i++)envia({type:'passoDuplo',passo:i});
    else{envia({type:'run',on:true});while(blocos<100)await new Promise(r=>setTimeout(r,10));}
    await new Promise(r=>setTimeout(r,20));
    modos.push({modo:manual?'barreira':'automatico',blocos,hash:hash.digest('hex'),somas});
  }
  if(modos[0].hash!==modos[1].hash)throw Error('Disparos diferentes: '+condicao);
  resultados.push({condicao,rates,modos});console.log(condicao+': 100 blocos idênticos');
}
writeFileSync('docs/medicoes/colonia-cerebro.json',JSON.stringify({metodo:'Worker real em VM Node, semente 28 reiniciada, 1 s por condição e modo. Comparação exata de tempo, contagens, IDs de disparos e memória. Estímulos constantes: repouso, tato anterior bilateral 20 Hz, visão esquerda 100 Hz e açúcar 160 Hz. Não é evidência de sociabilidade; só triagem das entradas e equivalência dos relógios.',worker_sha256:createHash('sha256').update(codigo).digest('hex'),resultados},null,2)+'\n');
process.exit(0);
