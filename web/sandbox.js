// Sandbox 3D: o sistema em teste espalhado em plataformas, num mundo de código (tipo Matrix).
// A mosca anda, voa e pousa; os olhos, o cheiro e o gosto funcionam como na página 2D, agora com altura.
//
// Vem do cérebro: para onde ela vira (olhos -> LC10a -> DNa01-03), provar (probóscide), a decolagem de
// fuga (fibra gigante DNp01, disparada pelos detectores de ameaça LPLC2/LC4 quando um bug estoura).
// Vem de regras do corpo: decolar na beira de uma plataforma quando há coisa nova para ver, a altura do
// voo e o pouso perto do que ela ainda não provou.
// Usa globais da página: THREE, SB, fly, rects, APP, el, label, labEvent, logEvent, freshFly, keepHunger,
// disp, measure, evFly, evWedge, evHexMaterial, EYE_COLS, EYE_ROWS, EYE_FRONT, EYE_BACK, EV_EYE_HFOV.
'use strict';

const SB_EL_W = 120, SB_EL_H = 44, SB_GAP = 22, SB_PAD = 26;
const SB_FLY_SPEED = 115;   // px por segundo de tempo cerebral, no ar
const SB_CRUISE = 60;       // quanto ela voa acima do que está embaixo
const SB_STEP = 3;          // desnível que ela vence andando
// plataformas: centro (x, y) e altura; cada grupo de elementos da mesma função ocupa uma
const SB_SLOTS = [[330, 330, 50], [720, 250, 95], [1100, 340, 65], [270, 760, 25], [1150, 760, 115],
  [330, 1140, 80], [720, 1190, 40], [1100, 1120, 105], [720, 470, 18], [980, 560, 130]];
const SB_COL = { L: new THREE.Color('#5cc8ff'), R: new THREE.Color('#ffb347'), neon: '#2bff86' };

/* ───────────── o mundo ───────────── */
function sbBuild() {
  SB.app = APP.id;
  const groups = {};
  for (const [id, e] of Object.entries(APP.elementos)) (groups[e.notas[0]] ||= []).push(id);
  const chunks = [];
  for (const ids of Object.values(groups).sort((a, b) => b.length - a.length))
    for (let i = 0; i < ids.length; i += 6) chunks.push(ids.slice(i, i + 6));
  SB.platforms = []; SB.layout = {};
  chunks.forEach((ids, k) => {
    const [cx, cy, z] = SB_SLOTS[k % SB_SLOTS.length];
    const cols = Math.min(3, ids.length), rows = Math.ceil(ids.length / cols);
    const w = cols * (SB_EL_W + SB_GAP) - SB_GAP + 2 * SB_PAD, h = rows * (SB_EL_H + SB_GAP) - SB_GAP + 2 * SB_PAD;
    const p = { x: cx - w / 2, y: cy - h / 2, w, h, z };
    SB.platforms.push(p);
    ids.forEach((id, i) => {
      SB.layout[id] = { x: p.x + SB_PAD + (i % cols) * (SB_EL_W + SB_GAP), y: p.y + SB_PAD + Math.floor(i / cols) * (SB_EL_H + SB_GAP), w: SB_EL_W, h: SB_EL_H, z };
    });
  });
  SBR.built = '';
}
// o que a página mede: cada elemento que existe agora na tela do sistema, na posição dele no mundo
function sbRects() {
  if (SB.app !== APP.id) sbBuild();
  const out = [];
  for (const node of document.querySelectorAll('#shop [data-el]')) {
    const L = SB.layout[node.dataset.el];
    if (L) out.push({ id: node.dataset.el, ...L, disabled: node.disabled, node });
  }
  return out;
}
function sbSurface(x, y) {
  let z = 0;
  for (const p of SB.platforms || []) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) z = Math.max(z, p.z);
  return z;
}

