// Resume as sondas dirigidas; não usa os números gerais de andar, que incluem teleportes.
import {readFileSync, writeFileSync} from 'node:fs';
const origem = new URL('../docs/medicoes/andar-vs-moscas.json', import.meta.url);
const medidas = JSON.parse(readFileSync(origem, 'utf8')).medidas.filter(m => m.subida);
const rodadas = medidas.map(m => ({rotulo:m.rotulo, data:m.data, versao:m.versao,
  erros:m.erros, olhos_reais:m.fim.visao, objetos:m.subida.resultados.map(r => {
    let t=0, tombada=0, apoiada=0;
    for(let i=1;i<r.amostras.length;i++) {
      const a=r.amostras[i-1], b=r.amostras[i], dt=b.t-a.t;
      if(a.voo || b.voo || dt<=0 || dt>.1) continue;
      t+=dt;
      if(b.costas[2]<0) tombada+=dt;
      if(b.piso>1 && b.costas[2]>.7 && b.apoio>.05 && Math.abs(b.frente[2])<.2) apoiada+=dt;
    }
    const {amostras,...resumo}=r;
    return {...resumo, tempo_fisico_observado_sem_voo_s:+t.toFixed(3),
      fracao_tombada:t?+(tombada/t).toFixed(3):null, ereta_apoiada_sobre_superficie_s:+apoiada.toFixed(3)};
  })}));
const resultado={metodo:'scripts/andar_medida.mjs --fisico --sentidos --segundos 0 --sonda-subida. Três largadas de 12 s cerebrais por rodada, decisões livres, olhos reais, um cérebro entre casos. Queda máxima é diferença entre poses recebidas, sem voo: inclui descida intencional e depende da frequência de amostragem. Tombada = costas apontando para baixo, ponderada pelo tempo físico. Ereta apoiada = superfície >1 mm, costas.z >0,7, |frente.z| <0,2 e apoio >0,05; não equivale a alcançar o cume. Exclui intervalos >100 ms e voos. Rodadas livres não pareadas por semente; comparação exploratória, sem afirmar eliminação das quedas ou equivalência biológica. Dados brutos em andar-vs-moscas.json, campo subida.',rodadas};
writeFileSync(new URL('../docs/medicoes/subida-sandbox.json',import.meta.url),JSON.stringify(resultado,null,2)+'\n');
console.log(JSON.stringify(rodadas.map(r=>({rotulo:r.rotulo,objetos:r.objetos})),null,2));
