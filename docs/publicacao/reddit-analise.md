# Análise dos posts e plano de publicação

Preparado em 12/10/2026. Os números abaixo são pontuações exibidas nos resultados indexados consultados nesta conversa, não métricas ao vivo. As páginas completas nem sempre exibiram votos. Não temos impressões, taxa de cliques, proporção de votos, compartilhamentos ou exposição inicial. Comunidades e datas diferentes impedem comparar qualidade apenas pela pontuação. As explicações de desempenho são hipóteses editoriais, não causas demonstradas.

## Quais referências aproveitar

| Referência | Pontuação indexada | Melhor uso para o Mosca QA |
|---|---:|---|
| [Mosca usando Instagram · r/threejs](https://www.reddit.com/r/threejs/comments/1wdoe32/i_made_a_fruit_fly_that_doomscrolls_instagram_on/) | +308 | Melhor sinal de recepção visual entre os cinco. Ação reconhecível no título e efeito visual imediato. |
| [Mosca no jogo de tanques · r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1wemvl4/i_trained_a_fruit_fly_to_play_my_3d_browser_tank/) | +52 | Melhor referência para apresentar mecanismo, processo de desenvolvimento e limites juntos. |
| [FlyLab usando teclado · r/neuro](https://www.reddit.com/r/neuro/comments/1wkolmu/i_built_a_connectomegrounded_fruit_fly_that_can/) | +26 | Boa referência para descrever entrada, circuito, controlador e ação física sem alegar inteligência geral. |
| [Modelo em um dragão de Skyrim · r/compmathneuro](https://www.reddit.com/r/compmathneuro/comments/1wql4wk/live_experiment_embedding_a_127kneuron/) | +18 | Melhor alerta sobre recepção científica: o questionamento crítico também recebeu votos (+12 no retrato consultado). |
| [Jogo de reflexo de fuga · r/SideProject](https://www.reddit.com/r/SideProject/comments/1wen74a/built_a_reaction_game_based_on_the_fruit_fly/) | 0 | Referência de formato e pergunta ao público; não há evidência de sucesso de engajamento nesta amostra. |

### Instagram: clareza antes da escala

O título descreve algo que qualquer pessoa consegue imaginar: uma mosca rolando o Instagram. O cérebro acendendo acompanha uma ação observável. O texto entrega detalhes de Three.js e construção procedural para o público técnico. Minha leitura: humor, ação familiar e explicação técnica ajudam a abrir duas portas, curiosidade e discussão de implementação.

Distinção essencial: o autor declara que a visualização é estilizada, inspirada na anatomia, e não usa conectoma real. Não é um equivalente científico do Mosca QA. Aproveitar a clareza de apresentação, sem copiar o enquadramento biológico.

### Tanques: ação específica e mecanismo acessível

O autor explica o circuito reduzido de 124 neurônios, 1.106 conexões e o controlador construído por ele. Inclui código, demonstração e processo com ferramentas de IA; o navegador não depende de um LLM para decidir as ações. Nos comentários, admite que os bots ainda vencem a mosca. Minha leitura: o leitor encontra tanto a cena divertida quanto informações para entender e reproduzir o projeto. A limitação declarada favorece uma conversa mais concreta; não é possível medir seu efeito nos votos.

Para nós: mostrar a mosca, explicar o significado das placas e da recompensa, depois apontar documentação. Em r/ClaudeAI, acrescentar como o projeto foi desenvolvido e verificado.

### FlyLab: explicar a cadeia de ação

O texto descreve visão, atividade modelada, controlador aprendido e contato das patas com teclas. Delimita uma tarefa treinada e pede critérios para transformar a demonstração em experimento significativo. Isso é uma boa referência de estrutura para r/neuro. Os comentários disponíveis não permitem concluir que houve validação pelos pares.

Para nós: cheiro → atividade neural → escolha/amostragem → recompensa no treino → teste sem recompensa. Declarar quais partes são regras programadas.

### Skyrim: atenção não significa concordância

Um comentário critica a repetição de projetos do tipo “cérebro de mosca joga X” e as alegações de equivalência a um cérebro real. O autor responde com limitações, controles, replay e resultados negativos. Isso torna o post útil como alerta: números grandes e espetáculo podem atrair exatamente a crítica que queremos evitar.

Para nós: em r/compmathneuro, abrir com a pergunta experimental e o resultado misto. Sem corpo, houve vantagem de aprendizado; com corpo, mudou a preferência, mas o tempo até o primeiro defeito não melhorou. Não apresentar escolha, um resultado secundário, como confirmação do critério principal. Perguntar sobre controles específicos.

### SideProject: resultado inconclusivo para engajamento

A proposta tem desafio simples, três tentativas e placar. A pontuação indexada zero não demonstra interesse alto, mas também não explica um fracasso: não sabemos quantas pessoas viram o post. Não há base para atribuir o resultado ao título, horário ou algoritmo.

## Como construir nossas publicações

1. Mostrar a ação imediatamente no vídeo escuro de 24 segundos já aprovado. Ele é acelerado; não apresentá-lo como prova de velocidade de execução ou de eficácia.
2. Dar significado à cena em uma frase: ações do sistema viram cheiros; defeitos encontrados durante o treino geram recompensa.
3. Explicar somente os detalhes relevantes para aquela comunidade.
4. Incluir um limite concreto perto da alegação correspondente, em linguagem simples.
5. Terminar com uma pergunta específica que possa orientar uma mudança ou experimento.

Evitar “cérebro real transferido para o computador”, “substitui QA”, “entendeu o software” e “aprendeu a testar qualquer site”. O conectoma é real; dinâmica neural, corpo e tarefa são modelos. O sistema testado é fictício e contém defeitos inseridos para os experimentos.

## Ordem sugerida e adequação

| Ordem | Comunidade | Foco e condição |
|---:|---|---|
| 1 | r/threejs | Vídeo + integração Three.js/worker. Pergunta sobre relação entre mundo e painéis. |
| 2 | r/SideProject | A ideia de transformar ações em cheiros; compreensão da interface. Ajustar após dúvidas do primeiro post. |
| 3 | r/brdev | Arquitetura, gargalos e troca técnica em português. Não usar texto de marketing pessoal. |
| 4 | r/webdev | Showoff Saturday, flair apropriada, implementação e feedback específico. |
| 5 | r/ClaudeAI | Processo real com Claude e Codex, verificações e correções. Conferir elegibilidade do feed. |
| 6 | r/neuro | Modelo, aprendizado, cadeia sensorial e limites. |
| 7 | r/compmathneuro | Método, controles e resultados positivos/negativos; discussão mais exigente. |

Não há evidência para recomendar um horário mágico. Publicar quando você puder responder, em vez de enviar sete textos idênticos de uma vez. Adaptar as publicações posteriores às perguntas recebidas.

As orientações de [r/brdev](https://www.reddit.com/r/brdev/comments/1k9wap7/) e uma [remoção posterior](https://www.reddit.com/r/brdev/comments/1wpj6pa/removed/) distinguem colaboração técnica de autopromoção. A [orientação de r/webdev](https://www.reddit.com/r/webdev/comments/1wedebz/removed/) pede Showoff Saturday e discussão técnica. A [megathread oficial de r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1sly3jm/built_with_claude_project_showcase_megathread/) informa karma total mínimo de 50 para showcase no feed e oferece a megathread como alternativa. Confira as regras atuais nos botões do gerenciador antes de postar: estas fontes são retratos de moderação, não permissão permanente.

## Respostas para perguntas previsíveis

- **É uma mosca real digitalizada?** Usa a conectividade medida de uma mosca macho, mas os neurônios são um modelo simplificado. Isso não reproduz integralmente o animal.
- **O que é programado?** Passos, partes da navegação e outras regras do corpo são construídos por nós. O aprendizado usa plasticidade do modelo; a documentação separa os mecanismos.
- **A IA escolhe o movimento?** Claude e Codex ajudaram no desenvolvimento. Um LLM não decide as ações durante a execução do experimento.
- **Funciona como ferramenta de QA?** É uma prova de conceito em um sistema fictício com defeitos conhecidos. Não testa sites arbitrários nem substitui ferramentas ou profissionais de QA.
- **Qual foi o resultado?** Sem corpo, a treinada encontrou o tipo aprendido de defeito cerca de 5–7 ações antes da congelada. Com corpo, a preferência mudou, mas o tempo até o primeiro defeito não diminuiu. Não misturar os dois protocolos.

## Antes e depois de publicar

Os [sete rascunhos](reddit-publicacoes.md) também estão no [gerenciador](reddit.html). O botão de preenchimento só usa campos vazios e preserva seus textos existentes. Antes de publicar, conferir o link do repositório sem login; esta tarefa não publicou nem hospedou o projeto. Se o código não estiver acessível, retirar a promessa de acesso e informar a situação real.

Registrar link, data e perguntas recebidas no gerenciador. Depois de 24–48 horas, comparar principalmente respostas técnicas úteis, interesse em reproduzir e dúvidas recorrentes. Pontuação e visualizações, quando disponíveis, são indicadores complementares. Uma pergunta recorrente sobre as placas sinaliza que a apresentação precisa explicar melhor o vínculo entre mundo e tarefa, independentemente dos votos.
