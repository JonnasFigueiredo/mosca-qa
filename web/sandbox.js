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
  if (f.flying) { if (why === 'fuga') f.vz = 140; return; }
  f.flying = true; f.flyT = 0; f.vz = why === 'fuga' ? 150 : 70;
  if (why === 'fuga') f.th += Math.PI * (0.6 + 0.8 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
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
    labEvent('pouso', { z: Math.round(below) });
    logEvent(below > 0 ? `Pousou numa plataforma a ${Math.round(below)} px de altura.` : 'Pousou no chão.');
  }
}
function sbNovelBelow(f, below) {
  return rects.some(r => !r.disabled && Math.abs(r.z - below) < 1 && el(r.id).novelty > 0.5 &&
    Math.hypot(r.x + r.w / 2 - f.x, r.y + r.h / 2 - f.y) < 80);
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
  SBR.rainT += dtw;
  if (SBR.rainT > 0.07) { SBR.rainT = 0; SBR.rain.step(); }
}

function sbRenderEye(i, vx, vy, vw, vh) {
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
  SBR.rain.mesh.visible = false; SBR.marker.visible = true;
  SBR.r.render(SBR.scene, SBR.top);
  SBR.rain.mesh.visible = true; SBR.marker.visible = false; SBR.scene.fog = fog;
}

function sbFrame(dtw) {
  if (!SBR.r || !fly) return;
  const canvas = SBR.r.domElement, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const pr = SBR.r.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) SBR.r.setSize(w, h, false);
  const now = performance.now();
  sbUpdate(dtw, now);
  const f = fly, R = SBR.r;
  R.setScissorTest(true);
  R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h);
  R.setClearColor(SBR.bg, 1); R.clear();
  const [eL, eR] = f.eyes || [0, 0];
  const estado = f.flying ? `voando · ${Math.round(f.z)} px de altura` : f.z > 0 ? `andando numa plataforma a ${Math.round(f.z)} px` : 'andando no chão';
  if (SBR.mode === 'spec' || SBR.mode === 'olhos') {
    if (SBR.mode === 'spec') {
      // espectador: atrás e acima dela, seguindo com atraso
      const [x, z] = sbTo3(f.x, f.y);
      const back = f.flying ? 190 : 170, up = f.flying ? 70 : 95;
      const cx = x - Math.sin(f.th) * back, cz = z + Math.cos(f.th) * back;
      // a câmera nunca fica dentro de uma plataforma
      const want = new THREE.Vector3(cx, Math.max(f.z + up, sbSurface(cx + SB.W / 2, cz + SB.H / 2) + 55), cz);
      SBR.cam.position.lerp(want, SBR.camReady ? 1 - Math.exp(-dtw / 0.4) : 1);
      SBR.camReady = true;
      SBR.cam.aspect = w / h; SBR.cam.updateProjectionMatrix();
      SBR.cam.lookAt(x + Math.sin(f.th) * 70, f.z + 10, z - Math.cos(f.th) * 70);
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
    $('#sbCap').innerHTML = `<span>${estado}</span><span><b class="ev-l">olho E</b> ${Math.round(eL * 100)}% · <b class="ev-r">olho D</b> ${Math.round(eR * 100)}%</span>`;
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
  SB.on = on;
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
for (const b of document.querySelectorAll('#sbModes button')) b.addEventListener('click', () => {
  SBR.mode = b.dataset.mode; SBR.camReady = false;
  for (const o of document.querySelectorAll('#sbModes button')) o.classList.toggle('on', o === b);
});
