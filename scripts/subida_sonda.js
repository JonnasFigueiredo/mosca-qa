// Ensaio dirigido da subida física; não altera decisões nem parâmetros do cérebro.
(async () => {
  if (!SB.fisico) throw new Error('a sonda de subida exige --fisico');
  const resultados = [];
  for (const id of ['k-banana', 'k-pessego', 'k-uvas']) {
    const r = rects.find(q => q.id === id);
    Object.assign(fly, { x: r.x + r.w / 2, y: r.y + r.h + 20, z: 0, th: 0,
      flying: false, naParede: null, presa: false, back: 0, startle: 0, hunger: 0.5, voarCd: 5 });
    CORPO.piso = 0; CORPO.ult = null; CORPO.zHist = []; CORPO.parada = 0; CORPO.semApoio = 0;
    await corpoTeleporte(fly);
    LAB.events = [];
    const ini = brainClock, amostras = [], limite = performance.now() + 180000;
    let ant = -1;
    while (brainClock - ini < 12000) {
      if (performance.now() > limite) throw new Error('subida não avançou em 180 s');
      await waitBrain(20);
      const p = CORPO.pose;
      if (!p || p.t === ant) continue;
      ant = p.t;
      amostras.push({ t: p.t, torax: p.torax, frente: p.frente, costas: p.costas,
        apoio: Object.values(p.toque || {}).reduce((a, b) => a + b, 0),
        parede: !!fly.naParede, forma: !!p.na_forma, voo: !!fly.flying,
        sinal: corpoSinal(fly), piso: sbSurface(fly.x, fly.y) / 7 });
    }
    let alternancias = 0, quedaMax = 0, saltosSinal = 0;
    for (let i = 1; i < amostras.length; i++) {
      const a = amostras[i - 1], b = amostras[i];
      if (a.parede !== b.parede) alternancias++;
      saltosSinal = Math.max(saltosSinal, Math.abs(b.sinal[0] - a.sinal[0]), Math.abs(b.sinal[1] - a.sinal[1]));
      if (!a.voo && !b.voo) quedaMax = Math.max(quedaMax, a.torax[2] - b.torax[2]);
    }
    resultados.push({ objeto: id, alternancias_parede: alternancias, salto_maximo_sinal: saltosSinal,
      queda_entre_poses_mm: quedaMax, altura_maxima_torax_mm: Math.max(...amostras.map(p => p.torax[2])),
      eventos: LAB.events.reduce((a, e) => (a[e.type] = (a[e.type] || 0) + 1, a), {}), amostras });
  }
  return { metodo: 'Três largadas diante de banana, pêssego e uvas; 12 s cerebrais cada; corpo físico, decisões livres e olhos reais. Mesmo cérebro entre casos. Pose recebida deduplicada por tempo físico; queda entre poses não distingue descida intencional de perda de apoio. Métricas gerais de andar incluem teleportes e não devem ser usadas.', resultados };
})()
