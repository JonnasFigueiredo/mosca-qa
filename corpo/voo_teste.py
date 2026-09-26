"""Voo físico, passo 1: as asas do FlyBody sustentam a mosca no ar?

Monta o FlyBody (flygym 2.1) com as juntas e os atuadores de asa calibrados, recoloca nas asas os elipsoides
de fluido do flybody original (o modelo de forças do ar do MuJoCo, que o flygym descarta) e bate as asas a
218 Hz com o padrão aproximado do flybody (pattern_generators.py). Solta a mosca a 10 mm do chão, com o corpo
inclinado como em voo, e compara com as asas paradas (queda livre).

Parâmetros do flybody original (github.com/TuragaLab/flybody, Apache 2.0): física a 0,05 ms, controle a
0,2 ms, 218 Hz, corpo a 47,5°, coeficientes de fluido [1,0; 0,5; 1,5; 1,7; 1,0]; tamanhos em cm, aqui x10 (mm).

uso: .venv/Scripts/python.exe corpo/voo_teste.py [segundos] [sinal da asa direita: 1 ou -1] [ganho dos atuadores]
"""
import sys
import time

import mujoco as mj
import numpy as np
from flygym.compose import ActuatorType, FlatGroundWorld, FlyBody, KinematicPosePreset
from flygym.flybody import FlyBodyAxisOrder, FlyBodyJointPreset, FlyBodySkeleton
from flygym.simulation import Simulation
from flygym.utils.math import Rotation3D

SECS = float(sys.argv[1]) if len(sys.argv) > 1 else 0.1
SINAL_D = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
F_ASA, DT, DT_CTRL, PITCH = 218.0, 5e-5, 2e-4, np.radians(47.5)
GANHO = float(sys.argv[3]) if len(sys.argv) > 3 else 1800.0
ARMADURA = float(sys.argv[4]) if len(sys.argv) > 4 else 1e-6
SO_ASAS = (sys.argv[5] if len(sys.argv) > 5 else "1") == "1"   # 1: só as asas têm juntas
FLUIDO = {  # lado: (pos mm, quat) do elipsoide de fluido no referencial da asa
    "l": ((0.263, -1.48, -0.289), (-0.685, -0.634, 0.265, -0.243)),
    "r": ((-0.263, 1.48, 0.289), (0.243, 0.265, 0.634, -0.685)),
}


def montar():
    fly = FlyBody()
    # só as juntas das asas: o resto do corpo fica rígido (as juntas passivas de patas, abdome e antenas,
    # levíssimas, vibravam com a batida de 218 Hz até a simulação explodir)
    juntas = [j for j in FlyBodyJointPreset.ALL_BIOLOGICAL.to_joint_list() if "wing" in str(j)] if SO_ASAS else None
    sk = (FlyBodySkeleton(axis_order=FlyBodyAxisOrder.YAW_ROLL_PITCH, anatomical_joints=juntas) if SO_ASAS
          else FlyBodySkeleton(axis_order=FlyBodyAxisOrder.YAW_ROLL_PITCH, joint_preset=FlyBodyJointPreset.ALL_BIOLOGICAL))
    fly.add_joints(sk, neutral_pose=None if SO_ASAS else KinematicPosePreset.FLYBODY_NEUTRAL)
    asas = [d for d in sk.iter_jointdofs(fly.root_segment) if d.child.is_wing()]
    fly.add_actuators(asas, ActuatorType.POSITION)
    for lado, (pos, quat) in FLUIDO.items():
        corpo = next(b for b in fly.mjcf_root.bodies if b.name.endswith(f"{lado}_wing"))
        g = corpo.add_geom()
        g.name = f"{lado}_wing_fluid"
        g.type = mj.mjtGeom.mjGEOM_ELLIPSOID
        g.size = [0.005, 0.551, 1.14]
        g.pos, g.quat = pos, quat
        g.mass, g.contype, g.conaffinity, g.group = 0, 0, 0, 3
        g.fluid_ellipsoid = 1
        g.fluid_coefs = [1.0, 0.5, 1.5, 1.7, 1.0]
    world = FlatGroundWorld()
    q = (np.cos(-PITCH / 2), 0, np.sin(-PITCH / 2), 0)   # nariz para cima
    world.add_fly(fly, spawn_position=[0, 0, 50], spawn_rotation=Rotation3D("quat", q),
                  bodysegs_with_ground_contact="legs_thorax_abdomen_head", add_ground_contact_sensors=False)
    sim = Simulation(world, timestep=DT)
    # parâmetros de voo do flybody original (tasks/constants.py), convertidos de cm para mm (torque x100):
    # ganho 18 -> 1800, amortecimento 0,00777 -> 0,777. A armadura que o flygym põe nas asas (1e-4, 30x a
    # inércia da asa) exigiria torques enormes para bater a 218 Hz; aqui fica desprezível
    m = sim.mj_model
    for j in range(m.njnt):
        if "wing" in (mj.mj_id2name(m, mj.mjtObj.mjOBJ_JOINT, j) or ""):
            m.dof_armature[m.jnt_dofadr[j]] = ARMADURA
            m.dof_damping[m.jnt_dofadr[j]] = 0.777
    for a in range(m.nu):
        if "wing" in (mj.mj_id2name(m, mj.mjtObj.mjOBJ_ACTUATOR, a) or ""):
            m.actuator_gainprm[a][0] = GANHO
            m.actuator_biasprm[a][1] = -GANHO
            m.actuator_ctrlrange[a] = [-3.2, 3.2]
    # ar de verdade em g/mm³ e g/(mm·s). O flygym 2.1 deixa no FlyBody os valores do flybody em unidades de cm
    # (0,00128 e 0,000185), o que em mm dá um ar 1000x mais denso (mais que a água) e 10x mais viscoso
    m.opt.density, m.opt.viscosity = 1.28e-6, 1.85e-5
    # integrador implícito: amortecimento e ganho dos atuadores estáveis mesmo com a asa tão leve
    m.opt.integrator = mj.mjtIntegrator.mjINT_IMPLICITFAST
    sim.reset()
    mj.mj_forward(m, sim.mj_data)
    return fly, sim, asas


