# Treinamento de moscas para explorar sistemas em 3D

Data: 28/09/2026. **Proposta para discussão; não implementada nem validada.**
Pedido do usuário: usar instintos e memória para encontrar problemas em sistemas, num mundo 3D inspirado na Cozinha.
Sistema escolhido pelo usuário: **Pedidos, com carrinho, estoque, pagamento e cancelamento**.

Atualização de 29/09/2026: a primeira etapa ganhou uma aba **Treinamento** funcional, descrita no README.
Implementados pareamento, testes sem recompensa, troca de lados, reversão, controle com pesos congelados e
persistência separada. Triagem e integração em `docs/medicoes/treino-memoria-*.json`. Uma sessão completa teve
permanência compatível com a pista recompensada, mas a primeira escolha após a reversão continuou sendo A.
Não está cumprido o critério científico da etapa A: faltam replicações, contrabalançamento e comparação causal.
As estações de Pedidos e os verificadores das etapas seguintes continuam propostas, sem implementação.

## Objetivo verificável

Uma mosca treinada deve encontrar mais defeitos distintos e reproduzíveis, com o mesmo orçamento de ações, do que
uma mosca sem plasticidade e do que exploradores simples. Medir também o custo em tempo real. A hipótese é que
associações sensoriais ajudem a priorizar testes; não que o conectoma compreenda requisitos ou programe testes sozinho.

A contribuição neural precisa continuar identificável: atividade sensorial, plasticidade e memória no worker;
tradução do software para sentidos, ponte memória-movimento, contato que executa ações e verificação são engenharia.

## Evidências e problemas atuais

- README, seção Resultados: transferência Pedidos → Financeiro de 60 s resultou em 1,8 bugs na treinada,
  contra 2,4 na ingênua e no controle. São medições pequenas e anteriores à arena proposta, não uma estimativa dela.
  Há benefício local em certos alvos próximos, mas não demonstração de generalização entre sistemas.
- `web/sistemas.js`: notas de função já viram combinações de glomérulos. Bugs são conhecidos e concentrados
  em rede e cálculo. `checar` relaciona resultados a IDs de ações e defeitos predefinidos; isso serve ao laboratório,
  mas precisa evoluir para verificar propriedades do sistema, inclusive defeitos sem ID previsto.
- `foundBug`, em `web/index.html`: recompensa com açúcar/PAM, sacia em 30% e no 3D também liga ameaça e glitch.
  A ameaça visual pode competir com a exploração recompensada; testar sua remoção apenas no novo modo de treino.
- `checkOmission` usa espera de 1,1 s de relógio real. O worker tem rastro de elegibilidade com constante de
  400 ms cerebrais (`TAU_E`). Resposta tardia pode recompensar o cheiro errado ou punir antes de terminar a operação.
  A duração da resposta do sistema e o tempo neural precisam ser registrados separadamente.
- A leitura da memória para orientar o corpo já é uma ponte por regras. A via visual → Kenyon foi fraca nas
  triagens existentes. Não assumir que ela aprende a reconhecer um botão ou uma sequência longa só olhando.
- Duas moscas hoje compartilham cozinha e comida, mas **o sistema de QA ainda tem um único `appState` global**.
  Não basta liberar a dupla em Pedidos: uma poderia consumir a recompensa ou alterar o estado da outra.

## Desenho recomendado: bancada de operações

Uma bancada pequena e plana, com estações próximas, sem obrigar voos ou escaladas para alcançar a tarefa.
O mundo continua visível em 3D; a primeira medição usa o corpo cinemático para reduzir variáveis.
Distâncias, tamanhos e intensidade sensorial serão calibrados antes de avaliar aprendizado.

