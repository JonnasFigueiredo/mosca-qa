"""Tato, passo 2: o que cada sensor de cada pata faz nos neurônios descendentes?

Liga, numa pata de cada vez, um tipo de sensor mecânico e mede todos os neurônios descendentes (DN),
com o mesmo tônus de base da página (DNa01-03 a 7,3 mV, saídas do corpo cogumelar a 6,8 mV). Tipos:
- cerdas_15: as cerdas táteis que a página usa (uma a cada 7, ~15%);
- cerdas_todas: todas as cerdas táteis daquela pata (um tropeço, uma batida);
- cordotonal: órgão cordotonal (movimento e posição das juntas);
- carga: placas de pelos e sensilas campaniformes (limite das juntas e carga na cutícula).

Para cada pata: os tipos de DN que mais sobem em relação à linha de base, e o índice lateral dos que
viram a mosca (DNa01-03) e dos que a fazem andar de ré (MDN):
índice lateral = [(E − D) tocando a pata esquerda − (E − D) tocando a direita] / 2, em Hz por neurônio.
Positivo: vira para o lado tocado (DNa) / mais MDN do lado tocado.

uso: python tato_teste.py [taxa Hz] [repetições] [ms]
"""
import json
import sys
import time
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
del e   # pouca memória: a tabela de conexões inteira só serve para achar as MBONs
bias = np.zeros(len(typ))
bias[np.isin(typ, aprox + evitar)] = 6.8
bias[np.isin(typ, ["DNa01", "DNa02", "DNa03"])] = 7.3

sup = ann.superclass.fillna("").to_numpy().astype(str)
sub = ann.subclass.fillna("").to_numpy().astype(str)
nerv = ann.entryNerve.fillna("").to_numpy().astype(str)
root = ann.rootSide.fillna("").to_numpy().astype(str)
dn = np.flatnonzero(sup == "descending_neuron")
dn_tipos = sorted(set(typ[dn]) - {""})
dn_idx = {(t, s): dn[(typ[dn] == t) & (side[dn] == s)] for t in dn_tipos for s in "LR"}


def sensores(perna, lado, tipo):
    m = (nerv == perna) & (root == lado)
    if tipo in ("cerdas_15", "cerdas_todas"):
        ix = np.flatnonzero(m & (cls == "mechanosensory_tactile"))
        return ix[::7] if tipo == "cerdas_15" else ix
    if tipo == "cordotonal":
        return np.flatnonzero(m & (sub == "chordotonal organ"))
    return np.flatnonzero(m & np.isin(sub, ["hair plate", "campaniform sensilla"]))


def taxas(stim, seed):
    c = run(W, stim, t_ms=T_MS, rate_hz=RATE, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000, bias=bias)
    return {k: c[ix].sum() / (T_MS / 1000) / max(1, len(ix)) for k, ix in dn_idx.items() if len(ix)}


print(f"{len(dn_tipos)} tipos de DN · {RATE:.0f} Hz · {REPS} repetições de {T_MS:.0f} ms", flush=True)
base = [taxas(np.array([], np.int64), s) for s in range(REPS)]
b0 = {k: np.mean([b[k] for b in base]) for k in base[0]}
print("linha de base: DNa02 E %.1f D %.1f · MDN E %.1f D %.1f · DNp01 %.1f Hz" % (
    b0[("DNa02", "L")], b0[("DNa02", "R")], b0[("MDN", "L")], b0[("MDN", "R")], (b0[("DNp01", "L")] + b0[("DNp01", "R")]) / 2), flush=True)

out = {"taxa_hz": RATE, "repeticoes": REPS, "ms": T_MS, "linha_de_base": {f"{t}_{s}": round(float(v), 2) for (t, s), v in b0.items() if v > 0.5},
       "pernas": {}}
t0 = time.time()
for perna, nome in (("ProLN", "frente"), ("MesoLN", "meio"), ("MetaLN", "tras")):
    for tipo in ("cerdas_15", "cerdas_todas", "cordotonal", "carga"):
        ix = {s: sensores(perna, s, tipo) for s in "LR"}
        if min(len(v) for v in ix.values()) == 0:
            continue
        rl = [taxas(ix["L"], s) for s in range(REPS)]
        rr = [taxas(ix["R"], s) for s in range(REPS)]
        mL = {k: np.mean([r[k] for r in rl]) for k in b0}
        mR = {k: np.mean([r[k] for r in rr]) for k in b0}

        def lat(t):
            return ((mL[(t, "L")] - mL[(t, "R")]) - (mR[(t, "L")] - mR[(t, "R")])) / 2

        # subida média por tipo de DN (os dois lados, as duas pernas), em relação à linha de base
        sobe = {t: ((mL[(t, "L")] + mL[(t, "R")] + mR[(t, "L")] + mR[(t, "R")]) / 4 - (b0[(t, "L")] + b0[(t, "R")]) / 2)
                for t in dn_tipos if (t, "L") in b0 and (t, "R") in b0}
        top = sorted(sobe.items(), key=lambda kv: -kv[1])[:8]
        row = {"sensores_por_perna": int(len(ix["L"])),
               "lateral": {t: round(float(lat(t)), 2) for t in ("DNa01", "DNa02", "DNa03", "MDN")},
               "DNp01_hz": round(float((mL[("DNp01", "L")] + mL[("DNp01", "R")] + mR[("DNp01", "L")] + mR[("DNp01", "R")]) / 4), 2),
               "MDN_hz": round(float((mL[("MDN", "L")] + mL[("MDN", "R")] + mR[("MDN", "L")] + mR[("MDN", "R")]) / 4), 2),
               "mais_sobem": {t: round(float(v), 1) for t, v in top if v > 0.5}}
        out["pernas"].setdefault(nome, {})[tipo] = row
        print(f"{nome:6s} {tipo:12s} n={len(ix['L']):4d}  lateral DNa02 {row['lateral']['DNa02']:+6.1f}  MDN {row['lateral']['MDN']:+5.1f} "
              f"(MDN {row['MDN_hz']:.1f} Hz, DNp01 {row['DNp01_hz']:.1f} Hz)  sobem: "
              + ", ".join(f"{t} +{v:.0f}" for t, v in row["mais_sobem"].items())
              + f"   ({time.time() - t0:.0f} s)", flush=True)

(RAIZ / "docs/medicoes/tato-pernas.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em docs/medicoes/tato-pernas.json", flush=True)
