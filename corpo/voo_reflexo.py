"""Voo físico, passo 4: busca os ganhos e sinais do reflexo de estabilização (o papel dos halteres).

O erro de atitude é calculado por quatérnio no referencial do corpo (a velocidade angular da junta livre
do MuJoCo também está nesse referencial) contra a atitude de voo: nariz 47,5° para cima, no rumo pedido.
A cada batida (218 Hz) o reflexo ajusta:
  deslocamento do golpe (Oy, as duas asas)       -> arfagem
  diferença de amplitude (Ay esquerda - direita) -> rolagem
  diferença de deslocamento (Oy esq. - dir.)     -> guinada (o rumo)
  amplitude (Ay, as duas asas)                   -> altura
Busca aleatória nos sinais de cada malha, na rapidez do reflexo e no espelhamento da asa direita; a nota é
quanto tempo ela fica no ar sem passar de 30° de erro de atitude, e quanto se afasta da altura inicial.
Salva o ranking em docs/medicoes/voo-reflexo.json.

uso: .venv/Scripts/python.exe corpo/voo_reflexo.py [candidatos] [segundos por voo]
"""
import json
import sys
import time
from pathlib import Path

import mujoco as mj
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voo_modelo import DT, F_ASA, G, PITCH_VOO, batida, montar  # noqa: E402

N = int(sys.argv[1]) if len(sys.argv) > 1 else 200
AQUECE = 4   # batidas com o corpo seguro antes de soltar
SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 0.25
RAIZ = Path(__file__).resolve().parent.parent
ranking = json.loads((RAIZ / "docs/medicoes/voo-busca.json").read_text(encoding="utf-8"))["ranking"]
BASES = [r["padrao"] for r in ranking[:6]]
voo = montar()
m, d = voo.m, voo.d
n_ciclo = int(round(1 / F_ASA / DT))


def quat_mul(a, b):
    w1, x1, y1, z1 = a
    w2, x2, y2, z2 = b
    return np.array([w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
                     w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2])


def alvo(rumo):
    qy = np.array([np.cos(rumo / 2), 0, 0, np.sin(rumo / 2)])
    qp = np.array([np.cos(-PITCH_VOO / 2), 0, np.sin(-PITCH_VOO / 2), 0])
    return quat_mul(qy, qp)


def erro_corpo(q, qa):
    # rotação que leva a atitude atual à desejada, no referencial do corpo (vetor de ângulo pequeno)
    qe = quat_mul(np.array([q[0], -q[1], -q[2], -q[3]]), qa)
    return 2 * np.sign(qe[0] or 1) * qe[1:]


def voar(c, rumo=0.0):
    base = BASES[c["base"]]
    voo.sim.reset()
    mj.mj_forward(m, d)
    z0 = d.qpos[voo.qa + 2]
    # alvo: a própria atitude inicial (nariz para cima), girada pelo rumo pedido em torno da vertical
    qa = quat_mul(np.array([np.cos(rumo / 2), 0, 0, np.sin(rumo / 2)]), d.qpos[voo.qa + 3:voo.qa + 7].copy())
    esp = c["espelho"]
    ex_e, ex_d = {}, {}
    t_ok = SECS
    # como uma mosca apoiada nas patas, as asas começam a bater com o corpo parado; só depois ela é solta
    segura = AQUECE * n_ciclo
    q_ini = d.qpos[voo.qa:voo.qa + 7].copy()
    for i in range(int(SECS / DT) + segura):
        if i < segura:
            if i % 4 == 0:
                voo.asas(batida(base, i * DT), batida(base, i * DT) * np.array([esp, esp, 1.0]))
            voo.sim.step()
            d.qpos[voo.qa:voo.qa + 7] = q_ini
            d.qvel[voo.va:voo.va + 6] = 0
            continue
        if (i - segura) % n_ciclo == 0:
            q = d.qpos[voo.qa + 3:voo.qa + 7]
            w = d.qvel[voo.va + 3:voo.va + 6]
            vz = d.qvel[voo.va + 2]
            e = erro_corpo(q, qa)
            if np.degrees(np.linalg.norm(e)) > 30 and t_ok == SECS:
                t_ok = (i - segura) * DT
                break
            wn, z = c["wn"], c["zeta"]
            u_p = c["sp"] * (wn ** 2 * e[1] - 2 * z * wn * w[1]) * c["kp"]
            u_r = c["sr"] * (wn ** 2 * e[0] - 2 * z * wn * w[0]) * c["kr"]
            u_y = c["sy"] * (wn ** 2 * e[2] - 2 * z * wn * w[2]) * c["ky"]
            u_z = c["kz"] * ((z0 - d.qpos[voo.qa + 2]) * c["wz"] ** 2 - 2 * c["wz"] * vz) / G
            cl = lambda x, a: float(np.clip(x, -a, a))  # noqa: E731
            u_zp = c.get("kzp", 0.0) * ((z0 - d.qpos[voo.qa + 2]) * c["wz"] ** 2 - 2 * c["wz"] * vz) / G
            ex_e = {"Oy": cl(u_p + u_y, 0.8), "Ay": cl(u_z + u_r, 0.8), "Op": cl(u_zp, 0.8)}
            ex_d = {"Oy": cl(u_p - u_y, 0.8), "Ay": cl(u_z - u_r, 0.8), "Op": cl(u_zp, 0.8)}
        if i % 4 == 0:
            t = i * DT
            ae, ad = batida(base, t, ex_e), batida(base, t, ex_d)
            ad = ad * np.array([esp, esp, 1.0])   # espelhamento da guinada e da rolagem da asa direita
            voo.asas(ae, ad)
        voo.sim.step()
        if not np.isfinite(d.qpos).all():
            return {"tempo_no_ar": 0.0, "altura": None}
    dz = float(d.qpos[voo.qa + 2] - z0)
    return {"tempo_no_ar": round(t_ok, 3), "altura": round(dz, 1)}


