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
