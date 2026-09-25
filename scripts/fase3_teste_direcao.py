"""Fase 3, passo 2: a memória do corpo cogumelar consegue virar a mosca pelos circuitos do mapa?

Cheiro só numa antena. Mede, repetição por repetição, a diferença esquerda − direita dos neurônios
de direção (DNa02 + DNa03) e a atividade do MDN (andar de ré), em três situações:
  ingênua   : sinapses originais
  com dor   : Kenyon -> MBON "aproximar" enfraquecidas para as células que o cheiro acende
  com açúcar: Kenyon -> MBON "evitar" (da recompensa) enfraquecidas para essas mesmas células
Usa o mesmo modelo da página (ganho 0,5, sem autapses, sem excitatórias PN/LN do lobo antenal,
adaptação 0,3 mV/1 s, MBONs com tônus de 6,8 mV) e dá tônus aos neurônios de direção e de ré,
que numa mosca andando disparam o tempo todo.

uso: python fase3_teste_direcao.py [glomérulos] [tônus dos DNs em mV] [fator] [lado do cheiro] [repetições]
"""
import sys

import numpy as np
import scipy.sparse as sp

from mb import build, mbon_groups
from sim import run

ODOR = sys.argv[1].split(",") if len(sys.argv) > 1 else ["DP1m", "DC2", "DA4l"]
DN_BIAS = float(sys.argv[2]) if len(sys.argv) > 2 else 7.3
FACTOR = float(sys.argv[3]) if len(sys.argv) > 3 else 0.15
ODOR_SIDE = sys.argv[4] if len(sys.argv) > 4 else "L"
REPS = int(sys.argv[5]) if len(sys.argv) > 5 else 12
RATE, T_MS = 150, 1000

ann, sign, W, typ, cls = build()
side = np.load("../data/side.npy")
e = np.load("../data/edges.npz")
aprox, evitar = mbon_groups(typ, cls, e)
REW_PAM = ["PAM01", "PAM02", "PAM03", "PAM04", "PAM05", "PAM06", "PAM08", "PAM11", "PAM15"]
is_rew = np.isin(typ, REW_PAM)
rew_targets = [t for t in evitar
               if e["w"][np.isin(e["post"], np.flatnonzero(typ == t)) & is_rew[e["pre"]]].sum() >= 100]

kc = np.char.startswith(typ, "KC")
bias = np.zeros(len(typ))
bias[np.isin(typ, aprox + evitar)] = 6.8
bias[np.isin(typ, ["DNa01", "DNa02", "DNa03", "MDN"])] = DN_BIAS
stim = np.flatnonzero(np.isin(typ, ["ORN_" + g for g in ODOR]) & (side == ODOR_SIDE))
steer_L = np.flatnonzero(np.isin(typ, ["DNa02", "DNa03"]) & (side == "L"))
steer_R = np.flatnonzero(np.isin(typ, ["DNa02", "DNa03"]) & (side == "R"))
mdn = np.flatnonzero(typ == "MDN")


def trial(Wx):
    diffs, back, kcs = [], [], np.zeros(len(typ), bool)
    for seed in range(REPS):
        c = run(Wx, stim, t_ms=T_MS, rate_hz=RATE, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000, bias=bias)
        s = T_MS / 1000
        diffs.append((c[steer_L].sum() - c[steer_R].sum()) / s / 2)   # Hz por neurônio
        back.append(c[mdn].sum() / s / len(mdn))
        kcs |= (c > 0) & kc
    return np.array(diffs), np.array(back), kcs


def weaken(Wx, targets, active_kc):
    C = Wx.tocoo()
    m = active_kc[C.row] & np.isin(typ[C.col], targets)
    d = C.data.copy()
    d[m] *= FACTOR
    return sp.csr_matrix((d, (C.row, C.col)), shape=Wx.shape)


def show(label, diffs, back, ref=None):
    sem = diffs.std(ddof=1) / np.sqrt(len(diffs))
    txt = f"{label:10s} direção E−D {diffs.mean():+5.2f} ± {sem:4.2f} Hz   ré (MDN) {back.mean():5.2f} Hz"
    if ref is not None:
        d = diffs - ref   # mesmas sementes: comparação pareada
        txt += f"   mudança E−D {d.mean():+5.2f} ± {d.std(ddof=1) / np.sqrt(len(d)):4.2f} Hz"
    print(txt, flush=True)


print(f"cheiro na antena {ODOR_SIDE}: {ODOR} ({len(stim)} receptores) · tônus DN {DN_BIAS} mV · "
      f"sinapses a {FACTOR:.0%} · {REPS} repetições", flush=True)
d0, b0, active = trial(W)
show("ingênua", d0, b0)
d1, b1, _ = trial(weaken(W, aprox, active))
show("com dor", d1, b1, d0)
d2, b2, _ = trial(weaken(W, rew_targets, active))
show("com açúcar", d2, b2, d0)
print("\nprevisão para a mosca virar certo, com o cheiro à esquerda (DNa ipsilateral):"
      " dor -> E−D cai (vira para a direita, para longe); açúcar -> E−D sobe (vira para o cheiro)")
