# Manual: instalar, rodar e testar

*[English version](MANUAL.en.md)*

Este guia leva do zero até rodar a mosca, validar a instalação e reproduzir as medidas do artigo.

---

## 1. Requisitos

| O quê | Versão | Para quê |
|---|---|---|
| Git | qualquer | baixar o repositório |
| Python | 3.12 | servidor da página e scripts de dados |
| Node.js | 22 ou mais | simulações sem janela e resumos |
| Google Chrome | atual | rodar a página sem janela nas medidas com corpo |
| RAM | 4 GB livres por cérebro | cada cérebro simulado usa 1,5–2 GB |

Funciona em Windows, Linux e macOS. No Linux e no macOS, informe onde está o Chrome:

```bash
export CHROME_PATH=/usr/bin/google-chrome        # Linux (ou /usr/bin/chromium)
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # macOS
export PYTHON=python3                            # se o comando "python" não existir
```

---

## 2. Baixar

```bash
git clone https://github.com/JonnasFigueiredo/mosca-qa.git
cd mosca-qa
```

O cérebro empacotado (`web/data/`, ~32 MB) já vem no repositório. Não é preciso baixar o conectoma bruto para usar.

---

## 3. Ver a mosca

```bash
python scripts/servir.py
```

| Endereço | O que mostra |
|---|---|
| http://localhost:8765 | A página da mosca: cérebro 3D, sistemas de software, Cozinha, voo, louva-a-deus |
| http://localhost:8765/caca.html | A caça a bugs ao vivo: mosca, cérebro 3D e painel lado a lado |
| http://localhost:8765/caca.html?arena=1&esquecimento=3600 | A arena com os parâmetros das medidas com corpo |

O cérebro leva uns 20 s para carregar. Na caça a bugs ao vivo, escolha a condição (treinada ou congelada) e clique em
**Iniciar**: o treino leva 20–30 min e o teste começa logo depois.

Use sempre o `scripts/servir.py` (HTTP/1.1, sem cache) e **um servidor por porta**. Se algo parecer desatualizado,
recarregue com Ctrl+Shift+R.

---

## 4. Validar a instalação (5–15 min)

| Teste | Comando | O que esperar |
|---|---|---|
| Cérebro no Node | `node scripts/worker_teste.mjs web/sim-worker.js 4` | taxas de disparo por grupo de neurônios, sem erros |
| Sistema de Pedidos | `node scripts/qa_pedidos_teste.mjs` | nenhum alarme falso na versão correta |
| Aprendizado (sem corpo) | `node scripts/t0_cerebro.mjs 29` | a valência do cheiro pareado sobe; a do não pareado, não (regrava `docs/medicoes/t0-cerebro.json`; `git checkout` volta o original) |
| Aprendizado com corpo | `node scripts/qa_condicionamento.mjs --cond ativa --esquecimento 3600 --semente 11` | `mudanca_20s` em torno de +0,8 (com `--cond congelada`, em torno de 0) |

O último precisa do servidor da página rodando (passo 3).

---

## 5. Reproduzir as medidas do artigo

**Sem corpo** (só o cérebro, no Node; ~1 h por série pequena):

```bash
node scripts/qa_abstrato.mjs --bancada 2 --sementes 51,52,53,54,55 --cheiros docs/medicoes/qa-cheiros-fortes.json --saida docs/medicoes/minha-serie.json
node scripts/qa_resumo.mjs --prefixo minha-serie
```

O resumo traz a diferença pareada (treinada − congelada), o IC95 por bootstrap, o p e o dz. As séries do artigo usam
16 sementes; com 5, o intervalo fica largo.

**Com corpo** (a mosca na arena 3D; cada sessão leva 1,5–3,5 h):

```bash
node scripts/madrugada_mundo.mjs --arena --n 20 --paralelos 2
```

A rotina congela uma cópia da página, roda os pares treinada × congelada, resume e anota o resultado. Use
`--paralelos 1` se o computador ficar lento, até 4 se ele estiver livre. Desative a suspensão automática do sistema
durante a série.

**Mais ferramentas:** `scripts/qa_oraculo.mjs` (valida a bancada sem cérebro, antes de gastar simulação),
`scripts/qa_comparacoes.mjs` (correção de Holm), `scripts/qa_linha_base.mjs` (aprendiz clássico com as mesmas
informações).

---

## 6. Onde ficam os resultados

- `docs/medicoes/*.json`: cada medida, com o campo `metodo` explicando como foi feita.
- `docs/plano-treino-robusto.md`: o diário, com o critério de cada série escrito antes de rodar.
- `docs/publicacao/artigo.md`: o artigo.
- `docs/detalhes-tecnicos.md`: o registro técnico de cada parte (sentidos, corpo, mundos, calibrações).

---

## 7. Corpo físico (opcional)

O corpo com física (NeuroMechFly no MuJoCo) roda num ambiente Python separado:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r corpo/requirements.txt     # Windows
.venv/bin/python -m pip install -r corpo/requirements.txt         # Linux/macOS
.venv/Scripts/python -X utf8 corpo/servidor.py 8766
```

Na página, ligue **Corpo físico**. Se o pip não encontrar o `flygym==2.1.0`, instale pelo repositório do flygym.

---

## 8. Refazer os dados do cérebro (opcional)

1. Baixe de https://male-cns.janelia.org/download/ para `data/raw/`:
   `body-annotations-male-cns-v1.0-minconf-0.5.feather`, `body-neurotransmitters-male-cns-v1.0.feather` e
   `connectome-weights-male-cns-v1.0-minconf-0.5.feather` (1,1 GB).
2. `pip install -r requirements.txt`
3. Dentro de `scripts/`: `python 01_filter_edges.py` e `python 02_build_web.py`.

---

## 9. Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| "network error" ou "Failed to fetch" ao carregar o cérebro | servidor errado ou dois servidores na mesma porta: use só o `scripts/servir.py` |
| A página parece não mudar depois de uma edição | cache do navegador: Ctrl+Shift+R |
| Script com Chrome não abre a página (Linux/macOS) | defina `CHROME_PATH` (passo 1) |
| Computador travando | menos cérebros ao mesmo tempo (`--paralelos 1`); cada um usa 1,5–2 GB |
| Sessões com "passou do tempo limite" | o computador suspendeu ou ficou lento: desative a suspensão e rode menos em paralelo |
| Erros de caminho longo no Windows | clone o repositório numa pasta curta (por exemplo `C:\mq`) |
