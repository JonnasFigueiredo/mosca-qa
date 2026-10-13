# Contributing

*[Versão em português](CONTRIBUTING.md)*

Contributions are welcome: fixes, new experiments, new senses or behaviors, performance improvements, translations and
reviews of the paper. One rule comes before all others: **scientific honesty**. The page, the documentation and the
paper always say what comes from the brain (the connectome) and what is a rule we wrote.

## Before you start

1. Read the [manual](docs/MANUAL.en.md) and run the validation tests (section 4).
2. Read "What comes from the brain and what is a rule" in the [README](README.en.md) and the
   [paper](docs/publicacao/artigo.en.md).
3. For large changes, open an issue describing the idea before writing code.

## Project rules

- **From the map or a rule?** Every behavior change answers this question. First, test in the simulator whether the
  connectome supports the behavior (screening, as in `scripts/voo_mapa.py`). Whatever the map does not support becomes
  a **declared rule**, on the page and in `docs/detalhes-tecnicos.md`.
- **Do not tune the brain to get a result.** Changes to model parameters (gain, tone, learning, forgetting) need a
  justification independent of the result and are declared in the paper.
- **Criterion before measurement.** A new experiment has its criterion written in `docs/plano-treino-robusto.md` and
  committed **before** running, with the seeds defined. Validate first with short tests (brain-free oracle,
  conditioning) and only then run long series.
- **Controls and replication.** Always compare against the frozen-weights brain, paired by seed. A positive result only
  counts if it replicates with new seeds.
- **Negative results are published** with the same detail as positive ones, with the cause when it is found.
- **Measurements** go to `docs/medicoes/*.json` (Portuguese names, no accents), with the method in the `metodo` field.

## Code

- Comments, page texts and documentation are in Portuguese. English translations are welcome in `*.en.md` files.
- Follow the style of the file you are editing: names, comment density and format.
- `web/index.html` uses CRLF line endings.
- Temporary files start with `_` (ignored by git). Large data goes to `data/` (outside git).
- To check that a brain optimization does not change behavior, compare `node scripts/worker_teste.mjs` before and after.

## How to submit

1. Fork the repository and create a branch from `main`.
2. Make small commits with short, imperative messages.
3. Open a pull request explaining what changes, whether it comes from the map or is a rule, and how you tested it.

## License

By contributing, you agree that your contribution is licensed under the Apache License 2.0 (see [LICENSE](LICENSE)).
Data derived from Male CNS v1.0 follow CC-BY 4.0 (see [NOTICE](NOTICE)).
