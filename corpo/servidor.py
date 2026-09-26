"""Corpo físico da mosca: servidor local para a página.

A física roda aqui (NeuroMechFly no MuJoCo, via flygym 2) com o controlador híbrido do exemplo oficial do
flygym: gerador de ritmo trípode, passadas gravadas de moscas reais e reflexos de tropeço e de pata no
vazio. O cérebro continua no navegador e manda o sinal descendente [esquerda, direita]; aqui a física
avança até o tempo do cérebro e devolve a pose de cada peça do corpo para a página desenhar.

Só biblioteca padrão (http.server), sem dependências a mais.

uso (na raiz do projeto): .venv/Scripts/python.exe corpo/servidor.py [porta]

Ao iniciar, grava a malha do corpo em web/data/corpo_malha.json e corpo_malha.bin (vértices float32 em mm,
seguidos das faces uint32); a página carrega de lá, pelo mesmo servidor dos dados do cérebro.

GET  /ping        o servidor está de pé?
POST /passo       {"t": tempo do cérebro em s, "sinal": [esq, dir]} -> pose atual do corpo
POST /teleporte   {"x", "y" em mm, "rumo" em rad}: põe o corpo ali (depois de um voo)
POST /reset       volta a mosca para o começo
"""
import json
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import mujoco as mj
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

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
DT = 2e-4         # passo da física (s). Medido: igual a 0,1 ms na passada e ~2× mais rápido
DEC = 10          # o controlador roda a cada 10 passos de física (500 Hz); a 250 Hz as curvas pioram
MAX_ATRASO = 2.0  # s: se o cérebro estiver muito à frente (página pausada e retomada), o corpo pula

# cores por peça, só para desenhar
def cor(nome):
    if nome.endswith("_eye"):
        return [0.72, 0.2, 0.16]
    if "wing" in nome:
        return [0.86, 0.9, 0.93]
    if "abdomen" in nome or "a" == nome[:1] and "abd" in nome:
        return [0.42, 0.3, 0.18]
    if any(p in nome for p in ("coxa", "femur", "tibia", "tarsus", "trochanter")):
        return [0.3, 0.22, 0.14]
    return [0.45, 0.33, 0.2]


