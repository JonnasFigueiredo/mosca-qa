# Plano: buscar comida pelo cheiro ao longo do tempo (passo 1 do que falhou no modo só sentidos)

Pedido do usuário (27/09/2026). Leia antes o `AGENTS.md` e o resultado negativo em `docs/plano-sentidos-e-medicao.md`
(seção "P1.5 concluído, resultado negativo"): sem a lista de objetos (`?sentidos=1`), em 5 rodadas de 300 s ela não
achou nenhuma fruta. Um dos motivos: andando, o cheiro não a leva à fruta. Com as antenas na distância real
(0,28 mm), a comparação entre elas é fraca, e ela não compara o cheiro ao longo do tempo, que é o que as moscas reais
fazem.

**Atualize a seção "Onde parei" a cada passo** (o que fez, números, o que falta). Quem continuar começa por ela.

## Onde parei

`[x]` feito e medido; `[~]` começado; `[ ]` não começado.

- [x] B1 Sonda de busca pelo cheiro (`scripts/cheiro_sonda.js`, via `andar_medida.mjs --sonda-cheiro`) e linha de base
- [x] B2 A regra como função pura em `web/corpo-natural.js` (`CorpoNatural.buscaCheiro`) com testes
- [x] B3 Ligar a regra em `stepBody` (corpo simples da Cozinha 3D, só com `?sentidos=1` no começo)
- [x] B4 Medir: sonda antes/depois, andar livre, e as 5 rodadas de 300 s do modo só sentidos com o mesmo critério (melhorou, não passou)
- [ ] B5 Pouso e decolagem pelos sentidos (passos 2 e 3 do resultado negativo). **Próximo: o pouso** (13 de 15 pousos no balcão)
- [ ] B6 README, texto da página, `AGENTS.md`, commit

Notas de cada passo, em ordem (a mais recente é a última):

**B1 e B2 começados (27/09/2026).**
- `scripts/cheiro_sonda.js` + `andar_medida.mjs --sonda-cheiro --segundos 0` (não usar com `--fisico`; o resumo
  `resumir_sentidos.mjs` agora ignora medidas com sonda do cheiro). Oito largadas (banana, pêssego, morango, uvas; a
  20 e a 35 mm da borda), semente 20260927, voo inibido, fome 1, 20 s cerebrais cada. Mede: `chegou_s` (borda a menos
  de 1 mm ou patas na fruta), distância mínima, o cheiro bom nas antenas (p10, mediana, p90, máximo; frações do tempo
  acima de 0,02 / 0,05 / 0,1 / 0,2) para escolher o limiar da regra, giro total e sacadas.
- Linha de base lançada nos dois modos: rótulos `cheiro-base-atalhos` e `cheiro-base-sentidos` em
  `docs/medicoes/andar-vs-moscas.json` (campo `cheiro`); logs em `_tmp/_cheiro_base_*.log`. **Se estes rótulos não
  estiverem no JSON, rodar de novo** (um de cada vez): `node scripts/andar_medida.mjs --sonda-cheiro --segundos 0
  [--sentidos] --rotulo cheiro-base-...`. Cada um leva ~8 min de relógio (o cérebro anda ~0,35× com os olhos).
- Rascunho da regra: `_tmp/_busca_cheiro.js` (função `buscaCheiro(e, dt, cL, cR, aleatorio)` e constantes `BUSCA`),
  testes em `_tmp/_busca_teste.mjs` (passam: sem cheiro neutra; subindo acelera, sem pausa, ruído 0,3; perdendo, giros
  de 60–150° a cada 0,4–0,8 s, para a antena com mais cheiro quando a diferença relativa passa de 2%). `_tmp/` não vai
  para o git: o código do rascunho e dos testes está no apêndice no fim deste arquivo. Próximo: escolher `BUSCA.LIMIAR` pelos números
  da linha de base, mover a função para `web/corpo-natural.js` (exportar `buscaCheiro` e `BUSCA` no objeto
  `CorpoNatural`), mover os testes para `scripts/corpo_natural_teste.mjs`, e seguir para B3.

