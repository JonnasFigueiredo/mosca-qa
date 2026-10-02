// O mundo 3D da aba "A mosca" (caca.html): a bancada da Cozinha, a NeuroMechFly de verdade e as ações visíveis como
// plaquinhas na bancada. Adaptado de web/sandbox.js (malha, poses, passo em trípode, olhos reais, câmeras), sem o
// louva-a-deus e sem o corpo físico: aqui o corpo não decide nada.
// O que é ilustração: o corpo, o andar e onde as plaquinhas ficam. O que vem do cérebro: a ordem do que ela cheira, a
// valência, a escolha, o bug e a dopamina (lidos de window.__caca, o estado da sessão). Nesta tarefa o cérebro só
// recebe cheiro: a vista "Olhos dela" mostra o que os olhos captariam, mas nada disso entra no cérebro.
window.CacaMundo3D = (() => {
  'use strict';
  const st = () => window.__caca;
  const S = 7;   // px por mm, como no sandbox
  const W = {};  // o mundo: renderer, cena, câmeras, objetos
  const ANIM = { poses: null, fase: 0 };
  const OLHO = { mapa: null };
  const FANT = { x: 0, y: 40, z: 120, yaw: 0, pitch: -0.35, vel: 35, teclas: new Set(), arrasta: null };
  const F = { x: 0, y: 0, th: 0, prob: 0, brilho: 0, andando: false };   // a mosca: página (px), rumo (0 = para -z)
  let modo = 'spec', erro = null, carregando = null;

  const ACAO_TXT = {
    'carrinho:normal': 'pôr 1 item no carrinho', 'carrinho:zero': 'pôr quantidade zero', 'carrinho:negativa': 'pôr quantidade negativa',
    'carrinho:limite': 'pôr o estoque todo no carrinho', 'estoque:normal': 'abrir o pedido', 'estoque:limite': 'pedir o estoque inteiro',
    'estoque:repetida': 'reservar duas vezes', 'pagamento:normal': 'pagar', 'pagamento:zero': 'pagar pedido vazio', 'pagamento:repetida': 'pagar duas vezes',
    'cancelamento:normal': 'cancelar', 'cancelamento:repetida': 'cancelar duas vezes', 'cupom:normal': 'aplicar cupom de 10%',
    'cupom:limite': 'aumentar o cupom até o máximo', 'cupom:repetida': 'aplicar o mesmo cupom duas vezes',
  };
  const CONTRATO_TXT = {
    'estoque-negativo': 'estoque negativo', 'estoque-acima-do-inicial': 'estoque acima do inicial', 'estoque-inconsistente': 'estoque não fecha',
    'cobranca-duplicada': 'cobrado duas vezes', 'cobranca-sem-valor': 'cobrança de valor zero', 'total-nao-finito': 'total inválido',
    'total-negativo': 'total negativo', 'quantidade-negativa-aceita': 'quantidade negativa aceita', 'desconto-acima-do-limite': 'desconto acima de 30%',
  };
  // onde ficam as plaquinhas (mm, em relação ao ponto onde ela espera; -y é para a frente dela)
  const lugares = n => (n === 1 ? [{ x: 0, y: -13 }] : [{ x: -10, y: -11.5 }, { x: 0, y: -15 }, { x: 10, y: -11.5 }]);
  const PLACA = { w: 8.4, d: 5.2, h: 0.5 };   // mm

  /* ───────────── texturas (as mesmas da Cozinha, de sandbox.js) ───────────── */
  function tex(fundo, manchas = [], w = 256, h = 256, riscos = null) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = fundo; g.fillRect(0, 0, w, h);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [cor, n, r0, r1] of manchas) { g.fillStyle = cor; for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, r0 + rnd() * (r1 - r0), (r0 + rnd() * (r1 - r0)) * (0.6 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); g.fill(); } }
    if (riscos) { g.strokeStyle = riscos; g.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 12, w * 0.7, y + (rnd() - 0.5) * 12, w, y + (rnd() - 0.5) * 8); g.stroke(); } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  const mat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, metalness: 0, ...extra });

  /* ───────────── montar o mundo ───────────── */
  function iniciar(canvas) {
    if (W.r || erro) return;
    try {
      const r = W.r = new THREE.WebGLRenderer({ canvas, antialias: true });
      r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); r.autoClear = false;
    } catch (e) { erro = 'Sem WebGL neste navegador: ' + e.message; return; }
    const s = W.cena = new THREE.Scene();
    W.bg = new THREE.Color('#e9dfd1'); s.fog = new THREE.FogExp2('#e9dfd1', 0.0016);
    s.add(new THREE.HemisphereLight('#fff8ee', '#7a634a', 0.55));
    const key = new THREE.DirectionalLight('#fff3e0', 0.75); key.position.set(150, 1100, -1300); s.add(key);
    const frente = new THREE.DirectionalLight('#ffffff', 0.25); frente.position.set(-200, 400, 600); s.add(frente);
    // bancada de madeira, parede de azulejos e a janela (a luz vem dela), como na Cozinha
    const madeira = tex('#b89468', [['#a8845a', 30, 20, 60]], 512, 512, 'rgba(110, 75, 40, 0.4)'); madeira.repeat.set(4, 4);
    const bancada = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), mat('#ffffff', { map: madeira, roughness: 0.75 }));
    bancada.rotation.x = -Math.PI / 2; s.add(bancada);
    const zp = -330, azulejo = tex('#dcd6cb', [], 128, 128);
    { const g = azulejo.image.getContext('2d'); g.strokeStyle = '#d9d3c7'; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128); azulejo.needsUpdate = true; }
    azulejo.repeat.set(20, 8);
    const parede = new THREE.Mesh(new THREE.PlaneGeometry(1600, 900), mat('#ffffff', { map: azulejo, roughness: 0.4 })); parede.position.set(0, 450, zp); s.add(parede);
    const ceu = document.createElement('canvas'); ceu.width = 16; ceu.height = 256;
    { const g = ceu.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9fd0ff'); gr.addColorStop(1, '#f2fbff'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); }
    const janela = new THREE.Mesh(new THREE.PlaneGeometry(700, 360), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ceu), fog: false })); janela.position.set(0, 330, zp + 2); s.add(janela);
    const moldura = new THREE.Mesh(new THREE.PlaneGeometry(740, 400), mat('#fbfbf7')); moldura.position.set(0, 330, zp + 1); s.add(moldura);
    for (const x of [-120, 120]) { const trave = new THREE.Mesh(new THREE.BoxGeometry(12, 360, 6), mat('#fbfbf7')); trave.position.set(x, 330, zp + 5); s.add(trave); }
    // a plaquinha de cada ação visível, um brilho embaixo de cada uma (quando ela cheira) e os rótulos para quem assiste
    W.placas = Array.from({ length: 15 }, () => {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 318;
      const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
      const lado = mat('#efe9df', { roughness: 0.5 });
      const m = new THREE.Mesh(new THREE.BoxGeometry(PLACA.w * S, PLACA.h * S, PLACA.d * S), [lado, lado, new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 }), lado, lado, lado]);
      m.position.y = PLACA.h * S / 2;
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(PLACA.w * S * 1.25, PLACA.d * S * 1.4), new THREE.MeshBasicMaterial({ color: '#ff4f8b', transparent: true, opacity: 0, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = 0.3;
      const rotulo = sprite();
      const g = new THREE.Group(); g.add(m, halo, rotulo.sp); g.visible = false; s.add(g);
      return { g, m, halo, cv, t, rotulo, chave: '' };
    });
    // a pluma de cheiro (para quem assiste; os olhos dela não a veem)
    const N = 220, pos = new Float32Array(N * 3).fill(-9999);
    W.pluma = { pos, n: N, i: 0, viva: new Float32Array(N), vida: new Float32Array(N), de: new Float32Array(N * 3), para: new Float32Array(N * 3), t0: new Float32Array(N) };
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    W.plumaPts = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ff4f8b', size: 1.6, transparent: true, opacity: 0.65, depthWrite: false }));
    W.plumaPts.frustumCulled = false; s.add(W.plumaPts);
    // a dopamina: um brilho verde no chão, em volta dela, e uma luz
    W.dopa = new THREE.Mesh(new THREE.CircleGeometry(26, 40), new THREE.MeshBasicMaterial({ color: '#4cc38a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    W.dopa.rotation.x = -Math.PI / 2; W.dopa.position.y = 0.4; s.add(W.dopa);
    W.dopaLuz = new THREE.PointLight('#4cc38a', 0, 120); W.dopaLuz.position.y = 25; s.add(W.dopaLuz);
    W.dopaRotulo = sprite(); s.add(W.dopaRotulo.sp);
    // a mosca simples (até a malha carregar, ou se ela não existir neste computador)
    W.simples = moscaSimples(); s.add(W.simples);
    // câmeras: espectador/fantasma, olhos e de cima
    W.cam = new THREE.PerspectiveCamera(50, 1, 0.2, 5000);
    W.top = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 3000); W.top.position.set(0, 1500, 0); W.top.up.set(0, 0, -1); W.top.lookAt(0, 0, 0);
    W.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    W.camPronta = false;
    carregando = Promise.all([carregarCorpo(), carregarOlhos()]).catch(e => console.warn(e));
    eventosFantasma(canvas);
  }

  function sprite() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 72;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(64, 9, 1); sp.visible = false; sp.renderOrder = 10;
    return { sp, cv, txt: '' };
  }
  function escreve(r, txt, fundo, cor = '#fff') {
    if (r.txt === txt + fundo) return; r.txt = txt + fundo;
    const g = r.cv.getContext('2d'); g.clearRect(0, 0, 512, 72);
    g.font = '600 34px "IBM Plex Mono", ui-monospace, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.min(500, g.measureText(txt).width + 36);
    g.fillStyle = fundo; g.beginPath(); g.roundRect ? g.roundRect(256 - w / 2, 8, w, 56, 12) : g.rect(256 - w / 2, 8, w, 56); g.fill();
    g.fillStyle = cor; g.fillText(txt, 256, 37, 480);
    r.sp.material.map.needsUpdate = true;
  }

  function moscaSimples() {
    const g = new THREE.Group(), corpo = new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: 0.6 });
    const elip = (rx, ry, rz, x, y, z, m = corpo) => { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m); e.scale.set(rx, ry, rz); e.position.set(x, y, z); g.add(e); return e; };
    elip(2.2, 1.9, 3.2, 0, 6, 3.4, new THREE.MeshStandardMaterial({ color: '#c9a063', roughness: 0.6 }));   // abdome
    elip(2.1, 2, 2.4, 0, 6.4, -0.6);   // tórax
    elip(1.6, 1.5, 1.4, 0, 6.6, -3.6, new THREE.MeshStandardMaterial({ color: '#a7804c' }));   // cabeça
    for (const s of [-1, 1]) elip(0.9, 1, 0.8, s * 1.2, 6.8, -3.7, new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.4 }));   // olhos
    const asa = new THREE.MeshStandardMaterial({ color: '#cfe3f0', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
    for (const s of [-1, 1]) { const a = elip(1.6, 0.1, 4, s * 1.4, 8.3, 3.2, asa); a.rotation.y = s * 0.25; }
    return g;
  }

  /* ───────────── a malha da NeuroMechFly e a pose de pé (de sandbox.js) ───────────── */
  async function buscar(url, como = 'json', tent = 3) {
    for (let i = 1; ; i++) {
      try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ': ' + r.status); return await r[como](); }
      catch (e) { if (i >= tent || /: 404/.test(e.message)) throw e; await new Promise(ok => setTimeout(ok, 300 * i)); }
    }
  }
  async function carregarCorpo() {
    const [info, bin, P] = await Promise.all([buscar('data/corpo_malha.json'), buscar('data/corpo_malha.bin', 'arrayBuffer'), buscar('data/corpo_poses.json')]);
    const V = new Float32Array(bin, 0, info.nv * 3), Fc = new Uint32Array(bin, info.nv * 12, info.nf * 3);
    const group = new THREE.Group(), meshes = [];
    for (const p of info.pecas) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(V.slice(p.v0 * 3, (p.v0 + p.nv) * 3), 3));
      geo.setIndex(new THREE.BufferAttribute(Fc.slice(p.f0 * 3, (p.f0 + p.nf) * 3), 1));
      geo.computeVertexNormals();
      const asa = p.nome.includes('wing');
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: asa ? new THREE.Color('#cfe3f0') : new THREE.Color(...p.cor),
        roughness: asa ? 0.2 : 0.55, metalness: asa ? 0.3 : 0.05, transparent: asa, opacity: asa ? 0.18 : 1, depthWrite: !asa, side: asa ? THREE.DoubleSide : THREE.FrontSide }));
      m.matrixAutoUpdate = false; group.add(m); meshes.push(m);
    }
    const q = arr => arr.map(v => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(v[3], v[4], v[5], 0, v[6], v[7], v[8], 0, v[9], v[10], v[11], 0, 0, 0, 0, 1)));
    ANIM.qPe = q(P.pe); ANIM.pPe = P.pe.map(v => new THREE.Vector3(v[0], v[1], v[2]));
    ANIM.perna = {}; for (const [perna, inf] of Object.entries(P.pernas)) for (const i of inf.pecas) ANIM.perna[i] = perna;
    ANIM.base = Object.fromEntries(Object.entries(P.pernas).map(([k, v]) => [k, new THREE.Vector3(...v.base)]));
    ANIM.boca = ['rostrum', 'haustellum'].map(n => info.pecas.findIndex(pc => pc.nome === 'nmf/c_' + n));
    ANIM.malha = { group, meshes }; ANIM.poses = P;
    W.cena.add(group); W.simples.visible = false;
  }
  const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _M = new THREE.Matrix4(), _R = new THREE.Matrix4(), _T = new THREE.Matrix4(), _Ti = new THREE.Matrix4(), _um = new THREE.Vector3(1, 1, 1);
  const _z = new THREE.Vector3(0, 0, 1), _x = new THREE.Vector3(1, 0, 0), _y = new THREE.Vector3(0, 1, 0);
  const emTorno = (M, p, R) => { _T.makeTranslation(p.x, p.y, p.z); _Ti.makeTranslation(-p.x, -p.y, -p.z); return M.premultiply(_Ti).premultiply(R).premultiply(_T); };
  // da física (mm; x frente, y esquerda, z cima) para a cena (px; x direita, y cima, z para quem olha)
  function paraCena(M, mesh) {
    const e = M.elements;
    mesh.matrix.set(S * e[0], S * e[4], S * e[8], S * e[12], S * e[2], S * e[6], S * e[10], S * e[14], -S * e[1], -S * e[5], -S * e[9], -S * e[13], 0, 0, 0, 1);
    mesh.matrixWorldNeedsUpdate = true;
  }
  function poseMosca() {
    const P = ANIM.poses;
    // rumo: th = 0 aponta para -z (para a frente, longe de quem olha); na física, x é a frente
    const Mc = new THREE.Matrix4().makeTranslation(F.x / S, -F.y / S, P.altura).multiply(_R.makeRotationAxis(_z, Math.PI / 2 - F.th));
    ANIM.malha.meshes.forEach((mesh, i) => {
      _M.compose(ANIM.pPe[i], ANIM.qPe[i], _um);
      const perna = ANIM.perna[i];
      if (perna && F.andando) {
        // trípode: esquerda-frente, direita-meio e esquerda-trás juntas; as outras três em contrafase
        const grupo = (perna === 'lf' || perna === 'rm' || perna === 'lh') ? 0 : Math.PI, th = ANIM.fase + grupo, base = ANIM.base[perna];
        emTorno(_M, base, _R.makeRotationAxis(_z, 0.3 * Math.sin(th)));
        emTorno(_M, base, _R.makeRotationAxis(_x, (perna[0] === 'l' ? -1 : 1) * 0.25 * Math.max(0, Math.cos(th))));
      }
      // a probóscide desce e avança quando ela prova (desenho, não a mecânica da boca)
      if (F.prob > 0.02 && ANIM.boca.includes(i)) { _T.makeTranslation(0.12 * F.prob, 0, -0.22 * F.prob); _M.premultiply(_T); }
      paraCena(_M.premultiply(Mc), mesh);
    });
  }

  /* ───────────── os olhos de verdade (flygym, de sandbox.js) ───────────── */
  async function carregarOlhos() {
    const M = OLHO.mapa = await buscar('data/olho_mapas.json');
    OLHO.rt = new THREE.WebGLRenderTarget(M.colunas, M.linhas);
    OLHO.cams = [0, 1].map(() => new THREE.PerspectiveCamera(M.fovy, M.colunas / M.linhas, 0.2, 4000));
    OLHO.buf = new Uint8Array(M.colunas * M.linhas * 4);
    OLHO.cor = [new Float32Array(M.omatidios * 3), new Float32Array(M.omatidios * 3)];
    OLHO.tex = [0, 1].map(() => { const t = new THREE.DataTexture(new Uint8Array(M.colunas * M.linhas * 4), M.colunas, M.linhas, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; return t; });
    OLHO.cena = new THREE.Scene();
    OLHO.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: OLHO.tex[0], transparent: true, depthTest: false }));
    OLHO.cena.add(OLHO.quad); OLHO.conta = 0;
  }
  // cores como ela capta: sem vermelho (olhos3d.js, corMosca)
  const corMosca = (r, g, b) => { const v = 0.2 * r + 0.65 * g + 0.15 * b; return [v, v, 0.15 * g + 0.85 * b]; };
  function olhoAmostrar() {
    const M = OLHO.mapa, R = W.r, hx = F.x + Math.sin(F.th) * 8, hz = F.y - Math.cos(F.th) * 8, hy = 6;
    OLHO.cams.forEach((cam, i) => { const yaw = F.th + (i ? 1.05 : -1.05); cam.position.set(hx, hy, hz); cam.lookAt(hx + Math.sin(yaw) * 100, hy - 8, hz - Math.cos(yaw) * 100); cam.updateMatrixWorld(true); });
    // o próprio corpo e o que é só para quem assiste não aparecem para os olhos
    const esconde = [ANIM.malha?.group, W.simples, W.plumaPts, W.dopa, W.dopaRotulo.sp, ...W.placas.map(p => p.rotulo.sp), ...W.placas.map(p => p.halo)].filter(Boolean);
    const vis = esconde.map(o => o.visible); esconde.forEach(o => { o.visible = false; });
    for (let i = 0; i < 2; i++) {
      R.setRenderTarget(OLHO.rt); R.setClearColor(W.bg, 1); R.clear(); R.render(W.cena, OLHO.cams[i]);
      R.readRenderTargetPixels(OLHO.rt, 0, 0, M.colunas, M.linhas, OLHO.buf);
      const cor = OLHO.cor[i]; cor.fill(0);
      for (let k = 0; k < M.fonte_px.length; k++) {
        const o = M.omatidio_px[k]; if (o < 0) continue;
        const s = M.fonte_px[k], sr = (s / M.colunas) | 0, sc = s % M.colunas, j = ((M.linhas - 1 - sr) * M.colunas + sc) * 4, n = 255 * M.pixels_por_omatidio[o];
        cor[3 * o] += OLHO.buf[j] / n; cor[3 * o + 1] += OLHO.buf[j + 1] / n; cor[3 * o + 2] += OLHO.buf[j + 2] / n;
      }
      const px = OLHO.tex[i].image.data;
      for (let k = 0; k < M.fonte_px.length; k++) {
        const o = M.omatidio_px[k], r = (k / M.colunas) | 0, c = k % M.colunas, j = ((M.linhas - 1 - r) * M.colunas + c) * 4;
        if (o < 0) { px[j + 3] = 0; continue; }
        const [vd, , az] = corMosca(cor[3 * o], cor[3 * o + 1], cor[3 * o + 2]);
        px[j] = Math.min(255, vd * 280); px[j + 1] = Math.min(255, vd * 280); px[j + 2] = Math.min(255, az * 280); px[j + 3] = 255;
      }
      OLHO.tex[i].needsUpdate = true;
    }
    R.setRenderTarget(null); esconde.forEach((o, k) => { o.visible = vis[k]; });
  }
  function olhoDesenhar(i, vx, vy, vw, vh) {
    const M = OLHO.mapa, a = M.colunas / M.linhas, w = Math.min(vw, vh * a), h = w / a;
    OLHO.quad.material.map = OLHO.tex[i];
    W.r.setViewport(vx + (vw - w) / 2, vy + (vh - h) / 2, w, h); W.r.setScissor(vx + (vw - w) / 2, vy + (vh - h) / 2, w, h);
    W.r.render(OLHO.cena, W.quadCam);
  }

  /* ───────────── fantasma: câmera livre (de sandbox.js) ───────────── */
  const ativoFantasma = () => modo === 'fantasma' && W.visivel;
  function eventosFantasma(cv) {
    cv.addEventListener('mousedown', e => {
      if (!ativoFantasma()) return;
      FANT.arrasta = { x: e.clientX, y: e.clientY };
      try { const p = cv.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch { /* arrastar também funciona */ }
    });
    addEventListener('mouseup', () => { FANT.arrasta = null; });
    addEventListener('mousemove', e => {
      if (!ativoFantasma()) return;
      let mx, my;
      if (document.pointerLockElement === cv) { mx = e.movementX; my = e.movementY; }
      else if (FANT.arrasta) { mx = e.clientX - FANT.arrasta.x; my = e.clientY - FANT.arrasta.y; FANT.arrasta = { x: e.clientX, y: e.clientY }; } else return;
      FANT.yaw += mx * 0.0025; FANT.pitch = Math.max(-1.55, Math.min(1.55, FANT.pitch - my * 0.0025));
    });
    cv.addEventListener('wheel', e => { if (!ativoFantasma()) return; e.preventDefault(); FANT.vel = Math.max(3, Math.min(600, FANT.vel * (e.deltaY < 0 ? 1.25 : 0.8))); }, { passive: false });
    const MAPA = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
    addEventListener('keydown', e => {
      if (!ativoFantasma() || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
      if (e.code === 'KeyF') { pertoDela(); return; }
      const c = MAPA[e.code] || e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyC', 'Space', 'ShiftLeft', 'ShiftRight'].includes(c)) { FANT.teclas.add(c); e.preventDefault(); }
    });
    addEventListener('keyup', e => FANT.teclas.delete(MAPA[e.code] || e.code));
    addEventListener('blur', () => FANT.teclas.clear());
  }
  function pertoDela() { const d = 45; Object.assign(FANT, { x: F.x - Math.sin(F.th) * d, y: 22, z: F.y + Math.cos(F.th) * d, yaw: F.th, pitch: -0.4 }); }
  function moverFantasma(dt) {
    const t = c => FANT.teclas.has(c), v = FANT.vel * (t('ShiftLeft') || t('ShiftRight') ? 4 : 1) * Math.min(dt, 0.1);
    const cp = Math.cos(FANT.pitch), fx = Math.sin(FANT.yaw) * cp, fy = Math.sin(FANT.pitch), fz = -Math.cos(FANT.yaw) * cp, dx = Math.cos(FANT.yaw), dz = Math.sin(FANT.yaw);
    let mx = 0, my = 0, mz = 0;
    if (t('KeyW')) { mx += fx; my += fy; mz += fz; } if (t('KeyS')) { mx -= fx; my -= fy; mz -= fz; }
    if (t('KeyD')) { mx += dx; mz += dz; } if (t('KeyA')) { mx -= dx; mz -= dz; }
    if (t('Space') || t('KeyE')) my += 1; if (t('KeyC') || t('KeyQ')) my -= 1;
    const n = Math.hypot(mx, my, mz);
    if (n) { FANT.x += mx / n * v; FANT.y = Math.max(0.5, FANT.y + my / n * v); FANT.z += mz / n * v; }
  }

  /* ───────────── as plaquinhas (o desenho da carta de cada ação) ───────────── */
  function desenhaPlaca(p, c, car) {
    const a = c.acao, prem = a.entrada === car;
    const chave = [a.id, c.estado, c.escolhida, c.bug ? 1 : 0, c.nada ? 1 : 0, c.v == null ? '' : c.v.toFixed(2), c.prob == null ? '' : Math.round(c.prob * 100), c.visivel ? 1 : 0].join('|');
    if (p.chave === chave) return; p.chave = chave;
    const g = p.cv.getContext('2d'), w = 512, h = 318;
    g.fillStyle = c.bug ? '#fff4e2' : '#fbf8f2'; g.fillRect(0, 0, w, h);
    g.lineWidth = 10; g.strokeStyle = c.bug ? '#9a6200' : c.estado === 'cheirando' ? '#d0245e' : c.escolhida ? '#1c2127' : c.visivel ? '#5f6a74' : '#c9cfcc'; g.strokeRect(5, 5, w - 10, h - 10);
    g.font = '500 28px "IBM Plex Mono", Consolas, monospace'; g.textBaseline = 'top';
    let x = 26;
    for (const [t, pr] of [[a.familia, false], [a.entrada, prem]]) {
      const tw = g.measureText(t).width + 20; g.fillStyle = pr ? '#d0245e' : '#dce0de'; g.fillRect(x, 24, tw, 40);
      g.fillStyle = pr ? '#fff' : '#3c4650'; g.fillText(t, x + 10, 30); x += tw + 12;
    }
    g.font = '600 40px "IBM Plex Sans", "Segoe UI", sans-serif'; g.fillStyle = '#1c2127';
    const ps = (ACAO_TXT[a.id] || a.id).split(' '); let l = '', y = 88;
    for (const pal of ps) { const t = l ? l + ' ' + pal : pal; if (g.measureText(t).width > w - 52 && l) { g.fillText(l, 26, y); y += 46; l = pal; } else l = t; }
    if (l) g.fillText(l, 26, y);
    // a barra de valência (zero a 40%)
    const by = h - 70, bw = w - 52; g.fillStyle = '#dce0de'; g.fillRect(26, by, bw, 18);
    if (c.v != null) { const pos = v => (v >= 0 ? 0.4 + 0.6 * Math.min(v, 1.5) / 1.5 : 0.4 - 0.4 * Math.min(-v, 1)), p1 = pos(c.v); g.fillStyle = prem ? '#d0245e' : '#3c4650'; g.fillRect(26 + bw * Math.min(0.4, p1), by, bw * Math.abs(p1 - 0.4), 18); }
    g.fillStyle = '#5f6a74'; g.fillRect(26 + bw * 0.4, by - 4, 2, 26);
    g.font = '26px "IBM Plex Mono", Consolas, monospace';
    g.fillText((c.v == null ? 'valência —' : 'valência ' + c.v.toFixed(2).replace('.', ',')) + (c.prob != null ? ' · chance ' + Math.round(c.prob * 100) + '%' : ''), 26, by + 26);
    if (c.bug) { g.strokeStyle = '#9a6200'; g.lineWidth = 6; g.beginPath(); g.moveTo(70, 10); for (let i = 1; i <= 7; i++) g.lineTo(70 + i * 55, i % 2 ? h * 0.6 : h * 0.2); g.stroke(); }
    if (c.nada || (c.parada && !c.visivel)) { g.fillStyle = 'rgba(233,236,234,.45)'; g.fillRect(0, 0, w, h); }
    p.t.needsUpdate = true;
  }

  /* ───────────── cada quadro ───────────── */
  function quadro(agora, dt, canvas, legenda) {
    if (!W.r) return;
    W.visivel = true;
    const R = W.r, w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    const pr = R.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) R.setSize(w, h, false);
    const E = st(), mapa = E?.mundo, cartas = E?.cartas || [];
    // no mapa, as 15 plaquinhas ficam na bancada; as 3 visíveis do passo são as cartas da sessão. No sorteio, só as 3
    const lug = mapa ? cartas.map(c => mapa.placas.find(pl => pl.acao === c.acao)).map(pl => ({ x: pl.x, y: pl.y })) : lugares(cartas.length);
    const itens = mapa ? mapa.placas.map(pl => {
      const c = cartas.find(x => x.acao === pl.acao);
      return { pl, c: c ? { ...c, visivel: true } : { acao: pl.acao, estado: 'parada', parada: true, v: E.val[pl.acao.id] ?? null } };
    }) : cartas.map((c, i) => ({ pl: lug[i], c }));
    if (mapa && W.mapaVisto !== mapa) { W.mapaVisto = mapa; F.x = mapa.pos.x * S; F.y = mapa.pos.y * S; F.th = 0; W.camPronta = false; W.parada = null; W.paraQual = null; }
    if (!mapa && W.mapaVisto) { W.mapaVisto = null; F.x = 0; F.y = 0; }
    // as plaquinhas
    W.placas.forEach((p, i) => {
      const it = itens[i]; p.g.visible = !!it; if (!it) return;
      const c = it.c;
      p.g.position.set(it.pl.x * S, 0, it.pl.y * S);
      desenhaPlaca(p, c, E.car);
      p.halo.material.opacity = c.estado === 'cheirando' ? 0.35 + 0.15 * Math.sin(agora / 160) : c.bug ? 0.4 : c.visivel && mapa ? 0.18 : 0;
      p.halo.material.color.set(c.bug ? '#e0a43a' : c.estado === 'cheirando' ? '#ff4f8b' : '#5f6a74');
      if (c.bug) { escreve(p.rotulo, 'BUG: ' + c.bug.map(b => CONTRATO_TXT[b] || b).join('; '), '#9a6200'); p.rotulo.sp.visible = true; }
      else if (c.nada) { escreve(p.rotulo, 'sem bug', 'rgba(60,70,80,.8)'); p.rotulo.sp.visible = true; }
      else p.rotulo.sp.visible = false;
      p.rotulo.sp.position.set(0, 26 + 2 * Math.sin(agora / 300), 0);
    });
    // a mosca: cheira de onde está, anda até a escolhida e prova
    const ich = cartas.findIndex(c => c.estado === 'cheirando'), iesc = cartas.findIndex(c => c.escolhida);
    let alvo = mapa ? { x: W.parada?.x ?? F.x, y: W.parada?.y ?? F.y } : { x: 0, y: 0 }, olhar = null, prova = false;
    if (iesc >= 0 && ich < 0) {
      const l = lug[iesc], cx = l.x * S, cy = l.y * S;
      if (mapa) {
        // para na frente da plaquinha, do lado de onde vem
        if (W.paraQual !== cartas[iesc]) { W.paraQual = cartas[iesc]; const vx = F.x - cx, vy = F.y - cy, n = Math.hypot(vx, vy) || 1, r = (PLACA.d / 2 + 1.8) * S; W.parada = { x: cx + vx / n * r, y: cy + vy / n * r }; }
        alvo = W.parada;
      } else alvo = { x: cx, y: cy + (PLACA.d / 2 + 1.6) * S };
      olhar = { x: cx, y: cy }; prova = true;
    } else if (ich >= 0) { const l = lug[ich]; olhar = { x: l.x * S, y: l.y * S }; }
    const dx = alvo.x - F.x, dy = alvo.y - F.y, dist = Math.hypot(dx, dy);
    F.andando = dist > 0.6;
    if (F.andando) { const k = Math.min(1, 150 * dt / dist); F.x += dx * k; F.y += dy * k; ANIM.fase += dt * 2 * Math.PI * 9; }
    const rumo = F.andando ? Math.atan2(dx, -dy) : olhar ? Math.atan2(olhar.x - F.x, -(olhar.y - F.y)) : 0;
    let da = rumo - F.th; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    F.th += da * Math.min(1, dt * 7);
    F.prob += ((prova && !F.andando ? 1 : 0) - F.prob) * Math.min(1, dt * 8);
    if (ANIM.poses) poseMosca(); else { W.simples.position.set(F.x, 0, F.y); W.simples.rotation.y = -F.th; }
    // a pluma de cheiro da plaquinha que ela cheira até as antenas
    const Pl = W.pluma, cab = { x: F.x + Math.sin(F.th) * 10, y: 7, z: F.y - Math.cos(F.th) * 10 };
    if (ich >= 0 && agora - (Pl.ultima || 0) > 25) {
      Pl.ultima = agora; const l = lug[ich], k = Pl.i++ % Pl.n;
      Pl.de.set([l.x * S + (Math.random() - 0.5) * PLACA.w * S * 0.6, PLACA.h * S + 1, l.y * S + (Math.random() - 0.5) * PLACA.d * S * 0.5], k * 3);
      Pl.para.set([cab.x, cab.y, cab.z], k * 3); Pl.t0[k] = agora; Pl.vida[k] = 800 + Math.random() * 500;
    }
    for (let k = 0; k < Pl.n; k++) {
      const u = (agora - Pl.t0[k]) / Pl.vida[k];
      if (!(u >= 0 && u < 1)) { Pl.pos[k * 3 + 1] = -9999; continue; }
      const sw = Math.sin(u * 9 + k) * 1.5;
      Pl.pos[k * 3] = Pl.de[k * 3] + (Pl.para[k * 3] - Pl.de[k * 3]) * u + sw;
      Pl.pos[k * 3 + 1] = Pl.de[k * 3 + 1] + (Pl.para[k * 3 + 1] - Pl.de[k * 3 + 1]) * u + Math.sin(u * Math.PI) * 6;
      Pl.pos[k * 3 + 2] = Pl.de[k * 3 + 2] + (Pl.para[k * 3 + 2] - Pl.de[k * 3 + 2]) * u;
    }
    W.plumaPts.geometry.attributes.position.needsUpdate = true;
    // a dopamina
    F.brilho += ((E?.resumoDopa ? 1 : 0) - F.brilho) * Math.min(1, dt * 6);
    W.dopa.position.x = F.x; W.dopa.position.z = F.y; W.dopa.material.opacity = 0.45 * F.brilho * (0.85 + 0.15 * Math.sin(agora / 160));
    W.dopaLuz.position.set(F.x, 25, F.y); W.dopaLuz.intensity = 1.6 * F.brilho;
    escreve(W.dopaRotulo, 'dopamina de recompensa (PAM)', '#1f7a5a');
    W.dopaRotulo.sp.visible = F.brilho > 0.05; W.dopaRotulo.sp.material.opacity = F.brilho; W.dopaRotulo.sp.position.set(F.x, 30, F.y);
    // os olhos (a cada dois quadros), se alguma vista os mostra
    const mostraOlhos = OLHO.mapa && (modo === 'olhos' || modo === 'spec' || modo === 'fantasma');
    if (mostraOlhos && (OLHO.conta++ & 1) === 0) olhoAmostrar();
    // a câmera
    R.setScissorTest(true); R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h); R.setClearColor(W.bg, 1); R.clear();
    if (modo === 'cima') {
      const a = w / h, half = mapa ? 330 : 140;
      Object.assign(W.top, a > 1 ? { left: -half * a, right: half * a, top: half, bottom: -half } : { left: -half, right: half, top: half / a, bottom: -half / a });
      const cz0 = mapa ? -40 : -50; W.top.position.set(0, 1500, cz0); W.top.lookAt(0, 0, cz0); W.top.updateProjectionMatrix();
      const fog = W.cena.fog; W.cena.fog = null; R.render(W.cena, W.top); W.cena.fog = fog;
    } else if (modo === 'olhos' && OLHO.mapa) {
      const s = Math.min(w / 2 - 20, h - 60);
      olhoDesenhar(0, Math.round(w / 4 - s / 2), Math.round((h - s) / 2), s, s);
      olhoDesenhar(1, Math.round(3 * w / 4 - s / 2), Math.round((h - s) / 2), s, s);
    } else {
      if (modo === 'fantasma') {
        moverFantasma(dt);
        const cp = Math.cos(FANT.pitch);
        W.cam.position.set(FANT.x, FANT.y, FANT.z);
        W.cam.lookAt(FANT.x + Math.sin(FANT.yaw) * cp, FANT.y + Math.sin(FANT.pitch), FANT.z - Math.cos(FANT.yaw) * cp);
      } else {
        // espectador: atrás e acima dela, seguindo com atraso
        const k = tau => 1 - Math.exp(-dt / tau);
        if (!W.camPronta) { W.cx = F.x; W.cz = F.y; W.cth = F.th; }
        W.cx += (F.x - W.cx) * k(0.3); W.cz += (F.y - W.cz) * k(0.3);
        W.cth += Math.atan2(Math.sin(F.th - W.cth), Math.cos(F.th - W.cth)) * k(0.6);
        const back = mapa ? 120 : 78, up = mapa ? 80 : 46, cx = W.cx - Math.sin(W.cth) * back, cz = W.cz + Math.cos(W.cth) * back;
        const quer = new THREE.Vector3(cx, up, cz);
        W.cam.position.lerp(quer, W.camPronta ? k(0.4) : 1); W.camPronta = true;
        W.cam.lookAt(W.cx + Math.sin(W.cth) * 55, 4, W.cz - Math.cos(W.cth) * 55);
      }
      W.cam.aspect = w / h; W.cam.updateProjectionMatrix();
      R.render(W.cena, W.cam);
      if (mostraOlhos) { const s = Math.round(Math.min(w * 0.16, h * 0.2)); olhoDesenhar(0, w - 2 * s - 14, 12, s, s); olhoDesenhar(1, w - s - 8, 12, s, s); }
    }
    R.setScissorTest(false);
    if (legenda) {
      const fase = E?.fase || 'Pronta para começar';
      const txt = { spec: 'espectador', fantasma: `fantasma · ${(FANT.vel / S).toFixed(0)} mm/s`, olhos: 'olhos dela: as cores que os receptores captam (sem vermelho)', cima: 'de cima' }[modo];
      legenda.innerHTML = `<span><b>${fase}</b> · ${txt}${erro ? ' · ' + erro : ''}${!ANIM.poses ? ' · modelo simples (sem a malha da NeuroMechFly em web/data)' : ''}</span>` +
        (mostraOlhos && modo !== 'olhos' ? '<span>em cima à direita: os dois olhos dela (ilustração: nesta tarefa o cérebro recebe só o cheiro)</span>' : '') +
        (modo === 'olhos' ? '<span>ilustração: nesta tarefa o cérebro recebe só o cheiro</span>' : '');
    }
  }
  function mudaModo(m) {
    if (m === 'fantasma' && modo !== 'fantasma') { if (W.camPronta) { const d = new THREE.Vector3(); W.cam.getWorldDirection(d); Object.assign(FANT, { x: W.cam.position.x, y: W.cam.position.y, z: W.cam.position.z, yaw: Math.atan2(d.x, -d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y))) }); } else pertoDela(); }
    if (m !== 'fantasma' && document.pointerLockElement) document.exitPointerLock();
    FANT.teclas.clear(); modo = m; W.camPronta = m === 'spec' ? false : W.camPronta;
  }
  return { iniciar, quadro, modo: mudaModo, oculta: () => { W.visivel = false; FANT.teclas.clear(); }, erro: () => erro };
})();
