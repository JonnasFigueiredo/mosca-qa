# Uma mosca-da-fruta simulada a partir do conectoma completo aprende a procurar defeitos de software?

**Treino por condicionamento dopaminérgico no corpo cogumelar de um modelo integra-e-dispara do Male CNS v1.0**

Jonnas Figueiredo — versão de 02/10/2026.

---

## Resumo

Simulamos o sistema nervoso central completo de um macho de *Drosophila melanogaster* (Male CNS v1.0, Janelia, 2026:
166.700 neurônios e 6,2 milhões de conexões com 5 ou mais sinapses), com neurônios integra-e-dispara no formato de
Shiu et al. (2024) e aprendizado no corpo cogumelar por depressão sináptica dopaminérgica. Perguntamos se esse
cérebro, treinado a achar defeitos num sistema de software fictício (cada ação do sistema é apresentada como um cheiro
e cada defeito encontrado é pareado com dopamina de recompensa), passa a priorizar, num sistema novo, as ações que
compartilham a característica recompensada.

Todos os critérios foram escritos antes de cada medida e todas as comparações são pareadas por semente. Primeiro,
validamos o aprendizado no cérebro isolado e numa arena de dois cheiros com corpo: diferença pareada entre o cérebro
treinado e o de pesos congelados de 0,74 (IC95 [0,65; 0,82], 5/5 sementes). Na tarefa de software, cinco séries
seguidas deram resultado negativo. A investigação mostrou duas causas independentes, ambas do nosso desenho
experimental e não do cérebro: (i) os cheiros atribuídos às ações acendiam poucas células de Kenyon para que a
dopamina tivesse o que modificar; corrigido isso, uma única recompensa passou a elevar a valência da ação em +0,74 a
+0,92, contra ~0 no controle congelado; (ii) a bancada de teste tinha pouca sensibilidade: mesmo uma memória perfeita
só adiantaria o primeiro defeito em 3,8 ações, e uma das versões de teste era quase inalcançável.

Uma bancada nova, validada por simulação sem cérebro e por análise de poder antes de qualquer rodada, passou no
critério pré-registrado e replicou com sementes independentes. A mosca treinada achou defeitos de repetição em
famílias de ações que nunca viu 5,1 ações antes do controle congelado na série principal (IC95 [−8,0; −2,3], 16
sementes) e 6,9 ações antes na replicação ([−9,1; −4,9], 16 sementes). Ela escolheu ações repetidas em 85% das
oportunidades, contra 53% do controle congelado. Num defeito de outro tipo, não melhorou; ao contrário, piorou. Essa é
a dissociação esperada de uma associação específica.

Três extensões pré-registradas, cada uma com replicação:
- **Retenção:** o efeito sobrevive a 180 s de outros cheiros entre o treino e o teste (−4,8 e −5,6 ações).
- **Tipo de defeito:** o efeito se repete quando o defeito premiado é de outro tipo (−4,8 e −5,1).
- **Decepção:** uma regra de decepção baseada na dopamina de punição reduziu o custo da especialização na série
  principal (6,3 ações), mas não replicou.

Com a correção de Holm sobre as 16 séries confirmatórias, as 6 positivas que replicaram continuam significativas. Um
controle mostrou o limite do resultado: com uma pista que acende poucas células de Kenyon, a memória não vira escolha.

Sozinha, a memória especializa a mosca: na média de todos os defeitos, um explorador simples por novidade é mais
eficiente que ela. Somar à memória uma regra de habituação ("o que já tentou atrai menos") resolveu isso:
- a mosca empatou com a novidade na média de todos os defeitos (−0,2 e −0,3 ações; não-inferioridade pré-registrada,
  com replicação);
- ganhou dela nos defeitos do tipo aprendido (−1,6 e −2,1);
- perdeu no defeito de outro tipo (+2,7 e +3,5).

Com essa regra, a memória acrescenta pouco sobre a curiosidade: a diferença para a mosca congelada com a mesma regra
foi −0,5 e −1,2 ações, sem se separar do zero. Relatamos todos os resultados, inclusive os negativos, e separamos
sempre o que vem do mapa do que é regra do modelo.

---

## 1. Introdução

### 1.1 Motivação

Conectomas completos permitem, pela primeira vez, simular um cérebro inteiro a partir da sua fiação medida, em vez
de redes projetadas. Shiu et al. (2024) mostraram que um modelo integra-e-dispara do conectoma adulto do cérebro da
mosca (FlyWire) prevê circuitos de alimentação e de higiene sem ajuste de parâmetros por neurônio. O Male CNS v1.0
estende o mapa ao cordão nervoso ventral e ao sistema nervoso central inteiro de um macho.

A pergunta aplicada deste trabalho é deliberadamente lúdica: uma mosca simulada pode aprender a "caçar bugs"? A
pergunta científica por trás dela é séria. Queremos saber se o circuito de aprendizado associativo do corpo cogumelar,
conectado como na mosca real, consegue ligar uma característica abstrata de um estímulo a uma recompensa e transferir
essa associação para estímulos novos que compartilham a característica.

### 1.2 O corpo cogumelar como sistema de aprendizado

Nas moscas, cheiros ativam neurônios receptores olfativos (ORNs) agrupados em cerca de 50 glomérulos do lobo antenal.
Neurônios de projeção levam esse código às ~2.000 células de Kenyon (KCs) de cada lado, que respondem de forma
esparsa: cada cheiro ativa cerca de 5–10% delas (Honegger et al., 2011; Lin et al., 2014). As KCs convergem sobre
poucas dezenas de neurônios de saída (MBONs), organizados em compartimentos, cada um inervado por um tipo de neurônio
dopaminérgico (Aso et al., 2014). A dopamina associada a uma recompensa (grupo PAM) ou a uma punição (grupo PPL1)
deprime as sinapses KC→MBON ativas naquele momento (Hige et al., 2015). Isso muda a resposta das MBONs àquele cheiro e,
portanto, o comportamento de aproximação ou de evitação.

### 1.3 Contribuições

1. Um protocolo de treino e teste para um cérebro simulado a partir do conectoma, com controles pareados (pesos
   congelados, escolha aleatória, explorador por novidade), critérios escritos antes e replicação.
2. A demonstração de que o aprendizado acontece no cérebro isolado, é específico ao estímulo recompensado e depende de
   quantas KCs o estímulo ativa.
3. Um diagnóstico metodológico que achamos útil além deste projeto: validar a bancada comportamental com um
   "oráculo" sem cérebro e uma análise de poder **antes** de gastar simulações caras.
4. O registro completo de resultados negativos e de cada ajuste, com a razão de cada um.

---

## 2. O modelo: o que vem do mapa e o que é regra

### 2.0 Visão geral: como o cérebro simulado funciona

Em uma frase, o modelo é fiel ao animal na **fiação** e simplificado no **neurônio**. A fiação vem da mosca real:
quem se liga a quem, com quantas sinapses e com que sinal. O comportamento elétrico de cada neurônio é uma abstração
deliberada.

O caminho do estímulo ao comportamento tem seis passos:

1. **O mapa.** O Male CNS v1.0 foi obtido fatiando o sistema nervoso de um macho em camadas de poucas dezenas de
   nanômetros, fotografando cada uma por microscopia eletrônica e reconstruindo cada neurônio e cada sinapse. O modelo
   usa os 166.700 neurônios e as 6,2 milhões de conexões com 5 ou mais sinapses.
2. **O neurônio.** Cada neurônio é um integrador com vazamento: uma voltagem que sobe com as entradas e decai para o
   repouso. Ao cruzar o limiar, ele dispara e é reiniciado (formato de Shiu et al., 2024).
3. **A sinapse.** Cada disparo chega aos neurônios de destino com peso proporcional ao número de sinapses da conexão.
   O sinal vem do neurotransmissor previsto para o neurônio de origem.
