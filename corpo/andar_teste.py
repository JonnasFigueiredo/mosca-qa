"""Corpo físico, passo 2: a NeuroMechFly anda com passadas gravadas de moscas reais?

Usa o controlador híbrido do exemplo oficial do flygym (gerador de ritmo trípode + passadas gravadas +
reflexos de tropeço e de pata no vazio) e o controle de curva por sinal descendente [esquerda, direita].
Mede quanto ela anda em linha reta, quanto vira com sinais desiguais e a velocidade do cálculo.

uso: .venv/Scripts/python.exe corpo/andar_teste.py [segundos por teste] [passos de física por passo do controlador] [passo da física em s]
"""
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent / "terceiros"))
from flygym.compose import FlatGroundWorld  # noqa: E402
from flygym.simulation import Simulation  # noqa: E402
from flygym.utils.math import Rotation3D  # noqa: E402
from flygym_demo.complex_terrain import (  # noqa: E402
    HybridControllerObservation,
    HybridTurningController,
    apply_locomotion_action,
    make_locomotion_fly,
)

SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
DEC = int(sys.argv[2]) if len(sys.argv) > 2 else 1   # o controlador roda a cada DEC passos de física
DT = float(sys.argv[3]) if len(sys.argv) > 3 else None  # passo da física em s (padrão do modelo: 0,1 ms)

fly = make_locomotion_fly()
world = FlatGroundWorld()
world.add_fly(fly, spawn_position=[0, 0, 1.0], spawn_rotation=Rotation3D("quat", [1, 0, 0, 0]), add_ground_contact_sensors=False)
sim = Simulation(world, timestep=DT)
ctrl = HybridTurningController(timestep=sim.timestep * DEC)
thorax = fly.get_bodysegs_order().index(type(fly).BODY_SEGMENT_CLASS("c_thorax"))


def heading():
    q = sim.get_body_rotations(fly.name)[thorax]   # quaternion w, x, y, z
    w, x, y, z = q
    return np.degrees(np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)))


def run(signal, label):
    p0, h0 = sim.get_body_positions(fly.name)[thorax].copy(), heading()
    t0 = time.perf_counter()
    for _ in range(int(SECS / sim.timestep / DEC)):
        obs = HybridControllerObservation.from_sim(sim, fly.name)
        apply_locomotion_action(sim, fly.name, ctrl.step(np.asarray(signal, float), obs))
        for _ in range(DEC):
            sim.step()
    wall = time.perf_counter() - t0
    p1, h1 = sim.get_body_positions(fly.name)[thorax], heading()
    dist = np.linalg.norm((p1 - p0)[:2])
    dh = (h1 - h0 + 180) % 360 - 180
    print(f"{label:22s} andou {dist:5.2f} mm ({dist / SECS:5.2f} mm/s) · virou {dh:+6.1f}° · altura do tórax {p1[2]:.2f} mm · "
          f"{SECS / wall:.2f}× tempo real", flush=True)


sim.reset()
ctrl.reset(seed=0)
run([1.0, 1.0], "reto [1, 1]")
run([1.2, 0.4], "curva [1.2, 0.4]")
run([0.4, 1.2], "curva [0.4, 1.2]")
run([-1.0, -1.0], "ré [-1, -1]")
