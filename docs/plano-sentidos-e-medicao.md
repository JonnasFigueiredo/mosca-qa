# Plano: decidir só com os sentidos (parte 1) e medir o andar contra moscas reais (parte 2)

Pedido do usuário (27/09/2026): melhorar a mosca antes de voltar ao treino de caça a bugs. Leia o `AGENTS.md` antes.
Este arquivo é o guia de trabalho: **atualize a seção "Onde parei" a cada passo concluído** (o que foi feito, os
números medidos, o que falta). Quem continuar começa por ela.

## Escopo

- **Só o mundo natural (Cozinha)**, na página 2D e no sandbox 3D, com o corpo simples e com o corpo físico.
- Os sistemas de bugs (Pedidos, Financeiro) ficam como estão. Eles dependem de atalhos (a "novidade" de cada botão, o
  gosto doce de um botão ainda não provado) que serão repensados quando o usuário escolher um lugar para o treino.
- Nenhum parâmetro do cérebro muda (pesos, tônus, adaptação). O que muda são regras do corpo e de onde vêm as
  informações que elas usam. Toda regra nova vai para o README e para o texto da página como regra.

## Onde parei

Atualize esta lista. `[x]` feito e medido; `[~]` começado; `[ ]` não começado.

- [x] P2.1 Medidor do andar (`scripts/andar_medida.mjs`) e linha de base, antes de mudar qualquer coisa
- [x] P1.1 Chave "só sentidos" (`?sentidos=1`), sem mudar o comportamento padrão
- [~] P1.2 Alvo do voo pelos olhos e pelo cheiro, sem a lista de objetos (feito, com os olhos reais e com a aproximação; falta validar em rodadas longas)
- [~] P1.3 Decolagem pelos sentidos (feito; voa menos que com atalhos, calibrar)
- [x] P1.4 Sem "novidade" escondida na Cozinha
- [x] P1.5 Validação dos dois modos: 5 rodadas de 300 s cada, olhos reais. **Negativo:** "só sentidos" não achou fruta; continua como opção, o padrão fica com os atalhos
- [x] P2.2 Calibrar pausas, velocidades e viradas contra os alvos da literatura (corpo simples; no físico, só pausas e velocidade)
- [ ] P2.3 (opcional) Busca local depois de comer
- [ ] Final: README, texto da página, `AGENTS.md`, commit

Notas de cada passo, em ordem (a mais recente é a última; a lista "Próximos passos" no fim delas diz o que fazer agora):

**P2.1 feito (27/09/2026).** `node scripts/andar_medida.mjs --segundos 90 [--fisico] --rotulo nome` acrescenta uma
linha em `docs/medicoes/andar-vs-moscas.json`. Janela de 100 ms (com 50 ms o balanço de cada passada do corpo físico
virava "paradas" de 10 ms e "viradas" de 20 ms) e folga andando/parada (2,5 / 1,5 mm/s). Linha de base, uma rodada de
cada, Cozinha 3D com os olhos reais desenhados:

| Medida | Corpo simples (50 s de cérebro) | Corpo físico (21 s) | Moscas reais |
|---|---|---|---|
| Velocidade andando, mediana (p10–p90) | 4,9 mm/s (3,3–5,5) | 10,6 mm/s (5,2–19) | ~11–15, faixa 7–45 |
| Trechos andando, média / mediana | 2,7 / 1,9 s (17) | 1,7 / 1,4 s (11) | exponencial, 1,4–2,1 s |
| Paradas, mediana; < 0,3 s | 0,21 s; 56% (16 paradas) | 0,02 s; 90% (10) | ~76% < 0,3 s; algumas > 5 s |
| Tempo: andando / virando / parada | 66% / 26% / 7% | 58% / 32% / 1% (+ voando 6%, comendo 3%) | 29% / 9% / 63% (arena sem comida) |
| Viradas > 200°/s | 0,46/s andando, 620 ms, 35° | 5,7/s, 30 ms, 16° | ~15° em ~90 ms |
| Reorientação depois de parar, mediana | 12° | 22° | ~0° |

