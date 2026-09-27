"""Escalada, passo 3: o cérebro sente a gravidade e isso a vira?

A mosca sente a gravidade pelas antenas: o 3º segmento (funículo) pende e deflete, e os neurônios das zonas
C e E do órgão de Johnston (JO-C, JO-E; subclasse vento/gravidade no mapa) respondem a deflexões em
direções opostas (Kamikouchi et al. 2009). Aqui, a zona C de um lado e a E do outro imitam a mosca de lado
numa parede (as duas antenas defletem em sentidos opostos); as duas zonas C, ou as duas E, imitam cabeça
para cima ou para baixo.

Mede os neurônios descendentes, com o tônus de base da página. Índice lateral = [(E − D) com C esq. + E dir.
− (E − D) com E esq. + C dir.] / 2, Hz por neurônio. Grava docs/medicoes/gravidade-antenas.json.

uso: python gravidade_teste.py [taxa Hz] [repetições] [ms]
"""
import json
import sys
from pathlib import Path

import numpy as np

from mb import build, mbon_groups
from sim import run

RAIZ = Path(__file__).resolve().parent.parent
RATE = float(sys.argv[1]) if len(sys.argv) > 1 else 40
REPS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
T_MS = float(sys.argv[3]) if len(sys.argv) > 3 else 500

ann, sign, W, typ, cls = build()
side = np.load(RAIZ / "data/side.npy")
e = np.load(RAIZ / "data/edges.npz")
aprox, evitar = mbon_groups(typ, cls, e)
del e
bias = np.zeros(len(typ))
bias[np.isin(typ, aprox + evitar)] = 6.8
bias[np.isin(typ, ["DNa01", "DNa02", "DNa03"])] = 7.3

sub = ann.subclass.fillna("").to_numpy().astype(str)
root = ann.rootSide.fillna("").to_numpy().astype(str)
sup = ann.superclass.fillna("").to_numpy().astype(str)
grav = sub == "wind_gravity"
zona = {z: {s: np.flatnonzero(grav & np.char.startswith(typ, f"JO-{z}") & (root == s)) for s in "LR"} for z in "CE"}
print({z: {s: len(v) for s, v in d.items()} for z, d in zona.items()}, flush=True)
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


cond = {
    "base": [],
    "C_dos_dois_lados": np.r_[zona["C"]["L"], zona["C"]["R"]],
    "E_dos_dois_lados": np.r_[zona["E"]["L"], zona["E"]["R"]],
    "C_esq_E_dir": np.r_[zona["C"]["L"], zona["E"]["R"]],
    "E_esq_C_dir": np.r_[zona["E"]["L"], zona["C"]["R"]],
}
res = {}
for nome, stim in cond.items():
    res[nome] = taxas(stim)
    print(nome, "pronto", flush=True)

b = res["base"]
out = {"taxa_hz": RATE, "repeticoes": REPS, "ms": T_MS, "neuronios": {z: {s: int(len(v)) for s, v in d.items()} for z, d in zona.items()},
       "condicoes": {}}
for nome, r in res.items():
    if nome == "base":
        continue
    tipos = sorted({t for t, _ in r})
    sobe = {t: (r.get((t, "L"), 0) + r.get((t, "R"), 0)) / 2 - (b.get((t, "L"), 0) + b.get((t, "R"), 0)) / 2 for t in tipos}
    top = {t: round(v, 1) for t, v in sorted(sobe.items(), key=lambda kv: -kv[1])[:10] if v > 0.5}
    out["condicoes"][nome] = {"mais_sobem": top, "MDN_hz": round((r[("MDN", "L")] + r[("MDN", "R")]) / 2, 2),
                              "DNa02_E_D": [round(r[("DNa02", "L")], 1), round(r[("DNa02", "R")], 1)]}
    print(nome, out["condicoes"][nome], flush=True)
lat = {t: round((((res["C_esq_E_dir"][(t, "L")] - res["C_esq_E_dir"][(t, "R")])
                  - (res["E_esq_C_dir"][(t, "L")] - res["E_esq_C_dir"][(t, "R")])) / 2), 2) for t in ("DNa01", "DNa02", "DNa03", "MDN")}
out["lateral_C_esq_menos_E_esq"] = lat
print("índice lateral (positivo: vira para o lado da zona C):", lat, flush=True)
(RAIZ / "docs/medicoes/gravidade-antenas.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em docs/medicoes/gravidade-antenas.json", flush=True)
