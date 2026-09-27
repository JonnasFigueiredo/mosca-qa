"""Escalada, passo 2: andando contra uma parede, ela passa sozinha do chão para a parede?

Um bloco de 10 mm de altura à frente, a mosca andando reto para ele (com a correção de rumo que o cérebro
faria). Física da escalada (ver parede_teste.py): adesão de 20x o peso por pata, contato das almofadinhas com
margem de 0,3 mm e cone de atrito elíptico. Mede a altura do tórax e a inclinação do corpo ao longo de 4 s.

uso: .venv/Scripts/python.exe corpo/quina_teste.py
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "terceiros"))
from flygym.simulation import Simulation  # noqa: E402
from flygym.utils.math import Rotation3D  # noqa: E402
from flygym_demo.complex_terrain import (  # noqa: E402
    HybridControllerObservation,
    HybridTurningController,
    apply_locomotion_action,
    make_locomotion_fly,
)
from servidor import MundoPlataformas, ajustar_escalada, ADESAO  # noqa: E402

fly = make_locomotion_fly(adhesion_gain=ADESAO)
w = MundoPlataformas([(6.0, 0.0, 1.0, 15.0, 5.0)])
w.add_fly(fly, spawn_position=[0, 0, 1.0], spawn_rotation=Rotation3D("quat", [1, 0, 0, 0]), add_ground_contact_sensors=False)
sim = Simulation(w, timestep=2e-4)
ajustar_escalada(sim.mj_model, fly)
ctrl = HybridTurningController(timestep=2e-3)
sim.reset()
ctrl.reset(seed=0)
tor = fly.get_bodysegs_order().index(type(fly).BODY_SEGMENT_CLASS("c_thorax"))
for k in range(2000):
    q = sim.get_body_rotations(fly.name)[tor]
    ww, x, y, z = q
    yaw = np.arctan2(2 * (ww * z + x * y), 1 - 2 * (y * y + z * z))
    pitch = np.degrees(np.arcsin(np.clip(2 * (ww * y - z * x), -1, 1)))
    c = float(np.clip(1.0 * yaw, -0.8, 0.8))
    obs = HybridControllerObservation.from_sim(sim, fly.name)
    apply_locomotion_action(sim, fly.name, ctrl.step(np.array([1.0 + c, 1.0 - c]), obs))
    for _ in range(10):
        sim.step()
    if k % 100 == 0:
        p = sim.get_body_positions(fly.name)[tor]
        print(f"t {k * 2e-3:.1f} s  x {p[0]:6.2f}  z {p[2]:5.2f}  inclinação {pitch:6.1f}°  rumo {np.degrees(yaw):6.1f}°", flush=True)
