// Um processo por sessão: se o gerenciador cair, o canal fecha e este processo encerra seu Chrome.
import {executar} from './navegador.mjs';
const controle=new AbortController();
process.on('disconnect',()=>controle.abort());
process.on('message',async m=>{
  if(m.tipo==='cancelar'){controle.abort();return;}
  if(m.tipo!=='iniciar')return;
  const enviar=d=>{if(process.connected)process.send(d,()=>{});};
  try{
    const resultado=await executar({...m.opcoes,signal:controle.signal,progresso:p=>enviar({tipo:'progresso',p})});
    enviar({tipo:'resultado',resultado});
  }catch(e){enviar({tipo:'erro',erro:e.message});}
  finally{if(process.connected)process.disconnect();}
});
