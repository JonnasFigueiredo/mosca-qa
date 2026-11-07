// Pelos olhos dela: o sistema em teste como um chão de botões em 3D, com a mosca andando por cima.
// Mostra o que entra nos olhos no modelo: a direção e o tamanho aparente de cada elemento clicável,
// com o que ela já provou pesando menos (see() na página). A retina não é simulada; a imagem em
// facetas do modo "Olhos dela" é ilustração, com ~800 facetas por olho, como numa mosca real, nas cores que
// os receptores dela captam (corMosca).
// Usa globais da página: THREE, W, H, fly, disp, rects, el, label, elementAt, EYE_FRONT, EYE_BACK.
'use strict';

const EV = { on: false, mode: 'spec', r: null, boxes: new Map(), sig: '', lift: 0, camReady: false };
const EV_BOX_H = 5;                  // altura dos botões
const EV_EYE_H = 3.4;                // altura dos olhos acima de onde ela pisa
const EV_EYE_YAW = 0.95;             // rad: para onde cada olho aponta (≈55° para cada lado)
const EV_EYE_HFOV = 110;             // graus de largura mostrados por olho
const EYE_COLS = 26, EYE_ROWS = 31;  // ~800 facetas por olho
const EV_COL_L = new THREE.Color('#3D7BD9'), EV_COL_R = new THREE.Color('#E07B39');
// Cores como a mosca vê (aproximação). Ela não tem receptor de vermelho: os R8 "amarelos" (rodopsina Rh6, pico em
// ~508 nm, cauda até ~600 nm) dão o verde dela e os R8 "pálidos" (Rh5, ~437 nm), o azul. Ela também vê ultravioleta
// (R7), mas a cena desenhada só tem vermelho, verde e azul, então o ultravioleta fica de fora. Os dois canais viram
// um mundo azul e amarelo na tela, como nas simulações de daltonismo: o branco continua branco, o vermelho escurece.
// Os pesos de cada cor da tela em cada receptor são aproximados, não medidos
const MOSCA_VERDE = [0.2, 0.65, 0.15], MOSCA_AZUL = [0, 0.15, 0.85];
function corMosca(r, g, b) {
  const v = MOSCA_VERDE[0] * r + MOSCA_VERDE[1] * g + MOSCA_VERDE[2] * b;
  return [v, v, MOSCA_AZUL[0] * r + MOSCA_AZUL[1] * g + MOSCA_AZUL[2] * b];
}

const evTo3 = (x, y) => [x - W / 2, y - H / 2];                         // página -> chão (x, z)
const evDir = a => [Math.sin(a), -Math.cos(a)];                         // direção na página

function evColors() {
  const cs = getComputedStyle(document.documentElement);
  const v = k => new THREE.Color((cs.getPropertyValue(k) || '#888').trim());
  return { surface: v('--surface'), bg: v('--bg'), line: v('--line'), ink: v('--ink') };
}

function evFly() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: '#4A3520' });
  const part = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m;
  };
  const sph = new THREE.SphereGeometry(1, 16, 12);
  part(sph, body, 0, 3.2, 0, 3.6, 3.2, 4.2);                 // tórax
  part(sph, body, 0, 3.0, 7.5, 3.2, 2.8, 5.5);               // abdome
  part(sph, body, 0, 3.4, -5.4, 2.6, 2.4, 2.2);              // cabeça
  const eyeMat = new THREE.MeshLambertMaterial({ color: '#B8322A', emissive: '#3A0A08' });
  g.userData.eyes = [part(sph, eyeMat.clone(), -2.2, 3.9, -5.9, 1.5, 1.9, 1.7), part(sph, eyeMat.clone(), 2.2, 3.9, -5.9, 1.5, 1.9, 1.7)];
  g.userData.wings = [];
  const wing = new THREE.MeshLambertMaterial({ color: '#DDE6EE', transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const wg = new THREE.PlaneGeometry(5, 12);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wg, wing);
    w.rotation.x = -Math.PI / 2; w.rotation.z = s * 0.28;
    w.position.set(s * 3.4, 6.2, 6); g.add(w);
    w.userData.side = s;
    g.userData.wings.push(w);
  }
  const legMat = new THREE.LineBasicMaterial({ color: '#3A2A18' });
  const pts = [];
  for (const s of [-1, 1]) for (const z of [-3, 0, 3]) pts.push(s * 2.5, 2.2, z, s * 7, 0, z + (z < 0 ? -2 : z > 0 ? 3 : 0));
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, legMat));
  return g;
}