SINAIS = (1.0, 1.0, 1.0)   # sinais de guinada, rolagem e arfagem (os eixos das asas no flygym podem diferir do original)


def padrao(t):
    # uma batida por ciclo: guinada, rolagem e arfagem da asa (aproximação do flybody), em rad
    x = 2 * np.pi * F_ASA * t
    p = np.array([1.1 * np.sin(x - np.pi / 2) + 0.3, 0.25 * np.sin(1.5 * x) - 0.1, 1.35 * np.sin(x) + 0.8])
    return p * np.array(SINAIS)


def rodar(bater):
    fly, sim, asas = montar()
    m, d = sim.mj_model, sim.mj_data
    torax = fly.get_bodysegs_order().index(type(fly).BODY_SEGMENT_CLASS("c_thorax"))
    ordem = fly.get_actuated_jointdofs_order(ActuatorType.POSITION)
    idx = {str(dof): i for i, dof in enumerate(ordem)}
    base = sim.get_joint_angles(fly.name)[: 0]
    n_ctrl = int(round(DT_CTRL / DT))
    ctrl = np.zeros(len(ordem))
    z0 = sim.get_body_positions(fly.name)[torax][2]
    t0 = time.perf_counter()
    for i in range(int(SECS / DT)):
        if i % n_ctrl == 0 and bater:
            p = padrao(i * DT)
            for dof in asas:
                eixo = str(dof.axis).split(".")[-1].lower()
                v = p[{"yaw": 0, "roll": 1, "pitch": 2}[eixo.replace("'", "").split(":")[0].strip()]]
                if dof.child.name.startswith("r_") and eixo.startswith(("yaw", "roll")):
                    v *= SINAL_D
                ctrl[idx[str(dof)]] = v
            sim.set_actuator_inputs(fly.name, ActuatorType.POSITION, ctrl)
        sim.step()
    wall = time.perf_counter() - t0
    p = sim.get_body_positions(fly.name)[torax]
    w, x, y, z = sim.get_body_rotations(fly.name)[torax]
    pitch = np.degrees(np.arcsin(np.clip(2 * (w * y - z * x), -1, 1)))
    roll = np.degrees(np.arctan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)))
    return p - np.array([0, 0, z0]), pitch, roll, wall, float(m.body_subtreemass[1])


VARIANTES = [((1, 1, 1), "sinais + + +"), ((-1, 1, 1), "guinada -"), ((1, 1, -1), "arfagem -"), ((-1, 1, -1), "guinada - arfagem -")]
for bater, nome in [(False, "asas paradas")] + [(True, v) for v in VARIANTES]:
    if bater:
        SINAIS, nome = nome
    dp, pitch, roll, wall, massa = rodar(bater)
    print(f"{nome:22s} em {SECS:.2f} s: desceu {-dp[2]:6.2f} mm, andou x {dp[0]:+6.2f} y {dp[1]:+6.2f} mm · "
          f"arfagem {pitch:+5.1f}° rolagem {roll:+5.1f}° · massa {massa:.4f} · {SECS / wall:.3f}× tempo real", flush=True)
print(f"queda livre teórica: {0.5 * 9810 * SECS ** 2:.1f} mm (o chão está 50 mm abaixo)")
