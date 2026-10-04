# Plano: esquema de treino robusto, com memória

Pedido do usuário (29/09/2026): um esquema robusto para rodar as simulações e treinar a mosca, com memória. Leia
antes o `AGENTS.md`, a seção "Treinamento da memória em 3D" do README e `docs/plano-treinamento-bugs-3d.md` (etapas
A a E do Codex). **Atualize "Onde parei" a cada passo.**

## O que já existe (Codex, 28–29/09)

- Aba **Treinamento** (`web/treino-protocolo.js`, `web/treino-memoria.js`): pistas A (VA2+DM4) e B (DP1l+DM2),
  teste antes, pareamento com PAM, teste depois, lados trocados, reversão, teste final (96 s cerebrais). Controle
  com pesos congelados (`plasticidade` no worker). Memória do treino guardada à parte.
- **Gerenciador de campanhas** (`scripts/experimentos.mjs`, porta 8770, `iniciar-experimentos.cmd`,
  `web/experimentos.html`): cada semente roda A e B, ativa e congelada; sementes separadas de cérebro, corpo e
  mundo; retoma após queda; cópia congelada da pasta `web/` por lote; diferença pareada ativa − congelada por
  semente e bootstrap de 2000 reamostragens (`scripts/experimentos/core.mjs`). Testado (`experimentos_teste.mjs`):
  a mesma semente dá a mesma sessão.
- **Falta:** nenhuma campanha real rodou (só testes de infraestrutura com 1 semente). O critério da etapa A segue
  sem resposta.

## Etapas

### T0 Antes de treinar (pedido do usuário, 29/09)

Garantir que um resultado de treino, positivo ou negativo, signifique alguma coisa:
1. **A memória muda o cérebro?** No worker, sem corpo: atividade das saídas do corpo cogumelar (MBONs) para A e B
   antes e depois do pareamento, com plasticidade ligada e congelada. Se não mudar, nenhum treino comportamental
   mostra efeito e o gargalo não é o protocolo.
2. **A e B são equivalentes?** Quantas células de Kenyon cada pista ativa, a sobreposição entre os padrões (nas
   moscas, cada cheiro liga ~5–10% das KCs e os padrões pouco se sobrepõem) e a preferência de nascença (teste
   "antes do treino" do piloto).
3. Mesmo modelo no Python e no navegador (limite de 255 sinapses, transmissão rápida da dopamina).
4. Regra de aprendizado mais próxima da biologia: compartimentos, ordem cheiro → recompensa, tempos de esquecimento.
5. Sessão mais barata: tarefa de cheiro sem desenhar os olhos (validar a visão só no fim).
6. Ruído sem treino: quantas sementes são necessárias para ver um efeito.

### T1 Piloto da etapa A (a primeira medida causal)

Lote: sementes 101, 202, 303, 404, 505; variante `padrao` (3 repetições, testes de 15 s); 2 simultâneas.
= 20 sessões (5 sementes × A/B × ativa/congelada).

**Critério escrito antes de medir:** a diferença pareada média do ganho (ativa − congelada) é positiva e o
intervalo de 95% não inclui 0; e menos de 30% dos testes "depois do treino" ficam sem escolha. Se passar: ampliar
para 20 sementes (T4). Se não passar: registrar como negativo e investigar a ponte memória → movimento antes de
seguir (o plano do Codex, etapa A).

### T2 Memória que dura: retenção e consolidação

Hoje o teste vem logo depois do treino. O worker tem esquecimento (`TAU_F` 90 s: a sinapse volta ao valor
original) e consolidação (cada episódio de dopamina deixa a mudança mais estável, até 10× mais lenta). Medir:
- **Retenção:** novo parâmetro `retencao` (s cerebrais sem odor entre o fim do treino e o teste "depois"): 0, 60,
  180 s. Esperado pelo modelo: o ganho cai com o intervalo.
- **Consolidação:** `repeticoes` 1, 3 e 6 com `retencao` 180 s. Esperado pelo modelo: mais repetições, mais retenção.
Precisa de: fase `intervalo` longa em `ProtocoloMemoria.fases` (sem odor, sem recompensa, corpo parado ou livre, a
decidir e declarar), o campo no `validar` de `core.mjs` e a variante no gerenciador. Critério por variante, escrito
antes: o mesmo de T1.

### T3 Memória entre sessões

Treinar numa sessão, guardar a memória, e testar numa sessão nova que carrega essa memória (o "dia seguinte"),
contra uma sessão nova sem ela. Usa o formato de salvamento que já existe (`guardarMemoria`). Mede se o que foi
aprendido sobrevive ao recomeço do corpo e do mundo.

### T4 Ampliar

Com efeito em T1: 20 sementes na variante que funcionou; relatar diferença pareada, intervalo e sessões sem escolha.

### B-abstrata: achar bugs só com o cérebro (sem corpo), antes da arena 3D

Objetivo final do usuário: a mosca achar bugs. Primeiro no nível abstrato (sem custo de andar; o plano do Codex
prevê os dois níveis), no Node, com o worker real e sem Chrome (rápido):
- `web/qa/pedidos.js`: sistema de Pedidos em memória (estoque, carrinho, finalizar, pagar, cancelar, cupom), versões
  com defeitos injetados e contratos verificáveis (estoque ≥ 0 e ≤ inicial, uma cobrança por pedido, total finito e
  ≥ 0, desconto ≤ limite). O verificador só olha o estado; não sabe onde está o defeito.
- Cada ação tem características (família: carrinho, estoque, pagamento, cancelamento, cupom; entrada: normal, zero,
  limite, negativa, repetida). Cada característica é um par de glomérulos neutros; o cheiro da ação é a união.
- A cada passo, 4 ações visíveis (sorteadas): a mosca sente o cheiro de cada uma por 0,3 s e escolhe pela valência das
  saídas do corpo cogumelar (softmax; **regra nossa**). Bug novo confirmado: o cheiro daquela ação por 2 s com PAM nos
  últimos 0,5 s (o mesmo pareamento do protocolo de treino). Sem punição por ação sem bug.
- Treino em versões com defeitos de "repetição" em pagamento e cancelamento; teste em versões reservadas com defeitos
  de repetição em outras famílias (cupom, estoque). Hipótese: a característica "repetida" ganha valência e a mosca a
  prioriza no sistema novo.
- Comparação no teste, mesmas versões e orçamento de ações: memória treinada, pesos congelados (mesma exposição),
  cérebro ingênuo, escolha aleatória, explorador por novidade (ação menos tentada). Métricas: bugs distintos por
  orçamento e ações até o primeiro bug. Critério escrito antes de medir: a treinada acha o primeiro bug de teste em
  menos ações que a congelada, com intervalo de 95% da diferença pareada abaixo de 0 (5 sementes).

### Depois

Etapa B do plano do Codex (descobrir defeitos por uma ação, na bancada de Pedidos), com o mesmo gerenciador.

## Como rodar

- Servidores: `python scripts/servir.py` (8765) não é usado pelo gerenciador, que serve a própria cópia em 8770.
- Pela interface: `iniciar-experimentos.cmd` e abrir http://127.0.0.1:8770.
- Pela linha de comando: `node scripts/campanha.mjs --nome X --sementes 101,202,303,404,505 --variante padrao
  [--repeticoes 3] [--segundos 15] [--paralelas 2]`: sobe o gerenciador (se não estiver no ar), cria o lote, inicia,
  mostra o progresso e, no fim, o resumo pareado. Resultados em `docs/medicoes/lotes/<id>/` (resumo.json,
  resultados.csv, eventos.ndjson). Cópias do código ficam em `data/experimentos/` (fora do git).
- Um Chrome por sessão (1,5–2 GB cada): no máximo 2 simultâneas.

## Onde parei

- [~] T0 antes de treinar (1 e 2 feitos; 3 a 6 abertos)
- [x] T1 piloto: passou com a ponte por sinapses; negativo com a ponte pelas MBONs
- [ ] T2 retenção e consolidação
- [ ] T3 memória entre sessões
- [ ] T4 ampliar

Notas (a mais recente por último):

**29/09, T1 lançado e T2 preparado.** `scripts/campanha.mjs` criado (cria o lote pela API do gerenciador, inicia,
acompanha e imprime o resumo pareado). Piloto T1 rodando: lote `2026-09-29T22-25-18-608Z-a560c5` (o primeiro, `...17de4c`, ficou parado esperando
RAM e foi cancelado sem sessões), uma sessão por vez e `--memoria 2` (o computador tem ~2,5 GB livres com os
aplicativos do usuário abertos), log em `_tmp/_piloto_A.log`. Para T2: `retencao` em `ProtocoloMemoria.fases` (fase `intervalo`
sem odor nem recompensa, corpo parado como nos outros intervalos, entre o treino e o teste "depois"), em
`validar` do `core.mjs` (0–600 s) e em `campanha.mjs --retencao`; teste em `treino_protocolo_teste.mjs`. O gerenciador foi reiniciado depois da mudança, então já aceita `retencao`. **Sempre que `core.mjs` mudar, parar o
processo `node scripts/experimentos.mjs` antes de lançar outro lote** (ele recusa uma segunda instância na mesma pasta; a trava é `docs/medicoes/lotes/_gerenciador.lock`).
Se o piloto ainda estiver pela metade quando alguém retomar: abrir http://127.0.0.1:8770 (ou `iniciar-experimentos.cmd`)
e clicar em Retomar no lote; o resumo sai em `docs/medicoes/lotes/<id>/resumo.json`.

