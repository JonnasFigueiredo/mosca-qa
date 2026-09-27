"""Empacota o conectoma para o navegador (web/data/).

Os binários vão em base64 (.b64.txt), porque a hospedagem só serve tipos de texto/web.

neurons : por neurônio -> x,y,z (int16, µm), lado (u8: 0=L 1=R), sinal (i8: +1/-1)
indptr  : Uint32 (N+1), início das saídas de cada neurônio pré-sináptico
idx_K   : destinos em varint com delta (ordenados por neurônio), em pedaços
w       : Uint8, sinapses por conexão (limitado a 255)
region  : Uint8, região grossa (para colorir o cérebro)
meta.json : contagens, grupos de entrada/saída e pedaços
"""
import base64
import json
from pathlib import Path

import numpy as np

from mb import mbon_groups, odor_pool
from positions import positions, sides
from sim import load

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "data"
MIN_W = 5
CHUNK = 7_000_000

ann, sign, _ = load(1)
e = np.load(ROOT / "data/edges.npz")
pos = positions(ann, e)
side = sides(ann, pos)
n = len(ann)

# No lobo antenal boa parte das conexões é dendrito com dendrito (processamento local).
# Num modelo de neurônio-ponto, as excitatórias entre PNs e LNs viram um eco que nunca
# desliga, então ficam de fora. As inibitórias e o caminho sensor -> PN -> cérebro ficam.
cls = ann["class"].fillna("").to_numpy()
al = np.isin(cls, ["ALLN", "ALPN"])
m = (e["w"] >= MIN_W) & (e["pre"] != e["post"])  # sem autapses (quase sempre artefato)
m &= ~(al[e["pre"]] & al[e["post"]] & (sign[e["pre"]] > 0))
pre, post, w = e["pre"][m], e["post"][m], e["w"][m]
order = np.lexsort((post, pre))
pre, post, w = pre[order], post[order], np.minimum(w[order], 255).astype(np.uint8)
indptr = np.zeros(n + 1, np.uint32)
np.cumsum(np.bincount(pre, minlength=n), out=indptr[1:])

# delta dentro de cada linha (o primeiro de cada linha é absoluto)
delta = np.diff(post, prepend=0).astype(np.int64)
delta[indptr[:-1][np.diff(indptr) > 0]] = post[indptr[:-1][np.diff(indptr) > 0]]
assert (delta >= 0).all()


def varint(a):
    out = []
    a = a.astype(np.uint64)
    while True:
        low = (a & 0x7F).astype(np.uint8)
        a = a >> 7
        more = a > 0
        out.append(low | (more.astype(np.uint8) << 7))
        if not more.any():
            break
    # intercala bytes: para cada valor, emite apenas os bytes necessários
    nbytes = np.ones(len(out[0]), np.int64)
    for k in range(1, len(out)):
        nbytes += (out[k - 1] & 0x80) > 0
    buf = np.zeros(int(nbytes.sum()), np.uint8)
    start = np.concatenate([[0], np.cumsum(nbytes)[:-1]])
    for k in range(len(out)):
        sel = nbytes > k
        buf[start[sel] + k] = out[k][sel]
    return buf, nbytes


OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.bin"):
    old.unlink()


def save(name, arr):
    (OUT / name).write_bytes(base64.b64encode(np.ascontiguousarray(arr).tobytes()))
buf, nbytes = varint(delta)
# corta os pedaços em fronteiras de valor
ends = np.cumsum(nbytes)
chunks, edge_start, byte_start = [], 0, 0
while edge_start < len(delta):
    edge_end = int(np.searchsorted(ends, byte_start + CHUNK, side="right"))
    edge_end = max(edge_end, edge_start + 1)
    byte_end = int(ends[edge_end - 1])
    name = f"idx_{len(chunks)}.b64.txt"
    save(name, buf[byte_start:byte_end])
    chunks.append({"file": name, "edges": edge_end - edge_start})
    edge_start, byte_start = edge_end, byte_end

