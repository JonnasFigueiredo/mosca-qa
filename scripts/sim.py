"""Simulação LIF (integra-e-dispara) do sistema nervoso inteiro, no mesmo estilo
de Shiu et al. 2024 (Nature). Serve para validar o circuito antes da versão web."""
from pathlib import Path

import numpy as np
import pandas as pd
import scipy.sparse as sp

ROOT = Path(__file__).resolve().parent.parent
INHIB = {"gaba", "glutamate", "histamine"}

# parâmetros de Shiu et al. 2024
V_REST, V_TH, V_RESET = -52.0, -45.0, -52.0
TAU_M, TAU_SYN, T_REF, DELAY = 20.0, 5.0, 2.2, 1.8  # ms
W_SYN = 0.275  # mV por sinapse


def load(min_weight=1):
    ann = pd.read_feather(ROOT / "data/raw/body-annotations-male-cns-v1.0-minconf-0.5.feather")
    nt = pd.read_feather(ROOT / "data/raw/body-neurotransmitters-male-cns-v1.0.feather").set_index("body")
    e = np.load(ROOT / "data/edges.npz")
    ids = e["ids"]
    ann = ann.set_index("bodyId").loc[ids].reset_index()
    cons = nt.consensus_nt.reindex(ids)
    guess = nt.celltype_predicted_nt.reindex(ids).where(cons.eq("unclear") | cons.isna(), cons)
    sign = np.where(guess.fillna("acetylcholine").isin(INHIB), -1.0, 1.0).astype(np.float32)
    m = e["w"] >= min_weight
    pre, post, w = e["pre"][m], e["post"][m], e["w"][m]
    W = sp.csr_matrix((w * sign[pre] * W_SYN, (pre, post)), shape=(len(ids),) * 2, dtype=np.float32)
    return ann, sign, W


def run(W, stim, t_ms=1000, rate_hz=150, dt=0.1, seed=0, a_inc=0.0, tau_a=200.0, bias=None):
    """stim: índices estimulados com Poisson. Devolve contagem de spikes por neurônio.
    a_inc > 0 liga a adaptação: cada spike soma a_inc mV a uma corrente que hiperpolariza."""
    rng = np.random.default_rng(seed)
    n = W.shape[0]
    v = np.full(n, V_REST, np.float32)
    g = np.zeros(n, np.float32)
    a = np.zeros(n, np.float32)
    b = np.zeros(n, np.float32) if bias is None else bias.astype(np.float32)
    ref = np.zeros(n, np.float32)
    counts = np.zeros(n, np.int32)
    d = int(round(DELAY / dt))
    queue = [np.array([], np.int64)] * d
    p_in = rate_hz * dt / 1000
    for _ in range(int(t_ms / dt)):
        arrived = queue.pop(0)
        if arrived.size:
            g += np.asarray(W[arrived].sum(0)).ravel()
        ext = stim[rng.random(stim.size) < p_in]
        g[ext] += 250 * W_SYN  # entrada forte como em Shiu et al.
        active = ref <= 0
        v[active] += dt * ((V_REST - v[active]) + g[active] - a[active] + b[active]) / TAU_M
        g -= dt * g / TAU_SYN
        a -= dt * a / tau_a
        ref -= dt
        spk = np.flatnonzero(v >= V_TH)
        v[spk] = V_RESET
        ref[spk] = T_REF
        a[spk] += a_inc
        counts[spk] += 1
        queue.append(spk)
    return counts
