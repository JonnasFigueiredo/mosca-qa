# Mosca QA

*[Versão em português](README.md)*

**The complete connectome of a fruit fly, simulated in the browser, learning to look for software bugs.**

The entire central nervous system of a male *Drosophila melanogaster* (Male CNS v1.0, HHMI Janelia, 2026: 166,700
neurons and 6.2 million connections) runs as a network of integrate-and-fire neurons, in a 3D body that walks, flies,
sees with compound eyes and smells with its antennae. Each action of a fictional software system becomes an odor; each
bug found releases reward dopamine. The question: does the brain learn the "smell" of a kind of bug and start looking
for it in parts of the system it has never seen?

> **[Opening video]** *Placeholder: the fly in the 3D arena smelling the plaques and finding a bug, with the brain
> lighting up beside it (30–60 s).*

> **[Photo 1]** *Placeholder: the 3D brain with its 166,700 neurons.*

---

## Results

| Experiment | What happened |
|---|---|
| **Brain without a body** (odor delivered straight to the antennae) | The trained fly found bugs of the learned kind, in new parts of the system, **5 to 7 actions earlier** than the same fly without learning. Replicated with independent seeds, robust to a 3-minute delay and to another kind of bug, and significant after correction for 16 comparisons. |
| **Fly with a body** (walks and smells in a 3D arena) | The same training made the fly **choose actions of the rewarded kind more often** in new parts (+10 percentage points, p < 0.001, 16 of 20 seeds). Time to the first bug did not drop measurably. |

Every criterion was written and committed **before** each measurement, and negative results are reported with their
causes. Details in the [paper](docs/publicacao/artigo.en.md).

> **[Photo 2]** *Placeholder: chart of the main result (actions until the first bug, trained × frozen).*

---

## What comes from the brain and what is a rule we wrote

| From the connectome (emerges from the measured wiring) | Our rule (declared) |
|---|---|
| Turning toward what it sees (LC10a → DNa01–03) | Software actions represented as odors |
| Extending the proboscis with sugar on the legs | Reading memory at the mushroom body outputs and choosing by softmax |
| Escape through the giant fiber and its direction | Leg stepping, hunger, flight height and landing |
| Flight through the wing motor neurons, stabilized by the halteres | In the arena, the path to the next plaque |
| Learning: dopamine depresses Kenyon cell → output synapses | Memory time courses (forgetting, consolidation, extinction) |

The circuit and the learning rule are the fly's; the neuron is simplified (one compartment) and memory time courses are
approximate. We do not claim the model is a fly.

> **[Photo 3]** *Placeholder: the fly in the 3D kitchen ("Olhos dela" or side-by-side view).*

---

## Running

The full step-by-step guide (requirements, validation tests, reproducing the measurements, common problems) is in the
**[manual](docs/MANUAL.en.md)**. The essentials: Python 3.12 and Node.js 22 or newer.

```bash
python scripts/servir.py
```

Open **http://localhost:8765** (the fly page) or **http://localhost:8765/caca.html** (live bug hunt, with the 3D brain
and the panel). The brain takes about 20 s to load. Always use `servir.py` (HTTP/1.1, no cache), one server per port.

Arena with the measurement parameters: `http://localhost:8765/caca.html?arena=1&esquecimento=3600`.

**Physical body (optional):** NeuroMechFly in MuJoCo, in a separate Python environment (`corpo/requirements.txt`; see
the manual, section 7).

The code, page and most documentation are in Portuguese. Commands and file names are the same in both languages.

---

## Reproducing the measurements

| Measurement | Command |
|---|---|
| Series without a body | `node scripts/qa_abstrato.mjs --bancada 2 --sementes 51,52 --cheiros docs/medicoes/qa-cheiros-fortes.json --saida docs/medicoes/X.json` |
| Paired summary (95% CI, p, dz) | `node scripts/qa_resumo.mjs --prefixo X` |
| Holm correction | `node scripts/qa_comparacoes.mjs` |
| Conditioning with a body | `node scripts/qa_condicionamento.mjs --cond ativa --esquecimento 3600` |
| Series with a body (arena) | `node scripts/madrugada_mundo.mjs --arena --n 20 --paralelos 2` |

Every measurement is in `docs/medicoes/*.json`, with its method inside. The chronological lab diary, with criteria
written beforehand, is in [docs/plano-treino-robusto.md](docs/plano-treino-robusto.md) (Portuguese).

---

## Structure

| Path | Contents |
|---|---|
| `web/index.html` | The page: the fly, the senses, reading the brain outputs, body rules |
| `web/sim-worker.js` | The brain: event-driven simulation and mushroom body learning |
| `web/sandbox.js` | The 3D world: kitchen, flight, real eyes, physical body |
| `web/caca-mundo.js`, `web/caca.html` | The bug hunt in the 3D world and the live screen |
| `web/qa/pedidos.js` | The Orders system, its bugs and contracts |
| `web/data/` | The connectome packed for the browser (~32 MB) |
| `scripts/` | Data generation, series, summaries, oracles and automated routines |
| `corpo/` | Optional physical body (NeuroMechFly in MuJoCo) |
| `docs/MANUAL.en.md` | Manual: install, run, test and reproduce |
| `docs/publicacao/artigo.en.md` | The paper |
| `docs/detalhes-tecnicos.md` | Full technical record of every part (Portuguese) |
| `docs/medicoes/` | All measurements |

---

## Contributing

The project is open to contributions: experiments, senses, behaviors, performance, translations, paper review. Read the
**[contributing guide](CONTRIBUTING.en.md)**: the central rule is to always separate what comes from the brain from what
is our rule, and to write the criterion before measuring.

---

## License

Code under the **[Apache License 2.0](LICENSE)**. Brain data in `web/data/` are derived from FlyEM Male CNS v1.0 (HHMI
Janelia) and follow **CC-BY 4.0**; the code in `corpo/terceiros/` is from flygym (Apache 2.0). See [NOTICE](NOTICE).

---

## Credits

- **Data:** [FlyEM Male CNS v1.0](https://male-cns.janelia.org/), HHMI Janelia, CC-BY 4.0.
- **Neuron model:** Shiu et al. 2024, *A Drosophila computational brain model reveals sensorimotor processing*, Nature.
- **Body:** NeuroMechFly v2 and flygym, Wang-Chen et al. 2024, Nature Methods. The controller in `corpo/terceiros/` is
  from the flygym repository (Apache 2.0).
- **Mushroom body learning:** Hige et al. 2015, Neuron; Aso et al. 2014, eLife; Felsenberg et al. 2018, Cell.
- **LC10a and steering:** Ribeiro et al. 2018, Cell; Hindmarsh Sten et al. 2021, Nature; Rayshubskiy et al. 2020,
  bioRxiv.
- The software systems are fictional, and the bugs were planted on purpose.

Author: Jonnas Figueiredo.
