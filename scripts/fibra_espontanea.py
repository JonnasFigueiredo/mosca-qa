"""Disparos soltos da fibra gigante (DNp01) com o corpo cheio de sensores, contra uma ameaça de verdade.

Mesmo modelo e tônus da página. Registra o instante de cada disparo do DNp01 (os dois lados) em:
- corpo: as entradas do corpo físico andando numa parede (cerdas a 20 Hz, carga, cordotonal (hook) a 30 Hz, gravidade nas
  antenas e 40 LC10a vendo algo), por T segundos;
- ameaça: o mesmo, mais LPLC2 e LC4 a 200 Hz por 300 ms (o que a Sentinela crescendo na frente produz).
Conta disparos soltos e rajadas (2 disparos em 100 ms). Grava docs/medicoes/fibra-espontanea.json.

uso: python fibra_espontanea.py [segundos] [sementes]
"""
import json
import sys
from pathlib import Path

import numpy as np

from mb import build, mbon_groups
from sim import DELAY, T_REF, TAU_M, TAU_SYN, V_RESET, V_REST, V_TH, W_SYN

RAIZ = Path(__file__).resolve().parent.parent
T_S = float(sys.argv[1]) if len(sys.argv) > 1 else 5
SEEDS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
DT = 0.25
ann, sign, W, typ, cls = build()
e = np.load(RAIZ / "data/edges.npz")
aprox, evitar = mbon_groups(typ, cls, e)
del e
bias = np.zeros(len(typ), np.float32)
bias[np.isin(typ, aprox + evitar)] = 6.8
bias[np.isin(typ, ["DNa01", "DNa02", "DNa03"])] = 7.3
G = json.loads((RAIZ / "web/data/meta.json").read_text(encoding="utf-8"))["groups"]
pernas = ["lf", "lm", "lh", "rf", "rm", "rh"]
todas = lambda pref: sorted({i for p in pernas for i in G[f"{pref}_{p}"]})
lc = np.random.default_rng(0).choice(np.r_[G["olho_L"], G["olho_R"]], 40, replace=False)
CORPO = [(todas("tato"), 20), (todas("carga"), 40), (todas("cordotonal"), 30), (G["gravidade_E"], 40), (lc, 100)]
AMEACA = [(G["ameaca"], 200)]
dnp01 = np.flatnonzero(typ == "DNp01")


def entradas(lista):
    idx = np.concatenate([np.asarray(i, np.int64) for i, _ in lista])
    hz = np.concatenate([np.full(len(i), r, np.float32) for i, r in lista])
    return idx, hz


def roda(t_ms, seed, extra=None, extra_de=(0, 0)):
    """Como sim.run, com adaptação 0,3 mV / 1 s, e guarda o instante (ms) dos disparos do DNp01."""
    rng = np.random.default_rng(seed)
    n = W.shape[0]
    v = np.full(n, V_REST, np.float32); g = np.zeros(n, np.float32); a = np.zeros(n, np.float32); ref = np.zeros(n, np.float32)
    idx, hz = entradas(CORPO)
    if extra:
        ei, eh = entradas(extra)
    d = int(round(DELAY / DT))
    fila = [np.array([], np.int64)] * d
    tempos = []
    for k in range(int(t_ms / DT)):
        t = k * DT
        chegou = fila.pop(0)
        if chegou.size:
            g += np.asarray(W[chegou].sum(0)).ravel()
        g[idx[rng.random(idx.size) < hz * DT / 1000]] += 250 * W_SYN
        if extra and extra_de[0] <= t < extra_de[1]:
            g[ei[rng.random(ei.size) < eh * DT / 1000]] += 250 * W_SYN
        at = ref <= 0
        v[at] += DT * ((V_REST - v[at]) + g[at] - a[at] + bias[at]) / TAU_M
        g -= DT * g / TAU_SYN
        a -= DT * a / 1000
        ref -= DT
        spk = np.flatnonzero(v >= V_TH)
        v[spk] = V_RESET; ref[spk] = T_REF; a[spk] += 0.3
        tempos += [t] * int(np.isin(spk, dnp01).sum())
        fila.append(spk)
    return tempos


def rajadas(ts, janela=100):
    ts = sorted(ts)
    return sum(1 for i in range(1, len(ts)) if ts[i] - ts[i - 1] <= janela)


if len(sys.argv) > 3 and sys.argv[3] == "ablacao":
    # o corpo inteiro menos uma entrada de cada vez (e cada uma sozinha): quem faz o DNp01 disparar solto?
    nomes = ["cerdas_15", "carga", "cordotonal", "gravidade_E", "lc10a_40"]
    completo = list(CORPO)
    res = {}
    for i, nome in enumerate(nomes):
        for modo, lista in (("sem", [c for j, c in enumerate(completo) if j != i]), ("so", [completo[i]])):
            CORPO[:] = lista
            ts = [t for s in range(SEEDS) for t in roda(T_S * 1000, s)]
            res[f"{modo}_{nome}"] = round(len(ts) / (T_S * SEEDS), 2)
            print(f"{modo}_{nome}: DNp01 {res[f'{modo}_{nome}']} Hz", flush=True)
    (RAIZ / "docs/medicoes/fibra-espontanea-ablacao.json").write_text(json.dumps({"segundos": T_S, "sementes": SEEDS, "DNp01_hz": res},
                                                                               ensure_ascii=False, indent=1), encoding="utf-8")
    sys.exit()

out = {"segundos": T_S, "sementes": SEEDS, "corpo_hz": {"cerdas_15": 20, "carga": 40, "cordotonal_hook": 30, "gravidade_E": 40, "lc10a_40": 100},
       "corpo": [], "ameaca": []}
for s in range(SEEDS):
    ts = roda(T_S * 1000, s)
    out["corpo"].append({"disparos": len(ts), "por_s": round(len(ts) / T_S, 2), "pares_em_100ms": rajadas(ts), "instantes_ms": ts})
    print("corpo", out["corpo"][-1], flush=True)
    ts = roda(1000, 100 + s, AMEACA, (300, 600))
    out["ameaca"].append({"disparos": len(ts), "na_ameaca": sum(1 for t in ts if 300 <= t < 700), "pares_em_100ms": rajadas(ts), "instantes_ms": ts})
    print("ameaça", out["ameaca"][-1], flush=True)
(RAIZ / "docs/medicoes/fibra-espontanea.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em docs/medicoes/fibra-espontanea.json")
