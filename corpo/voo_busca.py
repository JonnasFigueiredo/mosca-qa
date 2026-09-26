"""Voo físico, passo 2: busca um padrão de batida de asa que sustente o peso sem tombar.

Mesmo modelo de corpo_teste/voo_teste (FlyBody só com as juntas das asas, elipsoides de fluido do flybody,
ar de verdade). Cada candidato é um padrão periódico de guinada, rolagem e arfagem da asa; a mosca parte
parada, inclinada como em voo, e bate as asas por alguns ciclos. Mede:
  sustentação = 1 + aceleração vertical / g   (1,0 = sustenta o próprio peso)
  giro        = aceleração angular de arfagem (rad/s²), que precisa ficar perto de zero
Busca aleatória com refinamento em torno dos melhores. Salva o ranking em docs/medicoes/voo-busca.json.

uso: .venv/Scripts/python.exe corpo/voo_busca.py [candidatos] [ciclos por teste]
"""
import json
import sys
import time
from pathlib import Path

import mujoco as mj
import numpy as np

sys.argv = [sys.argv[0], "0.0", "1", "1800", "1e-6", "1"] + sys.argv[1:]
_src = (Path(__file__).resolve().parent / "voo_teste.py").read_text(encoding="utf-8").split("VARIANTES = [")[0]
_ns = {"__name__": "voo_busca"}
exec(compile(_src, "voo_teste", "exec"), _ns)   # reusa montar() e as constantes do teste
N = int(sys.argv[6]) if len(sys.argv) > 6 else 300
CICLOS = int(sys.argv[7]) if len(sys.argv) > 7 else 4
F, DT, DT_CTRL, G = _ns["F_ASA"], _ns["DT"], _ns["DT_CTRL"], 9810.0

fly, sim, asas = _ns["montar"]()
m, d = sim.mj_model, sim.mj_data
ordem = fly.get_actuated_jointdofs_order(_ns["ActuatorType"].POSITION)
col = {}
for i, dof in enumerate(ordem):
    eixo = str(dof.axis).split(".")[-1].split(":")[0].strip().lower()
    col[i] = ({"yaw": 0, "roll": 1, "pitch": 2}[eixo], dof.child.name.startswith("r_"))
torax = fly.get_bodysegs_order().index(type(fly).BODY_SEGMENT_CLASS("c_thorax"))
raiz = next(j for j in range(m.njnt) if m.jnt_type[j] == mj.mjtJoint.mjJNT_FREE)
va = m.jnt_dofadr[raiz]
n_ctrl = int(round(DT_CTRL / DT))
LIMITES = {  # amplitude e deslocamento (rad), fase da arfagem em relação à guinada
    "Ay": (0.4, 2.2), "Oy": (-1.5, 1.4), "Ar": (0.0, 0.6), "Or": (-0.8, 0.5),
    "Ap": (0.3, 2.3), "Op": (-2.5, 2.5), "fase": (-np.pi, np.pi),
}
AQUECE = 2   # ciclos iniciais fora da medida (as asas partem do repouso)


def angulos(p, t):
    x = 2 * np.pi * F * t
    return np.array([p["Ay"] * np.sin(x - np.pi / 2) + p["Oy"], p["Ar"] * np.sin(1.5 * x) + p["Or"],
                     p["Ap"] * np.sin(x + p["fase"]) + p["Op"]])


def avaliar(p):
    sim.reset()
    mj.mj_forward(m, d)
    passos = int((CICLOS + AQUECE) / F / DT)
    marca = int(AQUECE / F / DT)
    ctrl = np.zeros(len(ordem))
    v0 = None
    for i in range(passos):
        if i == marca:
            v0 = d.qvel[va:va + 6].copy()
        if i % n_ctrl == 0:
            a = angulos(p, i * DT)
            for k, (e, _) in col.items():
                ctrl[k] = a[e]
            sim.set_actuator_inputs(fly.name, _ns["ActuatorType"].POSITION, ctrl)
        sim.step()
        if not np.isfinite(d.qvel[va:va + 6]).all():
            return None
    T = (passos - marca) * DT
    dv = d.qvel[va:va + 6] - v0
    vz, wy, vx = dv[2], dv[4], dv[0]
    return {"sustentacao": round(1 + (vz / T) / G, 3), "giro": round(float(wy / T), 1), "frente": round(float(vx / T) / G, 3)}


def nota(r):
    if r is None:
        return -1e9
    return -abs(r["sustentacao"] - 1.1) * 4 - abs(r["giro"]) / 2e4


rng = np.random.default_rng(0)
res = []
t0 = time.time()
for k in range(N):
    if k < N // 2 or not res:
        p = {n: float(rng.uniform(*lim)) for n, lim in LIMITES.items()}
    else:   # refina em torno de um dos 5 melhores
        base = sorted(res, key=lambda x: -x["nota"])[rng.integers(0, min(5, len(res)))]["padrao"]
        p = {n: float(np.clip(base[n] + rng.normal(0, 0.12 * (lim[1] - lim[0])), *lim)) for n, lim in LIMITES.items()}
    r = avaliar(p)
    res.append({"padrao": {n: round(v, 3) for n, v in p.items()}, "resultado": r, "nota": nota(r)})
    if (k + 1) % 20 == 0:
        best = max(res, key=lambda x: x["nota"])
        print(f"{k + 1}/{N} ({time.time() - t0:.0f} s) melhor: {best['resultado']} {best['padrao']}", flush=True)

ranking = sorted(res, key=lambda x: -x["nota"])[:15]
dest = Path(__file__).resolve().parent.parent / "docs/medicoes/voo-busca.json"
dest.write_text(json.dumps({"ciclos_por_teste": CICLOS, "frequencia_hz": F, "candidatos": N,
                            "alvo": "sustentacao ~1,1 (um pouco acima do peso) e giro de arfagem perto de 0",
                            "ranking": ranking}, ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em", dest)
for r in ranking[:5]:
    print(r["resultado"], r["padrao"])
