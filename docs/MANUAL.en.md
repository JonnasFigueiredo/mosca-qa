# Manual: install, run and test

*[Versão em português](MANUAL.md)*

This guide goes from zero to running the fly, validating the installation and reproducing the paper's measurements.
Code, page texts and most documentation are in Portuguese; commands and file names are the same in both languages.

---

## 1. Requirements

| What | Version | Used for |
|---|---|---|
| Git | any | cloning the repository |
| Python | 3.12 | page server and data scripts |
| Node.js | 22 or newer | headless simulations and summaries |
| Google Chrome | current | running the page headless in the embodied measurements |
| RAM | 4 GB free per brain | each simulated brain uses 1.5–2 GB |

Works on Windows, Linux and macOS. On Linux and macOS, tell the scripts where Chrome is:

```bash
export CHROME_PATH=/usr/bin/google-chrome        # Linux (or /usr/bin/chromium)
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # macOS
export PYTHON=python3                            # if the "python" command does not exist
```

---

## 2. Get the code

```bash
git clone https://github.com/JonnasFigueiredo/mosca-qa.git
cd mosca-qa
```

The packed brain (`web/data/`, ~32 MB) is included. You do not need the raw connectome to use the project.

---

## 3. See the fly

```bash
python scripts/servir.py
```

| Address | What it shows |
|---|---|
| http://localhost:8765 | The fly page: 3D brain, software systems, Kitchen, flight, praying mantis |
| http://localhost:8765/caca.html | Live bug hunt: fly, 3D brain and panel side by side |
| http://localhost:8765/caca.html?arena=1&esquecimento=3600 | The arena with the parameters of the embodied measurements |

The brain takes about 20 s to load. In the live bug hunt, pick the condition (trained or frozen) and click **Iniciar**
(Start): training takes 20–30 min and the test follows.

Always use `scripts/servir.py` (HTTP/1.1, no cache) and **one server per port**. If something looks stale, reload with
Ctrl+Shift+R.

---

## 4. Validate the installation (5–15 min)

| Test | Command | Expected |
|---|---|---|
| Brain in Node | `node scripts/worker_teste.mjs web/sim-worker.js 4` | firing rates per neuron group, no errors |
| Orders system | `node scripts/qa_pedidos_teste.mjs` | no false alarm on the correct version |
| Learning (no body) | `node scripts/t0_cerebro.mjs 29` | valence of the paired odor rises; the unpaired one does not (rewrites `docs/medicoes/t0-cerebro.json`; `git checkout` restores it) |
| Learning with body | `node scripts/qa_condicionamento.mjs --cond ativa --esquecimento 3600 --semente 11` | `mudanca_20s` around +0.8 (with `--cond congelada`, around 0) |

The last one needs the page server running (step 3).

---

## 5. Reproduce the paper's measurements

**Without a body** (brain only, in Node; ~1 h for a small series):

```bash
node scripts/qa_abstrato.mjs --bancada 2 --sementes 51,52,53,54,55 --cheiros docs/medicoes/qa-cheiros-fortes.json --saida docs/medicoes/my-series.json
node scripts/qa_resumo.mjs --prefixo my-series
```

The summary gives the paired difference (trained − frozen), the bootstrap 95% CI, p and dz. The paper's series use 16
seeds; with 5, the interval is wide.

**With a body** (the fly in the 3D arena; each session takes 1.5–3.5 h):

```bash
node scripts/madrugada_mundo.mjs --arena --n 20 --paralelos 2
```

The routine freezes a copy of the page, runs trained × frozen pairs, summarizes and logs the result. Use
`--paralelos 1` if the computer gets slow, up to 4 if it is free. Disable automatic sleep during a series.

**More tools:** `scripts/qa_oraculo.mjs` (validates the task without a brain, before spending simulation time),
`scripts/qa_comparacoes.mjs` (Holm correction), `scripts/qa_linha_base.mjs` (classic learner with the same
information).

---

## 6. Where results go

- `docs/medicoes/*.json`: every measurement, with a `metodo` field describing how it was made.
- `docs/plano-treino-robusto.md`: the lab diary, with each series' criterion written before running.
- `docs/publicacao/artigo.en.md`: the paper (English); `artigo.md` is the Portuguese original.
- `docs/detalhes-tecnicos.md`: the technical record of every part (in Portuguese).

---

## 7. Physical body (optional)

The body with physics (NeuroMechFly in MuJoCo) runs in a separate Python environment:

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r corpo/requirements.txt     # Windows
.venv/bin/python -m pip install -r corpo/requirements.txt         # Linux/macOS
.venv/Scripts/python -X utf8 corpo/servidor.py 8766
```

On the page, turn on **Corpo físico** (physical body). If pip cannot find `flygym==2.1.0`, install it from the flygym
repository.

---

## 8. Rebuild the brain data (optional)

1. Download from https://male-cns.janelia.org/download/ into `data/raw/`:
   `body-annotations-male-cns-v1.0-minconf-0.5.feather`, `body-neurotransmitters-male-cns-v1.0.feather` and
   `connectome-weights-male-cns-v1.0-minconf-0.5.feather` (1.1 GB).
2. `pip install -r requirements.txt`
3. Inside `scripts/`: `python 01_filter_edges.py` and `python 02_build_web.py`.

---

## 9. Common problems

| Symptom | Cause and fix |
|---|---|
| "network error" or "Failed to fetch" while loading the brain | wrong server or two servers on one port: use only `scripts/servir.py` |
| The page does not change after an edit | browser cache: Ctrl+Shift+R |
| A Chrome script does not open the page (Linux/macOS) | set `CHROME_PATH` (step 1) |
| Computer freezing | fewer brains at once (`--paralelos 1`); each uses 1.5–2 GB |
| Sessions with "passou do tempo limite" (time limit exceeded) | the computer slept or got slow: disable sleep and run fewer in parallel |
| Long-path errors on Windows | clone into a short folder (for example `C:\mq`) |
