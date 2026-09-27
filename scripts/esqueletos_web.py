"""Formas reais no cérebro 3D: os esqueletos dos neurônios que contam a história, simplificados para a página.

Os esqueletos (formato neuroglancer_skeletons do Male CNS v1.0, Janelia, CC-BY 4.0) estão em data/raw/esqueletos/,
um arquivo por neurônio (baixados de storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/
skeletons-precomputed/). Cada um tem vértices em nm e arestas (uma árvore).

Aqui: converte para o referencial dos pontos da página (µm, centrado; o mesmo deslocamento de 02_build_web.py,
recuperado pelos corpos celulares), confere o alinhamento (o corpo celular deve cair sobre o esqueleto) e simplifica:
mantém pontas e bifurcações e, ao longo de cada ramo, um ponto a cada PASSO µm.

Grava web/data/esqueletos.b64.txt (binário em base64) e web/data/esqueletos.json (grupos, cores, contagens).
Binário (little-endian): K (u32), V (u32), E (u32); índice do neurônio [K] (i32); grupo [K] (u8, com 0 a 3 de
enchimento até múltiplo de 4); início dos vértices [K+1] (u32); início das arestas [K+1] (u32); vértices [V x 3]
(i16, µm x 2); arestas [E x 2] (u16, índices de vértice dentro do neurônio).

uso: python scripts/esqueletos_web.py
"""
import base64
import json
import struct
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
PASSO = 5.0   # µm entre pontos ao longo de um ramo
PODA = 4.0    # µm: galhos terminais mais curtos que isso saem
GRUPOS = [   # nome, cor, grupos da página (o primeiro que contiver o neurônio decide a cor)
    ("Olhos: LC10a", "#4fc3ff", ["olho_L", "olho_R"]),
    ("Ameaça: LPLC2 e LC4", "#ff9a3c", ["ameaca"]),
    ("Direção: DNa01-03", "#ff5ad1", ["dirige_L", "dirige_R"]),
    ("Fuga: DNp01, DNp02, DNp04, DNp11", "#ffe04a", ["fibra_gigante", "fuga_E", "fuga_D", "fuga_frente", "fuga_tras"]),
    ("Ré: MDN", "#c78bff", ["moonwalker"]),
    ("Probóscide e gosto doce", "#ff7a8a", ["proboscide", "doce"]),
    ("Saídas do corpo cogumelar (MBON)", "#9d7bff", ["mbon_aprox", "mbon_evitar"]),
    ("Dopamina de recompensa (PAM)", "#5dff9c", ["recompensa"]),
    ("Dopamina de punição (PPL1)", "#ff4d5e", ["dor"]),
]

meta = json.loads((RAIZ / "web/data/meta.json").read_text(encoding="utf-8"))
g = meta["groups"]
ids = np.load(RAIZ / "data/edges.npz")["ids"]
ann = pd.read_feather(RAIZ / "data/raw/body-annotations-male-cns-v1.0-minconf-0.5.feather").set_index("bodyId").loc[ids].reset_index()

# posições da página (µm, centradas) e o deslocamento, pelos corpos celulares
nb = base64.b64decode((RAIZ / "web/data/neurons.b64.txt").read_text())
xyz = np.frombuffer(nb, dtype=np.dtype([("x", "<i2"), ("y", "<i2"), ("z", "<i2"), ("s", "u1"), ("g", "i1")]))
pag = np.stack([xyz["x"], xyz["y"], xyz["z"]], 1).astype(np.float64)
tem = ann.somaLocation.notna().to_numpy()
soma = np.full((len(ann), 3), np.nan)
soma[tem] = np.stack(ann.somaLocation[tem].to_numpy()).astype(float) * 8 / 1000
desloc = np.median(soma[tem] - pag[tem], axis=0)
print("deslocamento (µm):", np.round(desloc, 1), "· resíduo mediano:", np.round(np.median(np.abs(soma[tem] - pag[tem] - desloc), 0), 2))


def le(body):
    b = (RAIZ / f"data/raw/esqueletos/{body}").read_bytes()
    nv, ne = struct.unpack("<II", b[:8])
    v = np.frombuffer(b[8:8 + 12 * nv], dtype="<f4").reshape(nv, 3).astype(np.float64) / 1000 - desloc   # nm -> µm, centrado
    e = np.frombuffer(b[8 + 12 * nv:8 + 12 * nv + 8 * ne], dtype="<u4").reshape(ne, 2)
    return v, e