**29/09, T0 itens 1 e 2 (`node scripts/t0_cerebro.mjs 29,101,202`, `docs/medicoes/t0-cerebro.json`).** Worker real,
sem corpo; sondas de 2 s de cada pista, 2 vezes, antes e depois das fases de "Treino" do protocolo (A recompensado).
1. **O treino muda o cérebro, de forma específica.** Resposta de `mbon_evitar_rec` a A com plasticidade: −0,91 /
   −1,11 / −1,00 Hz (de ~1,4 para ~0,5 Hz, −65%); a B: −0,04 / +0,03 / −0,02. Congelado: A +0,03 / −0,18 / +0,03,
   B −0,14 / −0,05 / −0,02 (ruído). Se o comportamento não mostrar efeito, o gargalo é a ponte memória → movimento
   (regra do corpo que lê as sinapses), não o aprendizado.
2. **A e B não são equivalentes.** KCs ativadas: A 126–132 (3,1–3,2%), B 97–101 (2,4–2,5%); sobreposição (Jaccard)
   0,009, quase nula (bom para distinguir). Mais esparso que nas moscas (~5–10% por cheiro). A liga ~30% mais KCs, e
   B dispara mais as saídas de evitar antes do treino (`mbon_evitar_rec` 1,85 contra 1,39 Hz): viés inato no modelo.
   O desenho recíproco cancela na média; próximo passo: intensidade por pista (`odorHzA`/`odorHzB` na variante) até
   igualar KCs e respostas das MBONs, antes do T4.

**29/09, ponte memória → movimento pelas MBONs (pedido do usuário: foco em achar bugs).** Sem cheiro, as saídas do
corpo cogumelar ficam em silêncio (valência 0). Valência = `mbon_aprox` − média(`mbon_evitar`, `mbon_evitar_rec`), Hz
por neurônio (`t0-cerebro.json`, agora com sonda sem odor): antes do treino A 0,62–0,75 e B 0,21–0,28; depois de
treinar A com plasticidade, A 1,41–1,46 e B 0,15–0,29; congelado, A 0,67–0,71. Ponte nova em `stepBody`
(`PONTE === 'mbon'`): atração = clamp(valência / 1,5) × fome, aversão = clamp(−valência / 1,5), a busca local segue a
valência. Padrão continua `sinapses` até medir. Chave: `?ponte=mbon`; nas campanhas, `ponte` na variante
(`core.mjs`) e `node scripts/campanha.mjs --ponte mbon`. Próximo: quando o piloto (ponte por sinapses) terminar,
reiniciar o gerenciador e rodar a mesma campanha com `--ponte mbon`; comparar as diferenças pareadas das duas.

**29/09, T1 concluído: passou (ponte por sinapses).** Lote `2026-09-29T22-25-18-608Z-a560c5`, 20 sessões. Preferência
pela pista recompensada, ativa / congelada: depois do treino +0,56 / −0,06; lados trocados +0,62 / −0,20; depois da
reversão (sinal invertido, seguiu a nova pista) +0,74 / −0,15. **A medida do critério (ganho = depois − antes) ficou
indefinida em 2 das 5 sementes** (nenhuma visita a pistas no teste de antes; `semEscolha` do antes 2 em cada
condição): 3 sementes, diferença 0,84, sem intervalo. Mudança de medida, decidida por essa indefinição e não pelo
resultado: principal passa a ser `depois` = média das preferências nos dois testes após o treino, ativa − congelada,
média de A/B por semente (`core.mjs`); **0,74, IC95 [0,65; 0,82], 5/5 sementes**; sem escolha depois do treino: 0/10
ativa, 1/10 congelada (< 30%). `node scripts/resumir_lote.mjs <id>` recalcula qualquer lote com a análise atual.
Paralelo: caça a bugs só com o cérebro em 3 processos (sementes 1–5, 6–7, 8–9; arquivos `qa-abstrato*.json`, juntados
por `qa_resumo.mjs`).

**29/09, ponte pelas MBONs no treino: negativo.** Lote `2026-09-29T23-56-22-643Z-9024e8` (mesmas sementes e protocolo,
`ponte: mbon`): `depois` ativa − congelada **0,06, IC95 [−0,43; 0,65]**, 5/5 sementes (ganho −0,15). Preferências ativa
/ congelada: depois do treino +0,04 / +0,19; lados trocados +0,46 / +0,19. Com a ponte por sinapses, 0,74 [0,65; 0,82].
No cérebro isolado o aprendizado aparece nas MBONs (T0), mas no corpo andando não vira preferência. Causas prováveis,
não testadas: cheiro mais fraco nas antenas do que nas sondas de 100 Hz; leitura curta (média de ~0,5 s; na calibração
da caça a bugs só com 1 s o ruído ficou abaixo do efeito); valência de nascença positiva nas duas pistas (A > B)
encobrindo a mudança. **O padrão continua a ponte por sinapses.** A ponte pelas MBONs fica como opção.

**Ressalva sobre a caça a bugs só com o cérebro (`qa_abstrato.mjs`):** a decisão desconta a valência de nascença de cada
ação, medida no início e guardada numa tabela fora do cérebro. Isso é memória externa (o tipo de atalho que foi tirado
da Cozinha). Os resultados em andamento valem como "o aprendizado do corpo cogumelar, lido com esse desconto"; o passo
honesto seguinte é escolher os glomérulos de cada característica para que as 15 ações nasçam com valência parecida
(calibração de cheiros, T0 item 2) e rodar sem desconto.

**29/09, cheiros das ações calibrados e caça a bugs honesta lançada.** `--calibrar-cheiros` (40 iterações de busca local,
pesos congelados): valência de nascença das 15 ações de [−0,65; +0,73] (média dos quadrados 0,102) para [−0,22; +0,36]
(0,026), perto do ruído da medida (~0,15). Mapa em `docs/medicoes/qa-cheiros.json` (`melhor`). Série honesta: sem
desconto, cheiros calibrados, sementes 11–18 em 4 processos (`qa-honesto-p1..p4.json`; logs `_tmp/_qh*.log`);
resumo: `node scripts/qa_resumo.mjs --prefixo qa-honesto`. Mesmo critério escrito antes (a treinada acha o primeiro bug
de teste em menos ações que a congelada, IC95 da diferença pareada abaixo de 0). A série antiga (com desconto) segue
só com as sementes 1–5 no processo principal, como referência.


**30/09, caça a bugs honesta: NEGATIVO no critério.** 8 sementes (11–18), `docs/medicoes/qa-honesto-resumo.json`.
Primeiro bug de teste (ações, menor é melhor): treinada 25,2, congelada 27,7, aleatória 19,7, novidade 22,9. Treinada
menos congelada −2,5, IC95 [−5,25; +0,17]: cruza o zero, o critério escrito antes não passou. Pior: a escolha aleatória
acha antes que a treinada (+5,5 [0,41; 10,6]) e acha mais bugs distintos (3,5 contra 1,75). O motivo aparece na valência:
depois do treino as ações "repetida" (as premiadas) mudaram −0,01, as outras +0,03 (congelada: +0,006 / +0,016). A
recompensa não está gravando nos cheiros das ações, embora o mesmo cérebro aprenda na arena A/B (0,74). Suspeitas, para
testar isoladas: poucas recompensas no treino (60 ações, poucos bugs), reforço diluído na mistura de 4 glomérulos, janela
da dopamina (últimos 50 ms) fora da atividade dos KCs.

**30/09, suspeita 1 (poucas recompensas): descartada; a causa é o cheiro das ações.** `--dose` (sementes 11 e 12,
`docs/medicoes/qa-dose.json`): até 8 pareamentos seguidos da mesma ação (`cancelamento:repetida`) sobem a valência só
+0,1 a +0,2, do tamanho do ruído (~0,15) e parecido com a congelada; o cheiro A da bancada sobe ~+0,75 com 3.
`--kcs` (`docs/medicoes/qa-kcs.json`): as ações acendem 19–86 KCs (a premiada, 38) contra 117 do A, e a premiada dá
só 0,83 Hz em mbon_evitar_rec (A: 1,57). A dopamina enfraquece KC→evitar_rec: com poucos KCs e pouco evitar_rec, não
sobra o que enfraquecer. A calibração deixou as ações neutras escolhendo glomérulos fracos. Próximo: recalibrar pedindo
também muitos KCs e evitar_rec alto (sem mexer no cérebro), refazer a dose e só então a série.

**30/09, dose com cheiro forte: aprende.** Recalibração com `--com-kcs` (`qa-cheiros-kcs.json`): as ações de estoque
chegam a 91–101 KCs, mas as três "repetida" continuam em 34–40 (os glomérulos de "repetida" são fracos). Dose no
`estoque:repetida` (91 KCs, evitar_rec 1,63 Hz; `qa-dose-kcs.json`, sementes 11 e 12): a valência sobe de ~0 para
+0,74/+0,92 com UM pareamento e +1,06/+1,23 com 8; o controle não sobe; a congelada fica em ~0. Confirma a causa: cheiro
com poucos KCs não aprende. Esquecimento: depois de 60 s cheirando outras ações sobra +0,85/+0,88; depois de 180 s,
+0,28/+0,57. O treino dura ~10 min, então o esquecimento (τ 90 s) também pesa. Próximo: glomérulos fortes para
"repetida" (e para todas as características), e treino mais curto ou teste logo depois.
Referência com desconto (sementes 1–5, `qa-abstrato-resumo.json`): também negativa, treinada − congelada +2,8 [−1,2; 6,8].

**30/09, cheiros fortes e nova série.** `--glomerulos` (`qa-glomerulos.json`): dos 34 glomérulos permitidos, poucos
acendem KCs sozinhos (DC1 73, VA6 58, VL2a 48, VC1 36; metade ≤5). "repetida" recebe DC1+VA6; ajuste fino `--com-kcs`
(40 iterações, `qa-cheiros-fortes.json`): as três "repetida" acendem 87–107 KCs (antes 34–40), evitar_rec 2,0–2,5 Hz;
valência de nascença de todas em [−0,35; +0,50], as "repetida" em +0,04 a +0,42. Ressalva: esse leve viés de nascença
a favor de "repetida" vale igual para treinada e congelada (a comparação do critério), mas não para aleatória e
novidade. Série `qa-fortes-p1..p4` (sementes 11–18), mesmo critério escrito antes (treinada − congelada no primeiro bug
de teste, IC95 < 0). Resumo: `node scripts/qa_resumo.mjs --prefixo qa-fortes`.

