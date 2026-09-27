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
  function contato(p, objetos, tolerancia = 0.25, alturaDe = null) {
    // Contato com a superfície do objeto: o topo plano da plataforma ou, com alturaDe (a forma redonda do mundo
    // natural), a altura da forma naquele ponto; sem margem lateral que atravesse bordas.
    return objetos.find(r => {
      if (r.disabled || p.x < r.x || p.x > r.x+r.w || p.y < r.y || p.y > r.y+r.h) return false;
      const zt = alturaDe ? alturaDe(r, p.x, p.y) : (r.z || 0);
      // a pata encosta se está até `tolerancia` acima da superfície, ou até 1 mm para dentro dela: numa encosta, o corpo
      // simples fica reto e a pata do lado de cima "entra" na fruta; a de verdade se apoia nela
      return zt > -Infinity && p.z-zt <= tolerancia*escala && zt-p.z <= escala;
    }) || null;
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
  // Durações sorteadas como nas moscas reais (Valente et al. 2007, arena aberta): trechos andando com distribuição
  // exponencial (média ~1,4-2,1 s) e paradas quase sempre curtas (~76% abaixo de 0,3 s), com algumas longas (> 5 s).
  // Depois de parar, na maioria das vezes elas seguem na mesma direção: girar no lugar é a exceção
  const expo = (media, u) => -media * Math.log(1 - Math.min(u, 0.999));
  const ANDAR_S = 1.7, PARADA_CURTA_S = 0.15, PARADA_LONGA_S = 2.5, FRAC_LONGA = 0.25, FRAC_GIRAR = 0.2;
  function marcha(f, dt, provando, aleatorio = Math.random) {
    let estado = f.marcha || 'andar';
    f.marchaT = (f.marchaT ?? expo(ANDAR_S, aleatorio())) - dt;
    // ameaça, fuga, ré, escalada e aversão forte têm prioridade (andando, sem pausa)
    if (impedida(f) || f.aversion > 0.6) { estado = 'andar'; f.marchaT = 0.5; }
    else if (provando) { estado = 'provar'; f.marchaT = 0.3; }
    else if (estado === 'provar') { estado = 'pausa'; f.marchaT = 0.2; }
    else if (f.marchaT <= 0) {
      if (estado === 'andar') {
        if (aleatorio() < FRAC_GIRAR) { estado = 'girar'; f.marchaT = 0.1 + 0.2 * aleatorio(); }
        else { estado = 'pausa'; f.marchaT = aleatorio() < FRAC_LONGA ? expo(PARADA_LONGA_S, aleatorio()) : expo(PARADA_CURTA_S, aleatorio()); }
      }
      else { estado = 'andar'; f.marchaT = expo(ANDAR_S, aleatorio()); }
    }
    f.marcha = estado;
    return {andar:estado === 'andar' ? 1 : 0, girar:estado === 'andar' || estado === 'girar' ? 1 : 0};
  }
  // Busca pelo cheiro ao longo do tempo (docs/plano-busca-cheiro.md). Regra do corpo, com base em comportamento medido:
  // moscas andando aceleram enquanto sentem o cheiro e, ao perdê-lo, desaceleram e viram mais (Álvarez-Salvado et al.
  // 2018); param menos com o cheiro presente (Demir et al. 2020); as viradas respondem à perda, não ao tempo dentro
  // (Jayaram et al. 2023). Sem vento, não há a orientação contra o vento. c = cheiro bom em cada antena (antes da fome)
  // (v2: com queda de 15%/s e giros repetidos a cada 0,4-0,8 s ela rodopiava: 27% do tempo 'perdeu', 0 de 8 chegadas na
  // sonda; agora uma perda dá um giro, e outro só se o cheiro continuar caindo depois dele)
  // (v3: na Cozinha o cheiro bom está em toda parte, e só "estar dentro" a fazia nunca parar: 2,6% do tempo parada.
  // O efeito de acelerar, andar reto e não parar vale só com o cheiro subindo, o equivalente a um encontro com o cheiro)
  const BUSCA = { LIMIAR: 0.2, TAU_C: 0.2, TAU_D: 0.3, QUEDA: -0.3, SUBIDA: 0.1, PERDEU_S: 1, FORA_S: 3,
    VEL_DENTRO: 1.3, VEL_PERDEU: 0.6, RUIDO_DENTRO: 0.3, GIRO_MIN: 0.8, GIRO_MAX: 2.1, GIRO_T_MIN: 0.4, GIRO_T_MAX: 0.8, LADO_MIN: 0.02 };
  function buscaCheiro(e, dt, cL, cR, aleatorio = Math.random) {
    const c = (cL + cR) / 2, k = x => 1 - Math.exp(-dt / x);
    const antes = e.c ?? c;
    e.c = antes + (c - antes) * k(BUSCA.TAU_C);
    e.dc = (e.dc ?? 0) + ((e.c - antes) / Math.max(dt, 1e-6) - (e.dc ?? 0)) * k(BUSCA.TAU_D);
    const relativa = e.dc / Math.max(e.c, BUSCA.LIMIAR);   // queda relativa por segundo
    e.modo = e.modo || 'fora'; e.t = (e.t || 0) + dt;
    const muda = m => { e.modo = m; e.t = 0; e.giroT = 0; e.girou = false; };
    if (e.modo === 'fora' && e.c >= BUSCA.LIMIAR && relativa >= BUSCA.QUEDA) muda('dentro');
    else if (e.modo === 'dentro' && (e.c < BUSCA.LIMIAR || relativa < BUSCA.QUEDA)) muda('perdeu');
    else if (e.modo === 'perdeu' && e.t > BUSCA.PERDEU_S) muda(e.c >= BUSCA.LIMIAR && relativa >= 0 ? 'dentro' : 'fora');
    if (e.modo === 'dentro') return relativa > BUSCA.SUBIDA ? { modo: 'dentro', velocidade: BUSCA.VEL_DENTRO, semPausa: true, ruido: BUSCA.RUIDO_DENTRO, giro: 0 }
      : { modo: 'dentro', velocidade: 1, semPausa: false, ruido: 1, giro: 0 };
    if (e.modo === 'perdeu') {
      let giro = 0;
      e.giroT = (e.giroT ?? 0) - dt;
      if (e.giroT <= 0 && (!e.girou || relativa < BUSCA.QUEDA)) {
        // para o lado da antena com mais cheiro, se a diferença for mensurável; senão, sorteado (negativo = esquerda)
        const dif = (cL - cR) / Math.max(c, BUSCA.LIMIAR);
        const lado = Math.abs(dif) > BUSCA.LADO_MIN ? -Math.sign(dif) : (aleatorio() < 0.5 ? -1 : 1);
        giro = lado * (BUSCA.GIRO_MIN + (BUSCA.GIRO_MAX - BUSCA.GIRO_MIN) * aleatorio());
        e.giroT = BUSCA.GIRO_T_MIN + (BUSCA.GIRO_T_MAX - BUSCA.GIRO_T_MIN) * aleatorio(); e.girou = true;
      }
      return { modo: 'perdeu', velocidade: BUSCA.VEL_PERDEU, semPausa: true, ruido: 1, giro };
    }
    return { modo: 'fora', velocidade: 1, semPausa: false, ruido: 1, giro: 0 };
  }
  return {escala, altura, antenas, raizBoca, dobraBoca, pontaBoca, mistura, ponto, contato, impedida, boca, bocaPontos, marcha, buscaCheiro, BUSCA};
})();
