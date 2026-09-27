# Realismo da sandbox: primeiro pacote

Escopo autorizado em 27/09/2026: probóscide e alimentação por contato, antenas na escala do corpo e caminhada com pausas. Sem mudar pesos, grupos ou parâmetros do cérebro.

1. Triagem no worker da página: açúcar, retirada e ameaça. Registrar método e resultados.
2. Extrair a geometria das antenas e boca da malha existente; separar gosto nas patas de alcance da boca. Manter funcionamento sem malha.
3. Animar extensão pela saída `proboscide`; alimentar apenas com contato e extensão. Interromper ao voar, fugir, ficar presa ou perder contato.
4. Caminhada intermitente no relógio cerebral: andar, pausar e girar; alimentação e ameaça têm prioridade; preservar escalada física.
5. Conferir contato/altura, antenas, pausas, fuga, modelo sem malha e cenário 2D. Observar a Cozinha no navegador, registrar medições e conferir imagens.
6. Atualizar página e README com as regras e os limites observados.

## Situação (27/09/2026)

Passos 1 a 6 feitos. Na verificação (passo 5) apareceram e foram corrigidos:
- a boca abria e fechava pela metade quando a saída da probóscide, adaptada, oscilava em volta de 25 Hz: agora estende acima de 25 Hz e só recolhe abaixo de 12 Hz;
- o teste integrado falhava às vezes com "Failed to fetch": o servidor da página (HTTP/1.0) cortava o fim de alguns downloads no Windows; agora responde em HTTP/1.1, e a página tenta de novo quando um download cai no meio;
- medições soltas na Cozinha e de aproximação pelo cheiro em `docs/medicoes/realismo-livre.json`.

A anatomia vem da NeuroMechFly; o comando de extensão vem da rede. A trajetória da boca, o alcance de contato e a seleção/duração das pausas são regras do corpo, não comportamentos demonstrados como emergentes do conectoma. Não há mudança na escolha do pouso nesta etapa.
