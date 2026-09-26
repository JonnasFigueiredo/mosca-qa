// Sistemas de teste para a mosca. Cada elemento clicável tem:
//  - notas: o que ele faz (rede, cálculo, formulário, lista, navegação). Elementos com a mesma
//    função compartilham a nota, então compartilham parte do cheiro e das células de Kenyon.
//    É uma metáfora: o "cheiro" representa pistas do que o elemento faz.
//  - uma parte própria do cheiro (atribuída pela página), para dois elementos nunca cheirarem igual.
// Os bugs se concentram em certas funções (rede e cálculo), como costuma acontecer em software
// de verdade. Uma mosca que aprende isso num sistema deveria achar bugs mais rápido em outro.
(() => {   // isolado: só window.SISTEMAS sai daqui
'use strict';

// notas de função: dois glomérulos fortes cada (força medida no próprio cérebro simulado)
const NOTAS = {
  rede: ['VA2', 'DM4'],
  calculo: ['DP1l', 'DM2'],
  form: ['DC1', 'VC1'],
  lista: ['VA6', 'VL2a'],
  nav: ['VA4', 'VM6v'],
};
const NOTA_NOME = { rede: 'rede', calculo: 'cálculo', form: 'formulário', lista: 'lista', nav: 'navegação' };
// parte própria do cheiro: glomérulos medianos que não entram nas notas
const ID_POOL = ['D', 'DL5', 'VA3', 'DL2v', 'VC2', 'DL1', 'DM3', 'VL2p', 'VM7d', 'DM6', 'VM5v', 'VM1',
  'VA7l', 'DA4m', 'VM2', 'VM4', 'DC2', 'DC3', 'VC3', 'VC4', 'VL1', 'VM3', 'DL3', 'DM5', 'VM7v', 'DA3'];

const reais = n => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nunca = () => new Promise(() => {});        // requisição que nunca responde
const TEMPO_LIMITE = 1000;                          // ms sem resposta = bug de "carregando para sempre"

/* ───────────── Sistema de treino: Painel de Pedidos ───────────── */
const PEDIDOS = {
  id: 'pedidos', nome: 'Pedidos', url: 'pedidos.exemplo', papel: 'treino',
  bugs: {
    P1: { t: '"Exportar CSV" fica carregando para sempre', sev: 'medio', sevTxt: 'médio', nota: 'rede' },
    P2: { t: '"Atualizar" quebra com erro de JavaScript', sev: 'crit', sevTxt: 'crítico', nota: 'rede' },
    P3: { t: '"Recalcular" deixa o faturamento em "R$ NaN"', sev: 'alto', sevTxt: 'alto', nota: 'calculo' },
    P4: { t: '"Aplicar desconto" deixa o total negativo', sev: 'alto', sevTxt: 'alto', nota: 'calculo' },
    P5: { t: 'O menu "Relatórios" leva a uma página que não existe', sev: 'medio', sevTxt: 'médio', nota: 'nav' },
  },
  estado() {
    return {
      rota: 'pedidos', msg: 'Bom dia! 4 pedidos esperando confirmação.', exportando: 0, pagina: 1,
      linhas: [
        { n: 1041, cliente: 'Ana Souza', valor: 189.9, status: 'Pago' },
        { n: 1042, cliente: 'Bruno Lima', valor: 74.5, status: 'Pendente' },
        { n: 1043, cliente: 'Carla Dias', valor: 312.0, status: 'Pago' },
        { n: 1044, cliente: 'Diego Reis', valor: 58.3, status: 'Enviado' },
      ],
      faturamento: 634.7, desconto: 0,
    };
  },
  elementos: {
    'p-inicio': { r: 'Início', notas: ['nav'], acao: s => { s.rota = 'pedidos'; s.msg = 'Você está no início.'; } },
    'p-pedidos': { r: 'Pedidos', notas: ['nav'], acao: s => { s.rota = 'pedidos'; } },
    'p-clientes': { r: 'Clientes', notas: ['nav'], acao: s => { s.msg = '128 clientes ativos este mês.'; } },
    'p-relatorios': { r: 'Relatórios', notas: ['nav'], acao: s => { s.rota = '404'; } },
    'p-config': { r: 'Configurações', notas: ['nav'], acao: s => { s.msg = 'Configurações salvas.'; } },
    'p-buscar': { r: 'Buscar', notas: ['rede'], acao: s => { s.msg = '2 pedidos encontrados para "Ana".'; } },
    'p-novo': { r: 'Novo pedido', notas: ['form'], acao: s => { s.msg = 'Rascunho do pedido #1045 criado.'; } },
    'p-exportar': { r: 'Exportar CSV', notas: ['rede'], acao: s => { s.exportando = performance.now(); nunca(); } },
    'p-atualizar': { r: 'Atualizar', notas: ['rede'], acao: s => { const resposta = undefined; s.linhas = resposta.pedidos; } },
    'p-recalcular': { r: 'Recalcular', notas: ['calculo'], acao: s => { s.faturamento = s.linhas.reduce((t, l) => t + l.preco, 0); } },
    'p-media': { r: 'Ticket médio', notas: ['calculo'], acao: s => { s.msg = 'Ticket médio: ' + reais(s.faturamento / s.linhas.length); } },
    'p-desconto': { r: 'Aplicar desconto', notas: ['calculo'], acao: s => { s.desconto += s.faturamento * 1.1; } },
    'p-cancelar': { r: 'Cancelar pedido', notas: ['lista'], acao: s => { if (s.linhas.length > 1) { const l = s.linhas.pop(); s.faturamento -= l.valor; s.msg = `Pedido #${l.n} cancelado.`; } } },
    'p-duplicar': { r: 'Duplicar pedido', notas: ['lista'], acao: s => { const l = s.linhas[0]; s.linhas.push({ ...l, n: 1040 + s.linhas.length + 1 }); s.faturamento += l.valor; s.msg = 'Pedido duplicado.'; } },
    'p-anterior': { r: 'Página anterior', notas: ['lista'], acao: s => { s.pagina = Math.max(1, s.pagina - 1); } },
    'p-proxima': { r: 'Próxima página', notas: ['lista'], acao: s => { s.pagina = Math.min(3, s.pagina + 1); } },
    'p-voltar': { r: 'Voltar', notas: ['nav'], acao: s => { s.rota = 'pedidos'; } },
  },
  // o que o clique quebrou (bug, detalhe), ou null
  checar(s, id, err) {
    if (id === 'p-atualizar' && err) return ['P2', `${err.name}: ${err.message}`];
    if (id === 'p-recalcular' && !Number.isFinite(s.faturamento)) return ['P3', 'Texto na tela: "Faturamento R$ NaN"'];
    if (id === 'p-desconto' && s.faturamento - s.desconto < 0) return ['P4', `Total ${reais(s.faturamento - s.desconto)}`];
    if (id === 'p-relatorios' && s.rota === '404') return ['P5', 'HTTP 404 em /relatorios'];
    return null;
  },
  // bugs que só aparecem com o tempo
  pendentes(s) {
    if (s.exportando && performance.now() - s.exportando > TEMPO_LIMITE) { s.exportando = 0; return [['P1', 'p-exportar', 'Sem resposta depois de 1 s']]; }
    return [];
  },
  render(s, b) {
    if (s.rota === '404') return `<div class="sx sx-pedidos"><header class="sx-top"><b class="sx-logo">Pedidos<i>·</i></b></header>
      <div class="sx-404"><b>404</b><p>Página não encontrada.</p>${b('p-voltar', 'Voltar ao painel')}</div></div>`;
    const total = s.faturamento - s.desconto;
    return `<div class="sx sx-pedidos">
      <header class="sx-top"><b class="sx-logo">Pedidos<i>·</i></b>
        <span class="sx-search"><input value="Ana" aria-label="Buscar pedidos" tabindex="-1">${b('p-buscar', 'Buscar', 'ghost')}</span>
        <span class="sx-avatar">JF</span></header>
      <div class="sx-body">
        <nav class="sx-side">${b('p-inicio', 'Início', 'side')}${b('p-pedidos', 'Pedidos', 'side on')}${b('p-clientes', 'Clientes', 'side')}${b('p-relatorios', 'Relatórios', 'side')}${b('p-config', 'Configurações', 'side')}</nav>
        <main class="sx-main">
          <div class="sx-title"><h3>Pedidos de hoje</h3><span>${b('p-novo', '+ Novo pedido')}${b('p-exportar', s.exportando ? 'Exportando…' : 'Exportar CSV', 'ghost', !!s.exportando)}${b('p-atualizar', 'Atualizar', 'ghost')}</span></div>
          <p class="sx-msg">${s.msg}</p>
          <div class="sx-cards">
            <div class="sx-card"><small>Faturamento</small><b>${reais(total)}</b>${b('p-recalcular', 'Recalcular', 'mini')}</div>
            <div class="sx-card"><small>Pedidos</small><b>${s.linhas.length}</b>${b('p-media', 'Ticket médio', 'mini')}</div>
            <div class="sx-card"><small>Desconto</small><b>${reais(s.desconto)}</b>${b('p-desconto', 'Aplicar desconto', 'mini')}</div>
          </div>
          <table class="sx-table"><thead><tr><th>#</th><th>Cliente</th><th>Valor</th><th>Status</th></tr></thead><tbody>
            ${s.linhas.slice(0, 4).map(l => `<tr><td>${l.n}</td><td>${l.cliente}</td><td>${reais(l.valor)}</td><td><span class="sx-tag">${l.status}</span></td></tr>`).join('')}
          </tbody></table>
          <div class="sx-rowactions">${b('p-cancelar', 'Cancelar último', 'ghost')}${b('p-duplicar', 'Duplicar primeiro', 'ghost')}</div>
          <div class="sx-pager">${b('p-anterior', '‹ Anterior', 'ghost')}<span>Página ${s.pagina} de 3</span>${b('p-proxima', 'Próxima ›', 'ghost')}</div>
        </main>
      </div></div>`;
  },
};

/* ───────────── Sistema novo: Financeiro ───────────── */
const FINANCEIRO = {
  id: 'financeiro', nome: 'Financeiro', url: 'financas.exemplo', papel: 'teste',
  bugs: {
    F1: { t: '"Sincronizar banco" fica carregando para sempre', sev: 'medio', sevTxt: 'médio', nota: 'rede' },
    F2: { t: '"Baixar extrato" quebra com erro de JavaScript', sev: 'crit', sevTxt: 'crítico', nota: 'rede' },
    F3: { t: '"Converter para USD" mostra "US$ NaN"', sev: 'alto', sevTxt: 'alto', nota: 'calculo' },
    F4: { t: '"Simular juros" mostra "R$ Infinity"', sev: 'alto', sevTxt: 'alto', nota: 'calculo' },
    F5: { t: '"Arquivar conta" some com a conta, mas o contador não muda', sev: 'medio', sevTxt: 'médio', nota: 'lista' },
  },
  estado() {
    return {
      aba: 'resumo', msg: 'Saldo atualizado há 5 minutos.', sincronizando: 0,
      saldo: 12480.55, usd: null, juros: null, projecao: null,
      contas: [{ nome: 'Conta corrente', v: 8210.4 }, { nome: 'Poupança', v: 3120.15 }, { nome: 'Investimentos', v: 1150.0 }],
      contador: 3, meses: 0, pref: { notif: true, semanal: false, fatores: true, compacto: false },
    };
  },
  elementos: {
    // navegação (menu lateral e detalhes): muita coisa inofensiva, como num sistema de verdade
    'f-resumo': { r: 'Resumo', notas: ['nav'], acao: s => { s.aba = 'resumo'; } },
    'f-contas': { r: 'Contas', notas: ['nav'], acao: s => { s.aba = 'contas'; s.msg = 'Mostrando suas contas.'; } },
    'f-cartoes': { r: 'Cartões', notas: ['nav'], acao: s => { s.aba = 'cartoes'; s.msg = '2 cartões ativos, fatura fecha dia 12.'; } },
    'f-metas': { r: 'Metas', notas: ['nav'], acao: s => { s.aba = 'metas'; s.msg = 'Meta "Viagem": 64% concluída.'; } },
    'f-invest': { r: 'Investimentos', notas: ['nav'], acao: s => { s.aba = 'invest'; s.msg = 'Carteira rendeu 0,9% no mês.'; } },
    'f-impostos': { r: 'Impostos', notas: ['nav'], acao: s => { s.aba = 'impostos'; s.msg = 'Informe de rendimentos disponível.'; } },
    'f-transf': { r: 'Transferências', notas: ['nav'], acao: s => { s.aba = 'transf'; s.msg = 'Nenhuma transferência agendada.'; } },
    'f-ajuda': { r: 'Ajuda', notas: ['nav'], acao: s => { s.msg = 'Central de ajuda: fale com a gente pelo chat.'; } },
    'f-det1': { r: 'Detalhes · corrente', notas: ['nav'], acao: s => { s.msg = 'Conta corrente: agência 0001, conta 12345-6.'; } },
    'f-det2': { r: 'Detalhes · poupança', notas: ['nav'], acao: s => { s.msg = 'Poupança: rendimento de 0,6% ao mês.'; } },
    'f-det3': { r: 'Detalhes · investimentos', notas: ['nav'], acao: s => { s.msg = 'Investimentos: CDB com liquidez diária.'; } },
    // rede
    'f-sincronizar': { r: 'Sincronizar banco', notas: ['rede'], acao: s => { s.sincronizando = performance.now(); nunca(); } },
    'f-cotacao': { r: 'Atualizar cotação', notas: ['rede'], acao: s => { s.msg = 'Cotação do dólar: R$ 5,12.'; } },
    'f-extrato': { r: 'Baixar extrato', notas: ['rede'], acao: s => { const arquivo = null; s.msg = 'Extrato: ' + arquivo.nome; } },
    // cálculo
    'f-usd': { r: 'Converter para USD', notas: ['calculo'], acao: s => { s.usd = s.saldo / s.cotacao; } },
    'f-juros': { r: 'Simular juros', notas: ['calculo'], acao: s => { s.juros = s.saldo / s.meses; } },
    'f-projetar': { r: 'Projetar 12 meses', notas: ['calculo'], acao: s => { s.projecao = s.saldo * 1.08; } },
    // lista
    'f-arquivar': { r: 'Arquivar conta', notas: ['lista'], acao: s => { if (s.contas.length > 1) s.contas.pop(); } },
    'f-ordenar': { r: 'Ordenar contas', notas: ['lista'], acao: s => { s.contas.sort((a, b) => b.v - a.v); s.msg = 'Contas ordenadas por saldo.'; } },
    'f-filtrar': { r: 'Filtrar contas', notas: ['lista'], acao: s => { s.msg = 'Mostrando contas com saldo acima de R$ 1.000.'; } },
    'f-agrupar': { r: 'Agrupar contas', notas: ['lista'], acao: s => { s.msg = 'Contas agrupadas por tipo.'; } },
    'f-favoritos': { r: 'Favoritos', notas: ['lista'], acao: s => { s.msg = '3 contatos favoritos.'; } },
    // formulário
    'f-enviar': { r: 'Enviar transferência', notas: ['form'], acao: s => { s.msg = 'Transferência de R$ 150,00 enviada.'; } },
    'f-limpar': { r: 'Limpar formulário', notas: ['form'], acao: s => { s.msg = 'Formulário limpo.'; } },
    'f-agendar': { r: 'Agendar', notas: ['form'], acao: s => { s.msg = 'Transferência agendada para amanhã.'; } },
    'f-p-notif': { r: 'Notificações', notas: ['form'], acao: s => { s.pref.notif = !s.pref.notif; } },
    'f-p-semanal': { r: 'Resumo semanal', notas: ['form'], acao: s => { s.pref.semanal = !s.pref.semanal; } },
    'f-p-fatores': { r: 'Dois fatores', notas: ['form'], acao: s => { s.pref.fatores = !s.pref.fatores; } },
    'f-p-compacto': { r: 'Modo compacto', notas: ['form'], acao: s => { s.pref.compacto = !s.pref.compacto; } },
  },
  checar(s, id, err) {
    if (id === 'f-extrato' && err) return ['F2', `${err.name}: ${err.message}`];
    if (id === 'f-usd' && !Number.isFinite(s.usd)) return ['F3', 'Texto na tela: "US$ NaN"'];
    if (id === 'f-juros' && !Number.isFinite(s.juros)) return ['F4', 'Texto na tela: "R$ Infinity"'];
    if (id === 'f-arquivar' && s.contador !== s.contas.length) return ['F5', `Contador mostra ${s.contador}, a lista tem ${s.contas.length}`];
    return null;
  },
  pendentes(s) {
    if (s.sincronizando && performance.now() - s.sincronizando > TEMPO_LIMITE) { s.sincronizando = 0; return [['F1', 'f-sincronizar', 'Sem resposta depois de 1 s']]; }
    return [];
  },
  render(s, b) {
    const fmtOu = (v, f) => v === null ? '—' : f(v);
    const side = (id, txt, aba) => b(id, txt, 'side' + (s.aba === aba ? ' on' : ''));
    const onoff = (id, txt, v) => b(id, `${txt}: ${v ? 'sim' : 'não'}`, 'ghost');
    return `<div class="sx sx-fin">
      <header class="sx-top"><b class="sx-logo">Finanças<i>·</i></b>
        <span class="sx-top-actions">${b('f-sincronizar', s.sincronizando ? 'Sincronizando…' : 'Sincronizar banco', 'ghost', !!s.sincronizando)}${b('f-cotacao', 'Atualizar cotação', 'ghost')}</span>
        <span class="sx-avatar">JF</span></header>
      <div class="sx-body">
        <nav class="sx-side">${side('f-resumo', 'Resumo', 'resumo')}${side('f-contas', 'Contas', 'contas')}${side('f-cartoes', 'Cartões', 'cartoes')}${side('f-metas', 'Metas', 'metas')}${side('f-invest', 'Investimentos', 'invest')}${side('f-impostos', 'Impostos', 'impostos')}${side('f-transf', 'Transferências', 'transf')}${b('f-ajuda', 'Ajuda', 'side')}</nav>
        <main class="sx-main">
          <p class="sx-msg">${s.msg}</p>
          <div class="sx-hero"><small>Saldo total</small><b>${reais(s.saldo)}</b>${b('f-extrato', 'Baixar extrato', 'ghost')}</div>
          <div class="sx-cards">
            <div class="sx-card"><small>Em dólar</small><b>${fmtOu(s.usd, v => 'US$ ' + (Number.isFinite(v) ? v.toFixed(2) : v))}</b>${b('f-usd', 'Converter p/ USD', 'mini')}</div>
            <div class="sx-card"><small>Juros por mês</small><b>${fmtOu(s.juros, v => 'R$ ' + (Number.isFinite(v) ? v.toFixed(2) : v))}</b>${b('f-juros', 'Simular juros', 'mini')}</div>
            <div class="sx-card"><small>Em 12 meses</small><b>${fmtOu(s.projecao, reais)}</b>${b('f-projetar', 'Projetar', 'mini')}</div>
          </div>
          <div class="sx-split">
            <section class="sx-panel"><h4>Contas <span class="sx-count">${s.contador}</span></h4>
              <ul>${s.contas.map((c, i) => `<li><span>${c.nome}</span>${b('f-det' + (i + 1), 'Detalhes', 'mini')}</li>`).join('')}</ul>
              <div class="sx-rowactions">${b('f-arquivar', 'Arquivar', 'ghost')}${b('f-ordenar', 'Ordenar', 'ghost')}${b('f-filtrar', 'Filtrar', 'ghost')}${b('f-agrupar', 'Agrupar', 'ghost')}</div></section>
            <section class="sx-panel"><h4>Transferir</h4>
              <label>Para<input value="Maria Costa" tabindex="-1" aria-label="Destinatário"></label>
              <div class="sx-rowactions">${b('f-enviar', 'Enviar')}${b('f-agendar', 'Agendar', 'ghost')}${b('f-limpar', 'Limpar', 'ghost')}${b('f-favoritos', 'Favoritos', 'ghost')}</div></section>
          </div>
          <section class="sx-panel"><h4>Preferências</h4>
            <div class="sx-rowactions">${onoff('f-p-notif', 'Notificações', s.pref.notif)}${onoff('f-p-semanal', 'Resumo semanal', s.pref.semanal)}${onoff('f-p-fatores', 'Dois fatores', s.pref.fatores)}${onoff('f-p-compacto', 'Modo compacto', s.pref.compacto)}</div></section>
        </main>
      </div></div>`;
  },
};

window.SISTEMAS = { NOTAS, NOTA_NOME, ID_POOL, lista: [PEDIDOS, FINANCEIRO] };
})();