def nota(r):
    # ficar no ar sem tombar e sem perder altura (voar de verdade é as duas coisas). A perda conta como taxa
    # (mm/s), senão cair logo, com pouca altura perdida, parece melhor que voar e descer devagar
    if r["altura"] is None:
        return -10
    return r["tempo_no_ar"] * 20 - (abs(r["altura"]) / max(r["tempo_no_ar"], 0.02)) / 200


rng = np.random.default_rng(1)
res = []
t0 = time.time()
for k in range(N):
    if k < N * 0.6 or not res:
        c = {"base": int(rng.integers(0, len(BASES))), "espelho": float(rng.choice([1.0, -1.0])),
             "sp": float(rng.choice([1.0, -1.0])), "sr": float(rng.choice([1.0, -1.0])), "sy": float(rng.choice([1.0, -1.0])),
             "wn": float(rng.uniform(15, 120)), "zeta": float(rng.uniform(0.4, 1.4)),
             "kp": float(10 ** rng.uniform(-4.5, -2.5)), "kr": float(10 ** rng.uniform(-5.5, -3.5)), "ky": float(10 ** rng.uniform(-5.5, -3.5)),
             "kz": float(rng.uniform(0, 4)), "kzp": float(rng.uniform(-4, 4)), "wz": float(rng.uniform(4, 50))}
    else:
        b = sorted(res, key=lambda x: -x["nota"])[int(rng.integers(0, min(5, len(res))))]["reflexo"]
        c = dict(b)
        for key in ("wn", "zeta", "kz", "wz"):
            c[key] = float(max(0.01, b[key] * np.exp(rng.normal(0, 0.2))))
        c["kzp"] = float(b.get("kzp", 0.0) + rng.normal(0, 0.5))
        for key in ("kp", "kr", "ky"):
            c[key] = float(b[key] * np.exp(rng.normal(0, 0.4)))
    r = voar(c)
    res.append({"reflexo": c, "resultado": r, "nota": nota(r)})
    if (k + 1) % 10 == 0:
        best = max(res, key=lambda x: x["nota"])
        print(f"{k + 1}/{N} ({time.time() - t0:.0f} s) melhor: {best['resultado']} "
              f"sinais p{best['reflexo']['sp']:+.0f} r{best['reflexo']['sr']:+.0f} y{best['reflexo']['sy']:+.0f} esp{best['reflexo']['espelho']:+.0f}", flush=True)

rank = sorted(res, key=lambda x: -x["nota"])[:15]
(RAIZ / "docs/medicoes/voo-reflexo.json").write_text(json.dumps({"segundos_por_voo": SECS, "candidatos": N, "ranking": rank},
                                                                 ensure_ascii=False, indent=1), encoding="utf-8")
print("salvo em docs/medicoes/voo-reflexo.json")
for r in rank[:5]:
    print(r["resultado"], {k: (round(v, 5) if isinstance(v, float) else v) for k, v in r["reflexo"].items()})