Leitura:
- **Corpo simples:** anda devagar demais (`WALK = 42` px/s = 6 mm/s, menos os descontos de `stepBody`); quase não
  para (a regra `CorpoNatural.marcha` só dá pausas de 0,15–0,65 s e é desligada por aversão, como perto da laranja
  mofada: `f.aversion > 0.3`); vira de forma contínua e longa (a soma de visão, cheiro e ruído em `stepBody`), não em
  sacadas curtas.
- **Corpo físico:** velocidade e trechos já batem; as "paradas" e "viradas" curtas são o balanço de cada passada do
  trípode, não comportamento. Para ele, medir viradas com janela maior (`--janela 200`) ou pelo rumo de uma passada
  à outra. Quase não para: a regra de pausas não chega ao corpo físico com efeito (conferir `corpoSinal` quando
  `f.speed` é 0: o servidor congela a passada, o que deveria contar como parada).
- O "63% parada" é de uma arena sem comida; com comida e fome, moscas andam mais. Usar como teto, não como alvo.

**P1.1–P1.4 feitos, P1.5 preliminar (27/09/2026).** O que mudou, tudo só com `?sentidos=1` e `APP.mundo`
(`soSentidos()` em `web/index.html`):
- `see()`: a novidade não pesa mais (tudo conta 1); `f.seen` agora guarda `[r, sl, sr, a, tamanho]` (a = direção
  relativa ao rumo).
- `stepBody`: `f.dCheiro`, a tendência do cheiro bom (`f.atrInata`) por segundo, suavizada.
- `sbWantsFly`: chance 0,05 + 0,3 · (coisa grande vista acima do piso) · fome + 0,1 · fome se o cheiro bom não cresce.
- `sbFly`: sem alvo da lista. Vira para a coisa maior à frente em `f.seen` (servo visual, 3·a rad/s, até 4); pousa
  quando há algo embaixo (`sbSurface` > `SB_STEP`), a superfície ali é suave (`sbInclinacao` < 0,5, ~27°) e o cheiro
  bom está forte (`f.atrInata` > 0,35) ou parou de crescer (> 0,1 e `f.dCheiro` ≤ 0). Sem a inclinação, pousava nas
  encostas e não comia. O evento `pouso` registra o que ficou embaixo, só para medir.
- Números em `docs/medicoes/sentidos-comparacao.json`: com atalhos, 1–3 voos e fruta comida nas 2 rodadas; só
  sentidos (com a inclinação), 0–2 voos e fruta comida em 1 de 3 (uvas); nas outras ela ficou no açúcar, perto de onde
  começa.

**P1.2 com os olhos reais e P2.2 (velocidade) (27/09/2026).**
- `sbAlvoVisual(f)` em `web/sandbox.js`: com os olhos reais, a maior mancha de `OLHO.obj` entre −60° e +15° de
  elevação e ±80° de azimute (sem o limite, a janela clara ganha sempre); sem eles, `f.seen`. Duas rodadas de 100 s
  com os olhos desenhados (`andar_medida.mjs --sentidos`, rótulo `sentidos-olhos-reais`): o cérebro anda só ~0,3× com
  o desenho (29–32 s de cérebro); numa comeu 8 vezes (açúcar) sem voar; na outra voou 4 vezes e pousou 3, sem achar
  fruta. Pouco para concluir: rodar mais longo (300 s ou mais).
- `WALK` na Cozinha 3D: 105 px/s (`WALK_COZINHA_3D`, escolhido em `stepBody`), a mesma velocidade em mm/s da página 2D
  da Cozinha. Medido (rótulo `walk-105-simples`): mediana 9,1 mm/s (p10 8,2, p90 14,5), antes 4,9. O corpo físico não
  muda (o sinal é `f.speed / WALK`). `realismo_sandbox_teste.mjs` passa.
