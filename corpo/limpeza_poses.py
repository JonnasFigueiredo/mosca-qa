"""Poses geométricas de limpeza, sem simular o circuito nem forças nas patas.

Uso: .venv/Scripts/python.exe -X utf8 corpo/limpeza_poses.py
Resolve juntas da NeuroMechFly para alvos aproximados de cabeça, antenas e esfregar patas.
Exporta só as peças das patas anteriores, com nomes para não depender da ordem da malha.
"""
import json
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
os.environ.setdefault("MPLCONFIGDIR", str(RAIZ / "_tmp/matplotlib"))
import mujoco as mj
import numpy as np
from scipy.optimize import least_squares
import servidor as S

c = S.Corpo([])
c.vivo = False
m, d = c.m, c.sim.mj_data
tor = mj.mj_name2id(m, mj.mjtObj.mjOBJ_BODY, "nmf/c_thorax")
nomes = [mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM, g) for g in c.geoms]
pecas = [i for i, n in enumerate(nomes) if n.startswith(("nmf/lf_", "nmf/rf_"))]

def ponto(nome):
    b = mj.mj_name2id(m, mj.mjtObj.mjOBJ_BODY, "nmf/" + nome)
    return d.xmat[tor].reshape(3, 3).T @ (d.xpos[b] - d.xpos[tor])

# x para a frente, y para a esquerda, z para cima, relativos ao tórax (mm).
# São alvos visuais, não trajetórias medidas. A/B alternam sem esticar segmentos.
alvos = {
    "patas_a": [0.92, 0.045, -0.48], "patas_b": [1.04, 0.06, -0.30],
    "antenas_a": [0.57, 0.20, -0.10], "antenas_b": [0.64, 0.23, 0.09],
    "cabeca_a": [0.48, 0.40, 0.30], "cabeca_b": [0.75, 0.36, -0.10],
}
poses, erros = {}, {}
for nome, alvo in alvos.items():
    d.qpos[:] = c.q_pe
    erros[nome] = {}
    for perna, sinal in [("lf", 1), ("rf", -1)]:
        juntas = [j for j in range(m.njnt) if perna + "_" in mj.mj_id2name(m, mj.mjtObj.mjOBJ_JOINT, j)][:7]
        adr = m.jnt_qposadr[juntas]
        base = c.q_pe[adr].copy()
        destino = np.array(alvo) * [1, sinal, 1]
        # Abre o cotovelo para as patas contornarem a cabeça, sem cruzar o tórax.
        joelho = np.array([0.50, sinal * 0.65, -0.30])
        def residuo(q):
            d.qpos[adr] = base + q
            mj.mj_kinematics(m, d)
            return np.r_[4 * (ponto(perna + "_tarsus5") - destino),
                         0.25 * (ponto(perna + "_tibia") - joelho), 0.025 * q]
        sol = least_squares(residuo, np.zeros(len(adr)), bounds=(-2.6, 2.6), max_nfev=180)
        residuo(sol.x)
        erros[nome][perna] = round(float(np.linalg.norm(ponto(perna + "_tarsus5") - destino)), 4)
    Rt, pt = d.xmat[tor].reshape(3, 3), d.xpos[tor]
    poses[nome] = [[round(float(x), 6) for x in np.r_[Rt.T @ (d.geom_xpos[c.geoms[i]] - pt),
                       (Rt.T @ d.geom_xmat[c.geoms[i]].reshape(3, 3)).ravel()]] for i in pecas]

saida = {"metodo": "Cinemática da NeuroMechFly. Alvos e postura escolhidos para animação, sem validação biológica nem forças de limpeza. Interpolação visual entre poses; não são comandos neurais.",
         "pecas": [nomes[i] for i in pecas], "poses": poses, "erro_alvo_mm": erros}
(RAIZ / "web/data/limpeza_poses.json").write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(json.dumps(erros, ensure_ascii=False))
assert max(v for e in erros.values() for v in e.values()) < 0.06, "uma pata não alcançou o alvo"
