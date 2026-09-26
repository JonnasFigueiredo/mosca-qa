# Mosca QA

O conectoma completo do sistema nervoso central de uma mosca-da-fruta macho (166.700 neurônios, HHMI Janelia, 2026), simulado no navegador. A mosca caça bugs em sistemas fictícios: vê a tela, anda até os elementos, prova cada um com a probóscide e é recompensada quando acha um bug novo. Ela treina num painel de Pedidos e é testada num sistema Financeiro que nunca viu.

## Rodar

A página precisa de um servidor local (o navegador não carrega os dados via `file://`):

```bash
python -m http.server 8765 --directory web
```

Abra http://localhost:8765. O cérebro leva uns 20 segundos para carregar.

## Estrutura

- `web/index.html`: a página (a mosca, o cérebro em 3D, o relatório de bugs, a memória, o laboratório)
- `web/sistemas.js`: os sistemas em teste (Pedidos e Financeiro) e os bugs plantados
- `web/olhos3d.js`: a aba "Pelos olhos dela" (a tela em 3D, os campos de visão e o olho composto)
- `web/sandbox.js`: o modo Sandbox 3D (plataformas, voo e o visual de Matrix)
- `web/sim-worker.js`: a simulação, numa thread separada
- `web/data/`: o conectoma empacotado para o navegador (base64, ~26 MB)
- `scripts/`: o processamento em Python que gera `web/data/` a partir dos dados do Janelia
- `corpo/`: o corpo físico opcional (servidor local com a NeuroMechFly no MuJoCo); `corpo/terceiros/` tem o controlador de passada do flygym (Apache 2.0)

## Refazer os dados

Precisa de Python 3.12 com `pandas`, `pyarrow`, `numpy` e `scipy`.

1. Baixe para `data/raw/` três arquivos de https://male-cns.janelia.org/download/:
   - `body-annotations-male-cns-v1.0-minconf-0.5.feather`
   - `body-neurotransmitters-male-cns-v1.0.feather`
   - `connectome-weights-male-cns-v1.0-minconf-0.5.feather` (1,1 GB)
2. Rode, dentro de `scripts/`:

```bash
python 01_filter_edges.py
python 02_build_web.py
```

## O modelo

- **Neurônios:** integra-e-dispara, com os parâmetros de Shiu et al. (Nature, 2024), passo de 0,25 ms.
- **Conexões:** as 6,2 milhões com 5 ou mais sinapses. O sinal vem do neurotransmissor previsto (acetilcolina excita; GABA, glutamato e histamina inibem).

### Calibrações

Este mapa tem mais que o dobro de sinapses do usado em 2024. Sem estes ajustes o cérebro inteiro dispara junto:

- Peso sináptico de 0,5 × o original.
- Adaptação lenta: 0,3 mV por disparo, com constante de 1 s.
- Sem as conexões excitatórias entre PNs e LNs do lobo antenal, que num modelo de neurônio-ponto viram um eco que nunca desliga.
- Sem autapses.

### Os sistemas e o cheiro

- Cada elemento clicável tem um cheiro feito de duas partes: **notas da sua função** (rede, cálculo, formulário, lista, navegação; dois glomérulos fortes cada) e um **par próprio** de glomérulos, único entre todos os elementos dos dois sistemas.
- No cérebro simulado, elementos com a mesma função dividem de 18% a 53% das células de Kenyon, mesmo em sistemas diferentes. Funções diferentes não dividem nenhuma.
- É uma metáfora: o cheiro representa pistas do que o elemento faz.
- Nos dois sistemas os bugs se concentram em rede e cálculo (4 de 5 em cada um).

### Visão

- Uns 105 mil dos neurônios do mapa são visuais, com a posição de cada coluna do olho.
- A página não simula a retina: a primeira etapa da visão (L1–L3, Mi1, Tm3) funciona com voltagem graduada, e um modelo de disparos não a reproduz bem.
- Em vez disso, cada olho liga o **LC10a** daquele lado (135 à esquerda, 140 à direita), um detector de objetos pequenos, na proporção do que vê. Cada elemento conta pelo tamanho aparente; o que ela já provou conta menos (habituação). Nos machos reais o LC10a é o que segue a fêmea na corte.
- A direção sai do cérebro: a diferença entre DNa01–03 da esquerda e da direita vira a mosca, e esses neurônios têm tônus de 7,3 mV, como numa mosca andando.
- `scripts/visao_teste.py` testa as famílias de neurônios de projeção visual uma a uma (resultado em `docs/medicoes/visao-triagem.json`). O LC10a de um olho liga o DNa02 do mesmo lado em ~90 Hz: vira a mosca para o que ela vê.
- `?olhos=0` na URL desliga a visão e volta à regra antiga de curiosidade, para comparar.