4. **O tempo.** A simulação avança em passos de 0,25 ms e só calcula os neurônios fora do repouso e os disparos que
   existem. No navegador, roda a 0,65–1,2× o tempo real.
5. **Entradas e saídas.** Os sentidos entram como trens de disparos nos neurônios sensoriais reais: os receptores
   olfativos de cada glomérulo, os neurônios de açúcar das patas e o LC10a na visão. O comportamento é lido na taxa de
   disparo de neurônios de comando reais:
   - os descendentes DNa01–03, que viram a mosca;
   - os motores da probóscide;
   - a fibra gigante (DNp01), que comanda a fuga;
   - os motores das asas;
   - as saídas do corpo cogumelar.
6. **O aprendizado.** A dopamina de recompensa deprime as sinapses entre células de Kenyon ativas e as saídas de
   evitar (seção 2.2).

As seções 2.1 a 2.4 detalham cada parte. A seção 2.6 discute o quanto esse modelo se parece com o animal real.

A regra de honestidade do projeto é declarar, para cada comportamento, se ele emerge da fiação medida ("do mapa") ou
se é uma regra que escrevemos ("regra"). A página interativa e o README fazem o mesmo.

### 2.1 Conectoma e neurônios (do mapa, com calibração global)

- **Dados:** Male CNS v1.0 (HHMI Janelia, 2026), 166.700 neurônios. Usamos as 6,2 milhões de conexões com 5 ou mais
  sinapses. O sinal de cada conexão vem do neurotransmissor previsto: acetilcolina excita; GABA, glutamato e
  histamina inibem.
- **Neurônios:** integra-e-dispara com os parâmetros de Shiu et al. (2024), passo de 0,25 ms, simulação por eventos.
- **Calibrações globais**, necessárias porque o mapa tem mais que o dobro de sinapses do usado em 2024 e, sem elas, o
  cérebro inteiro dispara junto:
  - ganho sináptico de 0,5 × o original;
  - adaptação de 0,3 mV por disparo, com constante de 1 s;
  - sem as conexões excitatórias entre neurônios de projeção e interneurônios locais do lobo antenal, que num modelo
    de neurônio-ponto viram um eco que não desliga;
  - sem autapses.

  Nenhum peso individual foi ajustado para produzir comportamento.
- **Tônus:** as MBONs recebem 6,8 mV de tônus e os descendentes de direção DNa01–03 recebem 7,3 mV, como numa mosca
  ativa. São os únicos ajustes por grupo.

### 2.2 Aprendizado (regra biológica implementada)

- **Onde e como:** a plasticidade age só nas sinapses KC→MBON. Uma recompensa (PAM a 100 Hz) deprime as sinapses de
  KCs ativas para as MBONs de evitar (`mbon_evitar_rec`); uma punição (PPL1) deprime as sinapses para as MBONs de
  aproximar. É a regra de Hige et al. (2015), implementada por nós (`web/sim-worker.js`).
- **Esquecimento e consolidação:** a sinapse volta ao valor original com constante de 90 s, e cada episódio de
  dopamina deixa a mudança mais estável, até 10 vezes mais lenta.
- **Grupos:**
  - `kc`: 4.064 células de Kenyon;
  - `mbon_aprox`: 48 MBONs de aproximar;
  - `mbon_evitar`: 39 MBONs de evitar;
  - `mbon_evitar_rec`: 30 MBONs de evitar, deprimidas pela recompensa;
  - `recompensa`: 222 PAM;
  - `dor`: 12 PPL1.
- **Controle sem plasticidade (`plasticidade: false`):** o mesmo cérebro, com a mesma exposição e as mesmas
  recompensas, mas com os pesos parados. É o controle principal de todos os experimentos.

### 2.3 Leitura da memória: valência (regra)

A decisão lê a atividade das MBONs durante o cheiro:

> valência = taxa de `mbon_aprox` − média(taxa de `mbon_evitar`, taxa de `mbon_evitar_rec`)

em Hz por neurônio, numa amostra de 1 s. Medimos o ruído dessa leitura com os pesos congelados
(`docs/medicoes/qa-calibracao.json`): desvio-padrão de 0,38 com amostras de 0,3 s e 0,15 com amostras de 1 s. Por
isso usamos 1 s em todas as séries honestas.

### 2.4 Corpo e mundo (fora do escopo deste artigo)

O projeto também tem corpo, com a NeuroMechFly no MuJoCo, olhos compostos com 721 omatídeos por olho e campos
receptivos do LC10a medidos nas sinapses, e mundos em 3D. A arena de dois cheiros da seção 5.2 usa esse corpo. A caça
a bugs deste artigo (seção 6) roda **sem corpo**, só com o cérebro, para isolar o aprendizado do custo e do ruído
motor. Os detalhes do corpo estão no README.

### 2.5 Limites do modelo que importam aqui

- **KCs muito esparsas:** as KCs ativadas por cheiro são mais esparsas que nas moscas reais. O cheiro A (VA2+DM4)
  acende 3,1–3,2%, contra ~5–10% nas moscas.
- **Estímulo idealizado:** o cheiro é uma taxa fixa (100 Hz bilateral) nos ORNs de cada glomérulo, sem dinâmica de
  receptor nem de mistura.
- **Um tipo de plasticidade:** há só a depressão KC→MBON. Faltam plasticidade de longo prazo com síntese de proteínas,
  compartimentos com tempos distintos e a transmissão rápida da dopamina, que o worker zera.

### 2.6 Quão real é o cérebro simulado

**Onde o modelo se comporta como o animal.** Os circuitos abaixo não foram programados: emergem da fiação. Os números
são triagens do próprio modelo, com o método e os dados citados no README.

- **Alimentação:** açúcar nos neurônios gustativos das patas ativa os neurônios motores da probóscide. Com açúcar a
  160 Hz por neurônio, o grupo da probóscide somou 290 disparos/s, com o primeiro sinal em 30 ms. Sem estímulo, ficou
  em silêncio.
- **Orientação visual:** o LC10a de um olho, detector de objetos pequenos que nos machos guia a perseguição da fêmea,
  ativa o descendente DNa02 do mesmo lado em ~90 Hz. O resultado é virar para o que vê.
- **Fuga:** uma ameaça em expansão (LPLC2 e LC4) dispara a fibra gigante em rajada, com ~250 disparos em 300 ms e o
  primeiro em 5–6 ms. Os descendentes DNp02, DNp04 e DNp11 dão a direção da fuga.
- **Aprendizado associativo:** o pareamento de um cheiro com dopamina reduz a resposta das MBONs de evitar só para
  aquele cheiro (seção 5.1), como no animal (Hige et al., 2015).
- **Previsões validadas no trabalho de origem:** um modelo do mesmo formato (Shiu et al., 2024) previu circuitos de
  alimentação e de higiene. Boa parte das previsões testadas foi confirmada em moscas reais por ativação e silenciamento
  de neurônios.

**Onde o modelo não reproduz o animal.**

- **Neurônio-ponto:** cada neurônio é um único compartimento, sem a geometria dos dendritos, sem condutâncias
  intrínsecas próprias e com os mesmos parâmetros para todos. Neurônios reais variam muito nesses três pontos.
- **Sem retina:** as primeiras etapas da visão (fotorreceptores, L1–L3, Mi1, Tm3) funcionam por potenciais graduados,
  que o modelo de disparos não representa. A visão entra diretamente no LC10a, por uma regra nossa.
- **Química incompleta:** faltam neuromodulação ampla (hormônios, octopamina, serotonina; a dopamina age só pela regra
  de aprendizado), junções elétricas e glia.
- **Calibrações globais** (seção 2.1), necessárias para evitar a atividade descontrolada; nenhum peso individual foi
  ajustado:
  - pesos pela metade;
  - adaptação depois de cada disparo;
  - um circuito excitatório do lobo antenal removido;
  - sem autapses.
