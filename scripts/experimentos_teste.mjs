// Integração da fila com Chrome e o cérebro real; dados temporários ficam no projeto.
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {validar,trabalhos,medir,resumir} from './experimentos/core.mjs';
const paralelo=process.argv.includes('--paralelo'),completo=process.argv.includes('--completo');
const base=validar({sementes:[19],variantes:[{nome:completo?'padrao':'curto',segundos:completo?15:1,repeticoes:completo?3:1}],paralelas:paralelo?2:1,memoriaMinGB:2,limiteMinutos:5,tentativas:1});
assert.equal(trabalhos(base).length,4);
assert.throws(()=>validar({...base,sementes:[1,1]}));assert.throws(()=>validar({...base,paralelas:3}));
assert.throws(()=>validar({...base,variantes:[{nome:'x',segundos:NaN}]}));
const fase={tipo:'teste',tempoA:1,tempoB:0,fora:0,duracao:1,recompensa_s:0,memoryR_fim:0};
const rel={concluido:true,resultados:Array.from({length:4},()=>({...fase}))};
assert.deepEqual(medir(rel,'B').preferencias,[-1,-1,-1,1]);
assert.throws(()=>medir({...rel,resultados:[{...fase,recompensa_s:1},...rel.resultados.slice(1)]},'A'));
const sem=medir({...rel,resultados:rel.resultados.map(f=>({...f,tempoA:0,fora:1}))},'A');assert.equal(sem.ganho,null);
const js=trabalhos(validar({...base,sementes:[1,2,3,4,5]}));
for(const j of js){j.status='concluida';j.metricas={...medir(rel,'A'),ganho:j.condicao==='ativa'?.5:0};}
assert.equal(resumir(js).pares[0].diferencaMedia,.5);assert.deepEqual(resumir(js).pares[0].intervalo95,[.5,.5]);
js[0].metricas.ganho=null;assert.equal(resumir(js).pares[0].sementesCompletas,4);
console.log('Configuração, contrabalanço, ausências e análise pareada: passaram.');
if(process.argv.includes('--unitario'))process.exit(0);
const raiz=resolve('_tmp/_campanha-teste-'+Date.now());mkdirSync(raiz,{recursive:true});
const porta=8771,url='http://127.0.0.1:'+porta,dormir=ms=>new Promise(r=>setTimeout(r,ms));
let proc,token,logs='',maxAtivos=0;
function iniciar(){proc=spawn(process.execPath,['scripts/experimentos.mjs','--porta',String(porta),'--raiz',raiz],{windowsHide:true,stdio:['ignore','pipe','pipe']});proc.stdout.on('data',b=>{logs+=b;});proc.stderr.on('data',b=>{logs+=b;});}
async function esperar(){for(let i=0;i<40;i++){try{const d=await api('/api/estado');token=d.token;return;}catch{}await dormir(250);}throw Error('Gerenciador não abriu: '+logs);}
async function api(p,d){const r=await fetch(url+p,d===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-mosca-token':token},body:JSON.stringify(d)});const j=await r.json();if(!r.ok)throw Error(j.erro);return j;}
async function parar(){proc.kill();await new Promise(r=>{if(proc.exitCode!==null)r();else proc.once('exit',r);});await dormir(500);}
const registro={metodo:'Teste de infraestrutura: uma semente cruzada A/B e ativa/congelada; não mede eficácia. Chrome real com relógio cerebral manual e olhos compostos. Verifica resultados, controles, persistência, pausa, queda do gerenciador, retomada e repetição determinística. Configuração registrada abaixo.',config:base,raiz};
async function aguardar(fn,ms=600000){const fim=Date.now()+ms;while(Date.now()<fim){const r=await fn();if(r)return r;await dormir(500);}throw Error('Espera excedida');}
try{
 iniciar();await esperar();
 assert.equal((await fetch(url+'/api/lotes',{method:'POST',body:'{}'})).status,403);
 const lote=await api('/api/lotes',{...base,nome:'Verificação automática'});assert.equal(lote.status,'pausado');
 const man=await(await fetch(url+'/arquivos/'+lote.id+'/manifesto.json')).json();assert(man.arquivos['sim-worker.js']);
 await api('/api/lotes/'+lote.id+'/acao',{acao:'retomar'});
 const inicio=Date.now();let estado;
 do{await dormir(1500);estado=await api('/api/lotes/'+lote.id);const geral=await api('/api/estado');maxAtivos=Math.max(maxAtivos,geral.ativos);console.log(JSON.stringify({estado:estado.status,concluidas:estado.jobs.filter(j=>j.status==='concluida').length,progresso:estado.jobs.find(j=>j.status==='rodando')?.progresso,aviso:geral.aviso}));if(Date.now()-inicio>600000)throw Error('Teste excedeu 10 minutos');}while(estado.status==='rodando');
 assert.equal(estado.status,'concluido',JSON.stringify(estado.jobs.map(j=>j.erro)));
 assert.equal(maxAtivos,base.paralelas);assert(estado.jobs.filter(j=>j.condicao==='congelada').every(j=>j.metricas.memoriaFinal===0));
 registro.jobs=estado.jobs;registro.hash=man.hash;registro.maxAtivos=maxAtivos;
 await parar();iniciar();await esperar();assert.deepEqual((await api('/api/lotes/'+lote.id)).jobs,estado.jobs);
 const copia=await api('/api/lotes',{...base,nome:'Repetição de semente'});
 await api('/api/lotes/'+copia.id+'/acao',{acao:'retomar'});
 await aguardar(async()=>{const l=await api('/api/lotes/'+copia.id);return l.jobs.some(j=>j.progresso)&&l;});
 await api('/api/lotes/'+copia.id+'/acao',{acao:'pausar'});
 const pausada=await aguardar(async()=>{const l=await api('/api/lotes/'+copia.id);return !l.jobs.some(j=>j.status==='rodando')&&l;});
 assert.equal(pausada.status,'pausado');assert(pausada.jobs.some(j=>j.status==='pendente'));
 registro.pausaPreservouAtivas=true;
 await api('/api/lotes/'+copia.id+'/acao',{acao:'retomar'});
 const interrompida=await aguardar(async()=>{const l=await api('/api/lotes/'+copia.id);return l.jobs.some(j=>j.status==='rodando'&&j.progresso)&&l;});
 const pids=interrompida.jobs.filter(j=>j.status==='rodando'&&j.progresso).map(j=>j.progresso.pid);
 await parar();
 await aguardar(()=>pids.every(pid=>{try{process.kill(pid,0);return false;}catch(e){return e.code==='ESRCH';}}),15000);
 iniciar();await esperar();const recuperada=await api('/api/lotes/'+copia.id);
 assert.equal(recuperada.status,'pausado');assert.equal(recuperada.jobs.filter(j=>j.status==='concluida').length,pausada.jobs.filter(j=>j.status==='concluida').length);
 registro.quedaFechouChrome=true;registro.retomadaPreservouConcluidas=true;
 await api('/api/lotes/'+copia.id+'/acao',{acao:'retomar'});
 const repetida=await aguardar(async()=>{const l=await api('/api/lotes/'+copia.id);return l.status!=='rodando'&&l;});
 assert.equal(repetida.status,'concluido',JSON.stringify(repetida.jobs.map(j=>j.erro)));
 await api('/api/lotes/'+copia.id+'/acao',{acao:'cancelar'});
 for(const j of repetida.jobs){
 const r1=JSON.parse(readFileSync(resolve(raiz,lote.id,'resultados',j.id+'.json'))),r2=JSON.parse(readFileSync(resolve(raiz,copia.id,'resultados',j.id+'.json')));
 assert.deepEqual(r1.relatorio.resultados,r2.relatorio.resultados);assert.deepEqual(r1.relatorio.historico,r2.relatorio.historico);
 }
 registro.repeticaoExata=true;registro.data=new Date().toISOString();
 writeFileSync('docs/medicoes/experimentos-'+(completo?'completo':paralelo?'paralelo':'integracao')+'.json',JSON.stringify(registro,null,2)+'\n');
 console.log('Campanhas: integração passou; repetição com mesma semente idêntica.');
}finally{if(proc?.exitCode===null)await parar();}