### Sandbox 3D

- No modo **Sandbox 3D** o sistema vira um mundo de plataformas, uma por grupo de elementos da mesma função, em alturas diferentes. Ela anda por cima delas e voa entre elas.
- **Decolagem:** de fuga, quando a fibra gigante (DNp01) dispara. Um bug que estoura cresce na frente dela e liga os detectores de ameaça (LPLC2, LC4). Também decola por uma regra do corpo, na beira de uma plataforma ou diante de uma mais alta, se houver algo novo para ver.
- **No ar:** a direção vem dos DNa01–03, como no chão. É uma simplificação: numa mosca real, o voo usa outros descendentes também. A altura e o pouso (perto de algo que ela ainda não provou) são regras do corpo.
- O visual (grade neon, chuva de código, glitches vermelhos) é só para quem assiste. Os sentidos dela são os mesmos da página, agora com altura: cheiro, olhos e gosto nas patas.
- A tela mostra o mundo (câmera de espectador, olhos compostos e mapa) ao lado do cérebro, com os neurônios acendendo.

### Corpo físico (opcional)

- **O corpo:** a NeuroMechFly (flygym 2.1, EPFL), que vem de um micro-CT de uma mosca real, roda no MuJoCo com 42 articulações nas patas. No sandbox, a malha real anda por cima das plataformas, na escala de 7 px por mm (~18 px de mosca).
- **As patas:** o controlador híbrido do exemplo oficial do flygym. Ele junta um gerador de ritmo trípode, passadas **gravadas de moscas reais** (vídeo 3D com DeepFly3D) e reflexos de tropeço e de pata no vazio.
- **Cérebro e corpo:** o cérebro manda o sinal descendente `[esquerda, direita]`, que é a virada dos DNa01–03 e a velocidade que ela quer. A física avança até o tempo do cérebro; se o corpo atrasar, o cérebro espera.
- **Medido neste PC:**
  - 13,5 mm/s em linha reta (moscas reais: por volta de 10–20 mm/s);
  - ~150°/s nas curvas;
  - ré com sinal negativo;
  - a física a ~0,4× o tempo real (passo de 0,2 ms, controlador a 500 Hz), mais rápida que o cérebro (~0,3×). A 250 Hz as curvas caíam pela metade.
- **Modo híbrido:** no chão, a física move as patas. Na beira de uma plataforma ela decola ou dá meia-volta (regra do corpo). No ar, voa como no modo simples, inclusive a decolagem de susto pela fibra gigante. Ao pousar, o corpo físico é recolocado ali.
- **Limites:**
  - ainda não há física de voo nem de salto: no ar ela usa o modelo simples;
  - as plataformas não existem na física: a página cuida da altura e das beiradas;
  - quem move as patas é o controlador, não o cordão nervoso do conectoma.

- **Tato:** a força de contato de cada pata liga os neurônios táteis (cerdas) daquela pata, pelo nervo por onde eles entram no cordão nervoso: ProLN, MesoLN e MetaLN, de cada lado, com 115 a 428 neurônios por pata. A força inclui a adesão das almofadinhas das patas. Por enquanto, o toque aparece no cérebro, mas não muda o comportamento.
- **Olhos reais (no sandbox):** o modelo de olho composto do flygym, com 721 omatídeos por olho, câmera de 157° com correção de olho de peixe e omatídeos "amarelos" (canal verde) e "pálidos" (canal azul). O mundo 3D é renderizado pelas câmeras presas aos olhos da malha, que balançam com o passo, e cada pixel soma no seu omatídeo (`corpo/olho_mapas.py` gera a tabela). O HUD mostra essa imagem. O LC10a de cada olho recebe os omatídeos mais claros que o resto do olho, e o que ela ainda não provou brilha mais no mundo. Essa última etapa ainda é regra nossa: não simulamos fotorreceptor → LC, e o LC10a de cada olho recebe um total, não o campo receptivo de cada célula.