/* ───────────── andar e voar ───────────── */
function sbMove(f, dt, v) {
  predStep(f, dt);
  if (SB.fisico && !f.flying) { f.startle = (f.startle || 0) - dt; return; }
  if (f.flying) return sbFly(f, dt);
  const nx = Math.min(SB.W - 10, Math.max(10, f.x + Math.sin(f.th) * v * dt));
  const ny = Math.min(SB.H - 10, Math.max(10, f.y - Math.cos(f.th) * v * dt));
  const s = sbSurface(nx, ny);
  if (Math.abs(s - f.z) <= SB_STEP) { f.x = nx; f.y = ny; f.z = s; return; }
  // beira de uma plataforma, ou parede de outra mais alta
  if (sbWantsFly(f)) sbTakeoff(f, s > f.z ? 'subir' : 'beira');
  else f.th += Math.PI * (0.55 + 0.4 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
}
// regra do corpo: decola quando há coisa nova em outro nível, mais ainda com fome de bug
function sbWantsFly(f) {
  const novel = rects.some(r => !r.disabled && Math.abs(r.z - f.z) > SB_STEP && el(r.id).novelty > 0.5);
  return Math.random() < (novel ? 0.3 + 0.6 * f.hunger : 0.12);
}
function sbTakeoff(f, why) {
  const noAr = f.flying;
  if (noAr && why !== 'fuga') return;
  // no ar, a fibra gigante vira uma guinada de fuga; no chão, decolagem
  if (!noAr) { f.flying = true; f.flyT = 0; }
  f.vz = why === 'fuga' ? (noAr ? 120 : 150) : 70;
  if (why === 'fuga') f.th += Math.PI * (0.6 + 0.8 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
  // fuga que conta: a Sentinela por perto, e não é o voo de quando ela acabou de ser pega
  if (why === 'fuga' && PRED.on && PRED.cd <= 0 && Math.hypot(PRED.x - f.x, PRED.y - f.y, PRED.z - f.z) < 180) {
    PRED.escapes++;
    labEvent('fugaSentinela', {});
    logEvent('Viu a Sentinela crescer na frente dela: os detectores de ameaça (LPLC2, LC4) dispararam a fibra gigante e ela fugiu.', 'a');
  }
  if (noAr) return;
  labEvent('voo', { why });
  logEvent(why === 'fuga' ? 'A fibra gigante (DNp01) disparou: decolou de susto.'
    : why === 'subir' ? 'Deu de cara com uma plataforma mais alta e decolou para ver o que tem lá.'
      : 'Chegou na beira da plataforma e decolou.', why === 'fuga' ? '' : 's');
}
function sbFly(f, dt) {
  f.flyT += dt;
  f.x = Math.min(SB.W - 10, Math.max(10, f.x + Math.sin(f.th) * SB_FLY_SPEED * dt));
  f.y = Math.min(SB.H - 10, Math.max(10, f.y - Math.cos(f.th) * SB_FLY_SPEED * dt));
  const below = sbSurface(f.x, f.y);
  const ahead = sbSurface(f.x + Math.sin(f.th) * 90, f.y - Math.cos(f.th) * 90);
  // pousa quando passa por cima de algo que ainda não provou (ou depois de voar bastante)
  f.landing = f.flyT > 1.2 && (sbNovelBelow(f, below) || f.flyT > 9);
  const target = f.landing ? below : Math.max(below, ahead) + SB_CRUISE;
  f.vz += ((target - f.z) * 2.2 - f.vz) * Math.min(1, dt * 4);
  f.z = Math.max(below, f.z + f.vz * dt);
  if (f.landing && f.z - below < 1.5 && f.flyT > 0.6) {
    f.flying = false; f.z = below; f.vz = 0;
    if (SB.fisico) corpoTeleporte(f);   // o corpo físico recomeça onde ela pousou
    labEvent('pouso', { z: Math.round(below) });
    logEvent(below > 0 ? `Pousou numa plataforma a ${Math.round(below)} px de altura.` : 'Pousou no chão.');
  }
}
function sbNovelBelow(f, below) {
  return rects.some(r => !r.disabled && Math.abs(r.z - below) < 1 && el(r.id).novelty > 0.5 &&
    Math.hypot(r.x + r.w / 2 - f.x, r.y + r.h / 2 - f.y) < 80);
}

/* ───────────── você: a Sentinela ───────────── */
// Você controla um predador. A mosca não sabe que é um predador: ela vê um objeto (LC10a) e, quando ele
// cresce rápido na frente dela, os detectores de ameaça (LPLC2, LC4) disparam. Se a fibra gigante disparar,
// ela foge. Se você a pegar, a dopamina de punição (PPL1) marca o cheiro do lugar onde ela estava.
const PRED = { on: false, x: 0, y: 0, z: 90, th: 0, lunge: 0, lungeCd: 0, cd: 0, keys: new Set(), prevSize: 0, captures: 0, escapes: 0 };
const PRED_R = 16, PRED_SPEED = 80, PRED_LUNGE = 240, PRED_TURN = 2.4;
const PRED_LOOM = 60;   // Hz nos detectores de ameaça por rad/s de crescimento do tamanho aparente
function predSpawn() {
  const a = Math.random() * Math.PI * 2;
  PRED.x = Math.min(SB.W - 60, Math.max(60, fly.x + Math.sin(a) * 340));
  PRED.y = Math.min(SB.H - 60, Math.max(60, fly.y - Math.cos(a) * 340));
  PRED.z = Math.max(90, sbSurface(PRED.x, PRED.y) + 50);
  PRED.th = Math.atan2(fly.x - PRED.x, -(fly.y - PRED.y));
  PRED.prevSize = 0; PRED.cd = 1;
}
function predStep(f, dt) {
  if (!PRED.on) { f.loom = 0; return; }
  const k = PRED.keys;
  const turn = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 0.6 : 0);
  const up = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
  PRED.th += turn * PRED_TURN * dt;
  PRED.lunge -= dt; PRED.lungeCd -= dt; PRED.cd -= dt;
  const v = PRED.lunge > 0 ? PRED_LUNGE : PRED_SPEED * fwd;
  PRED.x = Math.min(SB.W - 20, Math.max(20, PRED.x + Math.sin(PRED.th) * v * dt));
  PRED.y = Math.min(SB.H - 20, Math.max(20, PRED.y - Math.cos(PRED.th) * v * dt));
  PRED.z = Math.min(280, Math.max(sbSurface(PRED.x, PRED.y) + PRED_R, PRED.z + up * 70 * dt));
  // o que ela vê: o tamanho aparente e quanto ele cresce (é o que LPLC2 e LC4 medem)
  const hx = f.x + Math.sin(f.th) * 10, hy = f.y - Math.cos(f.th) * 10, hz = f.z + 6;
  const d = Math.hypot(PRED.x - hx, PRED.y - hy, PRED.z - hz);
  const size = 2 * Math.atan(PRED_R / Math.max(d, 1));
  let a = Math.atan2(PRED.x - f.x, -(PRED.y - f.y)) - f.th;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  const grow = (size - PRED.prevSize) / Math.max(dt, 1e-3);
  PRED.prevSize = size;
  f.loom = Math.abs(a) < EYE_BACK ? Math.min(200, PRED_LOOM * Math.max(0, grow)) : 0;
  if (d < PRED_R + 9 && PRED.cd <= 0) predCatch(f);
}
// a Sentinela como objeto nos olhos (LC10a), igual a um elemento novo
function predView(f) {
  if (!PRED.on) return [0, 0];
  const dx = PRED.x - f.x, dy = PRED.y - f.y, d = Math.hypot(dx, dy, PRED.z - f.z);
  if (d < 6) return [0, 0];
  let a = Math.atan2(dx, -dy) - f.th;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  const s = Math.min(1, 2 * Math.atan(PRED_R * 2 / d) / EYE_SAT) ** 2;
  return [a > -EYE_BACK && a < EYE_FRONT ? s : 0, a < EYE_BACK && a > -EYE_FRONT ? s : 0];
}
function predCatch(f) {
  PRED.captures++; PRED.cd = 3;
  f.pain = 0.5; f.lastPain = brainT / 1000; f.threat = 0.4;
  labEvent('captura', {});
  logEvent('A Sentinela pegou a mosca. Dopamina de punição (PPL1): o cheiro de onde ela estava vai repelir.', 'b');
  sbTakeoff(f, 'fuga');
  f.vz = 180;
}
function predSet(on) {
  PRED.on = on;
  if (on) predSpawn();
  else fly && (fly.loom = 0);
  $('#predBtn').classList.toggle('on', on);
  $('#predHelp').hidden = !on;
  if (SBR.pred) SBR.pred.visible = on;
  if (on) sbCamMode('pred');
  else if (SBR.mode === 'pred') sbCamMode('spec');
  logEvent(on ? 'Uma Sentinela entrou no mundo. É você.' : 'A Sentinela saiu.');
}
addEventListener('keydown', e => {
  if (!SB.on || !PRED.on || e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { if (PRED.lungeCd <= 0) { PRED.lunge = 0.7; PRED.lungeCd = 2; } }
  else PRED.keys.add(k);
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => PRED.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => PRED.keys.clear());

/* ───────────── corpo físico (NeuroMechFly, servidor local) ───────────── */
// A física do corpo roda em corpo/servidor.py (flygym + MuJoCo, com passadas gravadas de moscas reais).
// Daqui vai o sinal descendente [esquerda, direita]; de lá vem a pose de cada peça do corpo.
// escala: 7 px por mm (a mosca, com ~2,5 mm, fica com ~18 px, bem menor que um botão)
const CORPO = { url: 'http://localhost:8766', ok: false, malha: null, t0: 0, pose: null, busy: false, iv: 0, S: 7, pausado: false };
// física (mm, y para cima) <-> tela (px, y para baixo), com a origem no canto do mundo
const corpoDaTela = f => ({ x: f.x / CORPO.S, y: -f.y / CORPO.S, rumo: Math.PI / 2 - f.th });
async function corpoTeleporte(f) {
  // poses pedidas antes (ou durante) o teleporte são descartadas: mostrariam o lugar antigo
  CORPO.gen = (CORPO.gen || 0) + 1; CORPO.teleportando = true;
  try { await fetch(CORPO.url + '/teleporte', { method: 'POST', body: JSON.stringify(corpoDaTela(f)) }); } catch { /* o próximo passo avisa */ }
  CORPO.teleportando = false; CORPO.gen++; CORPO.prev = null; CORPO.pose = null;
}
async function corpoPing() {
  try { CORPO.ok = (await fetch(CORPO.url + '/ping', { cache: 'no-store' })).ok; } catch { CORPO.ok = false; }
  $('#corpoBtn').disabled = !CORPO.ok;
  return CORPO.ok;
}
function corpoMeshes(info, bin) {
  const V = new Float32Array(bin, 0, info.nv * 3), F = new Uint32Array(bin, info.nv * 12, info.nf * 3);
  const group = new THREE.Group(), meshes = [];
  for (const p of info.pecas) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(V.slice(p.v0 * 3, (p.v0 + p.nv) * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(F.slice(p.f0 * 3, (p.f0 + p.nf) * 3), 1));
    geo.computeVertexNormals();
    const asa = p.nome.includes('wing');
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: asa ? new THREE.Color('#cfe3f0') : new THREE.Color(...p.cor),
      roughness: asa ? 0.2 : 0.55, metalness: asa ? 0.3 : 0.05, transparent: asa, opacity: asa ? 0.18 : 1, depthWrite: !asa,
      side: asa ? THREE.DoubleSide : THREE.FrontSide }));
    mesh.matrixAutoUpdate = false;
    group.add(mesh); meshes.push(mesh);
  }
  return { group, meshes };
}
// sinal descendente: a velocidade que o corpo pede (parar para provar, desviar, ré) e a virada dos DNa01-03
function corpoSinal(f) {
  if (f.startle > 0) return [1.5 * f.startleDir, -1.5 * f.startleDir];
  const v = (f.back > 0 ? -0.8 : 1) * Math.min(1.2, (f.speed || 0) / WALK);
  const u = Math.max(-0.9, Math.min(0.9, 0.15 * (f.turnCmd || 0)));
  return [v + u, v - u];
}
async function corpoTick() {
  if (CORPO.busy || !SB.fisico || !fly) return;
  CORPO.busy = true;
  try {
    const tb = brainT / 1000 - CORPO.t0, gen = CORPO.gen;
    // no ar, o corpo físico fica parado esperando o pouso
    const p = await (await fetch(CORPO.url + '/passo', { method: 'POST', body: JSON.stringify({ t: tb, sinal: fly.flying ? [0, 0] : corpoSinal(fly) }) })).json();
    if (CORPO.teleportando || gen !== CORPO.gen) return;
    // guarda a pose anterior para desenhar o meio do caminho entre as duas (a tela é mais rápida que a física)
    const agora = performance.now();
    CORPO.prev = CORPO.pose ? CORPO.pose.geoms : p.geoms;
    CORPO.dtArr = Math.min(250, Math.max(30, agora - (CORPO.tArr || agora)));
    CORPO.tArr = agora;
    CORPO.pose = p;
    fly.toque = fly.flying ? null : p.toque;
    if (!fly.flying) {
      // a posição e o rumo dela vêm da física (mm -> px; o y da física aponta para cima na tela)
      const nx = p.torax[0] * CORPO.S, ny = -p.torax[1] * CORPO.S, s = sbSurface(nx, ny);
      if (Math.abs(s - fly.z) <= SB_STEP) { fly.x = nx; fly.y = ny; fly.z = s; fly.th = Math.PI / 2 - p.rumo; }
      else if (sbWantsFly(fly)) {
        // beira de plataforma (ou parede de outra): decola dali mesmo
        fly.th = Math.PI / 2 - p.rumo;
        sbTakeoff(fly, s > fly.z ? 'subir' : 'beira');
      } else {
        // não anda para o vazio: meia-volta, e o corpo volta para antes da beira
        fly.th += Math.PI * (0.6 + 0.4 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
        corpoTeleporte(fly);
      }
    }
    // se o corpo ficar muito para trás, o cérebro espera (com folga, para não ficar liga-desliga)
    const atraso = tb - p.t;
    if (atraso > 0.5 && !CORPO.pausado) { worker.postMessage({ type: 'run', on: false }); CORPO.pausado = true; }
    else if (atraso < 0.15 && CORPO.pausado) { worker.postMessage({ type: 'run', on: running }); CORPO.pausado = false; }
  } catch (e) {
    logEvent('O servidor do corpo físico parou de responder. Voltando ao corpo simplificado.');
    corpoSet(false);
  } finally { CORPO.busy = false; }
}
function corpoPose() {
  const cur = CORPO.pose.geoms, prev = CORPO.prev || cur, S = CORPO.S, ox = -SB.W / 2, oz = -SB.H / 2, oy = fly.z;
  const a = Math.min(1, (performance.now() - CORPO.tArr) / CORPO.dtArr);
  const g = prev.length === cur.length ? cur.map((v, i) => prev[i] + (v - prev[i]) * a) : cur;
  CORPO.malha.meshes.forEach((mesh, i) => {
    const k = i * 12, px = g[k], py = g[k + 1], pz = g[k + 2];
    const m0 = g[k + 3], m1 = g[k + 4], m2 = g[k + 5], m3 = g[k + 6], m4 = g[k + 7], m5 = g[k + 8], m6 = g[k + 9], m7 = g[k + 10], m8 = g[k + 11];
    // física (x frente, y esquerda, z cima) -> cena (x, altura, z): linha 2 = z da física, linha 3 = -y da física
    mesh.matrix.set(S * m0, S * m1, S * m2, ox + S * px,
      S * m6, S * m7, S * m8, oy + S * pz,
      -S * m3, -S * m4, -S * m5, oz - S * py,
      0, 0, 0, 1);
    mesh.matrixWorldNeedsUpdate = true;
  });
}
async function corpoPreparar() {
  if (!CORPO.malha) {
    // a malha é gravada pelo servidor do corpo em web/data/ e vem do mesmo servidor dos dados do cérebro
    const [info, bin] = await Promise.all([fetch('data/corpo_malha.json', { cache: 'no-cache' }).then(r => r.json()),
      fetch('data/corpo_malha.bin', { cache: 'no-cache' }).then(r => r.arrayBuffer())]);
    CORPO.malha = corpoMeshes(info, bin);
    SBR.scene.add(CORPO.malha.group);
  }
  const r = await fetch(CORPO.url + '/reset', { method: 'POST', body: '{}' });
  if (!r.ok) throw new Error('reset respondeu ' + r.status);
}
async function corpoSet(on) {
  if (on === SB.fisico) return;
  if (on) {
    let erro = null;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        erro = null;
        await corpoPreparar();
        break;
      } catch (e) { erro = e; await new Promise(r => setTimeout(r, 600)); }
    }
    if (erro) { logEvent('Não deu para ligar o corpo físico: ' + erro.message + '. O servidor (corpo/servidor.py) está rodando?'); return; }
    SB.fisico = true;
    fly.startle = 0;
    CORPO.t0 = brainT / 1000; CORPO.pose = null; CORPO.prev = null;
    if (!fly.flying) await corpoTeleporte(fly);   // o corpo físico começa onde ela está
    CORPO.iv = setInterval(corpoTick, 40);
    SBR.fly.scale.setScalar(0.95);   // no ar ela volta ao modelo simples, do mesmo tamanho do corpo físico
    logEvent('Corpo físico ligado: NeuroMechFly no MuJoCo, com passadas gravadas de moscas reais. O cérebro manda virar e andar; as patas fazem o resto. No ar, ela usa o modelo simples.');
  } else {
    clearInterval(CORPO.iv);
    SB.fisico = false;
    fly.toque = null;
    SBR.fly.scale.setScalar(1.7);
    if (CORPO.pausado) { worker.postMessage({ type: 'run', on: running }); CORPO.pausado = false; }
    if (CORPO.malha) CORPO.malha.group.visible = false;
  }
  if (CORPO.malha) CORPO.malha.group.visible = SB.fisico;
  $('#corpoBtn').classList.toggle('on', SB.fisico);
}

