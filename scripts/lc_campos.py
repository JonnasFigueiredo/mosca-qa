"""Campo receptivo de cada neurônio de projeção visual (LC, LPLC, LLPC), direto das sinapses.

Lê data/raw/syn-points-male-cns-v1.0-minconf-0.5.feather (13 GB, Janelia) em lotes. Cada sinapse no lóbulo
vem com a coluna onde está (LO_R_col_<hex1>_<hex2>, e o mesmo para o lado esquerdo). Numa passada:
- para cada neurônio LC/LPLC/LLPC, a média das colunas das suas sinapses de entrada no lóbulo: o centro do
  campo receptivo em coordenadas de coluna, e a dispersão (tamanho do campo);
- para cada coluna do lóbulo, a posição 3D média das sinapses nela: com isso, um ajuste linear diz como as
  colunas se orientam no corpo (y cresce para baixo; z cresce para trás, conferido pelo lobo antenal na
  frente e pelo cálice do corpo cogumelar atrás).
O lóbulo recebe a imagem pelos dois quiasmas ópticos, que se anulam: em cima no lóbulo é em cima no olho,
e na frente é na frente. Por isso a posição no lóbulo vira elevação e azimute (normalizados de -1 a 1).

Grava web/data/lc_campos.json e docs/medicoes/lc-campos.json (resumo).

uso: python lc_campos.py
"""
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.ipc as ipc

RAIZ = Path(__file__).resolve().parent.parent
f = ipc.open_file(RAIZ / "data/raw/syn-points-male-cns-v1.0-minconf-0.5.feather")
ann = pd.read_feather(RAIZ / "data/raw/body-annotations-male-cns-v1.0-minconf-0.5.feather")
t = ann.type.fillna("")
alvo = ann[(ann.superclass == "visual_projection") & t.str.match(r"^(LC|LPLC|LLPC)") & ~t.str.endswith("unclear")]
tipo_de = dict(zip(alvo.bodyId, alvo.type))
corpos = np.array(list(tipo_de), dtype=np.int64)
print(len(corpos), "neurônios LC/LPLC/LLPC,", alvo.type.nunique(), "tipos", flush=True)

soma_col = {}      # rótulo -> [sx, sy, sz, n]
pontos = []        # (body, rótulo, x, y, z) das entradas dos LCs no lóbulo
t0 = time.time()
for i in range(f.num_record_batches):
    b = f.get_batch(i).select(["x", "y", "z", "kind", "body", "lobula_r_column", "lobula_l_column"]).to_pandas()
    for lado in ("r", "l"):
        c = b[f"lobula_{lado}_column"]
        m = c != "<unspecified>"
        if not m.any():
            continue
        s = b[m]
        g = s.groupby(f"lobula_{lado}_column", observed=True)[["x", "y", "z"]].agg(["sum", "count"])
        for rot, row in g.iterrows():
            acc = soma_col.setdefault(str(rot), [0.0, 0.0, 0.0, 0])
            acc[0] += row[("x", "sum")]; acc[1] += row[("y", "sum")]; acc[2] += row[("z", "sum")]; acc[3] += int(row[("x", "count")])
        e = s[(s.kind == "PostSyn") & s.body.isin(corpos)]
        if len(e):
            pontos.append(pd.DataFrame({"body": e.body.values, "col": e[f"lobula_{lado}_column"].astype(str).values,
                                        "x": e.x.values, "y": e.y.values, "z": e.z.values}))
    if (i + 1) % 500 == 0:
        print(f"{i + 1}/{f.num_record_batches} lotes ({time.time() - t0:.0f} s)", flush=True)

p = pd.concat(pontos, ignore_index=True)
hx = p.col.str.extract(r"LO_([RL])_col_(\d+)_(\d+)")
p["lado"], p["h1"], p["h2"] = hx[0], hx[1].astype(float), hx[2].astype(float)
print(len(p), "sinapses de entrada de LCs no lóbulo", flush=True)

# orientação das colunas no corpo, por lado: (hex1, hex2) -> (y, z), ajuste linear
cols = pd.DataFrame([(k, *v) for k, v in soma_col.items()], columns=["col", "sx", "sy", "sz", "n"])
cx = cols.col.str.extract(r"LO_([RL])_col_(\d+)_(\d+)")
cols["lado"], cols["h1"], cols["h2"] = cx[0], cx[1].astype(float), cx[2].astype(float)
cols["y"], cols["z"] = cols.sy / cols.n, cols.sz / cols.n
cols = cols[cols.n >= 50]
orient, faixas = {}, {}
for lado in ("R", "L"):
    c = cols[cols.lado == lado]
    A = np.c_[c.h1, c.h2, np.ones(len(c))]
    cy = np.linalg.lstsq(A, c.y, rcond=None)[0]
    cz = np.linalg.lstsq(A, c.z, rcond=None)[0]
    orient[lado] = {"y": cy.tolist(), "z": cz.tolist()}
    yy, zz = A @ cy, A @ cz
    faixas[lado] = {"y": [float(yy.min()), float(yy.max())], "z": [float(zz.min()), float(zz.max())]}
    r2y = 1 - np.var(c.y - yy) / np.var(c.y)
    r2z = 1 - np.var(c.z - zz) / np.var(c.z)
    print(f"lado {lado}: {len(c)} colunas; y = {cy[0]:.0f}*h1 + {cy[1]:.0f}*h2 (R² {r2y:.2f}); z = {cz[0]:.0f}*h1 + {cz[1]:.0f}*h2 (R² {r2z:.2f})", flush=True)

# campo de cada neurônio: centro e dispersão em colunas; posição no olho (elevação: + em cima; azimute: + na frente)
saida = {}
resumo = {}
for (body, lado), g in p.groupby(["body", "lado"]):
    if len(g) < 20:
        continue
    h1, h2 = g.h1.mean(), g.h2.mean()
    o, fx = orient[lado], faixas[lado]
    y = o["y"][0] * h1 + o["y"][1] * h2 + o["y"][2]
    z = o["z"][0] * h1 + o["z"][1] * h2 + o["z"][2]
    el = -(2 * (y - fx["y"][0]) / (fx["y"][1] - fx["y"][0]) - 1)
    az = -(2 * (z - fx["z"][0]) / (fx["z"][1] - fx["z"][0]) - 1)
    tipo = tipo_de[body]
    # lado do olho: o lóbulo direito recebe o olho direito
    saida.setdefault(tipo, []).append({"body": int(body), "lado": lado, "el": round(float(el), 3), "az": round(float(az), 3),
                                       "raio": round(float(np.sqrt(g.h1.var() + g.h2.var())), 2), "n": int(len(g))})
for tipo, v in saida.items():
    resumo[tipo] = {"neuronios": len(v), "raio_medio_colunas": round(float(np.mean([c["raio"] for c in v])), 2)}

(RAIZ / "web/data/lc_campos.json").write_text(json.dumps({"fonte": "syn-points male CNS v1.0 (Janelia, CC-BY 4.0)", "tipos": saida},
                                                          separators=(",", ":")), encoding="utf-8")
(RAIZ / "docs/medicoes/lc-campos.json").write_text(json.dumps({
    "data": "2026-09-26", "metodo": __doc__.strip().splitlines()[0], "orientacao_colunas": orient,
    "tipos": resumo}, ensure_ascii=False, indent=1), encoding="utf-8")
print("LC10a:", resumo.get("LC10a"), flush=True)
print("salvo em web/data/lc_campos.json e docs/medicoes/lc-campos.json", flush=True)
