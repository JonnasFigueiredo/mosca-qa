"""Servidor local da página (web/), sem cache: o navegador sempre confere se o arquivo mudou.

Com o `python -m http.server` comum, o navegador guarda os .js por um tempo e, depois de uma mudança, pode
continuar rodando a versão antiga mesmo recarregando a página.

uso: python scripts/servir.py [porta]      (padrão 8765; abre em http://localhost:8765/)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
WEB = Path(__file__).resolve().parent.parent / "web"


class SemCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"página em http://localhost:{PORTA}/ (servindo {WEB})", flush=True)
    ThreadingHTTPServer(("", PORTA), partial(SemCache, directory=str(WEB))).serve_forever()