- **Memória:** um único mecanismo, que esquece em ~90 s. O animal tem memórias de curto, médio e longo prazo, com
  mecanismos distintos.
- **Esparsidade do corpo cogumelar:** cada cheiro ativa ~3% das células de Kenyon, contra 5–10% no animal. Isso pesa
  nos resultados deste artigo: pistas que acendem poucas KCs não aprendem (seções 6.3 e 6.9).
- **Resultados negativos do próprio modelo:**
  - os descendentes de pouso (DNp07, DNp10) ficaram silenciosos;
  - tocar as patas da frente não altera nenhum neurônio descendente;
  - os neurônios do órgão de Johnston anotados como de higiene não ativaram os descendentes de limpeza nas condições
    testadas.

**O que é regra nossa.**

- **No corpo:** o passo das patas, a fome e a atração inata por cheiros, esta tirada da literatura.
- **Na caça a bugs:** a codificação das ações em cheiros, a leitura da valência nas MBONs e a escolha por softmax.

Cada regra está declarada no README, na página e neste texto.

**Síntese.** O modelo é a fiação real de um sistema nervoso inteiro, rodando com neurônios simplificados. Não é uma
mosca dentro do computador, e não afirmamos isso. Afirmamos que, com essa fiação e essa abstração, aparecem os
circuitos que a biologia descreve no animal: alimentação, orientação, fuga e aprendizado associativo. Os resultados
da caça a bugs devem ser lidos dentro desse limite.

---

## 3. Metodologia geral

### 3.1 Princípios

1. **Critério antes da medida.** Cada série tem o critério escrito no plano (`docs/plano-treino-robusto.md`) e
   commitado no git **antes** de rodar. O histórico do repositório prova a ordem.
2. **Pareamento por semente.** Todas as condições de uma semente veem a mesma sequência de ações visíveis, sorteada
   antes. Isso remove a variância de "onde a mosca começou", que em rodadas anteriores, não pareadas, chegou a simular
   transferência.
3. **Controles:**
   - **congelada:** mesma exposição, sem plasticidade. É o controle principal;
   - **aleatória:** escolha uniforme entre as ações visíveis;
   - **novidade:** escolhe a ação menos tentada até ali;
   - **controle de tarefa (bancada 2):** um defeito que a memória não deve ajudar a achar.
4. **Estatística:** diferença pareada por semente (treinada − outra condição). Intervalo de 95% por bootstrap
   percentil, com 2.000 reamostragens das sementes, e só com 5 ou mais sementes.
5. **Replicação:** um resultado positivo só conta se repetir com sementes novas e o mesmo critério.
6. **Mudança de bancada declarada:** mudar a tarefa depois de ver resultados é necessário, mas perigoso. Cada mudança
   é justificada por um diagnóstico independente do resultado principal, usa sementes novas e vem acompanhada de
   critério novo, escrito antes.
7. **Resultados negativos são publicados** com o mesmo detalhe dos positivos.

### 3.2 Execução

O cérebro roda no Node.js, dentro de uma thread, com o mesmo código da página (`web/sim-worker.js`). Cada série usa 4
processos paralelos, porque cada cérebro ocupa 1,5–2 GB. A rotina `scripts/madrugada.mjs` executa uma escada de
variantes escrita antes, resume cada série, anota o resultado no plano e faz o commit sem intervenção. Todo arquivo de
medida em `docs/medicoes/` traz o próprio método no campo `metodo`.

---

## 4. Tarefa: caça a bugs como condicionamento olfativo

### 4.1 O sistema em teste

`web/qa/pedidos.js` é um sistema de Pedidos em memória, com estoque, carrinho, pedidos, cobranças, cancelamentos e
cupons. Ele tem três partes separadas:

- **sistema:** as regras, com defeitos injetáveis por versão;
- **executor:** traduz a ação escolhida numa operação do sistema;
- **verificador:** confere contratos no estado e não sabe onde está o defeito. Os contratos são:
  - estoque ≥ 0 e ≤ inicial;
  - conservação do estoque (disponível + reservado em pedidos ativos = inicial);
  - uma cobrança por pedido e nenhuma cobrança sem valor;
  - total finito e ≥ 0;
  - nenhuma quantidade negativa aceita;
  - desconto ≤ 30%.

Na versão correta, 40.000 ações aleatórias (bancada 1) e 90.000 (bancada 2) não geraram nenhum alarme falso.

### 4.2 Ações como cheiros

As 15 ações combinam uma **família** (carrinho, estoque, pagamento, cancelamento, cupom) e uma **entrada** (normal,
zero, limite, negativa, repetida). Cada uma das 10 características é um par de glomérulos, e o cheiro da ação é a
união dos quatro, com os ORNs a 100 Hz bilateral. Os glomérulos usados pela atração inata da Cozinha e pela arena A/B
ficam de fora. Essa codificação é uma **metáfora nossa**: o cheiro representa pistas do que a ação faz.

### 4.3 Decisão e recompensa (regras)

- **Escolha:** a cada passo, 3 das 15 ações ficam visíveis. A mosca cheira cada uma por 1 s, com 0,2 s sem odor entre
  elas, e escolhe por softmax (T = 0,15) sobre a valência.
- **Recompensa:** um contrato violado pela primeira vez no episódio (um bug novo) é pareado com o cheiro da ação por
  2 s, com PAM a 100 Hz nos últimos 0,5 s. Ação sem bug não é punida.
- **Hipótese:** o treino em versões com defeitos de repetição em pagamento e cancelamento eleva a valência da
  característica "repetida". No teste, em famílias novas, a mosca treinada escolhe mais as ações repetidas e acha
  antes os defeitos de repetição.

### 4.4 Métrica principal

Ações até o primeiro bug de teste (31 quando não acha em 30), média das versões de teste. A comparação principal é
treinada − congelada, e esperamos um valor negativo.

---

## 5. Validação do aprendizado antes da tarefa (T0 e T1)

### 5.1 T0: o treino muda o cérebro de forma específica?

`scripts/t0_cerebro.mjs`, sementes 29, 101 e 202, `docs/medicoes/t0-cerebro.json`. Worker real, sem corpo; sondas de
2 s de cada cheiro antes e depois do treino, com o cheiro A (VA2+DM4) recompensado e o B (DP1l+DM2) não.

- **Especificidade:** com plasticidade, a resposta de `mbon_evitar_rec` a A caiu −0,91, −1,11 e −1,00 Hz (de ~1,4 para
  ~0,5 Hz, −65%). A B mudou −0,04, +0,03 e −0,02. Congelado, tudo ficou dentro do ruído.
- **Valência de A:** passou de 0,62–0,75 para 1,41–1,46 com plasticidade. B e o congelado ficaram inalterados.
- **Esparsidade:** A ativa 126–132 KCs (3,1–3,2%) e B 97–101 (2,4–2,5%). A sobreposição (Jaccard 0,009) é quase nula.
  Sem cheiro, as MBONs ficam em silêncio.

### 5.2 T1: o aprendizado vira comportamento num corpo?

Arena de dois cheiros com o corpo simulado, 5 sementes × A/B recompensado × treinada/congelada = 20 sessões (lote
`docs/medicoes/lotes/2026-09-29T22-25-18-608Z-a560c5`).

A ponte memória → movimento é uma regra que lê os pesos sinápticos aprendidos. Preferência pela pista recompensada,
treinada contra congelada:

| Momento | Treinada | Congelada |
|---|---|---|
| Depois do treino | +0,56 | −0,06 |
| Com os lados trocados | +0,62 | −0,20 |
| Depois da reversão | +0,74 | −0,15 |

- **Resultado:** diferença pareada de **0,74, IC95 [0,65; 0,82], 5/5 sementes. Passou.**
- **Troca de métrica, declarada:** a métrica originalmente escrita (ganho = depois − antes) ficou indefinida em 2
  sementes, porque não houve nenhuma escolha no teste de antes. Trocamos para a média das preferências depois do
  treino, uma decisão tomada pela indefinição e não pelo resultado. Está registrada no plano.