/* ───────────── olhos reais (modelo de olho composto do flygym) ───────────── */
// Cada olho é uma câmera perspectiva de 157° posta no olho da malha; a imagem passa pela correção de olho de
// peixe e cada pixel soma no seu omatídeo (canal verde nos "amarelos", azul nos "pálidos"), como em
// flygym/vision/retina.py. A tabela vem de corpo/olho_mapas.py (grade 4x menor que a do flygym).
// Moscas quase não veem vermelho: nesses canais, o vermelho aparece escuro.
const OLHO = { mapa: null, rt: null, cams: null, buf: null, val: null, tex: null, quad: null, conta: 0 };
async function olhoCarregar() {
  if (OLHO.mapa || !SBR.r) return;
  try { OLHO.mapa = await fetch('data/olho_mapas.json', { cache: 'no-cache' }).then(r => r.json()); } catch { return; }
  const M = OLHO.mapa;
  OLHO.rt = new THREE.WebGLRenderTarget(M.colunas, M.linhas);
  OLHO.cams = [0, 1].map(() => { const c = new THREE.PerspectiveCamera(M.fovy, M.colunas / M.linhas, 0.2, 4000); c.matrixAutoUpdate = false; return c; });
  OLHO.buf = new Uint8Array(M.colunas * M.linhas * 4);
  OLHO.val = [new Float32Array(M.omatidios), new Float32Array(M.omatidios)];
  OLHO.tex = [0, 1].map(() => {
    const t = new THREE.DataTexture(new Uint8Array(M.colunas * M.linhas * 4), M.colunas, M.linhas, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
  });
  OLHO.cena = new THREE.Scene();
  OLHO.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: OLHO.tex[0], transparent: true, depthTest: false }));
  OLHO.cena.add(OLHO.quad);
}
// pose das câmeras dos olhos: do corpo físico (servidor) ou, sem ele, uma aproximação na cabeça
function olhoPoses(f) {
  const S = CORPO.S, ox = -SB.W / 2, oz = -SB.H / 2;
  if (SB.fisico && CORPO.pose && CORPO.pose.olhos && !f.flying) {
    OLHO.cams.forEach((cam, i) => {
      const [px, py, pz, m0, m1, m2, m3, m4, m5, m6, m7, m8] = CORPO.pose.olhos[i];
      cam.matrixWorld.set(m0, m1, m2, ox + S * px, m6, m7, m8, f.z + S * pz, -m3, -m4, -m5, oz - S * py, 0, 0, 0, 1);
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    });
    return;
  }
  const [x, z] = sbTo3(f.x, f.y), hx = x + Math.sin(f.th) * 8, hz = z - Math.cos(f.th) * 8, hy = f.z + 5;
  OLHO.cams.forEach((cam, i) => {
    const yaw = f.th + (i ? 1.05 : -1.05);
    cam.position.set(hx, hy, hz);
    cam.lookAt(hx + Math.sin(yaw) * 100, hy - 8, hz - Math.cos(yaw) * 100);
    cam.updateMatrix();   // matrixAutoUpdate está desligado (no corpo físico a matriz vem pronta do servidor)
    cam.updateMatrixWorld(true);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  });
}
function olhoAmostrar(f) {
  const M = OLHO.mapa, R = SBR.r;
  olhoPoses(f);
  // o próprio corpo não aparece para os olhos (o flygym esconde cabeça, olhos, antenas e tórax)
  const esconde = [SBR.fly, SBR.fields, SBR.rays, SBR.trailLine, SBR.ring, SBR.shadow, SBR.marker, SBR.predMarker, CORPO.malha && CORPO.malha.group].filter(Boolean);
  const vis = esconde.map(o => o.visible);
  esconde.forEach(o => { o.visible = false; });
  const feats = [];
  for (let i = 0; i < 2; i++) {
    R.setRenderTarget(OLHO.rt);
    R.setClearColor(SBR.bg, 1); R.clear();
    R.render(SBR.scene, OLHO.cams[i]);
    R.readRenderTargetPixels(OLHO.rt, 0, 0, M.colunas, M.linhas, OLHO.buf);
    const v = OLHO.val[i];
    v.fill(0);
    for (let k = 0; k < M.fonte_px.length; k++) {
      const o = M.omatidio_px[k];
      if (o < 0) continue;
      const s = M.fonte_px[k], sr = (s / M.colunas) | 0, sc = s % M.colunas;
      v[o] += OLHO.buf[((M.linhas - 1 - sr) * M.colunas + sc) * 4 + (M.palido[o] ? 2 : 1)] / 255 / M.pixels_por_omatidio[o];
    }
    // o que chama o LC10a: omatídeos mais claros que o resto do olho (o que ela não provou brilha mais)
    let mu = 0;
    for (let o = 0; o < M.omatidios; o++) mu += v[o];
    mu /= M.omatidios;
    let obj = 0;
    for (let o = 0; o < M.omatidios; o++) obj += Math.max(0, v[o] - mu - 0.06);
    feats.push(obj);
    // imagem do olho para o HUD: cada pixel pinta o valor do seu omatídeo
    const px = OLHO.tex[i].image.data;
    for (let k = 0; k < M.fonte_px.length; k++) {
      const o = M.omatidio_px[k], r = (k / M.colunas) | 0, c = k % M.colunas, j = ((M.linhas - 1 - r) * M.colunas + c) * 4;
      if (o < 0) { px[j + 3] = 0; continue; }
      const b = Math.min(255, v[o] * 255 * 1.6);
      px[j] = M.palido[o] ? b * 0.45 : b * 0.25; px[j + 1] = M.palido[o] ? b * 0.7 : b; px[j + 2] = M.palido[o] ? b : b * 0.45; px[j + 3] = 255;
    }
    OLHO.tex[i].needsUpdate = true;
  }
  R.setRenderTarget(null);
  esconde.forEach((o, k) => { o.visible = vis[k]; });
  const [L, Rr] = feats, g = 4;
  f.olhoReal = { L: L / (L + Rr + g), R: Rr / (L + Rr + g), bruto: feats, t: performance.now() };
}
function olhoDesenhar(i, vx, vy, vw, vh) {
  const M = OLHO.mapa, a = M.colunas / M.linhas;
  const w = Math.min(vw, vh * a), h = w / a;
  OLHO.quad.material.map = OLHO.tex[i];
  SBR.r.setViewport(vx + (vw - w) / 2, vy + (vh - h) / 2, w, h);
  SBR.r.setScissor(vx + (vw - w) / 2, vy + (vh - h) / 2, w, h);
  SBR.r.render(OLHO.cena, SBR.quadCam);
}

