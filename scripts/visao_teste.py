"""Visão, passo 1: o que a mosca vê com um olho consegue virá-la pelo mapa?

Liga uma família de neurônios de projeção visual (LC, LPLC, LLPC) só no olho esquerdo e depois
só no direito, e mede os neurônios de direção DNa01, DNa02 e DNa03 dos dois lados. Na mosca real,
DNa02 ativo de um lado vira a mosca para esse lado (Rayshubskiy et al. 2020).

índice lateral = [(E − D) com o olho esquerdo − (E − D) com o olho direito] / 2, em Hz por neurônio.
Positivo: a mosca viraria para o lado em que vê o objeto. Negativo: para o lado oposto.
Mesmas sementes nos dois olhos (comparação pareada). Mesmo modelo da página: ganho 0,5, sem
autapses, sem excitatórias PN/LN do lobo antenal, adaptação 0,3 mV / 1 s.

uso: python visao_teste.py [taxa Hz] [tônus DNs mV] [repetições] [ms] [famílias separadas por vírgula]
"""
import json
import sys
import time
from pathlib import Path

import numpy as np

from mb import build
from sim import run

RATE = float(sys.argv[1]) if len(sys.argv) > 1 else 100
DN_BIAS = float(sys.argv[2]) if len(sys.argv) > 2 else 7.3
REPS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
T_MS = float(sys.argv[4]) if len(sys.argv) > 4 else 500
ONLY = sys.argv[5].split(",") if len(sys.argv) > 5 else None
DNS = ["DNa01", "DNa02", "DNa03"]

ann, sign, W, typ, cls = build()
side = np.load(Path(__file__).resolve().parent.parent / "data/side.npy")
sup = ann.superclass.fillna("").to_numpy().astype(str)
bias = np.zeros(len(typ))
bias[np.isin(typ, DNS)] = DN_BIAS

vis = (sup == "visual_projection") & np.char.startswith(typ, "LC") | np.char.startswith(typ, "LPLC") | np.char.startswith(typ, "LLPC")
vis &= ~np.char.endswith(typ, "unclear")
fams = sorted(t for t in set(typ[vis]) if ((typ == t) & (side == "L")).sum() >= 5 and ((typ == t) & (side == "R")).sum() >= 5)
if ONLY:
    fams = [f for f in fams if f in ONLY]
dn_idx = {(t, s): np.flatnonzero((typ == t) & (side == s)) for t in DNS for s in "LR"}


def rates(stim, seed):
    c = run(W, stim, t_ms=T_MS, rate_hz=RATE, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000, bias=bias)
    return {k: c[ix].sum() / (T_MS / 1000) / max(1, len(ix)) for k, ix in dn_idx.items()}


def lr(r, t):
    return r[(t, "L")] - r[(t, "R")]


print(f"{len(fams)} famílias · {RATE:.0f} Hz · tônus DN {DN_BIAS} mV · {REPS} repetições de {T_MS:.0f} ms", flush=True)
base = [rates(np.array([], np.int64), s) for s in range(REPS)]
print("linha de base (sem estímulo): " + "  ".join(
    f"{t} E {np.mean([b[(t, 'L')] for b in base]):.1f} D {np.mean([b[(t, 'R')] for b in base]):.1f} Hz" for t in DNS), flush=True)

out = {"taxa_hz": RATE, "tonus_dn_mv": DN_BIAS, "repeticoes": REPS, "ms": T_MS, "familias": {}}
t0 = time.time()
for i, f in enumerate(fams):
    idx = {s: np.flatnonzero((typ == f) & (side == s)) for s in "LR"}
    res = {t: [] for t in DNS}
    tot = []
    for seed in range(REPS):
        rl, rr = rates(idx["L"], seed), rates(idx["R"], seed)
        for t in DNS:
            res[t].append((lr(rl, t) - lr(rr, t)) / 2)
        tot.append(sum((rl[(t, "L")] + rl[(t, "R")] + rr[(t, "L")] + rr[(t, "R")]) / 4 for t in DNS))
    row = {t: round(float(np.mean(v)), 2) for t, v in res.items()}
    row["n_por_olho"] = int(len(idx["L"]))
    row["dn_total_hz"] = round(float(np.mean(tot)), 1)
    out["familias"][f] = row
    eta = (time.time() - t0) / (i + 1) * (len(fams) - i - 1) / 60
    print(f"{f:8s} n={len(idx['L']):3d}  lateral DNa01 {row['DNa01']:+6.1f}  DNa02 {row['DNa02']:+6.1f}  "
          f"DNa03 {row['DNa03']:+6.1f} Hz   (faltam ~{eta:.0f} min)", flush=True)

dest = Path(__file__).resolve().parent.parent / "docs/medicoes/visao-triagem.json"
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print("salvo em", dest, flush=True)
