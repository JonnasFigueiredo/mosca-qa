"""Confere a orientação do mapa do olho no lóbulo usando a medula.

A mesma coluna (o mesmo rótulo hex1_hex2) existe na medula e no lóbulo e olha para o mesmo ponto do mundo.
Entre a lâmina e a medula passa o 1º quiasma óptico, que inverte a imagem na direção frente-trás; entre a
medula e o lóbulo, o 2º quiasma inverte de novo. Então, se os rótulos e a geometria estão certos, ao andar
numa direção de colunas a medula vai para trás quando o lóbulo vai para a frente (sinais opostos em z),
e as duas sobem juntas (mesmo sinal em y: não há quiasma em cima-baixo).

Grava docs/medicoes/lc-orientacao.json.

uso: python lc_orientacao.py
"""
import json
from pathlib import Path

import numpy as np
import pyarrow.ipc as ipc

RAIZ = Path(__file__).resolve().parent.parent
f = ipc.open_file(RAIZ / "data/raw/syn-points-male-cns-v1.0-minconf-0.5.feather")
REG = [f"{r}_{s}" for r in ("medulla", "lobula") for s in ("r", "l")]
soma = {}   # (região, rótulo) -> [sy, sz, n]
for i in range(f.num_record_batches):
    b = f.get_batch(i).select(["y", "z"] + [f"{r}_column" for r in REG]).to_pandas()
    for r in REG:
        c = b[f"{r}_column"]
        m = c != "<unspecified>"
        if not m.any():
            continue
        g = b[m].groupby(f"{r}_column", observed=True)[["y", "z"]].agg(["sum", "count"])
        for rot, row in g.iterrows():
            a = soma.setdefault((r, str(rot)), [0.0, 0.0, 0])
            a[0] += row[("y", "sum")]; a[1] += row[("z", "sum")]; a[2] += int(row[("y", "count")])
    if (i + 1) % 1000 == 0:
        print(f"{i + 1}/{f.num_record_batches} lotes", flush=True)

out = {}
for r in REG:
    k = [(rot, v) for (rr, rot), v in soma.items() if rr == r and v[2] >= 50]
    h = np.array([[float(x) for x in rot.rsplit("_", 2)[-2:]] for rot, _ in k])
    y = np.array([v[0] / v[2] for _, v in k]); z = np.array([v[1] / v[2] for _, v in k])
    A = np.c_[h, np.ones(len(h))]
    cy, cz = np.linalg.lstsq(A, y, rcond=None)[0], np.linalg.lstsq(A, z, rcond=None)[0]
    out[r] = {"colunas": len(k), "y_por_hex": [round(float(cy[0]), 1), round(float(cy[1]), 1)],
              "z_por_hex": [round(float(cz[0]), 1), round(float(cz[1]), 1)]}
    print(r, out[r], flush=True)

conclusao = {}
for s in ("r", "l"):
    me, lo = out[f"medulla_{s}"], out[f"lobula_{s}"]
    conclusao[s] = {
        "z_sinais_opostos (frente-trás invertido entre medula e lóbulo)": all(np.sign(me["z_por_hex"]) == -np.sign(lo["z_por_hex"])),
        "y_mesmo_sinal (cima-baixo igual)": all(np.sign(me["y_por_hex"]) == np.sign(lo["y_por_hex"])),
    }
print(conclusao)
(RAIZ / "docs/medicoes/lc-orientacao.json").write_text(json.dumps({
    "data": "2026-09-26", "metodo": __doc__.strip().splitlines()[0], "ajustes": out,
    "conclusao": {k: {kk: bool(vv) for kk, vv in v.items()} for k, v in conclusao.items()}}, ensure_ascii=False, indent=1), encoding="utf-8")
