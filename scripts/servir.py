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
    # HTTP/1.1: quem fecha a conexão é o navegador, depois de receber tudo. Com o HTTP/1.0 padrão, o servidor fechava
    # logo depois de mandar e o Windows às vezes descartava o fim do arquivo (downloads cortados, "network error")
    protocol_version = "HTTP/1.1"

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"página em http://localhost:{PORTA}/ (servindo {WEB})", flush=True)
    # a página pede vários arquivos ao mesmo tempo ao entrar no 3D; com a fila padrão (5), o Windows recusava
    # alguns e o navegador dava "Failed to fetch"
    ThreadingHTTPServer.request_queue_size = 64
    ThreadingHTTPServer(("", PORTA), partial(SemCache, directory=str(WEB))).serve_forever()
