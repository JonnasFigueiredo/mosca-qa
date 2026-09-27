// Sonda de busca pelo cheiro, executada por andar_medida.mjs --sonda-cheiro --segundos 0 (docs/plano-busca-cheiro.md, B1).
// Oito largadas: banana, pêssego, morango e uvas, a 20 e a 35 mm da borda da forma, direção e rumo sorteados com semente
// fixa (a mesma sequência em qualquer modo); voo inibido; fome 1; 20 s cerebrais cada.
// Usa as formas (SB.formas, sbAlturaObjeto) só para montar e medir o ensaio, nunca para comandar a mosca.
// O cérebro não é reiniciado entre largadas: não são réplicas independentes.
(async () => {
  let semente = 20260927;
  const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  const S = CORPO.S, frutas = ['k-banana', 'k-pessego', 'k-morango', 'k-uvas'], resultados = [];
  const sobre = (id, x, y) => sbAlturaObjeto(id, x, y) > -Infinity;
  // distância (px) até a borda da coisa, andando em linha reta na direção do centro dela
  const ateBorda = (id, cx, cy, x, y) => {
    const d = Math.hypot(cx - x, cy - y), ux = (cx - x) / d, uy = (cy - y) / d;
    for (let s = 0; s <= d; s += 1) if (sobre(id, x + ux * s, y + uy * s)) return s;
    return d;
  };
  const cheiroBom = () => fly.inata ? (fly.inata.aL + fly.inata.aR) / 2 : 0;
  for (const distMm of [20, 35]) for (const id of frutas) {
    const r = rects.find(q => q.id === id), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const ang = rnd() * 2 * Math.PI, rumo = rnd() * 2 * Math.PI;
    // borda: sai do centro nessa direção até deixar a forma; a largada fica distMm além dela, dentro do mundo
    let b = 0; while (b < 600 && sobre(id, cx + Math.cos(ang) * b, cy + Math.sin(ang) * b)) b += 1;
    const x = clamp(cx + Math.cos(ang) * (b + distMm * S), 30, SB.W - 30), y = clamp(cy + Math.sin(ang) * (b + distMm * S), 30, SB.H - 30);
    Object.assign(fly, { x, y, z: sbSurface(x, y), th: rumo, flying: false, jumping: false, voarCd: 1e9, hunger: 1, aversion: 0, fleeDir: 0,
      giroAcum: 0, sacadaSentido: 0, fugaGiroT: 0, back: 0, startle: 0 });
    const ini = brainT, c0 = [];
    let chegou = null, dmin = Infinity, tCheiro = { '0.02': 0, '0.05': 0, '0.1': 0, '0.2': 0 }, tTot = 0, giro = 0, thAnt = fly.th, sac = 0, emSac = false, k = 0;
    const cs = [];
    const limite = performance.now() + 240000;
    while (brainT - ini < 20000) {
      if (performance.now() > limite) throw new Error('sonda do cheiro sem progresso em 240 s');
      await waitBrain(10); fly.voarCd = 1e9; fly.hunger = 1;
      if (fly.flying) { fly.flying = false; fly.z = sbSurface(fly.x, fly.y); }
      const dt = 0.01, c = cheiroBom(); tTot += dt; cs.push(c);
      for (const lim in tCheiro) if (c > +lim) tCheiro[lim] += dt;
      let d = fly.th - thAnt; d = Math.atan2(Math.sin(d), Math.cos(d)); giro += Math.abs(d); thAnt = fly.th;
      const s = Math.abs(d) / dt > 3.5; if (s && !emSac) sac++; emSac = s;
      if (++k % 10 === 0 || chegou === null) {
        const db = ateBorda(id, cx, cy, fly.x, fly.y) / S;
        dmin = Math.min(dmin, db);
        if (chegou === null && (db < 1 || fly.patasEl?.id === id)) chegou = +((brainT - ini) / 1000).toFixed(2);
      }
      if (k === 1) c0.push(c);
    }
    const ord = [...cs].sort((a, b) => a - b), q = p => +ord[Math.floor(p * (ord.length - 1))].toFixed(4);
    resultados.push({ fruta: id.replace('k-', ''), distancia_inicial_mm: distMm, chegou_s: chegou, distancia_minima_mm: +dmin.toFixed(1),
      cheiro_bom_inicial: +(c0[0] ?? 0).toFixed(4), cheiro_bom: { p10: q(0.1), mediana: q(0.5), p90: q(0.9), max: q(1) },
      fracao_com_cheiro_acima: Object.fromEntries(Object.entries(tCheiro).map(([a, v]) => [a, +(v / tTot).toFixed(2)])),
      giro_total_graus: Math.round(giro * 180 / Math.PI), sacadas: sac });
  }
  const chegadas = resultados.filter(r => r.chegou_s !== null);
  return { metodo: 'Oito largadas na mesma sessão (4 frutas x 20 e 35 mm da borda), semente 20260927, voo inibido, fome 1, 20 s cerebrais cada; cérebro preservado entre largadas (não são réplicas independentes). Chegou = borda da forma a menos de 1 mm, medida na direção do centro, ou patas na fruta. Cheiro bom = média de inata(aL, aR) nas antenas, antes da fome e da saturação. Métricas gerais de andar desta rodada incluem teleportes e não devem ser usadas.',
    chegadas: chegadas.length, de: resultados.length, tempo_mediano_s: chegadas.length ? chegadas.map(r => r.chegou_s).sort((a, b) => a - b)[Math.floor(chegadas.length / 2)] : null, resultados };
})()
