# Mosca QA

O conectoma completo do sistema nervoso central de uma mosca-da-fruta macho (166.700 neurônios, HHMI Janelia, 2026), simulado no navegador. A mosca caça bugs em sistemas fictícios: vê a tela, anda até os elementos, prova cada um com a probóscide e é recompensada quando acha um bug novo. Ela treina num painel de Pedidos e é testada num sistema Financeiro que nunca viu.

## Rodar

A página precisa de um servidor local (o navegador não carrega os dados via `file://`):

```bash
python scripts/servir.py
```

Abra http://localhost:8765. O cérebro leva uns 20 segundos para carregar. O `servir.py` manda o navegador conferir os arquivos a cada carga; com o `python -m http.server` comum, depois de uma mudança o navegador pode continuar rodando os `.js` antigos. Ele também responde em HTTP/1.1: no HTTP/1.0 padrão do Python, o servidor fecha a conexão logo depois de mandar o arquivo, e no Windows isso cortava o fim de alguns downloads (6 de 30 em paralelo; no navegador, "network error" ou "Failed to fetch"). Rode um servidor só: dois na mesma porta dividem os pedidos entre si.

## Estrutura

- `web/index.html`: a página (a mosca, o cérebro em 3D, o relatório de bugs, a memória, o laboratório)
- `web/sistemas.js`: os sistemas em teste (Pedidos e Financeiro) e os bugs plantados
- `web/olhos3d.js`: a aba "Pelos olhos dela" (a tela em 3D, os campos de visão e o olho composto)
- `web/sandbox.js`: o modo Sandbox 3D (plataformas, voo e o visual de Matrix)
- `web/corpo-natural.js`: geometria de referência e regras de contato, extensão da boca e pausas na Cozinha 3D
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
   Para as formas reais do cérebro 3D, os esqueletos vão para `data/raw/esqueletos/` (ver "Formas reais no cérebro 3D"; `scripts/esqueletos_web.py` os converte).
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

### Desempenho

O simulador (`web/sim-worker.js`) só calcula os neurônios fora do repouso e só propaga os disparos que existem. A página manda `worker.postMessage({ type: 'perf', on: true })` para medir o tempo de cada parte (propagação, entradas, integração, aprendizado, espera); `scripts/worker_teste.mjs` roda o worker no Node, com os dados reais e um estímulo fixo, e compara as taxas de disparo de cada grupo entre versões.

- **O gargalo era a integração** (~95% do tempo): 37 a 88 ns por neurônio por passo, porque cada neurônio ativo lia 5 vetores separados, em ordem salteada.
- **O que mudou:** o estado de cada neurônio fica junto na memória (8 floats) e os ativos são percorridos em ordem crescente, por um mapa de bits; o próximo bloco de 10 ms é agendado por `MessageChannel`, sem a espera mínima de 4 ms do `setTimeout` encadeado (~0,47 s por segundo de cérebro); a adaptação decai de uma vez quando o neurônio acorda, em vez de mantê-lo ~2 s no laço; um neurônio conta como parado a 0,05 mV do repouso (antes 0,005; o limiar está 7 mV acima).
- **Resultado** (página, rodadas alternadas com a versão anterior, o PC ocupado): de 0,33–0,35× para 0,65–1,2× o tempo real; neurônios no laço de 14–15 mil para 6–9 mil. As taxas de disparo de cada grupo no teste do Node ficaram iguais dentro do ruído (Kenyon 0,35 Hz, MBONs ~2,9 e 2,2 Hz, probóscide 7–8 Hz, DNa ~27 Hz).

### Os sistemas e o cheiro

- Cada elemento clicável tem um cheiro feito de duas partes: **notas da sua função** (rede, cálculo, formulário, lista, navegação; dois glomérulos fortes cada) e um **par próprio** de glomérulos, único entre todos os elementos dos dois sistemas.
- No cérebro simulado, elementos com a mesma função dividem de 18% a 53% das células de Kenyon, mesmo em sistemas diferentes. Funções diferentes não dividem nenhuma.
- É uma metáfora: o cheiro representa pistas do que o elemento faz.
- Nos dois sistemas os bugs se concentram em rede e cálculo (4 de 5 em cada um).

### Formas reais no cérebro 3D

- Cada ponto do cérebro 3D é um neurônio, no corpo celular. Os 954 que mais contam na página aparecem também com a **forma real**: o esqueleto traçado no Male CNS v1.0 (olhos LC10a, detectores de ameaça LPLC2 e LC4, direção DNa01-03, fuga DNp01/02/04/11, MDN, probóscide e gosto doce, MBONs, dopamina PAM e PPL1), coloridos por função, que ficam brancos quando o neurônio dispara. O botão "Formas reais" liga e desliga.
- **Dados:** os esqueletos (formato `neuroglancer_skeletons`, 40,6 MB) vêm de `storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-precomputed/`, um arquivo por neurônio, em `data/raw/esqueletos/` (fora do git). As malhas 3D também existem, mas pesam ~100× mais (2,7 MB um único LC10a).
- **Simplificação** (`scripts/esqueletos_web.py`): nm → µm no referencial dos pontos (o deslocamento sai dos corpos celulares), galhos terminais com menos de 4 µm podados, um ponto a cada 5 µm nos ramos, bifurcações mantidas: de 2 milhões para 298 mil vértices, 4 MB em `web/data/esqueletos.b64.txt`. O alinhamento confere: o corpo celular cai a 0,8 µm do esqueleto na mediana (90% até 1,4 µm).

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
- **No ar:** o voo é comandado pelos neurônios motores das asas (ver "Voo pelos motores das asas"). A altura e o pouso (perto de algo que ela ainda não provou) são regras do corpo.
- O visual (grade neon, chuva de código, glitches vermelhos) é só para quem assiste. Os sentidos dela são os mesmos da página, agora com altura: cheiro, olhos e gosto nas patas.
- A tela mostra o mundo (câmera de espectador, olhos compostos e mapa) ao lado do cérebro, com os neurônios acendendo.
- **Fantasma:** uma câmera livre, como o espectador livre de um jogo de tiro. W/S vai para onde se olha, A/D para os lados, o mouse olha (clique para prender o mouse, Esc solta; ou arraste), Espaço/E sobe, C/Q desce, Shift acelera, a roda muda a velocidade e F leva a câmera para perto dela. Atravessa tudo e não aparece para os olhos dela; com o louva-a-deus ligado, as teclas movem a câmera, não o louva-a-deus.
- **Ampliar** deixa o sandbox na largura toda, com o cérebro embaixo (a escolha fica guardada no navegador). **Tela cheia** mostra só o sandbox.
- **As cores dos olhos:** a imagem dos olhos compostos mostra as cores que os receptores dela captam, não mais o verde e o azul de cada tipo de omatídeo. Ela não tem receptor de vermelho: os R8 "amarelos" (Rh6, ~508 nm) dão o verde dela e os "pálidos" (Rh5, ~437 nm), o azul. Na tela, esses dois canais viram um mundo azul e amarelo, como numa simulação de daltonismo: o branco continua branco e o vermelho escurece (o morango fica quase preto). Ela também vê ultravioleta (R7), mas a cena desenhada só tem vermelho, verde e azul. Os pesos de cada cor da tela em cada receptor (`corMosca`, em `web/olhos3d.js`) são aproximados. É só a imagem: o LC10a continua recebendo o brilho de cada omatídeo (canal verde nos amarelos, azul nos pálidos, como no flygym). A mancha vermelha marca onde os LC10a respondem, e vermelho ela não vê.

### O mundo natural: a Cozinha

Um terceiro "sistema" que não é software: um pedaço de 20 × 20 cm de bancada de cozinha, o habitat da *Drosophila melanogaster*, na escala dela (2,5 mm de mosca). Na página é a bancada vista de cima; no sandbox 3D, cada coisa tem o tamanho real, com a janela ao fundo.

- **O que tem:** banana madura, uvas, pêssego passado e morango (com açúcar para comer), uma laranja mofada, uma tampa com vinagre, açúcar derramado, gotas d'água e folhas de manjericão (`web/sistemas.js`).
- **Os cheiros são reais:** cada coisa liga os glomérulos que respondem a ela em moscas de verdade:
  - fermentação e vinagre: DM1, VA2, DM4, DP1m (Semmelhack e Wang 2009; Ai et al. 2010);
  - ésteres de fruta: DM2 (Or22a) e DM3 (Or47a);
  - geosmina, o cheiro de mofo: só o DA2 (Stensmyr et al. 2012);
  - limoneno, da casca da laranja: DC1 (Or19a; Dweck et al. 2013).

  O alcance do cheiro é o de cada coisa (20 a 40 mm), e a fruta fermentando e o vinagre cheiram mais longe.
