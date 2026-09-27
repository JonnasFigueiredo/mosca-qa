"""Visão, passo 2: o mapa sabe ONDE, dentro do olho, está o objeto?

Com o campo receptivo de cada LC10a (lc_campos.py, das sinapses do Janelia), liga só as células que olham
para uma parte do olho (frente, meio ou lado/trás; em cima ou embaixo) e mede os neurônios de direção
DNa01-03, como em visao_teste.py. Numa mosca real, um objeto bem à frente quase não a faz virar (ela já
está apontada para ele) e um objeto de lado faz virar mais. Se o mapa carrega isso, as células da frente
devem dar um índice lateral menor que as de lado.

índice lateral = [(E − D) olhando com o olho esquerdo − (E − D) com o direito] / 2, Hz por neurônio DN.
Mesmas sementes nos dois olhos. Mesmo número de células em cada faixa (sorteio fixo).

uso: python visao_campo.py [taxa Hz] [tônus DNs mV] [repetições] [ms]
"""
import json
import sys
from pathlib import Path

import numpy as np

from mb import build
from sim import run

RAIZ = Path(__file__).resolve().parent.parent
RATE = float(sys.argv[1]) if len(sys.argv) > 1 else 100
DN_BIAS = float(sys.argv[2]) if len(sys.argv) > 2 else 7.3
REPS = int(sys.argv[3]) if len(sys.argv) > 3 else 3
T_MS = float(sys.argv[4]) if len(sys.argv) > 4 else 500
DNS = ["DNa01", "DNa02", "DNa03"]

ann, sign, W, typ, cls = build()
side = np.load(RAIZ / "data/side.npy")
idx_de = {int(b): i for i, b in enumerate(ann.bodyId.to_numpy())}
campos = json.loads((RAIZ / "web/data/lc_campos.json").read_text(encoding="utf-8"))["tipos"]["LC10a"]
cel = [dict(c, i=idx_de[c["body"]]) for c in campos if c["body"] in idx_de]
print(len(cel), "LC10a com campo;", sum(side[c["i"]] == c["lado"] for c in cel), "com o lado do corpo igual ao do lóbulo", flush=True)

bias = np.zeros(len(typ))
bias[np.isin(typ, DNS)] = DN_BIAS
dn_idx = {(t, s): np.flatnonzero((typ == t) & (side == s)) for t in DNS for s in "LR"}


def rates(stim, seed):
    c = run(W, np.asarray(stim, np.int64), t_ms=T_MS, rate_hz=RATE, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000, bias=bias)
    return {k: c[ix].sum() / (T_MS / 1000) / max(1, len(ix)) for k, ix in dn_idx.items()}


# faixas: terços do azimute e metades da elevação, em cada olho; mesmo número de células por faixa
faixas = {}
for lado in "LR":
    cs = [c for c in cel if c["lado"] == lado]
    az = np.array([c["az"] for c in cs]); el = np.array([c["el"] for c in cs])
    q1, q2 = np.quantile(az, [1 / 3, 2 / 3])
    m = np.median(el)
    for nome, sel in (("frente", az >= q2), ("meio", (az >= q1) & (az < q2)), ("lado_tras", az < q1),
                      ("cima", el >= m), ("baixo", el < m)):
        faixas.setdefault(nome, {})[lado] = [c["i"] for c, s in zip(cs, sel) if s]
rng = np.random.default_rng(0)
for nome in ("frente", "meio", "lado_tras"):
    k = min(len(faixas[f][s]) for f in ("frente", "meio", "lado_tras") for s in "LR")
    for s in "LR":
        faixas[nome][s] = rng.choice(faixas[nome][s], k, replace=False).tolist()
for nome in ("cima", "baixo"):
    k = min(len(faixas[f][s]) for f in ("cima", "baixo") for s in "LR")
    for s in "LR":
        faixas[nome][s] = rng.choice(faixas[nome][s], k, replace=False).tolist()

out = {"taxa_hz": RATE, "tonus_dn_mv": DN_BIAS, "repeticoes": REPS, "ms": T_MS, "faixas": {}}
for nome, f in faixas.items():
    res = {t: [] for t in DNS}
    for seed in range(REPS):
        rl, rr = rates(f["L"], seed), rates(f["R"], seed)
        for t in DNS:
            res[t].append(((rl[(t, "L")] - rl[(t, "R")]) - (rr[(t, "L")] - rr[(t, "R")])) / 2)
    row = {t: round(float(np.mean(v)), 2) for t, v in res.items()}
    row["dp_DNa02"] = round(float(np.std(res["DNa02"])), 2)
    row["celulas_por_olho"] = len(f["L"])
    out["faixas"][nome] = row
    print(f"{nome:10s} n={len(f['L']):3d}  lateral DNa01 {row['DNa01']:+6.1f}  DNa02 {row['DNa02']:+6.1f} (dp {row['dp_DNa02']:.1f})  "
          f"DNa03 {row['DNa03']:+6.1f} Hz", flush=True)

(RAIZ / "docs/medicoes/visao-campo.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print("salvo em docs/medicoes/visao-campo.json", flush=True)
