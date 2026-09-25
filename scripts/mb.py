"""Corpo cogumelar: monta a mesma rede da página (≥5 sinapses, sem autapses, sem as
excitatórias entre PNs/LNs do lobo antenal, ganho 0,5) e define os grupos do aprendizado."""
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp

from sim import load

ROOT = Path(__file__).resolve().parent.parent
GAIN = 0.5

# Glomérulos que podem compor o "cheiro" de um botão. Ficam de fora os de significado inato
# forte (feromônios DA1, VA1d, VA1v; geosmina/mofo DA2; CO2 em V), o DM1, que sozinho acende
# tantas células de Kenyon quanto um cheiro inteiro, e os que têm menos de 20 receptores.
ODOR_EXCLUDE = {"ORN_DA1", "ORN_VA1d", "ORN_VA1v", "ORN_DA2", "ORN_V", "ORN_DM1"}


def odor_pool(typ, cls):
    t = pd.Series(typ[cls == "olfactory"]).value_counts()
    return sorted(k for k, n in t.items() if n >= 20 and k.startswith("ORN_") and k not in ODOR_EXCLUDE)


def build():
    ann, sign, W = load(5)
    typ = ann.type.fillna("").to_numpy().astype(str)
    cls = ann["class"].fillna("").to_numpy().astype(str)
    al = np.isin(cls, ["ALLN", "ALPN"])
    W = W.tocoo()
    keep = (W.row != W.col) & ~(al[W.row] & al[W.col] & (W.data > 0))
    W = sp.csr_matrix((W.data[keep] * GAIN, (W.row[keep], W.col[keep])), shape=W.shape)
    return ann, sign, W, typ, cls


def mbon_groups(typ, cls, e):
    """MBONs do compartimento de punição (PPL1) = 'aproximar'; de recompensa (PAM) = 'evitar'."""
    pre, post, w = e["pre"], e["post"], e["w"]
    ppl1 = np.isin(typ, [f"PPL10{i}" for i in range(1, 7)])
    pam = np.char.startswith(typ, "PAM")
    approach, avoid = [], []
    for t in sorted(set(typ[cls == "MBON"])):
        mi = np.flatnonzero(typ == t)
        inm = np.isin(post, mi)
        f_ppl1, f_pam = w[inm & ppl1[pre]].sum(), w[inm & pam[pre]].sum()
        if f_ppl1 >= 100 and f_ppl1 > 3 * f_pam:
            approach.append(t)
        elif f_pam >= 400 and f_pam > 3 * f_ppl1:
            avoid.append(t)
    return approach, avoid