- **Resultado negativo:** a mesma arena com a ponte pela atividade das MBONs (valência, seção 2.3) deu 0,06, IC95
  [−0,43; 0,65]. O aprendizado aparece nas MBONs, mas essa leitura, com amostras curtas no corpo andando, não virou
  preferência.

---

## 6. Resultados na caça a bugs

### 6.1 Série com desconto: um atalho identificado e retirado

A primeira versão descontava da valência de cada ação a valência de nascença dela, medida no início e guardada numa
tabela **fora do cérebro**. Isso é memória externa, então retiramos o desconto.

Com as 5 sementes já rodadas, o resultado foi negativo: treinada − congelada = +2,8, IC95 [−1,2; +6,8]. Fica só como
referência (`qa-abstrato-resumo.json`).

### 6.2 Série honesta: negativa

Para tirar o desconto, calibramos os pares de glomérulos por busca local, com os pesos congelados, para que as 15
ações nascessem neutras. A valência de nascença passou de [−0,65; +0,73] para [−0,22; +0,36]
(`qa-cheiros.json`).

Resultado com 8 sementes (11–18, `qa-honesto-resumo.json`):
- Primeiro bug de teste: treinada 25,2, congelada 27,7, aleatória 19,7, novidade 22,9 ações.
- Treinada − congelada: −2,5, IC95 [−5,25; +0,17]. **Não passou.**
- A escolha aleatória foi melhor que a treinada: +5,5, IC95 [+0,4; +10,6].
- **Diagnóstico:** a valência das ações premiadas mudou −0,01 com o treino. A recompensa não gravou nada.

### 6.3 Por que não gravou: os cheiros acendiam poucas KCs

**Dose-resposta** (`qa-dose.json`): até 8 pareamentos seguidos da mesma ação subiram a valência só +0,1 a +0,2, o
mesmo tamanho do ruído e o mesmo que o controle congelado.

**Contagem de KCs** (`qa-kcs.json`):
- As ações acendiam 19–86 KCs; a ação premiada, 38. O cheiro A acende 117.
- A ação premiada dava só 0,83 Hz em `mbon_evitar_rec`, contra 1,57 do A.
- Como a recompensa deprime KC→`mbon_evitar_rec`, com poucas KCs e pouca atividade nessa saída não há o que deprimir.
- A calibração por neutralidade tinha selecionado, sem querer, glomérulos fracos.

**Levantamento dos glomérulos** (`qa-glomerulos.json`): dos 34 glomérulos permitidos, poucos acendem KCs sozinhos
(DC1 73, VA6 58, VL2a 48, VC1 36), e metade acende 5 ou menos.

**Remapeamento** (`qa-cheiros-fortes.json`): a característica "repetida" passou a usar DC1+VA6, e um ajuste fino
penalizou tanto a não neutralidade quanto a falta de KCs.
- As ações "repetida" passaram a acender 87–107 KCs, com `mbon_evitar_rec` a 2,0–2,5 Hz.
- A valência de nascença ficou em [−0,35; +0,50]. As "repetida" nascem levemente positivas, de +0,04 a +0,42; esse
  viés vale igual para a treinada e a congelada.

**Dose com cheiro forte** (`qa-dose-kcs.json`, ação `estoque:repetida`, 91 KCs):

| Pareamentos | Treinada, sem. 11 | Congelada, sem. 11 | Treinada, sem. 12 | Congelada, sem. 12 |
|---|---|---|---|---|
| antes | 0,02 | 0,02 | −0,04 | −0,04 |
| 1 | +0,92 | −0,01 | +0,74 | −0,05 |
| 8 | +1,06 | +0,04 | +1,23 | −0,17 |
| +60 s cheirando outras ações | +0,88 | −0,05 | +0,85 | +0,03 |
| +180 s cheirando outras ações | +0,57 | +0,10 | +0,28 | 0,00 |

- **Aprende com uma recompensa:** um único pareamento basta, é específico (a ação de controle não sobe) e está
  ausente no cérebro congelado.
- **Esquece rápido:** a memória cai à metade ou menos em 3 minutos, o que é coerente com o esquecimento de τ = 90 s e
  relevante porque o treino padrão dura ~10 minutos.

### 6.4 Três variantes pré-registradas contra o esquecimento: negativas

A rotina automática rodou uma escada escrita antes, com 8 sementes novas por variante:

| Variante | Treinada | Congelada | Aleatória | Novidade | Treinada − congelada, IC95 | Valência das repetidas (treinada) |
|---|---|---|---|---|---|---|
| Treino padrão (3 × 60 ações) | 23,5 | 23,7 | 19,7 | 22,9 | −0,17 [−2,46; +2,08] | +0,27 |
| Treino curto (2 × 30 ações) | 21,3 | 21,3 | 19,0 | 24,2 | 0 [−1,96; +1,92] | +0,17 |
| Treino espaçado (6 × 20 ações) | 20,7 | 22,5 | 20,3 | 20,2 | −1,83 [−3,75; +0,08] | +0,55 |

As quatro colunas de condição mostram as ações até o primeiro bug de teste.

- **A memória agora se forma:** a valência das repetidas sobe com o treino, as outras ações ficam em ~0 e a congelada
  fica em ~0.
- **Mas não vira vantagem mensurável:** nenhuma das três passou no critério.

### 6.5 Diagnóstico da bancada: um oráculo sem cérebro

`scripts/qa_oraculo.mjs` e `qa-oraculo.json`: 4.000 episódios por política, com as mesmas regras de visibilidade.

| Versão de teste (bancada 1) | Aleatória | Memória perfeita ("prefere repetida") |
|---|---|---|
| Cupom duplo | 23,9 | 13,6 |
| Reserva dupla | 30,3 | 30,2 (achada em 6–7% dos episódios) |
| Cupom duplo + quantidade negativa | 11,3 | 10,1 (quem revela é `carrinho:negativa`) |
| **Média** | **21,8** | **18,0** |

Mesmo uma memória perfeita só adiantaria o primeiro bug em 3,8 ações, e duas das três versões não mediam
transferência:
- a reserva dupla exigia um pedido aberto antes, o que a tornava quase inalcançável em 30 passos;
- na terceira versão, quem revelava o bug era a quantidade negativa, que não tem nada a ver com repetição.

O melhor resultado cerebral (espaçado, −1,8) ficou em cerca de metade do teto, com 8 sementes, e o ruído não separa
isso de zero. A conclusão é que **o experimento não tinha poder para ver o efeito, mesmo que ele existisse**.

### 6.6 Bancada 2: desenho validado antes de rodar

**Mudanças** (`criar(defeitos, {bancada: 2})`):
- **Repetidas sem pré-condição:** as quatro ações "repetida" viraram cliques duplos completos (pagar, cancelar,
  reservar e aplicar o mesmo cupom duas vezes). O sistema correto é idempotente, e o defeito aparece num único passo:
  300/300 em cada defeito.
- **Estoque maior**, de 50/20, para não esgotar.
- **Teste em famílias novas:** cupom duplo e reserva dupla. Só a característica "repetida" liga treino e teste.
- **Controle de tarefa:** quantidade negativa, um defeito que a memória não deve ajudar a achar e, na verdade, deve
  atrapalhar, porque a mosca passa a preferir as repetidas.
- **Protocolo:** cheiros fortes; treino espaçado de 6 × 20 ações; teste **sem recompensa** (como o teste sem açúcar do
  condicionamento clássico de Tully e Quinn, 1985); cada episódio de teste termina no primeiro bug.

**Validação por oráculo** (`qa-oraculo-b2.json`), em ações até o primeiro bug nas versões de transferência:

| Política | Ações |
|---|---|
| Aleatória | 13,2 |
| Memória perfeita | 6,2 |
| Memória com o ganho medido no cérebro (+0,25; ruído 0,15; softmax) | 8,4–8,8 |
| Novidade | 9,1 |