- Ainda fora do alvo (mesma medida): parada 3% do tempo (moscas: muito mais; 63% numa arena sem comida) e virando 34%
  (viradas de ~140 ms e ~48°; moscas: sacadas de ~90 ms e ~15°, rumo quase parado entre elas).

**P2.2 pausas (27/09/2026).** `CorpoNatural.marcha`: trechos andando exponenciais (média 1,7 s), paradas 75% curtas
(exponencial, média 0,15 s) e 25% longas (média 2,5 s), girar no lugar só em 20% das paradas (0,1–0,3 s); a pausa só é
desligada por aversão forte (`f.aversion > 0.6`, antes 0,3). Medido (uma rodada de cada, `andar-vs-moscas.json`):

| Medida | Simples (`pausas-expo-simples`) | Físico (`pausas-expo-fisico`, janela 200 ms) | Moscas reais |
|---|---|---|---|
| Parada / andando / virando | 27,5% / 61% / 1,3% (+ comendo 10%) | 48% / 32% / 1,9% (+ voando 8%, comendo 9,5%) | 63% / 29% / 9% (sem comida) |
| Velocidade andando, mediana | 9,9 mm/s | 11,6 mm/s | ~11–15 |
| Trechos andando, média | 1,8 s | 0,7 s (o balanço do físico pica os trechos) | 1,4–2,1 s |
| Paradas < 0,3 s / > 5 s | 67% / 7% | 56% / 11% | ~76% / algumas |
| Reorientação depois de parar | 5,6° | 14° | ~0° |

Descoberta: os 26–34% "virando" das medidas anteriores vêm da regra de aversão (`away = fleeDir * 4.5` em `stepBody`,
4,5 rad/s = 258°/s, contínuo até sair do cheiro): perto da laranja mofada ela gira em círculo. Nas rodadas sem
passar pela laranja, "virando" fica em 1–2%.

**P2.2 viradas (27/09/2026).** Só no corpo simples da Cozinha 3D (`sacadas` em `stepBody`): a virada pedida se acumula
em `f.giroAcum` e sai a 300°/s (`SACADA_VEL`) quando passa de 0,22 rad (`SACADA_MIN`); parada zera o acumulado; a
fuga do cheiro ruim virou um giro de 1,75 rad (~100°) a cada 1 s enquanto a aversão dura, e o resto da virada pesa
`1 - 0,8·aversão`. Medido (`sacadas-simples-v2`): andando 51,5%, parada 30%, comendo 12%, virando 5,4% (moscas: 9%);
reorientação depois de parar 0°; velocidade 8,7 mm/s. Perto da laranja mofada (`_sonda_mofo.js`, 3 largadas de 6 s):
antes girava 1500–1800° e se aproximava (a visão puxa para a coisa grande e clara); agora 490–725°, e saiu do
cheiro em 1 de 3 (noutra, meio caminho). Limites da medida: com janela de 100 ms, sacadas de ~45 ms aparecem menores
(mediana 6°) e paradas curtas (< 0,15 s) somem; com pouca amostra (11 paradas), as frações variam muito.

**Retomada: fuga por tendência (27/09/2026, passo a concluído).** Git limpo na entrada; servidores existentes nas portas 8765/8766 reutilizados. Cópia anterior congelada em `_tmp/_antes_fuga_retoma`, servida na 8767. Linha de base livre de 90 s: 39,2 s cerebrais, velocidade mediana 11,74 mm/s, 16,2% parada, 4,7% virando, oito refeições (`fuga-antes-retomada`). Sonda versionada `scripts/mofo_sonda.js`, acionada pelo medidor com `--sonda-mofo --segundos 0`, três largadas de 12 s cerebrais, olhos reais, sem voo espontâneo. Antes: distância final 27,2/35,2/34,0 mm, aversão 1,00/0,60/0,64; depois: 69,1/83,3/76,1 mm, aversão 0,0068/0,0005/0,0020. Largadas compartilham o cérebro; métricas gerais de andar da sonda incluem teleportes e não devem entrar nas distribuições livres.

