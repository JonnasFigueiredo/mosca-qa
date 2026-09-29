// Triagem do protocolo no worker real, executado em thread Node para preservar o desempenho.
import {readFileSync,writeFileSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import '../web/treino-protocolo.js';
const codigo=readFileSync('web/sim-worker.js','utf8');
const ponte=`
const {parentPort}=require('node:worker_threads');
const {readFileSync}=require('node:fs');
let onmessage;
globalThis.postMessage=m=>parentPort.postMessage(m);
globalThis.fetch=async url=>{
 const b=readFileSync('web/'+url.split('?')[0]);let lido=false;
 return {ok:true,headers:{get:()=>String(b.length)},json:async()=>JSON.parse(b),
 body:{getReader:()=>({read:async()=>lido?{done:true}:(lido=true,{done:false,value:new Uint8Array(b)})})}};
};
`;
const rodape=`
parentPort.on('message',data=>{
 if(data.type==='semente'){let s=data.valor;Math.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
 else onmessage({data});
});`;
const w=new Worker(ponte+codigo+rodape,{eval:true});let receptor=()=>{};
w.on('message',m=>receptor(m));w.on('error',e=>{console.error(e);process.exit(1);});
const envia=data=>w.postMessage(data);
await new Promise((ok,fail)=>{receptor=m=>{if(m.type==='ready')ok();if(m.type==='error')fail(Error(m.message));};envia({type:'load'});});
const resultados=[];
for(const ativa of [true,false]) {
 envia({type:'reset'});envia({type:'params',plasticidade:ativa});
 envia({type:'semente',valor:29});
 let ultimo;receptor=m=>{if(m.type==='tick')ultimo=m;};
 const fases=ProtocoloMemoria.fases({segundos:0,repeticoes:2}).filter(f=>f.tipo!=='teste');
 for(const f of fases) {
   for(let i=0;i<Math.round(f.duracao*100);i++) {
     envia({type:'rates',rates:ProtocoloMemoria.taxas(f,i/100)});
     await new Promise(ok=>{receptor=m=>{if(m.type==='tick'){ultimo=m;ok();}};envia({type:'passoDuplo',passo:i});});
   }
   resultados.push({plasticidade:ativa,fase:f.nome,memory:ultimo.memory,memoryR:ultimo.memoryR});
 }
 console.log(JSON.stringify({plasticidade:ativa,memory:ultimo.memory,memoryR:ultimo.memoryR}));
 if(!ativa&&(ultimo.memory!==0||ultimo.memoryR!==0))throw Error('Controle alterou pesos');
 if(ativa&&!(ultimo.memoryR>0))throw Error('Pareamento não alterou memória');
}
writeFileSync('docs/medicoes/treino-memoria-triagem.json',JSON.stringify({metodo:'Worker real em thread Node, semente 29, duas apresentações de cada pista por treino e reversão. VA2/DM4 versus DP1l/DM2 a 100 Hz bilateral, PAM a 100 Hz nos últimos 500 ms do pareamento de 2 s, intervalos de 1 s. Compara plasticidade ativa e pesos congelados. Não mede escolhas, preferência inata ou generalização.',resultados},null,2)+'\n');
await w.terminate();
