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
const SB_STEP = 3;
const SB_LATERAL = 8 * 7;   // subir ou descer a lateral de uma plataforma sem a física: ~8 mm/s (px/s, 7 px por mm)          // desnível que ela vence andando
// plataformas: centro (x, y) e altura; cada grupo de elementos da mesma função ocupa uma
const SB_SLOTS = [[330, 330, 50], [720, 250, 95], [1100, 340, 65], [270, 760, 25], [1150, 760, 115],
  [330, 1140, 80], [720, 1190, 40], [1100, 1120, 105], [720, 470, 18], [980, 560, 130]];
const SB_COL = { L: new THREE.Color('#5cc8ff'), R: new THREE.Color('#ffb347'), neon: '#2bff86' };

/* ───────────── o mundo ───────────── */
function sbBuild() {
  SB.app = APP.id;
  if (APP.mundo) {
    // mundo natural: cada coisa é a sua própria plataforma, no tamanho real (mm -> px)
    const S = CORPO.S;
    SB.platforms = []; SB.layout = {}; SB.formas = [];
    for (const [id, o] of Object.entries(APP.objetos)) {
      const p = { x: (o.x - o.w / 2) * S, y: (o.y - o.d / 2) * S, w: o.w * S, h: o.d * S, z: ((o.base || 0) + o.h) * S, id };
      SB.platforms.push(p);
      SB.layout[id] = { x: p.x, y: p.y, w: p.w, h: p.h, z: p.z };
      for (const f of sbFormas(o)) SB.formas.push({ id, tipo: f.tipo, x: (o.x + f.dx) * S, y: (o.y + f.dy) * S, z: f.z * S, a: f.a * S, b: f.b * S, c: f.c * S });
    }
    SBR.built = '';
    return;
  }
  const groups = {};
  for (const [id, e] of Object.entries(APP.elementos)) (groups[e.notas[0]] ||= []).push(id);
  const chunks = [];
  SB.formas = null;
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
    const o = APP.objetos?.[node.dataset.el];
    if (L) out.push({ id: node.dataset.el, ...L, disabled: node.disabled, node, sigma: o ? o.alcance * CORPO.S : 0 });
  }
  return out;
}
// Formas do mundo natural (mm, a partir do centro de cada coisa; y cresce para longe da janela, como na página).
// As frutas são meias-cúpulas apoiadas no balcão (metade de um elipsoide), as uvas, três meias-esferas, e a tampa, um
// cilindro. O desenho 3D, a física e a altura usada pela página saem daqui, então as bordas batem. Nada tem "barriga"
// embaixo: numa fruta inteira deitada, a mosca física teria de andar de cabeça para baixo, e as passadas gravadas no
// chão não fazem isso. O que tem menos de 1 mm (açúcar, água, folhas) é um retângulo plano, fora da física
function sbFormas(o) {
  const { w, d, h } = o;
  if (h < 1) return [{ tipo: 'plano', dx: 0, dy: 0, z: o.base || 0, a: w / 2, b: d / 2, c: h }];
  if (o.forma === 'uvas') {
    const r = h;
    return [[-w / 2 + r, d / 2 - r], [0, -d / 2 + r], [w / 2 - r, d / 2 - r]].map(([dx, dy]) => ({ tipo: 'esfera', dx, dy, z: 0, a: r, b: r, c: r }));
  }
  if (o.forma === 'vinagre' || /^plat-/.test(o.forma)) return [{ tipo: 'cilindro', dx: 0, dy: 0, z: (o.base || 0) + h / 2, a: w / 2, b: h / 2, c: 0 }];
  return [{ tipo: 'elipsoide', dx: 0, dy: 0, z: 0, a: w / 2, b: d / 2, c: h }];
}
// altura do topo de uma forma (px) no ponto (x, y) da página, ou -Infinity fora dela
function sbAlturaForma(f, x, y) {
  const dx = x - f.x, dy = y - f.y;
  if (f.tipo === 'plano') return Math.abs(dx) <= f.a && Math.abs(dy) <= f.b ? f.z + f.c : -Infinity;
  if (f.tipo === 'cilindro') return dx * dx + dy * dy <= f.a * f.a ? f.z + f.b : -Infinity;
  const u = (dx / f.a) ** 2 + (dy / f.b) ** 2;   // esfera e elipsoide (na esfera, b = c = a)
  return u <= 1 ? f.z + f.c * Math.sqrt(1 - u) : -Infinity;
}
// quanto a superfície inclina ali (altura por distância): 0 no plano, ~0,58 a 30°, 1 a 45°
function sbInclinacao(x, y, h = 3) {
  return Math.hypot(sbSurface(x + h, y) - sbSurface(x - h, y), sbSurface(x, y + h) - sbSurface(x, y - h)) / (2 * h);
}
function sbAlturaObjeto(id, x, y) {
  let z = -Infinity;
  for (const f of SB.formas || []) if (f.id === id) z = Math.max(z, sbAlturaForma(f, x, y));
  return z;
}
function sbSurface(x, y) {
  let z = 0;
  if (SB.formas) { for (const f of SB.formas) z = Math.max(z, sbAlturaForma(f, x, y)); return z; }
  for (const p of SB.platforms || []) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) z = Math.max(z, p.z);
  return z;
}

/* ───────────── sentidos e contato na escala do corpo ───────────── */
// no mundo natural, o contato é com a superfície da forma (redonda); nas plataformas, com o topo plano
const sbAlturaDe = (r, x, y) => (SB.formas ? sbAlturaObjeto(r.id, x, y) : (r.z || 0));
function sbPoseNatural(f) { return SB.fisico && !f.flying && !f.presa ? CORPO.pose : null; }
function sbAntenas(f) {
  const pose = sbPoseNatural(f);
  return CorpoNatural.antenas.map((p, lado) => {
    const i = ANIM.antenas?.[lado];
    if (pose && i >= 0) {
      const k = i * 12, g = pose.geoms;
      return { x:g[k]*CORPO.S, y:-g[k+1]*CORPO.S, z:g[k+2]*CORPO.S };
    }
    return CorpoNatural.ponto(f, p, pose);
  });
}
function sbContatoNatural(f, dt) {
  const pose = sbPoseNatural(f), antes = f.bocaEl?.id;
  f.patasEl = null; f.bocaEl = null;
  if (!CorpoNatural.impedida(f) && (!SB.fisico || pose) && !CORPO.teleportando) {
    const tarsos = ANIM.tarsos || ['lf','lm','lh','rf','rm','rh'].map(p => ({perna:p,
      ponto:[p[1] === 'f' ? 0.84 : p[1] === 'm' ? 0 : -0.8, p[0] === 'l' ? 1 : -1, -CorpoNatural.altura]}));
    for (const t of tarsos) {
      let pt;
      if (pose && t.i !== undefined) {
        if (!(pose.toque?.[t.perna] > 0.05)) continue;
        const k=t.i*12, g=pose.geoms, v=t.local;
        pt={x:(g[k]+g[k+3]*v[0]+g[k+4]*v[1]+g[k+5]*v[2])*CORPO.S,
            y:-(g[k+1]+g[k+6]*v[0]+g[k+7]*v[1]+g[k+8]*v[2])*CORPO.S,
            z:(g[k+2]+g[k+9]*v[0]+g[k+10]*v[1]+g[k+11]*v[2])*CORPO.S};
      } else pt=CorpoNatural.ponto(f,t.ponto);
      // A física usa margem de adesão de 0,3 mm; a malha visível não coincide exatamente com o contato.
      const r=CorpoNatural.contato(pt,rects,pose ? 0.5 : 0.25,sbAlturaDe);
      if (r) { f.patasEl=r; break; }
    }
  }
  CorpoNatural.boca(f,dt,!!f.patasEl);
  const alvo=CorpoNatural.ponto(f,[0.75,0,-CorpoNatural.altura],pose);
  f.pisoBoca=sbSurface(alvo.x,alvo.y);
  const b=CorpoNatural.bocaPontos(f,pose);
  if (f.patasEl && f.boca > 0.9 && b.alcanca && !CorpoNatural.impedida(f)) f.bocaEl=CorpoNatural.contato(b.ponta,rects,0.08,sbAlturaDe);
  f.contatoBocaT=f.bocaEl ? (antes === f.bocaEl.id ? (f.contatoBocaT || 0)+dt : dt) : 0;
}

/* ───────────── o corpo real animado (sem o servidor de física) ───────────── */
// A malha da NeuroMechFly posta pela própria página, com as poses de corpo/poses.py (de pé e com as patas recolhidas
// para o voo). Em voo, cada asa bate com a amplitude que os motores daquele lado mandam (um leque translúcido mostra o
// envelope da batida; a batida real é de ~200 Hz, aqui desenhada a 16 Hz), os halteres oscilam em contrafase, o corpo
// empina e inclina nas curvas, e a cabeça gira pelo DNp15. No chão, as patas andam em trípode
let ANIM = { poses: null, recolhe: 0, fase: 0, faseAsa: 0, leques: [], cabeca: 0, pecas: null };
async function animCarregar() {
  if (ANIM.poses) return;
  if (ANIM.carregando) return ANIM.carregando;
  ANIM.carregando = animMontar();
  try { await ANIM.carregando; } finally { ANIM.carregando = null; }
}
async function animMontar() {
  try {
    await corpoCarregarMalha();
    const P = await buscar('data/corpo_poses.json');
    const q = arr => arr.map(v => { const m = new THREE.Matrix4().set(v[3], v[4], v[5], 0, v[6], v[7], v[8], 0, v[9], v[10], v[11], 0, 0, 0, 0, 1); return new THREE.Quaternion().setFromRotationMatrix(m); });
    const p = arr => arr.map(v => new THREE.Vector3(v[0], v[1], v[2]));
    ANIM.qPe = q(P.pe); ANIM.qVoo = q(P.voo); ANIM.pPe = p(P.pe); ANIM.pVoo = p(P.voo);
    const nomes = CORPO.malha.meshes.map((_, i) => i);
    ANIM.perna = {}; for (const [perna, info] of Object.entries(P.pernas)) for (const i of info.pecas) ANIM.perna[i] = perna;
    ANIM.cabecaPecas = new Set();
    // cabeça: tudo que não é tórax, abdômen, asa, haltere ou pata
    const info = await buscar('data/corpo_malha.json');
    info.pecas.forEach((pc, i) => { if (/c_head|_eye|pedicel|funiculus|arista|rostrum|haustellum/.test(pc.nome)) ANIM.cabecaPecas.add(i); });
    ANIM.antenas = ['l','r'].map(l => info.pecas.findIndex(pc => pc.nome === 'nmf/'+l+'_funiculus'));
    ANIM.bocaPecas = ['rostrum','haustellum'].map(n => info.pecas.findIndex(pc => pc.nome === 'nmf/c_'+n));
    // Poses de limpeza geradas com as juntas da NeuroMechFly; erro/falta do arquivo não impede o corpo normal.
    try {
      const L = await buscar('data/limpeza_poses.json');
      ANIM.limpeza = {indices: L.pecas.map(n => info.pecas.findIndex(pc => pc.nome === n)),
        poses: Object.fromEntries(Object.entries(L.poses).map(([n, v]) => [n, {p: p(v), q: q(v)}]))};
      if (ANIM.limpeza.indices.some(i => i < 0)) throw new Error('peças de limpeza incompatíveis com a malha');
    } catch (e) { ANIM.limpeza = null; ANIM.erroLimpeza = e.message; }
    ANIM.tarsos = [];
    info.pecas.forEach((pc,i) => {
      const m=pc.nome.match(/nmf\/([lr][fmh])_tarsus5$/);
      if (!m) return;
      const vs=CORPO.malha.meshes[i].geometry.attributes.position, pose=P.pe[i];
      let baixo=Infinity, local, ponto;
      for (let j=0;j<vs.count;j++) {
        const v=[vs.getX(j),vs.getY(j),vs.getZ(j)];
        const q=[0,1,2].map(k => pose[k]+pose[3+k*3]*v[0]+pose[4+k*3]*v[1]+pose[5+k*3]*v[2]);
        if (q[2]<baixo) { baixo=q[2]; local=v; ponto=q; }
      }
      ANIM.tarsos.push({i,perna:m[1],local,ponto});
    });
    ANIM.pescoco = new THREE.Vector3(0.55, 0, 0.25);   // mm à frente e acima do centro do tórax
    for (const lado of ['l', 'r']) {
      const a = P.asas[lado];
      a.base = new THREE.Vector3(...a.base); a.env = new THREE.Vector3(...a.envergadura);
      a.comp = a.env.length() * 2;
      a.ang0 = Math.atan2(a.env.y, a.env.x);
      const h = P.halteres[lado]; h.base = new THREE.Vector3(...h.base);
      const leque = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      leque.matrixAutoUpdate = false; leque.visible = false; SBR.scene.add(leque); ANIM.leques.push(leque);
    }
    ANIM.poses = P; ANIM.erro = null;
  } catch (e) { ANIM.poses = null; ANIM.erro = e.message; }
}
// matriz de cena a partir de uma matriz na física (mm; x frente, y esquerda, z cima), como em corpoPose
const _cena = new THREE.Matrix4();
function animParaCena(M, mesh) {
  const e = M.elements, S = CORPO.S, ox = -SB.W / 2, oz = -SB.H / 2;
  // e é coluna-major: linha r, coluna c = e[c * 4 + r]
  mesh.matrix.set(S * e[0], S * e[4], S * e[8], ox + S * e[12],
    S * e[2], S * e[6], S * e[10], S * e[14],
    -S * e[1], -S * e[5], -S * e[9], oz - S * e[13],
    0, 0, 0, 1);
  mesh.matrixWorldNeedsUpdate = true;
}
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _M = new THREE.Matrix4(), _R = new THREE.Matrix4(), _T = new THREE.Matrix4(), _Ti = new THREE.Matrix4(), _um = new THREE.Vector3(1, 1, 1);
const _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(1, 0, 0);
// gira em torno de um ponto (na física): T(p) · R · T(-p) · M
function emTorno(M, ponto, R) { _T.makeTranslation(ponto.x, ponto.y, ponto.z); _Ti.makeTranslation(-ponto.x, -ponto.y, -ponto.z); return M.premultiply(_Ti).premultiply(R).premultiply(_T); }
function animPose(f, dtw) {
  const P = ANIM.poses, S = CORPO.S, voando = f.flying || f.jumping;
  ANIM.recolhe += ((voando ? 1 : 0) - ANIM.recolhe) * Math.min(1, dtw / 0.12);
  const rc = ANIM.recolhe;
  const andando = !voando && !f.presa && ((f.speed || 0) > 5 || Math.abs(f.giroCorpo || 0) > 0.1);
  if (APP.mundo) ANIM.fase = f.fasePatas || 0;
  else ANIM.fase += dtw * 2 * Math.PI * 9 * (andando ? Math.min(1.5, (f.speed || 0) / WALK) : 0);
  ANIM.faseAsa += dtw * 2 * Math.PI * 16 * rc;
  ANIM.cabeca += (clamp((f.cabeca || 0) * 0.004, -0.35, 0.35) * rc - ANIM.cabeca) * Math.min(1, dtw / 0.15);
  // o corpo: posição, rumo, empinar em voo (~20°) e inclinar nas curvas
  const giro = f.flying ? (f.omega || 0) : 0;
  const Mc = new THREE.Matrix4().makeTranslation(f.x / S, -f.y / S, (f.z || 0) / S + P.altura)
    .multiply(_R.makeRotationAxis(_z, Math.PI / 2 - f.th))
    .multiply(new THREE.Matrix4().makeRotationAxis(_y, -0.35 * rc))
    .multiply(new THREE.Matrix4().makeRotationAxis(_x, clamp(0.12 * giro, -0.7, 0.7)));
  const amp = f.flying ? clamp(0.008 * ((f.ampL || 0) - (f.ampR || 0) - (f.ampBase || 0)), -0.6, 0.6) : 0;
  const forca = 0.85 + 0.15 * clamp((f.forca || 0) / 8, 0, 2);
  const A = { l: (2.44 + amp / 2) * forca, r: (2.44 - amp / 2) * forca };
  const cosF = Math.cos(ANIM.faseAsa), flip = 0.6 * Math.tanh(3 * Math.sin(ANIM.faseAsa));
  CORPO.malha.meshes.forEach((mesh, i) => {
    _q.copy(ANIM.qPe[i]).slerp(ANIM.qVoo[i], rc);
    _p.copy(ANIM.pPe[i]).lerp(ANIM.pVoo[i], rc);
    _M.compose(_p, _q, _um);
    const perna = ANIM.perna[i];
    if (perna && andando && rc < 0.5) {
      // trípode: esquerda-frente, direita-meio, esquerda-trás juntas; as outras três em contrafase
      const grupo = (perna === 'lf' || perna === 'rm' || perna === 'lh') ? 0 : Math.PI, th = ANIM.fase + grupo;
      const base = new THREE.Vector3(...P.pernas[perna].base);
      emTorno(_M, base, _R.makeRotationAxis(_z, 0.3 * Math.sin(th)));
      emTorno(_M, base, _R.makeRotationAxis(_x, (perna[0] === 'l' ? -1 : 1) * 0.25 * Math.max(0, Math.cos(th))));
    }
    if (perna && perna[1] === 'f' && !voando && !f.presa && f.patasEl && (f.boca || 0) < 0.9) {
      // Tateamento apenas visual, no relógio cerebral; não inventa disparos de tato.
      const base = new THREE.Vector3(...P.pernas[perna].base);
      const fase = brainT / 1000 * 16 + (perna[0] === 'l' ? 0 : Math.PI);
      emTorno(_M, base, _R.makeRotationAxis(_z, 0.1 * Math.sin(fase)));
    }
    for (const lado of ['l', 'r']) {
      const a = P.asas[lado], h = P.halteres[lado], sg = lado === 'l' ? 1 : -1;
      if (i === a.peca && rc > 0.01) {
        // abre (de dobrada para trás até a lateral) e bate para frente e para trás; a asa vira na troca de sentido
        const psi = rc * (-sg * 1.85 + sg * (A[lado] / 2) * cosF);
        emTorno(_M, a.base, _R.makeRotationAxis(a.env.clone().normalize(), rc * sg * flip));
        emTorno(_M, a.base, _R.makeRotationAxis(_z, psi));
      }
      if (i === h.peca && rc > 0.01) emTorno(_M, h.base, _R.makeRotationAxis(_y, rc * 1.1 * -cosF));
    }
    if (ANIM.cabecaPecas.has(i) && ANIM.cabeca) emTorno(_M, ANIM.pescoco, _R.makeRotationAxis(_z, ANIM.cabeca));
    animParaCena(_M.premultiply(Mc), mesh);
  });
  // leques: o envelope da batida de cada asa, no plano do tórax
  ['l', 'r'].forEach((lado, k) => {
    const a = P.asas[lado], sg = lado === 'l' ? 1 : -1, leque = ANIM.leques[k];
    leque.visible = rc > 0.6 && f.flying;
    if (!leque.visible) return;
    const meio = a.ang0 - sg * 1.85;
    leque.geometry.dispose();
    leque.geometry = new THREE.CircleGeometry(a.comp * 1.05, 20, meio - A[lado] / 2, A[lado]);
    animParaCena(new THREE.Matrix4().makeTranslation(a.base.x, a.base.y, a.base.z).premultiply(Mc), leque);
  });
}