Regra nova só no corpo simples da Cozinha 3D: usar a tendência do cheiro ruim nas antenas antes de saturar; se diminui, seguir andando; repetir o giro somente se não diminui. Durante a fuga, não sortear pausas, não descontar velocidade por aversão, outras viradas a 10%. README e página declaram a regra. `corpo_natural_teste.mjs` e `realismo_sandbox_teste.mjs` passaram, incluindo alimentação física. Rodada livre posterior de 90 s: 32,8 s cerebrais, mediana 10,30 mm/s, 23,9% parada, 4,0% virando, sete refeições (`fuga-depois-retomada`). Essas duas rodadas livres não isolam o efeito do ajuste; a evidência específica é a sonda. O medidor agora preserva eventos com IDs/tempo, fome final e uso efetivo dos olhos reais para a comparação seguinte. Nenhum parâmetro cerebral alterado.

**Passo b, corpo simples concluído (27/09/2026); físico em execução.** Cinco sessões de 300 s de relógio (`longa-simples-1..5`), 101,4–177,0 s cerebrais, olhos reais disponíveis em 100% dos tiques. Mediana entre rodadas: velocidade 10,984 mm/s (faixa 7,706–11,288), média dos trechos andando 1,477 s (0,982–1,902), 60% das pausas menores que 0,3 s (55–69%), parada 21,6% (18,3–30,8%), virando 6,2% (5,7–7,9%). Frutas comidas e pousos em frutas em 3/5; duas sessões só comeram açúcar, e três terminaram com fome 1. Resultados individuais preservados, inclusive negativos. Sem mudança de comportamento durante a série; os dois testes de regressão já passaram nessa versão.

A série física usa janela de 200 ms. O medidor agora separa escalada explícita (`naParede`) de repouso e a exclui dos trechos no chão; as medidas físicas antigas não faziam essa separação. O corpo simples não usa esse estado. Também verifica se a física permaneceu ligada e registra disponibilidade dos olhos, eventos completos e hashes dos arquivos web. A execução sequencial está em `_rodadas_longas.py andar`, logs em `_tmp/_longa-*.log`: conferir se ainda está ativa antes de iniciar outro navegador. `scripts/resumir_sentidos.mjs` resume as cinco rodadas de cada série e, ao completar os dois modos, acrescenta um recorte de igual duração cerebral.

Próximos passos, nesta ordem:
1. [x] Fuga do cheiro ruim: revisão por tendência medida antes/depois, descrita acima.
2. [x] Cinco rodadas de 300 s por corpo, olhos reais (`longa-simples-1..5`, `longa-fisico-1..5`); resumo em
   `docs/medicoes/andar-longas-resumo.json` (`node scripts/resumir_sentidos.mjs`). Físico (mediana entre rodadas):
   91 s cerebrais por rodada; andando 47%, parada 22%, virando 9,6%, comendo 14%, escalando 4%; fruta comida em 4/5,
   pouso em fruta em 2/5; 8 refeições por rodada (1–11). Simples: ver o parágrafo do passo b acima.
3. [~] P1.2: validar o voo pelos olhos reais em rodadas longas. Feito: `scripts/visao_voo_teste.mjs` (omatídeos
   sintéticos) mostrou que a média em volta do pico ignorava os limites (a janela acima de 15° e o que passa de 80°
   puxavam a direção: 3 de 5 casos falhavam); corrigido em `sbAlvoVisual` (`dentro(az, el)` também na média), 5/5
   passam (`docs/medicoes/voo-limites-visuais.json`, fases `antes` e `depois`). Falta: ver nas rodadas `longa-sentidos`
   se os voos vão para frutas e se o limiar de pouso precisa de ajuste.
