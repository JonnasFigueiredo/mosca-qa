// Vistas da tela "Caça a bugs ao vivo" (caca.html): a mosca, o cérebro em 3D e o painel, que podem ser ligados um a
// um. Só lê o estado de caca.js (window.__caca) e os disparos de cada bloco de 10 ms; não muda o cérebro nem o
// protocolo.
// - A mosca é uma ilustração do protocolo: cheira cada ação visível pela ordem em que o cérebro a cheira, anda até a
//   escolhida e prova. O corpo e o passo são desenho; a escolha, a valência e a dopamina vêm do cérebro.
// - O cérebro 3D é o da página principal: cada ponto é um neurônio do Male CNS (posição do corpo celular) e acende
//   quando dispara; as formas reais (esqueletos) mostram as saídas do corpo cogumelar e a dopamina.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const st = () => window.__caca;
  const guarda = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
  };
  const cor = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  // cor do tema com transparência, para o canvas (que não entende color-mix)
  const rgba = (n, al) => { const h = cor(n).replace('#', ''); const v = h.length === 3 ? h.split('').map(x => x + x).join('') : h; const i = parseInt(v, 16); return `rgba(${(i >> 16) & 255},${(i >> 8) & 255},${i & 255},${al})`; };
  const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── quais vistas aparecem ──
  const VISTAS = ['mosca', 'cerebro', 'painel'];
  let ativas = new Set((guarda.get('caca:vistas') || VISTAS.join(',')).split(',').filter(v => VISTAS.includes(v)));
  if (!ativas.size) ativas = new Set(VISTAS);
  function aplica() {
    for (const v of VISTAS) document.body.classList.toggle('v-' + v, ativas.has(v));
    document.querySelectorAll('[data-vista]').forEach(b => b.setAttribute('aria-pressed', String(ativas.has(b.dataset.vista))));
    $('palco').hidden = !ativas.has('mosca') && !ativas.has('cerebro');
    $('vPainel').hidden = !ativas.has('painel');
    guarda.set('caca:vistas', [...ativas].join(','));
    if (ativas.has('cerebro')) iniciaCerebro();
    requestAnimationFrame(() => { redimensiona(); window.dispatchEvent(new Event('resize')); });
  }
  function alterna(v) { if (ativas.has(v) && ativas.size === 1) return; if (ativas.has(v)) ativas.delete(v); else ativas.add(v); aplica(); }
  function foca(v) { ativas = new Set([v]); aplica(); }
  document.querySelectorAll('[data-vista]').forEach(b => b.addEventListener('click', () => alterna(b.dataset.vista)));
  document.querySelectorAll('[data-foco]').forEach(b => b.addEventListener('click', () => (ativas.size === 1 && ativas.has(b.dataset.foco) ? (ativas = new Set(VISTAS), aplica()) : foca(b.dataset.foco))));
  $('vTudo').addEventListener('click', () => { ativas = new Set(VISTAS); aplica(); });
  document.querySelectorAll('[data-cheia]').forEach(b => b.addEventListener('click', () => {
    const el = $(b.dataset.cheia);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }));
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(redimensiona));
  addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const v = { 1: 'mosca', 2: 'cerebro', 3: 'painel' }[e.key];
    if (v) { alterna(v); e.preventDefault(); }
    if (e.key === '0') { ativas = new Set(VISTAS); aplica(); }
  });
  // pausas da animação (só com a mosca à vista): o cérebro não avança durante elas
  window.__cacaPausa = ms => (ativas.has('mosca') && !reduzMovimento() ? new Promise(ok => setTimeout(ok, ms)) : Promise.resolve());

  // ── canvas com a densidade da tela ──
  function ajusta(cv) {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (w && h && (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr))) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    return { w, h, dpr };
  }
  function redimensiona() { M.particulas = []; if (ativas.has('mosca')) ajusta($('cvMosca')); if (cerebro.renderer) cerebro.tamanho = null; }
  addEventListener('resize', redimensiona);

  /* ───────────── A mosca ───────────── */
  const M = { x: 0.5, y: 0.8, ang: -Math.PI / 2, passo: 0, prob: 0, ultimo: 0, andando: 0, particulas: [], brilho: 0, cartasChave: '' };
  const ACAO_TXT = {
    'carrinho:normal': 'pôr 1 item no carrinho', 'carrinho:zero': 'pôr quantidade zero', 'carrinho:negativa': 'pôr quantidade negativa',
    'carrinho:limite': 'pôr o estoque todo no carrinho', 'estoque:normal': 'abrir o pedido', 'estoque:limite': 'pedir o estoque inteiro',
    'estoque:repetida': 'reservar duas vezes', 'pagamento:normal': 'pagar', 'pagamento:zero': 'pagar pedido vazio', 'pagamento:repetida': 'pagar duas vezes',
    'cancelamento:normal': 'cancelar', 'cancelamento:repetida': 'cancelar duas vezes', 'cupom:normal': 'aplicar cupom de 10%',
    'cupom:limite': 'aumentar o cupom até o máximo', 'cupom:repetida': 'aplicar o mesmo cupom duas vezes',
  };
  const CONTRATO_TXT = {
    'estoque-negativo': 'estoque negativo', 'estoque-acima-do-inicial': 'estoque acima do inicial', 'estoque-inconsistente': 'estoque não fecha a conta',
    'cobranca-duplicada': 'cobrado duas vezes', 'cobranca-sem-valor': 'cobrança de valor zero', 'total-nao-finito': 'total inválido',
    'total-negativo': 'total negativo', 'quantidade-negativa-aceita': 'quantidade negativa aceita', 'desconto-acima-do-limite': 'desconto acima de 30%',
  };
  // onde ficam as ações visíveis (frações da tela) e onde a mosca espera
  const lugares = n => (n === 1 ? [{ x: 0.5, y: 0.27 }] : [{ x: 0.19, y: 0.31 }, { x: 0.5, y: 0.22 }, { x: 0.81, y: 0.31 }]);
  const CASA = { x: 0.5, y: 0.78 };

  function quebra(ctx, txt, larg) {
    const ps = txt.split(' '), linhas = []; let l = '';
    for (const p of ps) { const t = l ? l + ' ' + p : p; if (ctx.measureText(t).width > larg && l) { linhas.push(l); l = p; } else l = t; }
    if (l) linhas.push(l);
    return linhas.slice(0, 2);
  }
  function retangulo(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }

  function desenhaCarta(ctx, c, cx, cy, tw, th, car, agora) {
    const x = cx - tw / 2, y = cy - th / 2, a = c.acao, prem = a.entrada === car;
    const cheirando = c.estado === 'cheirando';
    ctx.save();
    if (cheirando) { ctx.shadowColor = cor('--spike'); ctx.shadowBlur = 18; }
    retangulo(ctx, x, y, tw, th, 10); ctx.fillStyle = cor('--surface'); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = c.bug || c.escolhida || cheirando ? 2.5 : 1;
    ctx.strokeStyle = c.bug ? cor('--bug') : cheirando ? cor('--spike') : c.escolhida ? cor('--ink') : cor('--line');
    ctx.stroke();
    if (c.nada) { ctx.globalAlpha = 0.55; }
    // etiquetas
    ctx.font = `500 11px ${cor('--mono')}`; ctx.textBaseline = 'top';
    let ex = x + 10;
    for (const [t, p] of [[a.familia, false], [a.entrada, prem]]) {
      const w = ctx.measureText(t).width + 10;
      retangulo(ctx, ex, y + 9, w, 17, 4); ctx.fillStyle = p ? cor('--spike') : cor('--track'); ctx.fill();
      ctx.fillStyle = p ? '#fff' : cor('--em'); ctx.fillText(t, ex + 5, y + 11.5); ex += w + 5;
    }
    // nome
    ctx.font = `600 14px ${cor('--sans')}`; ctx.fillStyle = cor('--ink');
    quebra(ctx, ACAO_TXT[a.id] || a.id, tw - 20).forEach((l, i) => ctx.fillText(l, x + 10, y + 33 + i * 17));
    // valência
    const by = y + th - 24, bw = tw - 20;
    ctx.fillStyle = cor('--track'); retangulo(ctx, x + 10, by, bw, 8, 3); ctx.fill();
    if (c.v != null) {
      const pos = v => (v >= 0 ? 0.4 + 0.6 * Math.min(v, 1.5) / 1.5 : 0.4 - 0.4 * Math.min(-v, 1));
      const p0 = 0.4, p1 = pos(c.v);
      ctx.fillStyle = prem ? cor('--spike') : cor('--em');
      ctx.fillRect(x + 10 + bw * Math.min(p0, p1), by, bw * Math.abs(p1 - p0), 8);
    }
    ctx.fillStyle = cor('--muted'); ctx.fillRect(x + 10 + bw * 0.4, by - 2, 1, 12);
    ctx.font = `11px ${cor('--mono')}`; ctx.fillStyle = cor('--muted');
    const val = c.v == null ? 'valência —' : `valência ${c.v.toFixed(2).replace('.', ',')}`;
    ctx.fillText(val + (c.prob != null ? ` · chance ${Math.round(c.prob * 100)}%` : ''), x + 10, by + 11);
    ctx.globalAlpha = 1;
    // bug: a carta trinca
    if (c.bug) {
      ctx.strokeStyle = cor('--bug'); ctx.lineWidth = 2;
      ctx.beginPath(); let px = x + tw * 0.15, py = y + 4; ctx.moveTo(px, py);
      for (let i = 1; i <= 6; i++) { px = x + tw * (0.15 + 0.12 * i); py = y + (i % 2 ? th * 0.55 : th * 0.2) + Math.sin(agora / 90 + i) * 2; ctx.lineTo(px, py); }
      ctx.stroke();
      const txt = 'BUG: ' + c.bug.map(b => CONTRATO_TXT[b] || b).join('; ');
      ctx.font = `600 12px ${cor('--mono')}`;
      const w = Math.min(ctx.measureText(txt).width + 14, tw + 60);
      retangulo(ctx, cx - w / 2, y - 26, w, 20, 5); ctx.fillStyle = cor('--bug'); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, cx, y - 22, w - 10); ctx.textAlign = 'left';
    } else if (c.nada) {
      ctx.font = `500 11px ${cor('--mono')}`; ctx.fillStyle = cor('--muted'); ctx.textAlign = 'center'; ctx.fillText('sem bug', cx, y - 16); ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  // a mosca vista de cima, apontando para +x. L = comprimento do corpo em px
  function desenhaMosca(ctx, x, y, ang, L, passo, prob, antenas) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(-0.02 * L, 0.06 * L, 0.5 * L, 0.2 * L, 0, 0, 7); ctx.fill();
    // patas: trípode (L1, R2, L3 contra R1, L2, R3)
    ctx.strokeStyle = '#3b2a17'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const raiz = [0.12, 0.05, -0.02], base = [0.85, 1.6, 2.35];
    for (const lado of [-1, 1]) for (let i = 0; i < 3; i++) {
      const grupo = (i + (lado > 0 ? 1 : 0)) % 2, osc = Math.sin(passo + grupo * Math.PI) * 0.28;
      const a0 = lado * (base[i] + (i === 1 ? osc * 0.6 : osc)), rx = raiz[i] * L;
      const jx = rx + Math.cos(a0) * 0.28 * L, jy = Math.sin(a0) * 0.28 * L;
      const a1 = a0 + lado * (i === 0 ? -0.5 : i === 1 ? 0.15 : 0.45);
      ctx.lineWidth = 0.035 * L; ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(jx, jy); ctx.lineTo(jx + Math.cos(a1) * 0.3 * L, jy + Math.sin(a1) * 0.3 * L); ctx.stroke();
    }
    // asas
    for (const lado of [-1, 1]) {
      ctx.save(); ctx.translate(-0.05 * L, lado * 0.08 * L); ctx.rotate(Math.PI + lado * -0.32);
      ctx.fillStyle = 'rgba(205,225,240,.42)'; ctx.strokeStyle = 'rgba(120,140,160,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0.27 * L, 0, 0.32 * L, 0.11 * L, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.02 * L, 0); ctx.lineTo(0.52 * L, 0); ctx.stroke();
      ctx.restore();
    }
    // abdome listrado
    ctx.fillStyle = '#c9a063'; ctx.beginPath(); ctx.ellipse(-0.24 * L, 0, 0.25 * L, 0.15 * L, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 0.035 * L;
    for (const sx of [-0.12, -0.24, -0.36]) { ctx.beginPath(); ctx.ellipse(sx * L, 0, 0.035 * L, 0.135 * L, 0, -1.3, 1.3); ctx.stroke(); }
    // tórax
    ctx.fillStyle = '#9b7442'; ctx.beginPath(); ctx.ellipse(0.06 * L, 0, 0.15 * L, 0.125 * L, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-0.06 * L, 0); ctx.lineTo(0.18 * L, 0); ctx.stroke();
    // probóscide (estende quando ela prova)
    if (prob > 0.02) { ctx.strokeStyle = '#7a4f2a'; ctx.lineWidth = 0.04 * L; ctx.beginPath(); ctx.moveTo(0.3 * L, 0); ctx.lineTo((0.3 + 0.16 * prob) * L, 0); ctx.stroke(); }
    // cabeça e olhos vermelhos
    ctx.fillStyle = '#a7804c'; ctx.beginPath(); ctx.arc(0.25 * L, 0, 0.095 * L, 0, 7); ctx.fill();
    ctx.fillStyle = '#b3261e';
    for (const lado of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0.25 * L, lado * 0.07 * L, 0.07 * L, 0.05 * L, lado * 0.4, 0, 7); ctx.fill(); }
    // antenas (mexem quando ela cheira)
    ctx.strokeStyle = '#4a3218'; ctx.lineWidth = 0.025 * L;
    for (const lado of [-1, 1]) {
      const w = antenas * Math.sin(performance.now() / 70 + lado) * 0.25;
      ctx.beginPath(); ctx.moveTo(0.33 * L, lado * 0.025 * L); ctx.lineTo(0.4 * L, lado * (0.05 + w * 0.1) * L); ctx.lineTo(0.47 * L, lado * (0.09 + w * 0.2) * L); ctx.stroke();
    }
    ctx.restore();
  }

  function quadroMosca(agora) {
    const cv = $('cvMosca'), { w: W, h: H, dpr } = ajusta(cv);
    if (!W || !H) return;
    const ctx = cv.getContext('2d'), S = st();
    const dt = Math.min(0.05, (agora - (M.ultimo || agora)) / 1000); M.ultimo = agora;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    // chão: a bancada, com uma grade leve
    ctx.fillStyle = cor('--bg'); ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = cor('--track'); ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 32) { ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(W, gy + 0.5); ctx.stroke(); }
    if (!S) return;
    const cartas = S.cartas || [], lug = lugares(cartas.length), L = Math.max(46, Math.min(84, Math.min(W, H) * 0.13));
    const tw = Math.min(230, W * (cartas.length === 1 ? 0.42 : 0.29)), th = 96;
    const px = f => f.x * W, py = f => f.y * H;
    // alvo da mosca
    const ich = cartas.findIndex(c => c.estado === 'cheirando'), iesc = cartas.findIndex(c => c.escolhida);
    let alvo = { x: CASA.x * W, y: CASA.y * H }, olhar = null, prova = false;
    if (iesc >= 0 && ich < 0) { const l = lug[iesc]; alvo = { x: px(l), y: py(l) + th / 2 + L * 0.62 }; olhar = { x: px(l), y: py(l) }; prova = true; }
    else if (ich >= 0) { const l = lug[ich]; olhar = { x: px(l), y: py(l) }; }
    const pos = { x: M.x * W, y: M.y * H }, dx = alvo.x - pos.x, dy = alvo.y - pos.y, dist = Math.hypot(dx, dy);
    const vel = Math.max(W, H) * 1.1, anda = dist > 2;
    if (anda) { const k = Math.min(1, vel * dt / dist); pos.x += dx * k; pos.y += dy * k; M.passo += dt * 22; }
    M.x = pos.x / W; M.y = pos.y / H;
    const angAlvo = anda ? Math.atan2(dy, dx) : olhar ? Math.atan2(olhar.y - pos.y, olhar.x - pos.x) : -Math.PI / 2;
    let da = angAlvo - M.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    M.ang += da * Math.min(1, dt * 9);
    M.prob += ((prova && !anda ? 1 : 0) - M.prob) * Math.min(1, dt * 8);
    // a pluma de cheiro: da ação que ela está cheirando até as antenas
    if (ich >= 0 && !reduzMovimento()) {
      const l = lug[ich], cab = { x: pos.x + Math.cos(M.ang) * L * 0.45, y: pos.y + Math.sin(M.ang) * L * 0.45 };
      if (agora - (M.ultimaParticula || 0) > 28) { M.ultimaParticula = agora; M.particulas.push({ x: px(l) + (Math.random() - 0.5) * tw * 0.5, y: py(l) + th * 0.3, alvo: cab, t0: agora, vida: 900 + Math.random() * 500 }); }
    }
    ctx.fillStyle = cor('--spike');
    M.particulas = M.particulas.filter(p => agora - p.t0 < p.vida);
    for (const p of M.particulas) {
      const k = (agora - p.t0) / p.vida, x = p.x + (p.alvo.x - p.x) * k + Math.sin(k * 9 + p.vida * 7) * 8, y = p.y + (p.alvo.y - p.y) * k;
      ctx.globalAlpha = 0.5 * (1 - k); ctx.beginPath(); ctx.arc(x, y, 2.4 + 2 * k, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // cartas
    cartas.forEach((c, i) => desenhaCarta(ctx, c, px(lug[i]), py(lug[i]), tw, th, S.car, agora));
    // dopamina: brilho verde em volta dela durante o pareamento com a recompensa
    M.brilho += ((S.resumoDopa ? 1 : 0) - M.brilho) * Math.min(1, dt * 6);
    if (M.brilho > 0.02) {
      const r = L * (1.1 + 0.15 * Math.sin(agora / 160)), g = ctx.createRadialGradient(pos.x, pos.y, L * 0.2, pos.x, pos.y, r * 1.6);
      g.addColorStop(0, rgba('--ok', 0.55 * M.brilho));
      g.addColorStop(1, rgba('--ok', 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(pos.x, pos.y, r * 1.6, 0, 7); ctx.fill();
      ctx.globalAlpha = M.brilho; ctx.font = `600 12px ${cor('--mono')}`; ctx.fillStyle = cor('--ok'); ctx.textAlign = 'center';
      ctx.fillText('dopamina de recompensa (PAM)', pos.x, pos.y + L * 0.95); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    desenhaMosca(ctx, pos.x, pos.y, M.ang, L, M.passo, M.prob, ich >= 0 ? 1 : 0.15);
    // legenda de cima: fase e passo
    ctx.font = `500 12px ${cor('--mono')}`; ctx.fillStyle = cor('--muted'); ctx.textBaseline = 'top';
    ctx.fillText((S.fase || 'Pronta para começar').toUpperCase(), 14, 12);
    const ctx2 = (S.contexto || '').replace(/<[^>]+>/g, '');
    if (ctx2) { ctx.font = `13px ${cor('--sans')}`; ctx.fillStyle = cor('--ink'); ctx.fillText(ctx2.slice(0, 110), 14, 30); }
    ctx.font = `12px ${cor('--mono')}`; ctx.fillStyle = cor('--muted'); ctx.textBaseline = 'alphabetic';
    ctx.fillText(`bugs no treino ${S.bugsTreino} · dopamina ${S.dopas}×`, 14, H - 14);
    ctx.textAlign = 'right'; ctx.fillText('ilustração: a escolha vem do cérebro', W - 14, H - 14); ctx.textAlign = 'left';
  }

  /* ───────────── O cérebro em 3D (o mesmo da página principal) ───────────── */
  const cerebro = { iniciando: false, renderer: null, scene: null, camera: null, uniforms: null, last: null, formas: null, faixa: new Map(),
    rotY: 0.5, rotX: 0.12, dist: 2300, alvo: { x: 0, y: -60, z: 0 }, alvoQuer: null, distQuer: null, girar: true, pos: null, kcCentro: null, tamanho: null };
  async function iniciaCerebro() {
    if (cerebro.iniciando) return;
    cerebro.iniciando = true;
    const hud = $('hudCerebro');
    if (!window.THREE) { hud.textContent = 'O three.js não carregou (sem internet?): o cérebro 3D fica indisponível.'; return; }
    hud.textContent = 'Carregando as posições dos 166.700 neurônios…';
    try {
      const b64 = f => fetch('data/' + f).then(r => r.text()).then(t => Uint8Array.from(atob(t), c => c.charCodeAt(0)).buffer);
      const [nb, rb] = await Promise.all([b64('neurons.b64.txt'), b64('region.b64.txt')]);
      const dv = new DataView(nb), N = nb.byteLength / 8, pos = new Float32Array(N * 3), region = new Float32Array(new Uint8Array(rb));
      for (let i = 0; i < N; i++) { pos[i * 3] = dv.getInt16(i * 8, true); pos[i * 3 + 1] = -dv.getInt16(i * 8 + 4, true); pos[i * 3 + 2] = dv.getInt16(i * 8 + 2, true); }
      cerebro.pos = pos;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      cerebro.last = new THREE.BufferAttribute(new Float32Array(N).fill(-1e6), 1); cerebro.last.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aLast', cerebro.last);
      geo.setAttribute('aRegion', new THREE.BufferAttribute(region, 1));
      const U = cerebro.uniforms = { uNow: { value: 0 }, uBase: { value: new THREE.Color() }, uSpike: { value: new THREE.Color() }, uPR: { value: Math.min(devicePixelRatio || 1, 2) }, uDark: { value: 0 }, uDim: { value: 0.55 } };
      const mat = new THREE.ShaderMaterial({
        uniforms: U, transparent: true, depthWrite: false,
        vertexShader: `attribute float aLast; attribute float aRegion; uniform float uNow; uniform float uPR; varying float vB; varying float vR;
          void main() { float b = exp(-max(uNow - aLast, 0.0) / 0.22); vB = b; vR = aRegion;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = (1.3 + 3.2 * b) * uPR; }`,
        fragmentShader: `uniform vec3 uBase; uniform vec3 uSpike; uniform float uDark; uniform float uDim; varying float vB; varying float vR;
          void main() { vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard;
            float shade = vR == 1.0 ? 0.85 : (vR == 2.0 ? 1.1 : (vR == 4.0 ? 1.45 : 1.0));
            gl_FragColor = vec4(mix(uBase * shade, uSpike, vB), mix(uDark > 0.5 ? 0.16 : 0.13, 1.0, vB) * uDim); }`,
      });
      const pontos = new THREE.Points(geo, mat);
      cerebro.scene = new THREE.Scene(); cerebro.scene.add(pontos);
      const cv = $('cvCerebro');
      cerebro.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: false });
      cerebro.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      cerebro.camera = new THREE.PerspectiveCamera(32, 1, 10, 6000);
      tema();
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
      // girar arrastando, aproximar com a roda
      let px = 0, py = 0, arrastando = false;
      cv.addEventListener('pointerdown', e => { arrastando = true; cerebro.girar = false; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', e => { if (!arrastando) return; cerebro.rotY += (e.clientX - px) * 0.008; cerebro.rotX = Math.max(-1.2, Math.min(1.2, cerebro.rotX + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; });
      cv.addEventListener('pointerup', () => { arrastando = false; });
      cv.addEventListener('wheel', e => { e.preventDefault(); cerebro.distQuer = Math.max(350, Math.min(4000, (cerebro.distQuer ?? cerebro.dist) * Math.exp(e.deltaY * 0.001))); }, { passive: false });
      hud.textContent = 'Cada ponto é um neurônio e acende quando dispara. Arraste para girar; a roda aproxima.';
      centroKC();
      carregaFormas();
    } catch (e) { hud.textContent = 'Sem o cérebro 3D: ' + e.message; console.warn(e); }
  }
  function tema() {
    if (!cerebro.uniforms) return;
    const escuro = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    cerebro.uniforms.uBase.value = new THREE.Color(cor('--em')); cerebro.uniforms.uSpike.value = new THREE.Color(cor('--spike'));
    cerebro.uniforms.uDark.value = escuro ? 1 : 0;
    cerebro.renderer.setClearColor(new THREE.Color(cor('--surface')));
  }
  function centroKC() {
    const meta = window.__cacaMeta;
    if (!meta || !cerebro.pos) { setTimeout(centroKC, 500); return; }
    let x = 0, y = 0, z = 0; const kc = meta.groups.kc;
    for (const i of kc) { x += cerebro.pos[i * 3]; y += cerebro.pos[i * 3 + 1]; z += cerebro.pos[i * 3 + 2]; }
    cerebro.kcCentro = { x: x / kc.length, y: y / kc.length, z: z / kc.length };
  }
  async function carregaFormas() {
    try {
      const [txt, info] = await Promise.all([fetch('data/esqueletos.b64.txt').then(r => r.text()), fetch('data/esqueletos.json').then(r => r.json())]);
      const buf = Uint8Array.from(atob(txt), c => c.charCodeAt(0)).buffer, dv = new DataView(buf);
      const K = dv.getUint32(0, true), V = dv.getUint32(4, true), E = dv.getUint32(8, true);
      let o = 12;
      const alvo = new Int32Array(buf, o, K); o += 4 * K;
      const grupo = new Uint8Array(buf, o, K); o += K + (4 - K % 4) % 4;
      const iniV = new Uint32Array(buf, o, K + 1); o += 4 * (K + 1);
      const iniE = new Uint32Array(buf, o, K + 1); o += 4 * (K + 1);
      const vert = new Int16Array(buf, o, V * 3); o += 6 * V;
      const ares = new Uint16Array(buf, o, E * 2);
      const pos = new Float32Array(V * 3), grp = new Float32Array(V), idx = new Uint32Array(E * 2);
      for (let k = 0; k < K; k++) {
        cerebro.faixa.set(alvo[k], [iniV[k], iniV[k + 1]]);
        for (let v = iniV[k]; v < iniV[k + 1]; v++) { pos[v * 3] = vert[v * 3] / 2; pos[v * 3 + 1] = -vert[v * 3 + 2] / 2; pos[v * 3 + 2] = vert[v * 3 + 1] / 2; grp[v] = grupo[k]; }
        for (let e = iniE[k]; e < iniE[k + 1]; e++) { idx[e * 2] = ares[e * 2] + iniV[k]; idx[e * 2 + 1] = ares[e * 2 + 1] + iniV[k]; }
      }
      // na caça a bugs, contam as saídas do corpo cogumelar e a dopamina; os outros grupos ficam bem apagados
      const relevante = info.grupos.map(g => /MBON|PAM|PPL1/.test(g.nome));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aGrupo', new THREE.BufferAttribute(grp, 1));
      cerebro.formasLast = new THREE.BufferAttribute(new Float32Array(V).fill(-1e6), 1); cerebro.formasLast.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aLast', cerebro.formasLast);
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const n = info.grupos.length;
      const mat = new THREE.ShaderMaterial({
        uniforms: { uNow: cerebro.uniforms.uNow, uDark: cerebro.uniforms.uDark, uCores: { value: info.grupos.map(g => new THREE.Color(g.cor)) }, uRel: { value: relevante.map(r => (r ? 1 : 0.12)) } },
        transparent: true, depthWrite: false,
        vertexShader: `attribute float aLast; attribute float aGrupo; uniform float uNow; uniform float uDark; uniform vec3 uCores[${n}]; uniform float uRel[${n}];
          varying vec3 vCor; varying float vB; varying float vRel;
          void main() { vec3 c = uCores[0]; float r = uRel[0];
            for (int i = 1; i < ${n}; i++) if (float(i) == aGrupo) { c = uCores[i]; r = uRel[i]; }
            vCor = uDark > 0.5 ? c : c * 0.62; vRel = r; vB = exp(-max(uNow - aLast, 0.0) / 0.3);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uDark; varying vec3 vCor; varying float vB; varying float vRel;
          void main() { gl_FragColor = vec4(mix(vCor, uDark > 0.5 ? vec3(1.0) : vec3(0.05), vB * 0.8), mix(0.3, 1.0, vB) * vRel); }`,
      });
      cerebro.formas = new THREE.LineSegments(geo, mat); cerebro.formas.frustumCulled = false;
      cerebro.scene.add(cerebro.formas);
      $('legCerebro').innerHTML = info.grupos.filter((g, i) => relevante[i]).map(g => `<li><i style="background:${g.cor}"></i>${g.nome}</li>`).join('') +
        '<li><i style="background:var(--spike)"></i>pontos: todos os neurônios (acendem ao disparar)</li>';
    } catch (e) { console.warn('sem as formas reais:', e); }
  }
  // disparos de cada bloco de 10 ms, no tempo do cérebro
  window.__cacaGancho?.((m, t) => {
    if (!cerebro.last) return;
    const a = cerebro.last.array;
    for (let s = 0; s < m.spikes.length; s++) a[m.spikes[s]] = t;
    if (m.spikes.length) cerebro.last.needsUpdate = true;
    if (cerebro.formasLast) {
      const fa = cerebro.formasLast.array; let mudou = false;
      for (let s = 0; s < m.spikes.length; s++) { const r = cerebro.faixa.get(m.spikes[s]); if (r) { fa.fill(t, r[0], r[1]); mudou = true; } }
      if (mudou) cerebro.formasLast.needsUpdate = true;
    }
  });
  $('camInteiro').addEventListener('click', () => { cerebro.alvoQuer = { x: 0, y: -60, z: 0 }; cerebro.distQuer = 2300; });
  $('camCogumelar').addEventListener('click', () => { if (cerebro.kcCentro) { cerebro.alvoQuer = cerebro.kcCentro; cerebro.distQuer = 760; } });
  $('camGirar').addEventListener('click', () => { cerebro.girar = !cerebro.girar; $('camGirar').setAttribute('aria-pressed', String(cerebro.girar)); });
  function quadroCerebro(dt) {
    const c = cerebro; if (!c.renderer) return;
    const cv = c.renderer.domElement, w = cv.clientWidth, h = cv.clientHeight, pr = c.renderer.getPixelRatio();
    if (!w || !h) return;
    if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { c.renderer.setSize(w, h, false); c.camera.aspect = w / h; c.camera.updateProjectionMatrix(); }
    const S = st();
    if (c.girar && S?.rodando && !reduzMovimento()) c.rotY += dt * 0.12;
    if (c.alvoQuer) { const k = Math.min(1, dt * 3); for (const e of ['x', 'y', 'z']) c.alvo[e] += (c.alvoQuer[e] - c.alvo[e]) * k; }
    if (c.distQuer != null) c.dist += (c.distQuer - c.dist) * Math.min(1, dt * 3);
    c.camera.position.set(c.alvo.x + Math.sin(c.rotY) * Math.cos(c.rotX) * c.dist, c.alvo.y + Math.sin(c.rotX) * c.dist, c.alvo.z + Math.cos(c.rotY) * Math.cos(c.rotX) * c.dist);
    c.camera.lookAt(c.alvo.x, c.alvo.y, c.alvo.z);
    c.uniforms.uNow.value = S ? S.tempo : 0;
    c.renderer.render(c.scene, c.camera);
    if (S) $('hudCerebroNum').textContent = `células de Kenyon ativas ${Math.round(S.med.kc)} · dopamina ${S.med.pam > 5 ? 'LIGADA' : 'parada'}`;
  }

  let ultimo = 0;
  function quadro(agora) {
    const dt = Math.min(0.05, (agora - (ultimo || agora)) / 1000); ultimo = agora;
    if (ativas.has('mosca')) quadroMosca(agora);
    if (ativas.has('cerebro')) quadroCerebro(dt);
    requestAnimationFrame(quadro);
  }
  aplica();
  requestAnimationFrame(quadro);
})();