| Elemento do mundo | O que representa | Como se liga ao sistema |
|---|---|---|
| Estação/ilha | Uma família de operações | Carrinho, pagamento, estoque ou cancelamento |
| Pontos de contato | Ações atualmente disponíveis | Adicionar item, pagar, cancelar, repetir uma requisição |
| Pequenos alvos de escolha | Classes de entrada | Quantidade usual, zero, vazia, acima de um limite conhecido |
| Cheiro composto | Características observáveis de ação, entrada e estado | Mutação/leitura, número/texto, repetição, estado pago/pendente |
| Mudança de estação após ação | Estado observado do sistema | Carrinho vazio/ocupado, pagamento pendente/concluído |
| Gota de recompensa | Evidência de defeito obtida após executar a ação | Ativação de recompensa identificada com o evento causal |
| Diário do observador | Evidência e caminho de reprodução | Estado inicial, ações, entradas, respostas e propriedade violada |

Os objetos não devem parecer podres, brilhar mais ou cheirar mais forte por conterem bugs ocultos.
Cor/tamanho podem identificar funções para o observador e afetar a visão, mas não codificar o gabarito.
A camada sensorial recebe uma lista restrita de atributos observáveis, sem acesso à tabela de mutações/defeitos.
Qualquer informação de cobertura entregue à mosca será uma instrumentação declarada e também disponível aos controles.

Contato sustentado pode ser a regra inicial para executar uma ação. Se a probóscide for exigida, calibrar primeiro
como provocar a exploração de alvos desconhecidos sem dar uma recompensa de bug antecipada. Não acionar uma sequência
inteira de cliques só porque a mosca chegou perto e depois atribuir o planejamento ao cérebro.

## Separar três responsabilidades

1. **Mosca:** percebe os alvos acessíveis e escolhe pela trajetória/contato, sob as mesmas regras corporais.
2. **Executor:** traduz a ação escolhida em operação no sistema e devolve o resultado, com identificador único.
3. **Verificador:** compara o resultado com contratos e registra evidência. Não escolhe a próxima ação.

O executor deve aceitar o mesmo formato em três etapas: sistema pequeno em memória, aplicação local instrumentada,
e depois uma cópia de teste de um sistema real. Começar com um contrato pequeno de operações reduz o custo de integrar.
Usar API primeiro quando disponível facilita reprodução; o adaptador de navegador vem depois, sem atribuir à mosca
entendimento de texto, seletores ou localização semântica de elementos.

Um erro de seleção/execução do adaptador é falha de infraestrutura, não bug encontrado. HTTP 400 esperado por uma
entrada inválida também não é bug. Tempo limite gera uma ocorrência a investigar; só vira defeito confirmado quando
viola um contrato de prazo ou é reproduzido sob condições controladas. Contratos do domínio têm de ser especificados.

Exemplos de contratos para uma loja de teste:

- Não vender mais unidades do que as disponíveis quando essa é a política definida.
- Repetir o mesmo pagamento com a mesma chave de idempotência não criar uma segunda cobrança.
- Cancelar um pedido elegível devolver exatamente o estoque que ele reservou, uma única vez.
- Total corresponder a itens, desconto e frete conforme a regra declarada; valores monetários em centavos.
- Um usuário sem permissão não conseguir executar a operação restrita nem observar dados protegidos.

O verificador não precisa saber a localização do defeito para detectar a violação. Porém, ele só detecta as classes
de problema cobertas pelos contratos e observadores implementados. UI confusa, regra de negócio não especificada e
defeitos silenciosos fora desses observadores continuam fora do alcance inicial.

## Currículo com critérios de passagem

### A. Aprender uma associação e agir por ela

Arena simétrica com duas pistas olfativas, posições contrabalançadas e igual aparência. Uma pista é pareada a recompensa
no treino. No teste, ambas ficam sem recompensa: medir primeira escolha e tempo de permanência. Trocar os lados,
inverter a contingência e comparar com plasticidade bloqueada. Calibrar as pistas contra preferência inata e
intensidade/resposta neural, sem presumir que misturas diferentes são equivalentes.

Se não houver mudança comportamental reproduzível, resolver a ponte entre memória e escolha antes de construir
fluxos longos. Uma mudança de peso sináptico sozinha não demonstra melhora de decisão.