// leque no chão, no referencial da mosca (frente = -z): o campo de um olho até uma distância
function evWedge(color, a0, a1) {
  const R = 260, n = 40, pos = [0, 0.3, 0];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pos.push(Math.sin(a) * R, 0.3, -Math.cos(a) * R); }
  const idx = [];
  for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
}

// olho composto: a imagem de cada olho, desenhada em poucos pontos, vira facetas hexagonais
function evHexMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { tex: { value: null }, cols: { value: EYE_COLS }, rows: { value: EYE_ROWS }, bg: { value: new THREE.Color() },
      ring: { value: new THREE.Color() }, ringOn: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tex; uniform float cols; uniform float rows; uniform vec3 bg; uniform vec3 ring; uniform float ringOn;
      varying vec2 vUv;
      void main() {
        vec2 q = (vUv - 0.5) * 2.0;
        float rr = dot(q, q);
        if (rr > 1.0) { if (ringOn > 0.5) discard; gl_FragColor = vec4(bg, 1.0); return; }   // o contorno do olho
        if (ringOn > 0.5 && rr > 0.9) { gl_FragColor = vec4(ring, 1.0); return; }
        vec2 p = vec2(vUv.x * cols, vUv.y * rows);
        float best = 1e9; vec2 bc = vec2(0.0);
        for (int dy = -1; dy <= 1; dy++) {
          float r = floor(p.y) + float(dy);
          float off = mod(r, 2.0) * 0.5;
          for (int dx = -1; dx <= 1; dx++) {
            vec2 c = vec2(floor(p.x - off) + float(dx) + 0.5 + off, r + 0.5);
            vec2 d = (p - c) * vec2(1.0, 0.87);
            float dd = dot(d, d);
            if (dd < best) { best = dd; bc = c; }
          }
        }
        vec3 col = texture2D(tex, clamp(bc / vec2(cols, rows), 0.0, 1.0)).rgb;
        // as cores que ela vê (corMosca): sem vermelho, o verde dela vira amarelo na tela
        float vd = dot(col, vec3(${MOSCA_VERDE.map(v => v.toFixed(3)).join(', ')}));
        col = vec3(vd, vd, dot(col, vec3(${MOSCA_AZUL.map(v => v.toFixed(3)).join(', ')})));
        float edge = smoothstep(0.30, 0.45, sqrt(best));
        gl_FragColor = vec4(mix(col, col * 0.3, edge), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
}

function evInit() {
  const canvas = $('#eyeview');
  EV.r = new THREE.WebGLRenderer({ canvas, antialias: true });
  EV.r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  EV.r.autoClear = false;
  const s = EV.scene = new THREE.Scene();
  s.add(new THREE.HemisphereLight(0xffffff, 0x445055, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(-220, 420, 160); s.add(sun);
  EV.floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, H + 40), new THREE.MeshLambertMaterial());
  EV.floor.rotation.x = -Math.PI / 2; s.add(EV.floor);
  EV.grid = new THREE.GridHelper(Math.max(W, H) + 40, 24);
  EV.grid.material.transparent = true; EV.grid.material.opacity = 0.35;
  EV.grid.position.y = 0.1; s.add(EV.grid);
  EV.fog = new THREE.Fog(0x000000, 420, 1300);
  EV.flyG = evFly(); EV.flyG.scale.setScalar(1.3); s.add(EV.flyG);
  [EV.eyeL, EV.eyeR] = EV.flyG.userData.eyes;
  EV.fields = new THREE.Group();
  EV.fields.add(evWedge(EV_COL_L, -EYE_BACK, EYE_FRONT), evWedge(EV_COL_R, -EYE_FRONT, EYE_BACK));
  s.add(EV.fields);
  EV.rays = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true }));
  EV.rays.frustumCulled = false;
  s.add(EV.rays);
  EV.persp = new THREE.PerspectiveCamera(55, 1, 1, 4000);
  EV.eyeCam = new THREE.PerspectiveCamera(90, EYE_COLS / EYE_ROWS, 0.5, 4000);
  EV.top = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  EV.top.position.set(0, 900, 0); EV.top.up.set(0, 0, -1); EV.top.lookAt(0, 0, 0);
  // olho composto: cada olho é desenhado em EYE_COLS × EYE_ROWS pontos e mostrado em facetas
  EV.eyeRT = [0, 1].map(() => new THREE.WebGLRenderTarget(EYE_COLS, EYE_ROWS, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter }));
  EV.hex = evHexMaterial();
  EV.quadScene = new THREE.Scene();
  EV.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), EV.hex));
  EV.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  evTheme();
}