**B1 linha de base, B2 e B3 feitos (27/09/2026).**
- Linha de base (`cheiro-base-atalhos`, `cheiro-base-sentidos` em `andar-vs-moscas.json`, campo `cheiro`): chegou à
  fruta em **2 de 8** largadas nos dois modos (tempos medianos 17,7 e 18,5 s); nas outras, a distância mínima ficou em
  11–34 mm (muitas vezes nem se aproximou).
- Achado: na Cozinha o cheiro bom está em toda parte. A 20 e a 35 mm das frutas, a média de `inata(aL, aR)` fica quase
  sempre entre ~0,2 e ~3 (as nuvens das frutas e do vinagre se sobrepõem numa bancada de 20 cm). "Estar no cheiro" não
  distingue nada; o que importa é a tendência. Por isso: `LIMIAR` 0,2 (só para "fora" em cantos sem cheiro) e `QUEDA`
  −0,15/s (queda relativa por segundo que conta como "perdeu"; uma nuvem de σ ~30 mm, a 10 mm/s, dá quedas de ~0,1 a
  0,3/s andando para longe). Ajustar pelos números de B4.
- B2: `CorpoNatural.buscaCheiro` e `CorpoNatural.BUSCA` em `web/corpo-natural.js`; testes em
  `scripts/corpo_natural_teste.mjs` (passam).
- B3: em `stepBody` (`web/index.html`), só com `soSentidos()`, corpo simples, sem voo e sem fuga do mofo: `f.buscaR`
  (velocidade × fator, pausas suspensas salvo provando, ruído de virada × fator, giro somado a `f.giroAcum`). O
  medidor registra a fração do tempo `dentro`/`perdeu` (`busca_pelo_cheiro`).
- Próximo (B4): sonda depois (`cheiro-b3-sentidos`, rodando; log `_tmp/_cheiro_b3_sentidos.log`), comparar com
  `cheiro-base-sentidos`; depois andar livre 90 s com `--sentidos` e a série `longa-sentidos-b-1..5` (rótulos novos; o
  `resumir_sentidos.mjs` procura `longa-sentidos-N`: ajustar para aceitar o sufixo da série).

**B4, sonda antes e depois (27/09/2026).** Mesmas 8 largadas, modo só sentidos, olhos reais
(`andar-vs-moscas.json`, campo `cheiro`):

| Versão | Chegadas | Tempo mediano | Tempo em `dentro` / `perdeu` | Virando |
|---|---|---|---|---|
| Sem a regra (`cheiro-base-sentidos`) | 2/8 (banana 20 e 35 mm) | 18,5 s | – | 11% |
| v1: queda 15%/s, giros repetidos a cada 0,4–0,8 s (`cheiro-b3-sentidos`) | 0/8 | – | 67% / 27% | 25% |
| v2: queda 30%/s, um giro por perda e outro só se continuar caindo, 1 s em `perdeu` (`cheiro-b3v2-sentidos`) | 3/8 (banana 20 e 35, pêssego 35; uvas 35 a 1,3 mm) | 5,4 s | 85% / 13% | 18% |

A v1 rodopiava (2000–3000° de giro a cada 20 s). A v2 é a que está no código (`BUSCA` em `web/corpo-natural.js`).
Ganho modesto e com uma sonda só (o cérebro é o mesmo em todas as largadas): a série de 5 rodadas decide. Próximo:
andar livre 90 s com `--sentidos` (conferir virando/pausas) e a série `longa-sentidos-b-1..5`, depois
`node scripts/resumir_sentidos.mjs --serie sentidos-b --chave rodadas_longas_b`.

**B4, v3 e a série (27/09/2026).**
- Andar livre 90 s com a v2 (`livre-busca-sentidos`): `dentro` 93% do tempo e parada só 2,6% (antes ~20–30%), virando
  15%. Causa: na Cozinha o cheiro bom está em toda parte, e "dentro" suspendia as pausas. **v3** (a que está no código):
  acelerar (× 1,3), andar reto e não parar só com o cheiro **subindo** (queda/subida relativa > `SUBIDA` = +0,1/s),
  o equivalente a um encontro com o cheiro; presente e parado não muda nada. Andar livre 90 s com a v3
  (`livre-busca-v3-sentidos`): parada 10,7%, virando 4,7%, velocidade mediana 15 mm/s; essa rodada teve 39% do tempo
  voando (8 decolagens de fuga), sem relação com a regra, que só age no chão.
