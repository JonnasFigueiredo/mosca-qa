"""Triagem da estabilidade nas cúpulas, sem cérebro. Perfis e resultados ficam no projeto.

Uso: .venv/Scripts/python.exe -X utf8 corpo/subida_teste.py
Compara adesão 200 e 40, mantendo pegada, passo e controlador iguais.
"""
import json
from pathlib import Path
import sys
import time
import hashlib
import os
import argparse

RAIZ = Path(__file__).resolve().parent.parent
os.environ['MPLCONFIGDIR'] = str(RAIZ / '_tmp' / '_matplotlib')
os.environ['TMP'] = os.environ['TEMP'] = str(RAIZ / '_tmp')

args = argparse.ArgumentParser()
args.add_argument('--passo', type=float, default=.0002)
args.add_argument('--adesao', type=float, nargs='+', default=[200, 40])
args.add_argument('--saida', default='subida-adesao.json')
args.add_argument('--referencial-superficie', action='store_true')
args.add_argument('--referencial-corpo', action='store_true')
args.add_argument('--postura', action='store_true')
args.add_argument('--postura-chao', action='store_true')
op = args.parse_args()
sys.argv = sys.argv[:1]  # servidor lê o primeiro argumento como porta
import servidor as S
S.DT = op.passo
S.DEC = round(.002 / S.DT)
if op.referencial_superficie or op.referencial_corpo:
    original = S.HybridControllerObservation.from_sim
    def observacao(cls, sim, nome):
        obs = original(sim, nome)
        fly = sim.world.fly_lookup[nome]
        ordem = fly.get_bodysegs_order()
        pos = sim.get_body_positions(nome)
        n = -sim.mj_model.opt.gravity / S.np.linalg.norm(sim.mj_model.opt.gravity)
        if op.referencial_corpo:
            indice = ordem.index(type(fly).BODY_SEGMENT_CLASS('c_thorax'))
            corpo_id = sim._internal_bodyids_by_fly[nome][indice]
            n = sim.mj_data.xmat[corpo_id].reshape(3,3)[:,2]
        obs.thorax_z = float(pos[ordem.index(type(fly).BODY_SEGMENT_CLASS('c_thorax'))] @ n)
        obs.tarsus5_z = S.np.array([pos[ordem.index(type(fly).BODY_SEGMENT_CLASS(f'{p}_tarsus5'))] @ n for p in fly.get_legs_order()])
        return obs
    S.HybridControllerObservation.from_sim = classmethod(observacao)
if op.postura:
    pegada_original = S.Corpo._pegada
    def pegada_postura(c):
        pegada_original(c)
        m, d = c.m, c.sim.mj_data
        bid = m.jnt_bodyid[c.raiz]
        if not op.postura_chao and c.na_forma is None and S.np.linalg.norm(m.opt.gravity-c.g) < 1e-6:
            d.xfrc_applied[bid,3:] = 0
            return
        costas = d.xmat[bid].reshape(3,3)[:,2]
        normal = -m.opt.gravity / S.np.linalg.norm(m.opt.gravity)
        velocidade = S.np.zeros(6)
        S.mj.mj_objectVelocity(m, d, S.mj.mjtObj.mjOBJ_BODY, bid, velocidade, 0)
        giro = velocidade[:3] - costas * (velocidade[:3] @ costas)
        torque = c.peso * (3 * S.np.cross(costas, normal) - .04 * giro)
        torque *= min(1, 2 * c.peso / max(S.np.linalg.norm(torque), 1e-12))
        d.xfrc_applied[bid,3:] = torque
    S.Corpo._pegada = pegada_postura

resultados = []
for ganho in op.adesao:
    for nome, forma in (("banana", ["elipsoide", 0, 0, 0, 25, 11, 18]),
                        ("pessego", ["elipsoide", 0, 0, 0, 20, 19, 16]),
                        ("uva", ["esfera", 0, 0, 0, 8.5, 8.5, 8.5])):
        S.ADESAO = ganho
        c = S.Corpo(formas=[forma])
        amostras = []
        try:
            c.teleporte(0, -forma[5] - 20 / 7, S.np.pi / 2, 0)
            for k in range(250):
                # Mesmo comando em todos os casos; direção para cima como a regra da página.
                p = c.passo(c.t, [1.2, 1.2])
                a, b = p['costas'][:2]; d, e = p['frente'][:2]
                u = -float(S.np.clip(2 * S.np.arcsin(S.np.clip(a*e-b*d, -1, 1)), -.8, .8)) if p['na_forma'] else 0
                alvo = c.t + .02
                c.passo(alvo, [1.2+u, 1.2-u])
                prazo = time.monotonic() + 30
                while c.t < alvo - S.DT * S.DEC:
                    if time.monotonic() > prazo: raise RuntimeError('física não avançou')
                    time.sleep(.001)
                p = c.passo(c.t, [1.2+u, 1.2-u])
                amostras.append({k:p[k] for k in ('t','torax','frente','costas','na_forma')})
        finally:
            c.vivo = False
        r = dict(objeto=nome, adesao=ganho, passo_s=S.DT, referencial_superficie=op.referencial_superficie, referencial_corpo=op.referencial_corpo, postura=op.postura, altura_maxima_mm=max(p['torax'][2] for p in amostras),
                 queda_maxima_entre_poses_mm=max(a['torax'][2]-b['torax'][2] for a,b in zip(amostras,amostras[1:])),
                 fracao_tombada=sum(p['costas'][2]<0 for p in amostras)/len(amostras), amostras=amostras)
        print({k:v for k,v in r.items() if k!='amostras'}, flush=True)
        resultados.append(r)
saida = RAIZ/'docs/medicoes'/op.saida
saida.write_text(json.dumps(dict(metodo='Três cúpulas isoladas, largada no chão a 20/7 mm da borda, cinco segundos físicos por caso, sinal 1,2 e correção de rumo para cima. Controlador semente 0, 500 Hz; mesma pegada; adesão e passo indicados por caso. Sem cérebro. Altura máxima sozinha NÃO indica subida bem-sucedida. Uma realização por caso; amostragem HTTP e agendamento podem variar. Postura experimental: torque peso*(3*costas x normal - 0,04*giro tangencial), limitado a 2*peso mm; normal oposta à gravidade da pegada. Não representa musculatura.', configuracao=vars(op), servidor_sha256=hashlib.sha256((RAIZ/'corpo/servidor.py').read_bytes()).hexdigest(), resultados=resultados),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
