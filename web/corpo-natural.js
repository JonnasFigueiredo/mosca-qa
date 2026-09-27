// Regras do corpo na sandbox. Não mudam o conectoma nem simulam músculos.
// Distâncias em mm, tempo em segundos de cérebro. Geometria de referência da NeuroMechFly.
const CorpoNatural = (() => {
  const escala = 7, altura = 1.2797;
  const antenas = [[0.50143, 0.14209, -0.05021], [0.50143, -0.14209, -0.05021]];
  const raizBoca = [0.4587, 0, -0.2733], dobraBoca = [0.0877, 0, -0.2929], pontaBoca = [0.4, 0, -0.45];
  const mistura = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // Pose física quando disponível; caso contrário, tórax ereto na altura da pose de pé.
  function ponto(f, p, pose = null) {
    const F = pose?.frente || [Math.sin(f.th), Math.cos(f.th), 0];
    const B = pose?.costas || [0, 0, 1];
    const L = [B[1]*F[2]-B[2]*F[1], B[2]*F[0]-B[0]*F[2], B[0]*F[1]-B[1]*F[0]];
    const o = pose?.torax || [f.x/escala, -f.y/escala, (f.z || 0)/escala + altura];
    const v = o.map((x, i) => escala * (x + F[i]*p[0] + L[i]*p[1] + B[i]*p[2]));
    return {x:v[0], y:-v[1], z:v[2]};
  }
  function contato(p, objetos, tolerancia = 0.25) {
    // Contato com o topo plano usado pela colisão atual; sem margem lateral que atravesse bordas.
    return objetos.find(r => !r.disabled && p.x >= r.x && p.x <= r.x+r.w && p.y >= r.y && p.y <= r.y+r.h && Math.abs(p.z-(r.z || 0)) <= tolerancia*escala) || null;
  }
  function impedida(f) {
    return !!(f.flying || f.jumping || f.presa || f.naParede || f.back > 0 || f.threat > 0 || f.loom > 30 || f.alarmeCorpo);
  }
  // Inércia da boca: estende quando a saída da probóscide passa de 25 Hz e só recolhe abaixo de 12 Hz. Sem isso,
  // com a saída adaptada perto do limiar, a boca abria e fechava pela metade a cada 100 ms. Regra do corpo.
  const PROB_ESTENDE = 25, PROB_SOLTA = 12;
  function boca(f, dt, tocando) {
    const quer = !impedida(f) && tocando && f.prob > (f.bocaQuer ? PROB_SOLTA : PROB_ESTENDE);
    f.bocaQuer = quer;
    f.boca = (f.boca || 0) + ((quer ? 1 : 0) - (f.boca || 0)) * (1-Math.exp(-dt/(quer ? 0.08 : 0.045)));
    if (impedida(f)) f.boca = 0; // fuga/captura interrompem o contato no mesmo passo
    return quer;
  }
  function bocaPontos(f, pose = null) {
    const e = f.boca || 0;
    // Extensão geométrica de duas peças: alcance e trajetória são aproximações, não articulações simuladas.
    const a = ponto(f, raizBoca, pose);
    const alvo = ponto(f, [0.75, 0, -altura], pose);
    const piso = f.pisoBoca ?? f.z ?? 0;
    // No corpo físico, usa a altura real do tórax, mas só alcança até 1,15 mm da raiz.
    alvo.z = piso;
    const alcance = Math.hypot(alvo.x-a.x, alvo.y-a.y, alvo.z-a.z)/escala;
    const fim = Object.fromEntries(['x','y','z'].map(k => [k, a[k]+(alvo[k]-a[k])*Math.min(1,1.15/Math.max(alcance,0.001))]));
    const repouso = ponto(f, pontaBoca, pose), dobra = ponto(f, dobraBoca, pose);
    const ponta = Object.fromEntries(['x','y','z'].map(k => [k, repouso[k]+(fim[k]-repouso[k])*e]));
    const meio = Object.fromEntries(['x','y','z'].map(k => [k, dobra[k]+((a[k]+fim[k])*0.5-dobra[k])*e]));
    return {raiz:a, meio, ponta, alcanca:alcance <= 1.15};
  }
  function marcha(f, dt, provando, aleatorio = Math.random) {
    let estado = f.marcha || 'andar';
    f.marchaT = (f.marchaT ?? (0.8+2.4*aleatorio())) - dt;
    if (impedida(f) || f.aversion > 0.3) { estado = 'andar'; f.marchaT = 0.5; }
    else if (provando) { estado = 'provar'; f.marchaT = 0.3; }
    else if (estado === 'provar') { estado = 'pausa'; f.marchaT = 0.2; }
    else if (f.marchaT <= 0) {
      if (estado === 'andar') { estado = aleatorio() < 0.45 ? 'girar' : 'pausa'; f.marchaT = 0.15+0.5*aleatorio(); }
      else { estado = 'andar'; f.marchaT = 0.8+2.4*aleatorio(); }
    }
    f.marcha = estado;
    return {andar:estado === 'andar' ? 1 : 0, girar:estado === 'andar' || estado === 'girar' ? 1 : 0};
  }
  return {escala, altura, antenas, raizBoca, dobraBoca, pontaBoca, mistura, ponto, contato, impedida, boca, bocaPontos, marcha};
})();