- Sonda com a v3 (`cheiro-b3v3-sentidos`): 1/8. **A sonda de 8 largadas não separa efeitos pequenos:** sem a regra 2/8,
  v1 0/8, v2 3/8, v3 1/8, e o cérebro é o mesmo em todas as largadas. Para comparar versões da regra, repetir cada
  sonda 3 vezes ou mais, ou aumentar as largadas.
- Série `longa-sentidos-b-1..5` com a v3 lançada (logs `_tmp/_longa-sentidos-b-*.log`; resumo automático no fim com
  `node scripts/resumir_sentidos.mjs --serie sentidos-b --chave rodadas_longas_b`, gravado em
  `sentidos-comparacao.json` na chave `rodadas_longas_b`). **Se a série não estiver completa em `andar-vs-moscas.json`,
  rodar de novo as rodadas que faltam** (`node scripts/andar_medida.mjs --segundos 300 --sentidos --rotulo
  longa-sentidos-b-N`, uma por vez) e o resumo. Aplicar o mesmo critério de antes (fruta ≥ 3/5, pouso em fruta ≥ 2/5,
  refeições ≥ metade do modo com atalhos).

**B4 concluído (27/09/2026): melhorou, não passou o critério.** Série `longa-sentidos-b-1..5` (busca pelo cheiro v3),
resumo em `sentidos-comparacao.json` → `rodadas_longas_b`:

| 5 rodadas de 300 s, olhos reais | Com atalhos | Só sentidos (antes) | Só sentidos + busca pelo cheiro |
|---|---|---|---|
| Rodadas com fruta comida | 3/5 | 0/5 | 1/5 (pêssego) |
| Rodadas com pouso em fruta | 3/5 | 0/5 | 2/5 (uvas; pêssego) |
| Voos por rodada | 0, 0, 3, 5, 6 | 0, 0, 0, 1, 2 | 0, 0, 1, 7, 7 |
| Pousos no balcão / em fruta | – | 2 / 0 | 13 / 2 |
| Refeições por rodada (mediana) | 9 | 8 | 7 |

Critério: fruta ≥ 3/5 (não), pouso em fruta ≥ 2/5 (sim, no limite), refeições ≥ metade (sim). O padrão continua com
os atalhos. Agora ela voa mais (decola na base das frutas, `sbWantsFly` do modo só sentidos), e o gargalo é o **pouso**:
13 de 15 pousos foram no balcão, por tempo (`VOO_MAX`). Próximo: B5, o pouso.

**B5 começado: o pouso (27/09/2026).** Diagnóstico: o pouso do modo só sentidos era avaliado só a cada 0,25 s (no
bloco de `f.alvoT`) e exigia cheiro forte (`f.atrInata` > 0,35, ou > 0,1 sem crescer) na altura do voo; voando a
~128 mm/s, ela passa por cima de uma fruta de 40 mm em ~0,3 s, e o cheiro enfraquece com a altura. Mudança em
`sbFly` (`web/sandbox.js`), só com `soSentidos()`: o pouso é avaliado a cada tique, fora do bloco do alvo: coisa
embaixo (`sbSurface` > `SB_STEP`), superfície suave (`sbInclinacao` < 0,5) e cheiro bom presente (`f.atrInata` > 0,1);
com uma coisa embaixo, a velocidade cai a 35% (para dar tempo de pousar); sem pousar, desce onde estiver só depois
de 3 s (`VOO_MAX_SENTIDOS`; com atalhos continua 1,5 s). Série `longa-sentidos-c-1..5` lançada (logs
`_tmp/_longa-sentidos-c-*.log`; resumo `--serie sentidos-c --chave rodadas_longas_c`). Se não estiver completa em
`andar-vs-moscas.json`, rodar as que faltam, uma por vez.

