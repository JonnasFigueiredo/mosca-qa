"""Liga o campo receptivo de cada LC10a (lc_campos.json, das sinapses) aos omatídeos do olho do flygym.

Para cada célula: o centro do campo, normalizado no lóbulo (elevação e azimute de -1 a 1), vira uma direção
no olho esticando as mesmas faixas sobre as direções dos 721 omatídeos daquele olho (olho_mapas.json).
O tamanho vem da dispersão das sinapses dela em colunas; uma coluna do lóbulo corresponde a um omatídeo,
então uma coluna vale o ângulo médio entre omatídeos vizinhos do modelo. Peso de cada omatídeo: gaussiana
do ângulo até o centro, cortada abaixo de 2% e normalizada para somar 1.

Aproximação: o esticamento é linear (o contorno do olho não é um retângulo). Os campos saem na posição
e no tamanho certos em média, não omatídeo por omatídeo.

Grava web/data/lc10a_rf.json.

uso: python lc_omatidios.py
"""
import json
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
campos = json.loads((RAIZ / "web/data/lc_campos.json").read_text(encoding="utf-8"))["tipos"]["LC10a"]
mapa = json.loads((RAIZ / "web/data/olho_mapas.json").read_text(encoding="utf-8"))
ids = np.load(RAIZ / "data/edges.npz")["ids"]
idx_de = {int(b): i for i, b in enumerate(ids)}
grupos = json.loads((RAIZ / "web/data/meta.json").read_text(encoding="utf-8"))["groups"]


def vetor(az, el):
    az, el = np.radians(az), np.radians(el)
    return np.stack([np.cos(el) * np.cos(az), np.cos(el) * np.sin(az), np.sin(el)], -1)


celulas, sigmas = [], []
for olho, lado in ((0, "L"), (1, "R")):
    d = np.array(mapa["direcao"][olho])            # 721 x [azimute (+ esquerda), elevação]
    v = vetor(d[:, 0], d[:, 1])
    viz = np.degrees(np.arccos(np.clip(v @ v.T, -1, 1)))
    np.fill_diagonal(viz, 999)
    passo = float(np.median(viz.min(1)))           # ângulo entre omatídeos vizinhos
    # "trás" = afastamento da frente dentro do próprio olho (esquerdo: azimute; direito: -azimute)
    tras = d[:, 0] if lado == "L" else -d[:, 0]
    t0, t1 = tras.min(), tras.max()
    e0, e1 = d[:, 1].min(), d[:, 1].max()
    for c in campos:
        if c["lado"] != lado or c["body"] not in idx_de:
            continue
        el = e0 + (c["el"] + 1) / 2 * (e1 - e0)
        tr = t0 + (1 - c["az"]) / 2 * (t1 - t0)     # az = +1 na frente do lóbulo
        az = tr if lado == "L" else -tr
        sig = max(passo, c["raio"] / np.sqrt(2) * passo)
        ang = np.degrees(np.arccos(np.clip(v @ vetor(az, el), -1, 1)))
        w = np.exp(-ang ** 2 / (2 * sig ** 2))
        k = np.flatnonzero(w >= 0.02)
        w = w[k] / w[k].sum()
        celulas.append([idx_de[c["body"]], olho, round(float(az), 1), round(float(el), 1), round(float(sig), 1),
                        k.tolist(), np.round(w, 4).tolist()])
        sigmas.append(sig)
    print(f"olho {lado}: passo entre omatídeos {passo:.1f}°")

# as células com campo devem ser as mesmas dos grupos olho_L/olho_R da página
for olho, g in ((0, "olho_L"), (1, "olho_R")):
    com = {c[0] for c in celulas if c[1] == olho}
    print(f"{g}: {len(com & set(grupos[g]))} de {len(grupos[g])} com campo; {len(com - set(grupos[g]))} fora do grupo")
print(f"{len(celulas)} células, σ mediano {np.median(sigmas):.1f}°, omatídeos por campo (mediana) "
      f"{int(np.median([len(c[5]) for c in celulas]))}")
# detectores de ameaça (LPLC2 e LC4): só o centro e o tamanho do campo em graus, com o mesmo esticamento;
# a página liga cada um conforme a ameaça cai no seu campo (web/data/ameaca_rf.json)
todos = json.loads((RAIZ / "web/data/lc_campos.json").read_text(encoding="utf-8"))["tipos"]
ameaca = []
for olho, lado in ((0, "L"), (1, "R")):
    d = np.array(mapa["direcao"][olho])
    v = vetor(d[:, 0], d[:, 1])
    viz = np.degrees(np.arccos(np.clip(v @ v.T, -1, 1)))
    np.fill_diagonal(viz, 999)
    passo = float(np.median(viz.min(1)))
    tras = d[:, 0] if lado == "L" else -d[:, 0]
    t0, t1, e0, e1 = tras.min(), tras.max(), d[:, 1].min(), d[:, 1].max()
    for tipo in ("LPLC2", "LC4"):
        for c in todos[tipo]:
            if c["lado"] != lado or c["body"] not in idx_de:
                continue
            tr = t0 + (1 - c["az"]) / 2 * (t1 - t0)
            ameaca.append([idx_de[c["body"]], olho, round(float(tr if lado == "L" else -tr), 1),
                           round(float(e0 + (c["el"] + 1) / 2 * (e1 - e0)), 1), round(float(max(passo, c["raio"] / np.sqrt(2) * passo)), 1)])
(RAIZ / "web/data/ameaca_rf.json").write_text(json.dumps({
    "fonte": "campos: syn-points male CNS v1.0 (Janelia, CC-BY 4.0); direções dos omatídeos: flygym 2.1",
    "formato": "[neurônio, olho (0 esq, 1 dir), azimute° (+ esquerda), elevação°, σ°]", "celulas": ameaca}, separators=(",", ":")), encoding="utf-8")
print(len(ameaca), "LPLC2 + LC4 em web/data/ameaca_rf.json; σ mediano", np.median([c[4] for c in ameaca]), "°")

(RAIZ / "web/data/lc10a_rf.json").write_text(json.dumps({
    "fonte": "campos: syn-points male CNS v1.0 (Janelia, CC-BY 4.0); omatídeos: flygym 2.1",
    "formato": "[neurônio, olho (0 esq, 1 dir), azimute°, elevação°, σ°, omatídeos, pesos]",
    "celulas": celulas}, separators=(",", ":")), encoding="utf-8")
print("salvo em web/data/lc10a_rf.json")