### B. Descobrir defeitos por uma ação

Operações com entradas simples, versões corretas e defeituosas misturadas, sem marcas de resposta.
Separar ambientes de treino e teste desde o gerador. Recompensar o primeiro defeito distinto confirmado.
Exemplos: cálculo não finito, limite de quantidade violado ou contagem inconsistente.

Trocar posições e IDs entre episódios, mantendo características funcionais compartilhadas. Reservar combinações
e implementações inteiras para teste; não apenas embaralhar botões dos mesmos bugs. Incluir versões sem defeitos.

### C. Dependência de estado: duas e depois três ações

Exemplo: criar pedido → pagar → repetir pagamento. O último passo revela uma cobrança duplicada.
O mundo apresenta o estado observado e as ações que existem naquele estado, inclusive caminhos que não dão defeito.
Não montar um corredor que obrigue a sequência vencedora: isso seria um roteiro de teste nosso.

O objetivo inicial é aprender que certas ações em certos contextos valem exploração, não presumir planejamento
de longo prazo. Registrar se o ganho desaparece quando uma sequência se alonga.

### D. Transferência para uma aplicação local

Executar as mesmas famílias de ação em outra implementação, com novas entradas e defeitos reservados.
Guardar um caso de teste reproduzível por descoberta e reproduzi-lo em instância limpa. Comparar com a versão
corrigida quando disponível: o caso deve expor a violação na defeituosa e deixar de expô-la na corrigida.

### E. Duas moscas e concorrência

Primeiro: mesma arena visível, **instâncias do sistema e recompensas independentes**, para comparar treinada e controle.
Depois: duas exploradoras independentes, relatório agregado e orçamento total contabilizado. Isso não é aprendizado
social. Um sinal compartilhado de novidade seria memória externa projetada e deve ter seu próprio controle.

Só depois compartilhar estado do sistema para procurar condições de corrida. Nesse experimento serão necessários
barreiras de requisições, escalonamento controlado, associação de ações a cada agente e reprodução do entrelaçamento.
Duas moscas clicando juntas não garantem que as requisições se sobreponham no ponto crítico.

## Recompensa, tempo e exploração

- Recompensar descoberta distinta confirmada; deduplicar por violação e causa/evidência, não só pelo texto da mensagem.
  No benchmark usar o identificador oculto da falha apenas para pontuar, nunca para orientar a ação.
- Bugs repetidos não geram outra grande recompensa. Isso é contabilidade externa de cobertura de defeitos.
- Ação sem bug não merece punição automática: pode ser pré-requisito útil. Distinguir resultado válido, inválido
  esperado, rejeição por pré-condição, resultado ainda pendente e violação confirmada.
- Começar com operações imediatas e associação local de recompensa. Manter o cheiro da ação durante um curto
  período de processamento é uma possibilidade de apresentação sensorial, a medir e declarar.
- Para respostas demoradas, o executor mantém `mosca`, `episodio`, `acao`, estado anterior e relógios de envio/retorno.
  Parar todas as simulações enquanto espera é uma opção inicial simples; não alongar o rastro neural silenciosamente.
- Reapresentar artificialmente o cheiro causal para recompensá-lo ou redistribuir recompensa pela sequência seria
  um mecanismo externo de atribuição de crédito. Avaliar como variante separada, não chamar de memória emergente.
- Recompensa pequena por transição nova pode aliviar escassez, mas introduz outro objetivo. Adicionar só depois de
  medir o treino apenas por defeitos, com limite por transição e ablação. Não transformar novidade infinita em alimento.
- Fome e saciedade são condições experimentais. Medir se os 30% atuais por bug encerram cedo demais a busca.
  Se forem ajustados, aplicar a mesma regra aos controles e identificar que se trata do regime de treinamento.

## Como saber se funciona

