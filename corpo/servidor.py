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
POST /teleporte   {"x", "y" em mm, "rumo" em rad, "z"}: põe o corpo ali (depois de um voo); com "parede": [nx, ny]
                  (normal da face, para fora), põe o corpo de barriga para a parede, de cabeça para cima, na altura z
POST /agarrar     {"parede": [nx, ny]}: o agarrão ao começar a subir uma parede (0,2 s de força contra ela)
POST /mundo       {"plataformas": [[cx, cy, meia largura, meia prof., meia altura], ...] em mm}: refaz o mundo
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
from flygym.compose.world.complex_terrain import _ComplexTerrainWorld  # noqa: E402
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
# escalada (corpo/parede_teste.py): com a adesão padrão do flygym (4x o peso por pata) e o contato sem margem,
# ela escorrega a 45° e descola da parede ao andar. Com 20x o peso por pata, margem de 0,3 mm no contato das
# almofadinhas (a adesão puxa a pata de volta antes de encostar) e cone de atrito elíptico (sem o deslizamento
# lento do cone piramidal), ela sobe uma parede vertical a ~5 mm/s. No teto ainda cai
ADESAO = 200.0
MARGEM_ALMOFADA = 0.3


def ajustar_escalada(m, fly):
    import mujoco as mj
    ad = [i for i in range(m.nu) if m.actuator_trntype[i] == mj.mjtTrn.mjTRN_BODY]
    corpos = set(m.actuator_trnid[ad, 0])
    for i in range(m.npair):
        if m.geom_bodyid[m.pair_geom1[i]] in corpos or m.geom_bodyid[m.pair_geom2[i]] in corpos:
            m.pair_margin[i] = 0.001 + MARGEM_ALMOFADA
            m.pair_gap[i] = MARGEM_ALMOFADA
    m.opt.cone = mj.mjtCone.mjCONE_ELLIPTIC
    m.opt.impratio = 10

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


class MundoPlataformas(_ComplexTerrainWorld):
    """Chão plano mais as plataformas do sandbox, como blocos sólidos: as patas pisam e perdem o chão de verdade."""

    def __init__(self, plataformas):
        super().__init__(name="plataformas")
        self._add_ground_plane("chao", size=(1000, 1000, 1), pos=(0, 0, 0), rgba=(0.1, 0.2, 0.1, 1))
        for i, (cx, cy, hx, hy, hz) in enumerate(plataformas):
            self._add_ground_box(f"plataforma{i}", size=(hx, hy, hz), pos=(cx, cy, hz), rgba=(0.1, 0.3, 0.2, 1))


