"""Mede parar e retomar no corpo físico, sem outro cérebro. Não valida comportamento biológico.

Uso: .venv/Scripts/python.exe -X utf8 corpo/pausa_teste.py
Opcional: caminho de outro servidor.py e caminho do JSON para comparar versões.
"""
import importlib.util
import json
from pathlib import Path
import sys
import time

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "corpo"))
arquivo = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "corpo/servidor.py"
spec = importlib.util.spec_from_file_location("corpo_pausa", arquivo)
S = importlib.util.module_from_spec(spec)
argumentos = sys.argv
sys.argv = [str(arquivo)]
try:
    spec.loader.exec_module(S)
finally:
    sys.argv = argumentos
c = S.Corpo([])
resultados = []
try:
    for nome, sinal, duracao in [("parada_inicial", [0, 0], .4), ("andar", [1, 1], .8),
                                 ("pausa", [0, 0], .8), ("retomada", [1, 1], .8)]:
        inicio = c.passo(c.t, sinal)
        alvo = c.t + duracao
        c.passo(alvo, sinal)
        prazo = time.monotonic() + 90
        while c.t < alvo - S.DT * S.DEC:
            if time.monotonic() > prazo:
                raise RuntimeError("a física não alcançou o tempo pedido")
            time.sleep(.01)
        fim = c.passo(alvo, sinal)
        dist = sum((fim["torax"][i] - inicio["torax"][i])**2 for i in (0, 1))**.5
        r = {"fase": nome, "duracao_s": duracao, "deslocamento_mm": round(dist, 4),
             "altura_torax_mm": fim["torax"][2], "costas_vertical": fim["costas"][2]}
        resultados.append(r)
        print(r, flush=True)
finally:
    c.vivo = False
saida = Path(sys.argv[2]) if len(sys.argv) > 2 else RAIZ / "docs/medicoes/realismo-pausa-fisica.json"
saida.write_text(json.dumps({"metodo": "NeuroMechFly em chão plano: 0,4 s parada, 0,8 s andando, 0,8 s parada, 0,8 s retomando; sinais fixos, sem cérebro. Uma execução; deslocamento horizontal e orientação das costas no fim de cada fase.", "fases": resultados}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