4. [x] P1.5: série `longa-sentidos-1..5` concluída e comparada (resultado abaixo). Série iniciada (27/09/2026, `_rodadas_longas.py sentidos`, log em
   `_tmp/_serie_sentidos.log`), com a correção de `sbAlvoVisual` acima. Critério escrito **antes** de ver o resultado:
   "só sentidos" vira o padrão se, nas 5 rodadas, comer fruta em pelo menos 3, pousar em fruta em pelo menos 2 e fizer
   pelo menos metade das refeições do modo com atalhos (`longa-simples`) na mesma janela cerebral
   (`janela_cerebral_comum` de `sentidos-comparacao.json`). Se não passar, fica como opção e o negativo vai para o
   README. Texto original do passo:
   5 rodadas por modo com `scripts/andar_medida.mjs --sentidos` (ele conta `comeu`/`pouso` em `eventos`) e sem
   `--sem-olhos`, gravar em `docs/medicoes/sentidos-comparacao.json`. Se o modo só sentidos comer fruta e pousar em
   comida com frequência razoável, virar o padrão (e `?sentidos=0` volta aos atalhos). Atualizar README e página.


**P1.5 concluído, resultado negativo (27/09/2026).** Cinco rodadas de 300 s por modo, olhos reais, corpo simples
(`sentidos-comparacao.json` → `rodadas_longas`; `node scripts/resumir_sentidos.mjs`):

| | Com atalhos (`longa-simples`) | Só sentidos (`longa-sentidos`) |
|---|---|---|
| Rodadas em que comeu fruta | 3/5 (pêssego, uvas) | 0/5 |
| Rodadas com pouso em fruta | 3/5 (pêssego, uvas, morango) | 0/5 (2 pousos, ambos no balcão) |
| Voos por rodada | 0, 0, 3, 5, 6 | 0, 0, 0, 1, 2 |
| Refeições nos primeiros 101 s cerebrais | 15, 8, 9, 14, 8 | 5, 7, 8, 8, 8 (só açúcar) |
| Fome no fim | mediana 1 (mín. 0,37) | 1 em todas |

Critério (escrito antes): fruta ≥ 3/5, pouso em fruta ≥ 2/5, refeições ≥ metade. Passou só o das refeições. O
padrão continua com os atalhos; `?sentidos=1` fica como opção. O servo visual funcionou (165 e 204 chamadas com os
olhos reais nas rodadas com voo). O que falhou, pela ordem:
1. **Quase não decola:** 3 de 5 rodadas sem voo. Ela fica em volta do açúcar (perto do ponto de partida), come as 8
   porções e continua ali com fome.
2. **O pouso não acha a fruta:** os 2 pousos foram no balcão, por tempo (`VOO_MAX`), sem que o cheiro bom passasse do
   limiar em cima de uma fruta (a nuvem de cheiro é centrada na fruta e cai com a altura; no cruzeiro, 60 px acima,
   o cheiro fica fraco).
3. **Andando, o cheiro não a leva à fruta:** com as antenas a 0,28 mm, a diferença entre elas é ~16 vezes menor que
   antes, e a busca pelo cheiro na Cozinha é só essa comparação. Com os atalhos, quem a leva às frutas é a escolha do
   alvo do voo pela lista.

Próximos passos sugeridos (não começados; decidir com o usuário):
1. **Busca pelo cheiro no tempo (klinotaxia), sem a lista:** moscas andando comparam a concentração ao longo do
   tempo, não só entre as antenas; ao perder o cheiro, viram; enquanto ele cresce, seguem reto (Álvarez-Salvado et al.
   2018, eLife; Demir et al. 2020, eLife). Hoje há algo parecido só para o cheiro aprendido (`f.tumbleT` em
   `stepBody`); estender ao cheiro inato de fruta (regra), medir com o medidor e com largadas a 20–35 mm das frutas.
2. **Pouso:** descer quando os olhos veem uma coisa embaixo e o cheiro bom está presente e crescendo, em vez de exigir
   que passe de 0,35 na altura do voo; ou medir o cheiro na altura em que ela desceria.
3. **Decolar para procurar:** com fome e sem cheiro bom crescendo por um tempo (a comida por perto acabou), a chance de
   decolar aumenta (hoje ela fica presa no açúcar vazio).
