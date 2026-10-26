# -*- coding: utf-8 -*-
"""Confere, um a um, se os endereços dos verbetes do glossário ainda respondem.

Uso: python3 proposta/ferramentas/verificar_links.py proposta/dados
Precisa de rede; não faz parte da geração dos dados, que é offline. Rode de tempos
em tempos (ou antes de uma publicação) para pegar verbete renomeado ou removido.
"""
import csv, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

def situacao(url):
    try:
        req = urllib.request.Request(url, method='GET', headers={'User-Agent': 'verificador-taxonomias'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except Exception as e:
        return getattr(e, 'code', f'erro: {e}')

def main(base):
    caminho = os.path.join(base, 'glossario', 'termos.csv')
    with open(caminho, encoding='utf-8', newline='') as fh:
        termos = [t for t in csv.DictReader(fh) if t['url_memoriaspu']]
    with ThreadPoolExecutor(max_workers=8) as pool:
        codigos = list(pool.map(lambda t: situacao(t['url_memoriaspu']), termos))
    ruins = [(t['termo'], t['url_memoriaspu'], c) for t, c in zip(termos, codigos) if c != 200]
    print(f'{len(termos)} endereços conferidos, {len(ruins)} com problema')
    for termo, url, c in ruins:
        print(f'  {c}  {termo}  ->  {url}')
    return 1 if ruins else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