// Extensão geométrica: orienta e alonga as duas peças entre raiz, dobra e ponta.
// O comprimento variável é uma aproximação visual; não representa músculos/juntas da probóscide.
function animBoca(f) {
  if (!ANIM.bocaPecas || !(f.boca > 0.001) || CorpoNatural.impedida(f)) return;
  const pose=sbPoseNatural(f), b=CorpoNatural.bocaPontos(f,pose);
  const cena=p => new THREE.Vector3(p.x-SB.W/2,p.z,p.y-SB.H/2);
  const antigos=[CorpoNatural.raizBoca,CorpoNatural.dobraBoca,CorpoNatural.pontaBoca].map(p => cena(CorpoNatural.ponto(f,p,pose)));
  const novos=[b.raiz,b.meio,b.ponta].map(cena);
  ANIM.bocaPecas.forEach((id,i) => {
    if (id < 0) return;
    const u=antigos[i+1].clone().sub(antigos[i]), v=novos[i+1].clone().sub(novos[i]);
    const razao=v.length()/u.length(); u.normalize(); v.normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(u,v), k=razao-1;
    const esc=new THREE.Matrix4().set(1+k*u.x*u.x,k*u.x*u.y,k*u.x*u.z,0,
      k*u.y*u.x,1+k*u.y*u.y,k*u.y*u.z,0,k*u.z*u.x,k*u.z*u.y,1+k*u.z*u.z,0,0,0,0,1);
    const tr=new THREE.Matrix4().makeTranslation(novos[i].x,novos[i].y,novos[i].z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q)).multiply(esc)
      .multiply(new THREE.Matrix4().makeTranslation(-antigos[i].x,-antigos[i].y,-antigos[i].z));
    const mesh=CORPO.malha.meshes[id]; mesh.matrix.premultiply(tr); mesh.matrixWorldNeedsUpdate=true;
  });
}

// Sobreposição cinemática: no corpo físico a postura de apoio continua vindo do MuJoCo.
// As duas patas anteriores são desenhadas limpando; não aplicam forças nem novos estímulos táteis.
function animLimpeza(f) {
  const e = f.limpeza;
  if (!e?.ativa || !(e.peso > 0) || CorpoNatural.impedida(f)) return;
  if (!ANIM.poses || !CORPO.malha || !ANIM.limpeza) return;
  const L = ANIM.limpeza, pose = sbPoseNatural(f);
  const frente = pose?.frente || [Math.sin(f.th), Math.cos(f.th), 0], costas = pose?.costas || [0, 0, 1];
  const F = new THREE.Vector3(...frente), B = new THREE.Vector3(...costas), E = new THREE.Vector3().crossVectors(B, F).normalize();
  const Mc = new THREE.Matrix4().makeBasis(F, E, B);
  Mc.setPosition(...(pose?.torax || [f.x / CORPO.S, -f.y / CORPO.S, f.z / CORPO.S + ANIM.poses.altura]));
  const inv = Mc.clone().invert(), q = new THREE.Quaternion(), p = new THREE.Vector3(), escala = new THREE.Vector3();
  for (let j = 0; j < L.indices.length; j++) {
    const i = L.indices[j], mesh = CORPO.malha.meshes[i];
    // Esfregar alterna as patas; varrer cabeça/antenas é bilateral. Frequência escolhida para animação.
    const lado = ANIM.perna[i][0] === 'l' ? 0 : Math.PI;
    const pega = etapa => {
      const u = (1 - Math.cos(e.t * 2 * Math.PI * 3.5 + (etapa === 'patas' ? lado : 0))) / 2;
      const a = L.poses[etapa + '_a'], b = L.poses[etapa + '_b'];
      return {p: a.p[j].clone().lerp(b.p[j], u), q: a.q[j].clone().slerp(b.q[j], u)};
    };
    const atual = pega(e.etapa), anterior = pega(e.anterior);
    anterior.p.lerp(atual.p, e.mistura); anterior.q.slerp(atual.q, e.mistura);
    if (pose) {
      const v = pose.geoms.slice(i * 12, i * 12 + 12);
      _M.set(v[3],v[4],v[5],v[0], v[6],v[7],v[8],v[1], v[9],v[10],v[11],v[2], 0,0,0,1).premultiply(inv);
      _M.decompose(p, q, escala);
    } else {p.copy(ANIM.pPe[i]); q.copy(ANIM.qPe[i]);}
    p.lerp(anterior.p, e.peso); q.slerp(anterior.q, e.peso);
    _M.compose(p, q, _um).premultiply(Mc);
    animParaCena(_M, mesh);
  }
}

// Sem a malha real, a mosca simplificada também mostra a limpeza com duas patas articuladas em linhas.
function animLimpezaSimples(f, visivel) {
  const U = SBR.fly.userData;
  if (!U.limpeza) {
    const originais = SBR.fly.children.find(m => m.isLineSegments);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3));
    const linhas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color: '#3A2A18'}));
    linhas.frustumCulled = false; SBR.fly.add(linhas);
    U.limpeza = {originais, linhas, pontos: originais.geometry.attributes.position.array.slice()};
  }
  const e = f.limpeza, L = U.limpeza, ativo = visivel && e?.ativa && e.peso > 0 && !CorpoNatural.impedida(f);
  L.linhas.visible = !!ativo;
  const base = L.originais.geometry.attributes.position;
  base.array.set(L.pontos);
  if (ativo) {
    const a = L.linhas.geometry.attributes.position;
    [-1, 1].forEach((s, j) => {
      const u = Math.sin(e.t * Math.PI * 7 + (e.etapa === 'patas' ? j * Math.PI : 0));
      const alvo = e.etapa === 'patas' ? [s * .35, 2.5 + .5*u, -7] : e.etapa === 'antenas' ? [s, 4 + .5*u, -7.5] : [s * 2, 5 + .8*u, -5.8];
      const raiz = [s*2.5, 2.2, -3], joelho = [s*4, 3, -5.5];
      const repouso = [s*7, 0, -5];
      const fim = repouso.map((v,k) => v + (alvo[k]-v) * e.peso);
      // Esconde apenas a linha antiga da pata anterior desse lado.
      base.setXYZ(j * 6 + 1, ...raiz);
      a.setXYZ(j*4, ...raiz); a.setXYZ(j*4+1, ...joelho); a.setXYZ(j*4+2, ...joelho); a.setXYZ(j*4+3, ...fim);
    });
    a.needsUpdate = true;
  }
  base.needsUpdate = true;
}

// Sem os arquivos locais da malha, o modelo simples também mostra a extensão.
function animBocaSimples(f, mostrar) {
  if (!ANIM.bocaSimples && mostrar) {
    ANIM.bocaSimples=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,1,8),new THREE.MeshStandardMaterial({color:'#6a4030'}));
    SBR.scene.add(ANIM.bocaSimples);
  }
  const mesh=ANIM.bocaSimples;
  if (!mesh) return;
  mesh.visible=!!(mostrar && f.boca > 0.01 && !CorpoNatural.impedida(f));
  if (!mesh.visible) return;
  const b=CorpoNatural.bocaPontos(f), a=new THREE.Vector3(b.raiz.x-SB.W/2,b.raiz.z,b.raiz.y-SB.H/2);
  const c=new THREE.Vector3(b.ponta.x-SB.W/2,b.ponta.z,b.ponta.y-SB.H/2), dir=c.clone().sub(a);
  mesh.position.copy(a).add(c).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(_y,dir.clone().normalize()); mesh.scale.y=dir.length();
}