**30/09, rotina da madrugada (`scripts/madrugada.mjs`), escada escrita antes de ver resultados.** 1) `qa-fortes`
(em andamento); 2) `qa-fortes-curto`: 2 treinos de 30 ações, sementes 21–28 (menos tempo para esquecer); 3)
`qa-fortes-espacado`: 6 treinos de 20 ações, sementes 31–38. Critério igual em todas. Se uma passar, replica com
sementes 41–48 antes de contar como achado; replicou, para. Cada degrau anota aqui e commita as medições. São até 3
comparações: um "passou" sem replicação não vale como resultado. Log: `_tmp/_madrugada.log`.

**2026-09-30, madrugada: qa-fortes (cheiros fortes, treino padrão (3 × 60 ações)): negativo.** Sementes 11, 12, 13, 14, 15, 16, 17, 18. Primeiro bug de teste: treinada 23,5, congelada 23,67, aleatória 19,67, novidade 22,92. Treinada − congelada -0,17, IC95 [-2.46,2.08]. Valência depois do treino (treinada): repetidas 0,265, outras -0,002. `docs/medicoes/qa-fortes-resumo.json`.

**2026-09-30, madrugada: qa-fortes-curto (treino curto (2 × 30 ações): menos tempo para esquecer): negativo.** Sementes 21, 22, 23, 24, 25, 26, 27, 28. Primeiro bug de teste: treinada 21,29, congelada 21,29, aleatória 19,04, novidade 24,17. Treinada − congelada 0, IC95 [-1.96,1.92]. Valência depois do treino (treinada): repetidas 0,169, outras -0,016. `docs/medicoes/qa-fortes-curto-resumo.json`.

**2026-09-30, madrugada: qa-fortes-espacado (treino em 6 episódios de 20 ações: mais episódios, cada um curto): negativo.** Sementes 31, 32, 33, 34, 35, 36, 37, 38. Primeiro bug de teste: treinada 20,67, congelada 22,5, aleatória 20,33, novidade 20,17. Treinada − congelada -1,83, IC95 [-3.75,0.08]. Valência depois do treino (treinada): repetidas 0,549, outras -0,039. `docs/medicoes/qa-fortes-espacado-resumo.json`.

**01/10, diagnóstico da madrugada (`scripts/qa_oraculo.mjs`, `docs/medicoes/qa-oraculo.json`, sem cérebro).** A memória
se forma (repetidas +0,27/+0,17/+0,55 nas três séries, congelada ~0), mas não vira vantagem. Com memória PERFEITA
("prefere repetida"), o primeiro bug de teste cai de 21,8 (aleatória) para 18,0: só −3,8 ações de teto. Por versão:
cupom-duplo 23,9 → 13,6 (a memória ajuda muito); reserva-dupla ~30 com qualquer política (achada em 6–7% dos
episódios: precisa de pedido aberto antes, quase inalcançável em 30 passos); cupom-duplo+quantidade-negativa ~10 com
qualquer política (quem revela é carrinho:negativa, que a memória não favorece). Duas das três versões de teste não
medem transferência. O espaçado (−1,8) ficou em ~metade do teto, com 8 sementes, e o erro padrão (~1) não separa isso.
Conclusão: a bancada de teste tem pouca sensibilidade; o próximo passo é consertar a bancada (versões de teste em que
a repetida seja o caminho e seja alcançável) e usar mais sementes, com critério e sementes novos escritos antes.

## Bancada 2 (01/10): metodologia escrita antes de rodar

**Por que mudou:** o oráculo mostrou que a bancada 1 media pouca transferência (teto −3,8 ações; reserva-dupla quase
inalcançável; uma versão revelada por um bug que não é de repetição). A mudança vem de olhar resultados, então vale
só com sementes novas, critério novo escrito aqui e replicação.

**O cenário (`web/qa/pedidos.js`, `criar(defeitos, {bancada: 2})`):** as 4 ações "repetida" viram cliques duplos
completos, sem pré-condição (pagar duas vezes, cancelar duas vezes, reservar duas vezes, aplicar o mesmo cupom duas
vezes); o certo é idempotente, o defeito revela num passo. Estoque 50/20 para não esgotar. Sem falso positivo em
90.000 ações aleatórias na versão correta; cada defeito revelado pela repetida em 300/300. Treino: cobrança dupla e
cancelamento duplo (famílias pagamento e cancelamento). Teste: cupom duplo e reserva dupla (famílias NOVAS; só a
característica "repetida" liga treino e teste) mais um CONTROLE, quantidade negativa, que a memória não deve ajudar
(deve até atrapalhar: ela prefere repetidas).

**Protocolo:** cheiros fortes (`qa-cheiros-fortes.json`); treino espaçado 6 × 20 ações (a melhor memória da
madrugada, +0,55); teste sem recompensa (como o teste sem açúcar das moscas reais) e cada episódio acaba no primeiro
bug (menos tempo para esquecer). Condições pareadas: treinada, congelada, aleatória, novidade; 3 de 15 ações visíveis.

**Validação sem cérebro (`qa-oraculo-b2.json`):** nas versões de transferência, aleatória 13,2; memória perfeita 6,2;
memória com o ganho medido no cérebro (+0,25, ruído 0,15, softmax) 8,4 a 8,8; novidade 9,1. No controle, a memória
piora (14,4 → 17–20). Poder (simulação, bootstrap): 16 sementes detectam até o ganho mais fraco medido (+0,17) em 92%
das vezes. Limite: o oráculo não inclui o esquecimento durante o teste.

**Critério principal (escrito antes):** média das 2 versões de transferência, ações até o primeiro bug; treinada −
congelada com IC95 da diferença pareada abaixo de 0, sementes 51–66. **Secundários:** no controle, treinada −
congelada não deve ser negativa (dissociação: a memória é de "repetida", não um "achar tudo mais rápido");
treinada contra novidade e aleatória relatados sem critério. **Replicação:** se passar, sementes 71–86 com o mesmo
critério; só conta como achado se replicar. Rotina: `node scripts/madrugada.mjs --plano b2`.

**Fila seguinte (escrita em 01/10, antes do resultado da bancada 2): `node scripts/madrugada.mjs --plano seguintes`.**
Espera a rotina b2 terminar e segue um de dois ramos, cada degrau com 16 sementes novas, o mesmo critério
(transferência, treinada − congelada, IC95 < 0) e replicação própria com outras 16:
- **Se a bancada 2 passou E replicou:** (1) `qa-b2-cheiro-trocado`, controle sensorial: "repetida" com os glomérulos
  de "normal" e vice-versa (`qa-cheiros-trocados.json`); o aprendizado deve seguir a característica premiada, não um
  cheiro especial (ressalva: menos KCs, efeito talvez menor); sementes 91–106, réplica 131–146. (2) `qa-b2-retencao`:
  180 s cheirando outras ações entre treino e teste; sementes 111–126, réplica 151–166.
- **Se não:** (1) `qa-b2-treino-longo`, 12 × 20 ações; (2) `qa-b2-vis5`, 5 ações visíveis por passo. Mesmas sementes.
Novo registro em toda série: a fração das vezes em que a mosca escolheu uma repetida visível no teste
(`escolhas_teste`), para ver se a memória vira escolha mesmo quando não vira bug achado. Até 4 comparações novas: um
degrau que passe sem replicar não conta.

**2026-09-30, madrugada: qa-b2 (bancada 2, treino espaçado 6 × 20, teste sem recompensa): PASSOU.** Sementes 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66. Primeiro bug de teste: treinada 14,98, congelada 17,13, aleatória 13,06, novidade 9,9. Treinada − congelada -5,06, IC95 [-8,-2.31]. Transferência: treinada 8,78, congelada 13,84, aleatória 15,41, novidade 10,22; controle (não deve melhorar): treinada − congelada 3,69 [-2.13,9.75]. Valência depois do treino (treinada): repetidas 1,026, outras -0,07. `docs/medicoes/qa-b2-resumo.json`.

**2026-09-30, madrugada: qa-b2-replica (bancada 2, treino espaçado 6 × 20, teste sem recompensa, replicação com sementes novas): PASSOU.** Sementes 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86. Primeiro bug de teste: treinada 13,21, congelada 15,06, aleatória 11,85, novidade 10,31. Treinada − congelada -6,94, IC95 [-9.13,-4.88]. Transferência: treinada 5,81, congelada 12,75, aleatória 11,78, novidade 10,75; controle (não deve melhorar): treinada − congelada 8,31 [3.13,14.06]. Valência depois do treino (treinada): repetidas 0,946, outras -0,068. `docs/medicoes/qa-b2-replica-resumo.json`.

## Fila de validade (30/09, escrita antes de rodar): itens 1, 2, 3 e 6

Pedido do usuário depois de a bancada 2 passar e replicar: fechar as brechas do resultado (1, 2, 3) e reduzir o custo
da especialização (6). Os itens 2 e 3 não precisam do cérebro e já rodaram; 1 e 6 entram numa fila automática
(`node scripts/madrugada.mjs --plano validade`), que espera a fila "seguintes" terminar.