No controle, a memória piora a busca (de 14,4 para 17–20 ações), a dissociação esperada.

**Poder:** simulando o experimento inteiro 300 vezes, 16 sementes detectam até o menor ganho de valência medido
(+0,17) em 92% das vezes. O oráculo não inclui o esquecimento durante o teste, e esse é o seu limite.

**Critério pré-registrado** (commit `97abe12`):
- **Principal:** nas versões de transferência, treinada − congelada com IC95 < 0, sementes 51–66.
- **Secundário:** no controle, a diferença não deve ser negativa.
- **Descritivo:** a treinada comparada com a novidade e a aleatória.
- **Replicação:** sementes 71–86.

**Continuação** (commit `e644d32`), já escrita para os dois desfechos, cada degrau com 16 sementes novas e replicação:
- **Se replicar:** um controle sensorial, trocando os glomérulos de "repetida" e "normal", e um teste de retenção de
  180 s.
- **Se não replicar:** treino de 12 × 20 ações e depois 5 ações visíveis por passo.

Toda série passa a registrar a fração das vezes em que a mosca escolheu uma ação repetida visível.

**Resultados: passou e replicou.** Ações até o primeiro bug (menor é melhor); 16 sementes em cada série
(`qa-b2-resumo.json`, `qa-b2-replica-resumo.json`):

| Série | Condição | Transferência | Controle |
|---|---|---|---|
| Principal (51–66) | Treinada | **8,8** | 27,4 |
| | Congelada | 13,8 | 23,7 |
| | Aleatória | 15,4 | 8,4 |
| | Novidade | 10,2 | 9,3 |
| Replicação (71–86) | Treinada | **5,8** | 28,0 |
| | Congelada | 12,8 | 19,7 |
| | Aleatória | 11,8 | 12,0 |
| | Novidade | 10,8 | 9,4 |

Diferenças pareadas (treinada − outra condição), IC95 por bootstrap:

| Comparação | Principal | Replicação |
|---|---|---|
| **Transferência, contra a congelada (critério)** | **−5,06 [−8,00; −2,31]** | **−6,94 [−9,13; −4,88]** |
| Transferência, contra a aleatória | −6,63 [−9,91; −3,06] | −5,97 [−8,44; −3,75] |
| Transferência, contra a novidade | −1,44 [−3,78; +1,03] | −4,94 [−7,72; −2,50] |
| Controle, contra a congelada | +3,69 [−2,13; +9,75] | +8,31 [+3,13; +14,06] |

**O que os números mostram:**

- **O critério principal passou nas duas séries**, com sementes independentes. A mosca treinada acha os defeitos de
  repetição em famílias que nunca viu 5 a 7 ações antes da mesma mosca com os pesos congelados, que teve a mesma
  exposição e as mesmas recompensas.
- **Memória:** a valência das ações repetidas subiu +1,03 e +0,95 com o treino. As outras ações mudaram −0,07; na
  congelada, as mudanças ficaram em ~0.
- **A memória vira escolha:** na replicação, a única série que registrou isso, a treinada escolheu uma ação repetida
  em 85% das vezes em que havia uma visível. A congelada escolheu em 53%, a aleatória em 46% e a novidade em 45%.
- **A dissociação esperada apareceu:** no controle, em que o defeito não é de repetição, a treinada não melhora; ela
  **piora** (+3,7 e +8,3; o segundo tem IC95 acima de 0). O que ela aprendeu foi "repetição dá defeito", e não "achar
  qualquer coisa mais rápido". Isso tem um custo quando o defeito é de outro tipo.
- **Contra os exploradores sem cérebro:** a treinada supera a escolha aleatória nas duas séries. Contra a novidade, o
  resultado é descritivo: empata na principal e ganha na replicação.

**Leitura cuidadosa:**

1. O efeito existe **sob as nossas regras** (os cheiros das ações, a leitura da valência e o softmax); a
   aprendizagem em si é do circuito do mapa.
2. O viés de nascença a favor das repetidas explica por que a congelada também vai mal no controle, mas não explica a
   diferença entre treinada e congelada, porque as duas têm o mesmo viés.
3. A melhora da principal para a replicação (−5,1 para −6,9) está dentro do ruído entre séries.

As extensões pré-registradas para depois deste resultado (controle de cheiro, retenção, tipo de defeito e decepção)
estão nas seções 6.9 e 6.10.

### 6.7 Resultado por versão e correção para várias comparações

Por versão de teste (treinada − congelada, IC95):

| Versão | Principal | Replicação |
|---|---|---|
| Cupom duplo | −8,3 [−13,3; −3,9] | −7,4 [−11,4; −3,9] |
| Reserva dupla | −1,8 [−5,3; +1,3] | −6,4 [−11,7; −2,1] |

Na série principal, a reserva dupla sozinha não se separa do zero.

O projeto rodou 16 séries confirmatórias na caça a bugs. Para controlar a chance de algum falso positivo na família
inteira, ajustamos os p do bootstrap pelo método de Holm (`scripts/qa_comparacoes.mjs`, `qa-comparacoes.json`). O
critério de cada série é o principal escrito antes; na decepção, é a redução do custo no controle.

| Série | Diferença (IC95) | p de Holm | Resultado |
|---|---|---|---|
| Bancada 1, com desconto | +2,8 [−1,2; +6,8] | 0,60 | negativo |
| Bancada 1, cheiros fracos | −2,5 [−5,3; +0,2] | 0,44 | negativo |
| Bancada 1, cheiros fortes (padrão, curto, espaçado) | −0,2 / 0 / −1,8 | 1 / 1 / 0,44 | negativos |
| **Bancada 2, principal e replicação** | −5,1 [−8,0; −2,3] / −6,9 [−9,1; −4,9] | 0,007 / 0,007 | **positivos** |
| Bancada 2, cheiros trocados (fracos) | −2,1 [−5,4; +1,3] | 0,74 | negativo |
| **Retenção 180 s, principal e replicação** | −4,8 [−8,3; −1,7] / −5,6 [−8,9; −2,5] | 0,007 / 0,009 | **positivos** |
| **Tipo de defeito "normal", principal e replicação** | −4,8 [−7,3; −2,4] / −5,1 [−8,0; −2,4] | 0,007 / 0,007 | **positivos** |
| Decepção, principal | −6,3 [−11,6; −1,7] | 0,06 | positivo sem correção |
| Decepção, replicação | −4,6 [−10,6; +0,6] | 0,68 | **não replicou** |
| Curiosidade, principal e replicação (superioridade contra a novidade) | −0,2 [−1,2; +0,9] / −0,3 [−1,5; +0,9] | 1 / 1 | empate (ver 6.11) |

As 6 séries positivas que replicaram continuam significativas depois da correção (p de Holm 0,008–0,011). A decepção
passou na série principal sem correção (p 0,006), mas não com ela, e não replicou: não conta como achado. Na
curiosidade, a família recebe o teste de superioridade contra a novidade, que não passa. O critério principal dela era
de não-inferioridade, que não é um teste contra zero e fica fora da família (seção 6.11).

### 6.8 Linha de base: um aprendiz clássico com as mesmas informações

Um revisor perguntaria o que a mosca faz que um algoritmo simples não faz. `scripts/qa_linha_base.mjs`
(`qa-linha-base.json`) roda, sem cérebro, as mesmas 32 sementes, as mesmas ações visíveis e o mesmo treino e teste
com quatro agentes:

- o modelo de Rescorla–Wagner (RW) linear por característica (o modelo clássico do condicionamento; α 0,3 e T 0,15,
  escolhidos antes de rodar);
- o mesmo modelo atualizando só quando há recompensa, como a mosca;
- um valor por ação inteira, sem características;
- o teto, que prefere a característica premiada.