**B5, série do pouso (`longa-sentidos-c`, 27/09/2026).** Pousos em alguma coisa: **8 de 15** (pêssego 2, uvas 2,
vinagre 2, laranja 2), contra 2 de 15 na série anterior; pouso em fruta em 2/5 rodadas. Mas **fruta comida em 0/5**:
ela pousa e não come. Hipótese: no corpo simples o corpo fica reto na encosta (pousa com até ~27° de inclinação); as
patas do lado de cima ficam dentro da fruta e as de baixo no ar, e o contato (`CorpoNatural.contato`) só aceitava a
pata a no máximo 0,25 mm da superfície. Próximo: aceitar a pata até 1 mm para dentro da superfície (ela se apoia na
encosta) e repetir a série (`longa-sentidos-d`). Com os atalhos, ela pousa no centro (plano) e come.

**B5, a hipótese do contato estava errada; a causa é a fuga ao pousar (27/09/2026).** Sonda da encosta
(`_sonda_encosta.js`, temporário: parada no pêssego, 4 s em cada posição): com o contato antigo ela já sentia o açúcar
(patas na fruta 87–100% do tempo) e comia (2–3 mordidas) até 0,78 de inclinação; com a correção, 100% e 2–3. A
correção do contato (aceitar a pata até 1 mm para dentro da superfície) ficou, mas quase não muda nada. A causa: nas
rodadas, logo depois de pousar no pêssego vem `fugaDirecao` + `voo` em 0–0,3 s. Voando baixo e devagar sobre a fruta,
ela mesma contava como obstáculo que cresce à frente (`f.loomObst`), que liga LPLC2/LC4 e a fibra gigante; e o valor não
era zerado ao pousar. Correções em `sbFly`: `f.loomObst = 0` ao pousar (vale nos dois modos); e, só com `soSentidos()`,
na aproximação sobre uma coisa, os primeiros 60 px à frente não contam como obstáculo (Tammero e Dickinson 2002:
expansão centrada leva ao pouso, lateral a uma guinada). Série `longa-sentidos-d-1..5` a seguir. Atenção: zerar `f.loomObst` ao pousar também vale no modo com
atalhos, então a série de referência `longa-simples` foi medida com o defeito; para comparar de forma justa no fim,
repetir 5 rodadas com atalhos (`longa-simples-b-N`, e ajustar `serie('simples')` no resumo).

## O que as moscas fazem (base da regra)

| O que | Referência | Uso aqui |
|---|---|---|
| Durante o cheiro, aumentam a velocidade no chão e se orientam contra o vento; depois de perder o cheiro, reduzem a velocidade e viram mais. Só o olfato já basta para as mudanças de velocidade e de viradas; a direção contra o vento precisa do vento (antenas) | Álvarez-Salvado et al. 2018, eLife 7:e37815, https://elifesciences.org/articles/37815 | A Cozinha não tem vento: usar só as partes de velocidade e de viradas |
| Num gradiente, sobem comparando as duas antenas; ao sair da zona de cheiro, a maior parte das viradas vem da queda de velocidade | Tao, Ozarkar e Bhandawat 2020, PLoS Comput Biol, https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1007718 | A comparação entre antenas continua (`chemo`); a queda de velocidade na perda do cheiro entra na regra |
| Em ar parado, a velocidade angular depende da frequência e da intermitência dos encontros com o cheiro, não da duração | Jayaram et al. 2023, eLife, https://pmc.ncbi.nlm.nih.gov/articles/PMC10205008/ | As viradas da busca respondem à perda (o fim de um encontro), não ao tempo dentro |
| Encontros com o cheiro mudam as taxas de parar e de voltar a andar | Demir et al. 2020, eLife 9:e57524, https://elifesciences.org/articles/57524 | Com o cheiro bom presente, menos pausas |

Nada disso é circuito do conectoma no nível de ligação: é **regra do corpo**, baseada em comportamento medido, e vai
declarada assim no README e na página. O cérebro não muda.

## B1 Sonda de busca pelo cheiro

Mesmo formato da sonda do mofo (`scripts/mofo_sonda.js`, rodada por `andar_medida.mjs --sonda-mofo --segundos 0`):
um arquivo `scripts/cheiro_sonda.js` avaliado na página já preparada, e a opção `--sonda-cheiro` no medidor (copiar
o tratamento de `--sonda-mofo`: não usar com `--fisico`; guardar o resultado na medida).