/* ───────────── o visual ───────────── */
const SBR = { r: null, built: '', boxes: new Map(), glitches: [], mode: 'spec', trail: [], camReady: false, rainT: 0 };
const sbTo3 = (x, y) => [x - SB.W / 2, y - SB.H / 2];

function sbInitRender() {
  const canvas = $('#world');
  const r = SBR.r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  r.autoClear = false;
  const s = SBR.scene = new THREE.Scene();
  SBR.bg = new THREE.Color('#010503');
  s.fog = new THREE.FogExp2('#010503', 0.00085);
  s.add(new THREE.HemisphereLight('#aaffd0', '#021a0c', 0.7));
  const key = new THREE.DirectionalLight('#e6fff0', 0.55);
  key.position.set(-500, 900, 300); s.add(key);
  // chão de grade
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SB.W + 1600, SB.H + 1600), new THREE.MeshStandardMaterial({ color: '#020b06', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; s.add(floor);
  const grid = new THREE.GridHelper(SB.W + 1600, 60, '#2bff86', '#0a4a24');
  grid.material.transparent = true; grid.material.opacity = 0.45; grid.position.y = 0.3; s.add(grid);
  // chuva de código ao redor
  SBR.rain = sbRain(); s.add(SBR.rain.mesh);
  // a mosca, a sombra no que está embaixo e o rastro do voo
  SBR.fly = evFly(); SBR.fly.scale.setScalar(1.7); s.add(SBR.fly);
  SBR.shadow = new THREE.Mesh(new THREE.CircleGeometry(10, 28), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.6, depthWrite: false }));
  SBR.shadow.rotation.x = -Math.PI / 2; s.add(SBR.shadow);
  SBR.ring = new THREE.Mesh(new THREE.RingGeometry(12, 14, 36), new THREE.MeshBasicMaterial({ color: SB_COL.neon, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  SBR.ring.rotation.x = -Math.PI / 2; s.add(SBR.ring);
  SBR.trailLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: SB_COL.neon, transparent: true, opacity: 0.55 }));
  SBR.trailLine.frustumCulled = false; s.add(SBR.trailLine);
  // campos de visão e linhas até o que ela vê
  SBR.fields = new THREE.Group();
  SBR.fields.add(evWedge(SB_COL.L, -EYE_BACK, EYE_FRONT), evWedge(SB_COL.R, -EYE_FRONT, EYE_BACK));
  for (const w of SBR.fields.children) { w.material.opacity = 0.1; w.material.blending = THREE.AdditiveBlending; }
  s.add(SBR.fields);
  SBR.rays = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
  SBR.rays.frustumCulled = false; s.add(SBR.rays);
  // marcador dela no mapa
  SBR.marker = new THREE.Mesh(new THREE.ConeGeometry(18, 40, 3), new THREE.MeshBasicMaterial({ color: '#d8ffe9' }));
  SBR.marker.rotation.x = -Math.PI / 2; SBR.marker.visible = false; s.add(SBR.marker);
  // a Sentinela: cabeça metálica, olhos vermelhos, tentáculos
  const pred = SBR.pred = new THREE.Group();
  pred.add(new THREE.Mesh(new THREE.SphereGeometry(PRED_R, 24, 18), new THREE.MeshStandardMaterial({ color: '#58616b', metalness: 0.45, roughness: 0.35, emissive: '#1c0707' })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(PRED_R * 0.98, 1.1, 8, 40, Math.PI * 1.1), new THREE.MeshBasicMaterial({ color: '#ff3b3b' }));
  band.rotation.set(Math.PI / 2, 0, Math.PI * 0.95); band.position.y = 1.5;
  pred.add(band);
  const eyeM = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
  for (let i = 0; i < 6; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 8), eyeM);
    const a = (i % 3 - 1) * 0.45, b = i < 3 ? 0.18 : -0.2;
    e.position.set(Math.sin(a) * PRED_R * 0.95, b * PRED_R + 2, -Math.cos(a) * PRED_R * 0.95);
    pred.add(e);
  }
  const glow = new THREE.PointLight('#ff2a2a', 1.4, 220);
  glow.position.set(0, 0, -PRED_R - 6); pred.add(glow);
  SBR.tent = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: '#4a525a', metalness: 0.4, roughness: 0.4, emissive: '#3a0a0a' }), 8 * 12);
  SBR.tent.frustumCulled = false;
  pred.add(SBR.tent);
  pred.visible = false;
  s.add(pred);
  SBR.predMarker = new THREE.Mesh(new THREE.ConeGeometry(20, 44, 3), new THREE.MeshBasicMaterial({ color: '#ff3b4a' }));
  SBR.predMarker.rotation.x = -Math.PI / 2; SBR.predMarker.visible = false; s.add(SBR.predMarker);
  SBR.cam = new THREE.PerspectiveCamera(58, 1, 1, 6000);
  SBR.eyeCam = new THREE.PerspectiveCamera(90, EYE_COLS / EYE_ROWS, 0.5, 6000);
  SBR.top = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
  SBR.top.position.set(0, 2000, 0); SBR.top.up.set(0, 0, -1); SBR.top.lookAt(0, 0, 0);
  SBR.eyeRT = [0, 1].map(() => new THREE.WebGLRenderTarget(EYE_COLS, EYE_ROWS, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }));
  SBR.hex = evHexMaterial();
  SBR.hex.uniforms.bg.value.copy(SBR.bg);
  SBR.hex.uniforms.ringOn.value = 1;
  SBR.hex.transparent = true;
  SBR.quadScene = new THREE.Scene();
  SBR.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), SBR.hex));
  SBR.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
}

