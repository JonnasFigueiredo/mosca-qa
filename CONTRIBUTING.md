# Como contribuir

*[English version](CONTRIBUTING.en.md)*

Contribuições são bem-vindas: correções, novos experimentos, novos sentidos ou comportamentos, melhorias de desempenho,
traduções e revisões do artigo. Este projeto tem uma regra acima de todas: **honestidade científica**. A página, a
documentação e o artigo dizem sempre o que vem do cérebro (do conectoma) e o que é regra nossa.

## Antes de começar

1. Leia o [manual](docs/MANUAL.md) e rode os testes de validação (seção 4).
2. Leia "O que vem do cérebro e o que é regra" no [README](README.md) e o [artigo](docs/publicacao/artigo.md).
3. Para mudanças grandes, abra uma *issue* descrevendo a ideia antes do código.

## Regras do projeto

- **Do mapa ou regra?** Toda mudança de comportamento responde a essa pergunta. Antes, teste no simulador se o
  conectoma sustenta o comportamento (triagem, como em `scripts/voo_mapa.py`). O que o mapa não sustentar entra como
  **regra declarada**, na página e em `docs/detalhes-tecnicos.md`.
- **Não ajuste o cérebro para obter um resultado.** Mudanças nos parâmetros do modelo (ganho, tônus, aprendizado,
  esquecimento) precisam de justificativa independente do resultado e ficam declaradas no artigo.
- **Critério antes da medida.** Um experimento novo tem o critério escrito em `docs/plano-treino-robusto.md` e
  versionado **antes** de rodar, com as sementes definidas. Valide primeiro com testes curtos (oráculo sem cérebro,
  condicionamento) e só depois rode séries longas.
- **Controles e replicação.** Compare sempre com o cérebro de pesos congelados, pareado por semente. Um resultado
  positivo só conta se replicar com sementes novas.
- **Negativos são publicados** com o mesmo detalhe dos positivos, com a causa quando ela for encontrada.
- **Medições** vão para `docs/medicoes/*.json` (nome em português, sem acento), com o método no campo `metodo`.

## Código

- Comentários, textos da página e documentação em português. Traduções para o inglês são bem-vindas nos arquivos
  `*.en.md`.
- Siga o estilo do arquivo que você está editando: nomes, densidade de comentários e formato.
- `web/index.html` usa quebras de linha CRLF.
- Arquivos temporários começam com `_` (o git os ignora). Dados grandes vão para `data/` (fora do git).
- Para conferir que uma otimização do cérebro não muda o comportamento, compare `node scripts/worker_teste.mjs` antes e
  depois.

## Como enviar

1. Faça um *fork* e crie um *branch* a partir de `main`.
2. Faça commits pequenos, com mensagens curtas e no imperativo.
3. Abra um *pull request* explicando o que muda, se é do mapa ou regra e como você testou.

## Licença

Ao contribuir, você concorda que a sua contribuição será licenciada sob a Apache License 2.0 (ver [LICENSE](LICENSE)).
Os dados derivados do Male CNS v1.0 seguem a CC-BY 4.0 (ver [NOTICE](NOTICE)).
