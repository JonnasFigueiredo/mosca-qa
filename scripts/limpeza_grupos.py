"""Localiza entradas e saídas da triagem de limpeza, na ordem dos dados da página.

Uso: python -X utf8 scripts/limpeza_grupos.py
Não altera o conectoma: grava os índices e a seleção em docs/medicoes/limpeza-grupos.json.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
a = pd.read_feather(RAIZ / "data/raw/body-annotations-male-cns-v1.0-minconf-0.5.feather")
ids = np.load(RAIZ / "data/edges.npz")["ids"]
a = a.set_index("bodyId").loc[ids].fillna("")
tipos = a["type"]
selecao = {
    "antenas": tipos.isin(["JO-FV", "JO-FD1"]) & a.subclass.eq("grooming"),
    "cerdas_cabeca": tipos.eq("BM_InOm"),
    "cerdas_antenas": tipos.eq("BM") & a.entryNerve.eq("AN"),
    "aDN1": tipos.eq("DNg62"),
    "aDN2": tipos.eq("DNge078"),
}
grupos = {k: np.flatnonzero(m).tolist() for k, m in selecao.items()}
saida = {
    "metodo": "Anotações Male CNS v1.0 alinhadas a edges.npz[ids]. Antenas: JO-FV/JO-FD1 com subclass grooming; cabeça: BM_InOm (cerdas interomatidiais); cerdas das antenas: BM com entryNerve AN. Descendentes: DNg62/aDN1 e DNge078/aDN2, sinônimos nas anotações. Esses índices servem apenas à triagem.",
    "grupos": grupos,
    "descendentes": a.loc[selecao["aDN1"] | selecao["aDN2"], ["type", "synonyms", "somaSide"]].reset_index().to_dict("records"),
}
(RAIZ / "docs/medicoes/limpeza-grupos.json").write_text(json.dumps(saida, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print({k: len(v) for k, v in grupos.items()})