// chuva de código: colunas de caracteres caindo, numa parede cilíndrica em volta do mundo
function sbRain() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 384;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  const fs = 14, cols = Math.floor(cv.width / fs);
  const drops = Array.from({ length: cols }, () => Math.random() * cv.height / fs);
  const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789{}<>=+*/;NaN404';
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(3, 1);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1900, 1900, 1100, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  mesh.position.y = 420;
  const step = () => {
    g.fillStyle = 'rgba(0, 0, 0, 0.12)'; g.fillRect(0, 0, cv.width, cv.height);
    g.font = `${fs}px monospace`;
    for (let i = 0; i < cols; i++) {
      const y = drops[i] * fs;
      g.fillStyle = '#c8ffdd'; g.fillText(chars[(Math.random() * chars.length) | 0], i * fs, y);
      g.fillStyle = '#1fbf5f'; g.fillText(chars[(Math.random() * chars.length) | 0], i * fs, y - fs);
      if (y > cv.height && Math.random() > 0.96) drops[i] = 0;
      drops[i] += 0.6 + (i % 5) * 0.12;
    }
    tex.needsUpdate = true;
  };
  return { mesh, step };
}

function sbLabelTex(text, w, h) {
  const k = 4, cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const g = cv.getContext('2d');
  g.fillStyle = '#03140a'; g.fillRect(0, 0, cv.width, cv.height);
  g.strokeStyle = '#2bff86'; g.lineWidth = 6; g.strokeRect(3, 3, cv.width - 6, cv.height - 6);
  let fs = cv.height * 0.42;
  g.font = `600 ${fs}px ui-monospace, Consolas, monospace`;
  while (g.measureText(text).width > cv.width * 0.88 && fs > 8) { fs -= 2; g.font = `600 ${fs}px ui-monospace, Consolas, monospace`; }
  g.fillStyle = '#b8ffd6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, cv.width / 2, cv.height / 2);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}
function sbGridTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(43, 255, 134, 0.35)'; g.lineWidth = 2;
  g.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// plataformas e elementos; refeitos quando o sistema muda
function sbSyncWorld() {
  const sig = SB.app + ':' + rects.map(r => r.id + (r.disabled ? 0 : 1)).join('|');
  if (sig === SBR.built) return;
  SBR.built = sig;
  for (const o of SBR.worldObjs || []) { SBR.scene.remove(o); o.traverse(c => { c.geometry?.dispose(); [].concat(c.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); }); }
  SBR.worldObjs = []; SBR.boxes.clear();
  const add = o => { SBR.scene.add(o); SBR.worldObjs.push(o); };
  const gridTex = sbGridTex();
  for (const p of SB.platforms) {
    const [x, z] = sbTo3(p.x + p.w / 2, p.y + p.h / 2);
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(p.w, p.z, p.h);
    const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#03170c', emissive: '#01200d', roughness: 0.55, metalness: 0.2, transparent: true, opacity: 0.9 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: SB_COL.neon, transparent: true, opacity: 0.85 }));
    const tt = gridTex.clone(); tt.needsUpdate = true; tt.repeat.set(p.w / 32, p.h / 32);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ map: tt, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    top.rotation.x = -Math.PI / 2; top.position.y = p.z / 2 + 0.3;
    g.add(body, edges, top);
    g.position.set(x, p.z / 2, z);
    add(g);
  }
  for (const r of rects) {
    if (r.disabled) continue;
    const side = new THREE.MeshStandardMaterial({ color: '#052a14', emissive: '#1bff6e', emissiveIntensity: 0.6, roughness: 0.4 });
    const top = new THREE.MeshStandardMaterial({ map: sbLabelTex(label(r.id), r.w, r.h), emissive: '#ffffff', emissiveIntensity: 0.25, emissiveMap: null });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(r.w, 6, r.h), [side, side, top, side, side, side]);
    const [x, z] = sbTo3(r.x + r.w / 2, r.y + r.h / 2);
    mesh.position.set(x, r.z + 3, z);
    add(mesh);
    SBR.boxes.set(r.id, { mesh, side, top, base: mesh.position.clone() });
  }
}