xyz = np.round(pos - pos.mean(0)).astype(np.int16)
neurons = np.zeros(n, dtype=[("x", "<i2"), ("y", "<i2"), ("z", "<i2"), ("side", "u1"), ("sign", "i1")])
neurons["x"], neurons["y"], neurons["z"] = xyz[:, 0], xyz[:, 1], xyz[:, 2]
neurons["side"] = (side == "R").astype(np.uint8)
neurons["sign"] = sign.astype(np.int8)
save("neurons.b64.txt", neurons)
save("indptr.b64.txt", indptr)
save("w.b64.txt", w)

typ = ann.type.fillna("").to_numpy()
supc = ann.superclass.fillna("").to_numpy()


def ids(mask, s=None):
    if s is not None:
        mask = mask & (side == s)
    return np.flatnonzero(mask).tolist()


def by_type(ts, s=None):
    return ids(np.isin(typ, ts), s)


cls_all = ann["class"].fillna("").to_numpy().astype(str)
aprox, evitar = mbon_groups(typ.astype(str), cls_all, e)
REWARD_PAM = ["PAM01", "PAM02", "PAM03", "PAM04", "PAM05", "PAM06", "PAM08", "PAM11", "PAM15"]
# saídas "evitar" que recebem da recompensa: as sinapses Kenyon -> elas é que a recompensa enfraquece
_is_rew = np.isin(typ.astype(str), REWARD_PAM)
rew_targets = []
for t in evitar:
    mi = np.flatnonzero(typ.astype(str) == t)
    if e["w"][np.isin(e["post"], mi) & _is_rew[e["pre"]]].sum() >= 100:
        rew_targets.append(t)
print("MBONs 'evitar' da recompensa:", rew_targets)
groups = {
    # entradas
    "doce": by_type(["PhG9", "dorsal_tpGRN"]),
    "ameaca": by_type(["LPLC2", "LC4"]),
    # "dor": neurônios de dopamina de punição do corpo cogumelar (PPL1-γ1pedc, γ1, γ2α'1, α'3, α'2α2, α3)
    "dor": by_type([f"PPL10{i}" for i in range(1, 7)]),
    # aprendizado: células de Kenyon e saídas do corpo cogumelar
    "kc": ids(np.char.startswith(typ.astype(str), "KC")),
    "mbon_aprox": by_type(aprox), "mbon_evitar": by_type(evitar),
    # recompensa: PAM dos compartimentos ligados a açúcar na literatura (γ5, β'2, β2, γ4, α1)
    "recompensa": by_type(REWARD_PAM),
    "mbon_evitar_rec": by_type(rew_targets),
    # saídas
    "proboscide": by_type(["MN9", "MN6", "MN8", "MN11D", "MN11V", "MN12D"]),
    "fibra_gigante": by_type(["DNp01"]),
    "moonwalker": by_type(["MDN"]),
    "dn_L": ids(supc == "descending_neuron", "L"), "dn_R": ids(supc == "descending_neuron", "R"),
    # visão: o que cada olho vê liga o LC10a daquele olho (detector de objetos pequenos, o que o macho
    # usa para seguir a fêmea). Na triagem (visao_teste.py) ele liga o DNa02 do mesmo lado: vira para o objeto
    "olho_L": by_type(["LC10a"], "L"), "olho_R": by_type(["LC10a"], "R"),
    # direção: DNa01-03 de cada lado; o mais ativo vira a mosca para o seu lado
    "dirige_L": by_type(["DNa01", "DNa02", "DNa03"], "L"), "dirige_R": by_type(["DNa01", "DNa02", "DNa03"], "R"),
    # de onde vem a ameaça (scripts/fuga_direcao.py): o DNp04 dispara do lado da ameaça; ameaça na frente liga mais o
    # DNp02 e atrás, o DNp11. Na fuga, a mosca pula para o lado oposto (a leitura é regra nossa)
    "fuga_E": by_type(["DNp04"], "L"), "fuga_D": by_type(["DNp04"], "R"),
    "fuga_frente": by_type(["DNp02"]), "fuga_tras": by_type(["DNp11"]),
}
# tato: neurônios mecanossensoriais táteis (cerdas) de cada pata, pelo nervo por onde entram no cordão nervoso
# (ProLN, MesoLN, MetaLN = patas da frente, do meio e de trás) e pelo lado de entrada (rootSide). Só ~15% deles
# (um a cada 7): a cada passo, só as cerdas do tarso tocam o chão. Com todas as cerdas ligadas juntas, o cordão
# nervoso excitava a fibra gigante (DNp01 a ~0,5 Hz, fugas sem ameaça); com 15%, ela fica quieta
_root = ann.rootSide.fillna("").to_numpy().astype(str)
_nerv = ann.entryNerve.fillna("").to_numpy().astype(str)
_sub = ann.subclass.fillna("").to_numpy().astype(str)
for _perna, _n in (("f", "ProLN"), ("m", "MesoLN"), ("h", "MetaLN")):
    for _lado in "LR":
        groups[f"tato_{_lado.lower()}{_perna}"] = np.flatnonzero((cls_all == "mechanosensory_tactile") & (_nerv == _n) & (_root == _lado))[::7].tolist()
        # o resto dos sensores da pata (corpo físico, sandbox): todas as cerdas (tropeço), placas de pelos e sensilas
        # campaniformes (carga) e o órgão cordotonal (movimento da junta fêmur-tíbia)
        _m = (_nerv == _n) & (_root == _lado)
        _k = _lado.lower() + _perna
        groups[f"tropeco_{_k}"] = np.flatnonzero(_m & (cls_all == "mechanosensory_tactile")).tolist()
        groups[f"carga_{_k}"] = np.flatnonzero(_m & np.isin(_sub, ["hair plate", "campaniform sensilla"])).tolist()
        # do órgão cordotonal do fêmur, só os neurônios "hook" (direção do movimento da tíbia; tipos SNpp39 e SNpp41,
        # com o sinônimo "FeCO hook" no mapa):
        # a física dá a velocidade da junta. Os "claw" (posição) e "club" (vibração) ficam de fora; ligar os 392 juntos
        # a 60 Hz fazia a fibra gigante disparar sozinha (scripts/fibra_espontanea.py)
        groups[f"cordotonal_{_k}"] = np.flatnonzero(_m & (_sub == "chordotonal organ") & np.isin(typ.astype(str), ["SNpp39", "SNpp41"])).tolist()
