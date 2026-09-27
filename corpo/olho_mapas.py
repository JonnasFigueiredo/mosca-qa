"""Olhos reais: pré-calcula, a partir do modelo de olho do flygym, a tabela que a página usa para amostrar o
mundo 3D pelos 721 omatídeos de cada olho.

O flygym simula cada olho assim (flygym/vision/retina.py): uma câmera perspectiva com 157° de campo vertical
renderiza 512x450 px; a imagem passa por uma correção de olho de peixe (que iguala o ângulo por pixel);
cada pixel corrigido pertence a um omatídeo (vision/ommatidia_id_map.npy) e soma o canal verde (omatídeos
"amarelos") ou azul ("pálidos", vision/pale_mask.npy) na média daquele omatídeo.

Aqui a mesma coisa numa grade 4x menor (128x112): para cada pixel da imagem corrigida, qual pixel da câmera
ele lê e a qual omatídeo pertence. Também guarda a posição e a orientação das câmeras dos olhos no corpo
(vision.yaml) e, para cada omatídeo de cada olho, a direção em que ele olha em relação ao corpo (azimute:
+ para a esquerda, 0 à frente; elevação: + para cima), calculada com a câmera do próprio modelo com a mosca
parada. Grava web/data/olho_mapas.json.

uso: .venv/Scripts/python.exe corpo/olho_mapas.py
"""
import json
from pathlib import Path

import numpy as np
import yaml

import flygym

BASE = Path(flygym.__file__).resolve().parent / "assets/model/neuromechfly"
cfg = yaml.safe_load((BASE / "vision.yaml").read_text(encoding="utf-8"))
ids = np.load(BASE / "vision/ommatidia_id_map.npy")      # (512, 450), 0 = fora de qualquer omatídeo
palido = np.load(BASE / "vision/pale_mask.npy")          # (721,)
NR, NC = cfg["raw_img_height_px"], cfg["raw_img_width_px"]
K = 4
nr, nc = NR // K, NC // K
zoom, dist = cfg["fisheye_zoom"], cfg["fisheye_distortion_coefficient"]

fonte, omat = [], []
for r in range(nr):
    for c in range(nc):
        R, C = r * K + K // 2, c * K + K // 2            # centro do bloco na grade original
        rn = ((2 * R - NR) / NR) / zoom
        cn = ((2 * C - NC) / NC) / zoom
        den = 1 - dist * (rn * rn + cn * cn) + 1e-6
        sr, sc = int(((rn / den + 1) * NR) / 2), int(((cn / den + 1) * NC) / 2)
        o = int(ids[R, C])
        if o > 0 and 0 <= sr < NR and 0 <= sc < NC:
            fonte.append((sr // K) * nc + (sc // K))
            omat.append(o - 1)
        else:
            fonte.append(-1)
            omat.append(-1)

omat = np.array(omat)

# direção de cada omatídeo no corpo: raio de cada pixel da câmera (antes da correção), levado pela orientação
# da câmera do olho com a mosca na pose inicial (olhando para +x, y para a esquerda, z para cima)
import sys  # noqa: E402
sys.path.insert(0, str(Path(__file__).resolve().parent / "terceiros"))
import mujoco as mj  # noqa: E402
from flygym.compose import FlatGroundWorld  # noqa: E402
from flygym.simulation import Simulation  # noqa: E402
from flygym.utils.math import Rotation3D  # noqa: E402
from flygym_demo.complex_terrain import make_locomotion_fly  # noqa: E402

fly = make_locomotion_fly()
fly.add_vision()
w = FlatGroundWorld()
w.add_fly(fly, spawn_position=[0, 0, 1.0], spawn_rotation=Rotation3D("quat", [1, 0, 0, 0]), add_ground_contact_sensors=False)
sim = Simulation(w)
mj.mj_forward(sim.mj_model, sim.mj_data)
nomes = sorted(fly.eyecameraname_to_mjcfcamera, key=lambda n: 0 if n.startswith("l") else 1)
ty = np.tan(np.radians(cfg["fovy_per_eye"]) / 2)
tx = ty * NC / NR
direcoes = []
for n in nomes:
    cid = mj.mj_name2id(sim.mj_model, mj.mjtObj.mjOBJ_CAMERA, fly.eyecameraname_to_mjcfcamera[n].name)
    R = sim.mj_data.cam_xmat[cid].reshape(3, 3)
    acc = np.zeros((int(cfg["num_ommatidia_per_eye"]), 3))
    for k, (src, o) in enumerate(zip(fonte, omat)):
        if o < 0:
            continue
        sr, sc = divmod(src, nc)
        yn = (2 * (sr * K + K / 2) - NR) / NR
        xn = (2 * (sc * K + K / 2) - NC) / NC
        ray = np.array([xn * tx, -yn * ty, -1.0])
        acc[o] += R @ (ray / np.linalg.norm(ray))
    acc /= np.linalg.norm(acc, axis=1, keepdims=True)
    az = np.degrees(np.arctan2(acc[:, 1], acc[:, 0]))
    el = np.degrees(np.arcsin(np.clip(acc[:, 2], -1, 1)))
    direcoes.append(np.round(np.c_[az, el], 1).tolist())
    print(f"olho {n}: azimute {az.min():.0f}° a {az.max():.0f}°, elevação {el.min():.0f}° a {el.max():.0f}°")
n_por = np.bincount(omat[omat >= 0], minlength=int(cfg["num_ommatidia_per_eye"]))
out = {
    "fonte": "flygym 2.1 (NeuroMechFly v2, Apache 2.0): vision.yaml, ommatidia_id_map.npy, pale_mask.npy",
    "linhas": nr, "colunas": nc, "fovy": cfg["fovy_per_eye"], "omatidios": int(cfg["num_ommatidia_per_eye"]),
    "fonte_px": fonte, "omatidio_px": omat.tolist(), "pixels_por_omatidio": n_por.tolist(),
    "palido": palido.astype(int).tolist(), "cameras": cfg["sensors"],
    "direcao": direcoes,   # [olho esquerdo, olho direito] x 721 x [azimute, elevação] em graus
}
dest = Path(__file__).resolve().parent.parent / "web/data/olho_mapas.json"
dest.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
print(f"{nr}x{nc} px, {int((omat >= 0).sum())} pixels em omatídeos, omatídeos sem pixel: {int((n_por == 0).sum())}, "
      f"{dest.stat().st_size // 1024} KB em {dest}")