class Corpo:
    def __init__(self):
        self.lock = threading.Lock()
        self.fly = make_locomotion_fly()
        self.fly.add_vision()   # as câmeras dos olhos, como o flygym as define (a página renderiza por elas)
        world = FlatGroundWorld()
        world.add_fly(self.fly, spawn_position=[0, 0, 1.0], spawn_rotation=Rotation3D("quat", [1, 0, 0, 0]),
                      add_ground_contact_sensors=True)
        self.sim = Simulation(world, timestep=DT)
        self.m = self.sim.mj_model
        self.ctrl = HybridTurningController(timestep=self.sim.timestep * DEC)
        self.thorax = self.fly.get_bodysegs_order().index(type(self.fly).BODY_SEGMENT_CLASS("c_thorax"))
        self.geoms = [g for g in range(self.m.ngeom) if self.m.geom_type[g] == mj.mjtGeom.mjGEOM_MESH]
        # a junta livre do tórax: é por ela que a mosca é posta em outro lugar (depois de um voo)
        self.raiz = next(j for j in range(self.m.njnt) if self.m.jnt_type[j] == mj.mjtJoint.mjJNT_FREE)
        cams = {n: mj.mj_name2id(self.m, mj.mjtObj.mjOBJ_CAMERA, c.name) for n, c in self.fly.eyecameraname_to_mjcfcamera.items()}
        self.cams = [cams[n] for n in sorted(cams, key=lambda n: 0 if n.startswith("l") else 1)]   # esquerdo, direito
        # tato: força de contato de cada pata com o chão, em frações do peso da mosca
        self.pernas = [str(p) for p in self.fly.get_legs_order()]
        self.peso = float(self.m.body_subtreemass[self.m.jnt_bodyid[self.raiz]] * abs(self.m.opt.gravity[2]))
        self.alvo = 0.0
        self.sinal = np.zeros(2)
        self.reset()
        threading.Thread(target=self._laco, daemon=True).start()

    def reset(self):
        with self.lock:
            self.sim.reset()
            mj.mj_forward(self.sim.mj_model, self.sim.mj_data)   # pose já calculada antes do primeiro passo
            self.ctrl.reset(seed=0)
            self.t = 0.0
            self.alvo = 0.0

    def _laco(self):
        # a física corre atrás do tempo do cérebro, com o último sinal recebido
        dt = self.sim.timestep * DEC
        while True:
            if self.t + dt <= self.alvo:
                with self.lock:
                    obs = HybridControllerObservation.from_sim(self.sim, self.fly.name)
                    acao = self.ctrl.step(self.sinal.copy(), obs)
                    apply_locomotion_action(self.sim, self.fly.name, acao)
                    for _ in range(DEC):
                        self.sim.step()
                    self.t += dt
            else:
                time.sleep(0.001)

    def passo(self, t, sinal):
        s = np.clip(np.asarray(sinal, float), -1.5, 1.5)
        with self.lock:
            self.sinal = s
            self.alvo = max(self.alvo, float(t))
            if self.alvo - self.t > MAX_ATRASO:
                self.t = self.alvo - MAX_ATRASO
            d = self.sim.mj_data
            pos = np.round(d.geom_xpos[self.geoms], 4)
            mat = np.round(d.geom_xmat[self.geoms], 4)
            q = self.sim.get_body_rotations(self.fly.name)[self.thorax]
            p = self.sim.get_body_positions(self.fly.name)[self.thorax]
            _, forcas, *_ = self.sim.get_ground_contact_info(self.fly.name)
            toque = {perna: round(float(np.linalg.norm(f)) / self.peso, 3) for perna, f in zip(self.pernas, forcas)}
            olhos = [np.round(np.concatenate([d.cam_xpos[c], d.cam_xmat[c]]), 4).tolist() for c in self.cams]
        w, x, y, z = q
        rumo = float(np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)))
        return {"t": round(self.t, 4), "torax": [round(float(v), 4) for v in p], "rumo": round(rumo, 4), "toque": toque, "olhos": olhos,
                "geoms": np.concatenate([pos, mat], axis=1).ravel().tolist()}

    def teleporte(self, x, y, rumo):
        # põe o corpo em (x, y) mm, virado para `rumo` (rad), parado; as patas ficam como estavam
        with self.lock:
            m, d = self.m, self.sim.mj_data
            a, v = m.jnt_qposadr[self.raiz], m.jnt_dofadr[self.raiz]
            d.qpos[a:a + 2] = [x, y]
            d.qpos[a + 3:a + 7] = [np.cos(rumo / 2), 0, 0, np.sin(rumo / 2)]
            d.qvel[v:v + 6] = 0
            mj.mj_forward(m, d)

    def malha(self):
        m = self.m
        pecas, verts, faces, nv = [], [], [], 0
        for g in self.geoms:
            mid = m.geom_dataid[g]
            va, vn = m.mesh_vertadr[mid], m.mesh_vertnum[mid]
            fa, fn = m.mesh_faceadr[mid], m.mesh_facenum[mid]
            nome = mj.mj_id2name(m, mj.mjtObj.mjOBJ_GEOM, g) or f"geom{g}"
            pecas.append({"nome": nome, "v0": int(nv), "nv": int(vn), "f0": len(faces) // 3 if faces else 0, "nf": int(fn), "cor": cor(nome)})
            verts.append(m.mesh_vert[va:va + vn])
            faces.extend((m.mesh_face[fa:fa + fn]).ravel().tolist())   # índices locais à peça
            nv += int(vn)
        v = np.concatenate(verts).astype(np.float32)
        f = np.asarray(faces, np.uint32)
        # f0 correto: posição da peça em faces
        acc = 0
        for p in pecas:
            p["f0"] = acc
            acc += p["nf"]
        return {"pecas": pecas, "nv": int(len(v)), "nf": int(len(f) // 3)}, v.tobytes() + f.tobytes()


corpo = None


class Handler(BaseHTTPRequestHandler):
    def _cabecalhos(self, tipo, n):
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(n))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def _json(self, obj, code=200):
        b = json.dumps(obj, separators=(",", ":")).encode()
        self.send_response(code)
        self._cabecalhos("application/json", len(b))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cabecalhos("text/plain", 0)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/ping"):
            self._json({"ok": True, "t": corpo.t})
        else:
            self._json({"erro": "não existe"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        dados = json.loads(self.rfile.read(n) or b"{}")
        if self.path.startswith("/passo"):
            self._json(corpo.passo(dados.get("t", 0), dados.get("sinal", [0, 0])))
        elif self.path.startswith("/teleporte"):
            corpo.teleporte(float(dados["x"]), float(dados["y"]), float(dados["rumo"]))
            self._json({"ok": True})
        elif self.path.startswith("/reset"):
            corpo.reset()
            self._json({"ok": True})
        else:
            self._json({"erro": "não existe"}, 404)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    corpo = Corpo()
    MALHA_INFO, MALHA_BIN = corpo.malha()
    dados = Path(__file__).resolve().parent.parent / "web" / "data"
    (dados / "corpo_malha.json").write_text(json.dumps(MALHA_INFO), encoding="utf-8")
    (dados / "corpo_malha.bin").write_bytes(MALHA_BIN)
    print(f"corpo físico pronto: {len(MALHA_INFO['pecas'])} peças, {MALHA_INFO['nv']} vértices, {MALHA_INFO['nf']} triângulos; "
          f"http://localhost:{PORTA}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORTA), Handler).serve_forever()