- **Atração inata (regra nossa, da literatura):** com fome, cheiro de fruta e de fermentação puxa (DM1 e VA2 mais forte); geosmina (DA2) e CO2 (V) afastam, mesmo de barriga cheia. A atração aprendida soma por cima.
- **Comer vem do cérebro:** pisando em algo com açúcar, os neurônios de açúcar das patas acendem e, no mapa, ligam os neurônios motores da probóscide; quando ela a estende, prova e come. Cada mordida dá açúcar e dopamina de recompensa (PAM), reforça o cheiro de onde comeu e tira 12% da fome. A fome regula a sensibilidade ao açúcar, como nas moscas reais (regra nossa): saciada, ela não estende a probóscide. A comida de cada coisa acaba.
- **Amargo:** o mapa não diz quais neurônios de gosto dos lábios são de amargo (os tipos LB1 a LB4 não têm modalidade anotada). Provar a laranja mofada liga a dopamina de punição (PPL1), que nas moscas reais responde a amargo, e ela aprende a evitar aquele cheiro.
- **Decepção:** provar comida que já acabou, ou o vinagre (cheira a fermentação, mas não tem açúcar), esperando comer, liga a PPL1 (Felsenberg et al. 2018).
- **Primeiras observações** (teste sem janela, corpo simples, 81 s de cérebro no 3D): comeu açúcar 7 vezes, voou até as uvas e comeu até acabar, voltou a elas vazias e se decepcionou, depois comeu pêssego (6), banana (3) e morango (2). Na página 2D, comeu açúcar, pêssego e banana e ficou saciada em 21 s.
- **As formas** (`sbFormas`, em `web/sandbox.js`; `docs/medicoes/formas-redondas.json`): o desenho 3D, a física e a altura usada pela página saem da mesma definição, então as bordas batem. As frutas são meias-cúpulas apoiadas no balcão (metade de um elipsoide: banana, pêssego, laranja, morango), as uvas são três meias-esferas e a tampa de vinagre é um cilindro. Açúcar, água e folhas são planos e ficam fora da física. Antes, na física, cada coisa era a caixa do tamanho do desenho: ela pisava no ar nos cantos da caixa, fora da fruta, e subia uma parede reta onde se via uma curva. Nada tem "barriga" embaixo: numa fruta inteira deitada, a mosca física teria de andar de cabeça para baixo, e as passadas gravadas no chão não fazem isso.
- **Limites:** o cheiro é uma nuvem parada em volta de cada coisa (sem vento nem turbulência); as frutas são meias-cúpulas lisas (sem cabinho, sem casca que descola); a comida não volta.

### Contato, probóscide e pausas na Cozinha 3D

Implementação em `web/corpo-natural.js`, integrada à página e à sandbox. O cérebro e seus parâmetros permanecem os mesmos.