| Agente | Transferência | Controle |
|---|---|---|
| **Mosca treinada** | **7,3** | 27,7 |
| RW | 12,6 | 14,6 |
| RW só com recompensa | 8,5 | 22,0 |
| Valor por ação (sem características) | 15,4 | 13,7 |
| Teto (prefere a premiada) | 6,5 | 20,0 |

Os números são ações até o primeiro bug. A mosca acha os bugs de transferência antes do RW (−5,3 [−7,5; −3,2]) e
ligeiramente antes do RW só com recompensa (−1,2 [−2,6; −0,1]), e perto do teto.

Variando α (0,1–0,6) e T (0,05–0,5), aparece uma troca estável entre os dois tipos de aprendiz:
- **quem só aprende com recompensa** transfere bem (7,4–11,5) e paga no controle (16–26);
- **o RW que também aprende com a ausência de bug** transfere pior (10,7–20,9) e paga menos (9,7–15,6).

O valor por ação, sem características, não transfere, como esperado.

No braço do tipo de defeito "normal" (`qa-linha-base-normal.json`, 32 sementes), o padrão se repete. A mosca levou
7,95 ações na transferência, contra 12,6 do RW (diferença −4,6 [−7,2; −2,4]), 7,98 do RW só com recompensa e 6,8 do
teto.

A mosca se comporta como um aprendiz que só aprende com recompensa e generaliza por característica. O custo dela no
controle é o maior de todos, e parte dele é o viés de nascença das repetidas, que a congelada também tem (21,7). A tese
não é que a mosca seja o melhor testador. A tese é que o circuito real forma e transfere a associação, e a linha de
base mostra em que ponto da troca ela fica.

### 6.9 Controle de cheiro: com glomérulos fracos, a memória não vira escolha (negativo)

`qa-b2-cheiro-trocado`, sementes 91–106: os glomérulos de "repetida" e "normal" foram trocados. As repetidas ficaram
com VL2a+VM6v, que acendem menos KCs; "normal" ficou com o par forte DC1+VA6.

- **Resultado:** transferência, treinada − congelada = −2,1, IC95 [−5,4; +1,3]. Não passou.
- **Memória fraca:** a valência das repetidas subiu só +0,27, contra +1,0 com o par forte.
- **A memória não virou escolha:** ela escolheu uma repetida em 30% das oportunidades, igual à congelada (29%) e abaixo
  da aleatória (42%). Os cheiros fortes de "normal" nascem atraentes e puxam as escolhas.

A ressalva escrita antes previa isso ("menos KCs, efeito talvez menor"). O resultado confirma, no comportamento, o que
a dose-resposta mostrou no cérebro isolado (seção 6.3): a transferência depende de a pista recrutar KCs suficientes, e
um cheiro forte que nasce atraente numa ação sem bug compete com a memória. É uma limitação real do resultado
principal: ele vale para pistas que acendem ~90 KCs ou mais.

### 6.10 Retenção, tipo de defeito e decepção