// um bug estourou: o elemento vira glitch e uma caixa vermelha cresce na direção dela
function sbGlitch(id) {
  const b = SBR.boxes.get(id);
  if (!b) return;
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(SB_EL_W, 30, SB_EL_H));
  const box = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ff2a55', transparent: true, blending: THREE.AdditiveBlending }));
  box.position.copy(b.base).setY(b.base.y + 12);
  SBR.scene.add(box);
  SBR.glitches.push({ box, t0: performance.now() });
}

const SB_NEW = new THREE.Color('#1bff6e'), SB_OLD = new THREE.Color('#0c4a26'), SB_BUG = new THREE.Color('#ff2a55');
function sbUpdate(dtw, now) {
  sbSyncWorld();
  const f = fly;
  const seen = new Map((f.seen || []).map(([r, sl, sr]) => [r.id, [sl, sr]]));
  const c = new THREE.Color();
  for (const [id, b] of SBR.boxes) {
    const st = el(id);
    const [sl, sr] = seen.get(id) || [0, 0];
    if (st.bug) {
      const flick = Math.random() < 0.15;
      b.side.emissive.copy(SB_BUG); b.side.emissiveIntensity = flick ? 0.2 : 1.1;
      b.mesh.position.set(b.base.x + (flick ? (Math.random() - 0.5) * 6 : 0), b.base.y, b.base.z + (flick ? (Math.random() - 0.5) * 4 : 0));
    } else {
      c.copy(SB_OLD).lerp(SB_NEW, st.novelty);
      c.add(SB_COL.L.clone().multiplyScalar(Math.min(1, sl * 1.5) * 0.5)).add(SB_COL.R.clone().multiplyScalar(Math.min(1, sr * 1.5) * 0.5));
      b.side.emissive.copy(c); b.side.emissiveIntensity = 0.35 + 0.65 * st.novelty;
      b.mesh.position.copy(b.base);
    }
  }
  for (let i = SBR.glitches.length - 1; i >= 0; i--) {
    const g = SBR.glitches[i], u = (now - g.t0) / 900;
    if (u >= 1) { SBR.scene.remove(g.box); g.box.geometry.dispose(); g.box.material.dispose(); SBR.glitches.splice(i, 1); continue; }
    g.box.scale.setScalar(1 + u * 2.5); g.box.material.opacity = 1 - u;
  }
  // a mosca
  const [x, z] = sbTo3(f.x, f.y);
  const fisicoNoChao = SB.fisico && CORPO.malha && CORPO.pose && !f.flying;
  SBR.fly.visible = !fisicoNoChao;
  if (CORPO.malha) CORPO.malha.group.visible = !!fisicoNoChao;
  if (fisicoNoChao) corpoPose();
  SBR.fly.position.set(x, f.z, z);
  SBR.fly.rotation.set(f.flying ? -0.12 : 0, -f.th, 0, 'YXZ');
  for (const w of SBR.fly.userData.wings) {
    w.rotation.z = f.flying ? w.userData.side * (0.9 + 0.7 * Math.sin(now * 0.09)) : w.userData.side * 0.28;
  }
  const [eL, eR] = f.eyes || [0, 0];
  SBR.fly.userData.eyes[0].material.emissive.setRGB(0.25 + 0.6 * eL, 0.05, 0.03);
  SBR.fly.userData.eyes[1].material.emissive.setRGB(0.25 + 0.6 * eR, 0.05, 0.03);
  const below = sbSurface(f.x, f.y);
  SBR.shadow.position.set(x, below + 0.5, z);
  SBR.shadow.material.opacity = f.flying ? Math.max(0.15, 0.6 - (f.z - below) / 150) : 0.55;
  SBR.ring.visible = f.flying;
  SBR.ring.position.set(x, below + 0.6, z);
  // rastro
  if (f.flying) SBR.trail.push(x, f.z + 6, z);
  else if (SBR.trail.length) SBR.trail.splice(0, 3);
  if (SBR.trail.length > 360) SBR.trail.splice(0, SBR.trail.length - 360);
  SBR.trailLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(SBR.trail, 3));
  // campos e linhas
  SBR.fields.position.set(x, f.z + 0.5, z); SBR.fields.rotation.y = -f.th;
  const hx = x + Math.sin(f.th) * 10, hz = z - Math.cos(f.th) * 10, hy = f.z + 6;
  const pos = [], col = [];
  for (const [id, [sl, sr]] of seen) {
    const b = SBR.boxes.get(id);
    if (!b || sl + sr < 0.06) continue;
    c.setRGB(0, 0, 0).add(SB_COL.L.clone().multiplyScalar(sl)).add(SB_COL.R.clone().multiplyScalar(sr)).multiplyScalar(Math.min(1.2, 0.5 + (sl + sr) * 1.5) / (sl + sr));
    pos.push(hx, hy, hz, b.base.x, b.base.y + 4, b.base.z);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  SBR.rays.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  SBR.rays.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  SBR.marker.position.set(x, 900, z); SBR.marker.rotation.z = f.th + Math.PI;
  if (PRED.on) {
    const [px, pz] = sbTo3(PRED.x, PRED.y);
    SBR.pred.position.set(px, PRED.z, pz);
    SBR.pred.rotation.y = -PRED.th;
    // tentáculos: oito correntes de esferas que ondulam atrás da cabeça
    const m = new THREE.Matrix4(), t = now / 1000;
    for (let j = 0; j < 8; j++) {
      const ang = j / 8 * Math.PI * 2;
      for (let i = 0; i < 12; i++) {
        const u = i / 11, wig = Math.sin(t * 6 + i * 0.7 + j) * 5 * u;
        const r = PRED_R * 0.55 * (1 - 0.4 * u);
        m.makeScale(2.6 * (1 - 0.6 * u), 2.6 * (1 - 0.6 * u), 2.6 * (1 - 0.6 * u));
        m.setPosition(Math.cos(ang) * r + wig * Math.cos(ang + 1.5), Math.sin(ang) * r + wig * Math.sin(ang + 1.5), PRED_R * 0.6 + u * 62);
        SBR.tent.setMatrixAt(j * 12 + i, m);
      }
    }
    SBR.tent.instanceMatrix.needsUpdate = true;
    SBR.predMarker.position.set(px, 905, pz); SBR.predMarker.rotation.z = PRED.th + Math.PI;
  }
  SBR.rainT += dtw;
  if (SBR.rainT > 0.07) { SBR.rainT = 0; SBR.rain.step(); }
}