function evTheme() {
  if (!EV.r) return;
  const c = evColors();
  EV.pal = c;
  EV.r.setClearColor(c.surface, 1);
  EV.floor.material.color.copy(c.bg);
  EV.grid.material.color.copy(c.line);
  EV.fog.color.copy(c.surface);
  const dark = c.surface.r + c.surface.g + c.surface.b < 1.2;
  EV.sky = new THREE.Color(dark ? '#23364A' : '#BFD9EE');
  EV.hex.uniforms.bg.value.copy(c.surface);
  EV.sig = '';                       // refaz os rótulos com as cores novas
}

function evLabelTex(text, w, h) {
  const k = 4, cv = document.createElement('canvas');
  cv.width = Math.max(16, Math.round(w * k)); cv.height = Math.max(16, Math.round(h * k));
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#1C2127';
  let fs = Math.min(cv.height * 0.5, 13 * k);
  g.font = `600 ${fs}px system-ui, sans-serif`;
  while (MoscaIdioma.medir(g, text).width > cv.width * 0.9 && fs > 6) { fs -= 2; g.font = `600 ${fs}px system-ui, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  MoscaIdioma.desenhar(g, text, cv.width / 2, cv.height / 2);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4;
  return t;
}

// um bloco por elemento clicável; refeito quando a tela muda de lugar ou de tamanho
function evSyncBoxes() {
  const sig = rects.map(r => `${r.id}:${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0},${r.disabled ? 1 : 0}`).join('|');
  if (sig === EV.sig) return;
  EV.sig = sig;
  for (const b of EV.boxes.values()) {
    EV.scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    for (const m of b.mesh.material) { m.map?.dispose(); m.dispose(); }
  }
  EV.boxes.clear();
  for (const r of rects) {
    if (r.disabled) continue;
    const side = new THREE.MeshLambertMaterial();
    const top = new THREE.MeshLambertMaterial({ map: evLabelTex(label(r.id), r.w, r.h) });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(r.w, EV_BOX_H, r.h), [side, side, top, side, side, side]);
    const [x, z] = evTo3(r.x + r.w / 2, r.y + r.h / 2);
    mesh.position.set(x, EV_BOX_H / 2, z);
    EV.scene.add(mesh);
    EV.boxes.set(r.id, { mesh, side, top, r });
  }
}

const EV_NEW = new THREE.Color('#F4E2A8'), EV_OLD = new THREE.Color('#C3C8CB'), EV_BUG = new THREE.Color('#6B6444');
function evUpdate(dtw) {
  evSyncBoxes();
  const seen = new Map((fly?.seen || []).map(([r, sl, sr]) => [r.id, [sl, sr]]));
  const tmp = new THREE.Color();
  for (const [id, b] of EV.boxes) {
    const st = el(id);
    tmp.copy(st.bug ? EV_BUG : EV_OLD).lerp(st.bug ? EV_BUG : EV_NEW, st.bug ? 0 : st.novelty);
    b.side.color.copy(tmp); b.top.color.copy(tmp);
    const [sl, sr] = seen.get(id) || [0, 0];
    const e = b.side.emissive.setRGB(0, 0, 0);
    e.add(EV_COL_L.clone().multiplyScalar(Math.min(1, sl * 1.2) * 0.45)).add(EV_COL_R.clone().multiplyScalar(Math.min(1, sr * 1.2) * 0.45));
    b.top.emissive.copy(e);
  }
  // a mosca: mesma posição e direção do desenho 2D; sobe quando está em cima de um botão
  const [x, z] = evTo3(disp.x, disp.y);
  const on = elementAt(disp.x, disp.y);
  EV.lift += ((on ? EV_BOX_H : 0) - EV.lift) * (1 - Math.exp(-dtw / 0.08));
  EV.flyG.position.set(x, EV.lift, z);
  EV.flyG.rotation.y = -disp.th;
  EV.fields.position.set(x, EV.lift, z);
  EV.fields.rotation.y = -disp.th;
  const [eL, eR] = fly?.eyes || [0, 0];
  EV.eyeL.material.emissive.setRGB(0.23 + 0.5 * eL, 0.04, 0.03);
  EV.eyeR.material.emissive.setRGB(0.23 + 0.5 * eR, 0.04, 0.03);
  // linhas dos olhos até cada elemento que ela vê, mais fortes quanto mais ele pesa
  const pos = [], col = [];
  const [fx, fz] = evDir(disp.th);
  const hx = x + fx * 6, hz = z + fz * 6, hy = EV.lift + EV_EYE_H;
  for (const [id, [sl, sr]] of seen) {
    const b = EV.boxes.get(id);
    if (!b || sl + sr < 0.06) continue;
    const c = tmp.setRGB(0, 0, 0).add(EV_COL_L.clone().multiplyScalar(sl)).add(EV_COL_R.clone().multiplyScalar(sr)).multiplyScalar(1 / (sl + sr));
    c.multiplyScalar(0.55 + 0.45 * Math.min(1, (sl + sr) * 2));
    pos.push(hx, hy, hz, b.mesh.position.x, EV_BOX_H + 0.2, b.mesh.position.z);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
  }
  EV.rays.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  EV.rays.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
}

function evFitTop(cam, w, h) {
  const a = w / h, sa = (W + 40) / (H + 40);
  const hw = a > sa ? (H + 40) / 2 * a : (W + 40) / 2, hh = a > sa ? (H + 40) / 2 : (W + 40) / 2 / a;
  cam.left = -hw; cam.right = hw; cam.top = hh; cam.bottom = -hh;
  cam.updateProjectionMatrix();
}

function evRenderEye(i, vx, vy, vw, vh) {
  const [x, z] = evTo3(disp.x, disp.y);
  const [fx, fz] = evDir(disp.th);
  const yaw = disp.th + (i ? EV_EYE_YAW : -EV_EYE_YAW);
  const [dx, dz] = evDir(yaw);
  const cam = EV.eyeCam;
  const vf = 2 * Math.atan(Math.tan(EV_EYE_HFOV * Math.PI / 360) / cam.aspect) * 180 / Math.PI;
  cam.fov = vf; cam.updateProjectionMatrix();
  const y = EV.lift + EV_EYE_H;
  cam.position.set(x + fx * 6, y, z + fz * 6);
  cam.lookAt(x + fx * 6 + dx * 100, y - 12, z + fz * 6 + dz * 100);
  EV.flyG.visible = false; EV.fields.visible = false; EV.rays.visible = false; EV.grid.visible = false;
  EV.r.setRenderTarget(EV.eyeRT[i]);
  EV.r.setClearColor(EV.sky, 1);
  EV.r.clear();
  EV.r.render(EV.scene, cam);
  EV.r.setRenderTarget(null);
  EV.flyG.visible = true; EV.fields.visible = true; EV.rays.visible = true; EV.grid.visible = true;
  EV.r.setClearColor(EV.pal.surface, 1);
  EV.hex.uniforms.tex.value = EV.eyeRT[i].texture;
  EV.r.setViewport(vx, vy, vw, vh); EV.r.setScissor(vx, vy, vw, vh);
  EV.r.render(EV.quadScene, EV.quadCam);
}

function evFrame(dtw) {
  if (!EV.r || !fly) return;
  const canvas = EV.r.domElement;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const pr = EV.r.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) EV.r.setSize(w, h, false);
  evUpdate(dtw);
  EV.r.setScissorTest(true);
  EV.r.setViewport(0, 0, w, h); EV.r.setScissor(0, 0, w, h);
  EV.r.setClearColor(EV.pal.surface, 1);
  EV.r.clear();
  const cap = $('#evCap');
  if (EV.mode === 'spec') {
    // espectador: atrás e acima dela, seguindo com atraso, como a câmera de quem assiste
    const [x, z] = evTo3(disp.x, disp.y);
    const [fx, fz] = evDir(disp.th);
    const want = new THREE.Vector3(x - fx * 150, EV.lift + 95, z - fz * 150);
    const k = EV.camReady ? 1 - Math.exp(-dtw / 0.35) : 1;
    EV.persp.position.lerp(want, k);
    EV.camReady = true;
    EV.persp.aspect = w / h; EV.persp.updateProjectionMatrix();
    EV.persp.lookAt(x + fx * 50, EV.lift + 4, z + fz * 50);
    EV.scene.fog = EV.fog;
    EV.r.render(EV.scene, EV.persp);
    EV.scene.fog = null;
    cap.innerHTML = '<span>espectador</span><span><b class="ev-l">azul</b>: olho esquerdo · <b class="ev-r">laranja</b>: direito · cinza: os dois</span>';
  } else if (EV.mode === 'olhos') {
    // os dois olhos em cima, o mapa de cima embaixo
    const eh = Math.round(h * 0.52), ew = Math.floor(w / 2);
    const side = Math.min(ew, eh) - 8;
    evRenderEye(0, Math.round((ew - side) / 2), h - eh + Math.round((eh - side) / 2), side, side);
    evRenderEye(1, ew + Math.round((ew - side) / 2), h - eh + Math.round((eh - side) / 2), side, side);
    EV.r.setViewport(0, 0, w, h - eh); EV.r.setScissor(0, 0, w, h - eh);
    evFitTop(EV.top, w, h - eh);
    EV.r.render(EV.scene, EV.top);
    const [eL, eR] = fly.eyes || [0, 0];
    cap.innerHTML = `<span><b class="ev-l">olho esquerdo</b> · LC10a ${Math.round(eL * 100)}%</span><span><b class="ev-r">olho direito</b> · LC10a ${Math.round(eR * 100)}%</span>`;
  } else {
    evFitTop(EV.top, w, h);
    EV.r.render(EV.scene, EV.top);
    cap.innerHTML = '<span>de cima</span><span>o leque é o campo de cada olho; atrás, o ponto cego</span>';
  }
  EV.r.setScissorTest(false);
}

function evShow(on) {
  if (on && !EV.r) {
    try { evInit(); } catch (e) { console.error(e); return; }
  }
  EV.on = on;
  EV.camReady = false;
  $('#brain').hidden = on;
  $('#eyeview').hidden = !on;
  $('#evUi').hidden = !on;
  document.querySelector('.brain-labels').hidden = on;
  if (typeof FORMAS !== 'undefined' && FORMAS.linhas) $('#formasUi').hidden = on;
  $('#bpTitle').textContent = on ? 'Pelos olhos dela' : 'O cérebro';
  for (const b of document.querySelectorAll('#viewTabs button')) b.classList.toggle('on', (b.dataset.view === 'olhos') === on);
}
for (const b of document.querySelectorAll('#viewTabs button')) b.addEventListener('click', () => evShow(b.dataset.view === 'olhos'));
for (const b of document.querySelectorAll('#evModes button')) b.addEventListener('click', () => {
  EV.mode = b.dataset.mode;
  EV.camReady = false;
  for (const o of document.querySelectorAll('#evModes button')) o.classList.toggle('on', o === b);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', evTheme);
new MutationObserver(evTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