# gravidade: neurônios do órgão de Johnston das zonas C e E (vento/gravidade). A arista empurrada para trás
# liga a zona E; para a frente, a C (Kamikouchi et al. 2009). De cabeça para cima, as duas antenas pendem para trás
_grav = ann.subclass.fillna("").to_numpy().astype(str) == "wind_gravity"
groups["gravidade_C"] = np.flatnonzero(_grav & np.char.startswith(typ.astype(str), "JO-C")).tolist()
groups["gravidade_E"] = np.flatnonzero(_grav & np.char.startswith(typ.astype(str), "JO-E")).tolist()
# um grupo por glomérulo e por antena: cada botão da loja ganha um cheiro com 6 deles
ODOR_POOL = odor_pool(typ.astype(str), cls_all)
# o mundo da Cozinha usa cheiros reais: vinagre e fermentação (DM1), geosmina, o cheiro de mofo (DA2), e CO2 (V).
# Ficam fora do conjunto dos sistemas (DM1 é um hub no aprendizado), mas entram na lista para ter os grupos
ODOR_POOL += ["ORN_DM1", "ORN_DA2", "ORN_V"]
for g in ODOR_POOL:
    for sd in "LR":
        groups[f"{g}_{sd}"] = by_type([g], sd)
# rótulo grosso por neurônio, para colorir o cérebro
region = np.select(
    [np.char.startswith(supc.astype(str), "ol_") | (supc == "visual_projection"),
     np.char.startswith(supc.astype(str), "vnc") | (supc == "ascending_neuron"),
     supc == "descending_neuron",
     np.isin(cls_all, ["Kenyon_Cell", "MBON", "DAN"])],
    [1, 2, 3, 4], 0).astype(np.uint8)
save("region.b64.txt", region)

meta = {
    "neurons": n, "edges": int(len(w)), "minSynapses": MIN_W, "chunks": chunks,
    "groups": groups, "odorPool": ODOR_POOL,
    "source": "FlyEM Male CNS v1.0 (Janelia, CC-BY 4.0)",
}
(OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
for f in sorted(OUT.iterdir()):
    print(f"{f.name:14s} {f.stat().st_size / 1e6:6.1f} MB")
print({k: len(v) for k, v in groups.items()})