/* ───────────── andar e voar ───────────── */
// limites de onde ela anda e voa (px: x0, y0, x1, y1): a bancada toda, ou, no mundo da caça a bugs, a bandeja
// (APP.bandeja, mm; caca-mundo.js), cuja borda aparece no 3D
function sbLim() {
  const B = APP.bandeja, S = CORPO.S;
  return B ? [B[0] * S, B[1] * S, B[2] * S, B[3] * S] : [0, 0, SB.W, SB.H];
}
function sbMove(f, dt, v) {
  predStep(f, dt);
  f.voarCd = (f.voarCd || 0) - dt;
  if (f.presa) return;   // presa nas patas do louva-a-deus
  if (SB.fisico && !f.flying) { f.startle = (f.startle || 0) - dt; return; }
  if (f.flying) return sbFly(f, dt);
  // subindo ou descendo pela lateral de uma plataforma (sem a física; regra abaixo): a altura muda no ritmo da subida
  if (f.lateral) {
    const L = f.lateral; L.t += dt;
    f.z = L.z0 + Math.sign(L.z1 - L.z0) * Math.min(Math.abs(L.z1 - L.z0), SB_LATERAL * L.t);
    if (f.z === L.z1) { f.x = L.x; f.y = L.y; f.z = sbSurface(L.x, L.y); f.lateral = null; }
    return;
  }
  const [x0, y0, x1, y1] = sbLim();
  const nx = Math.min(x1 - 10, Math.max(x0 + 10, f.x + Math.sin(f.th) * v * dt));
  const ny = Math.min(y1 - 10, Math.max(y0 + 10, f.y - Math.cos(f.th) * v * dt));
  // a borda da bancada é uma beira como a de uma plataforma (03/10): decola ou vira. Antes a posição só era presa no
  // limite e ela deslizava rente à borda por minutos (no mundo da caça a bugs, sem nunca chegar às plataformas)
  const naBorda = (nx <= x0 + 10 || nx >= x1 - 10) && Math.abs(Math.sin(f.th)) > 0.05 || (ny <= y0 + 10 || ny >= y1 - 10) && Math.abs(Math.cos(f.th)) > 0.05;
  if (naBorda && (f.z || 0) <= SB_STEP) {
    if ((f.voarCd || 0) <= 0 && sbWantsFly(f)) sbTakeoff(f, 'beira');
    else { const c = Math.atan2((x0 + x1) / 2 - f.x, -((y0 + y1) / 2 - f.y)); f.th = c + (Math.random() - 0.5) * 1.6; }
    return;
  }
  const s = sbSurface(nx, ny);
  if(window.Colonia && !Colonia.permitePasso(f,nx,ny,s))return;
  // vence um degrau de SB_STEP e rampas de até ~55° (o topo redondo das frutas); paredes, não
  if (Math.abs(s - f.z) <= SB_STEP + 1.5 * Math.hypot(nx - f.x, ny - f.y)) { f.x = nx; f.y = ny; f.z = s; return; }
  // beira de uma plataforma, ou parede de outra mais alta (logo depois de pousar, ela anda antes de voar de novo)
  if ((f.voarCd || 0) <= 0 && sbWantsFly(f)) { sbTakeoff(f, s > f.z ? 'subir' : 'beira'); return; }
  // no mundo da caça a bugs, sem a física (03/10, regra do corpo, declarada): a lateral de uma plataforma baixa (até
  // 15 mm) é uma parede que ela sobe ou desce andando, como moscas andam em superfícies verticais; aqui feita de forma
  // cinemática, no ritmo de ~8 mm/s. Sem isso ela só subia voando e quase nunca chegava às plaquinhas no treino. Com a
  // física ligada, quem sobe é a escalada do corpo físico (corpoParede)
  if (APP.id === 'caca' && !SB.fisico && Math.random() < 0.6) {
    const ix = nx + Math.sin(f.th) * 2.5 * CORPO.S, iy = ny - Math.cos(f.th) * 2.5 * CORPO.S, z1 = Math.max(0, sbSurface(ix, iy));
    if (Math.abs(z1 - f.z) <= 15 * CORPO.S && Math.abs(z1 - s) <= SB_STEP + 1) {
      f.lateral = { z0: f.z, z1, t: 0, x: ix, y: iy };
      labEvent('parede', { como: z1 > f.z ? 'subida' : 'descida' });
      if (z1 > f.z) logEvent('Subiu pela lateral de uma plataforma.', 's');
      return;
    }
  }
  f.th += Math.PI * (0.55 + 0.4 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
}
// regra do corpo: decola quando há coisa nova em outro nível, mais ainda com fome de bug
function sbWantsFly(f) {
  if (soSentidos()) {
    // só sentidos (regra nossa): decola mais quando vê uma coisa grande acima do piso dela, com fome, ou quando sente
    // um cheiro bom que não fica mais forte enquanto anda (não está chegando à fonte)
    let alto = 0;
    for (const [r, sl, sr] of f.seen || []) if ((r.z || 0) > (f.z || 0) + SB_STEP) alto = Math.max(alto, sl + sr);
    const cheiroParado = (f.atrInata || 0) > 0.2 && (f.dCheiro || 0) <= 0;
    return Math.random() < 0.05 + 0.3 * Math.min(1, 3 * alto) * f.hunger + (cheiroParado ? 0.1 * f.hunger : 0);
  }
  const novel = rects.some(r => !r.disabled && Math.abs(r.z - f.z) > SB_STEP && el(r.id).novelty > 0.5);
  // (moscas perto de comida andam muito e voam pouco)
  return Math.random() < (novel ? 0.15 + 0.35 * f.hunger : 0.05);
}
function sbTakeoff(f, why) {
  if(APP.id==='treino')return; // arena de escolha no chão, condição experimental declarada
  if (f.presa) { if (why === 'fuga') predTranco(f); return; }
  const noAr = f.flying;
  if (noAr && why !== 'fuga') return;
  // no ar, a fibra gigante vira uma guinada de fuga; no chão, decolagem
  if (!noAr) { f.flying = true; f.flyT = 0; f.naParede = null; f.lateral = null; f.pouso = null; f.alvoT = 0; }
  f.vz = why === 'fuga' ? (noAr ? 120 : 150) : 70;
  // a direção da fuga vem do cérebro (fugaRumo, na página); sem sinal claro, sorteada. No ar, vira uma sacada:
  // uma curva rápida até esse rumo (~0,1 s), feita pelo voo; no chão, é a direção do pulo
  if (why === 'fuga') {
    const r = fugaRumo(f) ?? f.th + Math.PI * (0.6 + 0.8 * Math.random()) * (Math.random() < 0.5 ? -1 : 1);
    if (noAr && HAS_VOO) { f.sacadaAlvo = r; f.sacadaT = 0.1; labEvent('sacada', {}); }
    else f.th = r;
  }
  // fuga que conta: o louva-a-deus por perto, e não é o voo de quando ela acabou de escapar das patas
  if (why === 'fuga' && PRED.on && PRED.cd <= 0 && Math.hypot(PRED.x - f.x, PRED.y - f.y, PRED.z - f.z) < 180) {
    PRED.escapes++;
    labEvent('fugaSentinela', {});
    logEvent(PRED.bote ? 'Viu as patas do louva-a-deus vindo: os detectores de ameaça (LPLC2, LC4) dispararam a fibra gigante e ela escapou do bote.'
      : 'Viu o louva-a-deus crescer na frente dela: os detectores de ameaça (LPLC2, LC4) dispararam a fibra gigante e ela fugiu.', 'a');
  }
  if (noAr) return;
  // o que entrava no cérebro na hora (para entender decolagens de susto)
  const tatoAgora = Object.keys(rates).filter(k => k.startsWith('tato_')).reduce((sm, k) => sm + rates[k], 0);
  const lc = f.olhoReal && f.olhoReal.celulas ? Array.from(f.olhoReal.celulas) : [];
  const tops = Object.entries(rates).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + ' ' + Math.round(v)).join(', ');
  labEvent('voo', { why, ameaca: Math.round(rates.ameaca || 0), tato: Math.round(tatoAgora), olhos: (f.eyes || []).map(v => +v.toFixed(2)), doce: Math.round(rates.doce || 0),
    lc: lc.length ? [Math.round(lc.reduce((a, b) => a + b, 0)), Math.round(Math.max(...lc))] : null, tops });
  logEvent(why === 'fuga' ? 'A fibra gigante (DNp01) disparou: decolou de susto.'
    : why === 'tarsal' ? 'As seis patas perderam o apoio (passou da beira): pelo reflexo tarsal, começou a bater as asas.'
    : why === 'subir' ? 'Deu de cara com uma plataforma mais alta e decolou para ver o que tem lá.'
      : 'Chegou na beira da plataforma e decolou.', why === 'fuga' ? '' : 's');
}
// Voos curtos, como os de uma mosca numa cozinha: decola, sobe o gradiente de cheiro (na página), mira uma coisa
// atraente à frente e pousa nela quando chega perto; sem nada que atraia, pousa em ~3 s onde estiver.
// Do cérebro: o bater das asas, a estabilização pelos halteres e as sacadas de desvio. Regras nossas: a escolha do
// alvo, a aproximação e o pouso (os neurônios de pouso do mapa, DNp07 e DNp10, não responderam no modelo)
const VOO_MAX_SENTIDOS = 3;   // só sentidos: sem alvo da lista, procura por mais tempo antes de pousar onde estiver
const VOO_MAX = 1.5; // s de tempo cerebral sem alvo antes de pousar onde estiver (moscas em lugar fechado: voos de 1-2 s)
// o quanto uma coisa atrai em voo: o cheiro (valência inata, com fome), o que ela aprendeu e o que ainda não provou
function sbAtrativo(f, r) {
  const st = el(r.id);
  if (!APP.mundo) return st.novelty;
  let val = 0;
  const o = APP.objetos[r.id];
  for (const [g, w] of Object.entries(o.cheiro)) { const iv = INATA['ORN_' + g] || 0; val += iv > 0 ? iv * w * f.hunger : iv * w; }
  const m = memo[r.id];
  if (m) val += 1.5 * (m.keep - (m.keepR ?? 1));
  return val + 0.25 * st.novelty;
}
function sbEscolheAlvo(f) {
  let melhor = null, mv = 0.2;
  for (const r of rects) {
    if (r.disabled) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, d = Math.hypot(cx - f.x, cy - f.y);
    if (d < 50 || d > 650) continue;
    let a = Math.atan2(cx - f.x, -(cy - f.y)) - f.th;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 1.3) continue;   // só o que está à frente
    const v = sbAtrativo(f, r) / (1 + d / 400);
    if (v > mv) { mv = v; melhor = r; }
  }
  return melhor;
}
// A coisa que mais aparece à frente. Com os olhos reais (sandbox desenhado): a maior mancha de "objeto" (omatídeos mais
// claros que o resto do olho, OLHO.obj) entre 60° abaixo e 15° acima do horizonte, até 80° para cada lado; sem esse
// limite, a janela clara ganha sempre. Sem os olhos reais: a aproximação da página (f.seen, de see()).
// Devolve a direção relativa ao rumo (rad, negativo = esquerda) e um tamanho
function sbAlvoVisual(f) {
  if (OLHO.mapa && OLHO.obj && f.olhoReal && performance.now() - f.olhoReal.t < 600) {
    const D = OLHO.mapa.direcao, dentro = (az, el) => Math.abs(az) < 80 && el < 15 && el > -60;
    let pico = null;
    for (let i = 0; i < 2; i++) for (let o = 0; o < OLHO.obj[i].length; o++) {
      const v = OLHO.obj[i][o], [az, el] = D[i][o];
      if (v > 0 && dentro(az, el) && (!pico || v > pico.v)) pico = { v, az, el };
    }
    if (!pico) return null;
    let sa = 0, sw = 0;   // média das direções em volta do pico (~20°), pesada pelo quanto cada omatídeo destoa
    for (let i = 0; i < 2; i++) for (let o = 0; o < OLHO.obj[i].length; o++) {
      const v = OLHO.obj[i][o], [az, el] = D[i][o];
      // (os mesmos limites do pico: sem isso, a janela clara logo acima de 15° ou algo além de 80° puxava a média)
      if (v > 0.3 * pico.v && dentro(az, el) && Math.hypot(az - pico.az, el - pico.el) < 20) { sa += v * az; sw += v; }
    }
    return { a: -(sa / sw) * Math.PI / 180, tam: sw, olhos: true };
  }
  let melhor = null;
  for (const [, sl, sr, a, tam] of f.seen || []) if (Math.abs(a) < 1.3 && (!melhor || tam > melhor.tam)) melhor = { a, tam };
  return melhor;
}
function sbFly(f, dt) {
  f.flyT += dt;
  // alvo: depois do arranque, procura uma coisa atraente à frente; sem nada em VOO_MAX s, pousa onde estiver
  if (!f.pouso && f.flyT > 0.15 && (f.alvoT = (f.alvoT || 0) - dt) <= 0) {
    f.alvoT = 0.25;
    // só sentidos: não há alvo tirado da lista; ela pousa quando há uma coisa embaixo e o cheiro bom está forte ou parou
    // de crescer (chegou perto da fonte). A altura embaixo conta como o que a parte de baixo dos olhos vê
    const r = soSentidos() ? null : sbEscolheAlvo(f), embaixo = sbSurface(f.x, f.y);
    if (r) { f.pouso = { id: r.id, x: r.x + r.w / 2, y: r.y + r.h / 2, z: r.z || 0, r }; labEvent('alvoVoo', { id: r.id, t: +f.flyT.toFixed(2) }); }
    else if (!soSentidos() && (f.flyT > VOO_MAX || f.flyT > 6) || soSentidos() && f.flyT > VOO_MAX_SENTIDOS) {
      const px = f.x + Math.sin(f.th) * 40, py = f.y - Math.cos(f.th) * 40;
      const [x0, y0, x1, y1] = sbLim();
      f.pouso = { id: null, x: Math.min(x1 - 20, Math.max(x0 + 20, px)), y: Math.min(y1 - 20, Math.max(y0 + 20, py)), z: sbSurface(px, py) };
    }
  }
  if (f.flyT > 6 && f.pouso && f.pouso.id) f.pouso = null;   // não chegou em 6 s: pousa onde estiver (abaixo)
  // só sentidos (regra, B5 de docs/plano-busca-cheiro.md): pousa na coisa que a parte de baixo dos olhos vê embaixo, se a
  // superfície ali é suave e há cheiro bom. Avalia a cada instante (antes, a cada 0,25 s, e ela passava por cima de uma
  // fruta de 40 mm em ~0,3 s) e sem exigir cheiro forte na altura do voo (a nuvem de cheiro enfraquece com a altura)
  if (!f.pouso && soSentidos() && f.flyT > 0.15) {
    const embaixo = sbSurface(f.x, f.y);
    if (embaixo > SB_STEP && sbInclinacao(f.x, f.y) < 0.5 && (f.atrInata || 0) > 0.1) {
      f.pouso = { id: null, x: f.x + Math.sin(f.th) * 8, y: f.y - Math.cos(f.th) * 8, z: embaixo };
      labEvent('alvoVoo', { id: 'sentidos', t: +f.flyT.toFixed(2) });
    }
  }
  const P = f.pouso;
  let dist = Infinity;
  if (!P && soSentidos()) {
    // só sentidos: vira para a coisa que mais aparece à frente nos olhos (servo visual, regra nossa); o cheiro soma a
    // virada entre as antenas, em stepBody
    const alvo = sbAlvoVisual(f);
    if (alvo) f.th += clamp(alvo.a * 3, -4, 4) * dt;
  }
  if (P) {
    dist = Math.hypot(P.x - f.x, P.y - f.y);
    // aproximação: vira para o ponto de pouso (regra)
    let a = Math.atan2(P.x - f.x, -(P.y - f.y)) - f.th;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(a) > 2.2 && dist > 60) f.pouso = null;   // passou do alvo: escolhe de novo
    else f.th += clamp(a * 6, -8, 8) * dt;
  }
  f.landing = !!P;
  // velocidade: a força das asas (motores DLM e DVM, na página); chegando perto do pouso, freia
  // (freia até quase parar: com velocidade mínima alta, o raio de curva fica maior que o alvo e ela orbita)
  // (só sentidos: com uma coisa embaixo, desacelera para poder pousar nela, como moscas se aproximando para pousar)
  const v = (f.vVoo || SB_FLY_SPEED) * (P ? clamp(dist / 120, 0.06, 1) : soSentidos() && sbSurface(f.x, f.y) > SB_STEP ? 0.35 : 1);
  const [lx0, ly0, lx1, ly1] = sbLim();
  f.x = Math.min(lx1 - 10, Math.max(lx0 + 10, f.x + Math.sin(f.th) * Math.min(v * dt, P ? dist : Infinity)));
  f.y = Math.min(ly1 - 10, Math.max(ly0 + 10, f.y - Math.cos(f.th) * Math.min(v * dt, P ? dist : Infinity)));
  // o que cresce à frente em voo: a parede do mundo ou uma coisa mais alta que ela, na direção do voo. O crescimento
  // do tamanho aparente liga os detectores de ameaça (LPLC2, LC4); se a fibra gigante disparar, ela faz uma sacada.
  // (Não conta o alvo do pouso: é para ele que ela vai)
  let dObst = Infinity;
  // só sentidos: sobre uma coisa, desacelerando para pousar nela, o que está logo à frente nela não conta como obstáculo
  // (moscas distinguem a aproximação para pousar, que leva ao pouso, de um obstáculo que cresce de lado, que leva a uma
  // guinada: Tammero e Dickinson 2002). Sem isso, a fruta em que ia pousar disparava a fibra gigante e ela fugia
  const aproxima = !P && soSentidos() && sbSurface(f.x, f.y) > SB_STEP;
  for (let d = 15; d <= 420; d += 15) {
    const px = f.x + Math.sin(f.th) * d, py = f.y - Math.cos(f.th) * d;
    const fora = px < lx0 || px > lx1 || py < ly0 || py > ly1;
    if (aproxima && d < 60) continue;
    if (fora || (sbSurface(px, py) > f.z - 4 && !(P && Math.hypot(px - P.x, py - P.y) < 60))) { dObst = d; break; }
  }
  const R = 45;
  f.loomObst = dObst < Infinity ? Math.min(200, PRED_LOOM * 2 * R * v / (dObst * dObst + R * R)) : 0;
  const below = sbSurface(f.x, f.y);
  const ahead = sbSurface(f.x + Math.sin(f.th) * 90, f.y - Math.cos(f.th) * 90);
  // altura: cruzeiro acima do que está embaixo e à frente; na aproximação, desce planando até o alvo
  const target = P ? Math.max(below, P.z + clamp(dist * 0.3, 0, SB_CRUISE)) : Math.max(below, ahead) + SB_CRUISE;
  f.vz += ((target - f.z) * 3 - f.vz) * Math.min(1, dt * 5);
  f.z = Math.max(below, f.z + f.vz * dt);
  // pousa ao chegar em cima do alvo (a área do objeto, ou 20 px do ponto escolhido) e perto da altura dele
  const emCima = P && (P.r ? (SB.formas ? sbAlturaObjeto(P.id, f.x, f.y) > -Infinity : f.x >= P.r.x && f.x <= P.r.x + P.r.w && f.y >= P.r.y && f.y <= P.r.y + P.r.h) : dist < 20);
  if (emCima && f.z - below < 6) {
    f.flying = false; f.z = below; f.vz = 0; f.pouso = null; f.voarCd = 5;
    f.loomObst = 0;   // o "obstáculo que cresce" é do voo: pousada, não fica ameaçando (antes, podia disparar uma fuga ao pousar)
    if (SB.fisico) corpoTeleporte(f);   // o corpo físico recomeça onde ela pousou
    // (só sentidos: o pouso não tem alvo; registra o que ficou embaixo, só para medir)
    const debaixo = P.id || (SB.formas ? rects.find(q => sbAlturaObjeto(q.id, f.x, f.y) > -Infinity)?.id : null) || null;
    labEvent('pouso', { z: Math.round(below), id: debaixo, t: +f.flyT.toFixed(2) });
    logEvent(debaixo ? `Voou até "${label(debaixo)}" e pousou (${f.flyT.toFixed(1)} s de voo).` : below > 0 ? `Pousou numa plataforma a ${Math.round(below)} px de altura.` : 'Pousou no chão.');
  }
}
function sbNovelBelow(f, below) {
  return rects.some(r => !r.disabled && Math.abs(r.z - below) < 1 && el(r.id).novelty > 0.5 &&
    Math.hypot(r.x + r.w / 2 - f.x, r.y + r.h / 2 - f.y) < 80);
}

/* ───────────── você: o louva-a-deus ───────────── */
// Você controla uma ninfa de louva-a-deus (~15 mm), predador de emboscada: em criações, ninfas de louva-a-deus
// comem moscas-da-fruta. A mosca não sabe o que é um louva-a-deus: vê um objeto (olhos) e, quando algo cresce
// rápido na frente dela, os detectores de ameaça (LPLC2, LC4) disparam; se a fibra gigante disparar em rajada,
// ela foge. Rastejar devagar, ou chegar pelo ponto cego atrás dela, quase não faz nada crescer.
// O bote das patas da frente vai e volta em 90 ms; se ela ainda estiver lá, você a segura. Presa, ela sente as
// patas agarradas (todas as cerdas) e a dor (PPL1); a cada mordida a cabeça do louva-a-deus avança e cresce na
// frente dela, e cada rajada da fibra gigante é um tranco que afrouxa o aperto.
const PRED = { on: false, x: 0, y: 0, z: 0, th: 0, keys: new Set(), cd: 0, captures: 0, escapes: 0, botes: 0,
  bote: null, cdBote: 0, presa: null, passo: 0, andando: false, alerta: 0, prev: {} };
