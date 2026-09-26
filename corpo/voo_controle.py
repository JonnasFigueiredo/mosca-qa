"""Voo físico, passo 3: o reflexo de estabilização (o papel dos halteres) mantém a mosca no ar?

1. Mede, com rajadas curtas, quanto cada ajuste da batida acelera o corpo:
   deslocamento do golpe (Oy) -> empinar; amplitude (Ay) -> sustentação; diferença de amplitude
   esquerda/direita -> rolagem; diferença de deslocamento -> guinada.
2. Voo livre com um controle proporcional-derivativo atualizado a cada batida (218 Hz): mantém a arfagem
   de voo (47,5°), o corpo nivelado, a altura e o rumo pedido.
O padrão de batida base é o melhor da busca (docs/medicoes/voo-busca.json) com avanço perto de zero.

uso: .venv/Scripts/python.exe corpo/voo_controle.py [segundos de voo]
"""
import json
import sys
from pathlib import Path

import mujoco as mj
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voo_modelo import DT, F_ASA, G, PITCH_VOO, batida, montar  # noqa: E402

SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 0.3
RAIZ = Path(__file__).resolve().parent.parent
ranking = json.loads((RAIZ / "docs/medicoes/voo-busca.json").read_text(encoding="utf-8"))["ranking"]
BASE = min(ranking[:8], key=lambda r: abs(r["resultado"]["frente"]))["padrao"]
print("padrão base:", BASE, flush=True)

voo = montar()
m, d = voo.m, voo.d
n_ciclo = int(round(1 / F_ASA / DT))


def rajada(extra_e, extra_d, ciclos=4, aquece=2):
    """Acelerações médias do tórax (vertical/g, arfagem, rolagem, guinada em rad/s²) com o padrão ajustado."""
    voo.sim.reset()
    mj.mj_forward(m, d)
    v0 = None
    for i in range((ciclos + aquece) * n_ciclo):
        if i == aquece * n_ciclo:
            _, v, _, w = voo.estado()
            v0 = np.concatenate([v, w])
        if i % 4 == 0:
            t = i * DT
            voo.asas(batida(BASE, t, extra_e), batida(BASE, t, extra_d))
        voo.sim.step()
    _, v, _, w = voo.estado()
    dv = (np.concatenate([v, w]) - v0) / (ciclos * n_ciclo * DT)
    # velocidade angular do tórax está no referencial do corpo (x frente, y esquerda, z cima)
    return {"sust": 1 + dv[2] / G, "arf": dv[4], "rol": dv[3], "gui": dv[5]}


base = rajada({}, {})
h = 0.1
sens = {
    "Oy->arf": (rajada({"Oy": h}, {"Oy": h})["arf"] - base["arf"]) / h,
    "Ay->sust": (rajada({"Ay": h}, {"Ay": h})["sust"] - base["sust"]) / h,
    "dAy->rol": (rajada({"Ay": h}, {"Ay": -h})["rol"] - base["rol"]) / h,
    "dOy->gui": (rajada({"Oy": h}, {"Oy": -h})["gui"] - base["gui"]) / h,
}
print("base:", {k: round(v, 2) for k, v in base.items()}, flush=True)
print("sensibilidades:", {k: round(v, 2) for k, v in sens.items()}, flush=True)

# voo livre com o reflexo
WN, ZETA = 40.0, 0.7      # rad/s: rapidez do reflexo de atitude
WZ = 12.0                 # rad/s: rapidez do controle de altura


def voar(rumo_alvo=0.0, com_reflexo=True):
    voo.sim.reset()
    mj.mj_forward(m, d)
    p0, _, a0, _ = voo.estado()
    z_alvo = p0[2]
    ex_e, ex_d = {}, {}
    pior = 0.0
    for i in range(int(SECS / DT)):
        if com_reflexo and i % n_ciclo == 0:
            p, v, ang, w = voo.estado()
            rol, arf, gui = ang
            e_arf = arf - a0[1]
            u_arf = -(WN ** 2 * e_arf + 2 * ZETA * WN * w[1]) / sens["Oy->arf"]
            u_rol = -(WN ** 2 * rol + 2 * ZETA * WN * w[0]) / sens["dAy->rol"]
            e_gui = np.arctan2(np.sin(rumo_alvo - gui), np.cos(rumo_alvo - gui))
            u_gui = (0.25 * WN ** 2 * e_gui - 2 * ZETA * 0.5 * WN * w[2]) / sens["dOy->gui"]
            u_z = ((WZ ** 2 * (z_alvo - p[2]) - 2 * ZETA * WZ * v[2]) / G) / sens["Ay->sust"]
            lim = lambda x, a: float(np.clip(x, -a, a))  # noqa: E731
            ex_e = {"Oy": lim(u_arf + u_gui, 0.8), "Ay": lim(u_z + u_rol, 0.6)}
            ex_d = {"Oy": lim(u_arf - u_gui, 0.8), "Ay": lim(u_z - u_rol, 0.6)}
        if i % 4 == 0:
            t = i * DT
            voo.asas(batida(BASE, t, ex_e), batida(BASE, t, ex_d))
        voo.sim.step()
        if not np.isfinite(d.qpos).all():
            return None
        if i % 200 == 0:
            _, _, ang, _ = voo.estado()
            pior = max(pior, abs(ang[1] - a0[1]), abs(ang[0]))
    p, v, ang, _ = voo.estado()
    return {"deslocamento_mm": np.round(p - p0, 1).tolist(), "velocidade_mm_s": np.round(v, 0).tolist(),
            "arfagem": round(float(np.degrees(ang[1])), 1), "rolagem": round(float(np.degrees(ang[0])), 1),
            "guinada": round(float(np.degrees(ang[2])), 1), "pior_desvio_graus": round(float(np.degrees(pior)), 1)}


for nome, kw in (("sem reflexo", {"com_reflexo": False}), ("com reflexo, rumo 0°", {}), ("com reflexo, rumo +45°", {"rumo_alvo": np.radians(45)})):
    print(f"{nome:24s} {SECS:.2f} s:", voar(**kw), flush=True)