Pré-definir conjuntos de treino, validação e teste; guardar versões do gerador, código, mapa e parâmetros.
Separar sementes de mundo, ruído corporal e entradas neurais. Parear cenários e posições iniciais. Uma semente global
não assegura perturbações equivalentes quando políticas diferentes consomem números aleatórios em ordens diferentes.

Comparadores:

- Mosca treinada com plasticidade ativa.
- Mesmo controlador e exposição sensorial, mas sem mudança de pesos; manter estímulos de recompensa equivalentes
  quando a comparação pede isolar plasticidade, em vez de retirar açúcar e alterar também motivação/comportamento.
- Mosca ingênua; controle de recompensa não pareada para separar exposição de associação quando necessário.
- Escolha aleatória dentre as mesmas ações disponíveis.
- Explorador simples que prioriza transições ainda não tentadas; depois um método convencional guiado por cobertura.

Usar dois níveis de comparação: escolha abstrata de ações (todos sem custo de andar) e exploração incorporada
(mesma geometria/regras de deslocamento). Não dar a um controle conhecimento de estado que a mosca não recebeu.

Métricas principais: defeitos distintos **confirmados** por 100 ações e tempo real até a primeira descoberta.
Também medir cobertura de estados/transições, repetição de defeitos, falsos positivos, sequência reproduzível,
tempo neural, custo de CPU/memória e rendimento total das duas moscas. Não contar cliques como bugs nem tratar
milhares de passos de uma mesma sessão como réplicas independentes.

Proposta de protocolo, ainda sem execução: piloto com 5 sementes para depurar e estimar variabilidade; depois
20 cenários pareados por condição como ponto inicial, ampliando conforme incerteza e custo. Fixar orçamento de ações
e um limite de tempo de parede; registrar episódios que não atingiram o orçamento. Congelar o protocolo antes do teste
reservado. Relatar diferenças pareadas e intervalos de incerteza, inclusive resultados negativos.

Critério para avançar: benefício no conjunto reservado contra o controle sem plasticidade, sem aumento de falsos
positivos ou perda de reprodução. Comparação contra exploração por novidade é necessária para sustentar utilidade
prática. Pode existir aprendizado neural demonstrável sem vantagem prática sobre um testador simples.

## Primeira entrega recomendada

Uma arena pequena de Pedidos, com quatro famílias de operação (carrinho, estoque, pagamento e cancelamento), ações de um passo e entradas limite;
um verificador por contratos; diário reproduzível; versões corretas e defeituosas; comparação treinada/sem plasticidade.
Antes de construir a arena completa, executar a etapa A com o **worker real** e produzir a primeira medição.
O Python não deve ser usado como substituto sem verificar equivalência de pesos e transmissão com o navegador.

Organização sugerida, nomes ainda propostos:

- `web/treino-qa.js`: episódios, sensores e recompensa; não acessar o gabarito pelo caminho dos sensores.
- `web/arena-qa.js`: representação 3D e contato, reutilizando o corpo existente.
- `web/qa/sistema.js`: contrato do executor e observações disponíveis.
- `web/qa/verificador.js`: propriedades e evidências, isolado da política.
- `scripts/treino_qa_teste.mjs`: sessões pareadas e reprodução.
- `docs/medicoes/treino-qa-*.json`: método, configurações, sementes e resultados, só após medir.

Não iniciar com um sistema grande ou com treinamento simultâneo de navegação, interação, parâmetros, sequência
e coordenação entre agentes. Cada etapa acrescenta uma dificuldade cuja contribuição pode ser medida.

## Referência de engenharia

[RESTler: Stateful REST API Fuzzing, Microsoft Research, ICSE 2019](https://www.microsoft.com/en-us/research/publication/restler-stateful-rest-api-fuzzing/)
mostra uma abordagem convencional baseada em dependências entre operações e respostas observadas. A proposta aqui
aproveita essa separação entre ações, estados e resultados como inspiração de arquitetura. Não é evidência de que
um conectoma terá o mesmo desempenho nem uma recomendação de instalar a ferramenta nesta etapa.
