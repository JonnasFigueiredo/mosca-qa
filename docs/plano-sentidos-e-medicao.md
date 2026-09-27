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
- [~] P1.2 Alvo do voo pelos olhos e pelo cheiro, sem a lista de objetos (feito com a visão aproximada; falta usar os olhos reais)
- [~] P1.3 Decolagem pelos sentidos (feito; voa menos que com atalhos, calibrar)
- [x] P1.4 Sem "novidade" escondida na Cozinha
- [~] P1.5 Validação dos dois modos (preliminar: 2 e 3 rodadas; falta rodar 5 por modo, com os olhos reais, e decidir o padrão)
- [~] P2.2 Calibrar pausas, velocidades e viradas contra os alvos da literatura (velocidade feita; faltam pausas e viradas)
- [ ] P2.3 (opcional) Busca local depois de comer
- [ ] Final: README, texto da página, `AGENTS.md`, commit

Notas do último passo:

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

Próximos passos, nesta ordem:
1. P2.2, pausas: em `CorpoNatural.marcha` (`web/corpo-natural.js`), durações exponenciais (andar com média ~1,5–2 s;
   parada com a maioria < 0,3 s e cauda longa, algumas > 5 s) e a pausa não ser desligada por qualquer aversão
   (`f.aversion > 0.3` desliga hoje; perto da laranja mofada ela nunca para). Ajustar o teste
   `scripts/corpo_natural_teste.mjs` se a regra mudar.
2. P2.2, viradas: em `stepBody` (`web/index.html`, `let turn = ...`), juntar a virada pedida (visão/cérebro, cheiro,
   ruído) e soltá-la em sacadas de ~90 ms acima de 200°/s, com o rumo quase parado entre elas; o sentido e o total
   continuam os do cérebro. O ruído de hoje (`(Math.random() - 0.5) * 2.2`) é grande: medir sem ele.
3. P1.2 com os olhos reais: no sandbox desenhado, trocar `f.seen` pela maior mancha de `OLHO.obj` (direção pelos
   omatídeos, `OLHO.mapa.direcao`). `f.seen` continua como reserva (página 2D, `?headless=1`, `?olhos=0`).
4. P1.5: 5 rodadas por modo com `scripts/andar_medida.mjs --sentidos` (ele conta `comeu`/`pouso` em `eventos`) e sem
   `--sem-olhos`, gravar em `docs/medicoes/sentidos-comparacao.json`. Se o modo só sentidos comer fruta e pousar em
   comida com frequência razoável, virar o padrão (e `?sentidos=0` volta aos atalhos). Atualizar README e página.


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
