"""Modelo de voo compartilhado: FlyBody (flygym 2.1) pronto para voar, com o padrão de batida de asa.

Ajustes em relação ao FlyBody do flygym, todos medidos em corpo/voo_teste.py:
- elipsoides de fluido nas asas, do flybody original (o flygym os descarta): é o modelo de forças do ar do
  MuJoCo que gera sustentação;
- ar de verdade: 1,28e-6 g/mm³ e 1,85e-5 g/(mm·s). O flygym deixa os valores do flybody em unidades de cm,
  o que em mm dá um ar 1000x mais denso que o real;
- só as juntas das asas: as juntas passivas levíssimas de patas, abdome e antenas vibravam com a batida
  de 218 Hz até a simulação explodir;
- ganho e amortecimento de voo do flybody original (1800 e 0,777 em mm), armadura das asas desprezível e
  integrador implícito.
"""
import mujoco as mj
import numpy as np
from flygym.compose import ActuatorType, FlatGroundWorld, FlyBody
from flygym.flybody import FlyBodyAxisOrder, FlyBodyJointPreset, FlyBodySkeleton
from flygym.simulation import Simulation
from flygym.utils.math import Rotation3D

F_ASA, DT, DT_CTRL, G = 218.0, 5e-5, 2e-4, 9810.0
PITCH_VOO = np.radians(47.5)
FLUIDO = {  # lado: (pos mm, quat) do elipsoide de fluido no referencial da asa (flybody original x10)
    "l": ((0.263, -1.48, -0.289), (-0.685, -0.634, 0.265, -0.243)),
    "r": ((-0.263, 1.48, 0.289), (0.243, 0.265, 0.634, -0.685)),
}


def montar(altura=50.0, ganho=1800.0, armadura=1e-6):
    fly = FlyBody()
    juntas = [j for j in FlyBodyJointPreset.ALL_BIOLOGICAL.to_joint_list() if "wing" in str(j)]
    sk = FlyBodySkeleton(axis_order=FlyBodyAxisOrder.YAW_ROLL_PITCH, anatomical_joints=juntas)
    fly.add_joints(sk)
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
    q = (np.cos(-PITCH_VOO / 2), 0, np.sin(-PITCH_VOO / 2), 0)   # nariz para cima
    world.add_fly(fly, spawn_position=[0, 0, altura], spawn_rotation=Rotation3D("quat", q),
                  bodysegs_with_ground_contact="legs_thorax_abdomen_head", add_ground_contact_sensors=False)
    sim = Simulation(world, timestep=DT)
    m = sim.mj_model
    for j in range(m.njnt):
        if "wing" in (mj.mj_id2name(m, mj.mjtObj.mjOBJ_JOINT, j) or ""):
            m.dof_armature[m.jnt_dofadr[j]] = armadura
            m.dof_damping[m.jnt_dofadr[j]] = 0.777
    for a in range(m.nu):
        if "wing" in (mj.mj_id2name(m, mj.mjtObj.mjOBJ_ACTUATOR, a) or ""):
            m.actuator_gainprm[a][0] = ganho
            m.actuator_biasprm[a][1] = -ganho
            m.actuator_ctrlrange[a] = [-3.2, 3.2]
    m.opt.density, m.opt.viscosity = 1.28e-6, 1.85e-5
    m.opt.integrator = mj.mjtIntegrator.mjINT_IMPLICITFAST
    sim.reset()
    mj.mj_forward(m, sim.mj_data)
    return Voo(fly, sim)


class Voo:
    """Acesso direto ao corpo e às asas: ângulos de cada asa (esquerda, direita) e estado do tórax."""

    def __init__(self, fly, sim):
        self.fly, self.sim = fly, sim
        self.m, self.d = sim.mj_model, sim.mj_data
        ordem = fly.get_actuated_jointdofs_order(ActuatorType.POSITION)
        self.col = []   # (índice no vetor de controle, eixo 0=guinada 1=rolagem 2=arfagem, é a asa direita)
        for i, dof in enumerate(ordem):
            eixo = str(dof.axis).split(".")[-1].split(":")[0].strip().lower()
            self.col.append((i, {"yaw": 0, "roll": 1, "pitch": 2}[eixo], dof.child.name.startswith("r_")))
        self.ctrl = np.zeros(len(ordem))
        raiz = next(j for j in range(self.m.njnt) if self.m.jnt_type[j] == mj.mjtJoint.mjJNT_FREE)
        self.qa, self.va = self.m.jnt_qposadr[raiz], self.m.jnt_dofadr[raiz]

    def asas(self, esq, dir_):
        for i, e, direita in self.col:
            self.ctrl[i] = (dir_ if direita else esq)[e]
        self.sim.set_actuator_inputs(self.fly.name, ActuatorType.POSITION, self.ctrl)

    def estado(self):
        """posição (mm), velocidade (mm/s), ângulos de Euler do tórax (rolagem, arfagem, guinada) e velocidade angular."""
        q = self.d.qpos[self.qa:self.qa + 7]
        w, x, y, z = q[3:]
        roll = np.arctan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
        pitch = np.arcsin(np.clip(2 * (w * y - z * x), -1, 1))
        yaw = np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
        return q[:3].copy(), self.d.qvel[self.va:self.va + 3].copy(), np.array([roll, pitch, yaw]), self.d.qvel[self.va + 3:self.va + 6].copy()


def batida(p, t, extra=None):
    """Ângulos (guinada, rolagem, arfagem) de uma asa no instante t; `extra` soma deslocamentos de controle."""
    e = extra or {}
    x = 2 * np.pi * F_ASA * t
    return np.array([
        (p["Ay"] + e.get("Ay", 0)) * np.sin(x - np.pi / 2) + p["Oy"] + e.get("Oy", 0),
        p["Ar"] * np.sin(1.5 * x) + p["Or"],
        p["Ap"] * np.sin(x + p["fase"]) + p["Op"] + e.get("Op", 0),
    ])