class Corpo:
    def __init__(self, plataformas=()):
        self.lock = threading.Lock()
        self.vivo = True
        self.fly = make_locomotion_fly(adhesion_gain=ADESAO)
        self.fly.add_vision()   # as câmeras dos olhos, como o flygym as define (a página renderiza por elas)
        world = MundoPlataformas(plataformas)
        # com mais de um chão, os sensores de contato do flygym não funcionam; o tato vem da força nos tarsos
        world.add_fly(self.fly, spawn_position=[0, 0, 1.0], spawn_rotation=Rotation3D("quat", [1, 0, 0, 0]),
                      add_ground_contact_sensors=False)
        self.sim = Simulation(world, timestep=DT)
        self.m = self.sim.mj_model
        ajustar_escalada(self.m, self.fly)
        self.ctrl = HybridTurningController(timestep=self.sim.timestep * DEC)
        self.thorax = self.fly.get_bodysegs_order().index(type(self.fly).BODY_SEGMENT_CLASS("c_thorax"))
        self.geoms = [g for g in range(self.m.ngeom) if self.m.geom_type[g] == mj.mjtGeom.mjGEOM_MESH]
        # a junta livre do tórax: é por ela que a mosca é posta em outro lugar (depois de um voo)
        self.raiz = next(j for j in range(self.m.njnt) if self.m.jnt_type[j] == mj.mjtJoint.mjJNT_FREE)
        cams = {n: mj.mj_name2id(self.m, mj.mjtObj.mjOBJ_CAMERA, c.name) for n, c in self.fly.eyecameraname_to_mjcfcamera.items()}
        self.cams = [cams[n] for n in sorted(cams, key=lambda n: 0 if n.startswith("l") else 1)]   # esquerdo, direito
        # tato: força de contato de cada pata com o chão, em frações do peso da mosca
        self.pernas = [str(p) for p in self.fly.get_legs_order()]
        self.tarsos = {p: [f"{p}_tarsus{i}" for i in range(1, 6)] for p in self.pernas}
        self.peso = float(self.m.body_subtreemass[self.m.jnt_bodyid[self.raiz]] * abs(self.m.opt.gravity[2]))
        # propriocepção: velocidade da junta fêmur-tíbia de cada pata (o que o órgão cordotonal sente)
        self.ft = {p: self.m.jnt_dofadr[mj.mj_name2id(self.m, mj.mjtObj.mjOBJ_JOINT, f"{self.fly.name}/{p}_trochanterfemur-{p}_tibia-pitch")]
                   for p in self.pernas}
        # tropeços desde a última consulta da página (o reflexo de tropeço do controlador, por pata)
        self.tropecos = np.zeros(6, bool)
        self.alvo = 0.0
        self.sinal = np.zeros(2)
        self.g = self.m.opt.gravity.copy()
        self.assenta_ate = -1.0
        self.reset()
        threading.Thread(target=self._laco, daemon=True).start()

    def reset(self):
        with self.lock:
            self.sim.reset()
            mj.mj_forward(self.sim.mj_model, self.sim.mj_data)   # pose já calculada antes do primeiro passo
            self.q_pe = self.sim.mj_data.qpos.copy()             # pose de pé (neutra), usada nos teleportes
            self.ctrl.reset(seed=0)
            self.t = 0.0
            self.alvo = 0.0

    def _laco(self):
        # a física corre atrás do tempo do cérebro, com o último sinal recebido
        dt = self.sim.timestep * DEC
        while self.vivo:
            if self.t + dt <= self.alvo:
                t0 = time.perf_counter()
                with self.lock:
                    if np.max(np.abs(self.sinal)) < 1e-6:
                        # Parar é sustentar a postura atual: congela a fase do controlador e mantém
                        # as almofadinhas aderentes. Regra motora, não circuito do conectoma.
                        self.sim.set_leg_adhesion_states(self.fly.name, np.ones(6, dtype=bool))
                    else:
                        obs = HybridControllerObservation.from_sim(self.sim, self.fly.name)
                        acao = self.ctrl.step(self.sinal.copy(), obs)
                        self.tropecos |= self.ctrl.last_info["stumbling_mask"]
                        apply_locomotion_action(self.sim, self.fly.name, acao)
                    for _ in range(DEC):
                        self.sim.step()
                    self.t += dt
                    if 0 <= self.assenta_ate <= self.t:
                        self.m.opt.gravity[:] = self.g   # agarrou a parede: a gravidade volta ao normal
                        self.assenta_ate = -1.0
                lento = time.perf_counter() - t0
                if lento > 0.3:
                    print(f"passo lento: {lento:.2f} s em t = {self.t:.3f} s, {self.sim.mj_data.ncon} contatos", flush=True)
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
            toque = {}
            for perna, segs in self.tarsos.items():
                f = self.sim.get_bodysegment_contact_forces(self.fly.name, segs, ground_only=True).sum(axis=0)
                toque[perna] = round(float(np.linalg.norm(f)) / self.peso, 3)
            olhos = [np.round(np.concatenate([d.cam_xpos[c], d.cam_xmat[c]]), 4).tolist() for c in self.cams]
            tropeco = {p: bool(v) for p, v in zip(self.ctrl.legs, self.tropecos)}
            self.tropecos[:] = False
            junta = {p: round(abs(float(d.qvel[a])), 2) for p, a in self.ft.items()}   # rad/s
        w, x, y, z = q
        rumo = float(np.arctan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)))
        # eixos do corpo no mundo: para onde a cabeça aponta e para onde as costas apontam (na parede, as costas
        # ficam na horizontal)
        frente = [1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y)]
        costas = [2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y)]
        return {"t": round(self.t, 4), "torax": [round(float(v), 4) for v in p], "rumo": round(rumo, 4), "toque": toque, "olhos": olhos,
                "frente": [round(float(v), 3) for v in frente], "costas": [round(float(v), 3) for v in costas],
                "tropeco": tropeco, "junta": junta,
                "geoms": np.concatenate([pos, mat], axis=1).ravel().tolist()}

    def teleporte(self, x, y, rumo, z=None, parede=None):
        # põe o corpo em (x, y) mm, virado para `rumo` (rad), de pé e parado sobre o piso (z em mm).
        # Todas as juntas voltam à pose neutra e o controlador recomeça: depois de um voo ela nunca pousa embolada.
        # Com parede=[nx, ny] (normal da face, para fora): de barriga para a face, cabeça para cima, na altura z
        with self.lock:
            m, d = self.m, self.sim.mj_data
            a = m.jnt_qposadr[self.raiz]
            d.qpos[:] = self.q_pe
            if parede is None:
                self.m.opt.gravity[:] = self.g
                self.assenta_ate = -1.0
                d.qpos[a:a + 3] = [x, y, (z or 0.0) + 1.3]
                d.qpos[a + 3:a + 7] = [np.cos(rumo / 2), 0, 0, np.sin(rumo / 2)]
            else:
                nx, ny = parede
                # colunas: frente = para cima, esquerda = costas x frente, costas = normal da face
                R = np.array([[0, ny, nx], [0, -nx, ny], [1, 0, 0]], float)
                quat = np.zeros(4)
                mj.mju_mat2Quat(quat, R.ravel())
                d.qpos[a:a + 3] = [x + 1.3 * nx, y + 1.3 * ny, z or 1.5]
                d.qpos[a + 3:a + 7] = quat
                # a virada do chão para a parede é uma transição nossa: por 0,2 s a gravidade aponta para a parede,
                # como a mosca apertando as patas ao agarrar; depois volta ao normal e a subida é física
                self.m.opt.gravity[:] = [-nx * np.linalg.norm(self.g), -ny * np.linalg.norm(self.g), 0.0]
                self.assenta_ate = self.t + 0.2
            d.qvel[:] = 0
            if d.act.size:
                d.act[:] = 0
            mj.mj_forward(m, d)
            self.ctrl.reset(seed=0)

    def agarrar(self, nx, ny, s=0.2):
        # regra nossa: por 0,2 s a gravidade aponta para a parede, como a mosca apertando as patas (e as garras) ao
        # agarrar; as passadas gravadas no chão não têm esse movimento. Depois a subida é física
        with self.lock:
            g = float(np.linalg.norm(self.g))
            self.m.opt.gravity[:] = [-nx * g, -ny * g, 0.0]
            self.assenta_ate = self.t + s

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


def trocar_corpo(novo):
    global corpo
    corpo.vivo = False
    corpo = novo


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
            corpo.teleporte(float(dados["x"]), float(dados["y"]), float(dados["rumo"]), dados.get("z"), dados.get("parede"))
            self._json({"ok": True})
        elif self.path.startswith("/agarrar"):
            nx, ny = dados["parede"]
            corpo.agarrar(float(nx), float(ny))
            self._json({"ok": True})
        elif self.path.startswith("/mundo"):
            # plataformas do sandbox, em mm: [centro x, centro y, meia largura, meia profundidade, meia altura]
            trocar_corpo(Corpo([tuple(map(float, p)) for p in dados.get("plataformas", [])]))
            self._json({"ok": True, "plataformas": len(dados.get("plataformas", []))})
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