4. Depois, repetir as 5 rodadas de cada modo e o mesmo critério.

## Os atalhos de hoje (o que a mosca sabe sem ter percebido)

| Onde | O que faz | Por que é atalho |
|---|---|---|
| `web/sandbox.js` `sbAtrativo` e `sbEscolheAlvo` | Escolhe o alvo do voo percorrendo `rects` (todos os objetos) e lendo, de cada um, a composição do cheiro (`APP.objetos[id].cheiro`), a memória por objeto (`memo[id]`) e a novidade (`el(id).novelty`) | Ela "sabe" o cheiro e a memória de coisas que não está sentindo; o ponto de pouso é o centro do objeto, lido da lista |
| `web/sandbox.js` `sbWantsFly` | Decola mais se existe algo novo em outra altura (`rects` com `novelty > 0.5`) | Ela sabe o que é novo em lugares que não vê |
| `web/sandbox.js` `sbNovelBelow` | Algo novo logo abaixo | Mesmo motivo |
| `web/index.html` `see()` | O tamanho aparente de cada objeto conta `0.2 + 0.8 * novelty` | O que ela provou "brilha menos" por uma nota escondida, não por memória do cérebro |
| `web/index.html` `press()` | `s.novelty *= 0.35` ao provar | É a nota escondida |
| `web/sandbox.js` (atualização das caixas) | A cor das plataformas muda com a novidade | Só nos sistemas de bugs (fora do escopo) |

`memo[id]` também alimenta o cartão de memória da página. Isso pode ficar (é um registro para quem assiste); o que
sai é usar `memo` para decidir.

## Parte 1: decidir só com os sentidos

### P1.1 A chave

- `const SENTIDOS = /[?&]sentidos=1\b/.test(location.search)` em `web/index.html`, perto de `HEADLESS`, com `\b`
  escrito de verdade (ver armadilha do `\b` no `AGENTS.md`). Depois de validado (P1.5), o padrão vira "só sentidos"
  e `?sentidos=0` volta aos atalhos, para comparar.
- Aplica-se só com `APP.mundo`. Nos sistemas de bugs, nada muda.
- No laboratório e nos scripts, passar a chave pela URL.

### P1.2 Alvo do voo

Hoje: `sbEscolheAlvo` escolhe um objeto e `f.pouso` recebe o centro dele; a aproximação vira para esse ponto
(`clamp(a * 6, -8, 8)`); o pouso acontece em cima da forma (`sbAlturaObjeto`).

Só sentidos:
1. **Direção pelos olhos.** Com os olhos reais (`OLHO`, sandbox): o mapa `OLHO.obj[olho][omatídeo]` (o que é mais
   claro que o resto do olho) e as direções dos omatídeos (`OLHO.mapa.direcao`, de `web/data/olho_mapas.json`) dão o
   azimute e a elevação da maior mancha de "objeto" em cada olho. Sem os olhos reais (página 2D, `?olhos=0`), usar
   `f.seen` de `see()` (direção e tamanho aparente de cada coisa no campo dos olhos), **sem** o peso da novidade.
   O voo segue essa direção a cada instante (servo visual), em vez de ir a um ponto guardado.
2. **Cheiro decide se vale ir.** Durante o voo, as antenas sentem o cheiro onde ela está (`smellAt` nas antenas). A
   virada soma a diferença entre as antenas, como no andar (`chemo`), e a atração vem de `f.inata` e da atração
   aprendida do cheiro atual (`f.atrAprendida`), nada de `memo[id]`.
3. **Pousar.** Desce quando há uma superfície embaixo (a altura sob ela, `sbSurface(f.x, f.y)`, conta como o que a
   parte de baixo dos olhos vê) **e** o cheiro atraente está forte (acima de um limiar, a definir medindo) ou parou de
   crescer (chegou perto da fonte). Sem nada disso em `VOO_MAX`, pousa onde estiver (como hoje).
