"""Visão, passo 2: aparências diferentes acendem células de Kenyon diferentes?

As KCγd (e um pouco as KCαβp) recebem neurônios de projeção visual. Aqui cada "aparência" é um par
desses tipos visuais (como as notas de cheiro são pares de glomérulos) ou, no modo "grupos", um terço
dos 27 tipos que mais falam com as células de Kenyon. Liga cada aparência nos dois olhos e anota quais
células de Kenyon disparam. Para aprender pela aparência, cada uma precisa acender um grupo próprio.

Resultado (2026-09-25): 2 a 5 células de Kenyon de ~4 mil por aparência, mesmo com ~30 neurônios
visuais a 100 Hz. A via existe no mapa, mas no modelo atual chega fraca demais para aprender por ela.

uso: python visao_kc.py [taxa Hz] [ms] [repetições] [pares|grupos]
"""
import itertools
import json
import sys
from pathlib import Path

import numpy as np

from mb import build
from sim import run

RATE = float(sys.argv[1]) if len(sys.argv) > 1 else 100
T_MS = float(sys.argv[2]) if len(sys.argv) > 2 else 500
REPS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
# pares (primeira tentativa): 1 a 4 neurônios por tipo, fraco demais para acender células de Kenyon
PARES = {
    "A": ["aMe12", "MeVP41"],
    "B": ["aMe26", "LoVP42"],
    "C": ["MeVP36", "aMe20"],
    "D": ["LoVP71", "LoVP107"],
    "E": ["MeVP25", "MeVP43"],
}
# grupos: os 27 tipos visuais com >= 50 sinapses em células de Kenyon (84 neurônios), em 3 partes alternadas
VISUAIS_KC = ["aMe12", "MeVP41", "LoVP42", "aMe26", "MeVP36", "aMe20", "LoVP71", "LoVP107", "MeVP25", "MeVP43",
              "LoVP100", "LoVP65", "LoVP70", "MeVP50", "MeVPLo2", "MeVP45", "MeVP30", "LoVP66", "MeVP52", "LT43",
              "LoVP51", "LoVP38", "MeVP21", "aMe6a", "MeVP29", "MeVP47", "LoVP72"]
GRUPOS = {k: VISUAIS_KC[i::3] for i, k in enumerate("ABC")}
APARENCIAS = GRUPOS if len(sys.argv) > 4 and sys.argv[4] == "grupos" else PARES

ann, sign, W, typ, cls = build()
kc = np.char.startswith(typ, "KC")
kc_gd = typ == "KCg-d"
res = {}
for nome, tipos in APARENCIAS.items():
    stim = np.flatnonzero(np.isin(typ, tipos))
    active = np.zeros(len(typ), bool)
    for seed in range(REPS):
        c = run(W, stim, t_ms=T_MS, rate_hz=RATE, dt=0.25, seed=seed, a_inc=0.3, tau_a=1000)
        active |= (c > 0) & kc
    res[nome] = active
    tipos_kc = {t: int((active & (typ == t)).sum()) for t in sorted(set(typ[active]))}
    print(f"{nome} {'+'.join(tipos)[:60]:60s} {len(stim):4d} neurônios visuais -> {int(active.sum()):4d} KCs {tipos_kc}", flush=True)

print("\nsobreposição (fração do menor grupo):")
over = {}
for a, b in itertools.combinations(APARENCIAS, 2):
    n = min(res[a].sum(), res[b].sum())
    f = float((res[a] & res[b]).sum() / n) if n else 0.0
    over[f"{a}-{b}"] = round(f, 2)
    print(f"  {a}-{b}: {f:.0%}")

out = {"taxa_hz": RATE, "ms": T_MS, "repeticoes": REPS,
       "aparencias": {k: {"tipos": v, "kcs": int(res[k].sum()), "kcg_d": int((res[k] & kc_gd).sum())} for k, v in APARENCIAS.items()},
       "sobreposicao": over}
modo = "grupos" if APARENCIAS is GRUPOS else "pares"
out["modo"] = modo
dest = Path(__file__).resolve().parent.parent / f"docs/medicoes/visao-kc-{modo}.json"
dest.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print("salvo em", dest)