**Item 3, análise (já feito).** `qa_resumo.mjs` passou a dar, em cada diferença pareada, o p bilateral do mesmo
bootstrap (inversão do IC), o tamanho do efeito dz (média / desvio das diferenças) e o resultado de cada versão de
teste. Os IC95 de todas as séries recalculadas são iguais aos já publicados. `scripts/qa_comparacoes.mjs` junta o
critério principal de todas as séries confirmatórias e ajusta pelo método de Holm (`qa-comparacoes.json`): com as 7
séries rodadas, as duas da bancada 2 continuam passando (p de Holm 0,0035 cada; dz −0,85 e −1,58); as 5 negativas
continuam negativas. Por versão (treinada − congelada): cupom duplo −8,3 [−13,3; −3,9] e −7,4 [−11,4; −3,9]; reserva
dupla −1,8 [−5,3; +1,3] e −6,4 [−11,7; −2,1] (na série principal, a reserva sozinha não se separa do zero).
Arrumação: um diagnóstico de 30/09 (`--kcs` com o mapa forte inicial) tinha sobrescrito `qa-kcs.json` (a medida dos
cheiros fracos citada no artigo); restaurado do git, e a outra medida ficou em `qa-kcs-fortes-inicial.json`.

**Item 2, linha de base de aprendizado de máquina (já feito, descritivo).** `scripts/qa_linha_base.mjs`
(`qa-linha-base.json`): sem cérebro, as mesmas 32 sementes e as mesmas ações visíveis da mosca, o mesmo treino e
teste. Agentes: Rescorla–Wagner linear por característica (α 0,3 e T 0,15 escolhidos antes de rodar), o mesmo só
atualizando com recompensa (como a mosca), valor por ação sem características, e o teto (prefere a característica
premiada). Transferência / controle (ações até o primeiro bug): mosca treinada 7,3 / 27,7; RW 12,6 / 14,6; RW só com
recompensa 8,5 / 22,0; por ação 15,4 / 13,7; teto 6,5 / 20,0. Mosca − RW na transferência −5,3 [−7,5; −3,2]; mosca −
RW só com recompensa −1,2 [−2,6; −0,1]. Sensibilidade (α 0,1–0,6, T 0,05–0,5): quem só aprende com recompensa
transfere bem (7,4–11,5) e paga no controle (16–26); o RW que também aprende com a ausência de bug transfere pior
(10,7–20,9) e paga menos (9,7–15,6). A mosca fica no canto dos que só aprendem com recompensa, com o maior custo no
controle (parte dele é o viés de nascença das repetidas, que a congelada também tem: 21,7 no controle).

**Item 1, contrabalanço (`qa-b2-normal`).** A característica premiada passa a ser "normal" (nasce com valência
negativa, −0,07 a −0,23, ao contrário de "repetida", +0,04 a +0,42). Defeitos novos, só nas versões que os contêm (a
versão correta é a mesma): pagamento normal cobra valor zero, cancelamento normal devolve um item a mais, cupom normal
de 10% aplicado como 40%, abrir pedido baixa um item sem reservar. Sem falso positivo em 90.000 ações; cada um
revelado pela ação normal num passo em 300/300. Treino em pagamento e cancelamento, teste em cupom e estoque, o mesmo
controle (quantidade negativa). Oráculo (`qa-oraculo-b2-normal.json`): aleatória 13,3, memória perfeita 6,7, memória
com o ganho medido 9,1 (bancada 2 original: 13,2 / 6,2 / 8,4–8,8). Sementes 211–226, réplica 231–246. **Critério:** o
mesmo da bancada 2 (transferência, treinada − congelada, IC95 < 0). **Leitura escrita antes:** se passar, o viés de
nascença não explica a transferência. Se não passar, o resultado é ambíguo: as ações "normal" acendem menos KCs (46–83)
e menos evitar_rec (0,8–1,8 Hz) que as repetidas, e são 5 ações (carrinho normal a mais) contra 4.

**Item 6, decepção no teste (`qa-b2-decepcao`).** Condição nova `ativa_decepcao`: treino idêntico ao da treinada
(mesma semente, mesmo cérebro até o teste); no teste, escolher uma ação com valência > 0,6 e não achar bug novo
dispara a PPL1 (grupo `dor`, 100 Hz nos últimos 0,5 s de 2 s do cheiro da ação, o mesmo formato da recompensa). O
limiar 0,6 fica acima da maior valência de nascença (+0,50) e do ruído (0,15). Base biológica: o cheiro que prometia
açúcar e vem sem ele ativa a PPL1 e forma uma memória oposta (Felsenberg et al., 2017, 2018); a página já faz isso.
Regra nossa: quando disparar. Condições: treinada, treinada com decepção, congelada, aleatória, novidade; sementes
251–266, réplica 271–286. **Critério principal:** no controle, treinada sem − com decepção com IC95 > 0 (a decepção
reduz o custo da especialização). **Secundário:** na transferência, com decepção − congelada com IC95 < 0 (continua
transferindo). **Descritivo:** o custo da decepção na transferência (com − sem), o número de decepções. Previsão pela
linha de base: a decepção deve levar a mosca na direção do RW que aprende com a ausência de bug (menos custo no
controle, alguma perda na transferência).

Cada série entra na família de Holm (`qa_comparacoes.mjs`, rodado pela rotina a cada série).

**2026-09-30, madrugada: qa-b2-cheiro-trocado (controle sensorial: "repetida" com os glomérulos de "normal" e vice-versa (o aprendizado não depende de um cheiro específico)): negativo.** Sementes 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106. Primeiro bug de teste: treinada 20,96, congelada 22,9, aleatória 14,42, novidade 10,75. Treinada − congelada -2,09, IC95 [-5.38,1.34]. Transferência: treinada 17,66, congelada 19,75, aleatória 14,09, novidade 11; controle (não deve melhorar): treinada − congelada -1,63 [-4.88,0]. Fração das vezes em que escolheu uma repetida visível no teste: {"ativa":0.304,"congelada":0.294,"aleatoria":0.423,"novidade":0.437}. Valência depois do treino (treinada): repetidas 0,27, outras 0,02. `docs/medicoes/qa-b2-cheiro-trocado-resumo.json`.

**30/09, mudança no item 1 antes de rodar (declarada).** O controle de cheiro (`qa-b2-cheiro-trocado`, "repetida" com
os glomérulos fracos VL2a+VM6v e "normal" com os fortes DC1+VA6) deu negativo: treinada − congelada −2,1 [−5,4; +1,3];
a valência das repetidas subiu só +0,27 (com os fortes, +1,0) e ela escolheu uma repetida em 30% das vezes, igual à
congelada (29%): com poucos KCs a memória é fraca, e os cheiros fortes de "normal", que nascem atraentes, puxam as
escolhas. O item 1 como estava escrito (premiar "normal" com o mapa forte, em que "normal" fica com VL2a+VM6v) repetia
exatamente essa configuração e falharia pelo mesmo motivo. Mudança, antes de qualquer rodada do item 1: o braço
"normal" usa o mapa trocado (`qa-cheiros-trocados.json`), então a característica premiada fica com os glomérulos
fortes nos dois braços; o que muda é só o tipo de bug. O que ele testa agora: se a transferência depende do tipo de
defeito, com a força do cheiro igual. O viés de nascença (os glomérulos fortes nascem atraentes) segue controlado pela
congelada, que tem o mesmo viés, e não é mais o alvo deste item. Critério, sementes e réplica sem mudança.

**2026-10-01, madrugada: qa-b2-retencao (retenção: 180 s cheirando outras ações entre o treino e o teste): PASSOU.** Sementes 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126. Primeiro bug de teste: treinada 17,17, congelada 19,89, aleatória 16,56, novidade 12,69. Treinada − congelada -4,81, IC95 [-8.25,-1.72]. Transferência: treinada 10,81, congelada 15,63, aleatória 16,59, novidade 12,91; controle (não deve melhorar): treinada − congelada 1,44 [0,3.81]. Fração das vezes em que escolheu uma repetida visível no teste: {"ativa":0.702,"congelada":0.495,"aleatoria":0.363,"novidade":0.415}. Valência depois do treino (treinada): repetidas 1,02, outras -0,06. `docs/medicoes/qa-b2-retencao-resumo.json`.

**2026-10-01, madrugada: qa-b2-retencao-replica (retenção: 180 s cheirando outras ações entre o treino e o teste, replicação com sementes novas): PASSOU.** Sementes 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166. Primeiro bug de teste: treinada 13,37, congelada 17,94, aleatória 12,06, novidade 7,73. Treinada − congelada -5,59, IC95 [-8.88,-2.5]. Transferência: treinada 6,78, congelada 12,38, aleatória 12,41, novidade 7,66; controle (não deve melhorar): treinada − congelada -2,5 [-7.75,1.63]. Fração das vezes em que escolheu uma repetida visível no teste: {"ativa":0.784,"congelada":0.539,"aleatoria":0.361,"novidade":0.433}. Valência depois do treino (treinada): repetidas 1,05, outras -0,07. `docs/medicoes/qa-b2-retencao-replica-resumo.json`.

**2026-10-01, madrugada: qa-b2-normal (contrabalanço do tipo de bug: defeitos nas ações "normal", com os glomérulos fortes (mapa trocado), mesma estrutura de treino e teste): PASSOU.** Sementes 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226. Primeiro bug de teste: treinada 14,77, congelada 17,04, aleatória 15,83, novidade 9,85. Treinada − congelada -4,84, IC95 [-7.34,-2.44]. Transferência: treinada 8,28, congelada 13,13, aleatória 14,13, novidade 9,38; controle (não deve melhorar): treinada − congelada 2,88 [-1.38,8.13]. Fração das vezes em que escolheu uma ação da característica premiada (normal) visível no teste: {"ativa":0.81,"congelada":0.577,"aleatoria":0.452,"novidade":0.482}. Valência depois do treino (treinada): premiadas 0,89, outras -0,08. `docs/medicoes/qa-b2-normal-resumo.json`.

