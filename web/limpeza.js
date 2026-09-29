// Limpeza espontânea na Cozinha: regra do corpo, não sequência emergente do conectoma.
// Alterna varrer a cabeça/antenas com esfregar as patas. Tempos e poses não foram calibrados em animais.
// Nada aqui inventa poeira, injeta dopamina ou altera sinapses. Relógio: segundos cerebrais.
const LimpezaMosca = (() => {
  const etapas = [
    {nome: 'cabeca', s: 0.9}, {nome: 'patas', s: 0.65},
    {nome: 'antenas', s: 0.9}, {nome: 'patas', s: 0.65},
  ];
  const nomes = {cabeca: 'limpando a cabeça', patas: 'esfregando as patas', antenas: 'limpando as antenas'};
  const duracao = etapas.reduce((s, e) => s + e.s, 0);
  const suave = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  function passo(f, dt, o, aleatorio = Math.random) {
    if (!o.habilitada) { f.limpeza = null; return null; }
    const e = f.limpeza || (f.limpeza = {ativa: false, espera: 6 + 6 * aleatorio(), t: 0, pausa: 0});
    e.evento = null;
    const impedida = o.perigo || o.provando || !o.apoiada;
    if (impedida) {
      if (e.ativa) { e.evento = 'interrompida'; e.espera = 5 + 4 * aleatorio(); }
      e.ativa = false; e.peso = 0; e.pausa = 0;
      return e;
    }
    if (e.ativa) {
      e.t += dt;
      if (e.t >= duracao) {
        e.ativa = false; e.peso = 0; e.evento = 'fim'; e.pausa = 0;
        e.espera = 16 + 14 * aleatorio();
        return e;
      }
    } else {
      e.espera = Math.max(0, e.espera - dt);
      e.pausa = o.pausa ? e.pausa + dt : 0;
      if (e.espera > 0 || e.pausa < 0.12) return e;
      e.ativa = true; e.t = 0; e.evento = 'inicio';
    }
    let inicio = 0, i = 0;
    while (i < etapas.length - 1 && e.t >= inicio + etapas[i].s) inicio += etapas[i++].s;
    e.etapa = etapas[i].nome;
    e.anterior = etapas[Math.max(0, i - 1)].nome;
    e.mistura = suave((e.t - inicio) / 0.14);
    e.peso = suave(e.t / 0.18) * suave((duracao - e.t) / 0.18);
    return e;
  }
  return {passo, etapas, nomes, duracao};
})();
