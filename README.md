# Mosca QA

O conectoma completo do sistema nervoso central de uma mosca-da-fruta macho (166.700 neurônios, HHMI Janelia, 2026), simulado no navegador. A mosca passeia por uma loja fictícia com 5 bugs escondidos, prova os botões com a probóscide e aprende com os erros e os acertos: evita os botões que quebram e, quando está com fome, volta aos que funcionam.

## Rodar

A página precisa de um servidor local (o navegador não carrega os dados via `file://`):

```bash
python -m http.server 8765 --directory web
```

Abra http://localhost:8765. O cérebro leva uns 20 segundos para carregar.

## Estrutura

- `web/index.html`: a página (loja, mosca, cérebro em 3D, relatório de QA, memória)
- `web/sim-worker.js`: a simulação, numa thread separada
- `web/data/`: o conectoma empacotado para o navegador (base64, ~26 MB)
- `scripts/`: o processamento em Python que gera `web/data/` a partir dos dados do Janelia

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

### Aprendizado

- **Dor:** um clique que dá erro ativa os neurônios de dopamina PPL1 (PPL101 a PPL106). A dopamina não tem efeito sináptico rápido; ela só muda sinapses.
- **Regra:** a dopamina enfraquece as sinapses entre as células de Kenyon que dispararam há pouco e os 48 neurônios de saída "aproximar" dos compartimentos PPL1.
- **Açúcar:** um clique que funciona ativa os neurônios de dopamina de recompensa (PAM dos compartimentos γ5, β'2, β2, γ4 e α1), que enfraquecem as sinapses Kenyon → 30 saídas "evitar". Aquele cheiro passa a atrair.
- **Fome:** cada açúcar reduz a fome em 50%, e ela volta em ~80 s. Só com fome a mosca fica perto do que a recompensou; saciada, ela explora.
- **Esquecimento e consolidação:** a sinapse mudada volta aos poucos à força original. Cada episódio de dopamina consolida a memória: um erro isolado some em 2–3 min, três erros duram muito mais.
- **Extinção:** sentir o cheiro de novo sem dor (ou sem açúcar) acelera o esquecimento.
- **Tônus de base:** os neurônios de saída ficam perto do limiar, como os reais.
- **Cheiros:** cada botão tem um cheiro próprio, feito de 44 glomérulos divididos em 15 grupos sem repetição.
- **Memória entre visitas:** opcional, guardada no navegador (sinapses mudadas e consolidação).

### Laboratório

A página tem um laboratório (link no rodapé, ou `#lab`) com testes fixos: aproximação depois da dor, permanência depois do açúcar, memória no tempo e sessões livres. As medições de cada fase estão em `docs/medicoes/`.

### O que é simplificação

- **Direção do passo:** vem de regras simples do corpo, a curiosidade por botões novos e a meia-volta.
- **Decisão de desviar:** lê a força das sinapses do cheiro atual, não o disparo dos neurônios de saída.

A memória está nas sinapses da simulação; a ponte entre memória e movimento é simplificada.

Tentamos tirar essa ponte (`scripts/fase3_teste_direcao.py`, resultados em `docs/medicoes/fase3-direcao.json`). Os caminhos existem no mapa: as saídas do corpo cogumelar chegam em 1 ou 2 passos a DNa02, DNa03 e MDN. Mas, mesmo zerando as sinapses de um cheiro, a direção muda menos de 1 Hz (o próprio cheiro produz 7 Hz), e o MDN não muda nas condições da página. Cada antena projeta para os dois lados, então o corpo cogumelar informa valência, quase nada de direção.

## Créditos

- **Dados:** [FlyEM Male CNS v1.0](https://male-cns.janelia.org/), HHMI Janelia, licença CC-BY 4.0.
- **Modelo:** Shiu et al. 2024, *A Drosophila computational brain model reveals sensorimotor processing*, Nature.
- A loja "Quitanda" é fictícia e os bugs foram plantados de propósito.