**2026-10-01, madrugada: qa-b2-normal-replica (contrabalanço do tipo de bug: defeitos nas ações "normal", com os glomérulos fortes (mapa trocado), mesma estrutura de treino e teste, replicação com sementes novas): PASSOU.** Sementes 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246. Primeiro bug de teste: treinada 14,37, congelada 16,25, aleatória 12,85, novidade 8,52. Treinada − congelada -5,09, IC95 [-7.97,-2.44]. Transferência: treinada 7,63, congelada 12,72, aleatória 11, novidade 7,59; controle (não deve melhorar): treinada − congelada 4,56 [-3.13,12.19]. Fração das vezes em que escolheu uma ação da característica premiada (normal) visível no teste: {"ativa":0.764,"congelada":0.549,"aleatoria":0.472,"novidade":0.47}. Valência depois do treino (treinada): premiadas 0,92, outras -0,09. `docs/medicoes/qa-b2-normal-replica-resumo.json`.

**2026-10-01, madrugada: qa-b2-decepcao (decepção no teste: PPL1 quando escolhe com valência > 0,6 e não acha bug novo): PASSOU.** Sementes 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266. Primeiro bug de teste: treinada 14,94, congelada 17,63, aleatória 14,11, novidade 8,85. Controle, treinada sem − com decepção 6,25, IC95 [1.69,11.56] (rótulo corrigido em 01/10: a rotina escrevia "treinada − congelada" para o critério próprio). Transferência: treinada 7,66, congelada 13,63, aleatória 13,03, novidade 9,06; controle (não deve melhorar): treinada − congelada 3,88 [-2.06,9.81]. Critério: controle, treinada sem − com decepção (principal, deve ser > 0): 6.25 IC95 [1.69,11.56]; transferência, com decepção − congelada (secundário, deve ser < 0; passou): -4.59 IC95 [-7.44,-1.91]. Com decepção: transferência 9,03, controle 23,25, decepções por sessão 5,13. Fração das vezes em que escolheu uma ação da característica premiada (repetida) visível no teste: {"ativa":0.794,"ativa_decepcao":0.629,"congelada":0.52,"aleatoria":0.449,"novidade":0.463}. Valência depois do treino (treinada): premiadas 1,03, outras -0,05. `docs/medicoes/qa-b2-decepcao-resumo.json`.

**2026-10-01, madrugada: qa-b2-decepcao-replica (decepção no teste: PPL1 quando escolhe com valência > 0,6 e não acha bug novo, replicação com sementes novas): negativo.** Sementes 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286. Primeiro bug de teste: treinada 14,65, congelada 16,83, aleatória 13,25, novidade 9,08. Controle, treinada sem − com decepção 4,63, IC95 [-0.56,10.63] (rótulo corrigido em 01/10). Transferência: treinada 8,59, congelada 13,13, aleatória 15,94, novidade 9,38; controle (não deve melhorar): treinada − congelada 2,5 [-2.56,8]. Critério: controle, treinada sem − com decepção (principal, deve ser > 0): 4.63 IC95 [-0.56,10.63]; transferência, com decepção − congelada (secundário, deve ser < 0; não passou): -0.59 IC95 [-3.38,2.13]. Com decepção: transferência 12,53, controle 22,13, decepções por sessão 5,13. Fração das vezes em que escolheu uma ação da característica premiada (repetida) visível no teste: {"ativa":0.787,"ativa_decepcao":0.588,"congelada":0.546,"aleatoria":0.402,"novidade":0.43}. Valência depois do treino (treinada): premiadas 0,93, outras -0,08. `docs/medicoes/qa-b2-decepcao-replica-resumo.json`.

**01/10, fila de validade concluída.** Retenção (−4,8 e −5,6) e tipo de defeito "normal" (−4,8 e −5,1) passaram e
replicaram. Decepção: passou na principal (controle, sem − com, +6,3 [+1,7; +11,6]; transferência contra a congelada
−4,6) e NÃO replicou (+4,6 [−0,6; +10,6]; −0,6 [−3,4; +2,1]); não conta como achado. Exploratório, não pré-registrado
(32 sementes juntas): reduz o custo no controle em 5,4 [1,7; 9,4] e custa 2,7 [1,0; 4,5] na transferência. Correção
em `qa_comparacoes.mjs`: na decepção, a família de Holm usava o critério secundário; passou a usar o principal
(controle, com − sem). Holm final, 14 séries: as 6 positivas replicadas passam (p ajustado 0,007–0,009); a decepção
principal passa por pouco (0,048) e a replicação não (0,49). A novidade segue a melhor no controle e na média de todos
os defeitos; na transferência a treinada empata com ela (ganha só na replicação da bancada 2). Artigo e README
atualizados.

## Memória + curiosidade (01/10, escrito antes de rodar)

Pedido do usuário: seguir com memória + curiosidade e consolidar a versão final. Motivo: na média de todos os defeitos,
o explorador por novidade ganha da mosca treinada (ela se especializa demais).

**Regra (nossa, declarada):** nas condições `*_curiosa`, no teste, a escolha usa valência − H × vezes que ela já
tentou aquela ação neste episódio. É habituação ao que já provou; a página já faz isso na visão, e moscas reais
habituam. O treino é idêntico ao da condição sem curiosidade (mesma semente, mesmo cérebro até o teste).

**H escolhido antes, no oráculo** (`scripts/qa_curiosidade_oraculo.mjs`, `qa-curiosidade-oraculo.json`): a valência de
cada ação é a média medida no cérebro depois do treino (qa-b2 e réplica), com o viés de nascença, mais ruído 0,15.
O oráculo reproduz o cérebro sem curiosidade (treinada 6,8 na transferência e 25,7 no controle; no cérebro, 5,8–8,8 e
26,6–29,9). Média de todos os defeitos: novidade 9,56; treinada sem curiosidade 13,1; com H 0,5 10,4; com H 1,2 8,7; de
H 2,5 em diante estabiliza em 8,22 (transferência 5,82, controle 13,0). **H = 2,5.** Na prática: tenta primeiro o que
ainda não tentou e, entre as novas, escolhe pela memória. Congelada com curiosidade: 10,8.

**Poder** (simulação com o oráculo, `_tmp/_poder_cur.mjs`): com cada versão de teste 1 vez, 16 sementes detectam a
superioridade em 34% das vezes; com 3 vezes, em 73%; a não-inferioridade (margem +1,5) em 100%. **Desenho:** cada
versão de teste 3 vezes (`--repeticoes-teste 3`, a primeira com as ações visíveis de sempre).

**Série `qa-b2-curiosidade`:** condições treinada, treinada com curiosidade, congelada com curiosidade, aleatória e
novidade; sementes 301–316, réplica 321–336 (se o principal passar). Rotina: `node scripts/madrugada.mjs --plano
curiosidade`.
- **Principal (não-inferioridade):** na média de todos os defeitos do teste, curiosa − novidade com IC95 abaixo de
  +1,5 ações (15% dos 9,6 da novidade).
- **Secundário 1 (superioridade):** curiosa − novidade com IC95 abaixo de 0. É o que entra na família de Holm.
- **Secundário 2:** na transferência, curiosa − congelada com curiosidade < 0 (a vantagem vem da memória, não só da
  curiosidade).
- **Secundário 3:** no controle, treinada sem − com curiosidade > 0 (a curiosidade reduz o custo da especialização).

Correção na rotina (01/10): para séries com critério próprio (decepção), a nota no plano escrevia o número do critério
com o rótulo "treinada − congelada"; os dois rótulos da decepção acima foram corrigidos e a função foi reescrita.

**01/10, 20h38: a série de curiosidade foi reiniciada com 2 simulações por vez** (`--paralelos 2`, prioridade abaixo do normal), a pedido do usuário (o PC travava com 4). Os 4 processos tinham 18 min e nenhuma linha gravada; nada foi perdido nem olhado. Mesmas sementes, critério e desenho; só o tempo dobra. A rotina agora também retoma uma série interrompida (roda só as sementes que faltam).

**2026-10-02, madrugada: qa-b2-curiosidade (memória + curiosidade no teste (valência − 2,5 × tentativas da ação no episódio), cada versão de teste 3 vezes): PASSOU.** Sementes 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316. Critério: geral, curiosa − novidade (principal: IC95 < +1,5): -0.18 IC95 [-1.17,0.9]; superioridade (IC95 < 0): não; transferência, curiosa − congelada curiosa (deve ser < 0; não passou): -0.53 IC95 [-1.26,0.19]; controle, sem − com curiosidade (deve ser > 0; passou): 13.42 IC95 [10.46,16.33]. Ações até o primeiro bug por condição (transferência / controle / média de todas as versões): ativa 10,63 / 25,77 / 15,68; ativa_curiosa 8,05 / 12,35 / 9,49; congelada_curiosa 8,58 / 13,5 / 10,22; aleatoria 12,05 / 14,88 / 12,99; novidade 9,69 / 9,63 / 9,67. Fração das vezes em que escolheu uma ação da característica premiada (repetida) visível no teste: {"ativa":0.663,"ativa_curiosa":0.548,"congelada_curiosa":0.487,"aleatoria":0.437,"novidade":0.451}. Valência depois do treino (treinada): premiadas 1,09, outras -0,08. Resumo: `docs/medicoes/qa-b2-curiosidade-resumo.json`.

**2026-10-02, madrugada: qa-b2-curiosidade-replica (memória + curiosidade no teste (valência − 2,5 × tentativas da ação no episódio), cada versão de teste 3 vezes, replicação com sementes novas): PASSOU.** Sementes 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336. Critério: geral, curiosa − novidade (principal: IC95 < +1,5): -0.26 IC95 [-1.47,0.92]; superioridade (IC95 < 0): não; transferência, curiosa − congelada curiosa (deve ser < 0; não passou): -1.19 IC95 [-2.44,0.03]; controle, sem − com curiosidade (deve ser > 0; passou): 11.77 IC95 [8.77,14.31]. Ações até o primeiro bug por condição (transferência / controle / média de todas as versões): ativa 9,07 / 26,31 / 14,82; ativa_curiosa 7,16 / 14,54 / 9,62; congelada_curiosa 8,34 / 14,48 / 10,39; aleatoria 11,97 / 14,85 / 12,93; novidade 9,29 / 11,06 / 9,88. Fração das vezes em que escolheu uma ação da característica premiada (repetida) visível no teste: {"ativa":0.663,"ativa_curiosa":0.557,"congelada_curiosa":0.498,"aleatoria":0.439,"novidade":0.454}. Valência depois do treino (treinada): premiadas 1, outras -0,08. Resumo: `docs/medicoes/qa-b2-curiosidade-replica-resumo.json`.

