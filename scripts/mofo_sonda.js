// Sonda local executada por andar_medida.mjs --sonda-mofo --segundos 0.
// Três largadas dirigidas à laranja; 12 s cerebrais cada, sem decolagem espontânea.
// Usa a posição do objeto apenas para montar e medir o ensaio, nunca para comandar a fuga.
// O cérebro não é reiniciado entre largadas: não são réplicas independentes.
(async () => {
  const r = rects.find(q => q.id === 'k-laranja'), resultados = [];
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  for (const [dx, dy, th] of [[0, 1, 0], [1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    Object.assign(fly, { x: cx + dx * (r.w / 2 + 60), y: cy + dy * (r.h / 2 + 60), z: 0,
      th, flying: false, voarCd: 1e9, hunger: 0.5, aversion: 0, fleeDir: 0,
      fugaGiroT: 0, giroAcum: 0, sacadaSentido: 0, avFugaAnt: undefined, dAvFuga: 0 });
    const ini = brainT, inicio = Math.hypot(fly.x - cx, fly.y - cy);
    let giro = 0, anterior = fly.th, parcial = null;
    const amostra = () => ({ tempo_s: (brainT - ini) / 1000,
      distancia_mm: Math.hypot(fly.x - cx, fly.y - cy) / 7,
      aversao: fly.aversion, giro_graus: giro * 180 / Math.PI });
    const limite = performance.now() + 180000;
    while (brainT - ini < 12000) {
      if (performance.now() > limite) throw new Error('sonda do mofo sem progresso em 180 s');
      await waitBrain(10); fly.voarCd = 1e9;
      const d = fly.th - anterior; giro += Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); anterior = fly.th;
      if (!parcial && brainT - ini >= 6000) parcial = amostra();
    }
    resultados.push({ largada: [dx, dy, th], distancia_inicial_mm: inicio / 7, aos_6s: parcial, aos_12s: amostra() });
  }
  return { metodo: 'Três largadas na mesma sessão; 12 s cerebrais cada; posições e rumo reiniciados, cérebro preservado. Voo espontâneo inibido. Distância ao centro em mm; giro absoluto amostrado a cada relatório. Métricas gerais de andar desta sonda incluem teleportes e não devem ser usadas.', resultados };
})()
