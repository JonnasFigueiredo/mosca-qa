// Sistema de Pedidos em memória para o treino de caça a bugs (docs/plano-treino-robusto.md, B-abstrata).
// Três partes separadas, como no plano do Codex: o sistema (com defeitos injetáveis por versão), o executor (traduz a
// ação escolhida em operação) e o verificador (confere contratos no estado; não sabe onde está o defeito).
// Funciona no navegador (globalThis.QAPedidos) e no Node (import).
(function () {
  // ── características das ações: o que a mosca "sente" de cada uma (a camada sensorial só vê isto) ──
  const FAMILIAS = ['carrinho', 'estoque', 'pagamento', 'cancelamento', 'cupom'];
  const ENTRADAS = ['normal', 'zero', 'limite', 'negativa', 'repetida'];
  // cada característica = dois glomérulos neutros (fora da atração/aversão inata da Cozinha)
  const CHEIRO = {
    carrinho: ['DL3', 'VM2'], estoque: ['DL4', 'VM3'], pagamento: ['DL5', 'VM4'], cancelamento: ['DC4', 'VM5d'], cupom: ['VC4', 'VL1'],
    normal: ['DM5', 'VA6'], zero: ['VL2a', 'DC2'], limite: ['DL1', 'VC2'], negativa: ['VM7v', 'DA4m'], repetida: ['VA4', 'DA3'],
  };
  // ações que existem: família × entrada (nem toda combinação faz sentido)
  const ACOES = [
    ['carrinho', 'normal'], ['carrinho', 'zero'], ['carrinho', 'negativa'], ['carrinho', 'limite'],
    ['estoque', 'normal'], ['estoque', 'limite'], ['estoque', 'repetida'],
    ['pagamento', 'normal'], ['pagamento', 'zero'], ['pagamento', 'repetida'],
    ['cancelamento', 'normal'], ['cancelamento', 'repetida'],
    ['cupom', 'normal'], ['cupom', 'limite'], ['cupom', 'repetida'],
  ].map(([familia, entrada]) => ({ id: familia + ':' + entrada, familia, entrada }));
  const cheiroDe = acao => [...CHEIRO[acao.familia], ...CHEIRO[acao.entrada]];

  // ── o sistema ──
  // defeitos: conjunto de nomes; cada um muda uma regra do sistema (o gabarito, que só o placar consulta)
  function criar(defeitos = []) {
    const d = new Set(defeitos);
    const INICIAL = { a: 5, b: 2 }, PRECO = { a: 1000, b: 2500 };   // centavos
    const s = { estoque: { ...INICIAL }, carrinho: {}, pedidos: [], cobrancas: [], cupons: 0, DESCONTO_MAX: 0.3 };
    const pedidoAberto = () => s.pedidos.find(p => p.estado === 'criado');
    const ultimoPago = () => [...s.pedidos].reverse().find(p => p.estado === 'pago');
    const total = () => {
      const bruto = Object.entries(s.carrinho).reduce((t, [i, q]) => t + PRECO[i] * q, 0);
      return Math.round(bruto * (1 - Math.min(s.cupons * 0.1, d.has('cupom-sem-limite') ? 9 : s.DESCONTO_MAX)));
    };
    const ops = {
      'carrinho:normal': () => { s.carrinho.a = (s.carrinho.a || 0) + 1; },
      'carrinho:zero': () => { if (d.has('quantidade-zero-divide')) s.carrinho.b = (s.carrinho.b || 0) + 0 / 0; },
      'carrinho:negativa': () => { if (d.has('quantidade-negativa')) s.carrinho.b = (s.carrinho.b || 0) - 3; },
      'carrinho:limite': () => { s.carrinho.b = s.estoque.b; },   // exatamente o que há em estoque
      'estoque:normal': () => { const p = pedidoAberto() || criarPedido(); return p; },
      'estoque:limite': () => { s.carrinho.b = s.estoque.b + (d.has('reserva-acima-do-estoque') ? 1 : 0); criarPedido(); },
      'estoque:repetida': () => { const p = pedidoAberto(); if (p) { reservar(p); if (d.has('reserva-dupla')) reservar(p); } },
      'pagamento:normal': () => { const p = pedidoAberto(); if (p && p.valor > 0) cobrar(p); },
      'pagamento:zero': () => { const p = pedidoAberto(); if (p && (p.valor > 0 || d.has('paga-pedido-vazio'))) cobrar(p); },
      'pagamento:repetida': () => { const p = ultimoPago(); if (p && d.has('cobranca-dupla')) s.cobrancas.push({ pedido: p.id, valor: p.valor }); },
      'cancelamento:normal': () => { const p = ultimoPago() || pedidoAberto(); if (p) cancelar(p); },
      'cancelamento:repetida': () => { const p = [...s.pedidos].reverse().find(x => x.estado === 'cancelado'); if (p && d.has('cancelamento-duplo')) devolver(p); },
      'cupom:normal': () => { if (s.cupons < 1) s.cupons++; },
      'cupom:limite': () => { s.cupons = Math.min(3, s.cupons + 1); },
      'cupom:repetida': () => { if (d.has('cupom-duplo')) s.cupons += 2; else if (s.cupons < 1) s.cupons++; },
    };
    function criarPedido() {
      const itens = Object.fromEntries(Object.entries(s.carrinho).filter(([, q]) => q !== 0));
      const p = { id: s.pedidos.length + 1, itens, valor: total(), estado: 'criado', reservado: false };
      s.pedidos.push(p); s.carrinho = {}; s.cupons = 0; reservar(p); return p;
    }
    function reservar(p) {
      if (p.reservado && !d.has('reserva-dupla')) return;
      for (const [i, q] of Object.entries(p.itens)) {
        if (!Number.isFinite(q)) continue;
        if (q > s.estoque[i] && !d.has('reserva-acima-do-estoque')) return;
      }
      for (const [i, q] of Object.entries(p.itens)) if (Number.isFinite(q)) s.estoque[i] -= q;
      p.reservado = true;
    }
    function cobrar(p) { s.cobrancas.push({ pedido: p.id, valor: p.valor }); p.estado = 'pago'; }
    function devolver(p) { for (const [i, q] of Object.entries(p.itens)) if (Number.isFinite(q)) s.estoque[i] += q; }
    function cancelar(p) { if (p.reservado) devolver(p); p.estado = 'cancelado'; }
    return {
      executar(id) { const op = ops[id]; if (!op) throw Error('ação inexistente: ' + id); op(); },
      estado: () => s, total, INICIAL,
    };
  }

  // ── verificador: contratos no estado, sem saber onde está o defeito ──
  function verificar(sis) {
    const s = sis.estado(), v = [];
    for (const [i, q] of Object.entries(s.estoque)) {
      if (q < 0) v.push('estoque-negativo');
      if (q > sis.INICIAL[i]) v.push('estoque-acima-do-inicial');
    }
    // conservação: disponível + reservado em pedidos ativos (não cancelados) = inicial, item a item
    for (const i of Object.keys(sis.INICIAL)) {
      const reservado = s.pedidos.filter(p => p.reservado && p.estado !== 'cancelado').reduce((t, p) => t + (Number.isFinite(p.itens[i]) ? p.itens[i] || 0 : 0), 0);
      if (s.estoque[i] + reservado !== sis.INICIAL[i]) v.push('estoque-inconsistente');
    }
    const porPedido = {};
    for (const c of s.cobrancas) porPedido[c.pedido] = (porPedido[c.pedido] || 0) + 1;
    if (Object.values(porPedido).some(n => n > 1)) v.push('cobranca-duplicada');
    if (s.cobrancas.some(c => c.valor <= 0)) v.push('cobranca-sem-valor');
    const t = sis.total();
    if (!Number.isFinite(t)) v.push('total-nao-finito');
    else if (t < 0) v.push('total-negativo');
    if (Object.values(s.carrinho).some(q => Number.isFinite(q) && q < 0)) v.push('quantidade-negativa-aceita');
    if (s.cupons * 0.1 > s.DESCONTO_MAX + 1e-9) v.push('desconto-acima-do-limite');
    return [...new Set(v)];
  }

  // ── versões: conjuntos de defeitos. Treino: repetição em pagamento e cancelamento; teste: repetição em outras
  // famílias (transferência pela característica "repetida"), mais um defeito de outra característica ──
  const VERSOES = {
    treino: [['cobranca-dupla'], ['cancelamento-duplo'], ['cobranca-dupla', 'cancelamento-duplo']],
    teste: [['cupom-duplo'], ['reserva-dupla'], ['cupom-duplo', 'quantidade-negativa']],
  };
  // troca os pares de glomérulos das características (calibração: scripts/qa_abstrato.mjs --calibrar-cheiros)
  const usarCheiros = mapa => Object.assign(CHEIRO, mapa);
  const api = { FAMILIAS, ENTRADAS, CHEIRO, ACOES, cheiroDe, criar, verificar, VERSOES, usarCheiros };
  if (typeof module !== 'undefined') module.exports = api;
  globalThis.QAPedidos = api;
})();
