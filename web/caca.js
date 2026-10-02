// Caça a bugs ao vivo (web/caca.html). O protocolo da bancada 2 de scripts/qa_abstrato.mjs, com o worker real no
// navegador, mostrado passo a passo: mesma ordem de mensagens ao worker, mesmos sorteios (ações visíveis, escolha,
// aquecimento) e a mesma semente do cérebro. Com as medições ligadas, uma sessão deve repetir a sessão medida com a
// mesma semente e condição (docs/medicoes/qa-b2-p*.json etc.). É uma demonstração: as medidas, com critério escrito
// antes, estão em docs/plano-treino-robusto.md e docs/publicacao/artigo.md.
(() => {
  'use strict';
  const Q = globalThis.QAPedidos;
  const $ = id => document.getElementById(id);

  // ── protocolo (igual a scripts/qa_abstrato.mjs) ──
  const SENTIR_S = 1.0, PAUSA_S = 0.2, T_SOFTMAX = 0.15, TREINOS = 6, ORC_TREINO = 20, ORCAMENTO = 30, VISIVEIS = 3;
  const H_CURIOSIDADE = 2.5;   // escolhido no oráculo (qa-curiosidade-oraculo.json)
  // cheiros das ações: docs/medicoes/qa-cheiros-fortes.json (bug de repetição) e qa-cheiros-trocados.json (bug em
  // ação normal: a característica premiada fica com o par forte DC1+VA6), campo "melhor"
  const BASE_MAPA = { carrinho: ['VA4', 'DL2v'], estoque: ['VL2p', 'VM2'], pagamento: ['DC2', 'VM1'], cancelamento: ['DA4m', 'VM3'], cupom: ['VC4', 'DM6'], zero: ['VC1', 'DL5'], limite: ['DC4', 'DL1'], negativa: ['D', 'DA4l'] };
  const MAPAS = {
    repetida: { ...BASE_MAPA, normal: ['VL2a', 'VM6v'], repetida: ['DC1', 'VA6'] },
    normal: { ...BASE_MAPA, normal: ['DC1', 'VA6'], repetida: ['VL2a', 'VM6v'] },
  };
  const gerador = semente => { let s = semente >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
  function visiveis(semente, n) {
    const r = gerador(semente), out = [];
    for (let i = 0; i < n; i++) { const ids = [...Q.ACOES]; for (let k = ids.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [ids[k], ids[j]] = [ids[j], ids[k]]; } out.push(ids.slice(0, VISIVEIS)); }
    return out;
  }
  const odor = acao => Object.fromEntries(Q.cheiroDe(acao).flatMap(g => ['L', 'R'].map(l => ['ORN_' + g + '_' + l, 100])));

  // ── textos ──
  const ACAO_TXT = {
    'carrinho:normal': 'pôr 1 item no carrinho', 'carrinho:zero': 'pôr quantidade zero', 'carrinho:negativa': 'pôr quantidade negativa',
    'carrinho:limite': 'pôr o estoque todo no carrinho', 'estoque:normal': 'abrir o pedido', 'estoque:limite': 'pedir o estoque inteiro',
    'estoque:repetida': 'reservar duas vezes', 'pagamento:normal': 'pagar', 'pagamento:zero': 'pagar pedido vazio', 'pagamento:repetida': 'pagar duas vezes',
    'cancelamento:normal': 'cancelar', 'cancelamento:repetida': 'cancelar duas vezes', 'cupom:normal': 'aplicar cupom de 10%',
    'cupom:limite': 'aumentar o cupom até o máximo', 'cupom:repetida': 'aplicar o mesmo cupom duas vezes',
  };
  const DEFEITO_TXT = {
    'cobranca-dupla': 'cobrança dupla', 'cancelamento-duplo': 'estorno duplo', 'cupom-duplo': 'cupom acumulado', 'reserva-dupla': 'reserva dupla',
    'quantidade-negativa': 'quantidade negativa', 'cobra-zero': 'cobrança de valor zero', 'estorno-a-mais': 'estorno de um item a mais',
    'cupom-em-porcentagem': 'cupom de 10% vira 40%', 'baixa-sem-reserva': 'baixa sem reserva',
  };
  const CONTRATO_TXT = {
    'estoque-negativo': 'estoque negativo', 'estoque-acima-do-inicial': 'estoque acima do inicial', 'estoque-inconsistente': 'estoque não fecha a conta',
    'cobranca-duplicada': 'mesmo pedido cobrado duas vezes', 'cobranca-sem-valor': 'cobrança de valor zero', 'total-nao-finito': 'total inválido',
    'total-negativo': 'total negativo', 'quantidade-negativa-aceita': 'quantidade negativa aceita', 'desconto-acima-do-limite': 'desconto acima de 30%',
  };
  const CARAC_TXT = { carrinho: 'carrinho', estoque: 'estoque', pagamento: 'pagamento', cancelamento: 'cancelamento', cupom: 'cupom', normal: 'normal', zero: 'zero', limite: 'limite', negativa: 'negativa', repetida: 'repetida' };
  const nomeVersao = d => d.map(x => DEFEITO_TXT[x] || x).join(' + ');
  const COND_TXT = { ativa: 'Treinada', congelada: 'Congelada', ativa_curiosa: 'Treinada + curiosidade', congelada_curiosa: 'Congelada + curiosidade' };
  const fmt = (v, d = 2) => (v == null || Number.isNaN(v) ? '—' : v.toFixed(d).replace('.', ','));
  const fmtT = s => { const m = Math.floor(s / 60), r = s - m * 60; return m ? `${m} min ${r.toFixed(0).padStart(2, '0')} s` : `${r.toFixed(1).replace('.', ',')} s`; };

  // ── referências medidas: ações até o primeiro bug, média de 32 sementes por condição ──
  // repetição: qa-b2 + qa-b2-replica; curiosidade: qa-b2-curiosidade + réplica; normal: qa-b2-normal + réplica
  const REF = {
    repetida: {
      'cupom-duplo': { ativa: 5.0, congelada: 12.8, ativa_curiosa: 8.4, novidade: 8.8, aleatoria: 10.3 },
      'reserva-dupla': { ativa: 9.6, congelada: 13.8, ativa_curiosa: 7.2, novidade: 12.2, aleatoria: 16.9 },
      'quantidade-negativa': { ativa: 27.7, congelada: 21.7, ativa_curiosa: 13.4, novidade: 9.3, aleatoria: 10.2 },
    },
    normal: {
      'cupom-em-porcentagem': { ativa: 7.7, congelada: 12.4, novidade: 8.1, aleatoria: 11.5 },
      'baixa-sem-reserva': { ativa: 8.2, congelada: 13.4, novidade: 8.9, aleatoria: 13.7 },
      'quantidade-negativa': { ativa: 27.8, congelada: 24.1, novidade: 10.6, aleatoria: 17.9 },
    },
  };

  // ── estado da tela ──
  const S = {
    fase: '', fases: [], faseIdx: -1, contexto: '', cartas: [], resumo: '', resumoDopa: false,
    tempo: 0, wallInicio: 0, wallPausado: 0, med: { kc: 0, aprox: 0, evitar: 0, evitarRec: 0, pam: 0, ppl: 0 }, gl: {},
    val: {}, antes: {}, hist: [], marcas: [], treinos: [], teste: [], log: [], bugsTreino: 0, dopas: 0,
    car: 'repetida', cond: 'ativa', versoesTeste: [], sit: 'Baixando o conectoma…', rodando: false, carga: 0,
  };
  let sujo = true;
  const marca = () => { sujo = true; };
  function log(txt, tipo = '') { S.log.unshift({ t: S.tempo, txt, tipo }); if (S.log.length > 200) S.log.pop(); marca(); }

  // ── o worker ──
  const w = new Worker('sim-worker.js');
  let TAM = null, kcMask = null, aoTique = null, passo = 0, pronto = false;
  const kcJanela = [];
  // as vistas (caca-vistas.js) recebem cada bloco e podem pedir pausas de animação. A pausa para o relógio da tela,
  // não o cérebro: nenhum passo cerebral é acrescentado (a sessão continua igual à medida com a mesma semente)
  const ganchos = [];
  window.__cacaGancho = f => ganchos.push(f);
  async function pausaVisual(ms) {
    if (!window.__cacaPausa || parar) return;
    const t0 = performance.now(); await window.__cacaPausa(ms); S.wallPausado += performance.now() - t0;
  }
  w.onmessage = ({ data: m }) => {
    if (m.type === 'progress') { S.carga = m.total ? m.loaded / m.total : 0; S.sit = m.stage || 'Carregando…'; marca(); }
    else if (m.type === 'ready') { pronto = true; S.carga = 1; tentaLiberar(); }
    else if (m.type === 'error') { S.sit = 'Erro ao carregar o cérebro: ' + m.message; marca(); }
    else if (m.type === 'tick') { const f = aoTique; aoTique = null; if (f) f(m); }
  };
  w.postMessage({ type: 'load' });
  fetch('data/meta.json').then(r => r.json()).then(meta => {
    TAM = Object.fromEntries(Object.entries(meta.groups).map(([k, v]) => [k, v.length]));
    window.__cacaMeta = meta;
    kcMask = new Uint8Array(meta.neurons || 200000);
    for (const i of meta.groups.kc) kcMask[i] = 1;
    tentaLiberar();
  });
  function tentaLiberar() {
    if (!pronto || !TAM) return;
    S.sit = 'Cérebro pronto: 166.700 neurônios.'; $('btnIniciar').disabled = false; $('btnIniciar').textContent = 'Iniciar';
    preparaFases(); marca();
  }

  // cada bloco de 10 ms do cérebro: atualiza os medidores da tela
  const a = 0.25;   // suavização (~40 ms)
  function registra(m) {
    S.tempo += 0.01;
    for (const f of ganchos) f(m, S.tempo);
    const hz = g => (m.counts[g] || 0) / (TAM[g] || 1) / 0.01;
    const ema = (k, v) => { S.med[k] += a * (v - S.med[k]); };
    ema('aprox', hz('mbon_aprox')); ema('evitar', hz('mbon_evitar')); ema('evitarRec', hz('mbon_evitar_rec'));
    ema('pam', hz('recompensa')); ema('ppl', hz('dor'));
    const kcs = []; for (const id of m.spikes) if (kcMask[id]) kcs.push(id);
    kcJanela.push(kcs); if (kcJanela.length > 10) kcJanela.shift();
    S.med.kc = new Set(kcJanela.flat()).size;
    for (const g of glomerulos()) { const v = (hz('ORN_' + g + '_L') + hz('ORN_' + g + '_R')) / 2; S.gl[g] = (S.gl[g] || 0) + a * (v - (S.gl[g] || 0)); }
    marca();
  }

  let parar = false, pausado = false, retomar = null;
  async function tique(rates) {
    if (parar) throw new Error('parada');
    while (pausado) { const t0 = performance.now(); await new Promise(ok => (retomar = ok)); S.wallPausado += performance.now() - t0; if (parar) throw new Error('parada'); }
    return new Promise(ok => {
      aoTique = m => { registra(m); ok(m); };
      w.postMessage({ type: 'rates', rates });
      w.postMessage({ type: 'passoDuplo', passo: passo++ });
    });
  }
  const valencia = (c, s) => { const hz = g => c[g] / TAM[g] / s; return hz('mbon_aprox') - (hz('mbon_evitar') + hz('mbon_evitar_rec')) / 2; };
  async function roda(s, rates, parcial) {
    const c = { mbon_aprox: 0, mbon_evitar: 0, mbon_evitar_rec: 0 }, n = Math.round(s * 100);
    for (let i = 0; i < n; i++) { const m = await tique(rates); for (const g in c) c[g] += m.counts[g] || 0; if (parcial) parcial(valencia(c, (i + 1) / 100)); }
    return valencia(c, s);
  }
  async function sentir(acao, parcial) { const v = await roda(SENTIR_S, odor(acao), parcial); await roda(PAUSA_S, {}); anotaValencia(acao, v); return v; }
  async function recompensar(acao) {
    const o = odor(acao);
    S.dopas++; $('painelCerebro').classList.add('on'); S.resumo = `Bug novo: dopamina de recompensa junto do cheiro de "${ACAO_TXT[acao.id]}" (2 s, a PAM dispara no último meio segundo).`; S.resumoDopa = true;
    for (let i = 0; i < 200; i++) await tique(i >= 150 ? { ...o, recompensa: 100 } : o);
    await roda(PAUSA_S, {});
    $('painelCerebro').classList.remove('on'); S.resumoDopa = false;
  }
  function anotaValencia(acao, v) {
    S.val[acao.id] = v;
    const ids = Object.keys(S.val), prem = ids.filter(k => k.endsWith(':' + S.car)), out = ids.filter(k => !k.endsWith(':' + S.car));
    const med = l => (l.length ? l.reduce((t, k) => t + S.val[k], 0) / l.length : null);
    S.hist.push({ t: S.tempo, p: med(prem), o: med(out) });
    marca();
  }

  // ── um episódio (igual ao de qa_abstrato.mjs, bancada 2) ──
  async function episodio(defeitos, vistas, rnd, orcamento, teste, rotulo) {
    const sis = Q.criar(defeitos, { bancada: 2 }), achados = new Set(), bugs = [], tentadas = {};
    const curiosa = teste && S.cond.endsWith('_curiosa');
    for (let p = 0; p < orcamento; p++) {
      const opcoes = vistas[p];
      S.cartas = opcoes.map(acao => ({ acao, estado: 'aguardando', v: null, prob: null }));
      S.contexto = `${rotulo} · passo <b>${p + 1}</b> de ${orcamento} · versão: <b>${nomeVersao(defeitos)}</b>`;
      S.resumo = 'Ela cheira cada ação visível por 1 s; a valência é lida nas saídas do corpo cogumelar.';
      const v = [];
      for (let i = 0; i < opcoes.length; i++) {
        S.cartas[i].estado = 'cheirando';
        v.push(await sentir(opcoes[i], x => { S.cartas[i].v = x; marca(); }));
        S.cartas[i].v = v[i]; S.cartas[i].estado = 'feita';
      }
      const pontos = curiosa ? v.map((x, i) => x - H_CURIOSIDADE * (tentadas[opcoes[i].id] || 0)) : v;
      const e = pontos.map(x => Math.exp(x / T_SOFTMAX)), soma = e.reduce((x, y) => x + y, 0);
      e.forEach((x, i) => { S.cartas[i].prob = x / soma; if (curiosa) S.cartas[i].tentadas = tentadas[opcoes[i].id] || 0; });
      let u = rnd() * soma, k = 0; while (k < e.length - 1 && (u -= e[k]) > 0) k++;
      const escolha = opcoes[k];
      S.cartas[k].escolhida = true; marca();
      await pausaVisual(750);
      tentadas[escolha.id] = (tentadas[escolha.id] || 0) + 1;
      sis.executar(escolha.id);
      const novos = Q.verificar(sis).filter(x => !achados.has(x));
      if (novos.length) {
        for (const x of novos) { achados.add(x); bugs.push({ passo: p + 1, contrato: x, acao: escolha.id }); }
        S.cartas[k].bug = novos;
        log(`${rotulo}, passo ${p + 1}: "${ACAO_TXT[escolha.id]}" revelou um bug (${novos.map(x => CONTRATO_TXT[x] || x).join('; ')}).`, 'bug');
        if (!teste) S.bugsTreino++;
        marca();
        if (teste) { S.resumo = `Achou o bug em ${p + 1} ações. No teste não há recompensa.`; await pausaVisual(1400); break; }
        await pausaVisual(500);
        await recompensar(escolha);
        log(`Dopamina de recompensa pareada com o cheiro de "${ACAO_TXT[escolha.id]}".`, 'dopa');
      } else {
        S.cartas[k].nada = true;
        S.resumo = `Escolheu "${ACAO_TXT[escolha.id]}" (chance ${Math.round(100 * e[k] / soma)}%): nenhum contrato violado.`;
        marca();
        await pausaVisual(350);
      }
    }
    return bugs;
  }
  async function valencias(passadas, rotulo) {
    const r = {};
    for (let k = 0; k < passadas; k++) for (const acao of Q.ACOES) {
      S.cartas = [{ acao, estado: 'cheirando', v: null }];
      S.contexto = `${rotulo} · passada ${k + 1} de ${passadas} · ação <b>${Q.ACOES.indexOf(acao) + 1}</b> de ${Q.ACOES.length}`;
      S.resumo = 'Mede quanto ela gosta de cada uma das 15 ações, sem escolher nem recompensar.';
      const v = await sentir(acao, x => { S.cartas[0].v = x; marca(); });
      r[acao.id] = (r[acao.id] || 0) + v / passadas;
      S.cartas[0].v = v; S.cartas[0].estado = 'feita'; marca();
    }
    return r;
  }

  // ── a sessão ──
  let V = Q.VERSOES2;
  function glomerulos() { return Object.values(MAPAS[S.car]).flat(); }
  function preparaFases() {
    S.car = $('car').value; S.cond = $('cond').value; V = S.car === 'normal' ? Q.VERSOES2N : Q.VERSOES2;
    const medir = $('medir').checked;
    S.fases = ['Aquecimento', ...(medir ? ['Medir antes'] : []), ...Array.from({ length: TREINOS }, (_, i) => `Treino ${i + 1}`), ...(medir ? ['Medir depois'] : []),
      ...V.teste.map(d => 'Teste: ' + nomeVersao(d))];
    S.versoesTeste = V.teste.map(d => d.join('+'));
    marca();
  }
  function fase(nome) { S.faseIdx = S.fases.indexOf(nome); S.fase = nome; log(nome, 'fase'); S.marcas.push({ t: S.tempo, nome }); marca(); }

  async function sessao() {
    preparaFases();
    const sem = Math.max(1, Math.floor(+$('semente').value || 51)), medir = $('medir').checked;
    Q.usarCheiros(MAPAS[S.car]);
    Object.assign(S, { tempo: 0, val: {}, antes: {}, hist: [], marcas: [], treinos: [], teste: [], log: [], bugsTreino: 0, dopas: 0, cartas: [], resumo: '' });
    S.wallInicio = performance.now(); S.wallPausado = 0; passo = 0; kcJanela.length = 0;
    S.sit = `${COND_TXT[S.cond]} · bug premiado: ${S.car === 'normal' ? 'ação normal' : 'repetição'} · semente ${sem}`;
    log(`Sessão: ${S.sit}.`, 'fase');
    const treinos = Array.from({ length: TREINOS }, (_, i) => ({ defeitos: V.treino[i % V.treino.length], vistas: visiveis(sem * 100 + i, ORC_TREINO) }));
    const testes = V.teste.map((d, i) => ({ defeitos: d, vistas: visiveis(sem * 100 + 50 + i, ORCAMENTO) }));
    const rnd = gerador(sem * 31 + 17);
    w.postMessage({ type: 'reset' }); w.postMessage({ type: 'params', plasticidade: !S.cond.startsWith('congelada') }); w.postMessage({ type: 'semente', valor: sem });
    fase('Aquecimento');
    S.contexto = 'Um segundo sem cheiro e 15 cheiros ao acaso, para o cérebro sair do repouso.';
    await roda(1, {});
    { const ra = gerador(sem + 5); for (let i = 0; i < 15; i++) { const acao = Q.ACOES[Math.floor(ra() * Q.ACOES.length)]; S.cartas = [{ acao, estado: 'cheirando', v: null }]; await sentir(acao, x => { S.cartas[0].v = x; }); } }
    if (medir) { fase('Medir antes'); S.antes = await valencias(2, 'Medindo antes do treino'); S.val = { ...S.antes }; }
    for (let i = 0; i < treinos.length; i++) {
      const nome = `Treino ${i + 1}`; fase(nome);
      const b = await episodio(treinos[i].defeitos, treinos[i].vistas, rnd, ORC_TREINO, false, nome);
      S.treinos.push({ versao: treinos[i].defeitos, bugs: b }); marca();
    }
    if (medir) { fase('Medir depois'); const d = await valencias(2, 'Medindo depois do treino'); S.val = { ...d }; }
    for (let i = 0; i < testes.length; i++) {
      const nome = 'Teste: ' + nomeVersao(testes[i].defeitos); fase(nome);
      const b = await episodio(testes[i].defeitos, testes[i].vistas, rnd, ORCAMENTO, true, nome);
      const primeiro = b.length ? b[0].passo : ORCAMENTO + 1;
      S.teste.push({ versao: testes[i].defeitos.join('+'), primeiro });
      log(`${nome}: ${b.length ? `achou em ${primeiro} ações` : 'não achou em 30 ações'}.`, b.length ? 'bug' : '');
    }
    S.faseIdx = S.fases.length; S.fase = 'Fim'; S.cartas = [];
    S.contexto = 'Sessão concluída.';
    S.resumo = 'Compare a coluna "ao vivo" com as médias medidas no placar. Uma sessão é uma semente; as conclusões vêm de 32.';
    log('Fim da sessão.', 'fase');
  }

  // ── botões ──
  $('btnIniciar').addEventListener('click', async () => {
    if (S.rodando) return;
    S.rodando = true; parar = false; pausado = false;
    for (const id of ['cond', 'car', 'semente', 'medir']) $(id).disabled = true;
    $('btnIniciar').disabled = true; $('btnPausar').disabled = false; $('btnParar').disabled = false; $('btnPausar').textContent = 'Pausar';
    try { await sessao(); }
    catch (e) { if (e.message !== 'parada') { S.sit = 'Erro: ' + e.message; console.error(e); } else log('Sessão interrompida.', 'fase'); }
    S.rodando = false; aoTique = null;
    for (const id of ['cond', 'car', 'semente', 'medir']) $(id).disabled = false;
    $('btnIniciar').disabled = false; $('btnIniciar').textContent = 'Iniciar de novo'; $('btnPausar').disabled = true; $('btnParar').disabled = true;
    marca();
  });
  $('btnPausar').addEventListener('click', () => {
    pausado = !pausado; $('btnPausar').textContent = pausado ? 'Continuar' : 'Pausar';
    if (!pausado && retomar) { const r = retomar; retomar = null; r(); }
    log(pausado ? 'Pausado.' : 'Continuando.', 'fase');
  });
  $('btnParar').addEventListener('click', () => {
    parar = true; if (pausado) { pausado = false; if (retomar) { const r = retomar; retomar = null; r(); } }
  });
  for (const id of ['cond', 'car', 'medir']) $(id).addEventListener('change', () => { if (!S.rodando) preparaFases(); });

  // ── desenho ──
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // barra com o zero a 40% da largura: −1 na ponta esquerda, +1,5 na direita
  const posicao = x => (x >= 0 ? 40 + 60 * Math.min(x, 1.5) / 1.5 : 40 - 40 * Math.min(-x, 1));
  function barra0(v, antes, prem) {
    const p = v == null ? 40 : posicao(v);
    const marcaAntes = antes == null ? '' : `<span class="antes" style="left:${posicao(antes).toFixed(1)}%"></span>`;
    return `<div class="barra0"><i class="${prem ? 'prem' : ''}" style="left:${Math.min(40, p).toFixed(1)}%;width:${Math.abs(p - 40).toFixed(1)}%"></i>${marcaAntes}</div>`;
  }
  function desenhaCartas() {
    const el = $('cartas');
    if (!S.cartas.length) { el.innerHTML = ''; return; }
    el.innerHTML = S.cartas.map(c => {
      const a = c.acao, prem = a.entrada === S.car;
      const cls = ['carta', c.estado === 'cheirando' ? 'cheirando' : '', c.escolhida ? 'escolhida' : '', c.bug ? 'bug' : ''].join(' ');
      const selo = c.bug ? `<span class="selo bug">bug: ${esc(c.bug.map(x => CONTRATO_TXT[x] || x).join('; '))}</span>`
        : c.nada ? '<span class="selo">escolhida: sem bug</span>'
        : c.escolhida ? '<span class="selo ok">escolhida</span>'
        : c.estado === 'cheirando' ? '<span class="selo">cheirando…</span>' : '';
      const prob = c.prob != null ? ` · chance ${Math.round(c.prob * 100)}%` : '';
      const tent = c.tentadas ? ` · já tentou ${c.tentadas}×` : '';
      return `<div class="${cls}">
        <div class="tags"><span class="tag">${esc(CARAC_TXT[a.familia])}</span><span class="tag ${prem ? 'premiada' : ''}">${esc(CARAC_TXT[a.entrada])}</span></div>
        <div class="nome">${esc(ACAO_TXT[a.id])}</div>
        <div class="gloms">${Q.cheiroDe(a).map(g => `<span class="gl">${g}</span>`).join('')}</div>
        <div class="val"><div class="linha"><span>valência${prob}${tent}</span><b>${fmt(c.v)}</b></div>${barra0(c.v, null, prem)}</div>
        ${selo}
      </div>`;
    }).join('');
  }
  const MED = [
    ['kc', 'Células de Kenyon ativas', 'kc', 200, v => `${Math.round(v)}`],
    ['aprox', 'Saída "aproximar"', '', 8, v => `${fmt(v, 1)} Hz`],
    ['evitar', 'Saída "evitar"', '', 8, v => `${fmt(v, 1)} Hz`],
    ['evitarRec', 'Saída "evitar" que a dopamina enfraquece', '', 8, v => `${fmt(v, 1)} Hz`],
    ['pam', 'Dopamina de recompensa (PAM)', 'pam', 60, v => `${fmt(v, 0)} Hz`],
    ['ppl', 'Dopamina de punição (PPL1)', 'ppl', 60, v => `${fmt(v, 0)} Hz`],
  ];
  function desenhaMedidores() {
    const el = $('medidores');
    if (!el.children.length) el.innerHTML = MED.map(([k, rot, cls]) => `<div class="med ${cls}"><span>${rot}</span><div class="trilho"><i id="m_${k}"></i></div><span class="num" id="n_${k}"></span></div>`).join('');
    for (const [k, , , max, f] of MED) { $('m_' + k).style.width = Math.min(100, 100 * S.med[k] / max).toFixed(1) + '%'; $('n_' + k).textContent = f(S.med[k]); }
    const g = $('glomgrade'), mapa = MAPAS[S.car], chave = S.car + Object.keys(mapa).join();
    if (g.dataset.chave !== chave) {
      g.dataset.chave = chave;
      g.innerHTML = Object.entries(mapa).flatMap(([car, gs]) => gs.map(gl => `<div class="gcel ${car === S.car ? 'premiada' : ''}" id="g_${gl}"><b>${gl}</b><span>${CARAC_TXT[car]}</span></div>`)).join('');
    }
    for (const gl of glomerulos()) { const c = $('g_' + gl); if (c) { const x = Math.min(1, (S.gl[gl] || 0) / 60); c.style.background = x > 0.02 ? `color-mix(in srgb, var(--spike) ${Math.round(x * 70)}%, transparent)` : ''; } }
  }
  function desenhaBarras() {
    const ordem = [...Q.ACOES].sort((x, y) => (y.entrada === S.car) - (x.entrada === S.car));
    $('barras').innerHTML = ordem.map(a => `<div class="lin ${a.entrada === S.car ? 'premiada' : ''}"><span class="rot" title="${esc(a.id)}">${esc(ACAO_TXT[a.id])}</span>${barra0(S.val[a.id], S.antes[a.id], a.entrada === S.car)}<span class="num">${fmt(S.val[a.id])}</span></div>`).join('');
  }
  function desenhaGrafico() {
    const cv = $('grafico'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, Hh = cv.clientHeight;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
    const cs = getComputedStyle(document.documentElement), cor = n => cs.getPropertyValue(n).trim();
    const pad = { l: 34, r: 8, t: 16, b: 18 }, x0 = pad.l, x1 = W - pad.r, y0 = pad.t, y1 = Hh - pad.b;
    const tMax = Math.max(60, S.tempo), vMin = -0.6, vMax = 1.6;
    const X = t => x0 + (x1 - x0) * t / tMax, Y = v => y1 - (y1 - y0) * (v - vMin) / (vMax - vMin);
    ctx.font = '11px ' + cor('--mono'); ctx.fillStyle = cor('--muted'); ctx.strokeStyle = cor('--line'); ctx.lineWidth = 1;
    for (const v of [-0.5, 0, 0.5, 1, 1.5]) { ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke(); ctx.fillText(String(v).replace('.', ','), 2, Y(v) + 4); }
    ctx.setLineDash([3, 3]);
    for (const m of S.marcas) if (/^Treino 1$|Medir depois|^Teste/.test(m.nome)) { ctx.beginPath(); ctx.moveTo(X(m.t), y0); ctx.lineTo(X(m.t), y1); ctx.stroke(); ctx.fillText(m.nome.startsWith('Teste') ? 'teste' : m.nome === 'Treino 1' ? 'treino' : 'medir', X(m.t) + 3, y0 - 4); }
    ctx.setLineDash([]);
    ctx.fillText(fmtT(tMax) + ' de cérebro', x1 - 120, y1 + 14);
    for (const [k, c, lw] of [['o', cor('--em'), 1.5], ['p', cor('--spike'), 2.2]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); let ini = false;
      for (const h of S.hist) { if (h[k] == null) continue; const x = X(h.t), y = Y(Math.max(vMin, Math.min(vMax, h[k]))); if (!ini) { ctx.moveTo(x, y); ini = true; } else ctx.lineTo(x, y); }
      ctx.stroke();
    }
  }
  function desenhaPlacar() {
    $('treinos').innerHTML = S.treinos.map((t, i) => `<div><span>Treino ${i + 1} · ${esc(nomeVersao(t.versao))}</span><span class="mono">${t.bugs.length ? t.bugs.map(b => `passo ${b.passo}`).filter((x, j, a) => a.indexOf(x) === j).join(', ') : 'nenhum bug'}</span></div>`).join('') || '<div><span>O treino ainda não começou.</span></div>';
    const ref = REF[S.car], cols = [['ativa', 'Treinada'], ['congelada', 'Congelada'], ['ativa_curiosa', 'Curiosa'], ['novidade', 'Novidade'], ['aleatoria', 'Aleatória']];
    const linhas = S.versoesTeste.map(v => {
      const vivo = S.teste.find(x => x.versao === v), ctrl = v === V.controle.join('+');
      const r = ref[v] || {};
      return `<tr class="${ctrl ? 'controle' : ''}"><td>${esc(nomeVersao(v.split('+')))}</td><td class="vivo">${vivo ? (vivo.primeiro > ORCAMENTO ? 'não achou' : vivo.primeiro) : '…'}</td>${cols.map(([k]) => `<td class="mono">${r[k] != null ? fmt(r[k], 1) : '—'}</td>`).join('')}</tr>`;
    }).join('');
    $('tabela').innerHTML = `<thead><tr><th>Versão de teste</th><th>Ao vivo</th>${cols.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead><tbody>${linhas}</tbody>`;
    $('notaRef').textContent = 'Ao vivo: esta sessão (' + COND_TXT[S.cond] + '). As outras colunas são médias medidas em 32 sementes (as treinadas e congeladas com cérebro; novidade e aleatória sem cérebro). Menos ações é melhor. O controle é um bug de outro tipo: lá, aprender não deve ajudar.';
  }
  function desenhaLog() {
    $('log').innerHTML = S.log.slice(0, 120).map(l => `<li class="${l.tipo}"><span class="mono">${fmt(l.t, 1)} s</span><span>${esc(l.txt)}</span></li>`).join('');
  }
  function desenhaEstado() {
    $('stTempo').textContent = fmtT(S.tempo);
    const wall = (performance.now() - S.wallInicio - S.wallPausado) / 1000;
    $('stVel').textContent = S.rodando && wall > 1 ? `${fmt(S.tempo / wall, 2)}× o tempo real` : '—';
    $('stBugs').textContent = String(S.bugsTreino);
    $('stDopa').textContent = `${S.dopas} ${S.dopas === 1 ? 'vez' : 'vezes'}`;
    $('stSit').textContent = S.sit; $('carga').style.width = (100 * S.carga).toFixed(0) + '%';
    $('agoraFase').textContent = S.fase || '—';
    $('fases').innerHTML = S.fases.map((f, i) => `<li class="${i < S.faseIdx ? 'feita' : i === S.faseIdx ? 'agora' : ''} ${f.startsWith('Teste') ? 'teste' : ''}">${esc(f)}</li>`).join('');
    $('contexto').innerHTML = S.contexto || $('contexto').innerHTML;
    const r = $('resumoAgora'); r.textContent = S.resumo; r.classList.toggle('dopa', S.resumoDopa);
  }
  let ultimoGrafico = 0;
  function quadro(agora) {
    if (sujo) {
      sujo = false;
      desenhaEstado(); desenhaCartas(); desenhaMedidores(); desenhaBarras(); desenhaPlacar(); desenhaLog();
      if (agora - ultimoGrafico > 250) { ultimoGrafico = agora; desenhaGrafico(); }
    }
    requestAnimationFrame(quadro);
  }
  window.addEventListener('resize', () => { ultimoGrafico = 0; marca(); });
  preparaFases();
  requestAnimationFrame(quadro);
  // para conferir no console ou num teste sem janela
  window.__caca = S;
})();