const PRED_R = 10;   // raio da cabeça (px), para o tamanho aparente
const LOUVA = {
  anda: 175, rasteja: 55, gira: 2.2, giraDevagar: 1.1,     // px/s e rad/s de tempo cerebral (7 px = 1 mm)
  cabeca: 47, alturaCabeca: 28,                             // a cabeça: px à frente do centro, px acima do chão
  pontaRepouso: 42, pontaMax: 82, alturaPonta: 16,          // a ponta das patas da frente: dobrada e no fim do bote
  bote: 0.09, recarga: 1.0, pega: 18,                       // s, s, px de tolerância para agarrar
  come: 4.0, tranco: 0.34, aperta: 0.1, abre: 0.6,          // s para levar à boca; aperto por tranco e por espaço; ângulo do alcance
};
const PRED_LOOM = 60;   // Hz nos detectores de ameaça por rad/s de crescimento do tamanho aparente
function predSpawn() {
  const a = Math.random() * Math.PI * 2;
  PRED.x = Math.min(SB.W - 60, Math.max(60, fly.x + Math.sin(a) * 320));
  PRED.y = Math.min(SB.H - 60, Math.max(60, fly.y - Math.cos(a) * 320));
  PRED.z = sbSurface(PRED.x, PRED.y);
  PRED.th = Math.atan2(fly.x - PRED.x, -(fly.y - PRED.y));
  PRED.prev = {}; PRED.cd = 1; PRED.bote = null; PRED.presa = null;
}
// um ponto à frente do louva-a-deus (px) e a altura dele
function predFrente(dist, alt) { return { x: PRED.x + Math.sin(PRED.th) * dist, y: PRED.y - Math.cos(PRED.th) * dist, z: PRED.z + alt }; }
// até onde vai a ponta das patas agora: dobrada, no bote (vai e volta) ou segurando
function predPonta() {
  if (PRED.presa || !PRED.bote) return LOUVA.pontaRepouso;
  const u = PRED.bote.t / LOUVA.bote, ida = u < 0.5 ? u * 2 : 2 - u * 2;
  return LOUVA.pontaRepouso + (LOUVA.pontaMax - LOUVA.pontaRepouso) * Math.sin(ida * Math.PI / 2);
}
// o que ela vê crescer: a cabeça (avança a cada mordida) e a ponta das patas (no bote)
function predPartes() {
  const mord = PRED.presa ? PRED.presa.mordida : 0;
  return { cabeca: { ...predFrente(LOUVA.cabeca + 10 * mord, LOUVA.alturaCabeca), r: PRED_R }, ponta: { ...predFrente(predPonta(), LOUVA.alturaPonta), r: 5 } };
}
// de onde vem a ameaça agora (para a direção da fuga, na página): a parte que mais cresce
function predAmeacaPos() { return PRED.bote ? predPartes().ponta : predPartes().cabeca; }
// a mosca está no alcance do bote?
function predNoAlcance(f) {
  const dx = f.x - PRED.x, dy = f.y - PRED.y, d = Math.hypot(dx, dy);
  let a = Math.atan2(dx, -dy) - PRED.th;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return !f.flying && d > LOUVA.pontaRepouso - 12 && d < LOUVA.pontaMax + LOUVA.pega && Math.abs(a) < LOUVA.abre && Math.abs((f.z || 0) - PRED.z) < 20;
}
function predStep(f, dt) {
  if (!PRED.on) { f.loom = 0; return; }
  if (PRED.presa && !f.presa) PRED.presa = null;   // trocou de mosca (outro sistema) no meio
  const k = PRED.keys, devagar = k.has('shift');
  PRED.cd -= dt; PRED.cdBote -= dt;
  PRED.andando = false;
  if (!PRED.presa) {
    const turn = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const fwd = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 0.5 : 0);
    PRED.th += turn * (devagar ? LOUVA.giraDevagar : LOUVA.gira) * dt;
    const v = fwd * (devagar ? LOUVA.rasteja : LOUVA.anda);
    PRED.x = Math.min(SB.W - 20, Math.max(20, PRED.x + Math.sin(PRED.th) * v * dt));
    PRED.y = Math.min(SB.H - 20, Math.max(20, PRED.y - Math.cos(PRED.th) * v * dt));
    PRED.passo += (Math.abs(v) + Math.abs(turn) * 40) * dt;
    PRED.andando = Math.abs(v) > 1 || turn !== 0;
  }
  // insetos escalam: ele acompanha a superfície embaixo (sobe nas frutas)
  PRED.z += (sbSurface(PRED.x, PRED.y) - PRED.z) * Math.min(1, dt * 8);
  if (PRED.bote) {
    PRED.bote.t += dt;
    // no fim da ida: se ela ainda está ali, agarra
    if (!PRED.bote.checou && PRED.bote.t >= LOUVA.bote / 2) {
      PRED.bote.checou = true;
      const p = predFrente(LOUVA.pontaMax, LOUVA.alturaPonta);
      if (!f.flying && !f.jumping && Math.hypot(p.x - f.x, p.y - f.y) < LOUVA.pega && Math.abs(p.z - (f.z || 0) - 4) < 20) predPega(f);
      else labEvent('boteErrado', { voando: !!f.flying });
    }
    if (PRED.bote && PRED.bote.t >= LOUVA.bote) PRED.bote = null;
  }
  if (PRED.presa) {
    // segurando: leva à boca, mordendo a cada 0,5 s (a cabeça avança)
    const P = PRED.presa;
    P.t += dt; P.p = Math.min(1, P.t / LOUVA.come);
    P.mordida = Math.max(0, Math.sin(P.t * Math.PI * 2 / 0.5)) ** 3;
    const pos = predFrente(LOUVA.pontaRepouso + 4 - 6 * P.p, LOUVA.alturaPonta + 8 * P.p);
    f.x = pos.x; f.y = pos.y; f.z = pos.z - 4;
    if (P.aperto <= 0) predSolta(f, 'escapou');
    else if (P.p >= 1) predCome(f);
  }
  // o que ela vê: o tamanho aparente de cada parte e quanto ele cresce (é o que LPLC2 e LC4 medem); ponto cego atrás
  const hx = f.x + Math.sin(f.th) * 10, hy = f.y - Math.cos(f.th) * 10, hz = (f.z || 0) + 6;
  let loom = 0;
  for (const [nome, A] of Object.entries(predPartes())) {
    const d = Math.hypot(A.x - hx, A.y - hy, A.z - hz), size = 2 * Math.atan(A.r / Math.max(d, 1));
    let a = Math.atan2(A.x - f.x, -(A.y - f.y)) - f.th;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    const grow = PRED.prev[nome] != null ? (size - PRED.prev[nome]) / Math.max(dt, 1e-3) : 0;
    PRED.prev[nome] = size;
    if (Math.abs(a) < EYE_BACK) loom = Math.max(loom, PRED_LOOM * Math.max(0, grow));
    if (nome === 'cabeca') PRED.noPontoCego = Math.abs(a) >= EYE_BACK;
  }
  f.loom = Math.min(200, loom);
  PRED.alerta += (f.loom / 200 - PRED.alerta) * Math.min(1, dt / 0.15);
}
// o louva-a-deus como objeto nos olhos (LC10a), igual a um elemento novo
function predView(f) {
  if (!PRED.on) return [0, 0];
  const dx = PRED.x - f.x, dy = PRED.y - f.y, d = Math.hypot(dx, dy, PRED.z - f.z);
  if (d < 6) return [0, 0];
  let a = Math.atan2(dx, -dy) - f.th;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  const s = Math.min(1, 2 * Math.atan(30 / d) / EYE_SAT) ** 2;
  return [a > -EYE_BACK && a < EYE_FRONT ? s : 0, a < EYE_BACK && a > -EYE_FRONT ? s : 0];
}
function predPega(f) {
  PRED.presa = { t: 0, p: 0, aperto: 1, mordida: 0, trancos: 0 };
  PRED.bote = null;
  f.presa = true; f.flying = false; f.jumping = false; f.naParede = null;
  f.pain = 0.5; f.lastPain = brainT / 1000;
  labEvent('captura', {});
  logEvent('O louva-a-deus agarrou a mosca com as patas da frente. Ela sente as patas presas (todas as cerdas) e a dor (dopamina PPL1).', 'b');
}
// a fibra gigante disparou em rajada enquanto presa: um tranco que afrouxa o aperto
function predTranco(f) {
  const P = PRED.presa;
  P.aperto -= LOUVA.tranco; P.trancos++;
  labEvent('tranco', { aperto: +P.aperto.toFixed(2) });
  logEvent(`Tranco! A fibra gigante dela disparou e ela se debateu: aperto em ${Math.max(0, Math.round(P.aperto * 100))}%.`, 'a');
}
function predSolta(f, como) {
  PRED.presa = null; f.presa = false; PRED.cd = 1.5; PRED.cdBote = 1;
  if (como === 'escapou') {
    PRED.escapes++;
    labEvent('escapouDoLouva', {});
    logEvent('Ela se debateu até afrouxar as patas do louva-a-deus e escapou voando.', 'a');
  } else logEvent('Você soltou a mosca.');
  sbTakeoff(f, 'fuga'); f.vz = 160;
}
function predCome(f) {
  PRED.presa = null; f.presa = false; PRED.captures++; PRED.cd = 3;
  labEvent('comida', {});
  logEvent('O louva-a-deus comeu a mosca. A simulação continua: ela volta do outro lado da bancada, com o mesmo cérebro e a memória da dor.', 'b');
  const a = PRED.th + Math.PI + (Math.random() - 0.5);
  f.x = Math.min(SB.W - 40, Math.max(40, PRED.x + Math.sin(a) * 520));
  f.y = Math.min(SB.H - 40, Math.max(40, PRED.y - Math.cos(a) * 520));
  f.z = sbSurface(f.x, f.y); f.flying = false; f.vz = 0; f.th = Math.random() * Math.PI * 2;
  if (SB.fisico) corpoTeleporte(f);
}
function predSet(on) {
  if(on&&window.Treino?.sessao)return;
  if(on && window.Colonia?.ativa)return;
  PRED.on = on;
  if (on) predSpawn();
  else { if (PRED.presa && fly) predSolta(fly, 'soltou'); fly && (fly.loom = 0); }
  $('#predBtn').classList.toggle('on', on);
  $('#predHelp').hidden = !on;
  $('#predHud').hidden = !on;
  if (SBR.pred) SBR.pred.visible = on;
  if (SBR.predAlcance) SBR.predAlcance.visible = on;
  if (on) sbCamMode('pred');
  else if (SBR.mode === 'pred') sbCamMode('spec');
  logEvent(on ? 'Um louva-a-deus entrou no mundo. É você.' : 'O louva-a-deus saiu.');
}
addEventListener('keydown', e => {
  if (!SB.on || !PRED.on || SBR.mode === 'fantasma' || e.target.closest?.('input, textarea')) return;
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    if (e.repeat) return;
    if (PRED.presa) PRED.presa.aperto = Math.min(1, PRED.presa.aperto + LOUVA.aperta);
    else if (PRED.cdBote <= 0 && !PRED.bote) { PRED.bote = { t: 0 }; PRED.cdBote = LOUVA.recarga; PRED.botes++; labEvent('bote', { alcance: predNoAlcance(fly) }); }
    return;
  }
  if (k === 'r') { if (PRED.presa) predSolta(fly, 'soltou'); return; }
  PRED.keys.add(k);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => PRED.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => PRED.keys.clear());