**02/10, memória + curiosidade concluída e versão final.** Principal (301–316): curiosa − novidade na média de todos
os defeitos −0,18 [−1,17; +0,90]; replicação (321–336): −0,26 [−1,47; +0,92]. Não-inferioridade passou nas duas;
superioridade não. Descritivo: na transferência a curiosa ganha da novidade (−1,6 e −2,1), no controle perde (+2,7 e
+3,5). Secundários: controle, sem − com curiosidade +13,4 e +11,8 (passou); transferência, curiosa − congelada curiosa
−0,5 e −1,2 (não passou: com H 2,5 a memória acrescenta pouco sobre a curiosidade). O oráculo previa uma vantagem maior
da memória (5,8 contra 9,7 na transferência); a causa provável é o esquecimento ao longo de um teste com 9 episódios (a
treinada sem curiosidade também caiu para 10,6 e 9,1 na transferência), limitação declarada antes. Holm com 16 séries:
as 6 positivas replicadas passam (0,008–0,011); a decepção principal deixou de passar com a família maior (0,06).
Versão final do artigo (`docs/publicacao/artigo.md`, seções 6.11 e 7.5), README e AGENTS.md atualizados. Dois defeitos
da rotina corrigidos nesta etapa: a vaga de uma parte concluída não era liberada (com `--paralelos 2`, ficou 1 por vez
por umas horas; corrigido e reiniciado, só a semente 308 recomeçou) e o rótulo da nota para critérios próprios.

## Onde parei (02/10/2026)

- [x] T0 itens 1 e 2; [x] T1 piloto; [x] caça a bugs: bancada 2 + retenção + tipo de defeito (replicados), decepção
  (não replicou), memória + curiosidade (empata com a novidade, replicado). Versão final do artigo.
- [ ] Abertos (artigo, 7.4): equilíbrio memória/curiosidade com oráculo que inclua esquecimento; defeitos de
  sequência; software real com testes de mutação; memória entre sessões; T0 itens 3 a 6.

**02/10, tela "Caça a bugs ao vivo" (`web/caca.html`).** O protocolo da bancada 2 rodando no navegador, com o worker
real, e três vistas (a mosca em 3D ou 2D, o cérebro 3D com os disparos reais, o painel). No modo "Sorteio", a sessão
repete a medida com a mesma semente (conferido com a semente 51 treinada: valências antes do treino, os 6 episódios
de treino e o teste iguais ao `qa-b2`). Defeito achado nessa conferência e corrigido: a tela acrescentava 0,6 s de
cérebro depois de cada bug do teste; as pausas da animação agora param só o relógio da tela. No modo "Mapa" (padrão),
as 15 ações ficam espalhadas na bancada e as visíveis são as 3 mais perto de onde ela está: ela anda e testa pelo
mapa com o mesmo mecanismo (cheira 1 s, valência, softmax, recompensa). É variante de demonstração, não medida: as
ações visíveis passam a depender do caminho. Medir o modo mapa em série seria um experimento novo (oráculo, critério,
replicação).

**02/10, caça a bugs no mundo da mosca (`web/caca-mundo.js`, aba "Caça a bugs" da página).** Pedido do usuário: a
mosca tem de andar, voar e agir como na Cozinha; o treino é a etapa final de todo o trabalho no corpo. As 15 ações
viram plaquinhas na bancada (cheiro das características a 100 Hz no centro, peso 0,67 × 150 Hz); provar com a
probóscide executa a ação; bug novo no treino = açúcar + PAM (a regra de `foundBug`). Ganchos mínimos no `index.html`:
`press` chama `APP.provar`; a plaquinha não provada tem "gosto doce" pela novidade (a regra da caça a bugs da
página); sem atração inata; a atração aprendida usa a diferença de cheiro entre as antenas. Primeira sessão: ela
explora, prova plaquinhas diferentes e limpa o corpo entre elas. Ainda não medido: é o próximo experimento (o
caminho, a visão e o corpo passam a decidir o que ela encontra).

**02/10, série medida no mundo: infraestrutura e piloto.** `scripts/qa_mundo.mjs` abre a página num Chrome sem janela
com os olhos reais amostrados (`?headless=1&olhosHeadless=1`, sem desenhar a câmera de quem assiste) e roda o modo
automático de `caca-mundo.js` (`?caca=auto&cond&car&semente&treinos`): treino (6 versões; cada uma até 12 provas ou 90 s
de cérebro; bug novo = açúcar + PAM) e teste (3 versões novas, sem recompensa, até o primeiro bug, 15 provas ou 120 s).
A semente fixa o cérebro, o mapa e os sorteios da página (Math.random); o que depende do relógio de parede ainda varia.
Resumo: `scripts/qa_mundo_resumo.mjs` (pareado, bootstrap, p, dz; provas e tempo até o primeiro bug, fração das provas
em plaquinhas da característica premiada). Pedido do usuário no meio do caminho: "o comportamento dela deve ser igual ao
de uma mosca de verdade, use o que construímos": no mundo da caça a bugs, a atração aprendida passou a alimentar os
mesmos caminhos da atração inata por comida na Cozinha (busca pelo cheiro, decolar quando ele para de crescer, pousar
onde ele está), regra declarada. Teste rápido (`--curto`): sem erros, olhos reais ativos, ~1× o tempo real.
**Piloto (exploratório, não conta como resultado):** sementes 501–503, treinada e congelada, 2 por vez
(`qa-mundo-piloto.json`). Serve para decidir, antes da série confirmatória: a medida principal (provas ou tempo até o
primeiro bug, ou a fração das provas na característica premiada), os limites de cada versão e o número de sementes.

**02/10, piloto reiniciado com uma correção de comportamento.** Usuário: "ela ainda tá ficando parada". Amostrando as duas
primeiras sessões do piloto (`_tmp/_espia_mundo.mjs`): numa, parada 33% do tempo (pausas curtas, limpeza, provas; o nível
medido na Cozinha); na outra, 57%, presa ~20 s numa só plaquinha, provando de novo e de novo: a regra da "novidade com
gosto doce" só enfraquecia a cada mordida (×0,35, como na página), a probóscide seguia ativa e a atividade dela ainda
freava o andar. Correção: provada nesta versão, a plaquinha deixa de ter gosto de novidade (como uma mosca que prova algo
que não é comida e não insiste). O piloto tinha ~10 min e nenhuma sessão concluída; recomeçou do zero.

**03/10, o mundo da apresentação (pedido do usuário: plataformas como no mundo dos ícones, com a estética da Cozinha; os
sentidos como guia; o treino tem de ser eficaz).** Piloto do mundo antigo (interrompido com o PC, 4 sessões): 0–1 bug em
6 versões de treino por sessão; no teste, quase nada (1 bug em 12 versões). Sem recompensa no treino não há o que
transferir: negativo exploratório, motivo da mudança. Mundo novo (`caca-mundo.js`): cinco objetos de cozinha como
plataformas, um por família (tábua de corte, pires, lata de atum, tampa de pote, porta-copo de cortiça; cilindros, a
mesma forma no desenho, na altura e na física, com `o.base` para o que fica em cima), alturas de 3,5 a 12 mm; as
plaquinhas da família em cima de cada uma, com ícone (para quem assiste). Treino: cada versão vai até ela achar o bug
(+10 s) ou 4 min; teste: até o primeiro bug ou 3 min. Regra da página aplicada às plaquinhas: o que ela já provou fica
fosco (chega ao cérebro pelos olhos, LC10a). Primeira sessão: 9 voos entre plataformas e o bug da versão 1 em 9 provas
(183 s); a atração aprendida ao cheiro premiado foi a 1,0. Uma sessão completa leva ~25 min de cérebro.

## Série no mundo da mosca (03/10, escrita antes de rodar)

**Piloto 2 interrompido e o defeito achado.** O piloto do mundo novo (sementes 601–603) ficou 4 min de cérebro no
primeiro treino sem nenhuma prova nas duas sessões. Diagnóstico (`_diag_mundo.mjs`, uma sessão sem janela amostrada a
cada 5 s): ela andava até a borda da bancada e deslizava rente a ela por minutos, sem nunca chegar às plataformas. A
posição só era presa no limite (`sbMove`), sem reação. Na mesma semente, outra rodada decolou aos 21 s e provou: o
relógio de parede muda o caminho, e a borda prendia uma parte das sessões. Correção (regra do corpo, declarada): a borda
da bancada é uma beira como a de uma plataforma, então ela decola (a mesma regra de decolar na beira) ou vira para o
centro. Vale também para a Cozinha.

**Rotina (`scripts/madrugada_mundo.mjs`), 3 sessões por vez:**
1. *Calibração do mundo* (só treino, condição ativa, 3 versões por sessão, 4 sementes por degrau). Escada: m0 = mundo
   atual (sementes 801–804); m1 = cheiro das plaquinhas com alcance de 24 mm em vez de 14 (811–814); m2 = alcance de
   24 mm e plataformas mais perto do centro da bancada (821–824). Fica o primeiro degrau em que ela acha o bug em
   ≥ 60% das versões de treino. Se nenhum passar, fica o melhor; se o melhor não chegar a 40%, a rotina para (negativo
   do mundo: sem recompensa no treino, não há o que medir).