**Limite das referências de caminhada:** [Valente et al. 2007](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0001083) analisa uma única mosca por duas horas numa arena de 15 cm; os autores explicitamente não generalizam esses números para a espécie. As constantes de duração e os 76% de pausas curtas são referências exploratórias. [Geurten et al. 2014](https://www.frontiersin.org/journals/behavioral-neuroscience/articles/10.3389/fnbeh.2014.00365/full) mediu viradas em 103 moscas e separou estados por agrupamento das velocidades; nosso limiar e nossas janelas não reproduzem integralmente esse método. [Mendes et al. 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3545443/) selecionou 71 vídeos de caminhada reta sem paradas: a faixa 7,2–44,7 mm/s corresponde às médias desses vídeos, não a limites universais de locomoção. Concordar com alguma média não valida o modelo nem torna as regras emergentes do conectoma.

- **Antenas:** os centros de referência dos funículos da NeuroMechFly ficam a 0,28418 mm entre si (antes, os pontos de amostragem estavam separados por 32 px = 4,57 mm). A posição e a altura entram no cálculo do cheiro; no corpo físico, vêm das peças da pose recebida. Sem malha, usa a mesma geometria de referência com o corpo ereto. Não houve aumento compensatório do ganho de virada pelo cheiro.
- **Gosto e alimentação são contatos diferentes:** as pontas dos tarsos alcançam o topo de um objeto e fornecem gosto. Na física, exige também força de contato naquela pata; sem física, os pontos de apoio são aproximados pela pose de pé. A saída `proboscide` acima do limiar já usado pela página comanda a extensão. Só há mordida com a boca estendida, alcance de até 1,15 mm da raiz e contato da ponta por 0,12 s cerebrais. Esses alcances, tolerâncias e tempos são parâmetros do corpo, ainda não calibrados contra vídeos de alimentação.
- **Animação:** as peças `c_rostrum` e `c_haustellum` se orientam e alongam entre raiz, dobra e ponta. É extensão geométrica, não uma simulação muscular nem preservação exata dos comprimentos articulares. As patas da frente fazem um breve tateamento visual; não são disparos de um circuito de tateamento. Sem malha, a boca aparece como uma peça simples. No corpo físico, a boca é uma sobreposição visual e o contato é geométrico; não aplica forças no MuJoCo.
- **Inércia da boca:** a boca estende quando a saída da probóscide passa de 25 Hz e só recolhe abaixo de 12 Hz (regra do corpo). Depois de duas mordidas, a saída adaptada do cérebro fica oscilando em volta de 25 Hz; sem a inércia, a boca abria e fechava pela metade a cada 100 ms e ela parava de comer. Com a inércia, parada no açúcar, ela prova por ~0,9 s, morde, recolhe e volta a provar (3 mordidas em 6 s; `docs/medicoes/realismo-livre.json`).
- **Velocidade:** na Cozinha 3D, o passo é de 105 px/s (15 mm/s), a mesma velocidade em mm/s da página 2D; antes era 42 px/s, e ela andava a ~5 mm/s medidos, contra ~11–15 mm/s das moscas reais (Valente et al. 2007). Agora a mediana medida é 9 mm/s (`scripts/andar_medida.mjs`, `docs/medicoes/andar-vs-moscas.json`).
- **Pausas:** regra com estados andar, parar, girar e provar, com durações sorteadas como nas moscas reais (Valente et al. 2007): trechos andando exponenciais (média 1,7 s); paradas 75% curtas (média 0,15 s) e 25% longas (média 2,5 s); girar no lugar em 20% das paradas. Medido: 27–30% do tempo parada no corpo simples e 48% no físico (antes, 3–7% e 1%); moscas numa arena sem comida ficam 63% paradas (Geurten et al. 2014).
- **Viradas em sacadas** (corpo simples, Cozinha 3D): moscas andando viram em giros rápidos de ~15° em ~90 ms, com o rumo quase parado entre eles (Geurten et al. 2014). A virada pedida pelo cérebro, pelo cheiro, pelo ruído e pelas bordas se acumula e sai de uma vez, a 300°/s, quando passa de ~13°: o sentido e o total são os pedidos, o formato é regra. Uma parada desfaz o acumulado (depois de parar, moscas seguem no mesmo rumo). A fuga do cheiro ruim virou giros de ~100° seguidos de reta, e enquanto ela foge o resto da virada pesa menos; antes, ela girava sem parar a 258°/s e a visão a puxava de volta para a laranja mofada. Medido: 5% do tempo virando (moscas: 9%) e 0° de mudança de rumo depois de parar. O sentido das curvas continua usando as leituras atuais do cérebro e do cheiro. A alimentação suspende a caminhada; ameaça, fuga, ré e escalada têm prioridade. Os tempos são aproximados e usam o relógio cerebral; não representam distribuições medidas em animais.
- **Fuga do mofo, revisão sensorial:** no corpo simples da Cozinha 3D, a regra usa a tendência da concentração ruim nas antenas antes de saturar a aversão. Repete o giro de ~100° apenas se o cheiro não estiver caindo (derivada suavizada de pelo menos −0,005/s, intervalo mínimo de 1 s, aversão > 0,3). Enquanto a fuga estiver ativa, suspende pausas sorteadas, retira o desconto de velocidade por aversão e reduz as outras viradas a 10%; encerra abaixo de 0,05 de aversão. Nenhuma posição de fruta entra nessa decisão. É regra do corpo; não altera o cérebro nem o controlador físico. Na sonda de três largadas com olhos reais, aos 12 s cerebrais a versão anterior terminou a 27–35 mm do centro da laranja, com aversão 0,60–1,00; a revisão terminou a 69–83 mm, com aversão 0,0005–0,0068. Resultado preliminar: as largadas compartilham o mesmo cérebro e não são réplicas independentes. Dados e método: `andar-vs-moscas.json`, rótulos `mofo-antes` e `mofo-tendencia-v1`.
- **Cinco rodadas longas do corpo simples:** 300 s de relógio por sessão, olhos reais, 101–177 s cerebrais (`longa-simples-1..5` em `andar-vs-moscas.json`). Mediana entre sessões: velocidade 10,98 mm/s, trechos andando com média 1,48 s, repouso 21,6% e viradas 6,2%; 60% das pausas detectadas abaixo de 0,3 s. Frutas comidas e pousos em frutas em 3/5 sessões. Resultado negativo: duas ficaram só no açúcar e três terminaram com fome máxima pela regra do modelo. As janelas suavizam sacadas curtas; estes números não validam a locomoção como equivalente à de animais.
- **Modo só sentidos (`?sentidos=1`), resultado negativo:** sem a lista de objetos (o alvo do voo vem dos olhos reais, o pouso do que está embaixo e do cheiro, a decolagem do que ela vê e cheira) e sem a "novidade" escondida, em 5 rodadas de 300 s ela não comeu fruta em nenhuma (com os atalhos, em 3 de 5) e não pousou em fruta em nenhuma (com os atalhos, 3 de 5). Comeu só o açúcar perto de onde começa e ficou ali com fome. Quase não decolou (3 de 5 rodadas sem voo), os 2 pousos foram no balcão, e andando o cheiro não a leva à fruta: com as antenas na distância real, a comparação entre elas é fraca, e ela não compara o cheiro ao longo do tempo (as moscas reais comparam). Critério escrito antes da medida; o padrão continua com os atalhos (`docs/medicoes/sentidos-comparacao.json`, `docs/plano-sentidos-e-medicao.md`).
- **Só sentidos é o padrão na Cozinha (27/09/2026):** depois da busca pelo cheiro e da correção do pouso, a série de 5 rodadas passou o critério escrito antes: fruta comida em 3/5, pouso em fruta em 3/5 e refeições no nível do modo com atalhos (14, 12, 9, 8 e 8 nos primeiros 101 s cerebrais, contra 15, 8, 9, 14 e 8). O pouso: avaliado a cada instante, desacelerando sobre as coisas, com cheiro bom presente, e a coisa em que vai pousar não conta como "obstáculo que cresce" (antes, a fruta da aproximação disparava a fibra gigante e ela fugia ao pousar; Tammero e Dickinson 2002: expansão centrada leva ao pouso, lateral a uma guinada). A ameaça do voo também passou a zerar ao pousar, nos dois modos. `?sentidos=0` volta aos atalhos. O corpo físico ainda não foi medido nesse modo em série longa. Histórico completo em `docs/plano-busca-cheiro.md` e `docs/medicoes/sentidos-comparacao.json`.
- **Busca pelo cheiro ao longo do tempo (modo só sentidos, corpo simples):** regra do corpo baseada em moscas andando atrás de cheiro (Álvarez-Salvado et al. 2018; Demir et al. 2020; Jayaram et al. 2023): com o cheiro bom subindo mais de 10% por segundo, ela acelera, anda mais reto e não para; quando ele cai mais de 30% por segundo, desacelera e dá um giro de 45–120°, para o lado da antena com mais cheiro (outro giro só se continuar caindo). Sem vento na Cozinha, não há a orientação contra o vento. Duas versões anteriores falharam e estão registradas: com queda de 15%/s e giros repetidos ela rodopiava; e, como o cheiro de fruta está em toda a bancada, "estar no cheiro" a fazia nunca parar. Em 5 rodadas de 300 s, comeu fruta em 1 (antes, 0) e pousou em fruta em 2 (antes, 0); com os atalhos, 3 e 3. Ela passou a voar mais, mas 13 de 15 pousos foram no balcão: o pouso é o próximo gargalo (`docs/plano-busca-cheiro.md`).
- **Cinco rodadas longas do corpo físico:** 300 s de relógio por sessão, olhos reais, 67–98 s cerebrais (`longa-fisico-1..5`, janela de 200 ms; resumo em `docs/medicoes/andar-longas-resumo.json`). Mediana entre sessões: velocidade 8,19 mm/s, trechos andando com média 0,61 s (picados pelo balanço de cada passada, mesmo com a janela maior), 67% das pausas detectadas abaixo de 0,3 s; andando 47%, parada 22%, virando 9,6%, comendo 14% e escalando 4% do tempo. Fruta comida em 4/5 sessões e pouso em fruta em 2/5; 8 refeições por sessão (1–11). O corpo físico não usa as sacadas nem a fuga por tendência (quem vira são as patas, pelo sinal do cérebro).
- **Limites:** o contato é com a superfície da forma de cada coisa (a meia-cúpula da fruta, o topo plano da plataforma). Não há alimentação nas paredes. Perder contato, decolar ou ficar presa impede novas mordidas; a captura/fuga recolhe imediatamente a boca. O modo 2D e os experimentos de caça a bugs mantêm a alimentação anterior.
- **Triagem anterior à implementação:** `node scripts/realismo_triagem.mjs`, resultado em `docs/medicoes/realismo-triagem.json`. No worker da página, uma realização com açúcar a 160 Hz por neurônio produziu 290 disparos/s somados no grupo da probóscide, primeiro sinal no relatório de 30 ms; a fase seguinte sem estímulo não registrou disparos. Ameaça a 200 Hz produziu rajadas da fibra gigante. Isso sustenta o uso dos sinais; não valida a mecânica da boca nem as pausas como emergentes do mapa.
- **Solta na Cozinha** (uma rodada de cada, `docs/medicoes/realismo-livre.json`): antes do pacote, 13 refeições em 57 s de cérebro; sem a inércia da boca, 7 em 63 s; com ela, 10 em 31 s, quase saciada. Com as antenas na escala real, a diferença de cheiro entre elas cai ~16 vezes, mas ela chega às frutas andando tanto quanto antes (5 de 12 largadas, contra 4 de 12): quem guia a aproximação é a visão (LC10a), não a comparação entre as antenas.
- **Verificação:** `node scripts/corpo_natural_teste.mjs` confere orientação/separação das antenas, contato por altura e borda, extensão e prioridade de ameaça/escalada. `node scripts/realismo_sandbox_teste.mjs` usa o cérebro real no Chrome com perfil em `_tmp/` e grava `docs/medicoes/realismo-sandbox.json`; a imagem de conferência fica em `_realismo_boca.png`.

### Limpeza das patas, antenas e cabeça

Na Cozinha 3D, durante uma pausa com apoio estável e sem alimento em contato, ela varre a cabeça, esfrega as patas anteriores, varre as antenas e volta a esfregar as patas. A sequência dura 3,1 s cerebrais. A primeira oportunidade vem após 6–12 s elegíveis; depois há um intervalo de 16–30 s. Ameaça, captura, voo, ré, escalada, aversão e contato para comer interrompem a limpeza. O relógio cerebral comanda também a animação: pausar a simulação pausa o gesto.

- **Regra declarada:** os intervalos, a ordem, a duração e as poses são nossos (`web/limpeza.js`). A alternância entre varrer uma região e esfregar as patas se inspira em [Seeds et al. 2014](https://elifesciences.org/articles/02951); não reproduz uma distribuição medida nem uma hierarquia neural simulada. Não há poeira simulada, estímulos artificiais de limpeza ou alteração de sinapses durante esse gesto.
- **Triagem no próprio worker:** `python -X utf8 scripts/limpeza_grupos.py` e `node scripts/limpeza_triagem.mjs`, dados em `docs/medicoes/limpeza-triagem.json`. Três sementes, 1 s por condição, 100 Hz por neurônio sensorial, reset entre condições, sem tônus extra. As anotações identificam `DNg62` como aDN1 e `DNge078` como aDN2 (dois neurônios de cada). Cerdas das antenas (69 BM do nervo AN) produziram **103,5–123 Hz em aDN1 e 91,5–102 Hz em aDN2**; cerdas interomatidiais (745 BM_InOm), **107,5–117,5 e 55–62 Hz**. Repouso e JO-FV/JO-FD1 classificados como grooming (64 células) deram **zero nos dois descendentes**, nessas condições. É uma triagem com estimulação simultânea forte, não uma medida de atividade natural. Resposta dos descendentes não demonstra coordenação das patas: por isso a sequência na página permanece regra, sem conexão artificial desses sinais à animação.
- **Geometria:** `corpo/limpeza_poses.py` resolve as juntas das patas anteriores da NeuroMechFly para alvos aproximados e grava `web/data/limpeza_poses.json`. As poses preservam segmentos; a interpolação visual entre poses ainda é aproximada. Cabeça e antenas não se articulam durante a limpeza. Sem a malha, há uma versão simplificada com linhas.
- **Corpo físico:** o MuJoCo mantém o apoio e a postura; as patas anteriores recebem apenas uma sobreposição visual. O gesto não aplica forças, não simula a remoção de sujeira nem realimenta tato/propriocepção da limpeza. Só começa com as quatro outras patas apoiadas e o corpo ereto.
- **Verificar:** `node scripts/limpeza_teste.mjs` testa a sequência e prioridades; `node scripts/limpeza_sandbox_teste.mjs` verifica a integração e gera `docs/medicoes/limpeza-sandbox.json` e capturas `_limpeza-*.png`. A sonda antecipa o intervalo e mantém a posição sem comida para isolar o gesto; não valida a frequência espontânea.

### Duas moscas na mesma cozinha

No **Sandbox 3D**, clique em **Adicionar uma mosca** (entra na Cozinha). A câmera **Ver dupla** acompanha as duas; o anel azul identifica a mosca 1 e o laranja a 2. **Aproximar moscas** reposiciona a segunda perto da primeira: é uma intervenção do observador, não aproximação espontânea. O contador registra entradas numa distância inferior a 5 mm e o tempo acumulado nessa faixa; não classifica isso como sociabilidade. **Voltar a uma mosca** encerra o segundo worker e remove seu desenho.

- Cada mosca tem uma cópia completa do mesmo conectoma **macho**, em seu próprio worker, com atividade, plasticidade, memória olfativa, fome e estado do corpo separados. Os dois avançam juntos em blocos de 10 ms; o mais lento limita o relógio compartilhado. Pausar e reiniciar abrangem as duas. Só a memória da primeira é guardada entre visitas; ao remover a segunda, sua memória é descartada. Os painéis e olhos continuam mostrando a primeira.
- As duas malhas participam da mesma cena dos olhos compostos. Cada olho esconde apenas seu próprio corpo e as anotações da interface. O sinal passa pelos campos receptivos LC10a já existentes, sem destacar a outra mosca artificialmente. Continua valendo a limitação de transdução do modelo: **claro = objeto**, não um detector validado de outra mosca.
- Compartilham as porções de comida: uma mordida diminui a quantidade para ambas. A ordem dos passos alterna para não favorecer sempre a mesma na disputa pela última porção. **Regra geométrica:** raio de exclusão equivalente a 1 mm por corpo; passos que aproximariam os centros abaixo de 2 mm são barrados. A menos de 15 px, o contato alimenta as cerdas anteriores bilaterais a 20 Hz. Distância, taxa e distribuição desse tato foram escolhidas, não inferidas do mapa. Não há forças de colisão, cVA, namoro, agressão ou atração social programada.
- Nesta versão os dois corpos são **cinemáticos**; o servidor físico continua sendo de uma única mosca. Corpo físico, louva-a-deus e laboratório ficam indisponíveis durante a dupla. Limite de duas cópias completas para conter memória e custo de processamento. As regras de andar, cheiro, voo, pouso e limpeza são as mesmas do modo individual.

Código em `web/colonia.js`. `scripts/colonia_cerebro_teste.mjs` compara 100 blocos de 10 ms em relógio automático e em barreira, com semente 28 e quatro condições: repouso, tato anterior bilateral a 20 Hz, visão esquerda a 100 Hz e açúcar a 160 Hz. **Disparos, contagens, tempos e memória idênticos nas quatro condições**, registrados em `docs/medicoes/colonia-cerebro.json`. Resultado negativo: o tato leve não produziu disparos de fibra gigante, DNa esquerdo ou probóscide nesse segundo de triagem. A visão produziu 171 disparos no grupo `dirige_L`; açúcar, 442 no grupo `proboscide`. Isso testa as entradas e a equivalência do relógio, não comprova comportamento social.

Integração em `scripts/colonia_sandbox_teste.mjs`, registro em `docs/medicoes/colonia-sandbox.json`: dois workers reais, isolamento de sentidos/estados, última porção compartilhada, visão de uma malha pela outra, pausa, reinício e encerramento do segundo worker. Inclui uma rodada livre curta, com posições iniciais escolhidas. **Não mede interação social espontânea nem estabilidade em sessão longa.**

Na rodada registrada, 5,01 s simulados levaram 24,58 s reais (~0,20×) no Chrome sem janela com renderização de teste. As duas mudaram de posição, mantiveram estados finitos e houve uma entrada na faixa de 5 mm após a aproximação manual. O custo da dupla é significativo; esse número não é um benchmark da interface visível nem prova de aproximação espontânea.

### Corpo físico (opcional)

- **O corpo:** a NeuroMechFly (flygym 2.1, EPFL), que vem de um micro-CT de uma mosca real, roda no MuJoCo com 42 articulações nas patas. No sandbox, a malha real anda por cima das plataformas, na escala de 7 px por mm (~18 px de mosca).
- **As patas:** o controlador híbrido do exemplo oficial do flygym. Ele junta um gerador de ritmo trípode, passadas **gravadas de moscas reais** (vídeo 3D com DeepFly3D) e reflexos de tropeço e de pata no vazio.
- **Cérebro e corpo:** o cérebro manda o sinal descendente `[esquerda, direita]`, que é a virada dos DNa01–03 e a velocidade que ela quer. A física avança até o tempo do cérebro. O servidor mede quanto de física consegue por segundo de relógio, e a página põe o cérebro nesse ritmo: tudo anda em câmera lenta contínua (a legenda do sandbox avisa), em vez de o cérebro parar por segundos esperando o corpo. Se ainda assim o corpo ficar 0,5 s para trás, o cérebro espera.
- **Velocidade** (`docs/medicoes/corpo-velocidade.json`): a física anda a ~0,66× o tempo real no chão, neste PC. Três coisas a deixavam muito mais lenta:
  - o controlador das patas remontava a lista de juntas a cada passo (2/3 do tempo dele). Agora guarda o resultado (`corpo/terceiros/.../common.py`), com os mesmos ângulos, bit a bit;
  - açúcar, água e folhas eram blocos de 0,4 mm: as patas encostavam no bloco e no chão ao mesmo tempo (100 a 150 contatos) e a física caía a 0,04×. Objetos com menos de 1 mm ficam fora da física;
  - dois servidores do corpo na mesma porta (um com código antigo): a página alternava entre duas físicas e a mosca pulava. Agora o servidor recusa uma porta ocupada.
  - Em cima de um bloco, a física ainda fica ~2× mais lenta que no chão (5 contatos por pata no bloco, contra 3 no chão). Desligar esses contatos múltiplos a deixaria igual ao chão, mas então ela cai das paredes.
- **Medido neste PC:**
  - 13,5 mm/s em linha reta (moscas reais: por volta de 10–20 mm/s);
  - ~150°/s nas curvas;
  - ré com sinal negativo;
  - a física a ~0,4× o tempo real (passo de 0,2 ms, controlador a 500 Hz), mais rápida que o cérebro (~0,3×). A 250 Hz as curvas caíam pela metade.
- **Plataformas físicas:** as plataformas do sandbox são blocos sólidos no MuJoCo; na Cozinha, as frutas são as mesmas meias-cúpulas do desenho (ver "As formas"). A altura dela vem da física, e as patas pisam nelas de verdade.
- **Reflexo tarsal:** quando as seis patas perdem o apoio, como ao passar da beira, ela começa a voar. Nas moscas reais, perder o contato dos tarsos dispara o voo. Diante da parede de uma plataforma mais alta, ela sobe (ver Escalada), vira ou decola.
- **Voo:** no ar, ela voa como no modo simples, inclusive a decolagem de susto pela fibra gigante. Ao pousar, o corpo físico é recolocado ali, de pé, com todas as juntas na pose neutra.
- **Limites:**
  - ainda não há física de voo nem de salto: no ar ela usa o modelo simples;
  - quem move as patas é o controlador, não o cordão nervoso do conectoma.

- **Tato e propriocepção:** o que as patas sentem entra pelos nervos de cada pata (ProLN, MesoLN e MetaLN, de cada lado), vindo da física:
  - **cerdas do tarso** (15% das cerdas, 17 a 62 neurônios por pata): pisar e levantar. Com a adesão das almofadinhas, a força de cada pata salta entre ~0 e ~20 pesos a cada pisada, então isso é, na prática, pisou/levantou (até 20 Hz);
  - **todas as cerdas da pata** (115 a 428), por 150 ms, quando o controlador detecta um tropeço;
  - **carga no apoio:** placas de pelos e sensilas campaniformes (2 a 20 por pata);
  - **órgão cordotonal do fêmur, só os neurônios "hook"** (tipos SNpp39 e SNpp41, 4 a 17 por pata): a velocidade da junta fêmur-tíbia, até 30 Hz. Os hook sentem a direção do movimento; os "claw" (posição) e os "club" (vibração) ficam de fora. Ligar os 392 neurônios do órgão juntos a 60 Hz fazia o DNp01 disparar sozinho a ~0,8 Hz: numa ablação com o corpo inteiro, o cordotonal foi a única entrada que fazia isso (sem ele, 0 Hz; `docs/medicoes/fibra-espontanea-ablacao.json`).
  - **Por que só 15% das cerdas a cada passo:** com todas ligadas juntas, o cordão nervoso excitava a fibra gigante (DNp01 a ~0,5 Hz no simulador em Python), e a mosca fugia sem ameaça.
  - **O que o mapa faz com isso** (`scripts/tato_teste.py`, `docs/medicoes/tato-pernas.json`): tocar a **pata da frente** não muda nenhum neurônio descendente, nem com todas as cerdas. As **do meio e de trás** acendem descendentes do gnato (DNge104, DNg16, DNge049: +15 a +48 Hz), mas quase não viram a mosca (DNa02 até +5 Hz, contra +90 a +137 Hz da visão). O MDN (ré) e a fibra gigante não respondem. Numa mosca real, a reação a um tropeço é um reflexo local da pata; aqui ele está no controlador do corpo (levanta mais a pata que bateu), e o cérebro só sente.
  - **No comportamento:** o toque entra pelo reflexo tarsal.
- **A fuga pede uma rajada da fibra gigante** (`scripts/fibra_espontanea.py`, `docs/medicoes/fibra-espontanea.json`): com o corpo andando na parede e os sensores como estão agora, o DNp01 não disparou nenhuma vez em 10 s. Diante de uma ameaça (LPLC2 e LC4 a 200 Hz), dispara em rajada: ~250 disparos em 300 ms, o primeiro 5 a 6 ms depois do início. Com o cordotonal inteiro ligado, ele dava disparos soltos (~1 por segundo), e cada um virava uma fuga. Na mosca real um disparo da fibra gigante basta para o salto, mas ela não dispara sozinha. Por segurança contra esse ruído do modelo, a fuga pede 3 disparos em 20 ms: isso atrasa a fuga em ~3 ms e não perde nenhuma ameaça.
- **Olhos reais (no sandbox):** o modelo de olho composto do flygym, com 721 omatídeos por olho, câmera de 157° com correção de olho de peixe e omatídeos "amarelos" (canal verde) e "pálidos" (canal azul). O mundo 3D é renderizado pelas câmeras presas aos olhos da malha, que balançam com o passo, e cada pixel soma no seu omatídeo (`corpo/olho_mapas.py` gera a tabela). O HUD mostra essa imagem. O LC10a recebe os omatídeos mais claros que o resto do olho, e o que ela ainda não provou brilha mais no mundo. Essa etapa é regra nossa: não simulamos fotorreceptor → LC.
  - **Campo receptivo de cada LC10a, das sinapses:** a tabela de sinapses do Janelia (`syn-points`, 13 GB, baixada em `data/raw/`) traz, para cada sinapse no lóbulo, a coluna do olho em que ela está. `scripts/lc_campos.py` lê a tabela em lotes e calcula, para 5.326 dos 5.330 neurônios LC, LPLC e LLPC, o centro e o tamanho do campo (a média e a dispersão das colunas das suas 3,7 milhões de sinapses de entrada). A posição média de cada coluna no espaço diz como o mapa está deitado no lóbulo (ajuste linear, R² 0,98–0,99).
  - **Orientação conferida:** a mesma coluna existe na medula e no lóbulo. Entre as duas passa o 2º quiasma óptico, que inverte frente e trás; em cima e embaixo não inverte. Nos dois lados o mapa mostra exatamente isso (`scripts/lc_orientacao.py`, `docs/medicoes/lc-orientacao.json`). Somado ao 1º quiasma (lâmina → medula), que também inverte, a frente do lóbulo é a frente do olho.
  - **Do lóbulo aos omatídeos:** `scripts/lc_omatidios.py` estica as faixas do lóbulo sobre as direções dos 721 omatídeos do flygym (uma coluna vale o ângulo entre omatídeos vizinhos, 4,2°). Cada célula vira uma gaussiana de σ ≈ 4,7° (uns 20° de diâmetro) sobre ~24 omatídeos. O esticamento é linear: os campos ficam no lugar certo em média, não omatídeo por omatídeo.
  - **No sandbox**, cada LC10a recebe a própria taxa: a soma do que cai no seu campo, numa curva que satura, dividida pela atividade de todas as células (normalização; a curva e a normalização são regras nossas). O HUD pinta de vermelho onde os LC10a estão vendo algo. `?campos=0` volta à taxa única por olho.
  - **O que isso mostrou** (`scripts/visao_campo.py`, `docs/medicoes/visao-campo.json`): ligando 45 LC10a de cada faixa do olho a 100 Hz, as que olham para a **frente** quase não mexem no DNa02 (+0,7 Hz de índice lateral), as do **meio** o fazem virar (+104 Hz) e as de **lado e trás**, mais (+137 Hz). Em cima (+85) e embaixo (+76) pouco diferem. Uma mosca real também não vira para o que já está à sua frente, só para o que está de lado. Não programamos isso: está nas conexões.

#### Você: louva-a-deus

O modo predador: você controla uma ninfa de louva-a-deus (~15 mm), predador de emboscada que caça moscas-da-fruta (em criações, ninfas de louva-a-deus comem *Drosophila*). Ele substituiu a "Sentinela", uma esfera.

- **Controles:** W/S anda, A/D vira, Shift rasteja (um terço da velocidade), Espaço dá o bote, R solta. Ele sobe nas coisas (acompanha a superfície embaixo).
- **O que a mosca vê:** um objeto (olhos) e, quando algo cresce rápido na frente dela, os detectores de ameaça (LPLC2, LC4), calculados pelo crescimento do tamanho aparente da cabeça e da ponta das patas. Se a fibra gigante disparar em rajada, ela foge, e a direção da fuga vem do cérebro (DNp04, DNp02, DNp11). Atrás dela há um ponto cego.
- **O bote:** as patas raptoriais vão e voltam em 90 ms (de 42 a 82 px à frente, ±34°). Se ela ainda estiver lá no fim da ida, ele a agarra.
- **Presa:** ela sente todas as cerdas das seis patas e a dor (PPL1). Ele a leva à boca em 4 s, mordendo a cada 0,5 s: a cabeça avança e cresce na frente dela. Cada rajada da fibra gigante dela é um tranco que tira 34% do aperto; cada Espaço devolve 10%. Sem aperto, ela escapa voando; na boca, ele a come, e a simulação continua com a mesma mosca, reposta do outro lado da bancada, com a memória da dor.
- **O painel** mostra o quanto ela está te vendo crescer, se você está no ponto cego dela, se ela está no alcance do bote, e o aperto.
- **Teste** (jogador automático na Cozinha, corpo simples): chegando por trás rastejando, 3 botes e 3 capturas (2 a 3 trancos cada, comida no fim). Pela frente, andando rápido: numa ela viu e fugiu na aproximação, noutra escapou do bote, e numa foi pega.

#### Para onde fugir

- **O mapa sabe de onde vem a ameaça** (`scripts/fuga_direcao.py`, `docs/medicoes/fuga-direcao.json`). Com o campo receptivo de cada LPLC2 e LC4 (os detectores de ameaça), ligamos só os que olham para uma parte do mundo, a 200 Hz:
  - a **fibra gigante** (DNp01) dispara igual para ameaças na frente, do lado e atrás (~350 Hz): ela só dá o "pule";
  - o **DNp04** dispara do lado da ameaça: +353 Hz de diferença esquerda − direita com a ameaça à esquerda, −338 à direita, na frente, do lado ou atrás;
  - **frente ou trás:** ameaça na frente liga mais o DNp02 (+121 a +230 Hz) que o DNp11 (quase nada); atrás, o contrário (DNp11 +136 a +272, DNp02 +66 a +72); de lado, os dois parecidos.
- **Na página**, a ameaça (o predador que você controla, ou o glitch de um bug que estoura, à frente) liga cada LPLC2 e LC4 conforme cai no campo receptivo dele. Na fuga, a direção sai desses neurônios: o lado vem do DNp04 esquerdo contra o direito; frente e trás, do DNp02 contra o DNp11. Ela pula para o lado oposto. A leitura é regra nossa; o comportamento é o das moscas reais, que pulam para longe da ameaça (Card e Dickinson 2008). Os campos são os do lóbulo esticados sobre o olho, como os do LC10a.
- **Testado na página** (`docs/medicoes/fuga-direcao-pagina.json`, com o predador anterior, uma esfera): ele investe pela esquerda, pela direita, pela frente e por trás, duas vezes cada. Na primeira fuga de cada ataque, a direção lida do cérebro errou 1°, 1°, 4°, 13° e 57° da real (mediana 4°). Por trás ela nunca fugiu: a Sentinela fica no ponto cego, como nas moscas reais, que têm um atrás.

#### Escalada

- **As almofadinhas seguram?** (`corpo/parede_teste.py`, `docs/medicoes/parede-gravidade.json`) A mosca anda no chão e a gravidade é girada: rampa de 45°, parede (90°), teto (180°).
  - Com a física do exemplo do flygym, ela descola em 0,1–0,2 s a partir de 45°. Parada, com as seis almofadinhas grudadas, ela fica na parede e no teto; o problema é andar. Cada pata que levanta perde o contato, e sem margem a adesão não a puxa de volta; o cone de atrito piramidal do MuJoCo deixa as patas deslizarem devagar sob carga.
  - **A física da escalada** (`servidor.ajustar_escalada`): adesão de 20× o peso por pata (o flygym usa 4×; insetos com almofadinhas aderem com dezenas de vezes o próprio peso), margem de 0,3 mm no contato das almofadinhas e cone de atrito elíptico.
  - **Resultado:** no chão, 13,8 mm/s (igual antes); rampa de 45°, 7,8 mm/s; **parede vertical, 5,3 a 6,0 mm/s** em três sementes, sem descolar. A 135° e no teto ela ainda cai: as passadas foram gravadas de moscas no chão.
- **No sandbox, com o corpo físico:** andando contra uma plataforma, as patas da frente grudam na face e o corpo empina. Daí em diante a subida é física. As regras nossas:
  - o **agarrão**: ao começar a subir, por 0,2 s uma força a aperta contra a parede. Faz o papel das garras e do agarrar, que as passadas de chão não têm. Sem ele, ela sobe 3 a 5 mm e cai de volta;
  - **na parede ela não para** (parada, a passada solta as patas e ela escorrega), **sobe com a passada mais forte** (sinal 1,2: com 0,9 ela empacava a 4–6 mm do chão; com 1,2 sobe um bloco de 18 mm em ~2,5 s) e **vira para cima** (geotaxia negativa). Na página, de frente para cada fruta, ela chegou ao topo da banana em 2,4 s, do morango em 2,5 s, do pêssego em 4 s e da laranja em 12,9 s;
  - o **reagarrão**: se escorrega mais de 1 mm em meio segundo, o mesmo agarrão de novo (no máximo um por segundo);
  - a **passagem para o topo** da plataforma, quando as patas da frente alcançam a beira (o tórax a 2 mm dela), como a de baixo. Na física pura, na quina de cima ela cai;
  - **nas frutas redondas, a pegada** (`corpo/servidor.py`, `_pegada`): a força que a segura aponta para dentro da superfície mais perto do tórax, a fruta ou o balcão, e passa de uma para a outra aos poucos (em ~1 mm) enquanto ela empina. Faz o papel das garras e da adesão das patas. Com a gravidade de sempre, ela subia 3 a 11 mm de uma meia-cúpula e escorregava: as passadas gravadas no chão aguentam parede reta (um bloco de 18 mm ou um cilindro), mas não a curva que vai de vertical a horizontal. Com a pegada não há agarrão, reagarrão nem passagem para o topo por regra: a intenção é subir pela curva até ficar de pé em cima. **Limite observado na revisão de 27/09:** ainda há tombos; os antigos eventos de "topo" abaixo aceitavam inclinação momentânea e não provam subida completa. Na página, de frente para cada coisa, chegou em cima da laranja em 0,8 s, do vinagre em 0,9 s, do pêssego em 2 s, do morango em 2,3 s, das uvas em 3,8 s e da banana em 4,9 s, e comeu no pêssego e nas uvas;
  - se empurra uma plataforma plana sem conseguir empinar, a virada para a parede também é regra (teleporte de barriga para a face). **Nas frutas curvas esse teleporte foi removido:** reposicionava o corpo na borda inferior mesmo quando ele já estava sobre a encosta.
  - **Transições nas frutas (regras do corpo):** entra em subida com a cabeça inclinada acima de 0,4; só sai após 180 ms físicos de postura ereta, perda da fruta ou tombamento persistente. "Topo" exige costas para cima, patas apoiadas e superfície elevada, não apenas altura do tórax. O rumo acompanha a pose física; não é forçado para o centro da fruta. Perda de apoio por 60 ms físicos aciona o voo; duas consultas da mesma pose não bastam. Teleportes de pouso reiniciam esse histórico. Pesos, tônus e adaptação do cérebro não mudam.
  - **Triagem negativa:** diminuir a adesão de 200 para 40 aumentou a fração tombada da banana de 20,8% para 84% e do pêssego de 3,6% para 23,6%. Reduzir o passo da física de 0,2 para 0,1 ms também não resolveu: banana/pêssego ficaram tombados em 77,2%/90% das amostras. Ambos rejeitados; arquivos `subida-adesao.json` e `subida-passo.json` em `docs/medicoes/`. Projetar a altura das patas na normal da superfície também foi rejeitado: reduziu o tombamento na banana para 1,2%, mas ela só alcançou 3,36 mm; nas uvas o tombamento aumentou de 3,6% para 41,2% (`subida-referencial.json`). Usar o eixo das costas como referencial também não completou as subidas: alturas máximas do tórax de 3,12 / 3,50 / 3,35 mm em banana/pêssego/uva (`subida-referencial-corpo.json`). O servidor físico permanece igual. Ensaios dirigidos isolados, cinco segundos físicos por objeto, sem cérebro; não são medidas de realismo biológico.
  - **Revisão no navegador (27/09/2026):** `andar_medida.mjs --fisico --sentidos --segundos 0 --sonda-subida`, três largadas de 12 s cerebrais (banana/pêssego/uvas), olhos reais. Em `subida-antes` → `subida-depois`, alternâncias parede/chão: **4/16/2 → 2/3/0**; maior descida entre poses sem voo: **1,72/3,72/1,42 → 1,77/2,36/0,63 mm**. O resultado **não comprova eliminação das quedas**: banana e uvas não completaram a subida; no pêssego houve voo/pouso antes de comer, e a fração tombada aumentou de 8,3% para 14,4%. Uma rodada por versão, trajetórias não pareadas; menos alternância não significa melhor capacidade de escalar. Os falsos eventos de topo foram corrigidos. Dados brutos em `andar-vs-moscas.json`, resumo/método em `subida-sandbox.json`; reproduzir resumo com `node scripts/resumir_subida.mjs`. As métricas gerais de andar dessas sondas incluem teleportes e não servem para calibrar a marcha.
  - Se ela cai da parede, as patas perdem o apoio e o reflexo tarsal a faz voar, como numa mosca real.
- **A gravidade nas antenas** (`scripts/gravidade_teste.py`, `docs/medicoes/gravidade-antenas.json`): a mosca sente a gravidade pelo órgão de Johnston. Empurrar a arista para trás liga a zona E, para a frente liga a zona C (Kamikouchi et al. 2009). No mapa, a zona E dos dois lados acende vários descendentes (DNbe001 +89 Hz, DNp18 +58 Hz). A zona C de um lado com a E do outro, como numa mosca de lado na parede, vira a mosca para o lado da zona E (DNa01 −8 Hz, DNa02 −2,5 Hz).
  - **O que não dá para afirmar:** se isso a vira para cima ou para baixo. Depende de como a gravidade deflete cada antena com a mosca de lado, que é mecânica da antena, fora do mapa; com suposições diferentes, o sentido se inverte. Por isso a preferência por subir é regra, e a gravidade entra no cérebro só pela parte robusta: de cabeça para cima as duas antenas pendem para trás (zona E); para baixo, zona C.

Para rodar:

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install flygym
.venv/Scripts/python.exe corpo/servidor.py
```

Depois, no Sandbox 3D, clique em "Corpo físico". O servidor grava a malha em `web/data/corpo_malha.*` na primeira vez. Os scripts `corpo/andar_teste.py` e `scripts/corpo_teste.py` medem a passada e a velocidade da física.

### Voo pelos motores das asas

O mapa tem o sistema de voo inteiro: os 67 neurônios motores das asas (os de força, DLM e DVM, e os de direção, b1–b3, i1–i2, iii1, iii3, hg1–4, ps, tp), os halteres (205 sensoriais), as células que sentem o mundo girando (HS, VS) e os descendentes de voo.

- **Triagem** (`scripts/voo_mapa.py`, `docs/medicoes/voo-mapa.json`), com o tônus de base da página:
  - parada, nenhum motor de asa dispara; com os halteres batendo (150 Hz) e vento nas antenas, os de força disparam a 5–12 Hz (como em moscas reais em voo) e os de direção b1, b2 e b3 a ~50–80 Hz;
  - o haltere de um lado mais forte (a mosca girando) sobe os motores que aumentam o batimento daquele lado: b1 +62 Hz, b3 +42, b2 +30. É o reflexo giroscópico dos halteres, e vem forte das conexões;
  - fluxo óptico de um lado (células HS) mexe pouco nas asas (+5 Hz), mas liga o DNp15 (+30 Hz), que move o pescoço: a resposta optomotora da cabeça;
  - algo crescendo na frente dispara a fibra gigante e o programa de fuga (o motor do salto, TTMn, e os de força a ~200 Hz). Os neurônios de pouso (DNp07, DNp10) não responderam nem em voo: na mosca real, a mudança de estado que os libera vem de neuromodulação, que o modelo não tem;
  - um objeto de um lado (LC10a) vira pouco as asas (+8 Hz no hg1).
- **Na página** (Sandbox 3D), em voo:
  - entram os halteres (150 Hz, mais ou menos conforme o giro do corpo), o vento nas antenas e o fluxo óptico do giro nas células HS;
  - a amplitude de cada asa sai dos motores de direção daquele lado (b1–b3 aumentam, i1, i2, iii1, iii3 diminuem); a asa esquerda batendo mais gira a mosca para a direita; uma média lenta tira a assimetria de base do mapa; a velocidade sai dos motores de força;
  - o giro volta aos halteres: é esse circuito que estabiliza o voo. O sentido da transdução (qual haltere dispara mais num giro) é nosso, escolhido para estabilizar, o papel conhecido do haltere; a força do reflexo é do mapa. Motores de direção pelo lado do corpo celular: o haltere esquerdo liga o b1 esquerdo, como nas moscas reais (haltere e b1 do mesmo lado);
  - uma parede ou coisa mais alta à frente cresce na visão e liga os detectores de ameaça; se a fibra gigante disparar em rajada, ela faz uma **sacada**, uma curva de ~0,1 s para o lado que os neurônios da direção da fuga indicam;
  - **voos curtos com alvo**, como os de uma mosca numa cozinha: em voo ela sobe o gradiente de cheiro (a mesma regra do chão, mais fraca), mira uma coisa atraente à frente (cheiro bom com fome, o que aprendeu, o que ainda não provou), freia e pousa em cima dela; sem nada que atraia, pousa em 1,5 s onde estiver. Depois de pousar, anda uns segundos antes de voar de novo;
  - regras: a escolha do alvo, a aproximação, a altura e o pouso (os neurônios de pouso do mapa não responderam no modelo).
- **Comportamento** (Cozinha, corpo simples, 74 s de cérebro, sem forçar nada): 5 voos de 1,7 a 2,0 s, cada um pousando numa fruta (morango, banana, morango, banana); comeu açúcar, morango e banana até ficar saciada; ~20% do tempo no ar. Antes das regras de alvo e pouso, ela voava sem parar de parede em parede.
- **Teste** (Cozinha, corpo simples, 9 s de voo): 7 sacadas, todas diante de paredes, com giros de 600–1000°/s (a faixa das sacadas reais); 77–163 mm/s conforme a força das asas; entre sacadas, voo quase reto; a cabeça gira pelo DNp15. Moscas reais voam a 300–1000 mm/s em espaço aberto; aqui, 130 mm/s de base.
- **A animação:** o corpo real da NeuroMechFly posto pela página (`corpo/poses.py` grava as poses de pé e de voo em `web/data/corpo_poses.json`; as patas recolhem como em moscas voando, achadas por busca). Cada asa bate com a amplitude que os motores daquele lado mandam, com um leque translúcido mostrando o envelope (a batida real é de ~200 Hz; aqui, 16 Hz), os halteres oscilam em contrafase, o corpo empina ~20° e inclina nas curvas, e a cabeça gira pelo DNp15. No chão, sem o servidor de física, as patas andam em trípode.
- **Limite:** nos motores reais, a fase de cada disparo dentro da batida importa; o modelo lê taxas.

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

### Treinamento da memória em 3D

A aba **Treinamento** abre uma bancada com duas pistas olfativas de mesma aparência. Esta é a primeira etapa de
preparação para treinar a caça a bugs em Pedidos; ainda não executa operações de carrinho, estoque ou pagamento.
Clique em **Iniciar do zero**, escolha a pista recompensada primeiro (A ou B) e a duração dos testes (15, 30 ou 60 s
cerebrais). **Pausar/Continuar** controla o relógio inteiro, inclusive os pareamentos.

O protocolo padrão dura **96 s cerebrais**: teste inicial de 15 s; três apresentações de cada pista; teste de 15 s;
outro teste com os lados trocados; três apresentações de cada pista com a recompensa invertida; teste final de 15 s.
Cada apresentação dura 2 s, seguida de 1 s sem odor. A ordem A/B alterna entre repetições. Nos testes livres não há
açúcar, punição ou pulso de recompensa. O painel registra primeira escolha, tempo em cada região de 8 mm e índice
de preferência `(tempoA-tempoB)/(tempoA+tempoB)`; se não visitar nenhuma pista, mostra “Nenhuma” e índice indefinido.

**O que é intervenção experimental:** A = VA2 + DM4; B = DP1l + DM2. No pareamento, o corpo fica numa posição fixa;
os ORNs recebem 100 Hz bilateral e a pista recompensada recebe estimulação de PAM a 100 Hz nos últimos 500 ms.
Não é açúcar encontrado espontaneamente no mundo. Nas escolhas, os odores vêm da posição das antenas e os olhos
usam a cena normal. A fome fica em 1, o voo é desabilitado e uma parede virtual limita a área; o corpo recomeça
na mesma posição a cada fase. A atração inata por frutas da Cozinha fica desligada, mas diferenças de resposta
neural entre A/B continuam possíveis. A ponte entre a memória sináptica e o movimento permanece uma regra do corpo.

**Controle sem aprendizado** congela os pesos, incluindo esquecimento e extinção, mantendo os mesmos pulsos
sensoriais e de recompensa. Uma comparação válida exige várias sessões, posições/pistas contrabalançadas e controle
do ruído; a interface não semeia a aleatoriedade nem calcula significância. Uma sinapse alterada não prova uma
escolha melhor. Este protocolo mede associação e comportamento, não uma memória de sequências de operações.

**Persistência separada:** o início tira uma cópia da memória anterior, usando o mesmo formato quantizado do
salvamento normal. **Guardar memória do treino**, disponível ao concluir, grava em uma chave separada no navegador;
**Treinar memória guardada** inicia outra sessão com essas sinapses. O salvamento normal fica suspenso durante a
sessão. Encerrar ou trocar de sistema restaura a cópia anterior; a segunda mosca, física e laboratório ficam
indisponíveis durante o treino. **Exportar resultados** baixa um JSON com configuração, fases, escolhas e trajetória;
esse relatório não contém os pesos necessários para restaurar a memória.

Arquivos: `web/treino-protocolo.js` (fases e estímulos), `web/treino-memoria.js` (arena, interface e memória separada).
O parâmetro `plasticidade` em `web/sim-worker.js` implementa o controle; o padrão continua ligado.

Verificações:

- `node scripts/treino_memoria_triagem.mjs`: worker real em thread Node, semente 29, duas repetições por pista no
  treino e na reversão. O enfraquecimento médio das sinapses KC → saídas evitar chegou a **0,02666** com plasticidade
  e **0** no controle; a medida das saídas aproximar ficou em 0. Dados em `docs/medicoes/treino-memoria-triagem.json`.
  Isso verifica alteração de pesos, não aprendizado comportamental nem equivalência das duas pistas.
- `node scripts/treino_memoria_interface.mjs`: protocolo curto no Chrome com worker real, pausa, quatro testes
  sem recompensa, controle congelado, memória guardada, continuação e saída por troca de aplicativo. Registro em
  `docs/medicoes/treino-memoria-interface.json`. Nos testes de 1 s da condição ativa registrada não houve escolha;
  isso não é falha do coletor nem prova de falta de memória, mas uma observação do ensaio curto.
- `node scripts/treino_memoria_interface.mjs --completo`: sessão padrão com renderização e olhos compostos;
  registro separado em `docs/medicoes/treino-memoria-sessao.json`. Uma sessão é descritiva, sem inferência causal.

Na sessão completa registrada, os tempos próximos de A/B foram: antes do treino **0 / 1,25 s**; depois do treino
de A **11,13 / 0 s**; com lados trocados **10,24 / 0 s**; depois de recompensar B na reversão **1,04 / 7,18 s**.
A primeira escolha após a reversão ainda foi A. Houve preferência de permanência compatível com o pareamento,
mas **não há demonstração causal de aprendizado comportamental**: falta uma série contrabalançada com controle,
sementes e variabilidade. Essa sessão não mede caça a bugs nem generalização para Pedidos.

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
| Bloqueio no Financeiro, 90 s, sem olhos | 3,2 bugs | 3,4 bugs |
| Bloqueio no Financeiro, 90 s, olhos v1 (duas medições) | 3,4 e 3,2 bugs | 2,8 e 4,0 bugs |
| Bloqueio no Financeiro, 90 s, olhos v2 | 2,4 bugs | 4,0 bugs |
| Bloqueio no Financeiro, 90 s, olhos v2 e cheiro de 60 px | 3,4 bugs | 3,8 bugs |
| Transferência para o Financeiro, 60 s, olhos v2 | treinada 1,8 bugs | ingênua 2,4 · controle 2,4 |

O que isso quer dizer:

- **Ela acha bugs:** de 2 a 5 dos 5, em 60 a 120 s, sobretudo explorando.
- **Dentro do mesmo sistema, aprender ajuda quando o padrão se repete perto.** O P3 e o P4 são os dois de cálculo, lado a lado. Depois de achar um, ela vai atrás dos outros elementos de cálculo e acha o P4 (6 de 10 vezes), que a exploração sozinha não alcançou (0 de 10).
- **Num sistema novo, não ajudou.** Nas sinapses, a transferência existe: os elementos de rede do Financeiro chegam com 50–63% do valor aprendido. Mas o que ela aprende é um cheiro, e cheiro só se sente a ~40 px. Os olhos veem de longe, mas não sabem o que ela aprendeu.
  - A via visual do corpo cogumelar existe no mapa, mas no modelo acende só 2 a 5 das ~4 mil células de Kenyon (`scripts/visao_kc.py`).
  - Um cheiro de alcance maior (60 px) também não ajudou.
- **Aprender com um exemplo engana.** No Financeiro, o primeiro bug costuma ser o de lista, o único de lista. Ela passa a esperar bug nos outros elementos de lista e se decepciona 5 a 7 vezes por sessão. Treinada no Pedidos, que tem um bug de menu, ela chega ao Financeiro esperando bug nos 11 itens de menu.
- **No Financeiro, 5 rodadas não separam o efeito do aprendizado.** O mesmo código deu diferenças de ~1 bug nos dois sentidos (olhos v1: 3,4 contra 2,8 numa medição, 3,2 contra 4,0 na outra). Sem olhos, empatou (3,2 contra 3,4). Com os olhos v2, a mosca que aprende achou menos (2,4 contra 4,0) e ficou nos mesmos dois bugs (F3 e F5), o que combina com o item anterior. A segunda medição com olhos v1 estava na tabela como "sem olhos": o filtro `?olhos=0` da página nunca funcionou (um caractere de controle no lugar de `\b`), e foi corrigido em 26/09.
- **O controle e o ponto de partida pareado mudaram as conclusões.** Sem eles, as primeiras rodadas pareciam mostrar transferência (treinada 4 bugs, ingênua 1,5), o que era efeito de onde cada mosca começava.

- **Caça a bugs só com o cérebro (30/09), negativo.** Num sistema de Pedidos com contratos, cada ação tem um cheiro (4 glomérulos, calibrados para nascerem neutros) e a escolha segue a valência do corpo cogumelar. Em 8 sementes pareadas, a treinada achou o primeiro bug de teste em 25,2 ações, a congelada em 27,7 (diferença −2,5, IC95 [−5,3; +0,2], cruza o zero) e a escolha aleatória em 19,7. A valência das ações premiadas não subiu no treino: a recompensa não gravou. Detalhes em `docs/plano-treino-robusto.md`.
- **Caça a bugs só com o cérebro, depois das correções (30/09–01/10): positivo, com replicação.** Duas causas do negativo eram do nosso desenho, não do cérebro: os cheiros das ações acendiam poucas células de Kenyon (com um cheiro forte, uma única recompensa sobe a valência em +0,74 a +0,92) e a bancada de teste quase não media transferência (validado por um "oráculo" sem cérebro). Na bancada nova, validada antes de rodar, a mosca treinada acha defeitos do tipo que aprendeu, em partes do sistema que nunca viu, 4,8 a 6,9 ações antes da mesma mosca com os pesos congelados: em 6 séries de 16 sementes (bancada 2, retenção de 180 s e outro tipo de defeito, cada uma com replicação), todas significativas depois da correção de Holm. Ela escolhe a ação do tipo premiado em 70–85% das oportunidades, contra 50–58% da congelada. Num defeito de outro tipo ela não melhora, e um explorador simples por novidade continua melhor na média de todos os defeitos. Uma regra de decepção (dopamina de punição quando a ação esperada não dá bug) reduziu esse custo na série principal, mas não replicou. Somando à memória uma regra de habituação ("o que já tentou atrai menos"), ela empata com a novidade na média de todos os defeitos (com replicação), ganha dela nos tipos já aprendidos e perde nos outros; com esse peso de habituação, a memória acrescenta pouco sobre a curiosidade. Com cheiros fracos, a memória não vira escolha (negativo). Os cheiros das ações, a leitura da valência e a escolha são regras nossas; o aprendizado é do circuito do mapa. Tudo, com métodos, números e resultados negativos: `docs/publicacao/artigo.md`.

### Caça a bugs no mundo da mosca (a etapa final do treino)

Na página principal, a aba **Caça a bugs** (Sandbox 3D) põe a mosca de verdade, com tudo o que ela faz na Cozinha (andar com pausas e giros, limpar, voar, seguir a visão pelo LC10a e os cheiros, provar com a probóscide), numa bancada com as 15 ações do sistema de Pedidos como plaquinhas (`web/caca-mundo.js`).
- **Cheiro:** cada plaquinha cheira às características da ação, com os mesmos glomérulos fortes do experimento validado, a 100 Hz no centro.
- **Provar = testar:** a probóscide estendida encostando na plaquinha executa a ação no sistema e confere os contratos. Bug novo no treino: açúcar e dopamina PAM, como na caça a bugs da página. No teste, nada.
- **Treinar e testar:** "Treinar" troca a versão do sistema (os bugs de treino) a cada 12 provas ou 90 s; "Testar no sistema novo" usa as 3 versões de teste (bugs em partes que ela nunca premiou, e o controle), sem recompensa, até o primeiro bug.
- **Regras nossas:** a plaquinha ainda não provada nesta versão tem "gosto doce" para as patas (a regra da caça a bugs da página, que faz a probóscide estender); sem preferência inata por frutas; a atração aprendida segue a diferença de cheiro entre as antenas.
- **O que ainda não é:** uma medida. Aqui o caminho, a visão e o corpo também decidem o que ela encontra. Medir isso em série é o próximo experimento.

### Caça a bugs ao vivo

Uma tela separada, `http://localhost:8765/caca.html` (ou o botão "Caça a bugs ao vivo" no topo da página), roda no navegador o mesmo treino validado, com o cérebro real, e mostra passo a passo:
- as 3 ações visíveis a cada passo, com o cheiro (glomérulos) de cada uma e a valência lida enquanto ela cheira;
- a escolha e a chance de cada ação, o bug encontrado e a dopamina de recompensa;
- a atividade no cérebro: células de Kenyon, saídas do corpo cogumelar, dopamina e glomérulos;
- a memória: quanto ela gosta de cada uma das 15 ações, antes e depois do treino, e a curva das ações premiadas ao longo do tempo;
- o placar do teste ao lado das médias medidas em 32 sementes.

Três vistas, ligadas uma a uma (teclas 1, 2 e 3; "Focar" deixa só uma; "Tela cheia" em cada uma):
- **A mosca:** ilustração do protocolo, em 3D (padrão) ou 2D. No 3D, a bancada da Cozinha, a NeuroMechFly de verdade (a malha e a pose de pé do `web/data/corpo_*`, com o passo em trípode) e cada ação visível como uma plaquinha na bancada. Ela cheira cada plaquinha na ordem em que o cérebro a cheira (a pluma de cheiro vai até as antenas), anda até a escolhida e prova; o bug trinca a plaquinha e a dopamina aparece em volta dela. Câmeras como na Cozinha, sem o louva-a-deus e sem o corpo físico: Espectador, Fantasma (WASD e mouse), Olhos dela (o modelo de olho composto do flygym, omatídeo por omatídeo, nas cores que ela capta) e De cima. Nesta tarefa o cérebro recebe só o cheiro: os olhos são só para quem assiste. O corpo e o andar são desenho; a escolha, a valência e a dopamina vêm do cérebro. As pausas da animação param só o relógio da tela, sem passos cerebrais a mais. Sem a malha (ela é gerada pelo servidor do corpo e fica fora do git), aparece um modelo simples.
- **Cérebro 3D:** o da página principal, com os disparos reais de cada bloco de 10 ms e as formas reais das saídas do corpo cogumelar e da dopamina; um botão aproxima o corpo cogumelar.
- **Painel:** os dados acima (ações, medidores, memória, placar, registro).

Condições: treinada, congelada, com ou sem curiosidade; bug premiado de repetição ou em ação normal; semente. Com as medições ligadas, a sessão repete exatamente a sessão medida com a mesma semente (conferido com a semente 51: as valências antes do treino e os bugs de cada episódio são os mesmos do `qa-b2`). Uma sessão leva uns 11 minutos de cérebro (no navegador, ~0,6–0,7× o tempo real). É uma demonstração; as conclusões vêm das séries medidas. Código: `web/caca.html`, `web/caca.js`.

Pontos de partida diferentes mudam muito o resultado (de 1 a 5 bugs), então cada comparação usa rodadas pareadas. Mesmo assim, 5 rodadas por condição só separam efeitos grandes.

## Créditos

- **Dados:** [FlyEM Male CNS v1.0](https://male-cns.janelia.org/), HHMI Janelia, licença CC-BY 4.0.
- **Modelo:** Shiu et al. 2024, *A Drosophila computational brain model reveals sensorimotor processing*, Nature.
- **LC10a na corte:** Ribeiro et al. 2018, *Visual projection neurons mediating directed courtship in Drosophila*, Cell; Hindmarsh Sten et al. 2021, *Sexual arousal gates visual processing during Drosophila courtship*, Nature.
- **DNa02 e a direção:** Rayshubskiy et al. 2020, *Neural control of steering in walking Drosophila*, bioRxiv.
- **Corpo:** NeuroMechFly v2 e flygym, Wang-Chen et al. 2024, *NeuroMechFly v2: simulating embodied sensorimotor control in adult Drosophila*, Nature Methods. O controlador em `corpo/terceiros/` é do repositório do flygym (Apache 2.0).
- **Decepção:** Felsenberg et al. 2018, *Integration of parallel opposing memories underlies memory extinction*, Cell.
- Os sistemas Pedidos e Financeiro são fictícios e os bugs foram plantados de propósito.