/* ───────────── corpo físico (NeuroMechFly, servidor local) ───────────── */
// A física do corpo roda em corpo/servidor.py (flygym + MuJoCo, com passadas gravadas de moscas reais).
// Daqui vai o sinal descendente [esquerda, direita]; de lá vem a pose de cada peça do corpo.
// escala: 7 px por mm (a mosca, com ~2,5 mm, fica com ~18 px, bem menor que um botão)
const CORPO = { url: 'http://localhost:8766', ok: false, malha: null, t0: 0, pose: null, busy: false, iv: 0, S: 7, pausado: false };
// física (mm, y para cima) <-> tela (px, y para baixo), com a origem no canto do mundo
const corpoDaTela = f => ({ x: f.x / CORPO.S, y: -f.y / CORPO.S, rumo: Math.PI / 2 - f.th, z: sbSurface(f.x, f.y) / CORPO.S });
// as plataformas do sandbox viram blocos sólidos na física (mm)
async function corpoMundo() {
  const S = CORPO.S;
  // o que tem menos de 1 mm de altura (açúcar, água, folhas) fica fora da física: é chão para as patas. Como blocos
  // de 0,4 mm, as patas encostavam no bloco e no chão ao mesmo tempo e a física ficava 12 vezes mais lenta
  // no mundo natural vão as formas redondas (as mesmas do desenho); nas plataformas, blocos
  const plats = SB.formas ? [] : SB.platforms.filter(p => p.z >= S).map(p => [(p.x + p.w / 2) / S, -(p.y + p.h / 2) / S, p.w / 2 / S, p.h / 2 / S, p.z / 2 / S]);
  const formas = (SB.formas || []).filter(f => f.tipo !== 'plano').map(f => [f.tipo, f.x / S, -f.y / S, f.z / S, f.a / S, f.b / S, f.c / S]);
  await fetch(CORPO.url + '/mundo', { method: 'POST', body: JSON.stringify({ plataformas: plats, formas }) });
  CORPO.mundo = SB.app;
}
async function corpoTeleporte(f) {
  // poses pedidas antes (ou durante) o teleporte são descartadas: mostrariam o lugar antigo
  CORPO.gen = (CORPO.gen || 0) + 1; CORPO.teleportando = true;
  try { await fetch(CORPO.url + '/teleporte', { method: 'POST', body: JSON.stringify(corpoDaTela(f)) }); } catch { /* o próximo passo avisa */ }
  CORPO.teleportando = false; CORPO.gen++; CORPO.prev = null; CORPO.pose = null;
  CORPO.subida = {}; CORPO.semApoio = 0; CORPO.semApoioDesde = null; CORPO.parada = 0; CORPO.ult = null;
}
// a face de plataforma mais perto (px) e a normal dela, para fora; só plataformas mais altas que o piso onde ela está
function sbParede(f, alcance, piso = sbSurface(f.x, f.y)) {
  if (SB.formas) return sbParedeNatural(f, alcance, piso);
  let best = null;
  for (const p of SB.platforms || []) {
    if (p.z <= piso + SB_STEP) continue;
    const cx = Math.min(p.x + p.w, Math.max(p.x, f.x)), cy = Math.min(p.y + p.h, Math.max(p.y, f.y));
    const d = Math.hypot(f.x - cx, f.y - cy);
    if (d > alcance || (best && d >= best.d)) continue;
    const n = Math.abs(f.x - cx) >= Math.abs(f.y - cy) ? [Math.sign(f.x - cx) || 1, 0] : [0, Math.sign(f.y - cy) || 1];
    best = { p, cx, cy, d, n, piso };
  }
  return best;
}
// no mundo natural: a borda (no balcão) da forma mais perto, mais alta que o piso, e a normal dela para fora
function sbParedeNatural(f, alcance, piso) {
  let best = null;
  for (const s of SB.formas) {
    if (s.tipo === 'plano') continue;
    const topo = s.tipo === 'cilindro' ? s.z + s.b : s.z + s.c;
    if (topo <= piso + SB_STEP) continue;
    const ax = s.a, by = s.tipo === 'elipsoide' ? s.b : s.a, dx = f.x - s.x, dy = f.y - s.y;
    const u = Math.hypot(dx / ax, dy / by) || 1e-6;
    const cx = s.x + dx / u, cy = s.y + dy / u, d = u >= 1 ? Math.hypot(f.x - cx, f.y - cy) : 0;
    if (d > alcance || (best && d >= best.d)) continue;
    let nx = dx / (ax * ax), ny = dy / (by * by);
    const nn = Math.hypot(nx, ny) || 1;
    nx /= nn; ny /= nn;
    best = { p: { x: s.x - ax, y: s.y - by, w: 2 * ax, h: 2 * by, z: topo }, cx, cy, d, n: [nx, ny], piso, natural: true };
  }
  return best;
}
// põe o corpo na parede, de barriga para ela e cabeça para cima (a virada do chão para a parede é regra nossa)
async function corpoParede(f, w) {
  const S = CORPO.S;
  CORPO.gen = (CORPO.gen || 0) + 1; CORPO.teleportando = true;
  const pose = { x: w.cx / S, y: -w.cy / S, rumo: 0, z: w.piso / S + 1.8, parede: [w.n[0], -w.n[1]] };
  try { await fetch(CORPO.url + '/teleporte', { method: 'POST', body: JSON.stringify(pose) }); } catch { /* o próximo passo avisa */ }
  CORPO.teleportando = false; CORPO.gen++; CORPO.prev = null; CORPO.pose = null;
  CORPO.graca = performance.now() + 1500;
}
async function corpoPing() {
  try { CORPO.ok = (await fetch(CORPO.url + '/ping', { cache: 'no-store' })).ok; } catch { CORPO.ok = false; }
  $('#corpoBtn').disabled = !CORPO.ok || !!window.Colonia?.ativa || !!window.Treino?.sessao;
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
  let v = (f.back > 0 ? -0.8 : 1) * Math.min(1.2, (f.speed || 0) / WALK);
  // regra do corpo: na parede ela não para (parada, a passada solta as patas e ela escorrega) e sobe com a passada mais
  // forte: com 0,9 ela empacava a ~4 mm do chão; com 1,2 sobe a ~6,5 mm/s (a banana, de 18 mm, em ~2,5 s)
  if (f.naParede) v = Math.max(v, 1.2);
  let u = Math.max(-0.9, Math.min(0.9, 0.15 * (f.turnCmd || 0)));
  const P = CORPO.pose;
  if (f.naParede && P && P.frente) {
    // regra do corpo (geotaxia negativa): na parede, vira para cima. Moscas sobem paredes, mas o caminho que faz
    // isso no cérebro não é conhecido; o sinal lateral da gravidade nas antenas depende da mecânica da antena.
    // As passadas (gravadas no chão) só a seguram subindo reto: de lado ela escorrega (corpo/parede_teste.py).
    // Por isso, na parede, a virada do cérebro vale 1/4 e a regra de subir manda
    const [a, b] = P.costas, [d, e] = P.frente, esqZ = a * e - b * d;   // z de (costas × frente): para onde fica a esquerda dela
    u = 0.25 * u - Math.max(-0.8, Math.min(0.8, 2 * Math.asin(Math.max(-1, Math.min(1, esqZ)))));
  }
  return [v + u, v - u];
}
async function corpoTick() {
  if (CORPO.busy || !SB.fisico || !fly) return;
  CORPO.busy = true;
  if (CORPO.mundo !== SB.app) {
    // trocou de sistema: o mundo físico ganha as plataformas novas e a mosca é posta onde está
    try { await corpoMundo(); await corpoTeleporte(fly); } catch { /* tenta de novo no próximo passo */ }
    CORPO.busy = false;
    return;
  }
  try {
    const tb = brainT / 1000 - CORPO.t0, gen = CORPO.gen;
    // no ar, o corpo físico fica parado esperando o pouso
    // com tempo-limite: se a física atrasar (um passo lento), pula este e tenta de novo; só desiste depois de ~4 s
    const ctl = new AbortController(), tmo = setTimeout(() => ctl.abort(), 1500);
    let p;
    try {
      p = await (await fetch(CORPO.url + '/passo', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ t: tb, sinal: fly.flying || fly.presa ? [0, 0] : corpoSinal(fly) }) })).json();
      CORPO.atrasos = 0;
    } catch (e) {
      if (e.name !== 'AbortError' || ++CORPO.atrasos > 3) throw e;
      return;
    } finally { clearTimeout(tmo); }
    if (CORPO.teleportando || gen !== CORPO.gen || CORPO.mundo !== SB.app) return;
    // guarda a pose anterior para desenhar o meio do caminho entre as duas (a tela é mais rápida que a física)
    const agora = performance.now();
    CORPO.prev = CORPO.pose ? CORPO.pose.geoms : p.geoms;
    CORPO.dtArr = Math.min(250, Math.max(30, agora - (CORPO.tArr || agora)));
    CORPO.tArr = agora;
    CORPO.pose = p;
    // tato fásico: as cerdas respondem a mudança de contato (pisar, levantar a pata), não ao apoio parado
    if (fly.flying || !p.toque) { fly.toque = null; CORPO.toqueAnt = null; }
    else {
      const ant = CORPO.toqueAnt || p.toque;
      fly.toque = Object.fromEntries(Object.entries(p.toque).map(([perna, v]) => [perna, Math.abs(v - (ant[perna] || 0))]));
      CORPO.toqueAnt = p.toque;
    }
    // o resto do que as patas e as antenas sentem: tropeço (reflexo do controlador), carga no apoio, movimento
    // da junta fêmur-tíbia (órgão cordotonal) e o quanto a cabeça aponta para cima (gravidade nas antenas)
    if (fly.flying || !p.junta) { fly.cordo = null; fly.carga = null; fly.gravidade = 0; }
    else {
      fly.cordo = p.junta; fly.carga = p.toque; fly.gravidade = p.frente ? p.frente[2] : 0;
      for (const [perna, v] of Object.entries(p.tropeco || {})) if (v) { (fly.tropeco = fly.tropeco || {})[perna] = performance.now(); labEvent('tropeco', { perna }); }
    }
    if (!fly.flying && !fly.presa) {
      // a posição, o rumo e a altura vêm da física (mm -> px; o y da física aponta para cima na tela)
      fly.x = p.torax[0] * CORPO.S; fly.y = -p.torax[1] * CORPO.S;
      fly.z = Math.max(0, (p.torax[2] - 1.15) * CORPO.S);
      const empe = p.frente && p.frente[2] > 0.6, deitada = !p.frente || (p.frente[2] < 0.35 && p.costas[2] > 0.7);
      // nas formas redondas, a subida começa assim que ela empina sobre a fruta (a pegada do servidor já a segura)
      const subida = SB.formas && CorpoNatural.subida(CORPO.subida || (CORPO.subida = {}), p);
      const naForma = subida && subida.ativa;
      if (!fly.naParede) {
        fly.th = Math.PI / 2 - p.rumo;
        // subiu a parede andando: as patas da frente grudaram na face e o corpo empinou
        const w = (SB.formas ? naForma : empe) && sbParede(fly, 40, CORPO.piso ?? sbSurface(fly.x, fly.y));
        if (w) {
          fly.naParede = w; labEvent('parede', { como: 'andando' });
          // (nas encostas das frutas ela entra e sai da "parede" várias vezes; a mensagem sai no máximo a cada 4 s)
          if (!w.natural || performance.now() > (CORPO.paredeLog || 0)) {
            CORPO.paredeLog = performance.now() + 4000;
            logEvent(w.natural ? 'Andou contra a fruta e começou a subir por ela.' : 'Andou contra a plataforma e começou a subir pela parede: as almofadinhas das patas seguram.', 's');
          }
          // o agarrão (regra nossa, 0,2 s de força contra a parede): faz o papel das garras, que as passadas de chão não
          // têm. Nas formas redondas, a pegada do servidor faz isso o tempo todo
          if (!w.natural) fetch(CORPO.url + '/agarrar', { method: 'POST', body: JSON.stringify({ parede: [w.n[0], -w.n[1]] }) }).catch(() => {});
          CORPO.graca = performance.now() + 1000;
        }
        else CORPO.piso = sbSurface(fly.x, fly.y);
      }
      if (fly.naParede) {
        const w = sbParede(fly, 40, fly.naParede.piso) || fly.naParede;
        fly.naParede = w;
        // Na fruta o rumo vem do corpo real, não de uma direção inventada para o centro.
        if (!w.natural) fly.th = Math.atan2(-w.n[0], w.n[1]);
        else if (Math.hypot(p.frente[0], p.frente[1]) > 0.15) fly.th = Math.PI / 2 - p.rumo;
        if (!w.natural && p.torax[2] >= w.p.z / CORPO.S - 2) {
          // as patas da frente alcançaram a beira de cima (o tórax a 2 mm dela; a cabeça fica ~1,2 mm à frente):
          // a passagem da parede para o topo é regra nossa, como a de baixo
          fly.x = w.cx - w.n[0] * 2.5 * CORPO.S; fly.y = w.cy - w.n[1] * 2.5 * CORPO.S; fly.z = w.p.z;
          fly.naParede = null; CORPO.piso = w.p.z;
          labEvent('topo', {}); logEvent('Subiu a parede inteira e chegou ao topo da plataforma.', 's');
          await corpoTeleporte(fly);
          return;
        }
        // reagarrão (regra nossa, igual ao agarrão): escorregou mais de 1 mm em meio segundo, aperta de novo contra a parede
        const agora = performance.now(), hist = (CORPO.zHist = (CORPO.zHist || []).filter(h => agora - h[0] < 500));
        hist.push([agora, p.torax[2]]);
        if (!w.natural && hist[0][1] - p.torax[2] > 1 && agora > (CORPO.reagarra || 0)) {
          CORPO.reagarra = agora + 1000; CORPO.zHist = [];
          fetch(CORPO.url + '/agarrar', { method: 'POST', body: JSON.stringify({ parede: [w.n[0], -w.n[1]] }) }).catch(() => {});
          labEvent('reagarrar', {});
        }
        // voltou a ficar de pé: saiu da parede. Nas frutas redondas é assim que ela chega em cima, sem passagem por regra
        // Nas frutas, a postura precisa persistir 180 ms físicos; perder a aderência não conta como topo.
        const dePe = w.natural ? !subida.ativa : deitada;
        if (dePe) {
          fly.naParede = null; CORPO.piso = sbSurface(fly.x, fly.y);
          const emCima = w.natural && subida.topo && sbSurface(fly.x, fly.y) > 7;
          labEvent(emCima ? 'topo' : 'saiuDaParede', {});
          if (emCima && performance.now() > (CORPO.topoLog || 0)) { CORPO.topoLog = performance.now() + 4000; logEvent('Subiu pela fruta e chegou em cima.', 's'); }
        }
      }
      // reflexo tarsal: quando as seis patas perdem o apoio (passou da beira, caiu da parede), a mosca começa a voar
      const apoio = Object.values(p.toque || {}).reduce((a, b) => a + b, 0);
      CORPO.semApoio = apoio < 0.05 && performance.now() > (CORPO.graca || 0) ? (CORPO.semApoio || 0) + 1 : 0;
      // Na Cozinha, 60 ms físicos sem apoio: consultar duas vezes a mesma pose não provoca voo.
      if (CORPO.semApoio) CORPO.semApoioDesde ??= p.t;
      else CORPO.semApoioDesde = null;
      const perdeuApoio = SB.formas ? CORPO.semApoioDesde != null && p.t - CORPO.semApoioDesde >= 0.06 : CORPO.semApoio >= 2;
      if (perdeuApoio) { CORPO.semApoio = 0; CORPO.semApoioDesde = null; fly.naParede = null; labEvent('reflexoTarsal', {}); sbTakeoff(fly, 'tarsal'); }
      // de cara com uma plataforma mais alta: se pede para andar e não sai do lugar, sobe a parede (se estiver de
      // frente para ela); se não, vira ou decola (regras do corpo)
      const avanco = Math.hypot(fly.x - (CORPO.ult ? CORPO.ult[0] : fly.x), fly.y - (CORPO.ult ? CORPO.ult[1] : fly.y));
      CORPO.parada = !fly.naParede && corpoSinal(fly)[0] + corpoSinal(fly)[1] > 1 && avanco < 0.3 ? (CORPO.parada || 0) + 1 : 0;
      CORPO.ult = [fly.x, fly.y];
      if (CORPO.parada > 12) {
        CORPO.parada = 0;
        const w = sbParede(fly, 40);
        const deFrente = w && Math.sin(fly.th) * -w.n[0] + -Math.cos(fly.th) * -w.n[1] > 0.5;
        if (deFrente && !w.natural && !sbWantsFly(fly)) {
          fly.naParede = w; labEvent('parede', { como: 'virada' });
          logEvent('Parou de cara com uma plataforma e começou a subir pela parede.', 's');
          await corpoParede(fly, w);
          return;
        }
        if (sbWantsFly(fly)) sbTakeoff(fly, 'subir');
        else { fly.startle = 0.35; fly.startleDir = Math.random() < 0.5 ? -1 : 1; }
      }
    }
    // o cérebro anda no ritmo que a física consegue (câmera lenta contínua); se ainda assim o corpo ficar muito para
    // trás, o cérebro espera (com folga, para não ficar liga-desliga)
    const atraso = tb - p.t;
    if (p.capacidade) {
      const r = Math.max(0.1, Math.min(1, 0.9 * p.capacidade * (atraso > 0.3 ? 0.7 : 1)));
      if (Math.abs(r - (CORPO.ritmo || 1)) > 0.03) { CORPO.ritmo = r; worker.postMessage({ type: 'ritmo', v: r }); }
    }
    if (atraso > 0.5 && !CORPO.pausado) { worker.postMessage({ type: 'run', on: false }); CORPO.pausado = true; }
    else if (atraso < 0.15 && CORPO.pausado) { worker.postMessage({ type: 'run', on: running }); CORPO.pausado = false; }
  } catch (e) {
    logEvent('O servidor do corpo físico parou de responder. Voltando ao corpo simplificado.');
    corpoSet(false);
  } finally { CORPO.busy = false; }
}
function corpoPose() {
  const cur = CORPO.pose.geoms, prev = CORPO.prev || cur, S = CORPO.S, ox = -SB.W / 2, oz = -SB.H / 2, oy = 0;
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
// baixa um arquivo de dados; se a conexão cair no meio (no pedido ou no download do conteúdo), tenta de novo.
// Um 404 não se repete
async function buscar(url, como = 'json', tentativas = 4) {
  for (let i = 1; ; i++) {
    let r;
    try {
      r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) break;
      return await r[como]();
    } catch (e) {
      if (i >= tentativas) throw new Error(url + ': ' + e.message);
      console.warn('buscar: tentando de novo', url, e.message);
      await new Promise(ok => setTimeout(ok, 300 * i));
    }
  }
  throw new Error(url + ': ' + r.status);
}
async function corpoCarregarMalha() {
  if (CORPO.malha) return;
  // a malha é gravada pelo servidor do corpo em web/data/ e vem do mesmo servidor dos dados do cérebro
  const [info, bin] = await Promise.all([buscar('data/corpo_malha.json'), buscar('data/corpo_malha.bin', 'arrayBuffer')]);
  CORPO.malha = corpoMeshes(info, bin);
  CORPO.malha.group.visible = false;
  SBR.scene.add(CORPO.malha.group);
}
async function corpoPreparar() {
  await corpoCarregarMalha();
  const r = await fetch(CORPO.url + '/ping', { cache: 'no-store' });
  if (!r.ok) throw new Error('ping respondeu ' + r.status);
}
async function corpoSet(on) {
  if(on&&window.Treino?.sessao)return;
  if(on && window.Colonia?.ativa)return;
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
    try { await corpoMundo(); } catch { logEvent('O servidor do corpo não aceitou as plataformas.'); return; }
    SB.fisico = true;
    fly.startle = 0;
    CORPO.t0 = brainT / 1000; CORPO.pose = null; CORPO.prev = null;
    if (!fly.flying) await corpoTeleporte(fly);   // o corpo físico começa onde ela está
    CORPO.iv = setInterval(corpoTick, 40);
    SBR.fly.scale.setScalar(0.95);   // no ar ela volta ao modelo simples, do mesmo tamanho do corpo físico
    logEvent('Corpo físico ligado: NeuroMechFly no MuJoCo, com passadas gravadas de moscas reais. O cérebro manda virar e andar; as patas fazem o resto. No ar, ela usa o modelo simples.');
  } else {
    clearInterval(CORPO.iv);
    CORPO.gen = (CORPO.gen || 0) + 1;   // descarta respostas físicas ainda em trânsito
    SB.fisico = false;
    fly.toque = null;
    CORPO.ritmo = 1; worker.postMessage({ type: 'ritmo', v: 1 });
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
// Moscas quase não veem vermelho: nesses canais, o vermelho aparece escuro. A imagem na tela mostra a cor média de
// cada omatídeo como os receptores dela captam (corMosca, em olhos3d.js); o que entra no cérebro continua sendo o brilho.
const OLHO = { mapa: null, rt: null, cams: null, buf: null, val: null, tex: null, quad: null, conta: 0 };
async function olhoCarregar() {
  if (OLHO.mapa || !SBR.r) return;
  try { OLHO.mapa = await fetch('data/olho_mapas.json', { cache: 'no-cache' }).then(r => r.json()); } catch { return; }
  const M = OLHO.mapa;
  OLHO.rt = new THREE.WebGLRenderTarget(M.colunas, M.linhas);
  OLHO.cams = [0, 1].map(() => { const c = new THREE.PerspectiveCamera(M.fovy, M.colunas / M.linhas, 0.2, 4000); c.matrixAutoUpdate = false; return c; });
  OLHO.buf = new Uint8Array(M.colunas * M.linhas * 4);
  OLHO.val = [new Float32Array(M.omatidios), new Float32Array(M.omatidios)];
  OLHO.cor = [new Float32Array(M.omatidios * 3), new Float32Array(M.omatidios * 3)];
  OLHO.tex = [0, 1].map(() => {
    const t = new THREE.DataTexture(new Uint8Array(M.colunas * M.linhas * 4), M.colunas, M.linhas, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    return t;
  });
  OLHO.cena = new THREE.Scene();
  OLHO.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: OLHO.tex[0], transparent: true, depthTest: false }));
  OLHO.cena.add(OLHO.quad);
  OLHO.obj = [new Float32Array(M.omatidios), new Float32Array(M.omatidios)];
  OLHO.lcMapa = [new Float32Array(M.omatidios), new Float32Array(M.omatidios)];
  // campo receptivo de cada LC10a (scripts/lc_omatidios.py, das sinapses do Janelia): quais omatídeos e com que peso
  try {
    const rf = await fetch('data/lc10a_rf.json', { cache: 'no-cache' }).then(r => r.json());
    OLHO.rf = {
      ids: Int32Array.from(rf.celulas.map(c => c[0])), olho: Uint8Array.from(rf.celulas.map(c => c[1])),
      om: rf.celulas.map(c => Int32Array.from(c[5])), w: rf.celulas.map(c => Float32Array.from(c[6])),
    };
    OLHO.lcTaxa = new Float32Array(rf.celulas.length);
  } catch { OLHO.rf = null; }
}
// pose das câmeras dos olhos: do corpo físico (servidor) ou, sem ele, uma aproximação na cabeça
function olhoPoses(f) {
  const S = CORPO.S, ox = -SB.W / 2, oz = -SB.H / 2;
  if (SB.fisico && CORPO.pose && CORPO.pose.olhos && !f.flying) {
    OLHO.cams.forEach((cam, i) => {
      const [px, py, pz, m0, m1, m2, m3, m4, m5, m6, m7, m8] = CORPO.pose.olhos[i];
      cam.matrixWorld.set(m0, m1, m2, ox + S * px, m6, m7, m8, S * pz, -m3, -m4, -m5, oz - S * py, 0, 0, 0, 1);
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
  const segunda = window.Colonia?.pronta && f === Colonia.segundo.fly;
  const esconde = [!segunda && SBR.fly, SBR.fields, SBR.rays, SBR.trailLine, SBR.ring, SBR.shadow, SBR.marker, SBR.predMarker, !segunda && CORPO.malha?.group, SBR.temaNatural && SBR.rotulos, SBR.predAlcance, ANIM.bocaSimples, ...ANIM.leques, ...(window.Colonia?.esconderDosOlhos(f) || [])].filter(Boolean);
  // A mesma decoração pode aparecer nas duas listas. Esconder/restaurar cada objeto uma vez.
  esconde.splice(0,esconde.length,...new Set(esconde));
  const vis = esconde.map(o => o.visible);
  esconde.forEach(o => { o.visible = false; });
  const feats = [];
  for (let i = 0; i < 2; i++) {
    R.setRenderTarget(OLHO.rt);
    R.setClearColor(SBR.bg, 1); R.clear();
    R.render(SBR.scene, OLHO.cams[i]);
    R.readRenderTargetPixels(OLHO.rt, 0, 0, M.colunas, M.linhas, OLHO.buf);
    const v = OLHO.val[i], cor = OLHO.cor[i];
    v.fill(0); cor.fill(0);
    for (let k = 0; k < M.fonte_px.length; k++) {
      const o = M.omatidio_px[k];
      if (o < 0) continue;
      const s = M.fonte_px[k], sr = (s / M.colunas) | 0, sc = s % M.colunas, j = ((M.linhas - 1 - sr) * M.colunas + sc) * 4;
      const n = 255 * M.pixels_por_omatidio[o], b = OLHO.buf;
      v[o] += b[j + (M.palido[o] ? 2 : 1)] / n;
      cor[3 * o] += b[j] / n; cor[3 * o + 1] += b[j + 1] / n; cor[3 * o + 2] += b[j + 2] / n;
    }
    // o que chama o LC10a: omatídeos mais claros que o resto do olho (o que ela não provou brilha mais)
    let mu = 0;
    for (let o = 0; o < M.omatidios; o++) mu += v[o];
    mu /= M.omatidios;
    let obj = 0;
    const ob = OLHO.obj[i];
    for (let o = 0; o < M.omatidios; o++) { ob[o] = Math.max(0, v[o] - mu - 0.06); obj += ob[o]; }
    feats.push(obj);
  }
  R.setRenderTarget(null);
  esconde.forEach((o, k) => { o.visible = vis[k]; });
  const [L, Rr] = feats, g = 4;
  f.olhoReal = { L: L / (L + Rr + g), R: Rr / (L + Rr + g), bruto: feats, t: performance.now(), celulas: lcTaxas()?.slice() };
  // imagem de cada olho para o HUD: cada pixel pinta a cor do seu omatídeo como ela vê (sem vermelho: o verde dela
  // aparece amarelo, o azul, azul); em vermelho, onde os LC10a estão vendo algo (vermelho ela não vê, então não confunde)
  for (let i = 0; i < 2; i++) {
    const cor = OLHO.cor[i], lm = OLHO.lcMapa[i], px = OLHO.tex[i].image.data;
    for (let k = 0; k < M.fonte_px.length; k++) {
      const o = M.omatidio_px[k], r = (k / M.colunas) | 0, c = k % M.colunas, j = ((M.linhas - 1 - r) * M.colunas + c) * 4;
      if (o < 0) { px[j + 3] = 0; continue; }
      const [vd, , az] = corMosca(cor[3 * o], cor[3 * o + 1], cor[3 * o + 2]), lc = 0.45 * Math.min(1, lm[o]), a = 255 * 1.1 * (1 - lc);
      px[j] = Math.min(255, vd * a + 255 * lc); px[j + 1] = Math.min(255, vd * a); px[j + 2] = Math.min(255, az * a); px[j + 3] = 255;
    }
    OLHO.tex[i].needsUpdate = true;
  }
}
// taxa de cada LC10a: o quanto de "coisa clara" cai no campo receptivo dela (soma ponderada dos omatídeos),
// numa curva que satura (LC_D50) e dividida pela atividade de todas as células dos dois olhos (normalização:
// numa tela cheia, sobressai o que destoa). A curva e a normalização são regras nossas; os campos vêm do mapa
const LC_MAX = 200, LC_D50 = 0.08, LC_POOL = 1.5;
function lcTaxas() {
  const rf = OLHO.rf;
  if (!rf) return null;
  const n = rf.ids.length, d = new Float32Array(n);
  let media = 0;
  for (let c = 0; c < n; c++) {
    const ob = OLHO.obj[rf.olho[c]], om = rf.om[c], w = rf.w[c];
    let s = 0;
    for (let k = 0; k < om.length; k++) s += w[k] * ob[om[k]];
    d[c] = s; media += s;
  }
  media /= n;
  OLHO.lcMapa[0].fill(0); OLHO.lcMapa[1].fill(0);
  for (let c = 0; c < n; c++) {
    const t = LC_MAX * d[c] / (d[c] + LC_D50 + LC_POOL * media);
    OLHO.lcTaxa[c] = t;
    const lm = OLHO.lcMapa[rf.olho[c]], om = rf.om[c], w = rf.w[c], a = t / LC_MAX;
    for (let k = 0; k < om.length; k++) lm[om[k]] += a * w[k] * 5;
  }
  return OLHO.lcTaxa;
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
  SBR.hemi = new THREE.HemisphereLight('#aaffd0', '#021a0c', 0.7); s.add(SBR.hemi);
  const key = SBR.key = new THREE.DirectionalLight('#e6fff0', 0.55);
  key.position.set(-500, 900, 300); s.add(key);
  // chão de grade
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SB.W + 1600, SB.H + 1600), new THREE.MeshStandardMaterial({ color: '#020b06', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; s.add(floor); SBR.floor = floor;
  const grid = SBR.grid = new THREE.GridHelper(SB.W + 1600, 60, '#2bff86', '#0a4a24');
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
  // o louva-a-deus e o alcance do bote no chão (os olhos dela não veem o alcance)
  const pred = SBR.pred = sbLouva();
  pred.visible = false;
  s.add(pred);
  const alc = SBR.predAlcance = new THREE.Group();
  const setor = new THREE.Mesh(new THREE.RingGeometry(LOUVA.pontaRepouso - 12, LOUVA.pontaMax + LOUVA.pega, 32, 1, Math.PI / 2 - LOUVA.abre, 2 * LOUVA.abre),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
  setor.rotation.x = -Math.PI / 2; alc.add(setor); alc.userData.setor = setor; alc.visible = false;
  s.add(alc);
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

/* ───────────── o mundo natural (a Cozinha) ───────────── */
// textura pintada num canvas: cor de fundo e manchas
function sbTex(fundo, manchas = [], w = 256, h = 256, riscos = null) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = fundo; g.fillRect(0, 0, w, h);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [cor, n, r0, r1] of manchas) {
    g.fillStyle = cor;
    for (let i = 0; i < n; i++) { g.beginPath(); g.ellipse(rnd() * w, rnd() * h, r0 + rnd() * (r1 - r0), (r0 + rnd() * (r1 - r0)) * (0.6 + rnd() * 0.6), rnd() * 3, 0, Math.PI * 2); g.fill(); }
  }
  if (riscos) { g.strokeStyle = riscos; g.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const y = rnd() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 12, w * 0.7, y + (rnd() - 0.5) * 12, w, y + (rnd() - 0.5) * 8); g.stroke(); } }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const sbMat = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, metalness: 0, ...extra });
// o cenário: bancada de madeira, parede e a janela (a luz vem dela). No mundo natural some o visual de Matrix
function sbTema(natural) {
  if (SBR.temaNatural === natural) return;
  SBR.temaNatural = natural;
  const s = SBR.scene;
  SBR.rain.mesh.visible = SBR.grid.visible = SBR.floor.visible = !natural;
  if (SBR.cenario) { s.remove(SBR.cenario); SBR.cenario = null; }
  if (natural) {
    SBR.bg = new THREE.Color('#e9dfd1');
    s.fog = new THREE.FogExp2('#e9dfd1', 0.00022);
    SBR.hemi.color.set('#fff8ee'); SBR.hemi.groundColor.set('#7a634a'); SBR.hemi.intensity = 0.5;
    SBR.key.color.set('#fff3e0'); SBR.key.intensity = 0.7; SBR.key.position.set(150, 1100, -1300);
    const c = SBR.cenario = new THREE.Group();
    const madeira = sbTex('#b89468', [['#a8845a', 30, 20, 60]], 512, 512, 'rgba(110, 75, 40, 0.4)');
    madeira.repeat.set(3, 3);
    const bancada = new THREE.Mesh(new THREE.PlaneGeometry(SB.W + 900, SB.H + 900), sbMat('#ffffff', { map: madeira, roughness: 0.75 }));
    bancada.rotation.x = -Math.PI / 2; c.add(bancada);
    // parede com azulejos e a janela, do lado de y = 0 (norte)
    const zp = -SB.H / 2 - 40;
    const azulejo = sbTex('#dcd6cb', [], 128, 128);
    { const g = azulejo.image.getContext('2d'); g.strokeStyle = '#d9d3c7'; g.lineWidth = 4; g.strokeRect(0, 0, 128, 128); azulejo.needsUpdate = true; }
    azulejo.repeat.set(24, 10);
    const parede = new THREE.Mesh(new THREE.PlaneGeometry(SB.W + 900, 1100), sbMat('#ffffff', { map: azulejo, roughness: 0.4 }));
    parede.position.set(0, 550, zp); c.add(parede);
    const ceu = document.createElement('canvas'); ceu.width = 16; ceu.height = 256;
    { const g = ceu.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9fd0ff'); gr.addColorStop(1, '#f2fbff'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256); }
    const janela = new THREE.Mesh(new THREE.PlaneGeometry(1000, 520), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ceu), fog: false }));
    janela.position.set(0, 440, zp + 2); c.add(janela);
    const moldura = new THREE.Mesh(new THREE.PlaneGeometry(1060, 580), sbMat('#fbfbf7'));
    moldura.position.set(0, 440, zp + 1); c.add(moldura);
    for (const x of [-170, 170]) { const trave = new THREE.Mesh(new THREE.BoxGeometry(16, 520, 8), sbMat('#fbfbf7')); trave.position.set(x, 440, zp + 6); c.add(trave); }
    const luz = new THREE.PointLight('#fff4e0', 0.25, 2600); luz.position.set(0, 500, zp + 200); c.add(luz);
    s.add(c);
  } else {
    SBR.bg = new THREE.Color('#010503');
    s.fog = new THREE.FogExp2('#010503', 0.00085);
    SBR.hemi.color.set('#aaffd0'); SBR.hemi.groundColor.set('#021a0c'); SBR.hemi.intensity = 0.7;
    SBR.key.color.set('#e6fff0'); SBR.key.intensity = 0.55; SBR.key.position.set(-500, 900, 300);
  }
  SBR.hex.uniforms.bg.value.copy(SBR.bg);
}
// cada coisa da cozinha, no tamanho real (px = mm x 7), apoiada na bancada
function sbObjeto(o) {
  const S = CORPO.S, W = o.w * S, D = o.d * S, Hh = Math.max(2, o.h * S), g = new THREE.Group();
  const esfera = (r, mat, x = 0, y = 0, z = 0, sy = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat); m.position.set(x, y, z); m.scale.y = sy; g.add(m); return m; };
  // frutas e tampa: as mesmas formas da física e da altura (sbFormas); as frutas são meias-cúpulas apoiadas no balcão
  const cupula = (f, mat) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.scale.set(f.a * S, f.c * S, f.b * S); m.position.set(f.dx * S, f.z * S, f.dy * S); g.add(m); return m;
  };
  const formas = sbFormas(o);
  if (o.forma === 'banana') {
    // pedaço de banana madura deitado, casca com pintas marrons
    cupula(formas[0], sbMat('#ffffff', { map: sbTex('#f3dc7e', [['#8a6424', 60, 2, 7], ['#e8c85e', 20, 10, 30]]) }));
  } else if (o.forma === 'uvas') {
    formas.forEach((f, i) => cupula(f, sbMat(['#5e2c68', '#6d3777', '#88a846'][i % 3], { roughness: 0.25 })));
  } else if (o.forma === 'pessego' || o.forma === 'laranja') {
    const tex = o.forma === 'pessego' ? sbTex('#f2a45c', [['#d8553a', 25, 20, 60], ['#7a4a22', 12, 3, 8]]) : sbTex('#ee8a26', [['#e6eddc', 18, 14, 34], ['#a9bf8e', 14, 10, 26], ['#f4a64a', 20, 4, 10]]);
    cupula(formas[0], sbMat('#ffffff', { map: tex, roughness: 0.7 }));
  } else if (o.forma === 'morango') {
    const f = formas[0];
    cupula(f, sbMat('#ffffff', { map: sbTex('#c81c32', [['#f2d27a', 70, 1.5, 3]]), roughness: 0.35 }));
    // o cálice: folhinhas verdes deitadas no balcão, em volta da base
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, fo = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), sbMat('#3e8a2e'));
      fo.scale.set(f.a * S * 0.35, 1.2, f.a * S * 0.14); fo.rotation.y = -a;
      fo.position.set(Math.cos(a) * f.a * S * 1.05, 0.8, Math.sin(a) * f.b * S * 1.05); g.add(fo);
    }
  } else if (o.forma === 'vinagre') {
    const f = formas[0], r = f.a * S, alt = 2 * f.b * S;
    const tampa = new THREE.Mesh(new THREE.CylinderGeometry(r, r, alt, 32, 1, true), sbMat('#d9dcd6', { metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }));
    tampa.position.y = alt / 2; g.add(tampa);
    // o vinagre enche a tampa até a borda (é nele que ela pisa, na física)
    const liquido = new THREE.Mesh(new THREE.CircleGeometry(r - 0.5, 32), sbMat('#c07a1c', { roughness: 0.1, transparent: true, opacity: 0.9 }));
    liquido.rotation.x = -Math.PI / 2; liquido.position.y = alt - 0.3; g.add(liquido);
  } else if (o.forma === 'placa') {
    // caça a bugs no mundo (caca-mundo.js): uma plaquinha com o ícone da família e o nome da ação (para quem assiste);
    // o que a mosca percebe dela é o cheiro (das características da ação), a forma e o brilho
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 332;
    const c2 = cv.getContext('2d'), fam = o.acao?.familia, ent = o.acao?.entrada;
    const CORES = { carrinho: '#2f6db5', estoque: '#8a5a2b', pagamento: '#2e8b57', cancelamento: '#b3261e', cupom: '#9b4dca' };
    const cf = CORES[fam] || '#3c4650';
    c2.fillStyle = '#fbf8f2'; c2.fillRect(0, 0, 512, 332);
    c2.fillStyle = cf; c2.fillRect(0, 0, 512, 22);
    c2.strokeStyle = '#b9ab95'; c2.lineWidth = 10; c2.strokeRect(5, 5, 502, 322);
    // ícone da família
    c2.save(); c2.translate(82, 130); c2.strokeStyle = cf; c2.fillStyle = cf; c2.lineWidth = 10; c2.lineJoin = 'round'; c2.lineCap = 'round';
    if (fam === 'carrinho') { c2.beginPath(); c2.moveTo(-50, -40); c2.lineTo(-34, -40); c2.lineTo(-18, 22); c2.lineTo(40, 22); c2.lineTo(50, -22); c2.lineTo(-26, -22); c2.stroke(); for (const x of [-10, 32]) { c2.beginPath(); c2.arc(x, 42, 9, 0, 7); c2.fill(); } }
    else if (fam === 'estoque') { c2.strokeRect(-44, -30, 88, 70); c2.beginPath(); c2.moveTo(-44, -30); c2.lineTo(-30, -50); c2.lineTo(30, -50); c2.lineTo(44, -30); c2.moveTo(-14, -30); c2.lineTo(-14, 0); c2.lineTo(14, 0); c2.lineTo(14, -30); c2.stroke(); }
    else if (fam === 'pagamento') { c2.strokeRect(-50, -34, 100, 68); c2.fillRect(-50, -18, 100, 14); c2.fillRect(-36, 14, 34, 8); }
    else if (fam === 'cancelamento') { c2.beginPath(); c2.arc(0, 0, 44, 0, 7); c2.stroke(); c2.beginPath(); c2.moveTo(-22, -22); c2.lineTo(22, 22); c2.moveTo(22, -22); c2.lineTo(-22, 22); c2.stroke(); }
    else if (fam === 'cupom') { c2.beginPath(); c2.moveTo(-50, -30); c2.lineTo(50, -30); c2.lineTo(50, -8); c2.arc(50, 0, 8, -Math.PI / 2, Math.PI / 2, true); c2.lineTo(50, 30); c2.lineTo(-50, 30); c2.lineTo(-50, 8); c2.arc(-50, 0, 8, Math.PI / 2, -Math.PI / 2, true); c2.closePath(); c2.stroke(); c2.font = '700 40px system-ui, sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText('%', 0, 2); }
    c2.restore();
    // a entrada (normal, zero, limite, negativa, repetida) numa etiqueta, e o nome da ação
    c2.font = '600 30px ui-monospace, Consolas, monospace'; c2.textBaseline = 'top';
    const tw = c2.measureText(ent || '').width + 24; c2.fillStyle = '#e6e2da'; c2.fillRect(166, 48, tw, 44); c2.fillStyle = '#3c4650'; c2.fillText(ent || '', 178, 55);
    c2.font = '600 40px system-ui, "Segoe UI", sans-serif'; c2.fillStyle = '#1c2127';
    let linha = '', ly = 110;
    for (const pal of o.r.split(' ')) { const t = linha ? linha + ' ' + pal : pal; if (c2.measureText(t).width > 320 && linha) { c2.fillText(linha, 166, ly); ly += 48; linha = pal; } else linha = t; }
    if (linha) c2.fillText(linha, 166, ly);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
    const lado = sbMat('#efe9df');
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, Hh, D), [lado, lado, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }), lado, lado, lado]);
    m.position.y = Hh / 2; g.add(m);
  } else if (/^plat-/.test(o.forma)) {
    // as plataformas da caça a bugs: objetos de cozinha (cilindros, a mesma forma da física e da altura em sbFormas)
    const r = W / 2, alt = o.h * S, k = o.forma.slice(5);
    const LOOK = {
      tabua: { lado: sbMat('#a9773f', { roughness: 0.8 }), topo: sbMat('#ffffff', { map: sbTex('#c9995e', [['#b9884f', 18, 10, 40]], 256, 256, 'rgba(120, 80, 40, 0.35)'), roughness: 0.75 }) },
      prato: { lado: sbMat('#f2efe8', { roughness: 0.25 }), topo: sbMat('#f7f5f0', { roughness: 0.2 }), aro: '#3d6fb0' },
      lata: { lado: sbMat('#ffffff', { map: sbTex('#d8dde2', [['#2e7d4f', 1, 120, 120]], 256, 64), metalness: 0.55, roughness: 0.3 }), topo: sbMat('#c7ccd1', { metalness: 0.7, roughness: 0.25 }), aro: '#9aa1a8' },
      tampa: { lado: sbMat('#c9a447', { metalness: 0.6, roughness: 0.3 }), topo: sbMat('#d6b356', { metalness: 0.55, roughness: 0.3 }), aro: '#a8862f' },
      cortica: { lado: sbMat('#a4733f', { roughness: 0.95 }), topo: sbMat('#ffffff', { map: sbTex('#c19260', [['#8d5f33', 120, 1, 3], ['#d2a676', 60, 2, 5]]), roughness: 0.95 }) },
    }[k] || { lado: sbMat('#cccccc'), topo: sbMat('#dddddd') };
    const cil = new THREE.Mesh(new THREE.CylinderGeometry(r, r, alt, 48, 1, false), [LOOK.lado, LOOK.topo, LOOK.lado]);
    cil.position.y = alt / 2; g.add(cil);
    if (LOOK.aro) { const aro = new THREE.Mesh(new THREE.TorusGeometry(r * 0.97, Math.max(0.6, r * 0.025), 8, 64), sbMat(LOOK.aro, { metalness: 0.4, roughness: 0.4 })); aro.rotation.x = Math.PI / 2; aro.position.y = alt; g.add(aro); }
  } else if (o.forma === 'pista') {
    const base=new THREE.Mesh(new THREE.CircleGeometry(W/2,32),sbMat('#eeeece'));
    base.rotation.x=-Math.PI/2;base.scale.y=D/W;base.position.y=.6;g.add(base);
  } else if (o.forma === 'acucar') {
    const base = new THREE.Mesh(new THREE.CircleGeometry(W / 2, 24), sbMat('#f7f5ee'));
    base.rotation.x = -Math.PI / 2; base.scale.y = D / W; base.position.y = 0.5; g.add(base);
    const cristais = new THREE.InstancedMesh(new THREE.BoxGeometry(3, 3, 3), sbMat('#ffffff', { roughness: 0.2 }), 90);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.cos(a) * r * W / 2, 1.5, Math.sin(a) * r * D / 2), q, new THREE.Vector3(1, 1, 1));
      cristais.setMatrixAt(i, m4);
    }
    g.add(cristais);
  } else if (o.forma === 'agua') {
    const mat = sbMat('#bfe3ff', { roughness: 0.05, transparent: true, opacity: 0.55 });
    esfera(D * 0.42, mat, -W * 0.22, 0, 0, 0.35); esfera(D * 0.3, mat, W * 0.28, 0, D * 0.1, 0.35);
  } else if (o.forma === 'folhas') {
    const mat = sbMat('#ffffff', { map: sbTex('#4c9a3f', [['#5fb04f', 10, 10, 30]], 128, 128, 'rgba(40, 90, 35, 0.6)') });
    for (const [x, z, r] of [[-W * 0.18, -D * 0.1, 0.5], [W * 0.2, D * 0.15, -0.7]]) { const f = esfera(W * 0.34, mat, x, 1.5, z, 0.08); f.scale.z = 0.55; f.rotation.y = r; }
  }
  return g;
}
// rótulos para quem assiste (os olhos dela não os veem)
function sbRotulo(texto) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = '600 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(texto).width + 40;
  g.fillStyle = 'rgba(255, 252, 245, 0.85)'; g.beginPath(); if (g.roundRect) g.roundRect(256 - w / 2, 12, w, 72, 30); else g.rect(256 - w / 2, 12, w, 72); g.fill();
  g.fillStyle = '#4a3a28'; g.fillText(texto, 256, 50);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(96, 18, 1);
  return sp;
}