function sbRenderEye(i, vx, vy, vw, vh) {
  if (OLHO.mapa) return olhoDesenhar(i, vx, vy, vw, vh);
  const f = fly, [x, z] = sbTo3(f.x, f.y);
  const yaw = f.th + (i ? EV_EYE_YAW : -EV_EYE_YAW);
  const cam = SBR.eyeCam;
  cam.fov = 2 * Math.atan(Math.tan(EV_EYE_HFOV * Math.PI / 360) / cam.aspect) * 180 / Math.PI;
  cam.updateProjectionMatrix();
  const hx = x + Math.sin(f.th) * 10, hz = z - Math.cos(f.th) * 10, hy = f.z + 6;
  cam.position.set(hx, hy, hz);
  cam.lookAt(hx + Math.sin(yaw) * 100, hy - (f.flying ? 35 : 10), hz - Math.cos(yaw) * 100);
  const hide = [SBR.fly, SBR.fields, SBR.rays, SBR.trailLine, SBR.ring, SBR.shadow];
  hide.forEach(o => { o.visible = false; });
  SBR.r.setRenderTarget(SBR.eyeRT[i]);
  SBR.r.setClearColor(SBR.bg, 1); SBR.r.clear();
  SBR.r.render(SBR.scene, cam);
  SBR.r.setRenderTarget(null);
  hide.forEach(o => { o.visible = true; });
  SBR.ring.visible = f.flying;
  SBR.hex.uniforms.tex.value = SBR.eyeRT[i].texture;
  SBR.hex.uniforms.ring.value.copy(i ? SB_COL.R : SB_COL.L);
  SBR.r.setViewport(vx, vy, vw, vh); SBR.r.setScissor(vx, vy, vw, vh);
  SBR.r.render(SBR.quadScene, SBR.quadCam);
}
function sbRenderMap(vx, vy, vw, vh) {
  const a = vw / vh, half = Math.max(SB.W, SB.H) / 2 + 40;
  Object.assign(SBR.top, a > 1 ? { left: -half * a, right: half * a, top: half, bottom: -half } : { left: -half, right: half, top: half / a, bottom: -half / a });
  SBR.top.updateProjectionMatrix();
  SBR.r.setViewport(vx, vy, vw, vh); SBR.r.setScissor(vx, vy, vw, vh);
  SBR.r.setClearColor('#000000', 1); SBR.r.clear();
  const fog = SBR.scene.fog; SBR.scene.fog = null;
  SBR.rain.mesh.visible = false; SBR.marker.visible = true; SBR.predMarker.visible = PRED.on;
  SBR.r.render(SBR.scene, SBR.top);
  SBR.rain.mesh.visible = true; SBR.marker.visible = false; SBR.predMarker.visible = false; SBR.scene.fog = fog;
}

