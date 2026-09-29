// Configuração e análise de experimentos; nenhum resultado é tratado como prova automática de aprendizado.
import {createHash} from 'node:crypto';
export const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const numero=(v,min,max,nome,inteiro=false)=>{
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(inteiro&&!Number.isInteger(v)))throw Error(`${nome}: esperado ${min} a ${max}`);
  return v;
};
export function validar(c){
  if(!c||typeof c!=='object')throw Error('Configuração ausente');
  const nome=String(c.nome||'Experimento de memória').slice(0,100);
  const sementes=c.sementes||[11,22,33];
  if(!Array.isArray(sementes)||!sementes.length||sementes.length>100)throw Error('Use de 1 a 100 sementes');
  sementes.forEach(s=>numero(s,0,4294967295,'semente',true));
  if(new Set(sementes).size!==sementes.length)throw Error('Sementes repetidas');
  const variantes=c.variantes||[{nome:'padrao',repeticoes:3,segundos:15}];
  if(!Array.isArray(variantes)||!variantes.length||variantes.length>12)throw Error('Use de 1 a 12 variantes');
  const normalizadas=variantes.map(v=>{
    if(!/^[a-z0-9_-]{1,32}$/.test(v.nome||''))throw Error('Nome de variante: letras minúsculas, números, hífen ou sublinhado');
    return {nome:v.nome,repeticoes:numero(v.repeticoes??3,1,10,'repetições',true),
      segundos:numero(v.segundos??15,.1,120,'segundos'),odorHz:numero(v.odorHz??100,10,150,'odorHz'),
      recompensaHz:numero(v.recompensaHz??100,10,150,'recompensaHz'),tauF:numero(v.tauF??90000,10000,600000,'tauF'),
      retencao:numero(v.retencao??0,0,600,'retencao')};
  });
  if(new Set(normalizadas.map(v=>v.nome)).size!==normalizadas.length)throw Error('Nomes de variantes repetidos');
  if(normalizadas.length*sementes.length*4>1200)throw Error('Limite de 1200 sessões por lote');
  return {nome,sementes:[...sementes],variantes:normalizadas,
    paralelas:numero(c.paralelas??1,1,2,'simultâneas',true),
    limiteMinutos:numero(c.limiteMinutos??20,1,180,'limite por sessão'),
    tentativas:numero(c.tentativas??2,1,3,'tentativas',true),
    memoriaMinGB:numero(c.memoriaMinGB??3,2,16,'memória livre mínima'),
    guardarMemoria:c.guardarMemoria!==false};
}
export function trabalhos(c){
  const jobs=[];
  for(const semente of c.sementes)for(const v of c.variantes)for(const alvo of ['A','B'])for(const condicao of ['ativa','congelada']){
    const config={...v,alvo,plasticidade:condicao==='ativa',manual:true,
      sementes:{cerebro:semente,corpo:(semente^0x91e10da5)>>>0,mundo:(semente^0xa17e1234)>>>0}};
    jobs.push({id:hash([v.nome,semente,alvo,condicao]).slice(0,16),variante:v.nome,semente,alvo,condicao,
      config,status:'pendente',tentativas:0});
  }
  // Ordem determinística embaralhada, sem executar todas as treinadas antes dos controles.
  return jobs.sort((a,b)=>hash('ordem'+a.id).localeCompare(hash('ordem'+b.id)));
}
export function medir(r,alvo){
  if(!r?.concluido||!Array.isArray(r.resultados))throw Error('Sessão incompleta');
  const fases=r.resultados.filter(f=>f.tipo==='teste');
  if(fases.length!==4||fases.some(f=>f.recompensa_s!==0))throw Error('Protocolo inválido: testes ou recompensa');
  const sinais=[1,1,1,-1].map(s=>s*(alvo==='A'?1:-1));
  const preferencias=fases.map((f,i)=>{
    for(const k of ['tempoA','tempoB','fora','duracao'])if(!Number.isFinite(f[k])||f[k]<0)throw Error('Medida não finita ou negativa');
    if(f.duracao===0)throw Error('Teste sem duração');
    if(Math.abs(f.tempoA+f.tempoB+f.fora-f.duracao)>.03)throw Error('Tempos da fase inconsistentes');
    return f.tempoA+f.tempoB>0?sinais[i]*(f.tempoA-f.tempoB)/(f.tempoA+f.tempoB):null;
  });
  return {preferencias,ganho:preferencias[0]!==null&&preferencias[1]!==null?preferencias[1]-preferencias[0]:null,
    primeira:fases.map(f=>f.primeira),semEscolha:fases.map(f=>f.tempoA+f.tempoB===0),
    ocupacao:fases.map(f=>(f.tempoA+f.tempoB)/f.duracao),
    memoriaFinal:r.resultados.at(-1).memoryR_fim};
}
const media=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
function intervalo(a){
  if(a.length<5)return null;
  let s=982451653;const valores=[];
  for(let k=0;k<2000;k++){let soma=0;for(let i=0;i<a.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;soma+=a[Math.floor(s/4294967296*a.length)];}valores.push(soma/a.length);}
  valores.sort((a,b)=>a-b);return [valores[49],valores[1949]];
}
export function resumir(jobs){
  const grupos=[],pares=[];
  for(const variante of [...new Set(jobs.map(j=>j.variante))]){
    for(const condicao of ['ativa','congelada']){
      const todos=jobs.filter(j=>j.variante===variante&&j.condicao===condicao),ok=todos.filter(j=>j.status==='concluida'&&j.metricas);
      grupos.push({variante,condicao,concluidas:ok.length,total:todos.length,
        preferencias:[0,1,2,3].map(i=>media(ok.map(j=>j.metricas.preferencias[i]).filter(v=>v!==null))),
        semEscolha:[0,1,2,3].map(i=>ok.filter(j=>j.metricas.semEscolha[i]).length),
        ganho:media(ok.map(j=>j.metricas.ganho).filter(v=>v!==null)),
        tempoRealMedio:media(ok.map(j=>j.tempoRealS).filter(Number.isFinite))});
    }
    const sementes=[...new Set(jobs.filter(j=>j.variante===variante).map(j=>j.semente))],efeitos=[];
    for(const s of sementes){
      const difs=[];
      for(const alvo of ['A','B']){
        const pega=condicao=>jobs.find(j=>j.variante===variante&&j.semente===s&&j.alvo===alvo&&j.condicao===condicao&&j.status==='concluida');
        const a=pega('ativa')?.metricas?.ganho,b=pega('congelada')?.metricas?.ganho;
        if(a!=null&&b!=null)difs.push(a-b);
      }
      if(difs.length===2)efeitos.push({semente:s,diferenca:media(difs)});
    }
    const a=efeitos.map(e=>e.diferenca);
    pares.push({variante,sementesCompletas:a.length,sementesTotal:sementes.length,diferencaMedia:media(a),
      intervalo95:intervalo(a),efeitos});
  }
  return {metodo:'Ganho = preferência pela pista inicialmente recompensada após treino menos antes. Diferença pareada = ganho ativa menos congelada; média de A/B dentro de cada semente. Intervalo percentil de bootstrap de 2000 reamostragens das sementes, somente com pelo menos 5 sementes completas. Sessões sem visita a pistas têm preferência indefinida e ficam fora da estimativa: consultar ausências, falhas e cobertura. Comparações exploratórias entre variantes não corrigidas para multiplicidade; não provam utilidade em QA.',grupos,pares};
}
export function csv(jobs){
  const cab=['id','variante','semente','alvo','condicao','status','tentativas','tempoRealS','ganho','antes','depois','troca','reversao','erro'];
  const esc=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  return [cab,...jobs.map(j=>[j.id,j.variante,j.semente,j.alvo,j.condicao,j.status,j.tentativas,j.tempoRealS,j.metricas?.ganho,...(j.metricas?.preferencias||[null,null,null,null]),j.erro])].map(r=>r.map(esc).join(',')).join('\n')+'\n';
}