// plataformas e elementos; refeitos quando o sistema muda
function sbSyncWorld() {
  const sig = SB.app + ':' + rects.map(r => r.id + (r.disabled ? 0 : 1)).join('|');
  if (sig === SBR.built) return;
  SBR.built = sig;
  for (const o of SBR.worldObjs || []) { SBR.scene.remove(o); o.traverse(c => { c.geometry?.dispose(); [].concat(c.material || []).forEach(m => { m.map?.dispose(); m.dispose(); }); }); }
  SBR.worldObjs = []; SBR.boxes.clear();
  const add = o => { SBR.scene.add(o); SBR.worldObjs.push(o); };
  sbTema(!!APP.mundo);
  if (APP.mundo) {
    SBR.rotulos = new THREE.Group(); add(SBR.rotulos);
    if (APP.bandeja) {
      const [x0, y0, x1, y1] = sbLim(), e = 3 * CORPO.S, h = 4 * CORPO.S, mat = sbMat('#9a6a3c', { roughness: 0.7 });
      const fundo = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), sbMat('#d9c7a4', { roughness: 0.85 }));
      fundo.rotation.x = -Math.PI / 2; const [fx, fz] = sbTo3((x0 + x1) / 2, (y0 + y1) / 2); fundo.position.set(fx, 0.3, fz); add(fundo);
      for (const [cx, cy, w, d] of [[(x0 + x1) / 2, y0 - e / 2, x1 - x0 + 2 * e, e], [(x0 + x1) / 2, y1 + e / 2, x1 - x0 + 2 * e, e], [x0 - e / 2, (y0 + y1) / 2, e, y1 - y0], [x1 + e / 2, (y0 + y1) / 2, e, y1 - y0]]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); const [x, z] = sbTo3(cx, cy); m.position.set(x, h / 2, z); add(m);
      }
    }
    for (const [id, o] of Object.entries(APP.objetos)) {
      const L = SB.layout[id];
      if (!L) continue;
      const [x, z] = sbTo3(L.x + L.w / 2, L.y + L.h / 2);
      const g = sbObjeto(o);
      g.position.set(x, (o.base || 0) * CORPO.S, z);
      add(g);
      // as plaquinhas da caça a bugs já trazem o nome escrito: sem o rótulo flutuante, que tapava a vista
      if (o.forma !== 'placa') { const rot = sbRotulo(o.r); rot.position.set(x, L.z + 55, z); SBR.rotulos.add(rot); }
      SBR.boxes.set(id, { mesh: g, natural: true, base: new THREE.Vector3(x, L.z, z), vazio: false });
    }
    return;
  }
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
    if (b.natural) {
      const vazio = !!(APP.objetos?.[id]?.porcoes && restoDe(id) <= 0);
      if (vazio !== b.vazio) { b.vazio = vazio; b.mesh.traverse(m => { if (m.material?.color) m.material.color.multiplyScalar(vazio ? 0.5 : 2); }); }
      continue;
    }
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
  const fisicoNoChao = SB.fisico && CORPO.malha && CORPO.pose && !f.flying && !f.presa;
  const animado = !fisicoNoChao && !!ANIM.poses && !!CORPO.malha;
  SBR.fly.visible = !fisicoNoChao && !animado;
  if (CORPO.malha) CORPO.malha.group.visible = !!(fisicoNoChao || animado);
  if (fisicoNoChao) corpoPose();
  else if (animado) animPose(f, dtw);
  if (APP.mundo && (fisicoNoChao || animado)) animBoca(f);
  if (APP.mundo && (fisicoNoChao || animado)) animLimpeza(f);
  animLimpezaSimples(f, APP.mundo && !fisicoNoChao && !animado);
  animBocaSimples(f, APP.mundo && !fisicoNoChao && !animado);
  if (!animado) for (const l of ANIM.leques) l.visible = false;
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
    const U = SBR.pred.userData;
    // patas da frente: dobradas (balançando de leve, como um graveto ao vento), no bote ou segurando
    let pf = 0.95 + 0.05 * Math.sin(now / 650), pt = -2.7;
    if (PRED.presa) { pf = 0.25; pt = -1.35; }
    else if (PRED.bote) { const u = PRED.bote.t / LOUVA.bote, e = Math.sin((u < 0.5 ? u * 2 : 2 - u * 2) * Math.PI / 2); pf = 0.95 - 1.05 * e; pt = -2.7 + 2.5 * e; }
    for (const b of U.bracos) { b.femur.rotation.x = pf; b.tibia.rotation.x = pt; }
    U.cabeca.position.z = U.cabeca0 - (PRED.presa ? 10 * PRED.presa.mordida : 0);
    U.pernas.forEach((q, i) => { q.rotation.y = q.userData.base + (PRED.andando ? 0.3 * Math.sin(PRED.passo * 0.09 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) : 0); });
    // alcance do bote no chão: verde quando ela está nele
    SBR.predAlcance.position.set(px, PRED.z + 0.8, pz);
    SBR.predAlcance.rotation.y = -PRED.th;
    SBR.predAlcance.userData.setor.material.color.set(PRED.presa ? '#ffcc33' : predNoAlcance(f) ? '#3dff7a' : '#ffffff');
    SBR.predAlcance.userData.setor.material.opacity = PRED.presa ? 0.08 : predNoAlcance(f) ? 0.4 : 0.16;
    SBR.predMarker.position.set(px, 905, pz); SBR.predMarker.rotation.z = PRED.th + Math.PI;
  }
  SBR.rainT += dtw;
  if (SBR.rainT > 0.07) { SBR.rainT = 0; SBR.rain.step(); }
  window.Colonia?.desenhar(running ? dtw : 0);
}