- Largadas: banana, pêssego, morango e uvas; a 20 mm e a 35 mm da borda da forma (use `sbAlturaObjeto`/`SB.formas`
  só para montar e medir, nunca para comandar); rumo sorteado com semente fixa (mesma sequência nos dois modos);
  voo inibido (`voarCd = 1e9` a cada tique); fome 1; 20 s de cérebro por largada.
- Métricas por largada: chegou (borda a menos de 1 mm, ou `f.patasEl` na fruta), tempo até chegar, distância mínima
  à borda, fração do tempo com cheiro bom presente (acima do limiar escolhido em B2), número de sacadas.
- Aviso na saída: o cérebro não é reiniciado entre largadas (não são réplicas independentes), como na sonda do mofo.
- Linha de base **antes de B3**, nos dois modos (`--sentidos` e sem), olhos reais (sem `--sem-olhos`). A caminhada
  pelo cheiro é a mesma nos dois; a visão difere (sem a novidade escondida no modo só sentidos).

## B2 A regra como função pura

Em `web/corpo-natural.js`, para testar em Node (`scripts/corpo_natural_teste.mjs`):

```js
// estado: objeto guardado em f (ex.: f.busca); c: concentração do cheiro bom nas antenas (média, sem saturar)
// devolve { velocidade: fator, semPausa: bool, giro: rad a somar ao giro acumulado (0 quase sempre), ruido: fator }
function buscaCheiro(estado, dt, c, aleatorio = Math.random) { ... }
```

Proposta (ajustar pelos números de B1 e B4, e registrar cada ajuste):
- **Sinal:** `c` = média de `ina.aL` e `ina.aR` (cheiro de fruta e fermentação, antes de multiplicar pela fome e
  antes de saturar), suavizado em ~0,2 s; tendência `dc` = derivada suavizada em ~0,3 s. Limiar de presença a
  escolher em B1 (a distribuição de `c` a 20 e 35 mm das frutas).
- **Dentro do cheiro** (`c` acima do limiar e `dc` ≥ −ε): velocidade × ~1,3, sem pausas sorteadas, ruído de virada
  × ~0,3 (anda mais reto). Base: Álvarez-Salvado 2018 (acelera no cheiro), Demir 2020 (menos paradas).
- **Perdeu o cheiro** (estava acima do limiar e agora cai: `dc` < −ε, ou passou para baixo do limiar): por ~1,5 s,
  velocidade × ~0,6 e giros de busca de 60–150° a cada 0,4–0,8 s, para o lado da antena com mais cheiro quando a
  diferença for mensurável, senão sorteado. Base: Álvarez-Salvado 2018 (desacelera e vira mais depois da perda),
  Tao 2020, Jayaram 2023.
- **Fora do cheiro** por mais de ~3 s: nada muda (a caminhada e as pausas de sempre).
- A fuga do mofo tem prioridade sobre a busca (se `f.fleeDir`, a busca não age).
- Testes em `corpo_natural_teste.mjs`: subindo o cheiro → mais rápida, sem pausa; perdendo → mais lenta e com giro;
  sem cheiro → neutra; com `aleatorio` fixo, o giro sai do lado da antena mais forte.

## B3 Ligar em `stepBody`

- Só no corpo simples da Cozinha 3D (`sacadas` verdadeiro) e só com `soSentidos()` no começo, para comparar com a
  série anterior sem mexer no padrão. Depois de B4, decidir se vale também para o modo com atalhos.
- Onde: perto da fuga do mofo em `web/index.html` (`stepBody`): o fator de velocidade entra em `f.speed`, `semPausa`
  como a fuga já faz com `marcha`, o giro somado a `f.giroAcum` (sai em sacada pelo mecanismo existente), o ruído
  multiplica o termo `(Math.random() - 0.5) * ...` de `turn`.
- Guardar em `f` o estado da busca para o medidor (`f.busca.estado`: 'fora', 'dentro', 'perdeu'). Acrescentar ao
  registro do medidor a fração do tempo em cada estado.