Para rodar:

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install flygym
.venv/Scripts/python.exe corpo/servidor.py
```

Depois, no Sandbox 3D, clique em "Corpo físico". O servidor grava a malha em `web/data/corpo_malha.*` na primeira vez. Os scripts `corpo/andar_teste.py` e `scripts/corpo_teste.py` medem a passada e a velocidade da física.

### Voo físico (em andamento)

O FlyBody (Janelia/DeepMind), que vem no flygym 2.1, tem asas articuladas. Os testes estão em `corpo/voo_*.py` e `docs/medicoes/voo-*.json`.

- **Consertos no FlyBody do flygym:**
  - recolocamos nas asas os elipsoides de fluido do flybody original (o modelo de forças do ar do MuJoCo), que o flygym descarta;
  - corrigimos o ar: o flygym deixa a densidade e a viscosidade do flybody em unidades de cm num modelo em mm, o que dá um ar 1000× mais denso que o real;
  - tiramos a armadura das asas (30× a inércia da asa), que exigia torques enormes para bater a 218 Hz;
  - deixamos só as asas articuladas: as juntas passivas levíssimas vibravam até a simulação explodir.
- **Sustentação:** uma busca automática achou batidas de asa que sustentam 1,1× o peso, com pouco torque de empinar.
- **Estabilidade:** um reflexo de estabilização (o papel dos halteres) segura a atitude por ~0,11 s (~25 batidas), mas ainda não mantém o voo. No flybody original, o voo usa um controle treinado por aprendizado por reforço, que não vem no pacote.
- **Por isso,** no sandbox, o voo ainda usa o modelo simples.

### Aprendizado

- **Recompensa:** um bug novo ativa os neurônios de dopamina de recompensa (PAM dos compartimentos γ5, β'2, β2, γ4 e α1), que enfraquecem as sinapses Kenyon → 30 saídas "evitar". Aquele cheiro passa a atrair. Um bug que já está no relatório não dá nada.
- **Decepção:** provar um elemento que cheirava a bug e não achar bug novo ativa a dopamina PPL1 (PPL101 a PPL106), na proporção do que ela esperava. Isso enfraquece as sinapses Kenyon → 48 saídas "aproximar" e cancela parte da atração. Em moscas reais, sentir sem açúcar um cheiro que dava açúcar forma uma memória oposta assim (Felsenberg et al., Cell 2018).
- **Fome:** a mosca começa com fome de bug; cada bug novo a sacia em 30%, e a fome volta em ~80 s. Só com fome o cheiro aprendido atrai.
- **Esquecimento e consolidação:** a sinapse mudada volta aos poucos à força original. Cada episódio de dopamina consolida a memória.
- **Extinção:** sentir o cheiro de novo sem dopamina acelera o esquecimento.
- **Tônus de base:** os neurônios de saída ficam perto do limiar, como os reais.
- **Memória entre visitas:** opcional, guardada no navegador (sinapses mudadas e consolidação).

### O que é simplificação

- **Direção do passo:** com os olhos, vem do cérebro (LC10a → DNa01–03). O cheiro ainda usa uma regra do corpo: quando o cheiro aprendido atrai, ela vira para o lado em que ele está mais forte (a diferença entre as antenas); quando repele, para o outro.
- **Entrada dos olhos:** o quanto cada olho vê é calculado pela página (tamanho aparente e habituação), não pela retina simulada.
- **Decisão de ir atrás:** lê o saldo das sinapses do cheiro atual, não o disparo dos neurônios de saída.

A memória está nas sinapses da simulação; a ponte entre memória e movimento é simplificada.

Tentamos tirar a ponte do cheiro (`scripts/fase3_teste_direcao.py`, resultados em `docs/medicoes/fase3-direcao.json`). Os caminhos existem no mapa: as saídas do corpo cogumelar chegam em 1 ou 2 passos a DNa02, DNa03 e MDN. Mas, mesmo zerando as sinapses de um cheiro, a direção muda menos de 1 Hz (o próprio cheiro produz 7 Hz), e o MDN não muda nas condições da página. Cada antena projeta para os dois lados, então o corpo cogumelar informa valência, quase nada de direção. A visão, que sabe onde as coisas estão, vira a mosca pelo próprio mapa.

### Laboratório

A página tem um laboratório (link no rodapé, ou `#lab`), e `scripts/lab_headless.mjs` roda os mesmos testes num Chrome sem janela. Nos dois testes, as moscas comparadas começam no mesmo ponto da tela em cada rodada.

