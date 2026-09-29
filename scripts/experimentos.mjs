// Gerenciador local de campanhas. Uso: node scripts/experimentos.mjs [--porta 8770] [--raiz caminho]
import http from 'node:http';
import {createReadStream,existsSync,mkdirSync,readFileSync,writeFileSync,appendFileSync,renameSync,readdirSync,statSync,statfsSync,copyFileSync,unlinkSync} from 'node:fs';
import {resolve,join,relative,extname,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {freemem,totalmem,cpus} from 'node:os';
import {gzipSync} from 'node:zlib';
import {fork} from 'node:child_process';
import {validar,trabalhos,medir,resumir,csv,hash} from './experimentos/core.mjs';

const projeto=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1];};
const porta=+arg('--porta','8770'),raiz=resolve(arg('--raiz',join(projeto,'docs/medicoes/lotes')));
if(!Number.isInteger(porta)||porta<1024||porta>65535)throw Error('Porta inválida');
const dentro=(base,p)=>{const r=relative(base,resolve(p));return r&&!r.startsWith('..')&&!resolve(p).startsWith('\\\\');};
if(!dentro(projeto,raiz))throw Error('A pasta de resultados precisa ficar dentro do projeto');
mkdirSync(raiz,{recursive:true});
const lock=join(raiz,'_gerenciador.lock'),token=randomUUID(),lotes=new Map(),ativos=new Map();
const gravar=(p,d)=>{const tmp=join(dirname(p),'_'+randomUUID()+'.tmp');writeFileSync(tmp,typeof d==='string'||Buffer.isBuffer(d)?d:JSON.stringify(d,null,2)+'\n');renameSync(tmp,p);};
if(existsSync(lock)){
  const antigo=JSON.parse(readFileSync(lock));let vivo=true;
  try{process.kill(antigo.pid,0);}catch(e){if(e.code==='ESRCH')vivo=false;}
  if(vivo)throw Error(`Já há um gerenciador nesta pasta (PID ${antigo.pid}, porta ${antigo.porta}).`);
  unlinkSync(lock); // só a trava deste gerenciador, após comprovar que o processo não existe
}
writeFileSync(lock,JSON.stringify({pid:process.pid,porta}),{flag:'wx'});
const arquivo=(l,n)=>join(raiz,l.id,n);
const registrar=(l,tipo,dados={})=>{
  const evento={data:new Date().toISOString(),tipo,...dados};
  appendFileSync(arquivo(l,'eventos.ndjson'),JSON.stringify(evento)+'\n');
  l.eventos=(l.eventos||[]).concat(evento).slice(-100);
};
function salvar(l){
  l.atualizado=new Date().toISOString();gravar(arquivo(l,'estado.json'),l);
  gravar(arquivo(l,'resumo.json'),resumir(l.jobs));gravar(arquivo(l,'resultados.csv'),csv(l.jobs));
}
for(const pasta of readdirSync(raiz,{withFileTypes:true}).filter(d=>d.isDirectory())){
  const p=join(raiz,pasta.name,'estado.json');if(!existsSync(p))continue;
  try{
    const l=JSON.parse(readFileSync(p));if(l.id!==pasta.name)continue;
    for(const j of l.jobs)if(j.status==='rodando'){
      const r=arquivo(l,`resultados/${j.id}.json`);
      if(existsSync(r)){
        const dado=JSON.parse(readFileSync(r));j.metricas=medir(dado.relatorio,j.alvo);j.tempoRealS=dado.tempoRealS;j.status='concluida';
      }else{j.status='pendente';registrar(l,'interrupcao',{job:j.id,mensagem:'Sessão incompleta será refeita do início; não é retomada do estado neural.'});}
    }
    // Após queda/reinício, exigir Retomar para não consumir recursos sem o usuário ver o estado.
    if(l.status==='rodando')l.status='pausado';lotes.set(l.id,l);salvar(l);
  }catch(e){console.error('Não carregou '+p+': '+e.message);}
}
const hashArquivo=async p=>{const h=createHash('sha256');for await(const b of createReadStream(p))h.update(b);return h.digest('hex');};
async function arquivos(base,prefixo=''){
  let lista=[];for(const d of readdirSync(join(base,prefixo),{withFileTypes:true})){
    const r=join(prefixo,d.name);if(d.isDirectory())lista.push(...await arquivos(base,r));else if(d.isFile())lista.push(r);
  }return lista.sort();
}
async function criar(raw){
  const config=validar(raw),id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,6);
  const dir=join(raiz,id),snapshot=join(projeto,'data/experimentos',id,'web');
  mkdirSync(join(dir,'resultados'),{recursive:true});mkdirSync(join(dir,'memorias'),{recursive:true});mkdirSync(snapshot,{recursive:true});
  const fontes={};
  for(const r of await arquivos(join(projeto,'web'))){
    const dest=join(snapshot,r);mkdirSync(dirname(dest),{recursive:true});copyFileSync(join(projeto,'web',r),dest);
    fontes[r.replaceAll('\\','/')]=await hashArquivo(dest);
  }
  const executor=join(dirname(snapshot),'executor');mkdirSync(executor,{recursive:true});
  const ferramentas={};
  for(const nome of ['navegador.mjs','core.mjs','sessao.mjs']){
    const dest=join(executor,nome);copyFileSync(join(projeto,'scripts/experimentos',nome),dest);
    ferramentas[nome]=await hashArquivo(dest);
  }
  const manifesto={versao:1,id,config,criado:new Date().toISOString(),snapshot,arquivos:fontes,hash:hash(fontes),
    executor,ferramentas,
    maquina:{node:process.version,cpu:cpus()[0]?.model,memoriaGB:totalmem()/1024**3},
    metodo:'Sessões independentes em navegador, worker real e olhos compostos em cadência fixa de 100 ms cerebrais. Sementes separadas para corpo, cérebro e mundo. A/B e plasticidade ativa/congelada cruzados em cada semente e variante. Cada sessão começa sem memória; resultados e memória final são separados. Interrupção refaz apenas a sessão incompleta. Fonte e dados congelados localmente; Three.js ainda vem do CDN declarado na página.'};
  gravar(join(dir,'manifesto.json'),manifesto);
  const l={id,nome:config.nome,config,status:'pausado',criado:manifesto.criado,hash:manifesto.hash,jobs:trabalhos(config),eventos:[]};
  registrar(l,'criado',{sessoes:l.jobs.length});lotes.set(id,l);salvar(l);return l;
}
let escalonando=false,encerrando=false,aviso=null;
const gb=()=>freemem()/1024**3;
function executarIsolado(man,opcoes,signal,progresso){
  return new Promise((resolve,reject)=>{
    const proc=fork(join(man.executor,'sessao.mjs'),[],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced'});
    let erro='',terminado=false,erroSalvar=null;
    proc.stderr.on('data',b=>{erro=(erro+b).slice(-2000);});
    const cancelar=()=>{if(proc.connected)proc.send({tipo:'cancelar'},()=>{});};
    signal.addEventListener('abort',cancelar);
    proc.on('error',reject);
    proc.on('message',m=>{
      if(m.tipo==='progresso'){try{progresso(m.p);}catch(e){erroSalvar=e;cancelar();}return;}
      if(m.tipo==='resultado'){terminado=true;erroSalvar?reject(erroSalvar):resolve(m.resultado);}
      if(m.tipo==='erro'){terminado=true;reject(erroSalvar||Error(m.erro));}
    });
    proc.on('exit',()=>{signal.removeEventListener('abort',cancelar);if(!terminado)reject(Error('Executor encerrou sem resultado: '+erro));});
    proc.send({tipo:'iniciar',opcoes});if(signal.aborted)cancelar();
  });
}
function espaco(){const s=statfsSync(raiz);return Number(s.bavail)*Number(s.bsize)/1024**3;}
async function rodar(l,j){
  const chave=l.id+'/'+j.id,ctrl=new AbortController();ativos.set(chave,{ctrl,job:j.id,lote:l.id});
  j.status='rodando';j.tentativas++;j.inicio=new Date().toISOString();j.erro=null;j.progresso=null;
  try{
    registrar(l,'iniciou',{job:j.id,tentativa:j.tentativas});salvar(l);
    const man=JSON.parse(readFileSync(arquivo(l,'manifesto.json')));
    for(const [p,h] of Object.entries(man.arquivos))if(await hashArquivo(join(man.snapshot,p))!==h)throw Error('A cópia congelada foi alterada: '+p);
    for(const [p,h] of Object.entries(man.ferramentas||{}))if(await hashArquivo(join(man.executor,p))!==h)throw Error('O executor congelado foi alterado: '+p);
    let ultimo=0;
    const opcoes={raiz:projeto,url:`http://127.0.0.1:${porta}/sim/${l.id}/index.html?headless=1&lote=1`,
      config:j.config,limiteMs:l.config.limiteMinutos*60000,guardarMemoria:l.config.guardarMemoria};
    const progresso=p=>{j.progresso=p;if(Date.now()-ultimo>2000){ultimo=Date.now();salvar(l);}};
    const r=man.ferramentas?.['sessao.mjs']?await executarIsolado(man,opcoes,ctrl.signal,progresso):
      await (await import(pathToFileURL(join(man.executor||join(projeto,'scripts/experimentos'),'navegador.mjs')).href)).executar({...opcoes,signal:ctrl.signal,progresso});
    const metricas=medir(r.relatorio,j.alvo);
    if(j.condicao==='congelada'&&Math.abs(metricas.memoriaFinal||0)>1e-9)throw Error('Controle congelado alterou os pesos');
    if(r.memoria)gravar(arquivo(l,`memorias/${j.id}.json.gz`),gzipSync(JSON.stringify(r.memoria)));
    const resultado={...r,memoria:undefined,id:j.id,lote:l.id,config:j.config,hashFonte:l.hash,metricas};
    gravar(arquivo(l,`resultados/${j.id}.json`),resultado);
    j.metricas=metricas;j.tempoRealS=r.tempoRealS;j.status='concluida';j.fim=new Date().toISOString();
    registrar(l,'concluiu',{job:j.id});
  }catch(e){
    j.erro=String(e.message||e);j.fim=new Date().toISOString();
    if(l.status==='cancelado')j.status='cancelada';
    else if(encerrando)j.status='pendente';
    else j.status=j.tentativas<l.config.tentativas?'pendente':'falhou';
    registrar(l,'falhou',{job:j.id,mensagem:j.erro});
  }finally{
    ativos.delete(chave);
    if(!l.jobs.some(x=>x.status==='pendente'||x.status==='rodando')&&l.status!=='cancelado')l.status=l.jobs.some(x=>x.status==='falhou')?'finalizado-com-falhas':'concluido';
    salvar(l);
  }
}
async function fila(){
  if(escalonando||encerrando)return;escalonando=true;
  try{
    aviso=null;
    if(espaco()<1){aviso='Menos de 1 GB livre no disco dos resultados. Novas sessões aguardam.';return;}
    for(const l of lotes.values()){
      if(l.status!=='rodando')continue;
      while(ativos.size<2&&[...ativos.values()].filter(a=>a.lote===l.id).length<l.config.paralelas){
        // Reservar 2 GB por navegador ainda carregando evita abrir dois antes de a RAM refletir a primeira carga.
        const reserva=[...ativos.values()].filter(a=>!lotes.get(a.lote)?.jobs.find(j=>j.id===a.job)?.progresso).length*2;
        if(gb()-reserva<l.config.memoriaMinGB){aviso=`Aguardando RAM: ${gb().toFixed(1)} GB livres, ${reserva} GB reservados em cargas; mínimo ${l.config.memoriaMinGB} GB para abrir outra sessão.`;break;}
        const j=l.jobs.find(j=>j.status==='pendente');if(!j)break;
        void rodar(l,j).catch(e=>{aviso='Falha ao salvar: '+e.message;l.status='pausado';console.error(e);});
      }
    }
  }catch(e){aviso=e.message;console.error(e);}finally{escalonando=false;}
}
const iv=setInterval(fila,1000);
const publico=l=>({...l,resumo:resumir(l.jobs)});
function json(res,status,d){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(d));}
function servir(res,p){
  if(!existsSync(p)||!statSync(p).isFile()){res.writeHead(404);res.end('Arquivo não encontrado');return;}
  const tipos={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.txt':'text/plain','.csv':'text/csv; charset=utf-8','.png':'image/png','.gz':'application/gzip'};
  res.writeHead(200,{'Content-Type':tipos[extname(p)]||'application/octet-stream','Content-Length':statSync(p).size,'Cache-Control':'no-store'});
  createReadStream(p).on('error',()=>res.destroy()).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  try{
    if(![`127.0.0.1:${porta}`,`localhost:${porta}`].includes(req.headers.host)){json(res,403,{erro:'Host não permitido'});return;}
    const url=new URL(req.url,`http://127.0.0.1:${porta}`),p=url.pathname;
    if(req.method==='GET'){
      if(p==='/')return servir(res,join(projeto,'web/experimentos.html'));
      if(p==='/api/estado')return json(res,200,{token,porta,raiz,memoriaLivreGB:gb(),espacoLivreGB:espaco(),ativos:ativos.size,aviso,
        lotes:[...lotes.values()].map(l=>({id:l.id,nome:l.nome,status:l.status,criado:l.criado,total:l.jobs.length,
          hash:l.hash,comparacoes:resumir(l.jobs).pares,
          concluidas:l.jobs.filter(j=>j.status==='concluida').length,falhas:l.jobs.filter(j=>j.status==='falhou').length}))});
      const m=p.match(/^\/api\/lotes\/([a-zA-Z0-9-]+)$/);
      if(m){const l=lotes.get(m[1]);return json(res,l?200:404,l?publico(l):{erro:'Lote não encontrado'});}
      const s=p.match(/^\/sim\/([a-zA-Z0-9-]+)\/(.+)$/);
      if(s&&lotes.has(s[1])){
        const man=JSON.parse(readFileSync(arquivo(lotes.get(s[1]),'manifesto.json'))),rel=decodeURIComponent(s[2]),dest=resolve(man.snapshot,rel);
        if(!dentro(man.snapshot,dest)||!Object.hasOwn(man.arquivos,rel))return json(res,404,{erro:'Arquivo fora do manifesto'});
        return servir(res,dest);
      }
      const d=p.match(/^\/arquivos\/([a-zA-Z0-9-]+)\/(manifesto\.json|resumo\.json|resultados\.csv|eventos\.ndjson|resultados\/[a-f0-9]{16}\.json|memorias\/[a-f0-9]{16}\.json\.gz)$/);
      if(d&&lotes.has(d[1]))return servir(res,arquivo(lotes.get(d[1]),d[2]));
      return json(res,404,{erro:'Rota não encontrada'});
    }
    if(req.method!=='POST')return json(res,405,{erro:'Método não permitido'});
    if(req.headers['x-mosca-token']!==token)return json(res,403,{erro:'Recarregue o painel para autorizar a operação local'});
    if(req.headers.origin&&!['http://127.0.0.1:'+porta,'http://localhost:'+porta].includes(req.headers.origin))return json(res,403,{erro:'Origem não permitida'});
    let corpo='';for await(const b of req){corpo+=b;if(corpo.length>65536)throw Error('Configuração muito grande');}
    const data=JSON.parse(corpo||'{}');
    if(p==='/api/lotes')return json(res,201,publico(await criar(data)));
    const m=p.match(/^\/api\/lotes\/([a-zA-Z0-9-]+)\/acao$/),l=m&&lotes.get(m[1]);
    if(!l)return json(res,404,{erro:'Lote não encontrado'});
    if(data.acao==='retomar'){
      if(!l.jobs.some(j=>j.status==='pendente'))throw Error('Não há sessões pendentes; use Repetir falhas ou crie outro lote');
      l.status='rodando';
    }else if(data.acao==='pausar')l.status='pausado';
    else if(data.acao==='cancelar'){
      l.status='cancelado';for(const j of l.jobs)if(j.status==='pendente')j.status='cancelada';
      for(const a of ativos.values())if(a.lote===l.id)a.ctrl.abort();
    }else if(data.acao==='repetir-falhas'){
      if([...ativos.values()].some(a=>a.lote===l.id))throw Error('Aguarde as sessões ativas terminarem');
      for(const j of l.jobs)if(j.status==='falhou'||j.status==='cancelada'){j.status='pendente';j.tentativas=0;}
      l.status='pausado';
    }else throw Error('Ação desconhecida');
    registrar(l,data.acao);salvar(l);json(res,200,publico(l));
  }catch(e){if(!res.headersSent)json(res,400,{erro:e.message});else res.destroy();}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`A porta ${porta} já está ocupada; abra o gerenciador existente.`:e);clearInterval(iv);try{unlinkSync(lock);}catch{}process.exitCode=1;});
server.listen(porta,'127.0.0.1',()=>console.log(`Experimentos: http://127.0.0.1:${porta}\nResultados: ${raiz}\nLotes recuperados ficam pausados. Pausar termina as sessões ativas; Cancelar interrompe.`));
async function sair(){
  if(encerrando)return;encerrando=true;clearInterval(iv);
  for(const l of lotes.values())if(l.status==='rodando'){l.status='pausado';salvar(l);}
  for(const a of ativos.values())a.ctrl.abort();
  while(ativos.size)await new Promise(r=>setTimeout(r,200));
  server.close();try{unlinkSync(lock);}catch{}process.exit(0);
}
process.on('SIGINT',sair);process.on('SIGTERM',sair);
