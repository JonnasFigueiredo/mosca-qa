"""Posição 3D de cada neurônio (µm). Quem não tem corpo celular no volume
(ex.: neurônios sensoriais) herda a média ponderada dos parceiros."""
import numpy as np
import scipy.sparse as sp

VOXEL_UM = 8 / 1000


def positions(ann, e):
    n = len(ann)
    pos = np.full((n, 3), np.nan, np.float32)
    has = ann.somaLocation.notna().to_numpy()
    pos[has] = np.stack(ann.somaLocation[has].to_numpy()).astype(np.float32) * VOXEL_UM
    A = sp.csr_matrix((e["w"].astype(np.float32), (e["pre"], e["post"])), shape=(n, n))
    A = A + A.T
    for _ in range(4):
        known = ~np.isnan(pos[:, 0])
        if known.all():
            break
        Ak = A[:, known]
        s = np.asarray(Ak.sum(1)).ravel()
        est = (Ak @ pos[known]) / np.maximum(s, 1)[:, None]
        fill = ~known & (s > 0)
        pos[fill] = est[fill]
    missing = np.isnan(pos[:, 0])
    pos[missing] = np.nanmean(pos, 0)
    return pos


def sides(ann, pos):
    """L/R pelo corpo celular; se não houver, pelo lado da linha média."""
    side = ann.somaSide.fillna("").to_numpy().astype(object)
    xl = pos[side == "L", 0].mean()
    xr = pos[side == "R", 0].mean()
    mid = (xl + xr) / 2
    unknown = ~np.isin(side, ["L", "R"])
    left_is_low = xl < xr
    side[unknown] = np.where((pos[unknown, 0] < mid) == left_is_low, "L", "R")
    return side
