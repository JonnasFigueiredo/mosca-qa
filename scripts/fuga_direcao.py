"""Fuga, passo 1: o mapa sabe de onde vem a ameaça?

Com o campo receptivo de cada LPLC2 e LC4 (lc_campos.py, das sinapses do Janelia), liga só as células que
olham para uma parte do mundo, como uma ameaça crescendo ali, e mede os neurônios descendentes. Moscas reais
pulam para longe do lado de onde a ameaça vem (Card e Dickinson 2008), e os detectores de ameaça chegam à
fibra gigante e a outros descendentes com pesos que dependem de onde cada um olha (Dombrovski et al. 2023).

Faixas: frente, lado e trás (azimute, pelos terços de cada olho); em cima e embaixo (elevação). Frente/trás e
cima/baixo usam os dois olhos; o lado usa um olho de cada vez, para o índice lateral. Mesmo número de células
por faixa. Tônus de base da página.

Grava docs/medicoes/fuga-direcao.json.

uso: python fuga_direcao.py [taxa Hz] [repetições] [ms]
"""
import json
import sys
from pathlib import Path

import numpy as np

from mb import build, mbon_groups
from sim import run

RAIZ = Path(__file__).resolve().parent.parent
RATE = float(sys.argv[1]) if len(sys.argv) > 1 else 200
REPS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
T_MS = float(sys.argv[3]) if len(sys.argv) > 3 else 300

ann, sign, W, typ, cls = build()
side = np.load(RAIZ / "data/side.npy")
e = np.load(RAIZ / "data/edges.npz")
aprox, evitar = mbon_groups(typ, cls, e)
del e
bias = np.zeros(len(typ))
bias[np.isin(typ, aprox + evitar)] = 6.8
bias[np.isin(typ, ["DNa01", "DNa02", "DNa03"])] = 7.3
idx_de = {int(b): i for i, b in enumerate(ann.bodyId.to_numpy())}
campos = json.loads((RAIZ / "web/data/lc_campos.json").read_text(encoding="utf-8"))["tipos"]
cel = [dict(c, i=idx_de[c["body"]], tipo=t) for t in ("LPLC2", "LC4") for c in campos[t] if c["body"] in idx_de]
print(len(cel), "células LPLC2 + LC4 com campo", flush=True)

sup = ann.superclass.fillna("").to_numpy().astype(str)
dn = np.flatnonzero(sup == "descending_neuron")
dn_tipos = sorted(set(typ[dn]) - {""})
dn_idx = {(t, s): dn[(typ[dn] == t) & (side[dn] == s)] for t in dn_tipos for s in "LR"}
dn_idx = {k: v for k, v in dn_idx.items() if len(v)}


def taxas(stim):
    r = []
    for seed in range(REPS):
        c = run(W, np.asarray(stim, np.int64), t_ms=T_MS, rate_hz=RATE, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000, bias=bias)
        r.append({k: c[ix].sum() / (T_MS / 1000) / len(ix) for k, ix in dn_idx.items()})
    return {k: float(np.mean([x[k] for x in r])) for k in dn_idx}


rng = np.random.default_rng(0)
faixas = {s: {} for s in "LR"}
for s in "LR":
    cs = [c for c in cel if c["lado"] == s]
    az = np.array([c["az"] for c in cs]); el = np.array([c["el"] for c in cs])
    q1, q2 = np.quantile(az, [1 / 3, 2 / 3]); m = np.median(el)
    for nome, sel in (("frente", az >= q2), ("lado", (az >= q1) & (az < q2)), ("tras", az < q1), ("cima", el >= m), ("baixo", el < m)):
        faixas[s][nome] = [c["i"] for c, x in zip(cs, sel) if x]
k3 = min(len(faixas[s][n]) for s in "LR" for n in ("frente", "lado", "tras"))
k2 = min(len(faixas[s][n]) for s in "LR" for n in ("cima", "baixo"))
for s in "LR":
    for n in ("frente", "lado", "tras"):
        faixas[s][n] = rng.choice(faixas[s][n], k3, replace=False).tolist()
    for n in ("cima", "baixo"):
        faixas[s][n] = rng.choice(faixas[s][n], k2, replace=False).tolist()

base = taxas([])
res = {}
cond = {f"{n}_dois_olhos": faixas["L"][n] + faixas["R"][n] for n in ("frente", "lado", "tras", "cima", "baixo")}
cond.update({f"{n}_olho_E": faixas["L"][n] for n in ("frente", "lado", "tras")})
cond.update({f"{n}_olho_D": faixas["R"][n] for n in ("frente", "lado", "tras")})
for nome, stim in cond.items():
    res[nome] = taxas(stim)
    r = res[nome]
    sobe = {t: (r.get((t, "L"), 0) + r.get((t, "R"), 0)) / 2 - (base.get((t, "L"), 0) + base.get((t, "R"), 0)) / 2 for t in dn_tipos}
    top = sorted(sobe.items(), key=lambda kv: -kv[1])[:8]
    print(f"{nome:18s} n={len(stim):3d}  GF {sobe.get('DNp01', 0):6.1f}  " + ", ".join(f"{t} +{v:.0f}" for t, v in top if v > 1), flush=True)

out = {"taxa_hz": RATE, "repeticoes": REPS, "ms": T_MS, "celulas_por_faixa": {"azimute": k3, "elevacao": k2}, "condicoes": {}}
for nome, r in res.items():
    sobe = {t: round((r.get((t, "L"), 0) + r.get((t, "R"), 0)) / 2 - (base.get((t, "L"), 0) + base.get((t, "R"), 0)) / 2, 1) for t in dn_tipos}
    out["condicoes"][nome] = {"mais_sobem": dict(sorted(((t, v) for t, v in sobe.items() if v > 1), key=lambda kv: -kv[1])[:12]),
                              "E_menos_D": {t: round(r.get((t, "L"), 0) - r.get((t, "R"), 0), 1) for t in ("DNp01", "DNp02", "DNp04", "DNp06", "DNp11", "DNa02", "MDN") if (t, "L") in r}}
# lateral: ameaça à esquerda menos à direita, por tipo de DN (E − D)
lat = {}
for n in ("frente", "lado", "tras"):
    a, b = res[f"{n}_olho_E"], res[f"{n}_olho_D"]
    lat[n] = {t: round(((a.get((t, "L"), 0) - a.get((t, "R"), 0)) - (b.get((t, "L"), 0) - b.get((t, "R"), 0))) / 2, 1) for t in dn_tipos
              if abs((a.get((t, "L"), 0) - a.get((t, "R"), 0)) - (b.get((t, "L"), 0) - b.get((t, "R"), 0))) / 2 >= 3}
    print(f"lateral ({n}): positivo = mais do lado da ameaça:", dict(sorted(lat[n].items(), key=lambda kv: -abs(kv[1]))[:10]), flush=True)
out["lateral_ameaca_E_menos_D"] = lat
(RAIZ / "docs/medicoes/fuga-direcao.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em docs/medicoes/fuga-direcao.json", flush=True)
