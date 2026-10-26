# -*- coding: utf-8 -*-
"""Servidor estático para ver o protótipo localmente.

Uso: python3 ferramentas/servir.py [porta] [pasta]
A página precisa de HTTP porque lê os dados por fetch; abrir o index.html
direto do Finder (file://) não funciona.
"""
import functools, os, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
if len(sys.argv) > 2:
    pasta = sys.argv[2] if os.path.isabs(sys.argv[2]) else os.path.abspath(sys.argv[2])
else:                                   # a raiz do repositório, acima deste script
    pasta = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

handler = functools.partial(SimpleHTTPRequestHandler, directory=pasta)
print(f'servindo {pasta} em http://127.0.0.1:{porta}/', flush=True)
ThreadingHTTPServer(('127.0.0.1', porta), handler).serve_forever()
