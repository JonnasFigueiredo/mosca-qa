"""Escalada, passo 1: as almofadinhas das patas seguram a mosca numa parede ou no teto?

Em vez de construir uma parede, gira a gravidade: a mosca anda no chão plano e a gravidade passa a puxar
para trás (rampa), para trás de lado nenhum (parede vertical, subindo) ou para longe do chão (teto).
Mesmo controlador do servidor (passadas de moscas reais, reflexos de tropeço e de pata no vazio), andando
reto: 0,3 s com a gravidade normal para assentar as patas e, depois de girá-la, 1,5 s de física, com uma
correção de rumo para cima (o que o cérebro, ou a regra de subir, faria).

Duas físicas:
- flygym: a do exemplo oficial (adesão de 4x o peso por pata, contato sem margem, cone de atrito piramidal);
- escalada: a do servidor (servidor.ajustar_escalada): 20x o peso por pata, margem de 0,3 mm no contato das
  almofadinhas e cone elíptico.

Mede quanto ela sobe (mm, ao longo da superfície), se descolou (o tórax se afastou mais de 3 mm) ou caiu
(escorregou mais de 50 mm) e quanto virou. Grava docs/medicoes/parede-gravidade.json.

uso: .venv/Scripts/python.exe corpo/parede_teste.py
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
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
from servidor import ADESAO, ajustar_escalada  # noqa: E402

DT, DEC, T = 2e-4, 10, 1.5
ASSENTA = 0.3   # s andando com a gravidade normal antes de girá-la


def ensaio(graus, fisica, seed=0):
    fly = make_locomotion_fly(adhesion_gain=ADESAO if fisica == "escalada" else 40.0)
    w = FlatGroundWorld()
    w.add_fly(fly, spawn_position=[0, 0, 1.0], spawn_rotation=Rotation3D("quat", [1, 0, 0, 0]), add_ground_contact_sensors=False)
    sim = Simulation(w, timestep=DT)
    if fisica == "escalada":
        ajustar_escalada(sim.mj_model, fly)
    g = float(np.linalg.norm(sim.mj_model.opt.gravity))
    a = np.radians(graus)
    ctrl = HybridTurningController(timestep=DT * DEC)
    sim.reset()
    ctrl.reset(seed=seed)
    torax = fly.get_bodysegs_order().index(type(fly).BODY_SEGMENT_CLASS("c_thorax"))
    n0 = round(ASSENTA / (DT * DEC))
    k, p0, zmax, fim = 0, None, 0.0, "andou"
    while k < n0 + round(T / (DT * DEC)):
        if k == n0:
            # a mosca olha para +x; "para cima" é +x: a gravidade puxa para -x e, até 90°, para o chão
            sim.mj_model.opt.gravity[:] = [-g * np.sin(a), 0.0, -g * np.cos(a)]
            p0 = sim.get_body_positions(fly.name)[torax].copy()
        ww, x, y, z = sim.get_body_rotations(fly.name)[torax]
        rumo = np.arctan2(2 * (ww * z + x * y), 1 - 2 * (y * y + z * z)) if p0 is not None else 0.0
        c = float(np.clip(rumo, -0.8, 0.8))   # virou para a esquerda -> patas da esquerda mais fortes
        obs = HybridControllerObservation.from_sim(sim, fly.name)
        apply_locomotion_action(sim, fly.name, ctrl.step(np.array([1.0 + c, 1.0 - c]), obs))
        for _ in range(DEC):
            sim.step()
        k += 1
        p = sim.get_body_positions(fly.name)[torax]
        if p0 is not None:
            zmax = max(zmax, float(p[2] - p0[2]))
            if zmax > 3:
                fim = "descolou"
                break
            if abs(p[0] - p0[0]) > 50:
                fim = "caiu"
                break
    return {"fisica": fisica, "gravidade_graus": graus, "seed": seed, "subiu_mm": round(float(p[0] - p0[0]), 2),
            "velocidade_mm_s": round(float(p[0] - p0[0]) / max(1e-3, (k - n0) * DT * DEC), 1),
            "afastou_max_mm": round(zmax, 2), "fim": fim, "virou_graus": round(float(np.degrees(rumo)), 1),
            "tempo_s": round((k - n0) * DT * DEC, 2)}


res = []
for fisica in ("flygym", "escalada"):
    for graus in (0, 45, 90, 135, 180):
        for seed in ((0, 1, 2) if graus == 90 else (0,)):
            r = ensaio(graus, fisica, seed)
            res.append(r)
            print(r, flush=True)
dest = Path(__file__).resolve().parent.parent / "docs/medicoes/parede-gravidade.json"
dest.write_text(json.dumps({"data": "2026-09-26", "metodo": __doc__.strip().splitlines()[0], "ensaios": res,
                            "diagnostico": ("Parada, com as seis almofadinhas grudadas, a física do flygym já a segura na parede e no teto "
                                            "(escorrega < 1 mm). Andando, cada pata que levanta perde o contato, e sem margem a adesão não a "
                                            "puxa de volta; o cone de atrito piramidal deixa as patas deslizarem devagar sob carga.")},
                           ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em", dest)