Todas as três extensões têm 16 sementes por série, critérios escritos antes (`docs/plano-treino-robusto.md`, "Fila de
validade") e replicação. Os números são ações até o primeiro bug, e a diferença é treinada − congelada na
transferência.

**Retenção (`qa-b2-retencao`).** Entre o treino e o teste, 180 s cheirando ações não premiadas.

| Série | Treinada | Congelada | Diferença (IC95) | Escolheu a premiada (treinada / congelada) |
|---|---|---|---|---|
| Principal (111–126) | 10,8 | 15,6 | −4,8 [−8,3; −1,7] | 70% / 50% |
| Replicação (151–166) | 6,8 | 12,4 | −5,6 [−8,9; −2,5] | 78% / 54% |

- **Passou e replicou.** A memória enfraquece com a espera (85% de escolha sem espera), mas continua guiando a busca.
- Isso é coerente com a dose-resposta (seção 6.3): depois de 180 s ainda restava +0,28 a +0,57 de valência.

**Tipo de defeito (`qa-b2-normal`).** A característica premiada passa a ser "normal", com quatro defeitos novos na
mesma estrutura:
- pagamento que cobra valor zero;
- cancelamento que devolve um item a mais;
- cupom de 10% aplicado como 40%;
- abertura de pedido que baixa estoque sem reservar.

Validação antes de rodar: a versão correta continua sem alarme falso em 90.000 ações, e o oráculo dá aleatória 13,3,
memória perfeita 6,7 e memória com o ganho medido 9,1.

Mudança declarada, feita antes de rodar este item: o desenho original premiava "normal" com os glomérulos fracos, a
mesma configuração que falhou na seção 6.9. Passou a usar o mapa trocado, de modo que a característica premiada tem o
par forte nos dois braços. O viés de nascença continua controlado pela congelada, que tem o mesmo viés.

| Série | Treinada | Congelada | Diferença (IC95) | Escolheu a premiada (treinada / congelada) |
|---|---|---|---|---|
| Principal (211–226) | 8,3 | 13,1 | −4,8 [−7,3; −2,4] | 81% / 58% |
| Replicação (231–246) | 7,6 | 12,7 | −5,1 [−8,0; −2,4] | 76% / 55% |

- **Passou e replicou.** Nas duas séries, as duas versões de transferência se separaram do zero sozinhas.
- A valência de "normal" subiu +0,89 e +0,92; as outras ações mudaram −0,08 e −0,09.
- **A transferência não é exclusiva de um tipo de defeito.**

**Decepção no teste (`qa-b2-decepcao`).** O treino é idêntico ao da mosca treinada. No teste, escolher uma ação com
valência acima de 0,6 e não achar bug dispara a dopamina de punição (PPL1, 100 Hz nos últimos 0,5 s de 2 s do
cheiro). É como a mosca real que sente sem açúcar o cheiro que prometia açúcar (Felsenberg et al., 2017, 2018).
Quando disparar é regra nossa.

| Série | Condição | Transferência | Controle | Escolheu a premiada |
|---|---|---|---|---|
| Principal (251–266) | Treinada | 7,7 | 29,5 | 79% |
| | Com decepção | 9,0 | 23,3 | 63% |
| | Congelada | 13,6 | 25,6 | 52% |
| Replicação (271–286) | Treinada | 8,6 | 26,8 | 79% |
| | Com decepção | 12,5 | 22,1 | 59% |
| | Congelada | 13,1 | 24,3 | 55% |

Critérios pré-registrados:

| Critério | Principal | Replicação |
|---|---|---|
| Principal: no controle, sem − com decepção > 0 | +6,3 [+1,7; +11,6], **passou** | +4,6 [−0,6; +10,6], **não passou** |
| Secundário: na transferência, com decepção − congelada < 0 | −4,6 [−7,4; −1,9], passou | −0,6 [−3,4; +2,1], não passou |

- **Não replicou, então não conta como achado.** A direção do efeito no controle se repetiu (4,6 a 6,3 ações a
  menos), com 5,1 decepções por sessão em média. O que variou foi o custo na transferência: 1,4 ações na principal e
  3,9 na replicação. Nesta, a mosca com decepção deixou de se separar da congelada.
- **Análise exploratória, não pré-registrada:** juntando as 32 sementes, a decepção reduz o custo no controle em 5,4
  [+1,7; +9,4], custa 2,7 [+1,0; +4,5] na transferência e ainda transfere contra a congelada (−2,6 [−4,7; −0,5]).
- **Leitura:** a decepção move a mosca ao longo da troca prevista pela linha de base (seção 6.8): menos
  especialização, alguma perda no que aprendeu. O tamanho dessa perda não é estável com 16 sementes.

**O explorador por novidade.** Em todas as séries da bancada 2, a novidade foi a melhor estratégia no controle (7,9
a 12,3 ações, contra 26,6–29,9 da mosca treinada e 22–23 da mosca com decepção) e na média de todos os defeitos (7,7 a
12,7 ações, contra 13,2 a 17,2 da treinada). Na transferência, a mosca treinada empatou com
ela em quase todas as séries; a exceção é a replicação da bancada 2, em que ganhou (−4,9 [−7,7; −2,5]). A mosca
treinada ganha onde aprendeu e perde onde não aprendeu.

### 6.11 Memória + curiosidade: empate com a novidade

**Pergunta.** Somar à memória uma regra de habituação faz a mosca empatar com o explorador por novidade, ou ganhar
dele, na média de todos os defeitos?

**Regra (nossa, declarada).** No teste, a escolha usa:

> valência − H × vezes que ela já tentou aquela ação neste episódio

É habituação ao que já provou, como a visão da página faz, e moscas reais habituam. O treino é idêntico ao da mosca
sem curiosidade: mesma semente e mesmo cérebro até o teste.

**H escolhido antes, no oráculo** (`qa_curiosidade_oraculo.mjs`). O oráculo usa a valência de cada ação medida no
cérebro depois do treino, com o viés de nascença, mais ruído. Ele reproduz o cérebro sem curiosidade (6,8 na
transferência e 25,7 no controle, contra 5,8–8,8 e 26,6–29,9 no cérebro). Na média de todos os defeitos, o resultado
estabiliza a partir de H = 2,5, em 8,2 ações, contra 9,6 da novidade.

Com esse peso, a mosca tenta primeiro o que ainda não tentou e, entre as opções igualmente novas, escolhe pela
memória.

**Desenho, escrito antes.**
- **Poder:** 16 sementes com cada versão de teste repetida 3 vezes (73% de poder para superioridade e ~100% para
  não-inferioridade, no oráculo).
- **Condições:** treinada, treinada com curiosidade, congelada com curiosidade, aleatória e novidade. Sementes 301–316,
  replicação 321–336; 2 simulações por vez, a pedido do usuário.

Ações até o primeiro bug:

| Série | Condição | Média de todos | Transferência | Controle |
|---|---|---|---|---|
| Principal | Treinada (só memória) | 15,7 | 10,6 | 25,8 |
| | **Treinada com curiosidade** | **9,5** | **8,1** | 12,4 |
| | Congelada com curiosidade | 10,2 | 8,6 | 13,5 |
| | Aleatória | 13,0 | 12,1 | 14,9 |
| | Novidade | 9,7 | 9,7 | **9,6** |
| Replicação | Treinada (só memória) | 14,8 | 9,1 | 26,3 |
| | **Treinada com curiosidade** | **9,6** | **7,2** | 14,5 |
| | Congelada com curiosidade | 10,4 | 8,3 | 14,5 |
| | Aleatória | 12,9 | 12,0 | 14,9 |
| | Novidade | 9,9 | 9,3 | **11,1** |

Critérios pré-registrados:

| Critério | Principal | Replicação |
|---|---|---|
| **Principal:** curiosa − novidade, média de todos, IC95 < +1,5 | −0,18 [−1,17; +0,90], **passou** | −0,26 [−1,47; +0,92], **passou** |
| Superioridade: curiosa − novidade, IC95 < 0 | não | não |
| Transferência: curiosa − congelada curiosa < 0 | −0,53 [−1,26; +0,19], não | −1,19 [−2,44; +0,03], não |
| Controle: sem − com curiosidade > 0 | +13,4 [+10,5; +16,3], passou | +11,8 [+8,8; +14,3], passou |

Descritivo, contra a novidade:
- na transferência, a curiosa ganha: −1,6 [−2,8; −0,5] e −2,1 [−3,7; −0,5];
- no controle, perde: +2,7 [+0,3; +5,3] e +3,5 [+2,1; +4,8].

**Leitura.**
- **Empata com a novidade na média, nas duas séries.** É a primeira vez que a mosca empata com a melhor estratégia
  simples na média de todos os defeitos. Ela ganha nos defeitos do tipo aprendido e perde no de outro tipo.
- **A curiosidade resolve o custo da especialização,** que caiu de ~26 para ~13 ações no controle.
- **Mas a memória acrescenta pouco sobre a curiosidade.** A diferença para a congelada com a mesma regra, na
  transferência, ficou em −0,5 e −1,2 ações, sem se separar do zero.
- **A divergência do oráculo tem causa identificada.** O oráculo previa 5,8 contra 9,7. A causa provável é o
  esquecimento ao longo do teste, agora com 9 episódios em vez de 3. A própria treinada sem curiosidade transferiu
  pior aqui (10,6 e 9,1) do que nas séries com teste curto (5,8–8,8). Essa limitação do oráculo estava declarada antes
  de rodar.
- **Com H = 2,5, quem decide é a curiosidade.** A memória só desempata.

**Resultado útil para o objetivo prático.** Memória + curiosidade dá um testador que empata com a melhor estratégia
simples e é melhor que ela nos tipos de defeito já vistos. Mas a contribuição própria da memória, nesse arranjo, ficou
pequena.

---

## 7. Discussão

### 7.1 O que já se pode afirmar

- **O aprendizado existe no modelo e é específico.** O circuito KC→MBON do conectoma, com depressão dopaminérgica,
  forma uma memória do estímulo recompensado, visível na atividade das MBONs, com uma única recompensa.
- **A esparsidade da representação importa.** Estímulos que ativam poucas KCs quase não aprendem. Isso é coerente com
  a ideia de que a força de uma associação depende da população de KCs recrutada, mas no nosso modelo o efeito é
  exagerado, porque as KCs são mais esparsas que na mosca real.
- **O esquecimento do modelo é rápido** (τ = 90 s) em relação a tarefas de minutos. As moscas reais formam memórias de
  curto, médio e longo prazo, e o treino espaçado produz memória duradoura (Tully et al., 1994). Nosso modelo tem só
  uma forma de consolidação simplificada. Mesmo assim, a memória formada no treino espaçado guiou a busca depois de
  180 s de outros cheiros, com replicação.
- **A associação transfere por característica e não depende do tipo de defeito.** Defeitos de repetição e defeitos
  em ações normais deram efeitos do mesmo tamanho (−4,8 a −6,9 ações), cada um com replicação.
- **A associação é específica e tem custo.** Num defeito de outro tipo, a mosca treinada não melhora, e tende a
  piorar. Ela se comporta como um aprendiz que só aprende com recompensa: forte no que aprendeu, menos exploradora no
  resto. A decepção pela PPL1 reduziu esse custo na série principal, mas o resultado não replicou.
- **Memória + habituação empata com a novidade.** Na média de todos os defeitos, o empate replicou. A mosca ganha da
  novidade nos defeitos do tipo aprendido e perde no de outro tipo. Com o peso de habituação escolhido, a memória
  contribui pouco além da habituação; ficou em aberto se um peso menor, ou uma memória que esqueça menos ao longo do
  teste, preservaria mais da vantagem da memória.

### 7.2 Lições de método

- **Um negativo pode vir do desenho, não do cérebro.** Nas séries 6.2 e 6.4 o cérebro não era o gargalo: primeiro foi
  a codificação dos estímulos, depois a sensibilidade da tarefa.
- **Um oráculo e uma análise de poder antes da rodada** teriam evitado dois dias de simulação. Recomendamos isso para
  qualquer bancada comportamental com agentes simulados caros.
- **Calibrar só pela neutralidade de nascença pode esvaziar o estímulo.** Toda calibração deve preservar o que o
  mecanismo precisa para funcionar.

### 7.3 Ameaças à validade

- **Vários desenhos testados.** Houve cinco séries negativas e duas bancadas. As mudanças foram motivadas por
  diagnósticos independentes do resultado principal, mas o risco de um "jardim de caminhos que se bifurcam" existe. Por
  isso exigimos replicação com sementes novas e corrigimos os p da família inteira pelo método de Holm (seção 6.7).
- **Regras nossas no caminho:** a codificação das ações em cheiros, a leitura da valência e o softmax. Um resultado
  positivo mostra que o circuito do mapa **suporta** essa transferência sob essas regras, não que uma mosca real
  caçaria bugs.
- **Viés de nascença a favor das repetidas** (+0,04 a +0,42) nos cheiros fortes. Ele se cancela na comparação principal
  (treinada contra congelada), mas não contra a aleatória e a novidade.
- **Sementes independentes**, mas sempre do mesmo conectoma: não há variabilidade entre indivíduos.
- **Dependência da força da pista.** O efeito só aparece com pistas que acendem ~90 KCs ou mais (seções 6.3 e 6.9). Na
  bancada, a escolha dos glomérulos é nossa.
- **Utilidade prática limitada.** Como testador, a mosca não supera um explorador simples por novidade na média dos
  defeitos; com a habituação, empata. O resultado é sobre o circuito, não sobre um método de teste melhor.
- **O oráculo não modela o esquecimento ao longo do teste.** Isso superestimou a vantagem da memória com curiosidade
  (seção 6.11). Ele acertou nas outras séries, que tinham teste curto.

### 7.4 Próximos passos

1. **Equilíbrio entre memória e curiosidade.** Testar pesos de habituação menores, já com um oráculo que inclua o
   esquecimento ao longo do teste, para preservar mais da vantagem da memória sem perder o empate na média.
2. **Defeitos de sequência**, que exigem várias ações, e **várias associações ao mesmo tempo**, para testar se uma
   apaga a outra.
3. **Software real com defeitos gerados automaticamente** (testes de mutação), para que os defeitos não sejam
   escolhidos por nós.
4. **Memória entre sessões:** treinar, guardar e testar numa sessão nova.
5. **Decepção com mais sementes,** para medir de forma estável o custo dela na transferência.

### 7.5 Conclusão

**O circuito aprende e transfere.** Num modelo do sistema nervoso central completo de uma *Drosophila* macho, o
circuito de aprendizado do corpo cogumelar, condicionado com dopamina de recompensa a cada defeito encontrado, forma
uma associação com a característica das ações que revelaram defeitos e a transfere para partes de um sistema que
nunca viu.
- O efeito é específico: some no cérebro de pesos congelados e não ajuda num defeito de outro tipo.
- Sobrevive a 3 minutos de outros cheiros e vale para dois tipos de defeito.
- Foi pré-registrado, replicado com sementes independentes e resiste à correção para 16 comparações.

**Com uma regra de habituação, empata com a novidade.** Sozinha, a associação especializa a mosca. Com a regra de
habituação, ela empata na média de todos os defeitos com a melhor estratégia simples de exploração e ganha dela nos
tipos de defeito já vistos.

**O que não afirmamos.**
- Que uma mosca real procuraria defeitos.
- Que o modelo é uma mosca.
- Que o método é melhor que testes convencionais.

Quem transforma ações em cheiros e lê a memória para escolher são regras nossas. O que o trabalho mostra é que a
fiação medida de um cérebro real, com neurônios simplificados, sustenta aprendizado associativo e transferência numa
tarefa que nada tem de natural para ela.

O caminho até aqui incluiu oito séries negativas ou não replicadas (cinco na primeira bancada, a ponte pelas MBONs
na arena, o controle de cheiros fracos e a replicação da decepção), e cada uma está relatada com a sua causa.

---

## 8. Reprodutibilidade

- **Dados do cérebro:** `web/data/`, gerados de male-cns.janelia.org por `scripts/01_filter_edges.py` e
  `02_build_web.py`.
- **Validação do cérebro (T0):** `node scripts/t0_cerebro.mjs 29,101,202`.
- **Uma série:**

  ```bash
  node scripts/qa_abstrato.mjs --sementes 11,12 --cheiros docs/medicoes/qa-cheiros-fortes.json --saida docs/medicoes/X.json
  ```

  As opções `--bancada 2`, `--caracteristica normal`, `--treinos`, `--orcamento-treino`, `--visiveis`,
  `--retencao-teste`, `--repeticoes-teste`, `--condicoes` (ativa, ativa_decepcao, ativa_curiosa, congelada,
  congelada_curiosa, aleatoria, novidade), `--limiar-decepcao` e `--curiosidade` mudam o protocolo.
- **Rotina automática:** `node scripts/madrugada.mjs --plano b2 | seguintes | validade | curiosidade [--paralelos 2]`.
- **Oráculos e poder:** `node scripts/qa_oraculo.mjs --bancada 2 [--caracteristica normal]`,
  `node scripts/qa_curiosidade_oraculo.mjs` e `node scripts/qa_curiosidade_poder.mjs`.
- **Resumo pareado:** `node scripts/qa_resumo.mjs --prefixo X`. Dá IC95, p do bootstrap, dz, o resultado por versão
  e o de qualquer par de condições.
- **Holm para todas as séries:** `node scripts/qa_comparacoes.mjs`.
- **Linha de base de aprendizado de máquina:** `node scripts/qa_linha_base.mjs [--caracteristica normal]`.
- **Diagnósticos:** `--calibrar`, `--calibrar-cheiros [--com-kcs]`, `--glomerulos`, `--kcs`, `--dose` (em
  `qa_abstrato.mjs`), além de `node scripts/qa_oraculo.mjs --bancada 2`.
- **Sistema de Pedidos, sem alarme falso:** `node scripts/qa_pedidos_teste.mjs`.
- **Rotina automática:** `node scripts/madrugada.mjs --plano b2` e `--plano seguintes`.
- **Registro:** o histórico cronológico completo está em `docs/plano-treino-robusto.md`, e cada medida está em
  `docs/medicoes/`.

---

## 9. Referências

*(conferir dados bibliográficos completos antes de submeter)*

- Aso, Y. et al. (2014). The neuronal architecture of the mushroom body provides a logic for associative learning.
  *eLife* 3, e04577.
- Felsenberg, J., Barnstedt, O., Cognigni, P., Lin, S., Waddell, S. (2017). Re-evaluation of learned information in
  *Drosophila*. *Nature* 544, 240–244.
- Felsenberg, J. et al. (2018). Integration of parallel opposing memories underlies memory extinction. *Cell* 175,
  709–722.
- Holm, S. (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of Statistics* 6,
  65–70.
- Rescorla, R. A., Wagner, A. R. (1972). A theory of Pavlovian conditioning: variations in the effectiveness of
  reinforcement and nonreinforcement. Em *Classical Conditioning II*, Appleton-Century-Crofts, 64–99.
- Hige, T., Aso, Y., Modi, M. N., Rubin, G. M., Turner, G. C. (2015). Heterosynaptic plasticity underlies aversive
  olfactory learning in *Drosophila*. *Neuron* 88, 985–998.
- Honegger, K. S., Campbell, R. A. A., Turner, G. C. (2011). Cellular-resolution population imaging reveals robust
  sparse coding in the *Drosophila* mushroom body. *Journal of Neuroscience* 31, 11772–11785.
- Lin, A. C., Bygrave, A. M., de Calignon, A., Lee, T., Miesenböck, G. (2014). Sparse, decorrelated odor coding in the
  mushroom body enhances learned odor discrimination. *Nature Neuroscience* 17, 559–568.
- Shiu, P. K. et al. (2024). A *Drosophila* computational brain model reveals sensorimotor processing. *Nature*.
- Tully, T., Quinn, W. G. (1985). Classical conditioning and retention in normal and mutant *Drosophila melanogaster*.
  *Journal of Comparative Physiology A* 157, 263–277.
- Tully, T., Preat, T., Boynton, S. C., Del Vecchio, M. (1994). Genetic dissection of consolidated memory in
  *Drosophila*. *Cell* 79, 35–47.
- Male CNS v1.0. HHMI Janelia FlyEM (2026). https://male-cns.janelia.org
- NeuroMechFly / flygym 2.1 (EPFL), para o corpo (fora do escopo deste artigo).
