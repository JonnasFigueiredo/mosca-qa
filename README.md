# Mosca QA

*[English version](README.en.md)*

**O conectoma completo de uma mosca-da-fruta, simulado no navegador, aprendendo a procurar defeitos de software.**

O sistema nervoso central inteiro de um macho de *Drosophila melanogaster* (Male CNS v1.0, HHMI Janelia, 2026: 166.700
neurônios e 6,2 milhões de conexões) roda como uma rede de neurônios integra-e-dispara, num corpo 3D que anda, voa, vê
com olhos compostos e cheira com as antenas. Cada ação de um sistema de software fictício vira um cheiro; cada defeito
encontrado libera dopamina de recompensa. A pergunta: o cérebro aprende o "cheiro" de um tipo de defeito e passa a
procurá-lo em partes do sistema que nunca viu?

> **[Vídeo de abertura]** *Espaço reservado: a mosca na arena 3D cheirando as plaquinhas e achando um bug, com o
> cérebro acendendo ao lado (30–60 s).*

> **[Foto 1]** *Espaço reservado: o cérebro 3D com os 166.700 neurônios.*

---

## Resultados

| Experimento | O que aconteceu |
|---|---|
| **Cérebro sem corpo** (o cheiro entregue direto às antenas) | A mosca treinada achou defeitos do tipo aprendido, em partes novas do sistema, **5 a 7 ações antes** da mesma mosca sem aprendizado. Replicado com sementes independentes, robusto a 3 minutos de espera e a outro tipo de defeito, e significativo depois da correção para 16 comparações. |
| **Mosca com corpo** (anda e cheira numa arena 3D) | O mesmo treino fez a mosca **escolher mais as ações do tipo recompensado** em partes novas (+10 pontos percentuais, p < 0,001, 16 de 20 sementes). O tempo até o primeiro defeito não diminuiu de forma mensurável. |

Todos os critérios foram escritos e versionados **antes** de cada medida, e os resultados negativos estão relatados
com as suas causas. Os detalhes estão no [artigo](docs/publicacao/artigo.md).

> **[Foto 2]** *Espaço reservado: gráfico do resultado principal (ações até o primeiro defeito, treinada × congelada).*

---

## O que vem do cérebro e o que é regra nossa

| Do conectoma (emerge da fiação medida) | Regra nossa (declarada) |
|---|---|
| Virar para o que vê (LC10a → DNa01–03) | Ações do software representadas como cheiros |
| Estender a probóscide com açúcar nas patas | Leitura da memória nas saídas do corpo cogumelar e escolha por softmax |
| Fuga pela fibra gigante e a direção dela | O passo das patas, a fome, a altura do voo e o pouso |
| Voo pelos motores das asas, estabilizado pelos halteres | Na arena, o caminho até a próxima plaquinha |
| Aprendizado: a dopamina deprime as sinapses células de Kenyon → saídas | Os tempos da memória (esquecimento, consolidação, extinção) |

O circuito e a regra de aprendizado são os da mosca; o neurônio é simplificado (um compartimento) e os tempos da
memória são aproximados. Não afirmamos que o modelo é uma mosca.

> **[Foto 3]** *Espaço reservado: a mosca na cozinha 3D (vista "Olhos dela" ou "Lado a lado").*

---

## Como rodar

O passo a passo completo (requisitos, testes de validação, reprodução das medidas e problemas comuns) está no
**[manual](docs/MANUAL.md)**. O essencial: Python 3.12 e Node.js 22 ou mais.

```bash
python scripts/servir.py
```

Abra **http://localhost:8765** (a página da mosca) ou **http://localhost:8765/caca.html** (a caça a bugs ao vivo, com
o cérebro 3D e o painel). O cérebro leva uns 20 s para carregar. Use sempre o `servir.py` (HTTP/1.1, sem cache) e um
servidor só por porta.

Arena com os parâmetros das medidas: `http://localhost:8765/caca.html?arena=1&esquecimento=3600`.

**Corpo físico (opcional):** NeuroMechFly no MuJoCo, num ambiente Python separado (`corpo/requirements.txt`; ver o
manual, seção 7).

---

## Reproduzir as medidas