4. Remover `f.pouso.id` / `P.r` nesse modo; o evento `pouso` passa a registrar o que ficou embaixo depois de pousar
   (`rects` só para registrar, não para decidir).

Critério: com a chave ligada, na Cozinha 3D com o corpo simples, em 5 rodadas de ~100 s, ela ainda pousa em frutas e
come (anotar quantas vezes, contra o modo com atalhos). Pode piorar; o número vai para o README.

### P1.3 Decolar

Hoje: `sbWantsFly` sorteia com probabilidade `novel ? 0.15 + 0.35·fome : 0.05`, onde `novel` lê a lista.

Só sentidos: a chance cresce com (a) objeto grande no campo dos olhos acima do nível dela (o que está alto e ela
vê), (b) fome, (c) cheiro atraente presente mas sem aumentar enquanto anda (não está chegando à fonte). Manter a
decolagem de fuga (fibra gigante) e o reflexo tarsal como estão.

### P1.4 Sem novidade escondida na Cozinha

Com a chave ligada e `APP.mundo`: `see()` usa novidade 1 para tudo; `press()` não mexe na visão. O que evita voltar
à fruta vazia passa a ser o cérebro: comer reforça o cheiro (PAM), provar comida que acabou marca decepção (PPL1,
`checkOmission`), e a saciedade (a fome é regra) reduz o açúcar. Medir se ela fica presa numa fruta vazia; se ficar,
isso é resultado (o mapa não resolve) e a solução vira regra declarada.

### P1.5 Validar e trocar o padrão

- Cinco rodadas por modo (atalhos e só sentidos), corpo simples, Cozinha 3D, ~100 s de relógio cada, com
  `scripts/andar_medida.mjs` (ou um irmão dele): refeições, voos, pousos em comida, tempo até a primeira refeição,
  fome no fim, fração do tempo voando. Mais uma rodada de cada com o corpo físico.
- Gravar em `docs/medicoes/sentidos-comparacao.json`. Se o modo só sentidos ainda come e pousa em comida, vira o
  padrão; README e página explicam a diferença.

## Parte 2: medir o andar contra moscas reais

### Alvos da literatura (conferidos em 27/09/2026)