- Corpo físico: deixar para depois (as viradas dele vêm do controlador; seria um pulso em `turnCmd`).

## B4 Medir

1. Sonda de B1 depois de B3, nos dois modos; comparar chegadas e tempos com a linha de base.
2. `andar_medida.mjs --sentidos --segundos 90` livre: conferir que o andar sem cheiro não mudou (velocidade, pausas,
   viradas dentro das faixas da parte 2).
3. As 5 rodadas de 300 s do modo só sentidos (`python -X utf8 _rodadas_longas.py sentidos` se o arquivo ainda
   existir; senão, 5 × `node scripts/andar_medida.mjs --segundos 300 --sentidos --rotulo longa-sentidos-N`), resumo
   com `node scripts/resumir_sentidos.mjs`. **Atenção:** o resumo pega a última medida de cada rótulo; use rótulos
   novos (ex.: `longa-sentidos-b-1..5`) e ajuste o script, para não misturar com a série anterior.
4. Mesmo critério de antes: fruta ≥ 3/5, pouso em fruta ≥ 2/5, refeições ≥ metade do modo com atalhos. Só a busca
   pelo cheiro talvez não baste (o pouso e a decolagem também falharam): registrar o que melhorou e o que não.
5. Rodar `node scripts/corpo_natural_teste.mjs` e `node scripts/realismo_sandbox_teste.mjs`.

## B5 (depois) Pouso e decolagem

Da mesma análise: (a) pousar quando os olhos veem uma coisa embaixo e o cheiro bom está presente e **crescendo**, em
vez de exigir `f.atrInata > 0,35` na altura do voo (o cheiro fica fraco a 60 px acima); ou amostrar o cheiro na
altura em que ela desceria; (b) com fome e sem cheiro bom crescendo por um tempo (a comida por perto acabou), subir
a chance de decolar. Medir cada um separadamente, com a mesma série e o mesmo critério.

## Lembretes

- Um servidor por porta (`netstat -ano | grep -E ":876[56]"`); um navegador de teste por vez; temporários com `_`.
- `index.html` usa CRLF; editar com o Edit ou gravar com `newline='\r\n'`; conferir caracteres de controle depois.
- Commit só quando o usuário pedir ou antes de mudança grande; autor só o Jonnas, sem `Co-Authored-By`.

## Apêndice: rascunho da regra (B2) e dos testes

Para colar dentro do `CorpoNatural` em `web/corpo-natural.js` (e exportar `buscaCheiro` e `BUSCA`):