| Medida | Comando |
|---|---|
| Série sem corpo | `node scripts/qa_abstrato.mjs --bancada 2 --sementes 51,52 --cheiros docs/medicoes/qa-cheiros-fortes.json --saida docs/medicoes/X.json` |
| Resumo pareado (IC95, p, dz) | `node scripts/qa_resumo.mjs --prefixo X` |
| Correção de Holm | `node scripts/qa_comparacoes.mjs` |
| Condicionamento com corpo | `node scripts/qa_condicionamento.mjs --cond ativa --esquecimento 3600` |
| Série com corpo (arena) | `node scripts/madrugada_mundo.mjs --arena --n 20 --paralelos 2` |

Cada medida fica em `docs/medicoes/*.json`, com o método dentro. O diário cronológico de cada decisão, com os critérios
escritos antes, está em [docs/plano-treino-robusto.md](docs/plano-treino-robusto.md).

**Refazer os dados do cérebro:** baixe de https://male-cns.janelia.org/download/ os arquivos
`body-annotations-male-cns-v1.0-minconf-0.5.feather`, `body-neurotransmitters-male-cns-v1.0.feather` e
`connectome-weights-male-cns-v1.0-minconf-0.5.feather` (1,1 GB) para `data/raw/`, e rode `python 01_filter_edges.py`
e `python 02_build_web.py` dentro de `scripts/` (pandas, pyarrow, numpy, scipy).

---

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `web/index.html` | A página: a mosca, os sentidos, a leitura das saídas do cérebro, as regras do corpo |
| `web/sim-worker.js` | O cérebro: simulação por eventos e aprendizado no corpo cogumelar |
| `web/sandbox.js` | O mundo 3D: cozinha, voo, olhos reais, corpo físico |
| `web/caca-mundo.js`, `web/caca.html` | A caça a bugs no mundo 3D e a tela ao vivo |
| `web/qa/pedidos.js` | O sistema de Pedidos, os defeitos e os contratos |
| `web/data/` | O conectoma empacotado para o navegador (~32 MB) |
| `scripts/` | Geração dos dados, séries, resumos, oráculos e rotinas automáticas |
| `corpo/` | Corpo físico opcional (NeuroMechFly no MuJoCo) |
| `docs/MANUAL.md` | Manual: instalar, rodar, testar e reproduzir |
| `docs/publicacao/artigo.md` | O artigo |
| `docs/detalhes-tecnicos.md` | O registro técnico completo de cada parte |
| `docs/medicoes/` | Todas as medidas |

---

## Contribuir

O projeto é aberto a contribuições: experimentos, sentidos, comportamentos, desempenho, traduções, revisão do
artigo. Leia o **[guia de contribuição](CONTRIBUTING.md)**: a regra central é separar sempre o que vem do cérebro do
que é regra nossa, e escrever o critério antes de medir.

---

## Licença

Código sob a **[Apache License 2.0](LICENSE)**. Os dados do cérebro em `web/data/` são derivados do FlyEM Male CNS v1.0
(HHMI Janelia) e seguem a **CC-BY 4.0**; o código de `corpo/terceiros/` é do flygym (Apache 2.0). Ver [NOTICE](NOTICE).

---

## Créditos

- **Dados:** [FlyEM Male CNS v1.0](https://male-cns.janelia.org/), HHMI Janelia, licença CC-BY 4.0.
- **Modelo de neurônio:** Shiu et al. 2024, *A Drosophila computational brain model reveals sensorimotor processing*,
  Nature.
- **Corpo:** NeuroMechFly v2 e flygym, Wang-Chen et al. 2024, Nature Methods. O controlador em `corpo/terceiros/` é do
  repositório do flygym (Apache 2.0).
- **Aprendizado no corpo cogumelar:** Hige et al. 2015, Neuron; Aso et al. 2014, eLife; Felsenberg et al. 2018, Cell.
- **LC10a e direção:** Ribeiro et al. 2018, Cell; Hindmarsh Sten et al. 2021, Nature; Rayshubskiy et al. 2020, bioRxiv.
- Os sistemas de software são fictícios, e os defeitos foram plantados de propósito.

Autor: Jonnas Figueiredo.
