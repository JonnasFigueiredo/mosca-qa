"""Poses do corpo real (NeuroMechFly) para animar a mosca no navegador sem o servidor de física.

Para cada peça da malha (a mesma ordem de web/data/corpo_malha.json), a posição e a orientação em relação ao tórax:
  - "pe": de pé, na pose neutra do flygym;
  - "voo": patas recolhidas como em moscas voando (as da frente para a frente, sob a cabeça; as do meio e de trás
    dobradas sob o corpo, para trás). Ângulos achados por busca: cada ponta de pata a <0,05 mm da postura-alvo.
Mais: a base (articulação) e a direção da envergadura de cada asa, a base de cada haltere, e a base (coxa) e as
peças de cada pata, para o andar.

Grava web/data/corpo_poses.json. Precisa de web/data/corpo_malha.json (o servidor do corpo grava na primeira vez).

uso: .venv/Scripts/python.exe corpo/poses.py
"""
import json
import sys
from pathlib import Path

import mujoco as mj
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import servidor as S  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
# somados à pose de pé: coxa pitch, coxa roll, fêmur pitch, tíbia pitch (rad), por posição da pata
VOO = {"f": (-1.2, -0.3, 0.0, 1.25), "m": (0.9, -0.3, -2.25, 1.25), "h": (-0.6, 0.3, -2.5, 1.25)}

c = S.Corpo([])
c.vivo = False
m, d = c.m, c.sim.mj_data
tor = mj.mj_name2id(m, mj.mjtObj.mjOBJ_BODY, "nmf/c_thorax")
nomes = [mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM, g) for g in c.geoms]
malha = json.loads((RAIZ / "web/data/corpo_malha.json").read_text(encoding="utf-8"))
assert [p["nome"] for p in malha["pecas"]] == nomes, "a ordem das peças mudou: rode o servidor do corpo de novo"
adr = lambda n: m.jnt_qposadr[mj.mj_name2id(m, mj.mjtObj.mjOBJ_JOINT, "nmf/" + n)]


def relativas():
    mj.mj_kinematics(m, d)
    Rt, pt = d.xmat[tor].reshape(3, 3), d.xpos[tor]
    out = []
    for g in c.geoms:
        R = Rt.T @ d.geom_xmat[g].reshape(3, 3)
        p = Rt.T @ (d.geom_xpos[g] - pt)
        out.append([round(float(v), 5) for v in (*p, *R.ravel())])
    return out, Rt, pt


def corpo_rel(nome):
    b = mj.mj_name2id(m, mj.mjtObj.mjOBJ_BODY, "nmf/" + nome)
    Rt, pt = d.xmat[tor].reshape(3, 3), d.xpos[tor]
    return Rt.T @ (d.xpos[b] - pt)


d.qpos[:] = c.q_pe
pe, Rt, pt = relativas()
# altura do tórax de pé: as pontas das patas no chão
pontas = [corpo_rel(f"{p}_tarsus5")[2] for p in ("lf", "lm", "lh", "rf", "rm", "rh")]
altura = float(-min(pontas))
asas, halteres, pernas = {}, {}, {}
for lado in "lr":
    i = nomes.index(f"nmf/{lado}_wing")
    g = c.geoms[i]
    base = corpo_rel(f"{lado}_wing")
    # direção da envergadura: do ponto de articulação ao centro dos vértices da asa
    mid = m.geom_dataid[g]
    vs = m.mesh_vert[m.mesh_vertadr[mid]:m.mesh_vertadr[mid] + m.mesh_vertnum[mid]]
    Rg, pg = d.geom_xmat[g].reshape(3, 3), d.geom_xpos[g]
    centro = Rt.T @ (Rg @ vs.mean(0) + pg - pt)
    env = centro - base
    asas[lado] = {"peca": i, "base": [round(float(v), 4) for v in base], "envergadura": [round(float(v), 4) for v in env]}
    j = nomes.index(f"nmf/{lado}_haltere")
    halteres[lado] = {"peca": j, "base": [round(float(v), 4) for v in corpo_rel(f"{lado}_haltere")]}
for perna in ("lf", "lm", "lh", "rf", "rm", "rh"):
    pernas[perna] = {"pecas": [k for k, n in enumerate(nomes) if n.startswith(f"nmf/{perna}_")],
                     "base": [round(float(v), 4) for v in corpo_rel(f"{perna}_coxa")]}

q = c.q_pe.copy()
for perna in ("lf", "lm", "lh", "rf", "rm", "rh"):
    cp, cr, fp, tp = VOO[perna[1]]
    q[adr(f"c_thorax-{perna}_coxa-pitch")] += cp
    q[adr(f"c_thorax-{perna}_coxa-roll")] += cr
    q[adr(f"{perna}_coxa-{perna}_trochanterfemur-pitch")] += fp
    q[adr(f"{perna}_trochanterfemur-{perna}_tibia-pitch")] += tp
d.qpos[:] = q
voo, _, _ = relativas()

dest = RAIZ / "web/data/corpo_poses.json"
dest.write_text(json.dumps({"fonte": "NeuroMechFly (flygym 2.1), poses relativas ao tórax (mm; x frente, y esquerda, z cima)",
                            "altura": round(altura, 4), "pe": pe, "voo": voo, "asas": asas, "halteres": halteres, "pernas": pernas},
                           separators=(",", ":")), encoding="utf-8")
print(f"{len(pe)} peças · tórax a {altura:.2f} mm do chão · asas {json.dumps(asas)} · {dest.stat().st_size // 1024} KB")
