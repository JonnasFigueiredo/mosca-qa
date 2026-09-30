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
- [x] T1 piloto (ponte por sinapses): passou; a mesma campanha com a ponte pelas MBONs está rodando
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

