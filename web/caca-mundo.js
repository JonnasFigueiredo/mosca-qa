// Caça a bugs no mundo da mosca (index.html, aba "Caça a bugs"): a etapa final do treino, com a mosca de verdade.
// As 15 ações do sistema de Pedidos (web/qa/pedidos.js, bancada 2) viram plaquinhas na bancada da Cozinha, cada uma
// com o cheiro das suas características: os mesmos glomérulos fortes do experimento validado, a 100 Hz no centro da
// plaquinha (peso 0,67 × 150 Hz da página). Ela anda, para, limpa, voa, segue a visão (LC10a) e os cheiros como na
// Cozinha. Provar uma plaquinha (a probóscide estendida encostando nela) executa a ação no sistema; um contrato violado
// pela primeira vez na versão é bug. No treino: açúcar + dopamina PAM, como na caça a bugs da página. No teste: nada.
// Regras nossas, declaradas na página: a plaquinha ainda não provada nesta versão "tem gosto doce" para as patas
// (a mesma regra da caça a bugs da página), sem preferência inata por frutas, e a atração aprendida usa a diferença de
// cheiro entre as antenas. O cérebro, a memória e a escolha de onde ir e o que provar são da mosca.
(() => {
  const Q = window.QAPedidos;
  if (!Q || typeof APPS === 'undefined') return;
  // os cheiros das características (docs/medicoes/qa-cheiros-fortes.json; no braço "normal", qa-cheiros-trocados.json)
  const BASE = { carrinho: ['VA4', 'DL2v'], estoque: ['VL2p', 'VM2'], pagamento: ['DC2', 'VM1'], cancelamento: ['DA4m', 'VM3'], cupom: ['VC4', 'DM6'], zero: ['VC1', 'DL5'], limite: ['DC4', 'DL1'], negativa: ['D', 'DA4l'] };
  const MAPAS = { repetida: { ...BASE, normal: ['VL2a', 'VM6v'], repetida: ['DC1', 'VA6'] }, normal: { ...BASE, normal: ['DC1', 'VA6'], repetida: ['VL2a', 'VM6v'] } };
  const PESO = 0.67;   // 0,67 × 150 Hz = 100 Hz no centro, como no experimento validado
  const ACAO_TXT = {
    'carrinho:normal': 'Pôr 1 item no carrinho', 'carrinho:zero': 'Pôr quantidade zero', 'carrinho:negativa': 'Pôr quantidade negativa',
    'carrinho:limite': 'Pôr o estoque todo no carrinho', 'estoque:normal': 'Abrir o pedido', 'estoque:limite': 'Pedir o estoque inteiro',
    'estoque:repetida': 'Reservar duas vezes', 'pagamento:normal': 'Pagar', 'pagamento:zero': 'Pagar pedido vazio', 'pagamento:repetida': 'Pagar duas vezes',
    'cancelamento:normal': 'Cancelar', 'cancelamento:repetida': 'Cancelar duas vezes', 'cupom:normal': 'Aplicar cupom de 10%',
    'cupom:limite': 'Aumentar o cupom até o máximo', 'cupom:repetida': 'Aplicar o mesmo cupom duas vezes',
  };
  const CONTRATO_TXT = {
    'estoque-negativo': 'estoque negativo', 'estoque-acima-do-inicial': 'estoque acima do inicial', 'estoque-inconsistente': 'o estoque não fecha a conta',
    'cobranca-duplicada': 'o mesmo pedido foi cobrado duas vezes', 'cobranca-sem-valor': 'cobrança de valor zero', 'total-nao-finito': 'total inválido',
    'total-negativo': 'total negativo', 'quantidade-negativa-aceita': 'quantidade negativa aceita', 'desconto-acima-do-limite': 'desconto acima de 30%',
  };
  const DEFEITO_TXT = { 'cobranca-dupla': 'cobrança dupla', 'cancelamento-duplo': 'estorno duplo', 'cupom-duplo': 'cupom acumulado', 'reserva-dupla': 'reserva dupla',
    'quantidade-negativa': 'quantidade negativa', 'cobra-zero': 'cobrança zero', 'estorno-a-mais': 'estorno a mais', 'cupom-em-porcentagem': 'cupom de 10% vira 40%', 'baixa-sem-reserva': 'baixa sem reserva' };
  const nomeVersao = d => d.map(x => DEFEITO_TXT[x] || x).join(' + ');

  // as plaquinhas: grade de 5 × 3 na bancada de 20 × 20 cm, com um pouco de sorte (fixa), 16 × 10 mm, planas
  const idDe = a => 'q-' + a.id.replace(':', '-');
  const objetos = {};
  {
    let h = 4242; const r = () => (h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296;
    const ordem = [...Q.ACOES]; for (let k = ordem.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ordem[k], ordem[j]] = [ordem[j], ordem[k]]; }
    ordem.forEach((a, i) => {
      objetos[idDe(a)] = { r: ACAO_TXT[a.id], acao: a, x: 40 + (i % 5) * 30 + (r() - 0.5) * 8, y: 62 + Math.floor(i / 5) * 40 + (r() - 0.5) * 8,
        w: 16, d: 10, h: 0.4, forma: 'placa', gosto: 'teste', porcoes: 0, alcance: 14, cheiro: {} };
    });
  }
  function usarCheiros(car) {
    const mapa = MAPAS[car];
    for (const [id, o] of Object.entries(objetos)) {
      o.cheiro = Object.fromEntries([...mapa[o.acao.familia], ...mapa[o.acao.entrada]].map(g => [g, PESO]));
      ODORS[id] = Object.keys(o.cheiro); ODOR_PESO[id] = o.cheiro;
    }
  }
  usarCheiros('repetida');

  APPS.caca = { ...APPS.cozinha, id: 'caca', nome: 'Caça a bugs', url: 'bancada.testes', objetos,
    elementos: Object.fromEntries(Object.entries(objetos).map(([id, o]) => [id, { r: o.r, notas: [], acao: () => {} }])),
    estado() { return { rota: 'caca', msg: '' }; },
    // página 2D: a bancada vista de cima, com as plaquinhas (2,8 px por mm)
    render() {
      const k = 2.8, top = 64;
      const obj = Object.entries(objetos).map(([id, o]) => `<button data-el="${id}" class="k-obj k-placa${el(id).bug ? ' k-bug' : ''}" tabindex="-1" style="left:${((o.x - o.w / 2) * k).toFixed(1)}px;top:${(top + (o.y - o.d / 2) * k).toFixed(1)}px;width:${(o.w * k).toFixed(1)}px;height:${(o.d * k).toFixed(1)}px"><span>${o.r}</span></button>`).join('');
      return `<div class="sx sx-cozinha"><div class="k-janela"><span>janela</span></div>${obj}<div class="k-escala"><i></i>1 cm</div></div>`;
    },
    provar: id => CacaMundo.provar(id),
  };

  // a aba e o painel
  const botao = document.createElement('button'); botao.textContent = 'Caça a bugs'; botao.dataset.app = 'caca';
  botao.onclick = () => { if (!LAB.busy) { switchApp('caca'); sbSet(true); CacaMundo.mostrar(); } };
  $('#appTabs').append(botao);
  const estilo = document.createElement('style');
  estilo.textContent = `.sx .k-obj.k-placa{border-radius:4px;background:#fbf8f2;border:1px solid #b9ab95}.sx .k-obj.k-placa.k-bug{background:#ffe2b3;border-color:#9a6200}.sx .k-obj.k-placa span{font-size:9px}
    #cacaPainel table{border-collapse:collapse;font-size:13px;margin-top:6px}#cacaPainel td,#cacaPainel th{padding:3px 8px;border-bottom:1px solid var(--line);text-align:right}#cacaPainel td:first-child,#cacaPainel th:first-child{text-align:left}`;
  document.head.append(estilo);
  const painel = document.createElement('div'); painel.id = 'cacaPainel'; painel.hidden = true;
  painel.style.cssText = 'padding:14px;border:1px solid var(--line);border-radius:8px;margin:10px 0;font-size:13px;background:var(--surface)';
  painel.innerHTML = `<strong>Caça a bugs com a mosca de verdade · a etapa final do treino</strong>
    <p>As 15 ações do sistema de Pedidos são plaquinhas na bancada, cada uma com o cheiro das suas características. Ela anda, voa,
    segue o que vê e cheira, e prova as plaquinhas com a probóscide. Provar = executar a ação no sistema. Bug novo no treino:
    açúcar e dopamina de recompensa. No teste, num sistema com bugs em partes que ela nunca premiou, não há recompensa: o que
    ela faz vem do que aprendeu.</p>
    <div class="app-tabs" style="flex-wrap:wrap;gap:8px;align-items:center">
      <label>Condição <select id="cacaCond"><option value="ativa">Aprende</option><option value="congelada">Congelada (sem aprendizado)</option></select></label>
      <label>Bug premiado <select id="cacaCar"><option value="repetida">Repetição (clique duplo)</option><option value="normal">Ação normal</option></select></label>
      <label>Treino <select id="cacaTreinos"><option value="6">6 versões</option><option value="3">3 versões</option><option value="9">9 versões</option></select></label>
      <button id="cacaTreinar">Treinar</button><button id="cacaTestar">Testar no sistema novo</button><button id="cacaParar" disabled>Parar</button>
      <a href="caca.html" style="margin-left:auto">O protocolo medido, passo a passo →</a>
    </div>
    <p id="cacaStatus" role="status">Pronta. "Treinar" troca a versão do sistema a cada 12 provas ou 90 s; "Testar" usa 3 versões novas, sem recompensa, até o primeiro bug (ou 15 provas, ou 2 min).</p>
    <progress id="cacaProgresso" max="1" value="0" style="width:100%"></progress>
    <div id="cacaResultados"></div>
    <small>Regras nossas: a plaquinha ainda não provada nesta versão tem "gosto doce" para as patas (é o que faz a probóscide
    estender, a mesma regra da caça a bugs da página); sem preferência inata por frutas; a atração aprendida segue a diferença
    de cheiro entre as antenas. Diferente da tela medida, aqui o caminho, a visão e o corpo decidem também o que ela encontra:
    é uma sessão do mundo, ainda não uma medida.</small>`;
  $('#worldBox').after(painel);

  const C = { fase: 'livre', car: 'repetida', versoes: [], vi: -1, sis: null, achados: new Set(), provas: 0, t0: 0, bugs: [], teste: [], treino: [], iv: 0, recompensa: true };
  const agoraS = () => brainT / 1000;
  function novaVersao(defeitos, rotulo) {
    C.sis = Q.criar(defeitos, { bancada: 2 }); C.achados = new Set(); C.provas = 0; C.t0 = agoraS(); C.rotulo = rotulo; C.defeitos = defeitos; C.bugs = [];
    // sistema novo: tudo pode ter mudado, então tudo volta a ser novo para ela
    for (const id of Object.keys(objetos)) { el(id).novelty = 1; el(id).bug = false; }
    renderShop(); requestAnimationFrame(measure);
    logEvent(`${rotulo}: versão nova do sistema (${nomeVersao(defeitos)}).`);
  }
  function status(t) { $('#cacaStatus').textContent = t; }
  function tabela() {
    const linhas = C.teste.map(r => `<tr><td>${nomeVersao(r.defeitos)}${r.controle ? ' · controle' : ''}</td><td>${r.primeiro ?? 'não achou'}</td><td>${r.tempo != null ? r.tempo.toFixed(0) + ' s' : '—'}</td><td>${r.provas}</td></tr>`).join('');
    const tr = C.treino.map((r, i) => `${i + 1}. ${nomeVersao(r.defeitos)}: ${r.bugs} bug${r.bugs === 1 ? '' : 's'} em ${r.provas} provas`).join(' · ');
    $('#cacaResultados').innerHTML = (tr ? `<p><b>Treino:</b> ${tr}</p>` : '') + (linhas ? `<table><thead><tr><th>Teste</th><th>Provas até o 1º bug</th><th>Tempo</th><th>Provas</th></tr></thead><tbody>${linhas}</tbody></table>` : '');
  }
  function fimVersao() {
    if (C.fase === 'treino') C.treino.push({ defeitos: C.defeitos, bugs: C.bugs.length, provas: C.provas });
    if (C.fase === 'teste') C.teste.push({ defeitos: C.defeitos, controle: C.defeitos.join('+') === C.V.controle.join('+'), primeiro: C.bugs[0]?.prova ?? null, tempo: C.bugs[0] ? C.bugs[0].t - C.t0 : null, provas: C.provas });
    tabela();
    C.vi++;
    if (C.vi < C.versoes.length) novaVersao(C.versoes[C.vi], (C.fase === 'treino' ? 'Treino ' : 'Teste ') + (C.vi + 1));
    else { const f = C.fase; parar(); status(f === 'treino' ? 'Treino concluído. Agora "Testar no sistema novo".' : 'Teste concluído: veja a tabela.'); logEvent(f === 'treino' ? 'Fim do treino.' : 'Fim do teste.'); }
  }
  function vigia() {
    if (C.fase !== 'treino' && C.fase !== 'teste') return;
    const lim = C.fase === 'treino' ? { provas: 12, s: 90 } : { provas: 15, s: 120 };
    const dt = agoraS() - C.t0;
    $('#cacaProgresso').value = Math.min(1, (C.vi + Math.min(1, Math.max(C.provas / lim.provas, dt / lim.s))) / C.versoes.length);
    status(`${C.rotulo} · ${nomeVersao(C.defeitos)} · ${C.provas} provas · ${dt.toFixed(0)} s · ${C.bugs.length} bug${C.bugs.length === 1 ? '' : 's'}${C.recompensa ? '' : ' · sem recompensa'}`);
    if (C.provas >= lim.provas || dt >= lim.s) fimVersao();
  }
  function iniciar(fase) {
    if (APP.id !== 'caca') { switchApp('caca'); sbSet(true); }
    C.car = $('#cacaCar').value; usarCheiros(C.car); C.V = C.car === 'normal' ? Q.VERSOES2N : Q.VERSOES2;
    worker.postMessage({ type: 'params', plasticidade: $('#cacaCond').value !== 'congelada' });
    C.fase = fase; C.recompensa = fase === 'treino'; C.vi = 0;
    if (fase === 'treino') { const n = +$('#cacaTreinos').value; C.versoes = Array.from({ length: n }, (_, i) => C.V.treino[i % C.V.treino.length]); C.treino = []; }
    else { C.versoes = C.V.teste; C.teste = []; }
    for (const id of ['cacaTreinar', 'cacaTestar', 'cacaCond', 'cacaCar', 'cacaTreinos']) $('#' + id).disabled = true;
    $('#cacaParar').disabled = false;
    novaVersao(C.versoes[0], (fase === 'treino' ? 'Treino ' : 'Teste ') + 1);
    clearInterval(C.iv); C.iv = setInterval(vigia, 250);
    tabela();
  }
  function parar() {
    clearInterval(C.iv); C.fase = 'livre';
    for (const id of ['cacaTreinar', 'cacaTestar', 'cacaCond', 'cacaCar', 'cacaTreinos']) $('#' + id).disabled = false;
    $('#cacaParar').disabled = true;
  }
  $('#cacaTreinar').onclick = () => iniciar('treino');
  $('#cacaTestar').onclick = () => iniciar('teste');
  $('#cacaParar').onclick = () => { parar(); status('Parado.'); };

  window.CacaMundo = {
    mostrar() { $('#cacaPainel').hidden = APP.id !== 'caca'; },
    // provar uma plaquinha = executar a ação no sistema e conferir os contratos
    provar(id) {
      const o = objetos[id];
      if (!o) return;
      if (!C.sis) novaVersao(C.V?.treino?.[0] || Q.VERSOES2.treino[0], 'Livre');
      C.provas++;
      C.sis.executar(o.acao.id);
      const novos = Q.verificar(C.sis).filter(x => !C.achados.has(x));
      labEvent('clique', { id, bug: novos[0] || null, arriscado: false });
      if (!novos.length) { logEvent(`Provou "${o.r}": o sistema não quebrou.`); return; }
      novos.forEach(x => C.achados.add(x));
      C.bugs.push({ id, contratos: novos, prova: C.provas, t: agoraS() });
      el(id).bug = true; renderShop(); requestAnimationFrame(measure);
      if (SB.on) sbGlitch(id);
      const txt = novos.map(x => CONTRATO_TXT[x] || x).join('; ');
      if (C.recompensa && !LAB.noReward) {
        fly.sweet = 0.4; fly.reward = LAB.blockPAM ? 0 : 0.5;
        fly.hunger = Math.max(0, fly.hunger - 0.12);
        sweetPop(fly.x, fly.y - 18);
        logEvent(`Bug: "${o.r}" quebrou o sistema (${txt}). Recompensa: açúcar e dopamina PAM reforçam esse cheiro.`, 's');
      } else logEvent(`Bug: "${o.r}" quebrou o sistema (${txt}). Teste: sem recompensa.`, 's');
      if (C.fase === 'teste') setTimeout(fimVersao, 600);   // no teste, a versão acaba no primeiro bug
    },
    estado: () => C,
  };
  // ao trocar de aba, o painel some e a sessão para
  const trocaOriginal = window.switchApp;
  if (typeof trocaOriginal === 'function') {
    window.switchApp = function (id) { if (id !== 'caca' && C.fase !== 'livre') parar(); trocaOriginal(id); CacaMundo.mostrar(); };
  }
})();
