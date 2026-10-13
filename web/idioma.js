// Idioma de apresentação: não altera dados nem parâmetros do cérebro.
(() => {
  'use strict';
  const chave = 'mosca-idioma-v1', catalogo = window.MoscaTraducoesEN || {};
  const normalizar = s => s.replace(/\s+/g, ' ').trim();
  let idioma = 'pt';
  try { idioma = localStorage.getItem(chave) === 'en' ? 'en' : 'pt'; } catch { /* Armazenamento opcional. */ }
  const param = new URL(location.href).searchParams.get('lang');
  if (param === 'pt' || param === 'en') idioma = param;
  const originais = new WeakMap(), atributos = new WeakMap();
  const excluir = 'script,style,code,pre,textarea,input,[contenteditable],[data-sem-traducao]';
  const fragmentos = {
    'tempo cerebral':'brain time','de cérebro':'of brain time','o tempo real':'real time','neurônios':'neurons','conexões':'connections',
    'sinapses':'synapses','células de Kenyon ativas':'active Kenyon cells','dopamina':'dopamine','valência':'valence',
    'cheirando':'smelling','provando':'sampling','escolhida':'chosen','escolha':'choice','carrinho':'cart','estoque':'stock',
    'pagamento':'payment','cancelamento':'cancellation','cupom':'coupon','repetida':'repeated','negativa':'negative','limite':'boundary',
    'pagar':'pay','cancelar':'cancel','aproximar':'approach','evitar':'avoid','rede':'network','cálculo':'calculation','formulário':'form',
    'lista':'list','navegação':'navigation','doce':'sweet','amargo':'bitter','fome':'hunger','pista':'cue','Pista':'Cue',
    'Treino':'Training','treino':'training','Teste':'Test','teste':'test','Medir antes':'Measure before','Medir depois':'Measure after',
    'Aquecimento':'Warm-up','medir':'measure','passo':'step','ações':'actions','ação':'action','provas':'samples','prova':'sample',
    'cérebro':'brain','cérebros ativos':'active brains','RAM livre':'free RAM','disco livre':'free disk','falhas':'failures','min de cérebro somados. O tempo real depende da máquina e será medido.':'total minutes of brain time. Wall time depends on the machine and will be measured.','vezes':'times','vez':'time','pausado':'paused','parada':'idle','LIGADA':'ON','nenhum bug':'no bugs','mordidas':'bites','mordida':'bite',
    'voando':'flying','andando':'walking','pousando':'landing','escalando':'climbing','limpando':'grooming','presa':'caught',
    'sem recompensa':'without reward','com recompensa':'with reward','primeiro bug':'first bug','sem aprendizado':'without learning',
    'na Cozinha':'in the Kitchen','A mosca ainda está procurando.':'The fly is still searching.',
    'de tempo cerebral':'of brain time','Primeira mordida aos':'First bite at','Achado aos':'Found at','Cheiro:':'Odor:',
    'bugs encontrados no':'bugs found in','Cérebro montado:':'Brain assembled:','A mosca começou a andar.':'The fly started walking.',
    'Baixando':'Downloading','Montando':'Building','Carregando':'Loading','Pronto para começar':'Ready to start',
    'Recarregue a página para tentar de novo.':'Reload the page to try again.','Não deu para desenhar o cérebro:':'Could not draw the brain:',
    'Sem o cérebro 3D:':'3D brain unavailable:','sessões':'sessions','sessão':'session','sementes':'seeds','semente':'seed',
    'Reversão':'Reversal','Antes do treino':'Before training','Depois do treino':'After training','Lados trocados':'Swapped sides',
    'Teste final':'Final test','Concluído':'Completed','Pausado':'Paused','Preparando':'Preparing','Memória':'Memory',
    'sim':'yes','não':'no','médio':'medium','alto':'high','crítico':'critical'
  };
  // Os nomes isolados também aparecem em mensagens compostas, sem alterar seus IDs.
  for (const k of ['Pedidos','Financeiro','Cozinha','Treinada','Congelada','Notificações','Resumo semanal','Dois fatores','Modo compacto']) fragmentos[k]=catalogo[k];
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for(const [pt,en] of Object.entries(catalogo)) if(pt.length<350) fragmentos[pt]=en;
  const alternativas=Object.keys(fragmentos).sort((a,b)=>b.length-a.length).map(k=>(/^[\p{L}\p{N}_]/u.test(k)?'(?<![\\p{L}\\p{N}_])':'')+escape(k)+(/[\p{L}\p{N}_]$/u.test(k)?'(?![\\p{L}\\p{N}_])':''));
  const re=new RegExp(alternativas.join('|'),'gu');
  function texto(s) {
    s=String(s ?? ''); if(idioma !== 'en') return s;
    const n=normalizar(s), traducao=catalogo[n];
    if(traducao !== undefined) return s.match(/^\s*/)[0]+traducao+s.match(/\s*$/)[0];
    const padroes=[
      [/^Página (\d+) de (\d+)$/,(_,a,b)=>`Page ${a} of ${b}`],
      [/^de (\d+) bugs encontrados no (.+)\. (.*)$/,(_,n,app,fim)=>`${n} total bugs in ${texto(app)}. ${texto(fim)}`],
      [/^Pedido #(\d+) cancelado\.$/,(_,n)=>`Order #${n} canceled.`],
      [/^Achou o bug em (\d+) ações\. No teste não há recompensa\.$/,(_,n)=>`Found the bug in ${n} actions. No reward during testing.`],
      [/^Escolheu "(.+)" \(chance (\d+)%\): nenhum contrato violado\.$/,(_,a,n)=>`Chose "${texto(a)}" (${n}% chance): no contract violated.`]
    ];
    for(const [r,f] of padroes)if(r.test(n))return s.match(/^\s*/)[0]+n.replace(r,f)+s.match(/\s*$/)[0];
    return s.replace(re, m=>fragmentos[m]);
  }
  function traduzirNo(n) {
    if (!n.parentElement || n.parentElement.closest(excluir) || !n.data.trim()) return;
    const anterior=originais.get(n), source=anterior && n.data===anterior.saida ? anterior.source : n.data;
    const saida=texto(source);originais.set(n,{source,saida});if(n.data!==saida)n.data=saida;
  }
  function traduzirElemento(el) {
    if(el.matches('script,style,code,pre,[contenteditable],[data-sem-traducao]'))return;
    // Uma opção sem value deriva seu valor do texto: fixá-lo antes de traduzir.
    if(el.tagName==='OPTION' && !el.hasAttribute('value'))el.value=el.textContent;
    const mem=atributos.get(el)||{};
    for(const k of ['title','aria-label','placeholder']){
      const atual=el.getAttribute(k);if(atual===null)continue;
      const source=mem[k] && atual===mem[k].saida ? mem[k].source : atual;
      const saida=texto(source);mem[k]={source,saida};if(atual!==saida)el.setAttribute(k,saida);
    }
    atributos.set(el,mem);
  }
  function percorrer(root) {
    if(root.nodeType===3){traduzirNo(root);return;}
    if(root.nodeType!==1)return;
    if(root.matches('input,textarea')){traduzirElemento(root);return;}
    if(root.closest(excluir))return;
    traduzirElemento(root);
    const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode(n){return n.nodeType===1&&n.matches('script,style,code,pre,[contenteditable],[data-sem-traducao]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    while(w.nextNode()){const n=w.currentNode;n.nodeType===3?traduzirNo(n):traduzirElemento(n);}
  }
  const observer=new MutationObserver(mudancas=>{
    observer.disconnect();
    for(const m of mudancas){if(m.type==='childList')m.addedNodes.forEach(percorrer);else if(m.type==='characterData')traduzirNo(m.target);else traduzirElemento(m.target);}
    observer.observe(document.body,options);
  });
  const options={subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']};
  function aplicar(){
    if(!document.body)return;
    observer.disconnect();percorrer(document.body);
    document.documentElement.lang=idioma==='en'?'en':'pt-BR';
    document.title=texto(titulo);
    document.querySelectorAll('[data-mosca-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.moscaLang===idioma)));
    observer.observe(document.body,options);
  }
  const titulo=document.title;
  const texturas=new Map();
  window.addEventListener('mosca:idioma',()=>{for(const [t,pintar] of texturas){pintar();t.needsUpdate=true;}});
  function mudar(v, compartilhar=true){
    if(v!=='pt'&&v!=='en')return;idioma=v;
    try{localStorage.setItem(chave,v);}catch{/* A troca funciona sem armazenamento. */}
    const u=new URL(location.href);u.searchParams.set('lang',v);history.replaceState(null,'',u);
    aplicar();window.dispatchEvent(new CustomEvent('mosca:idioma',{detail:v}));
    if(compartilhar){for(const f of document.querySelectorAll('iframe')){try{f.contentWindow.MoscaIdioma?.mudar(v,false);}catch{/* Outra origem. */}}}
  }
  window.MoscaIdioma={texto:texto,textura(t,pintar){texturas.set(t,pintar);t.addEventListener('dispose',()=>texturas.delete(t));},mudar:mudar,get atual(){return idioma;},get locale(){return idioma==='en'?'en-US':'pt-BR';},
    desenhar(ctx,s,...args){return ctx.fillText(texto(s),...args);},medir(ctx,s){return ctx.measureText(texto(s));}};
  window.addEventListener('storage',e=>{if(e.key===chave&&e.newValue!==idioma)mudar(e.newValue,false);});
  function iniciar(){
    const style=document.createElement('style');style.textContent='.mosca-idiomas{display:flex;justify-content:flex-end;gap:5px;flex-basis:100%;margin:0 0 10px}.mosca-idiomas button{display:inline-flex;align-items:center;gap:6px;font:600 12px system-ui;cursor:pointer;border:1px solid var(--line,#3a5164);border-radius:6px;background:var(--surface,#192632);color:var(--ink,#e5edf5);padding:7px 10px}.mosca-idiomas button[aria-pressed="true"]{border-color:var(--spike,#74d9bf);box-shadow:0 0 0 1px var(--spike,#74d9bf)}.mosca-idiomas button:focus-visible{outline:2px solid var(--spike,#74d9bf);outline-offset:3px}.mosca-idiomas svg{width:22px;height:15px;flex:none}';document.head.append(style);
    if(window===window.top){
      const nav=document.createElement('nav');nav.className='mosca-idiomas';nav.dataset.semTraducao='';nav.setAttribute('aria-label','Idioma / Language');
      const br='<svg viewBox="0 0 22 15" aria-hidden="true"><path fill="#009c3b" d="M0 0h22v15H0z"/><path fill="#ffdf00" d="m11 1 9 6.5-9 6.5-9-6.5z"/><circle cx="11" cy="7.5" r="3.5" fill="#002776"/><path d="M7.8 6.4q3.5-.5 6.4 2" fill="none" stroke="white" stroke-width=".6"/></svg>';
      const us='<svg viewBox="0 0 22 15" aria-hidden="true"><path fill="white" d="M0 0h22v15H0z"/><path stroke="#b22234" stroke-width="1.2" d="M0 .6h22M0 2.9h22M0 5.2h22M0 7.5h22M0 9.8h22M0 12.1h22M0 14.4h22"/><path fill="#3c3b6e" d="M0 0h10v8H0z"/><path stroke="white" stroke-dasharray="1 1.4" d="M1 1.5h8M1 3.5h8M1 5.5h8"/></svg>';
      for(const [v,n,flag] of [['pt','Português',br],['en','English',us]]){const b=document.createElement('button');b.type='button';b.dataset.moscaLang=v;b.title=n;b.setAttribute('aria-label',n);b.innerHTML=flag+'<span>'+v.toUpperCase()+'</span>';b.onclick=()=>mudar(v);nav.append(b);}
      (document.querySelector('header.top')||document.body).prepend(nav);
    }
    aplicar();
    document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(!a)return;const u=new URL(a.href);if(u.origin===location.origin||u.hostname==='127.0.0.1'||u.hostname==='localhost'){if(/(?:\.html|\/$)/.test(u.pathname)){u.searchParams.set('lang',idioma);a.href=u.href;}}},true);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',iniciar,{once:true}):iniciar();
})();