2. *Piloto* (sementes 831–834, treinada e congelada, 6 versões de treino; exploratório): só estima o desvio para
   escolher N = (1,96 + 0,84)² / dz² + 2, entre 12 e 20 (20 se não houver efeito na direção esperada).
3. *Série confirmatória* (sementes 901 em diante, N pares). **Critério principal:** tempo até o primeiro bug nas
   versões de transferência (s de cérebro; 180 s quando não achou), treinada − congelada, IC95 do bootstrap < 0.
   Secundários, só relatados: provas até o primeiro bug na transferência; controle (não deve melhorar); fração das
   provas do teste na característica premiada (deve ser maior na treinada); bugs no treino.
4. Se passar, *replicação* com sementes novas (951 em diante), mesmo N e mesmo critério. Se não passar, a alternativa
   escrita antes: 9 versões de treino (sementes 1001 em diante; replicação 1051 em diante).
Cada etapa anota aqui, grava em `docs/medicoes/qa-mundo-*.json` e commita. O tempo é a medida principal porque no mundo
o custo de achar um bug é andar, voar e provar, não só o número de provas.

**03/10, 12h55: calibração m0 interrompida e escada refeita (antes de qualquer teste).** Com a borda corrigida, o m0
(sementes 801–803) seguia sem recompensa: em ~6 min de cérebro por sessão, 0 bugs, 0–5 provas. Novo diagnóstico
(`_diag_mundo.mjs` com contagem de eventos): (1) sem o servidor de física, ela não tinha como subir nas plataformas
andando, só voando, e chegava a 1–5 mm da lateral e virava; (2) a regra antiga das paredes da página a deixava andar
rente à borda da bancada, em paralelo, por minutos; (3) a bancada de 20 × 20 cm é grande para cinco plataformas: ela
passava a maior parte do tempo longe de todas; (4) parte dos voos é fuga pela fibra gigante quando a plataforma cresce
na frente dela (do cérebro: não mexido). Regras novas do mundo da caça a bugs, declaradas: **subida pela lateral** de
uma plataforma de até 15 mm, sem a física, a ~8 mm/s (60% das vezes que encosta; senão decola ou vira, como antes);
**bandeja**: as plataformas mais perto umas das outras, numa bandeja de madeira com 14 mm de folga, borda visível no
3D; **afastamento da borda** (a 10 mm dela, vira para o centro). Teste de 80 s depois: subiu 4 vezes, voou 3, pousou
no pires, provou 4 plaquinhas em duas plataformas. Escada nova (o mundo de todos os degraus tem essas regras): c1 =
cheiro com alcance de 14 mm e 240 s por versão de treino (sementes 841–844); c2 = alcance de 24 mm (851–854); c3 =
alcance de 24 mm e 360 s por versão de treino (861–864). O resto da rotina (critério, piloto, série, replicação,
alternativa) segue como escrito acima.

**03/10, 13h40: escada da calibração ajustada de novo, antes de rodar c2 e c3.** No c1 (sementes 841–843, em
andamento), 0 bugs nas 6 primeiras versões de treino: ela prova ~1 plaquinha a cada 50 s de cérebro, e achar a ação
com defeito entre 15 pede ~8 provas (~400 s), mais que os 240 s da versão. O alcance do cheiro (o c2 antigo) não muda
esse ritmo. Teste à parte na página normal (semente 871, 90 s de cérebro): com plaquinhas de 13 × 8,5 mm, 4 provas
(~1 a cada 22 s; uma rodada só, ruidosa). Também visto: 14 sinais de fuga da fibra gigante em 90 s, quase todos em
voo (sacadas diante da borda da bandeja e das plataformas); do cérebro, não mexido. Escada nova, 3 sementes por
degrau (9 versões de treino; o critério de 60% vira ≥ 6 de 9): c1 fica com as 3 sessões que já estão rodando
(841–843; a 844 não roda); c2 = plaquinhas de 13 × 8,5 mm e cheiro com alcance de 20 mm (881–883); c3 = como c2,
com 420 s por versão de treino (891–893). O degrau escolhido vale para o piloto e as séries.

**03/10, rotina do mundo, calibração c1 (bandeja, subida pela lateral, cheiro com alcance de 14 mm, 240 s por versão de treino): não passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 841, 842, 843. Achou o bug em 0 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug null s de cérebro; 5,56 provas por versão. Por sessão: 843 000, 842 000, 841 000. `docs/medicoes/qa-mundo-calib-c1.json`.

**03/10, rotina do mundo, calibração c2 (como c1, com plaquinhas de 13 × 8,5 mm e cheiro com alcance de 20 mm): não passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 881, 882, 883. Achou o bug em 0 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug null s de cérebro; 5,67 provas por versão. Por sessão: 881 000, 882 000, 883 000. `docs/medicoes/qa-mundo-calib-c2.json`.

**03/10, 14h50: c2 também negativo; a causa era o mapa; escada nova (d1, d2), antes de rodar.** c2 (plaquinhas de 13 mm,
alcance de 20 mm; sementes 881–883): 0 de 9 versões de treino com bug, 5,7 provas por versão. Contando as ações
provadas em c1 e c2: só carrinho, estoque e cupom; **nenhuma prova nas plataformas do pagamento e do cancelamento**, que
são justamente as famílias com os defeitos do treino (`VERSOES2.treino`) e ficavam do lado oposto ao ponto de partida.
Sem chance de recompensa: negativo do mapa, não do cérebro. Primeiro teste com as plataformas em círculo em volta do
início (todas a 38 mm; semente 935, 134 s de cérebro): 8 provas, mas de novo só em três plataformas (ela vai mais para
uns lados, pela luz da janela e pelo que é mais claro: a regra dos olhos "claro = objeto"). Regra nova do mundo,
declarada: **a cada versão do sistema, as plataformas trocam de lugar no círculo, por sorteio** (`&lugares=fixos`
desliga). Assim o lugar não indica onde está o defeito; só o cheiro indica, que é o que se quer medir. Teste (semente
936, ~150 s de cérebro, versões curtas de 120 s só para o teste): visitou as cinco plataformas, 16 provas, achou bug
no treino ("Cancelar duas vezes") com recompensa, 9 sinais de atração aprendida. A c3 (ainda com os lugares fixos)
foi descartada logo no início, sem resultado. Escada nova, 3 sementes por degrau, critério de ≥ 6 de 9 versões de
treino com bug: d1 = círculo sorteado, plaquinhas de 13 mm, alcance de 20 mm, 240 s por versão (sementes 931–933);
d2 = como d1, 420 s por versão (941–943). Piloto, série e replicação seguem como escrito.

**03/10, 15h10: d1 descartada por um artefato do sorteio; refeita com sementes novas.** Na semente 931 (a primeira
sessão concluída da d1), o bug foi achado na primeira prova, 4,4 s depois do início da versão, em duas versões
seguidas: na troca de lugares, uma plataforma podia aparecer embaixo dela, e ela começava a versão já em cima das
plaquinhas de outra família. Atalho do mapa, não comportamento. Correção (regra do mundo, declarada): a cada versão
nova, ela volta ao centro da bandeja, no chão, virada para um lado sorteado (como um experimentador recolocando a
mosca). Os dados da d1 (931–933, incompleta) ficam fora das medições (`_tmp/_descartado-calib-d1.json`, não versionado).
Teste depois (semente 937, versões de 60 s só para o teste): volta ao centro em cada versão; achou o bug do treino 1 no
pagamento em ~33 s e o do treino 3 no cancelamento. Escada: d1 com as sementes 971–973, d2 com 981–983; o resto, igual.

**03/10, rotina do mundo, calibração d1 (plataformas em círculo com lugares sorteados a cada versão, plaquinhas de 13 mm, alcance de 20 mm, 240 s por versão de treino): passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 971, 972, 973. Achou o bug em 1 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug 68,67 s de cérebro; 5,44 provas por versão. Por sessão: 973 111, 972 111, 971 111. `docs/medicoes/qa-mundo-calib-d1.json`.

**03/10, rotina do mundo, piloto (d1; exploratório, não conta como resultado).** Sementes 831–834, treinada e congelada, 6 versões de treino. Tempo até o primeiro bug na transferência, treinada − congelada: 10,69 s (por semente [-0.15,-37.92,80.93,-0.07]; dz 0,21). Bugs no treino por sessão: treinada 4,5, congelada 3. N da série confirmatória pela regra escrita antes: 20.

**03/10, 19h30: medida principal trocada depois do piloto, antes da série confirmatória (nenhuma sessão dela concluída
nem vista).** Piloto d1 (sementes 831–834, exploratório): o tempo até o primeiro bug na transferência ficou no teto
(média 171 s na treinada e 160 s na congelada, com 180 s quando não achou; a maioria das versões de teste terminou sem
bug), diferença de +10,7 s, dz 0,21: uma medida que quase não varia não mede a memória. Já a fração das provas do teste
em plaquinhas da característica premiada foi 0,32 na treinada e 0,12 na congelada, maior nas 4 sementes (+0,26; +0,22;
+0,08; +0,24). **Novo critério principal:** fração das provas do teste na característica premiada, treinada −
congelada, IC95 do bootstrap > 0. Secundários relatados: tempo e provas até o primeiro bug na transferência, controle,
bugs no treino. O N fica em 20 (o calculado pelo tempo; pela fração o mesmo cálculo daria 12, e mantenho o maior,
mais conservador). Protocolo, sementes (901–920; replicação 951–970) e mundo (cópia congelada `d9ba8ab`) iguais. A
série tinha começado às 19h10 e foi parada às 19h28 sem nenhuma sessão concluída; recomeça do zero com as mesmas sementes.
Limite honesto: escolher a medida depois do piloto é decisão tomada vendo dados exploratórios; por isso a série
confirmatória e a replicação, com sementes novas, é que contam.

