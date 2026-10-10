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

  // o mundo (02/10, para a apresentação): cinco objetos de cozinha na bancada, um por família de ações, em alturas
  // diferentes; em cima de cada um, as plaquinhas das ações daquela família. Ir de uma plataforma a outra pede subir a
  // parede ou voar (os comportamentos da Cozinha). Cheiro só nas plaquinhas; as plataformas não cheiram nem têm gosto
  const QS = new URLSearchParams(location.search);
  const PLAT_FAMILIA = {
    carrinho: { forma: 'plat-tabua', r: 'Carrinho · tábua de corte', raio: 18, h: 5 },
    estoque: { forma: 'plat-prato', r: 'Estoque · pires', raio: 17, h: 8 },
    pagamento: { forma: 'plat-lata', r: 'Pagamento · lata de atum', raio: 16, h: 12 },
    cancelamento: { forma: 'plat-tampa', r: 'Cancelamento · tampa de pote', raio: 15, h: 9 },
    cupom: { forma: 'plat-cortica', r: 'Cupom · porta-copo de cortiça', raio: 17, h: 3.5 },
  };
  // (04/10) uma plataforma por característica da ação, em vez de por família. Com plataformas por família, a
  // característica premiada ("repetida") ficava em 4 das 5 plataformas e, em cima de cada uma, ela prova todas as
  // plaquinhas (a novidade tem gosto doce): a memória do cheiro não tinha onde virar escolha (série qa-mundo-d1: as duas
  // condições no acaso). Por característica, ir até a plataforma pelo cheiro é a escolha, como uma mosca que aprendeu um
  // cheiro e vai até a fonte dele. &grupos=familia volta ao mundo anterior
  const PLAT_CARACTERISTICA = {
    normal: { forma: 'plat-tabua', r: 'Ação normal · tábua de corte', raio: 22, h: 5 },
    repetida: { forma: 'plat-prato', r: 'Repetição · pires', raio: 20, h: 8 },
    limite: { forma: 'plat-lata', r: 'No limite · lata de atum', raio: 17, h: 12 },
    zero: { forma: 'plat-tampa', r: 'Valor zero · tampa de pote', raio: 15, h: 9 },
    negativa: { forma: 'plat-cortica', r: 'Valor negativo · porta-copo de cortiça', raio: 13, h: 3.5 },
  };
  // &iguais=1 (04/10): todas as plataformas por característica com o mesmo tamanho e a mesma altura (21 mm de raio, 7 mm),
  // só a aparência muda. Na calibração e1, a tábua (a maior e mais baixa) levou 29 de 51 provas: o formato decidia para
  // onde ela ia mais que o cheiro
  if (QS.get('iguais') === '1') for (const p of Object.values(PLAT_CARACTERISTICA)) { p.raio = 21; p.h = 7; }
  const POR_FAMILIA = QS.get('grupos') === 'familia';
  // &arena=1 (04/10): a arena de escolha, como os testes de memória olfativa com moscas reais (T-maze, arenas de escolha)
  // e como a bancada sem corpo que deu positivo: a cada tentativa, 3 plaquinhas no chão em volta do centro (as 3 ações
  // visíveis da bancada, sorteadas antes e iguais nas duas condições); ela anda até cada uma (os olhos a levam ao que é
  // claro), para 1 s em cima cheirando (a valência dos MBONs nesse segundo é a do cérebro), a cheirada fica fosca; depois
  // das três, a escolha pela mesma regra da bancada (softmax da valência, T = 0,15) acende a escolhida e lhe dá o "gosto
  // doce"; ela anda até lá e prova com a probóscide. Sem plataformas
  const ARENA = QS.get('arena') === '1';
  const PLATAFORMAS = ARENA ? {} : POR_FAMILIA ? PLAT_FAMILIA : PLAT_CARACTERISTICA;
  const CENTRO = [100, 108.6], ARENA_R = 18;
  const grupoDe = a => (POR_FAMILIA ? a.familia : a.entrada);
  const RAIO_CIRCULO = POR_FAMILIA ? 38 : 44;   // as plataformas por característica são maiores (até 5 plaquinhas)
  // em círculo, a 38 mm de onde ela começa (o centro de SB.start, 100 × 108,6 mm), uma a cada 72° (03/10): todas igualmente
  // perto. Antes, as plataformas do treino (pagamento, cancelamento) ficavam do lado oposto ao início e, em 18 versões de
  // treino da calibração, ela não provou nenhuma plaquinha delas (só carrinho, estoque e cupom): sem recompensa possível
  const LUGARES = [0, 1, 2, 3, 4].map(i => { const a = i * 2 * Math.PI / 5; return [100 + RAIO_CIRCULO * Math.sin(a), 108.6 - RAIO_CIRCULO * Math.cos(a)]; });
  Object.values(PLATAFORMAS).forEach((p, i) => { [p.x, p.y] = LUGARES[i]; });
  // a bandeja (03/10): as plataformas ficam numa bandeja de madeira, 14 mm além delas, e não soltas na bancada de 20 cm.
  // Na bancada inteira ela passava minutos longe de tudo (diagnóstico com _diag_mundo.mjs): numa área menor, encontra
  // as plataformas com mais frequência. Regra do mundo, declarada; a borda aparece no 3D e ela se afasta dela
  const BANDEJA = ARENA ? [CENTRO[0] - 40, CENTRO[1] - 40, CENTRO[0] + 40, CENTRO[1] + 40] : (() => {
    const v = Object.values(PLATAFORMAS), m = 14;
    return [Math.min(...v.map(p => p.x - p.raio)) - m, Math.min(...v.map(p => p.y - p.raio)) - m, Math.max(...v.map(p => p.x + p.raio)) + m, Math.max(...v.map(p => p.y + p.raio)) + m];
  })();
  // variantes do mundo na URL (a escada de calibração escrita antes, scripts/madrugada_mundo.mjs):
  // &alcance=N (mm) muda o alcance do cheiro das plaquinhas (padrão 20 mm, o do mundo medido d1)
  const ALCANCE = Math.max(4, +QS.get('alcance') || (ARENA ? 6 : 20));   // na arena, cheiro local: em cima de uma plaquinha, ela sente essa
  // &limtreino=N: limite de cada versão de treino (s de cérebro; padrão 240)
  const LIM_TREINO = Math.max(30, +QS.get('limtreino') || 240);
  // &placa=N: largura das plaquinhas (mm; padrão 13, o do mundo medido d1; profundidade 0,65 × a largura)
  const PLACA = Math.min(16, Math.max(6, +QS.get('placa') || 13));
  // &lugares=fixos: sem o sorteio dos lugares a cada versão (para comparar)
  const SEM_SORTEIO = QS.get('lugares') === 'fixos';
  // &esquecimento=N (10/10): constante de esquecimento do aprendizado em segundos (o worker usa 90 s por padrão). No ritmo
  // do mundo (~20 s por tentativa na arena), 90 s apagava a memória entre a recompensa e o teste; moscas reais lembram de
  // uma recompensa de açúcar por horas. Parâmetro do modelo, declarado em cada medida que o usa
  const ESQUECIMENTO_S = +QS.get('esquecimento') || 0;
  const idDe = a => 'q-' + a.id.replace(':', '-');
  const placas = {}, plataformas = {};
  for (const [fam, p] of Object.entries(PLATAFORMAS)) {
    plataformas['p-' + fam] = { r: p.r, familia: fam, x: p.x, y: p.y, w: 2 * p.raio, d: 2 * p.raio, h: p.h, forma: p.forma, gosto: null, porcoes: 0, alcance: 0, cheiro: {} };
    const acoes = Q.ACOES.filter(a => grupoDe(a) === fam), n = acoes.length;
    // as plaquinhas num anel em cima da plataforma; com 4 ou 5, um anel mais aberto para não se encostarem
    acoes.forEach((a, i) => {
      const ang = -Math.PI / 2 + 2 * Math.PI * i / n, rr = n === 1 ? 0 : p.raio * (n === 5 ? 0.62 : n === 4 ? 0.6 : 0.52);
      placas[idDe(a)] = { r: ACAO_TXT[a.id], acao: a, x: p.x + Math.cos(ang) * rr, y: p.y + Math.sin(ang) * rr, base: p.h,
        w: PLACA, d: +(PLACA * 0.65).toFixed(2), h: 0.4, forma: 'placa', gosto: 'teste', porcoes: 0, alcance: ALCANCE, cheiro: {} };
    });
  }
  // na arena, as plaquinhas fora da tentativa ficam longe da bandeja (fora do mundo dela)
  if (ARENA) Q.ACOES.forEach((a, i) => { placas[idDe(a)] = { r: ACAO_TXT[a.id], acao: a, x: 2000 + 40 * i, y: 2000, base: 0,
    w: PLACA, d: +(PLACA * 0.65).toFixed(2), h: 0.4, forma: 'placa', gosto: 'teste', porcoes: 0, alcance: ALCANCE, cheiro: {} }; });
  const objetos = { ...plataformas, ...placas };
  // a cada versão do sistema, as plataformas trocam de lugar no círculo, por sorteio (03/10, regra do mundo, declarada):
  // ela vai mais para uns lados que para outros (a luz da janela, o que é mais claro), e com lugares fixos as famílias
  // do treino ficavam onde ela quase não ia. Sorteando, o lugar não diz onde está o defeito: só o cheiro diz
  const posPlaca = {};
  if (!ARENA) for (const [id, o] of Object.entries(placas)) { const p = PLATAFORMAS[grupoDe(o.acao)]; posPlaca[id] = [o.x - p.x, o.y - p.y]; }
  function sortearLugares() {
    const ordem = [0, 1, 2, 3, 4];
    for (let i = 4; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
    Object.entries(PLATAFORMAS).forEach(([fam, p], i) => {
      [p.x, p.y] = LUGARES[ordem[i]];
      Object.assign(plataformas['p-' + fam], { x: p.x, y: p.y });
    });
    for (const [id, o] of Object.entries(placas)) { const p = PLATAFORMAS[grupoDe(o.acao)]; o.x = p.x + posPlaca[id][0]; o.y = p.y + posPlaca[id][1]; }
    if (typeof SB !== 'undefined') {
      SB.app = null; if (typeof SBR !== 'undefined') SBR.built = '';   // refaz o mundo (sbBuild) e o desenho
      if (APP.id === 'caca' && typeof sbBuild === 'function') sbBuild();
      // ela volta ao centro da bandeja, no chão, virada para um lado sorteado (03/10): sem isso, uma plataforma podia
      // aparecer embaixo dela na troca de lugares e ela já começava a versão em cima das plaquinhas (achou o bug na
      // primeira prova, 4 s depois do início, duas vezes na calibração d1, que foi descartada)
      if (SB.on && fly) {
        Object.assign(fly, { x: SB.start[0], y: SB.start[1], z: 0, th: Math.random() * 2 * Math.PI, flying: false, jumping: false, vz: 0,
          lateral: null, pouso: null, naParede: null, landing: false, speed: 0 });
      }
    }
  }
  // o que ela já provou nesta versão fica fosco, e o que não provou continua claro: a regra da página "o que ela ainda
  // não provou brilha mais", que chega ao cérebro pelos olhos (o LC10a responde ao que é mais claro que o resto do olho)
  function apaga(id, fosca) {
    const b = typeof SBR !== 'undefined' && SBR.boxes?.get(id);
    if (!b) return;
    b.mesh.traverse(m => { for (const mt of [].concat(m.material || [])) { if (mt.userData.cor0 == null) mt.userData.cor0 = mt.color.getHex(); mt.color.setHex(mt.userData.cor0); if (fosca) mt.color.multiplyScalar(0.55); } });
  }
  for (const id of Object.keys(plataformas)) { ODORS[id] = []; ODOR_PESO[id] = {}; }
  // &cheiros=trocados (04/10): a característica premiada com o par de glomérulos da outra (o mapa trocado, o mesmo controle
  // da bancada, que deu positivo e replicou). No mundo, a mosca com corpo evita o par DC1+VA6 sem ter aprendido nada
  // (diagnóstico com cheiros trocados: a plataforma com esse cheiro ficou com 0% e 14% do tempo), e a plataforma da
  // repetição ficava vazia; com o mapa trocado, a repetição cheira a VL2a+VM6v
  const CHEIROS_TROCADOS = QS.get('cheiros') === 'trocados';
  function usarCheiros(car) {
    const mapa = MAPAS[CHEIROS_TROCADOS ? (car === 'normal' ? 'repetida' : 'normal') : car];
    for (const [id, o] of Object.entries(placas)) {
      o.cheiro = Object.fromEntries([...mapa[o.acao.familia], ...mapa[o.acao.entrada]].map(g => [g, PESO]));
      ODORS[id] = Object.keys(o.cheiro); ODOR_PESO[id] = o.cheiro;
    }
  }
  usarCheiros('repetida');

  APPS.caca = { ...APPS.cozinha, id: 'caca', nome: 'Caça a bugs', url: 'bancada.testes', objetos, bandeja: BANDEJA,
    elementos: Object.fromEntries(Object.entries(objetos).map(([id, o]) => [id, { r: o.r, notas: [], acao: () => {} }])),
    estado() { return { rota: 'caca', msg: '' }; },
    // página 2D: a bancada vista de cima, com as plaquinhas (2,8 px por mm)
    render() {
      const k = 2.8, top = 64;
      const obj = Object.entries(objetos).map(([id, o]) => `<button data-el="${id}" class="k-obj ${o.acao ? 'k-placa' : 'k-plat'}${el(id).bug ? ' k-bug' : ''}" tabindex="-1" style="left:${((o.x - o.w / 2) * k).toFixed(1)}px;top:${(top + (o.y - o.d / 2) * k).toFixed(1)}px;width:${(o.w * k).toFixed(1)}px;height:${(o.d * k).toFixed(1)}px"><span>${o.r}</span></button>`).join('');
      return `<div class="sx sx-cozinha"><div class="k-janela"><span>janela</span></div>${obj}<div class="k-escala"><i></i>1 cm</div></div>`;
    },
    provar: id => CacaMundo.provar(id),
  };

  // a aba e o painel
  const botao = document.createElement('button'); botao.textContent = 'Caça a bugs'; botao.dataset.app = 'caca';
  botao.onclick = () => { if (!LAB.busy) { switchApp('caca'); sbSet(true); CacaMundo.mostrar(); } };
  $('#appTabs').append(botao);
  const estilo = document.createElement('style');
  estilo.textContent = `.sx .k-obj.k-placa{border-radius:4px;background:#fbf8f2;border:1px solid #b9ab95}.sx .k-obj.k-placa.k-bug{background:#ffe2b3;border-color:#9a6200}.sx .k-obj.k-placa span{font-size:9px}.sx .k-obj.k-plat{background:#d8c9ad;border:1px solid #9c8a6a}.sx .k-obj.k-plat span{bottom:-14px}
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
    <p id="cacaStatus" role="status">Pronta. "Treinar": cada versão do sistema vai até ela achar o bug (ou 4 min); "Testar": 3 versões novas, sem recompensa, até o primeiro bug (ou 3 min).</p>
    <progress id="cacaProgresso" max="1" value="0" style="width:100%"></progress>
    <div id="cacaResultados"></div>
    <small>Regras nossas: a plaquinha ainda não provada nesta versão tem "gosto doce" para as patas (é o que faz a probóscide
    estender, a mesma regra da caça a bugs da página); sem preferência inata por frutas; a atração aprendida segue a diferença
    de cheiro entre as antenas. Diferente da tela medida, aqui o caminho, a visão e o corpo decidem também o que ela encontra:
    é uma sessão do mundo, ainda não uma medida.</small>`;
  $('#worldBox').after(painel);

  const C = { fase: 'livre', car: 'repetida', versoes: [], vi: -1, sis: null, achados: new Set(), provas: 0, t0: 0, bugs: [], teste: [], treino: [], iv: 0, recompensa: true };
  const agoraS = () => brainT / 1000;

  // ── arena de escolha (&arena=1) ──
  const gerador = semente => { let s = semente >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  // as 3 ações visíveis de cada tentativa, sorteadas antes com o mesmo gerador e as mesmas sementes da bancada
  // (scripts/qa_abstrato.mjs, visiveis): iguais nas duas condições e iguais às da bancada para a mesma semente
  function visiveis(semente, n) {
    const r = gerador(semente), out = [];
    for (let i = 0; i < n; i++) { const ids = [...Q.ACOES]; for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } out.push(ids.slice(0, 3)); }
    return out;
  }
  // os orçamentos da bancada 2; &tentativas= e &teste= encurtam (testes rápidos de validação antes das séries longas)
  const ARENA_TREINO = +QS.get('tentativas') || 20, ARENA_TESTE = +QS.get('teste') || 30, T_SOFTMAX = 0.15;
  const A = { semente: 1, k: 0, vistas: [], opcoes: [], amostra: {}, fase: 'livre', escolhida: null, t0: 0, ultimo: 0, cheirando: null, tentativas: [], fimEm: 0 };
  function reconstruir() {
    SB.app = null; if (typeof SBR !== 'undefined') SBR.built = '';
    if (APP.id === 'caca' && typeof sbBuild === 'function') sbBuild();
    renderShop(); requestAnimationFrame(measure);
  }
  function novaTentativa() {
    if (A.k >= (C.fase === 'treino' ? ARENA_TREINO : ARENA_TESTE)) { fimVersao(); return; }
    A.opcoes = A.vistas[A.k].map(idDe); A.amostra = {}; A.fase = 'cheirar'; A.escolhida = null; A.cheirando = null; A.fimEm = 0; A.t0 = A.ultimo = agoraS();
    Q.ACOES.forEach((a, i) => { const o = placas[idDe(a)]; o.x = 2000 + 40 * i; o.y = 2000; });
    const rot = Math.random() * 2 * Math.PI;
    A.opcoes.forEach((id, j) => { const a = rot + j * 2 * Math.PI / 3, o = placas[id]; o.x = CENTRO[0] + ARENA_R * Math.sin(a); o.y = CENTRO[1] - ARENA_R * Math.cos(a); el(id).novelty = 0; el(id).bug = false; });
    reconstruir();
    for (const id of A.opcoes) apaga(id, false);
    // ela começa cada tentativa no centro, no chão, virada para um lado sorteado
    if (SB.on && fly) Object.assign(fly, { x: SB.start[0], y: SB.start[1], z: 0, th: Math.random() * 2 * Math.PI, flying: false, jumping: false, vz: 0,
      lateral: null, pouso: null, naParede: null, landing: false, speed: 0, cheirando: false });
  }
  function registrarTentativa(escolha, bug) {
    A.tentativas.push({ opcoes: A.opcoes.map(id => placas[id].acao.id), v: A.opcoes.map(id => A.amostra[id] ? +(A.amostra[id].soma / A.amostra[id].n).toFixed(3) : null),
      escolha, bug, t: +(agoraS() - A.t0).toFixed(1) });
  }
  function escolherArena() {
    const ids = A.opcoes.filter(id => A.amostra[id]), v = ids.map(id => A.amostra[id].soma / A.amostra[id].n);
    let k = 0;
    if (ids.length) { const e = v.map(x => Math.exp(x / T_SOFTMAX)), soma = e.reduce((a, b) => a + b, 0); let u = Math.random() * soma; while (k < e.length - 1 && (u -= e[k]) > 0) k++; }
    A.escolhida = ids.length ? ids[k] : A.opcoes[Math.floor(Math.random() * A.opcoes.length)];
    A.fase = 'provar'; A.ultimo = agoraS();
    for (const id of A.opcoes) apaga(id, id !== A.escolhida);
    el(A.escolhida).novelty = 1;   // o "gosto doce" da regra da página: pisando nela, a probóscide estende e ela prova
    logEvent(`Cheirou as três (valência ${ids.map((id, i) => placas[id].r + ' ' + v[i].toFixed(2)).join(', ')}): vai provar "${placas[A.escolhida].r}".`);
  }
  function vigiaArena() {
    const t = agoraS(), on = fly?.patasEl?.id, S = CORPO.S;
    if (A.fimEm || A.cheirando) fly.alvoArena = null;
    if (A.fimEm) { if (t >= A.fimEm) { fly.cheirando = false; A.k++; novaTentativa(); } return; }
    if (A.cheirando) {
      // 1,5 s parada em cima da plaquinha; a valência é a média do último 1 s (o primeiro meio segundo é o cheiro chegando)
      if (t > A.cheirando.ate - 1) { A.cheirando.soma += fly.valencia || 0; A.cheirando.n++; }
      if (t >= A.cheirando.ate) {
        const c = A.cheirando; A.amostra[c.id] = { soma: c.soma, n: Math.max(1, c.n) }; A.cheirando = null; fly.cheirando = false; apaga(c.id, true); A.ultimo = t;
        if (A.opcoes.every(id => A.amostra[id])) escolherArena();
      }
      return;
    }
    if (A.fase === 'cheirar' && on && A.opcoes.includes(on) && !A.amostra[on]) { A.cheirando = { id: on, ate: t + 1.5, soma: 0, n: 0 }; fly.cheirando = true; return; }
    // o caminho (regra declarada): ela vai de plaquinha em plaquinha, virando para a mais perto que falta cheirar (ou para a
    // escolhida); a direção do cérebro e o ruído continuam somando. Sem isso, uma tentativa levava ~170 s (teste de 04/10)
    if (fly) {
      let alvo = null, dm = Infinity;
      if (t - A.ultimo > 0.5) for (const id of A.fase === 'cheirar' ? A.opcoes.filter(id => !A.amostra[id]) : [A.escolhida]) { const o = placas[id], d = Math.hypot(o.x * S - fly.x, o.y * S - fly.y); if (d < dm) { dm = d; alvo = o; } }
      fly.alvoArena = alvo ? [alvo.x * S, alvo.y * S] : null;   // a virada é somada a cada quadro, em stepBody (index.html)
    }
    if (t - A.t0 > 90) { registrarTentativa(null, false); A.k++; novaTentativa(); }   // tentativa sem escolha em 90 s
  }
  function novaVersao(defeitos, rotulo) {
    if (!SEM_SORTEIO && !ARENA) sortearLugares();
    C.sis = Q.criar(defeitos, { bancada: 2 }); C.achados = new Set(); C.provas = 0; C.t0 = agoraS(); C.rotulo = rotulo; C.defeitos = defeitos; C.bugs = []; C.provadas = []; C.encerrada = false;
    // sistema novo: tudo pode ter mudado, então tudo volta a ser novo para ela
    for (const id of Object.keys(placas)) { el(id).novelty = 1; el(id).bug = false; apaga(id, false); }
    renderShop(); requestAnimationFrame(measure);
    logEvent(`${rotulo}: versão nova do sistema (${nomeVersao(defeitos)}).`);
    if (ARENA) {
      // as sementes das ações visíveis da bancada: treino i → semente × 100 + i; teste i → semente × 100 + 50 + i
      A.vistas = visiveis(A.semente * 100 + (C.fase === 'teste' ? 50 : 0) + Math.max(0, C.vi), C.fase === 'teste' ? ARENA_TESTE : ARENA_TREINO);
      A.k = 0; A.tentativas = []; novaTentativa();
    }
  }
  function status(t) { $('#cacaStatus').textContent = t; }
  function tabela() {
    const linhas = C.teste.map(r => `<tr><td>${nomeVersao(r.defeitos)}${r.controle ? ' · controle' : ''}</td><td>${r.primeiro ?? 'não achou'}</td><td>${r.tempo != null ? r.tempo.toFixed(0) + ' s' : '—'}</td><td>${r.provas}</td></tr>`).join('');
    const tr = C.treino.map((r, i) => `${i + 1}. ${nomeVersao(r.defeitos)}: ${r.bugs} bug${r.bugs === 1 ? '' : 's'} em ${r.provas} provas`).join(' · ');
    $('#cacaResultados').innerHTML = (tr ? `<p><b>Treino:</b> ${tr}</p>` : '') + (linhas ? `<table><thead><tr><th>Teste</th><th>Provas até o 1º bug</th><th>Tempo</th><th>Provas</th></tr></thead><tbody>${linhas}</tbody></table>` : '');
  }
  function fimVersao() {
    if (C.encerrada) return; C.encerrada = true;
    const provadas = C.provadas.map(p => p.acao);
    const extra = ARENA ? { tentativas: A.tentativas.slice() } : {};
    if (C.fase === 'treino') C.treino.push({ defeitos: C.defeitos, bugs: C.bugs.length, provas: C.provas, tempo: agoraS() - C.t0, tBug: C.bugs[0] ? C.bugs[0].t - C.t0 : null, provadas, ...extra });
    // na arena, "primeiro" = tentativas até o primeiro bug (como as ações da bancada)
    if (C.fase === 'teste') C.teste.push({ defeitos: C.defeitos, controle: C.defeitos.join('+') === C.V.controle.join('+'), primeiro: (ARENA ? C.bugs[0]?.tentativa : C.bugs[0]?.prova) ?? null, tempo: C.bugs[0] ? C.bugs[0].t - C.t0 : null, provas: C.provas, duracao: agoraS() - C.t0, provadas, ...extra });
    tabela();
    C.vi++;
    if (C.vi < C.versoes.length) novaVersao(C.versoes[C.vi], (C.fase === 'treino' ? 'Treino ' : 'Teste ') + (C.vi + 1));
    else { const f = C.fase; parar(); status(f === 'treino' ? 'Treino concluído. Agora "Testar no sistema novo".' : 'Teste concluído: veja a tabela.'); logEvent(f === 'treino' ? 'Fim do treino.' : 'Fim do teste.'); }
  }
  function vigia() {
    if (C.fase !== 'treino' && C.fase !== 'teste') return;
    if (ARENA) {
      vigiaArena();
      const n = C.fase === 'treino' ? ARENA_TREINO : ARENA_TESTE;
      $('#cacaProgresso').value = Math.min(1, (C.vi + A.k / n) / C.versoes.length);
      status(`${C.rotulo} · ${nomeVersao(C.defeitos)} · tentativa ${A.k + 1} de ${n} · ${A.fase === 'cheirar' ? 'cheirando (' + Object.keys(A.amostra).length + '/3)' : 'indo provar'} · ${C.bugs.length} bug${C.bugs.length === 1 ? '' : 's'}${C.recompensa ? '' : ' · sem recompensa'}`);
      return;
    }
    // limites de cada versão; &curto=1 (só para testar a automação) usa versões bem curtas
    // treino: a versão vai até ela achar o bug (e mais 10 s, para a dopamina parear com o cheiro), ou 4 min de cérebro;
    // teste: até o primeiro bug ou 3 min. Antes (12 provas ou 90 s) quase não havia recompensa no treino (piloto de 02/10)
    const lim = C.curto ? { provas: 3, s: 25 } : C.fase === 'treino' ? { provas: Infinity, s: LIM_TREINO } : { provas: Infinity, s: 180 };
    if (C.fase === 'treino' && !C.curto && C.bugs.length && agoraS() - C.bugs.at(-1).t > 10) { fimVersao(); return; }
    const dt = agoraS() - C.t0;
    $('#cacaProgresso').value = Math.min(1, (C.vi + Math.min(1, Math.max(C.provas / lim.provas, dt / lim.s))) / C.versoes.length);
    status(`${C.rotulo} · ${nomeVersao(C.defeitos)} · ${C.provas} provas · ${dt.toFixed(0)} s · ${C.bugs.length} bug${C.bugs.length === 1 ? '' : 's'}${C.recompensa ? '' : ' · sem recompensa'}`);
    if (C.provas >= lim.provas || dt >= lim.s) fimVersao();
  }
  function iniciar(fase) {
    if (APP.id !== 'caca') { switchApp('caca'); sbSet(true); }
    C.car = $('#cacaCar').value; usarCheiros(C.car); C.V = C.car === 'normal' ? Q.VERSOES2N : Q.VERSOES2;
    worker.postMessage({ type: 'params', plasticidade: $('#cacaCond').value !== 'congelada', ...(ESQUECIMENTO_S ? { tauF: ESQUECIMENTO_S * 1000 } : {}) });
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
    if (typeof fly !== 'undefined' && fly) { fly.alvoArena = null; fly.cheirando = false; }
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
      const o = placas[id];
      if (!o) return;   // as plataformas não se provam
      if (ARENA && (id !== A.escolhida || A.fimEm)) return;
      if (!C.sis) novaVersao(C.V?.treino?.[0] || Q.VERSOES2.treino[0], 'Livre');
      C.provas++;
      C.provadas.push({ acao: o.acao.id, t: agoraS() });
      // provada nesta versão, a plaquinha deixa de "ter gosto de novidade" para as patas: sem isso (só enfraquecendo a
      // cada mordida, como na página), a probóscide seguia ativa e ela ficava parada provando a mesma plaquinha ~20 s.
      // Como uma mosca que prova algo que não é comida: não insiste
      el(id).novelty = 0;
      apaga(id, true);
      C.sis.executar(o.acao.id);
      const novos = Q.verificar(C.sis).filter(x => !C.achados.has(x));
      labEvent('clique', { id, bug: novos[0] || null, arriscado: false });
      if (ARENA) { registrarTentativa(o.acao.id, novos.length > 0); fly.cheirando = true; A.fimEm = agoraS() + (novos.length && C.recompensa ? 2.5 : 1); }
      if (!novos.length) { logEvent(`Provou "${o.r}": o sistema não quebrou.`); return; }
      novos.forEach(x => C.achados.add(x));
      C.bugs.push({ id, contratos: novos, prova: C.provas, tentativa: A.k + 1, t: agoraS() });
      el(id).bug = true; renderShop(); requestAnimationFrame(measure);
      if (SB.on) sbGlitch(id);
      const txt = novos.map(x => CONTRATO_TXT[x] || x).join('; ');
      if (C.recompensa && !LAB.noReward) {
        fly.sweet = 0.4; fly.reward = LAB.blockPAM ? 0 : 0.5;
        fly.hunger = Math.max(0, fly.hunger - 0.12);
        sweetPop(fly.x, fly.y - 18);
        logEvent(`Bug: "${o.r}" quebrou o sistema (${txt}). Recompensa: açúcar e dopamina PAM reforçam esse cheiro.`, 's');
      } else logEvent(`Bug: "${o.r}" quebrou o sistema (${txt}). Teste: sem recompensa.`, 's');
      if (C.fase === 'teste') fimVersao();   // no teste, a versão acaba no primeiro bug
    },
    estado: () => C,
  };
  // modo automático, sem janela (scripts/qa_mundo.mjs): ?caca=auto&cond=ativa|congelada&car=repetida|normal&semente=N&treinos=6
  // treina, testa e deixa o resultado em window.__cacaFim. Com a semente, o cérebro (worker) e os sorteios da página
  // (passadas, pausas, ruído da direção) ficam fixos; o que depende do relógio de parede ainda varia entre rodadas
  if (/[?&]caca=auto(&|$)/.test(location.search)) {
    const q = new URLSearchParams(location.search), sem = Math.max(1, +q.get('semente') || 1);
    A.semente = sem;
    let sr = Math.imul(sem, 2654435761) >>> 0;
    Math.random = () => (sr = (Math.imul(sr, 1664525) + 1013904223) >>> 0) / 4294967296;
    window.__cacaFim = null; C.curto = q.get('curto') === '1';
    const espera = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      while (!(typeof brainReady !== 'undefined' && brainReady)) await espera(500);
      $('#cacaCond').value = q.get('cond') === 'congelada' ? 'congelada' : 'ativa';
      $('#cacaCar').value = q.get('car') === 'normal' ? 'normal' : 'repetida';
      const n = q.get('treinos'); if (n && [...$('#cacaTreinos').options].some(o => o.value === n)) $('#cacaTreinos').value = n;
      switchApp('caca'); sbSet(true);
      worker.postMessage({ type: 'semente', valor: sem });
      await espera(1500);
      const t0 = brainT / 1000;
      iniciar('treino'); while (C.fase !== 'livre') await espera(1000);
      // &so=treino: só o treino (calibração do mundo: quantas versões de treino ela acha o bug)
      if (q.get('so') !== 'treino') { iniciar('teste'); while (C.fase !== 'livre') await espera(1000); }
      window.__cacaFim = { semente: sem, condicao: $('#cacaCond').value, caracteristica: C.V.caracteristica, treino: C.treino, teste: C.teste,
        tempoCerebro: brainT / 1000 - t0, olhosReais: !!fly.olhoReal, data: new Date().toISOString() };
    })();
  }
  // dentro da tela "Caça a bugs ao vivo" (caca.html, ?embed=caca): só o mundo, ocupando o quadro todo; a tela de fora
  // lê e comanda a sessão por window.__mundo (mesma origem). Neste mundo não há louva-a-deus
  const estiloMundo = document.createElement('style');
  estiloMundo.textContent = `body.mundo-caca #predBtn, body.mundo-caca #sbModes button[data-mode="pred"], body.mundo-caca #predHelp, body.mundo-caca #predHud { display: none !important; }
    body.embed-caca { overflow: hidden; } body.embed-caca #worldBox { position: fixed !important; inset: 0; z-index: 50; width: 100vw; height: 100vh; border-radius: 0; margin: 0; }
    body.embed-caca #cacaPainel, body.embed-caca #treinoPainel { display: none !important; }`;
  document.head.append(estiloMundo);
  const mostrarOriginal = CacaMundo.mostrar;
  CacaMundo.mostrar = () => { mostrarOriginal(); document.body.classList.toggle('mundo-caca', APP.id === 'caca'); };
  const embutido = typeof EMBED !== 'undefined' && EMBED;
  if (embutido) {
    document.body.classList.add('embed-caca');
    (async () => {
      while (!(typeof brainReady !== 'undefined' && brainReady)) await new Promise(r => setTimeout(r, 500));
      switchApp('caca'); sbSet(true); CacaMundo.mostrar();
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    })();
  }
  window.__mundo = {
    pronto: () => typeof brainReady !== 'undefined' && brainReady && APP.id === 'caca',
    worker: () => worker,
    objetos: () => Object.entries(placas).map(([id, o]) => ({ id, acao: o.acao.id, entrada: o.acao.entrada, familia: o.acao.familia, nome: o.r, x: o.x, y: o.y })),
    estado: () => ({
      t: brainT / 1000, rodando: typeof running !== 'undefined' ? running : true,
      fase: C.fase, rotulo: C.rotulo, defeitos: C.defeitos, provas: C.provas, bugs: C.bugs.length, recompensa: C.recompensa,
      versao: C.vi, nVersoes: C.versoes.length, caracteristica: C.V?.caracteristica || C.car,
      treino: C.treino, teste: C.teste, provadas: (C.provadas || []).slice(-12),
      status: $('#cacaStatus').textContent,
      mosca: fly ? { x: fly.x, y: fly.y, z: fly.z, voando: !!fly.flying, marcha: fly.marcha, limpando: !!fly.limpeza?.ativa, sobre: fly.patasEl?.id || null,
        boca: fly.boca || 0, fome: fly.hunger, valencia: fly.valencia || 0, atracao: fly.atrAprendida || 0, velocidade: fly.speed || 0 } : null,
    }),
    log: n => [...document.querySelectorAll('#log li')].slice(0, n || 30).map(li => ({ t: li.querySelector('.mono')?.textContent || '', txt: li.lastElementChild?.textContent || li.textContent, cls: li.className })),
    // uma sessão inteira: treino e depois teste, como no modo automático (sem fixar os sorteios da página)
    async sessao({ cond = 'ativa', car = 'repetida', treinos = '6', semente = null } = {}) {
      if (C.fase !== 'livre') parar();
      $('#cacaCond').value = cond === 'congelada' ? 'congelada' : 'ativa'; $('#cacaCar').value = car === 'normal' ? 'normal' : 'repetida';
      if ([...$('#cacaTreinos').options].some(o => o.value === String(treinos))) $('#cacaTreinos').value = String(treinos);
      if (APP.id !== 'caca') { switchApp('caca'); sbSet(true); }
      if (semente != null) worker.postMessage({ type: 'semente', valor: semente });
      C.cancelada = false;
      iniciar('treino'); while (C.fase !== 'livre') await new Promise(r => setTimeout(r, 500));
      if (C.cancelada) return;
      iniciar('teste'); while (C.fase !== 'livre') await new Promise(r => setTimeout(r, 500));
    },
    parar: () => { C.cancelada = true; parar(); status('Parado.'); },
    pausar: () => $('#btnRun')?.click(),
  };
  // ao trocar de aba, o painel some e a sessão para
  const trocaOriginal = window.switchApp;
  if (typeof trocaOriginal === 'function') {
    window.switchApp = function (id) { if (id !== 'caca' && C.fase !== 'livre') parar(); trocaOriginal(id); CacaMundo.mostrar(); };
  }
})();
