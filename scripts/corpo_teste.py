"""Corpo físico, passo 1: quanto custa simular o corpo da mosca (NeuroMechFly, flygym 2) neste PC?

Monta a NeuroMechFly num chão plano, com as articulações das patas movidas por atuadores de posição,
e mede o tempo de relógio para simular 1 s de física, parada (pose neutra) e com as patas balançando.

uso (na .venv do projeto): .venv/Scripts/python.exe scripts/corpo_teste.py [segundos simulados]
"""
import sys
import time

import numpy as np
from flygym import Simulation
from flygym.anatomy import ActuatedDOFPreset, AxisOrder, JointPreset, Skeleton
from flygym.compose import ActuatorType, FlatGroundWorld, KinematicPosePreset, NeuroMechFly
from flygym.utils.math import Rotation3D

SIM_S = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0

fly = NeuroMechFly()
skeleton = Skeleton(axis_order=AxisOrder.YAW_PITCH_ROLL, joint_preset=JointPreset.LEGS_ONLY)
fly.add_joints(skeleton, neutral_pose=KinematicPosePreset.NEUTRAL)
dofs = ActuatedDOFPreset.LEGS_ACTIVE_ONLY.filter(list(skeleton.iter_jointdofs()))
fly.add_actuators(dofs, ActuatorType.POSITION, neutral_input=KinematicPosePreset.NEUTRAL, kp=50.0)
world = FlatGroundWorld()
world.add_fly(fly, spawn_position=(0, 0, 0.7), spawn_rotation=Rotation3D("quat", (1, 0, 0, 0)))
sim = Simulation(world)
print(f"timestep {sim.timestep * 1000:.2f} ms · {len(dofs)} articulações acionadas", flush=True)

steps = int(SIM_S / sim.timestep)

t0 = time.perf_counter()
for _ in range(steps):
    sim.step()
parada = time.perf_counter() - t0
print(f"parada: {SIM_S:.1f} s simulados em {parada:.1f} s de relógio ({SIM_S / parada:.2f}× tempo real)", flush=True)

sim.reset()
n = len(dofs)
phase = np.random.default_rng(0).uniform(0, 2 * np.pi, n)
base = np.zeros(n)
t0 = time.perf_counter()
for i in range(steps):
    t = i * sim.timestep
    sim.set_actuator_inputs(fly.name, ActuatorType.POSITION, base + 0.3 * np.sin(2 * np.pi * 10 * t + phase))
    sim.step()
mexendo = time.perf_counter() - t0
pos = sim.get_body_positions(fly.name)[0]
print(f"patas a 10 Hz: {SIM_S:.1f} s simulados em {mexendo:.1f} s de relógio ({SIM_S / mexendo:.2f}× tempo real); tórax em {np.round(pos, 2)} mm", flush=True)