- **Transferência:** três moscas caçam bugs no Financeiro.
  - **Ingênua:** cérebro novo.
  - **Controle:** passou 120 s no Pedidos e achou bugs, mas sem recompensa.
  - **Treinada:** o mesmo, com recompensa.
- **Bloqueio:** a mesma tela e o mesmo ponto de partida. Numa mosca a dopamina de recompensa (PAM) funciona; na outra está silenciada, como nos experimentos que desligam esses neurônios em moscas reais.

As medições estão em `docs/medicoes/` (fase 4).

### Resultados (setembro de 2026)

| Teste | Com aprendizado | Sem aprendizado |
|---|---|---|
| Bloqueio no Pedidos, 120 s, 5 pontos de partida | 4,4 bugs; achou o P4 em 2 de 5 | 4,0 bugs; P4 em 0 de 5 |
| Treino no Pedidos, 120 s, mesmo ponto (olhos v2) | P4 em 4 de 5 | P4 em 0 de 5 |
| Bloqueio no Financeiro, 90 s, sem olhos | 3,2 bugs | 4,0 bugs |
| Bloqueio no Financeiro, 90 s, olhos v1 | 3,4 bugs | 2,8 bugs |
| Bloqueio no Financeiro, 90 s, olhos v2 e cheiro de 60 px | 3,4 bugs | 3,8 bugs |
| Transferência para o Financeiro, 60 s, olhos v2 | treinada 1,8 bugs | ingênua 2,4 · controle 2,4 |

O que isso quer dizer:

- **Ela acha bugs:** de 2 a 5 dos 5, em 60 a 120 s, sobretudo explorando.
- **Dentro do mesmo sistema, aprender ajuda quando o padrão se repete perto.** O P3 e o P4 são os dois de cálculo, lado a lado. Depois de achar um, ela vai atrás dos outros elementos de cálculo e acha o P4 (6 de 10 vezes), que a exploração sozinha não alcançou (0 de 10).
- **Num sistema novo, não ajudou.** Nas sinapses, a transferência existe: os elementos de rede do Financeiro chegam com 50–63% do valor aprendido. Mas o que ela aprende é um cheiro, e cheiro só se sente a ~40 px. Os olhos veem de longe, mas não sabem o que ela aprendeu.
  - A via visual do corpo cogumelar existe no mapa, mas no modelo acende só 2 a 5 das ~4 mil células de Kenyon (`scripts/visao_kc.py`).
  - Um cheiro de alcance maior (60 px) também não ajudou.
- **Aprender com um exemplo engana.** No Financeiro, o primeiro bug costuma ser o de lista, o único de lista. Ela passa a esperar bug nos outros elementos de lista e se decepciona 5 a 7 vezes por sessão. Treinada no Pedidos, que tem um bug de menu, ela chega ao Financeiro esperando bug nos 11 itens de menu.
- **O controle e o ponto de partida pareado mudaram as conclusões.** Sem eles, as primeiras rodadas pareciam mostrar transferência (treinada 4 bugs, ingênua 1,5), o que era efeito de onde cada mosca começava.

Pontos de partida diferentes mudam muito o resultado (de 1 a 5 bugs), então cada comparação usa rodadas pareadas. Mesmo assim, 5 rodadas por condição só separam efeitos grandes.

## Créditos

- **Dados:** [FlyEM Male CNS v1.0](https://male-cns.janelia.org/), HHMI Janelia, licença CC-BY 4.0.
- **Modelo:** Shiu et al. 2024, *A Drosophila computational brain model reveals sensorimotor processing*, Nature.
- **LC10a na corte:** Ribeiro et al. 2018, *Visual projection neurons mediating directed courtship in Drosophila*, Cell; Hindmarsh Sten et al. 2021, *Sexual arousal gates visual processing during Drosophila courtship*, Nature.
- **DNa02 e a direção:** Rayshubskiy et al. 2020, *Neural control of steering in walking Drosophila*, bioRxiv.
- **Corpo:** NeuroMechFly v2 e flygym, Wang-Chen et al. 2024, *NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila*, Nature Methods. O controlador em `corpo/terceiros/` é do repositório do flygym (Apache 2.0).
- **Decepção:** Felsenberg et al. 2018, *Integration of parallel opposing memories underlies memory extinction*, Cell.
- Os sistemas Pedidos e Financeiro são fictícios e os bugs foram plantados de propósito.