**04/10, rotina do mundo: qa-mundo-d1 (mundo d1 (plataformas em círculo com lugares sorteados a cada versão, plaquinhas de 13 mm, alcance de 20 mm, 240 s por versão de treino), 6 versões de treino): negativo.** Sementes 901–920 (40 sessões válidas). fração das provas do teste na característica premiada, treinada − congelada (principal, IC95 > 0): -0,02 IC95 [-0.09,0.05] p 0.485 dz -0.14; tempo até o 1º bug na transferência (secundário, deve ser < 0): -3,22 IC95 [-31.44,24.11] p 0.829 dz -0.05; provas até o 1º bug na transferência: 1,23 IC95 [0.13,2.33] p 0.03 dz 0.49; controle (não deve melhorar), tempo: 19,14 IC95 [-13.99,50.58] p 0.263 dz 0.25; bugs no treino, treinada 3,3 e congelada 3,15. Resumo: `docs/medicoes/qa-mundo-d1-resumo.json`.

## Mundo 2 (04/10, escrito antes de rodar)

**O que a série qa-mundo-d1 mostrou (negativo).** 20 pares, sementes 901–920, 40 sessões válidas. Principal: fração das
provas do teste na característica premiada, treinada 0,26 e congelada 0,28; diferença −0,02, IC95 [−0,09; 0,05],
p 0,49. Secundários: tempo até o primeiro bug na transferência −3,2 s [−31; 24]; provas até o primeiro bug +1,2
[0,1; 2,3] (a treinada precisou de *mais* provas); bugs no treino 3,3 e 3,15 por sessão (a recompensa aconteceu nas
duas, em ~53% das versões). O efeito do piloto (+0,20 em 4 sementes) não se repetiu: era ruído. As duas frações
batem com o acaso (4 das 15 ações são "repetida": 0,27).

**Por quê (análise depois do resultado, declarada como tal).** No mundo por família a memória não tinha como virar
escolha: (1) em cima de uma plataforma ela prova todas as plaquinhas, porque a regra "o que ainda não provou tem gosto
doce" vale igual para todas, e as plaquinhas ficam a ~9 mm umas das outras, perto demais para o gradiente de cheiro
separar; (2) a característica premiada está em 4 das 5 plataformas, então escolher a plataforma também não exprime a
preferência. É um limite do desenho do mundo, não um resultado sobre o cérebro. A alternativa escrita antes (9
versões de treino, sementes 1001+) foi parada logo no início, sem sessão concluída, porque mais treino não muda esse
limite; a decisão foi tomada olhando o resultado da série e fica registrada assim.

**Mundo 2.** Uma plataforma por característica da ação: ação normal (tábua, 5 plaquinhas), repetição (pires, 4),
no limite (lata, 3), valor zero (tampa, 2), valor negativo (cortiça, 1); em círculo a 44 mm do início, lugares
sorteados a cada versão, ela volta ao centro a cada versão; plaquinhas de 13 mm, alcance do cheiro de 20 mm
(`&grupos=familia` volta ao mundo 1). Ir até a plataforma pelo cheiro passa a ser a escolha. Os defeitos do treino
(cobrança dupla, estorno duplo) e os do teste de transferência (cupom duplo, reserva dupla) ficam todos na plataforma
da repetição; a transferência é de ações de outras famílias com o mesmo cheiro de característica (DC1+VA6), e a
plataforma muda de lugar a cada versão.

**Rotina (`scripts/madrugada_mundo.mjs --n 20`), escrita antes de rodar:** calibração e1 (só treino, 3 sementes,
1101–1103; ≥ 6 de 9 versões de treino com bug); se não passar, e2 com 420 s por versão (1111–1113). Sem piloto: N = 20
fixado agora. Série confirmatória com sementes 1201–1220, mesmo protocolo (6 versões de treino, teste com 3 versões de
180 s). **Critério principal:** fração das provas do teste na característica premiada, treinada − congelada, IC95 > 0.
Secundários relatados: tempo e provas até o primeiro bug na transferência, controle, bugs no treino. Se passar,
replicação com sementes 1251–1270; se não passar, a rotina para e o negativo é registrado (sem alternativa). Cópia
congelada nova de `web/` (a versão do commit deste registro).

**04/10, rotina do mundo, calibração e1 (mundo 2: plataformas por característica, em círculo sorteado, plaquinhas de 13 mm, alcance de 20 mm, 240 s por versão de treino): não passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 1101, 1102, 1103. Achou o bug em 0,33 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug 111,61 s de cérebro; 5,67 provas por versão. Por sessão: 1101 001, 1103 011, 1102 000. `docs/medicoes/qa-mundo-calib-e1.json`.

**04/10, 16h: e1 e e2 negativos; e3 e e4 escritos antes de rodar.** e1 (sementes 1101–1103): bug em 3 de 9 versões
de treino; 29 das 51 provas foram na tábua da "ação normal", a plataforma maior, mais baixa e com mais plaquinhas
(5), onde ela prova todas. e2 (420 s por versão; 1111–1113): 0 bugs nas 5 versões concluídas, parada no meio por
estar claramente abaixo do critério. O formato das plataformas decidia para onde ela ia. Teste rápido com plataformas
iguais (semente 1121, 138 s de cérebro): ainda só tábua e tampa (uma rodada, ruidosa). Duas mudanças para e3:
(1) **plataformas iguais** (21 mm de raio, 7 mm de altura; `&iguais=1`), só a aparência muda; (2) **a ponte da
memória pelos MBONs** (`&ponte=mbon`): a atração aprendida passa a vir da valência das saídas do corpo cogumelar
(mbon_aprox − média de mbon_evitar e mbon_evitar_rec, a mesma leitura da bancada validada, onde a treinada subiu
+1,03 Hz por neurônio no cheiro premiado), em vez da leitura direta do peso das sinapses (regra nossa). Fica mais
perto do que vem do cérebro e do que foi medido. Escada: e3 = iguais + MBONs, 240 s por versão (sementes 1131–1133);
e4 = como e3, 360 s por versão (1141–1143). Critério da calibração, série (1201–1220, N = 20), critério principal e
replicação (1251–1270) iguais ao registro do mundo 2.

**04/10, rotina do mundo, calibração e3 (mundo 2 com plataformas iguais (21 mm, 7 mm de altura) e a atração aprendida lida nos MBONs, 240 s por versão de treino): não passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 1131, 1132, 1133. Achou o bug em 0,11 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug 142,81 s de cérebro; 5,89 provas por versão. Por sessão: 1131 000, 1132 100, 1133 000. `docs/medicoes/qa-mundo-calib-e3.json`.

**04/10, rotina do mundo, calibração e4 (como e3, com 360 s por versão de treino): não passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 1141, 1142, 1143. Achou o bug em 0,33 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug 17,91 s de cérebro; 5 provas por versão. Por sessão: 1141 001, 1142 010, 1143 001. `docs/medicoes/qa-mundo-calib-e4.json`.

**04/10, rotina do mundo: parou na calibração.** Nenhum degrau da escada chegou a 0,4 das versões de treino com bug (melhor: e4, 0,33). Sem recompensa no treino, a série não mediria aprendizado: negativo do mundo, não do cérebro.

**04/10, 18h50: e3 e e4 negativos; a causa achada; f1 e f2 escritos antes de rodar.** e3 (plataformas iguais, ponte
pelos MBONs; 1131–1133): bug em 1 de 9 versões de treino; só 3 das 53 provas na plataforma da repetição. e4 (360 s por
versão; 1141–1143): 3 de 9. A rotina parou sozinha (nenhum degrau ≥ 0,4), como escrito. Dois diagnósticos:
(1) `_diag_ponte.mjs`, uma sessão treinada (semente 1191, plataformas iguais, ponte MBON): a valência dos MBONs fica
entre 0,4 e 0,8 Hz em todo lugar, inclusive longe de tudo (0,68): lida em valor absoluto, a atração liga em qualquer
lugar e não aponta para o cheiro aprendido (na bancada o que mudava era a valência *depois* do treino, +1,03 no cheiro
premiado). Tempo perto da plataforma da repetição: 4% no treino. (2) Cheiros trocados, moscas congeladas (semente 1195,
600 s de cérebro): com o mapa original, a plataforma com DC1+VA6 (a repetição) teve **0%** do tempo e a da ação normal
39%; com o mapa trocado, a plataforma com DC1+VA6 (agora a normal) caiu para 14% e a da repetição (agora VL2a+VM6v) subiu
para 16%. **A mosca com corpo evita o par DC1+VA6 sem ter aprendido nada**: vem do cérebro (o cheiro entra pelas
antenas e muda a direção pelos neurônios descendentes), não de regra nossa. Na bancada, sem corpo, isso não aparecia.
Duas rodadas, uma de cada mapa: indicativo, não medida. Mudanças para f1: **mapa de cheiros trocado** (`&cheiros=trocados`;
o mesmo controle sensorial que na bancada deu positivo e replicou) e a **ponte pelas sinapses** de volta (o padrão:
lê quanto as sinapses do cheiro atual mudaram, zero para cheiros nunca premiados). Escada: f1 = plataformas iguais,
cheiros trocados, 240 s por versão (sementes 1151–1153); f2 = como f1, 360 s por versão (1161–1163). Critério da
calibração, série (1201–1220, N = 20), critério principal e replicação (1251–1270) iguais ao registro do mundo 2.

**04/10, rotina do mundo, calibração f1 (mundo 2, plataformas iguais, cheiros trocados, ponte pelas sinapses, 240 s por versão de treino): não passou.** Só o treino, condição ativa, 3 versões por sessão, sementes 1151, 1152, 1153. Achou o bug em 0,33 das 9 versões (critério: ≥ 0,6); mediana do tempo até o bug 5,4 s de cérebro; 3,67 provas por versão. Por sessão: 1153 101, 1152 100, 1151 000. `docs/medicoes/qa-mundo-calib-f1.json`.
