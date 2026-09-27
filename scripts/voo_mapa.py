"""Voo, passo 1: o mapa sustenta o voo comandado pelos motores das asas?

Liga, em voo, o que a mosca sente (halteres batendo, vento nas antenas) e mede os neurônios motores das asas por
tipo e lado: os de força (DLM, DVM, que movem a asa) e os de direção (b1, b2, b3, i1, i2, iii1, iii3, hg, ps, tp),
mais TTMn (o do salto de fuga), os descendentes de voo (DNg02), de pouso (DNp07, DNp10) e de fuga (DNp01).
Mesmo modelo e tônus da página. Perguntas:
  A. os halteres e o vento ligam os motores de voo?
  B. fluxo óptico de um lado (células HS) muda a direita e a esquerda nos motores de direção (resposta optomotora)?
  C. os halteres de um lado mais fortes (a mosca girando) mudam a direita e a esquerda (estabilização)?
  D. algo crescendo na frente (LPLC2, LC4) em voo liga o pouso (DNp07, DNp10), e parada, a fuga (DNp01)?
  E. um objeto de um lado (LC10a) em voo vira a mosca pelos motores de direção?

Grava docs/medicoes/voo-mapa.json.

uso: python voo_mapa.py [ms] [repetições]
"""
import json
import sys
from pathlib import Path

import numpy as np

from mb import build, mbon_groups
from sim import run

RAIZ = Path(__file__).resolve().parent.parent
T_MS = float(sys.argv[1]) if len(sys.argv) > 1 else 500
REPS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
ann, sign, W, typ, cls = build()
side = np.load(RAIZ / "data/side.npy")
e = np.load(RAIZ / "data/edges.npz")
aprox, evitar = mbon_groups(typ, cls, e)
del e
bias = np.zeros(len(typ))
bias[np.isin(typ, aprox + evitar)] = 6.8
bias[np.isin(typ, ["DNa01", "DNa02", "DNa03"])] = 7.3
sub = ann.subclass.fillna("").to_numpy().astype(str)
sup = ann.superclass.fillna("").to_numpy().astype(str)
root = ann.rootSide.fillna("").to_numpy().astype(str)
G = json.loads((RAIZ / "web/data/meta.json").read_text(encoding="utf-8"))["groups"]

# o que a mosca sente em voo
haltere = {s: np.flatnonzero((np.char.find(sub, "haltere") >= 0) & (np.char.find(sup, "sensory") >= 0) & (root == s)) for s in "LR"}
vento = np.array(G["gravidade_C"] + G["gravidade_E"])
hs = {s: np.flatnonzero(np.isin(typ, ["HSN", "HSE", "HSS"]) & (side == s)) for s in "LR"}
lc10 = {"L": np.array(G["olho_L"]), "R": np.array(G["olho_R"])}
ameaca = np.array(G["ameaca"])
print({"halteres": {s: len(v) for s, v in haltere.items()}, "vento": len(vento), "HS": {s: len(v) for s, v in hs.items()}}, flush=True)

# o que medir: motores das asas por tipo e lado, e descendentes
mot = np.flatnonzero(sub == "wm")
tipos_mot = sorted(set(typ[mot]) - {""})
medir = {(t, s): mot[(typ[mot] == t) & (side[mot] == s)] for t in tipos_mot for s in "LR"}
for t in ["DNg02_a", "DNg02_b", "DNg02_c", "DNp07", "DNp10", "DNp01", "DNp15"]:
    for s in "LR":
        medir[(t, s)] = np.flatnonzero((typ == t) & (side == s))
medir = {k: v for k, v in medir.items() if len(v)}


def taxas(entradas):
    """entradas: lista de (índices, Hz)."""
    idx = np.concatenate([np.asarray(i, np.int64) for i, _ in entradas]) if entradas else np.array([], np.int64)
    hz = np.concatenate([np.full(len(i), r, float) for i, r in entradas]) if entradas else np.array([])
    r = []
    for seed in range(REPS):
        c = run(W, idx, t_ms=T_MS, rate_hz=hz, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000, bias=bias)
        r.append({k: c[ix].sum() / (T_MS / 1000) / len(ix) for k, ix in medir.items()})
    return {k: round(float(np.mean([x[k] for x in r])), 1) for k in medir}


VOO = [(haltere["L"], 150), (haltere["R"], 150), (vento, 40)]
cond = {
    "parada": [],
    "voando": VOO,
    "voando_HS_esq": VOO + [(hs["L"], 100)],
    "voando_HS_dir": VOO + [(hs["R"], 100)],
    "voando_haltere_esq_forte": [(haltere["L"], 250), (haltere["R"], 100), (vento, 40)],
    "voando_haltere_dir_forte": [(haltere["L"], 100), (haltere["R"], 250), (vento, 40)],
    "voando_ameaca": VOO + [(ameaca, 200)],
    "parada_ameaca": [(ameaca, 200)],
    "voando_objeto_esq": VOO + [(lc10["L"], 100)],
    "voando_objeto_dir": VOO + [(lc10["R"], 100)],
}
res = {}
for nome, c in cond.items():
    res[nome] = taxas(c)
    ativos = {f"{t}_{s}": v for (t, s), v in res[nome].items() if v >= 1}
    print(f"{nome:26s}", ativos, flush=True)


def lateral(a, b):
    """(E − D) com o estímulo à esquerda menos (E − D) com ele à direita, por tipo, /2."""
    out = {}
    for t in sorted({t for t, _ in medir}):
        if (t, "L") in medir and (t, "R") in medir:
            v = ((res[a][(t, "L")] - res[a][(t, "R")]) - (res[b][(t, "L")] - res[b][(t, "R")])) / 2
            if abs(v) >= 1:
                out[t] = round(v, 1)
    return out


out = {"ms": T_MS, "repeticoes": REPS, "hz": {n: {f"{t}_{s}": v for (t, s), v in r.items()} for n, r in res.items()},
       "lateral": {"HS (fluxo óptico)": lateral("voando_HS_esq", "voando_HS_dir"),
                   "halteres (giro)": lateral("voando_haltere_esq_forte", "voando_haltere_dir_forte"),
                   "objeto (LC10a)": lateral("voando_objeto_esq", "voando_objeto_dir")}}
for k, v in out["lateral"].items():
    print("lateral", k, v, flush=True)
(RAIZ / "docs/medicoes/voo-mapa.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em docs/medicoes/voo-mapa.json", flush=True)