```js
  // Busca pelo cheiro ao longo do tempo (docs/plano-busca-cheiro.md). Regra do corpo, com base em comportamento medido:
  // moscas andando aceleram enquanto sentem o cheiro e, ao perdê-lo, desaceleram e viram mais (Álvarez-Salvado et al.
  // 2018); param menos com o cheiro presente (Demir et al. 2020); as viradas respondem à perda, não ao tempo dentro
  // (Jayaram et al. 2023). Sem vento, não há a orientação contra o vento. c = cheiro bom em cada antena (antes da fome)
  const BUSCA = { LIMIAR: 0.05, TAU_C: 0.2, TAU_D: 0.3, QUEDA: -0.3, PERDEU_S: 1.5, FORA_S: 3,
    VEL_DENTRO: 1.3, VEL_PERDEU: 0.6, RUIDO_DENTRO: 0.3, GIRO_MIN: 1.05, GIRO_MAX: 2.6, GIRO_T_MIN: 0.4, GIRO_T_MAX: 0.8, LADO_MIN: 0.02 };
  function buscaCheiro(e, dt, cL, cR, aleatorio = Math.random) {
    const c = (cL + cR) / 2, k = x => 1 - Math.exp(-dt / x);
    const antes = e.c ?? c;
    e.c = antes + (c - antes) * k(BUSCA.TAU_C);
    e.dc = (e.dc ?? 0) + ((e.c - antes) / Math.max(dt, 1e-6) - (e.dc ?? 0)) * k(BUSCA.TAU_D);
    const relativa = e.dc / Math.max(e.c, BUSCA.LIMIAR);   // queda relativa por segundo
    e.modo = e.modo || 'fora'; e.t = (e.t || 0) + dt;
    const muda = m => { e.modo = m; e.t = 0; e.giroT = 0; };
    if (e.modo === 'fora' && e.c >= BUSCA.LIMIAR && relativa >= BUSCA.QUEDA) muda('dentro');
    else if (e.modo === 'dentro' && (e.c < BUSCA.LIMIAR || relativa < BUSCA.QUEDA)) muda('perdeu');
    else if (e.modo === 'perdeu' && e.t > BUSCA.PERDEU_S) muda(e.c >= BUSCA.LIMIAR && relativa >= 0 ? 'dentro' : 'fora');
    if (e.modo === 'dentro') return { modo: 'dentro', velocidade: BUSCA.VEL_DENTRO, semPausa: true, ruido: BUSCA.RUIDO_DENTRO, giro: 0 };
    if (e.modo === 'perdeu') {
      let giro = 0;
      e.giroT = (e.giroT ?? 0) - dt;
      if (e.giroT <= 0) {
        // para o lado da antena com mais cheiro, se a diferença for mensurável; senão, sorteado (negativo = esquerda)
        const dif = (cL - cR) / Math.max(c, BUSCA.LIMIAR);
        const lado = Math.abs(dif) > BUSCA.LADO_MIN ? -Math.sign(dif) : (aleatorio() < 0.5 ? -1 : 1);
        giro = lado * (BUSCA.GIRO_MIN + (BUSCA.GIRO_MAX - BUSCA.GIRO_MIN) * aleatorio());
        e.giroT = BUSCA.GIRO_T_MIN + (BUSCA.GIRO_T_MAX - BUSCA.GIRO_T_MIN) * aleatorio();
      }
      return { modo: 'perdeu', velocidade: BUSCA.VEL_PERDEU, semPausa: true, ruido: 1, giro };
    }
    return { modo: 'fora', velocidade: 1, semPausa: false, ruido: 1, giro: 0 };
  }
```

Testes (hoje em `_tmp/_busca_teste.mjs`; mover para `scripts/corpo_natural_teste.mjs`):

```js
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx = vm.createContext({});
vm.runInContext(readFileSync('_tmp/_busca_cheiro.js', 'utf8') + ';globalThis.B=buscaCheiro;globalThis.P=BUSCA;', ctx);
const B = ctx.B, P = ctx.P;
// sem cheiro: neutra
let e = {}; let r; for (let i = 0; i < 200; i++) r = B(e, 0.01, 0, 0, () => 0.5);
assert.equal(r.modo, 'fora'); assert.equal(r.velocidade, 1); assert.equal(r.semPausa, false);
// cheiro subindo: mais rápida, sem pausa, mais reta
for (let i = 0; i < 100; i++) r = B(e, 0.01, 0.02 + i * 0.002, 0.02 + i * 0.002, () => 0.5);
assert.equal(r.modo, 'dentro'); assert.ok(r.velocidade > 1); assert.equal(r.semPausa, true); assert.ok(r.ruido < 1);
// perdeu: cai rápido
let giros = [];
for (let i = 0; i < 120; i++) { r = B(e, 0.01, Math.max(0, 0.22 - i * 0.004), Math.max(0, 0.22 - i * 0.004), () => 0.7); if (r.giro) giros.push(r.giro); }
assert.ok(giros.length >= 1, 'gira ao perder'); assert.ok([...Array(1)].every(() => e.modo === 'perdeu' || e.modo === 'fora'));
// lado: antena esquerda mais forte -> giro para a esquerda (negativo)
e = { modo: 'dentro', c: 0.2, dc: 0, t: 0 };
let lado = 0; for (let i = 0; i < 60; i++) { r = B(e, 0.01, 0.1, 0.05, () => 0.9); if (r.giro) { lado = Math.sign(r.giro); break; } }
assert.equal(lado, -1, 'vira para a antena com mais cheiro');
console.log('busca pelo cheiro: fora neutra, dentro acelera, perdeu vira (para a antena mais forte):', giros.length, 'giros; ok');
```