**Ressalva confirmada na retomada:** Valente et al. apresenta uma única mosca durante duas horas e declara que os resultados não generalizam o comportamento da espécie. Usar seus números como referências exploratórias. Fonte: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0001083. Geurten et al. analisou 103 moscas e usou agrupamento das velocidades para o orçamento de tempo; nosso medidor por limiares não é metodologicamente idêntico. Mendes et al. selecionou 71 vídeos de trajetos retos sem pausas; a faixa de velocidade descreve médias por vídeo, não todo comportamento natural (https://pmc.ncbi.nlm.nih.gov/articles/PMC3545443/).

As condições mudam os números (arena, luz, fome, sexo). O alvo é cair **dentro da faixa** relatada, não acertar um
número. Cite a fonte no README quando usar.

| Medida | Moscas reais | Fonte |
|---|---|---|
| Velocidade ao andar | picos em ~14,8 mm/s (centro da arena) e ~11,4 mm/s (junto à parede) | Valente et al. 2007, PLoS One 2:e1083 (arena de 15 cm, 25 Hz) |
| Faixa de velocidade | 7,2 a 44,7 mm/s; passada de ~60 ms (16 Hz) acima de ~30 mm/s; trípode acima de ~34 mm/s | Mendes et al. 2013, eLife 2:e00231 |
| Duração dos trechos andando | exponencial, constante de ~2,1 s (centro) e ~1,37 s (parede) | Valente et al. 2007 |
| Paradas | ~76% duram menos de 0,3 s (parede); no centro, algumas passam de 5 s | Valente et al. 2007 |
| Depois de parar | na maioria das vezes segue na mesma direção (reorientação ~0) | Valente et al. 2007 |
| Viradas | "sacadas" de ~15° em 40 a 120 ms (mediana 90 ms), acima de 200°/s; entre elas o rumo quase não muda | Geurten et al. 2014, Front Behav Neurosci 8:365 |
| Orçamento de tempo | parada 63%, andando reto 29%, virando 9% (numa arena, sem comida) | Geurten et al. 2014 |
| Depois de comer | com fome, faz "busca local": sai e volta à comida em laços | Corfas, Sharma e Dickinson 2019, Curr Biol 29:1660 |
| Comer | goles, rajadas de goles e sessões (flyPAD) | Itskov et al. 2014, Nat Commun 5:4560 (números a conferir antes de usar) |

### P2.1 Medidor

`scripts/andar_medida.mjs` (versionado): abre a página sem janela (perfil em `_tmp/`, apagado no fim), Cozinha,
3D, corpo simples (ou físico com `--fisico`), `LAB.busy = true`. Amostra a cada tique do cérebro (10 ms) embrulhando
`stepBody` (é global): `const sb0 = stepBody; stepBody = (dt, c) => { sb0(dt, c); registra(); }`. Registra `x, y, z,
th, flying, marcha, naParede, boca, fome`. Calcula:
- frações do tempo: andando (> 2 mm/s), parada, virando (|dθ/dt| > 200°/s), voando, comendo (boca estendida);
- velocidade andando: mediana, p10, p90 (mm/s; px / `CORPO.S`);
- trechos andando e paradas: média, mediana, fração de paradas < 0,3 s, fração > 5 s;
- viradas rápidas: quantas por segundo andando, amplitude e duração;
- reorientação depois de cada parada.
Grava `docs/medicoes/andar-vs-moscas.json` com os alvos acima ao lado. Rodar primeiro **antes de mudar qualquer
coisa** (linha de base) e de novo depois de cada ajuste.

### P2.2 Calibrar

O que pode mudar (regras do corpo, declaradas): a velocidade de andar (`WALK` em `web/index.html`, px/s), a regra de
pausas (`CorpoNatural.marcha` em `web/corpo-natural.js`: hoje durações sorteadas uniformes, andar 0,8–3,2 s e
pausa/giro 0,15–0,65 s, 45% de giro), e a forma das viradas (hoje a virada é contínua; nas moscas, sacadas curtas).
Sugestões, a validar com o medidor:
- durações exponenciais (andar: média ~1,5–2 s; parada: maioria curta, cauda longa);
- viradas em sacadas: juntar a virada pedida pelo cérebro (`turn` em `stepBody`) e soltá-la em pulsos de ~90 ms
  acima de 200°/s, mantendo o sentido e o total pedidos pelo cérebro;
- depois de uma parada, seguir no mesmo rumo.
Não mexer no cérebro. Conferir que comer, fugir e voar continuam funcionando (`scripts/realismo_sandbox_teste.mjs`,
`scripts/corpo_natural_teste.mjs`).

### P2.3 (opcional) Busca local depois de comer

Corfas et al. 2019: depois de achar comida, moscas com fome fazem laços de ida e volta, contando a distância andada.
Seria regra (o circuito não é conhecido no nível de ligação); só fazer se o usuário quiser.

## Como testar (resumo)

- Página: `python scripts/servir.py` (um só servidor na 8765); corpo: `.venv/Scripts/python.exe -X utf8
  corpo/servidor.py 8766` (um só na 8766). Confira com `netstat -ano | grep -E ":876[56]"`.
- `node scripts/corpo_natural_teste.mjs` (regras, rápido), `node scripts/realismo_sandbox_teste.mjs` (integrado).
- Um cérebro no Chrome sem janela leva ~20 s para carregar e usa 1,5–2 GB: rode um teste de navegador por vez.
- Scripts temporários começam com `_` (fora do git). Exemplos úteis na raiz, se ainda existirem: `_livre.mjs` (solta
  na Cozinha e conta refeições e voos), `_sonda2.mjs` + `_sonda_*.js` (roda um trecho de JS na página já aberta).
