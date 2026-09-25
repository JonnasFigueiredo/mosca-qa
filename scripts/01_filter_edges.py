"""Filtra a tabela de conexões do Male CNS (Janelia, v1.0) para ficar só com
os 166.700 neurônios anotados. Salva em data/edges.npz para os próximos passos."""
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.feather as feather

RAW = Path(__file__).resolve().parent.parent / "data" / "raw"
OUT = RAW.parent

ann = pd.read_feather(RAW / "body-annotations-male-cns-v1.0-minconf-0.5.feather")
ids = np.sort(ann.loc[ann.superclass.notna(), "bodyId"].to_numpy())

table = feather.read_table(RAW / "connectome-weights-male-cns-v1.0-minconf-0.5.feather", memory_map=True)
pres, posts, ws = [], [], []
for batch in table.to_batches(20_000_000):
    pre, post, w = (batch.column(i).to_numpy() for i in range(3))
    m = np.isin(pre, ids) & np.isin(post, ids)
    pres.append(np.searchsorted(ids, pre[m]).astype(np.int32))
    posts.append(np.searchsorted(ids, post[m]).astype(np.int32))
    ws.append(w[m].astype(np.int32))

np.savez(OUT / "edges.npz", ids=ids, pre=np.concatenate(pres), post=np.concatenate(posts), w=np.concatenate(ws))
print("neurônios:", len(ids), "conexões:", sum(len(p) for p in pres))