def poda(v, e):
    """Tira os galhinhos terminais com menos de PODA µm (espinhos e ruído do traçado); a forma geral fica."""
    viz = defaultdict(set)
    for a, b in e:
        viz[a].add(b); viz[b].add(a)
    remove = set()
    for folha in [n for n, l in viz.items() if len(l) == 1]:
        caminho, comp, ant, atual = [folha], 0.0, None, folha
        while True:
            prox = [x for x in viz[atual] if x != ant]
            if not prox:
                break
            comp += np.linalg.norm(v[prox[0]] - v[atual])
            ant, atual = atual, prox[0]
            if len(viz[atual]) != 2:
                break
            caminho.append(atual)
        if len(viz[atual]) > 2 and comp < PODA:
            remove.update(caminho)
    return np.array([(a, b) for a, b in e if a not in remove and b not in remove], np.uint32).reshape(-1, 2)


def simplifica(v, e):
    """Mantém pontas e bifurcações; ao longo de cada ramo, um ponto a cada PASSO µm."""
    viz = defaultdict(list)
    for a, b in e:
        viz[a].append(b); viz[b].append(a)
    chave = {n for n, l in viz.items() if len(l) != 2}
    if not chave:
        chave = {next(iter(viz))}
    novo, arestas, feito = {}, [], set()

    def idx(n):
        if n not in novo:
            novo[n] = len(novo)
        return novo[n]
    for k in chave:
        for prox in viz[k]:
            if (k, prox) in feito:
                continue
            caminho = [k, prox]
            while caminho[-1] not in chave:
                a, b = caminho[-2], caminho[-1]
                caminho.append(viz[b][0] if viz[b][0] != a else viz[b][1])
            feito.add((caminho[-1], caminho[-2]))
            ult, acum = caminho[0], 0.0
            for i in range(1, len(caminho)):
                acum += np.linalg.norm(v[caminho[i]] - v[caminho[i - 1]])
                if acum >= PASSO or i == len(caminho) - 1:
                    arestas.append((idx(ult), idx(caminho[i])))
                    ult, acum = caminho[i], 0.0
    ordem = sorted(novo, key=novo.get)
    return v[ordem], np.array(arestas, np.uint32).reshape(-1, 2)


grupo_de = {}
for gi, (_, _, nomes) in enumerate(GRUPOS):
    for nome in nomes:
        for i in g.get(nome, []):
            grupo_de.setdefault(i, gi)
neuronios = sorted(grupo_de)
V, E, inicio, iniE, grupo, alvo, dists, antes = [], [], [0], [0], [], [], [], 0
for i in neuronios:
    p = RAIZ / f"data/raw/esqueletos/{int(ids[i])}"
    if not p.exists():
        continue
    v, e = le(int(ids[i]))
    antes += len(v)
    if tem[i]:
        dists.append(float(np.min(np.linalg.norm(v - pag[i], axis=1))))
    vs, es = simplifica(v, poda(v, e))
    E.append(es.astype(np.uint16)); V.append(vs)
    inicio.append(inicio[-1] + len(vs)); iniE.append(iniE[-1] + len(es)); grupo.append(grupo_de[i]); alvo.append(i)
V = np.concatenate(V); E = np.concatenate(E)
print(f"{len(alvo)} neurônios · vértices {antes} -> {len(V)} · arestas {len(E)}")
print(f"alinhamento: corpo celular até o esqueleto mais próximo, mediana {np.median(dists):.1f} µm, 90% até {np.percentile(dists, 90):.1f} µm")

K = len(alvo)
pad = (-K) % 4
blob = (struct.pack("<III", K, len(V), len(E)) + np.array(alvo, "<i4").tobytes() + np.array(grupo, "u1").tobytes() + b"\0" * pad
        + np.array(inicio, "<u4").tobytes() + np.array(iniE, "<u4").tobytes() + np.round(V * 2).astype("<i2").tobytes() + E.astype("<u2").tobytes())
(RAIZ / "web/data/esqueletos.b64.txt").write_text(base64.b64encode(blob).decode())
(RAIZ / "web/data/esqueletos.json").write_text(json.dumps({
    "fonte": "esqueletos do Male CNS v1.0 (Janelia, CC-BY 4.0), simplificados (um ponto a cada 5 µm nos ramos)",
    "grupos": [{"nome": n, "cor": c, "neuronios": int(sum(1 for x in grupo if x == gi))} for gi, (n, c, _) in enumerate(GRUPOS)],
}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"web/data/esqueletos.b64.txt: {len(blob) / 1e6:.1f} MB em binário, {len(blob) * 4 / 3 / 1e6:.1f} MB em base64")