// o modelo do louva-a-deus (px; a frente é -z, 1 mm = 7 px): abdômen, tórax, protórax longo, cabeça triangular com
// olhos grandes, antenas, quatro pernas de andar e as duas patas raptoriais (fêmur com espinhos e tíbia), que dobram
function sbLouva() {
  const g = new THREE.Group();
  const verde = new THREE.MeshStandardMaterial({ color: '#7fb446', roughness: 0.55 });
  const claro = new THREE.MeshStandardMaterial({ color: '#b3d676', roughness: 0.6 });
  const olho = new THREE.MeshStandardMaterial({ color: '#d9eeb0', roughness: 0.25 });
  const escuro = new THREE.MeshBasicMaterial({ color: '#23300f' });
  // cilindro com a base na origem, crescendo em +y
  const cil = (r0, r1, len, mat) => { const geo = new THREE.CylinderGeometry(r1, r0, len, 10); geo.translate(0, len / 2, 0); return new THREE.Mesh(geo, mat); };
  const abd = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 12), verde); abd.scale.set(0.95, 0.8, 3.1); abd.position.set(0, 13, 25); abd.rotation.x = -0.2; g.add(abd);
  const tor = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), verde); tor.scale.set(1, 0.9, 1.8); tor.position.set(0, 14, 0); g.add(tor);
  const pro = cil(3.6, 2.8, 40, claro); pro.position.set(0, 14, -6); pro.rotation.x = -Math.PI / 2 + 0.35; g.add(pro);
  // cabeça (grupo, para avançar na mordida)
  const cab = new THREE.Group(); cab.position.set(0, LOUVA.alturaCabeca, -LOUVA.cabeca);
  const face = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12), verde); face.scale.set(1.7, 1, 0.9); cab.add(face);
  const boca = new THREE.Mesh(new THREE.ConeGeometry(2.4, 5, 8), claro); boca.rotation.x = Math.PI; boca.position.set(0, -4, -1); cab.add(boca);
  for (const lado of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 10), olho); o.position.set(lado * 7.5, 2, 0.5); cab.add(o);
    const pu = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), escuro); pu.position.set(lado * 8.2, 2.3, -2.6); cab.add(pu);
    const ant = cil(0.35, 0.25, 26, escuro); ant.position.set(lado * 2, 3, -2); ant.rotation.set(-1.0, 0, lado * -0.35); cab.add(ant);
  }
  g.add(cab);
  // patas raptoriais: coxa no protórax, fêmur com espinhos, tíbia dobrada
  const bracos = [];
  for (const lado of [-1, 1]) {
    const base = new THREE.Group(); base.position.set(lado * 3.5, 24, -34);
    const coxa = cil(1.8, 1.5, 9, claro); coxa.rotation.x = Math.PI - 0.3; base.add(coxa);
    const femur = new THREE.Group(); femur.position.set(0, -8.5, -2.5); base.add(femur);
    const fm = cil(2.4, 1.8, 26, verde); fm.rotation.x = -Math.PI / 2; femur.add(fm);
    for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 5), escuro); e.position.set(0, -2.2, -6 - i * 5); e.rotation.x = Math.PI; femur.add(e); }
    const tibia = new THREE.Group(); tibia.position.set(0, 0, -26); femur.add(tibia);
    const tb = cil(1.5, 1.0, 20, verde); tb.rotation.x = -Math.PI / 2; tibia.add(tb);
    const garra = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.5, 6), escuro); garra.rotation.x = -Math.PI / 2; garra.position.set(0, 0, -21); tibia.add(garra);
    g.add(base);
    bracos.push({ femur, tibia });
  }
  // quatro pernas de andar
  const pernas = [];
  for (const [z, lado] of [[-2, -1], [-2, 1], [9, -1], [9, 1]]) {
    const q = new THREE.Group(); q.position.set(lado * 3, 13, z);
    const sup = cil(0.9, 0.7, 20, verde); sup.rotation.z = lado * -1.15; q.add(sup);
    const inf = cil(0.7, 0.45, 20, verde); inf.position.set(lado * 18, 8, 0); inf.rotation.z = lado * 2.55; q.add(inf);
    q.userData.base = lado * (z < 0 ? -0.35 : 0.35);
    q.rotation.y = q.userData.base;
    g.add(q); pernas.push(q);
  }
  g.userData = { bracos, pernas, cabeca: cab, cabeca0: cab.position.z };
  return g;
}