function sbFrame(dtw) {
  if (!SBR.r || !fly) return;
  const canvas = SBR.r.domElement, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const pr = SBR.r.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) SBR.r.setSize(w, h, false);
  const now = performance.now();
  sbUpdate(dtw, now);
  if (OLHO.mapa && (OLHO.conta++ & 1) === 0) olhoAmostrar(fly);
  const f = fly, R = SBR.r;
  R.setScissorTest(true);
  R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h);
  R.setClearColor(SBR.bg, 1); R.clear();
  const [eL, eR] = f.eyes || [0, 0];
  const estado = f.flying ? `voando · ${Math.round(f.z)} px de altura` : f.z > 0 ? `andando numa plataforma a ${Math.round(f.z)} px` : 'andando no chão';
  if (SBR.mode === 'spec' || SBR.mode === 'olhos' || SBR.mode === 'pred') {
    if (SBR.mode === 'spec' || SBR.mode === 'pred') {
      // espectador: atrás e acima dela (ou da Sentinela), seguindo com atraso
      const P = SBR.mode === 'pred' && PRED.on ? { x: PRED.x, y: PRED.y, z: PRED.z - 20, th: PRED.th, flying: true } : f;
      const [x, z] = sbTo3(P.x, P.y);
      const back = SBR.mode === 'pred' ? 130 : P.flying ? 190 : 170, up = SBR.mode === 'pred' ? 55 : P.flying ? 70 : 95;
      const cx = x - Math.sin(P.th) * back, cz = z + Math.cos(P.th) * back;
      // a câmera nunca fica dentro de uma plataforma
      const want = new THREE.Vector3(cx, Math.max(P.z + up, sbSurface(cx + SB.W / 2, cz + SB.H / 2) + 55), cz);
      SBR.cam.position.lerp(want, SBR.camReady ? 1 - Math.exp(-dtw / 0.4) : 1);
      SBR.camReady = true;
      SBR.cam.aspect = w / h; SBR.cam.updateProjectionMatrix();
      SBR.cam.lookAt(x + Math.sin(P.th) * 70, P.z + 10, z - Math.cos(P.th) * 70);
      R.render(SBR.scene, SBR.cam);
      // HUD: os dois olhos em cima à direita, o mapa embaixo à direita
      const s = Math.round(Math.min(w * 0.17, h * 0.22));
      sbRenderEye(0, w - 2 * s - 14, h - s - 30, s, s);
      sbRenderEye(1, w - s - 8, h - s - 30, s, s);
      const m = Math.round(Math.min(w * 0.26, h * 0.3));
      sbRenderMap(w - m - 8, 44, m, m);
    } else {
      const eh = Math.round(h * 0.55), ew = Math.floor(w / 2), s = Math.min(ew, eh - 28) - 12;
      sbRenderEye(0, Math.round((ew - s) / 2), h - 28 - s - 6, s, s);
      sbRenderEye(1, ew + Math.round((ew - s) / 2), h - 28 - s - 6, s, s);
      sbRenderMap(0, 40, w, h - eh - 40);
    }
    const placar = PRED.on ? ` · Sentinela: ${PRED.captures} capturas, ${PRED.escapes} fugas` : '';
    $('#sbCap').innerHTML = `<span>${estado}${placar}</span><span><b class="ev-l">olho E</b> ${Math.round(eL * 100)}% · <b class="ev-r">olho D</b> ${Math.round(eR * 100)}%</span>`;
  } else {
    sbRenderMap(0, 0, w, h);
    $('#sbCap').innerHTML = `<span>de cima · ${estado}</span><span>leques: o campo de cada olho</span>`;
  }
  R.setScissorTest(false);
}

/* ───────────── ligar e desligar ───────────── */
function sbSet(on) {
  if (on === SB.on) return;
  if (on && !SBR.r) {
    try { sbInitRender(); } catch (e) { console.error(e); logEvent('Não deu para abrir o sandbox 3D neste navegador.'); return; }
  }
  if (!on && PRED.on) predSet(false);
  if (!on && SB.fisico) corpoSet(false);
  if (on) corpoPing();
  SB.on = on;
  if (on) olhoCarregar();
  else if (fly) fly.olhoReal = null;
  document.body.classList.toggle('sandbox', on);
  $('#worldBox').hidden = !on;
  if (on && typeof evShow === 'function') evShow(false);
  if (typeof applyTheme === 'function') applyTheme();
  SB.app = null;
  measure();
  // o cérebro continua o mesmo; o corpo recomeça no ponto de partida do mundo novo
  fly = keepHunger(freshFly());
  Object.assign(disp, { x: fly.x, y: fly.y, th: fly.th, jump: null });
  SBR.trail = []; SBR.camReady = false;
  for (const b of document.querySelectorAll('#modeTabs button')) b.classList.toggle('on', (b.dataset.mode === '3d') === on);
  logEvent(on ? 'Entrou no sandbox 3D: o sistema virou um mundo de plataformas. Ela pode andar e voar.' : 'Voltou para a página 2D.');
}
for (const b of document.querySelectorAll('#modeTabs button')) b.addEventListener('click', () => { if (!LAB.busy) sbSet(b.dataset.mode === '3d'); });
function sbCamMode(m) {
  SBR.mode = m; SBR.camReady = false;
  for (const o of document.querySelectorAll('#sbModes button[data-mode]')) o.classList.toggle('on', o.dataset.mode === m);
}
for (const b of document.querySelectorAll('#sbModes button[data-mode]')) b.addEventListener('click', () => sbCamMode(b.dataset.mode));
$('#predBtn').addEventListener('click', () => { if (SB.on) predSet(!PRED.on); });
$('#corpoBtn').addEventListener('click', () => { if (SB.on) corpoSet(!SB.fisico); });
