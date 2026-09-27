// Resume as séries longa-simples-1..5, longa-fisico-1..5 e longa-sentidos-1..5.
// Usa apenas medições livres completas, preservando os resultados preliminares antigos.
import { readFileSync, writeFileSync } from 'node:fs';
const raiz = new URL('../docs/medicoes/', import.meta.url);
const ler = nome => JSON.parse(readFileSync(new URL(nome, raiz), 'utf8'));
const gravar = (nome, valor) => writeFileSync(new URL(nome, raiz), JSON.stringify(valor, null, 2) + '\n');
const todas = ler('andar-vs-moscas.json').medidas;
const frutas = new Set(['k-banana', 'k-uvas', 'k-pessego', 'k-morango']);
const mediana = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const faixa = a => ({ mediana: mediana(a), minimo: Math.min(...a), maximo: Math.max(...a) });
function serie(nome) {
  const medidas = Array.from({ length: 5 }, (_, i) => todas.findLast(m => m.rotulo === `longa-${nome}-${i + 1}`));
  if (medidas.some(m => !m)) return null;
  for (const m of medidas) {
    if (m.relogio_s !== 300 || m.mofo || m.erros?.length || !m.amostras || m.configuracao.semOlhos)
      throw new Error(`Medição incompatível ou inválida: ${m.rotulo}`);
    if (m.configuracao.fisico && m.fim.visao.corpo_fisico_s < m.fim.visao.tempo_s * 0.99)
      throw new Error(`Corpo físico desligou durante ${m.rotulo}`);
    if (m.fim.visao.olhos_reais_s < m.fim.visao.tempo_s * 0.95)
      throw new Error(`Olhos reais indisponíveis em mais de 5% de ${m.rotulo}`);
  }
  const rodadas = medidas.map(m => {
    const eventos = m.detalhes_eventos, comidas = eventos.filter(e => e.type === 'comeu'), pousos = eventos.filter(e => e.type === 'pouso');
    const visao = m.fim.visao;
    return { rotulo: m.rotulo, cerebro_s: m.cerebro_s, versao: m.versao,
      refeicoes: comidas.length, refeicoes_em_fruta: comidas.filter(e => frutas.has(e.id)).length,
      refeicoes_por_100s_cerebrais: comidas.length * 100 / m.cerebro_s,
      comeu_por_objeto: comidas.reduce((a, e) => (a[e.id] = (a[e.id] || 0) + 1, a), {}),
      primeira_refeicao_s: comidas.length ? +(comidas[0].t - m.inicio_cerebro_s).toFixed(2) : null,
      voos: m.eventos.voo || 0, pousos: pousos.length, pousos_em_fruta: pousos.filter(e => frutas.has(e.id)).length,
      pousou_em: pousos.map(e => e.id), fome_final: m.fim.fome,
      fracao_voando: m.fracoes_do_tempo.voando || 0,
      fracao_olhos_reais: visao.olhos_reais_s / visao.tempo_s,
      chamadas_alvo_visual: { real: visao.alvo_real, aproximado: visao.alvo_aproximado, ausente: visao.sem_alvo } };
  });
  return { n: 5, rodadas,
    cerebro_s: faixa(medidas.map(m => m.cerebro_s)),
    velocidade_mediana_por_rodada_mm_s: faixa(medidas.map(m => m.velocidade_andando_mm_s.mediana)),
    trechos_media_por_rodada_s: faixa(medidas.map(m => m.trecho_andando_s.media)),
    paradas_curtas_fracao_por_rodada: faixa(medidas.map(m => m.paradas_s.frac_menos_0_3s)),
    fracoes_do_tempo: Object.fromEntries(['andando_reto', 'parada', 'virando', 'voando', 'comendo', 'escalando'].map(k => [k, faixa(medidas.map(m => m.fracoes_do_tempo[k] || 0))])),
    rodadas_com_fruta: rodadas.filter(r => r.refeicoes_em_fruta > 0).length,
    rodadas_com_pouso_em_fruta: rodadas.filter(r => r.pousos_em_fruta > 0).length,
    refeicoes_por_rodada: faixa(rodadas.map(r => r.refeicoes)),
    fome_final: faixa(rodadas.map(r => r.fome_final)) };
}
const simples = serie('simples'), fisico = serie('fisico'), sentidos = serie('sentidos');
const metodo = 'Cinco sessões independentes de navegador por condição, 300 s de relógio após preparação, mesmo ponto inicial padrão, olhos reais ativos; sem sementes pareadas. Tempo cerebral e eventos preservados. Faixas e medianas são entre rodadas, não agrupamento das amostras. Janela de movimento 100 ms no simples e 200 ms no físico; comendo significa boca estendida, refeições são eventos comeu. Frutas: banana, uvas, pêssego e morango; açúcar contado separadamente. Poucas réplicas, sem inferência estatística ou validação biológica.';
if (simples && fisico) gravar('andar-longas-resumo.json', { metodo, simples, fisico });
if (simples && sentidos) {
  const comparacao = ler('sentidos-comparacao.json');
  const janela = Math.floor(Math.min(...simples.rodadas.map(r => r.cerebro_s), ...sentidos.rodadas.map(r => r.cerebro_s)));
  const recortar = s => s.rodadas.map(r => {
    const m = todas.findLast(m => m.rotulo === r.rotulo);
    const tempo = e => e.relogio_cerebral_s ?? (['comeu', 'voo'].includes(e.type) ? e.t : null);
    const eventos = m.detalhes_eventos.filter(e => tempo(e) !== null && tempo(e) >= m.inicio_cerebro_s && tempo(e) <= m.inicio_cerebro_s + janela);
    const pousosComRelogio = m.detalhes_eventos.filter(e => e.type === 'pouso').every(e => e.relogio_cerebral_s !== undefined);
    return { rotulo: r.rotulo, refeicoes: eventos.filter(e => e.type === 'comeu').length,
      refeicoes_em_fruta: eventos.filter(e => e.type === 'comeu' && frutas.has(e.id)).length,
      pousos_em_fruta: pousosComRelogio ? eventos.filter(e => e.type === 'pouso' && frutas.has(e.id)).length : null,
      voos: eventos.filter(e => e.type === 'voo').length };
  });
  comparacao.rodadas_longas = { metodo, atalhos: simples, sentidos,
    janela_cerebral_comum: { segundos: janela, metodo: 'Eventos restritos à mesma duração cerebral inicial em todas as dez rodadas; evita comparar exposição maior apenas porque uma sessão rodou mais rápido. Eventos antigos de pouso usam t como duração de voo, não relógio: nesses casos o pouso no recorte é null (indisponível), nunca zero. Contagens de pouso na sessão inteira continuam válidas.', atalhos: recortar(simples), sentidos: recortar(sentidos) } };
  gravar('sentidos-comparacao.json', comparacao);
}
for (const [nome, s] of Object.entries({ simples, fisico, sentidos })) {
  if (!s) { console.log(`${nome}: série ainda incompleta`); continue; }
  const { rodadas, ...resumo } = s;
  console.log(nome, JSON.stringify(resumo, null, 2));
}