// painel de quem joga com o louva-a-deus: o quanto ela te vê, o alcance, o aperto
function predHud(f) {
  const barra = (v, cor) => `<span class="ph-bar"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%;background:${cor}"></i></span>`;
  let html;
  if (PRED.presa) {
    const P = PRED.presa;
    html = `<b>Segurando a mosca</b><span>aperto ${barra(P.aperto, '#ffcc33')}</span><span>até a boca ${barra(P.p, '#ff6b5a')}</span>
      <small>Espaço: apertar · R: soltar. Cada rajada da fibra gigante dela é um tranco.</small>`;
  } else {
    const alerta = PRED.alerta, viu = alerta > 0.35;
    html = `<b>Louva-a-deus</b><span>ela te vê crescer ${barra(alerta, viu ? '#ff4d4d' : '#9fd36a')}</span>
      <span>${PRED.noPontoCego ? 'você está no ponto cego dela' : viu ? 'ela está te vendo chegar!' : 'ela não te vê como ameaça'}</span>
      <span>bote: ${PRED.cdBote > 0 ? 'recarregando' : predNoAlcance(f) ? '<b class="ph-ok">no alcance</b>' : 'fora do alcance'}</span>`;
  }
  const el = $('#predHud');
  if (el.innerHTML !== html) el.innerHTML = html;
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
  SBR.rain.mesh.visible = !SBR.temaNatural; SBR.marker.visible = false; SBR.predMarker.visible = false; SBR.scene.fog = fog;
}

function sbFrame(dtw) {
  if (!SBR.r || !fly) return;
  const canvas = SBR.r.domElement, w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const pr = SBR.r.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) SBR.r.setSize(w, h, false);
  const now = performance.now();
  sbUpdate(dtw, now);
  if (OLHO.mapa && !window.Colonia?.ativa && (OLHO.conta++ & 1) === 0) olhoAmostrar(fly);
  const f = fly, R = SBR.r;
  R.setScissorTest(true);
  R.setViewport(0, 0, w, h); R.setScissor(0, 0, w, h);
  R.setClearColor(SBR.bg, 1); R.clear();
  const [eL, eR] = f.eyes || [0, 0];
  const mm = v => (v / CORPO.S).toFixed(0);
  const estado = (f.flying ? `voando · ${Math.round(f.z)} px de altura` : f.naParede ? 'subindo' : f.limpeza?.ativa ? LimpezaMosca.nomes[f.limpeza.etapa] : f.z > 3 ? (APP.mundo ? `em cima, a ${mm(f.z)} mm do balcão` : `andando numa plataforma a ${Math.round(f.z)} px`) : APP.mundo ? 'no balcão' : 'andando no chão')
    + (SB.fisico && CORPO.ritmo < 0.97 ? ` · câmera lenta ${CORPO.ritmo.toFixed(1).replace('.', ',')}×` : '');
  if (SBR.mode === 'dupla' && window.Colonia?.pronta) {
    const b=Colonia.segundo.fly;
    const centro=new THREE.Vector3((f.x+b.x)/2-SB.W/2,(f.z+b.z)/2+6,(f.y+b.y)/2-SB.H/2);
    const distancia=Math.hypot(f.x-b.x,f.y-b.y,(f.z||0)-(b.z||0));
    const recuo=Math.max(65,(distancia+35)/Math.max(.3,Math.min(1,w/h)));
    SBR.cam.position.copy(centro).add(new THREE.Vector3(0,recuo*.85,recuo));
    SBR.cam.position.y=Math.max(SBR.cam.position.y,sbSurface(centro.x+SB.W/2,centro.z+recuo+SB.H/2)+25);
    SBR.cam.near=.2;SBR.cam.aspect=w/h;SBR.cam.updateProjectionMatrix();SBR.cam.lookAt(centro);
    R.render(SBR.scene,SBR.cam);
    $('#sbCap').textContent='Duas moscas • azul: 1 • laranja: 2 • posição e memória próprias';
    SBR.camReady=false;
  } else if (SBR.mode === 'spec' || SBR.mode === 'olhos' || SBR.mode === 'pred' || SBR.mode === 'fantasma') {
    if (SBR.mode === 'fantasma') {
      fantMover(dtw);
      const cp = Math.cos(FANT.pitch);
      SBR.cam.position.set(FANT.x, FANT.y, FANT.z);
      SBR.cam.near = 0.2; SBR.cam.aspect = w / h; SBR.cam.updateProjectionMatrix();
      SBR.cam.lookAt(FANT.x + Math.sin(FANT.yaw) * cp, FANT.y + Math.sin(FANT.pitch), FANT.z - Math.cos(FANT.yaw) * cp);
      R.render(SBR.scene, SBR.cam);
      const s = Math.round(Math.min(w * 0.17, h * 0.22));
      sbRenderEye(0, w - 2 * s - 14, h - s - 30, s, s);
      sbRenderEye(1, w - s - 8, h - s - 30, s, s);
      const m = Math.round(Math.min(w * 0.22, h * 0.26));
      sbRenderMap(w - m - 8, 44, m, m);
    } else if (SBR.mode === 'spec' || SBR.mode === 'pred') {
      // espectador: atrás e acima dela (ou da Sentinela), seguindo com atraso
      const P = SBR.mode === 'pred' && PRED.on ? { x: PRED.x, y: PRED.y, z: PRED.z + 10, th: PRED.th, flying: true } : f;
      // a câmera segue um alvo suavizado: no corpo físico o rumo balança 10-20° a cada passo e a posição chega aos
      // saltos (a cada 40 ms); ela acompanha a média do movimento, não o balanço
      const [px, pz] = sbTo3(P.x, P.y);
      if (!SBR.camReady) { SBR.camX = px; SBR.camZ = pz; SBR.camY = P.z; SBR.camTh = P.th; }
      const k = tau => 1 - Math.exp(-dtw / tau);
      // em voo o movimento é liso e rápido (~900 px/s): a câmera segue de perto, sem atraso
      const tp = P.flying ? 0.05 : 0.3;
      SBR.camX += (px - SBR.camX) * k(tp); SBR.camZ += (pz - SBR.camZ) * k(tp); SBR.camY += (P.z - SBR.camY) * k(P.flying ? 0.08 : 0.4);
      SBR.camTh += Math.atan2(Math.sin(P.th - SBR.camTh), Math.cos(P.th - SBR.camTh)) * k(SB.fisico && !P.flying ? 1.2 : 0.4);
      const x = SBR.camX, z = SBR.camZ, th = SBR.camTh, pzAlt = SBR.camY;
      // com o corpo real (tamanho verdadeiro, ~18 px), a câmera chega mais perto
      const perto = SBR.mode !== 'pred' && ANIM.poses ? 0.36 : 1;
      const back = (SBR.mode === 'pred' ? 130 : P.flying ? 190 : 170) * perto, up = (SBR.mode === 'pred' ? 55 : P.flying ? 70 : 95) * perto;
      const cx = x - Math.sin(th) * back, cz = z + Math.cos(th) * back;
      // a câmera nunca fica dentro de uma plataforma
      const want = new THREE.Vector3(cx, Math.max(pzAlt + up, sbSurface(cx + SB.W / 2, cz + SB.H / 2) + 55), cz);
      SBR.cam.position.lerp(want, SBR.camReady ? 1 - Math.exp(-dtw / (P.flying ? 0.12 : 0.4)) : 1);
      SBR.camReady = true;
      SBR.cam.near = 1; SBR.cam.aspect = w / h; SBR.cam.updateProjectionMatrix();
      SBR.cam.lookAt(x + Math.sin(th) * 70, pzAlt + 10, z - Math.cos(th) * 70);
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
    const placar = PRED.on ? ` · louva-a-deus: ${PRED.captures} ${PRED.captures === 1 ? 'mosca comida' : 'moscas comidas'}, ${PRED.escapes} fugas, ${PRED.botes} botes` : '';
    if (PRED.on) predHud(f);
    const fant = SBR.mode === 'fantasma' ? `fantasma · ${(FANT.vel / CORPO.S).toFixed(0)} mm/s · ` : '';
    const legenda = SBR.mode === 'olhos' && OLHO.mapa ? '<span>cores que ela capta (sem vermelho) · vermelho: onde o LC10a responde</span>' : '';
    $('#sbCap').innerHTML = `<span>${fant}${estado}${placar}</span>${legenda}<span><b class="ev-l">olho E</b> ${Math.round(eL * 100)}% · <b class="ev-r">olho D</b> ${Math.round(eR * 100)}%</span>`;
  } else {
    sbRenderMap(0, 0, w, h);
    $('#sbCap').innerHTML = `<span>de cima · ${estado}</span><span>leques: o campo de cada olho</span>`;
  }
  R.setScissorTest(false);
}

// sem janela, só com ?headless=1&olhosHeadless=1 (as medidas da caça a bugs no mundo, scripts/qa_mundo.mjs): atualiza
// o mundo e amostra os olhos dela, sem desenhar a câmera de quem assiste. Os olhos são o que entra no LC10a
function sbFrameOlhos(dtw) {
  if (!SBR.r || !fly) return;
  sbUpdate(dtw, performance.now());
  if (OLHO.mapa && !window.Colonia?.ativa && (OLHO.conta++ & 1) === 0) olhoAmostrar(fly);
}

/* ───────────── fantasma: câmera livre, como o espectador livre de um jogo de tiro ───────────── */
// W/S vai para onde a câmera olha, A/D para os lados, Espaço ou E sobe, C ou Q desce, Shift acelera, a roda do mouse
// muda a velocidade, F vai para perto dela. O mouse olha: clique na cena para prender o mouse (Esc solta) ou arraste.
// Atravessa tudo e não mexe na mosca nem no que os olhos dela veem
const FANT = { x: 0, y: 60, z: 0, yaw: 0, pitch: -0.3, vel: 35, teclas: new Set(), arrasta: null };
const FANT_TECLAS = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
function fantDaCamera() {
  const c = SBR.cam, d = new THREE.Vector3();
  c.getWorldDirection(d);
  Object.assign(FANT, { x: c.position.x, y: c.position.y, z: c.position.z, yaw: Math.atan2(d.x, -d.z), pitch: Math.asin(clamp(d.y, -1, 1)) });
}
function fantPerto() {
  // atrás dela e um pouco acima, olhando para ela (o corpo real tem ~18 px)
  const [x, z] = sbTo3(fly.x, fly.y), d = 45;
  Object.assign(FANT, { x: x - Math.sin(fly.th) * d, y: (fly.z || 0) + 20, z: z + Math.cos(fly.th) * d, yaw: fly.th, pitch: -0.4 });
}
function fantMover(dt) {
  const k = FANT.teclas, t = c => k.has(c);
  const v = FANT.vel * (t('ShiftLeft') || t('ShiftRight') ? 4 : 1) * Math.min(dt, 0.1);
  const cp = Math.cos(FANT.pitch), fx = Math.sin(FANT.yaw) * cp, fy = Math.sin(FANT.pitch), fz = -Math.cos(FANT.yaw) * cp;
  const dx = Math.cos(FANT.yaw), dz = Math.sin(FANT.yaw);   // para a direita
  let mx = 0, my = 0, mz = 0;
  if (t('KeyW')) { mx += fx; my += fy; mz += fz; }
  if (t('KeyS')) { mx -= fx; my -= fy; mz -= fz; }
  if (t('KeyD')) { mx += dx; mz += dz; }
  if (t('KeyA')) { mx -= dx; mz -= dz; }
  if (t('Space') || t('KeyE')) my += 1;
  if (t('KeyC') || t('KeyQ')) my -= 1;
  const n = Math.hypot(mx, my, mz);
  if (n) { FANT.x += mx / n * v; FANT.y += my / n * v; FANT.z += mz / n * v; }
  FANT.x = clamp(FANT.x, -SB.W, SB.W); FANT.z = clamp(FANT.z, -SB.H, SB.H); FANT.y = clamp(FANT.y, 0.5, 3000);
}
{
  const cv = document.getElementById('world');
  cv.addEventListener('mousedown', e => {
    if (!SB.on || SBR.mode !== 'fantasma') return;
    FANT.arrasta = { x: e.clientX, y: e.clientY };
    try { const p = cv.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch { /* sem prender: arrastar funciona */ }
  });
  addEventListener('mouseup', () => { FANT.arrasta = null; });
  addEventListener('mousemove', e => {
    if (!SB.on || SBR.mode !== 'fantasma') return;
    let mx, my;
    if (document.pointerLockElement === cv) { mx = e.movementX; my = e.movementY; }
    else if (FANT.arrasta) { mx = e.clientX - FANT.arrasta.x; my = e.clientY - FANT.arrasta.y; FANT.arrasta = { x: e.clientX, y: e.clientY }; }
    else return;
    FANT.yaw += mx * 0.0025;
    FANT.pitch = clamp(FANT.pitch - my * 0.0025, -1.55, 1.55);
  });
  cv.addEventListener('wheel', e => {
    if (!SB.on || SBR.mode !== 'fantasma') return;
    e.preventDefault();
    FANT.vel = clamp(FANT.vel * (e.deltaY < 0 ? 1.25 : 0.8), 3, 3000);
  }, { passive: false });
  addEventListener('keydown', e => {
    if (!SB.on || SBR.mode !== 'fantasma' || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return;
    if (e.code === 'KeyF') { fantPerto(); return; }
    const c = FANT_TECLAS[e.code] || e.code;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyC', 'Space', 'ShiftLeft', 'ShiftRight'].includes(c)) {
      FANT.teclas.add(c);
      e.preventDefault();
    }
  });
  addEventListener('keyup', e => FANT.teclas.delete(FANT_TECLAS[e.code] || e.code));
  addEventListener('blur', () => FANT.teclas.clear());
}

/* ───────────── tamanho da tela do sandbox ───────────── */
// Ampliar: o sandbox ocupa a largura toda (o cérebro vai para baixo). Tela cheia: só o sandbox, na tela inteira
function sbAmpliar(on) {
  document.body.classList.toggle('sb-grande', on);
  $('#sbAmpliar').classList.toggle('on', on);
  $('#sbAmpliar').textContent = on ? 'Lado a lado' : 'Ampliar';
  try { localStorage.setItem('mosca-sb-grande', on ? '1' : '0'); } catch { /* sem armazenamento */ }
  measure();
  dispatchEvent(new Event('resize'));
}
$('#sbAmpliar').addEventListener('click', () => sbAmpliar(!document.body.classList.contains('sb-grande')));
$('#sbCheia').addEventListener('click', () => {
  const box = $('#worldBox');
  if (document.fullscreenElement) document.exitFullscreen?.();
  else box.requestFullscreen?.().catch(() => sbAmpliar(true));
});
document.addEventListener('fullscreenchange', () => { $('#sbCheia').classList.toggle('on', !!document.fullscreenElement); });
try { if (localStorage.getItem('mosca-sb-grande') === '1') sbAmpliar(true); } catch { /* sem armazenamento */ }

/* ───────────── ligar e desligar ───────────── */
function sbSet(on) {
  if (on === SB.on) return;
  if(!on)window.Treino?.sair();
  window.Colonia?.desligar();
  if (on && !SBR.r) {
    try { sbInitRender(); } catch (e) { console.error(e); logEvent('Não deu para abrir o sandbox 3D neste navegador.'); return; }
  }
  if (!on && PRED.on) predSet(false);
  if (!on && SB.fisico) corpoSet(false);
  if (on) corpoPing();
  SB.on = on;
  if (on) { olhoCarregar(); animCarregar(); }
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
  if (m === 'fantasma' && SBR.mode !== 'fantasma') {
    if ((SBR.mode === 'spec' || SBR.mode === 'pred') && SBR.camReady) fantDaCamera(); else fantPerto();
  }
  if (m !== 'fantasma' && document.pointerLockElement) document.exitPointerLock();
  FANT.teclas.clear();
  $('#fantHelp').hidden = m !== 'fantasma';
  $('#predHelp').hidden = !PRED.on || m === 'fantasma';
  SBR.mode = m; SBR.camReady = false;
  for (const o of document.querySelectorAll('#sbModes button[data-mode]')) o.classList.toggle('on', o.dataset.mode === m);
}
for (const b of document.querySelectorAll('#sbModes button[data-mode]')) b.addEventListener('click', () => sbCamMode(b.dataset.mode));
$('#predBtn').addEventListener('click', () => { if (SB.on) predSet(!PRED.on); });
$('#corpoBtn').addEventListener('click', () => { if (SB.on) corpoSet(!SB.fisico); });
