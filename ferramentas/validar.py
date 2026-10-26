# -*- coding: utf-8 -*-
"""Valida os dados canônicos das tabelas taxonômicas e dos vínculos do glossário.

Uso: python3 validar.py proposta/dados
Devolve código de saída 1 quando há erro, 0 quando só há avisos.
É este o script que deve rodar a cada alteração de dados (pre-commit / CI).
"""
import csv, json, os, re, sys
from collections import Counter

CODIGO = re.compile(r'^\d{2}(?:\.\d{2}){1,5}$')
SEP = ' | '
erros, avisos = [], []

def erro(msg): erros.append(msg)
def aviso(msg): avisos.append(msg)

def ler_csv(caminho):
    with open(caminho, encoding='utf-8', newline='') as fh:
        return list(csv.DictReader(fh))

def validar_tabela(pasta, meta):
    sigla = meta['sigla']
    regs = ler_csv(os.path.join(pasta, 'registros.csv'))
    codigos = [r['codigo'] for r in regs]

    for c, n in Counter(codigos).items():
        if n > 1:
            erro(f'{sigla}: código duplicado {c} ({n}x)')
    cjt = set(codigos)

    for r in regs:
        c = r['codigo']
        if not CODIGO.match(c):
            erro(f'{sigla}: código mal formado {c!r}')
            continue
        if int(r['nivel']) != len(c.split('.')) - 1:
            erro(f'{sigla}: {c} declara nível {r["nivel"]}, incoerente com o código')
        esperado = '.'.join(c.split('.')[:-1]) if len(c.split('.')) > 2 else ''
        if r['pai'] != esperado:
            erro(f'{sigla}: {c} declara pai {r["pai"]!r}, esperado {esperado!r}')
        if esperado and esperado not in cjt:
            erro(f'{sigla}: {c} é órfão — o pai {esperado} não existe na tabela')
        if not r['descricao'].strip():
            erro(f'{sigla}: {c} sem descrição')
        if not r['definicao'].strip():
            erro(f'{sigla}: {c} sem definição')
        if int(r['nivel']) > meta['profundidade']:
            erro(f'{sigla}: {c} excede a profundidade declarada ({meta["profundidade"]})')
        if not re.match(r'^[A-ZÀ-Ú0-9]', r['definicao'].strip()):
            aviso(f'{sigla}: {c} — definição não começa por maiúscula '
                  f'(possível texto truncado na norma): {r["definicao"][:60]!r}')

    if len(meta['rotulos_nivel']) != meta['profundidade']:
        erro(f'{sigla}: {len(meta["rotulos_nivel"])} rótulos de nível para '
             f'profundidade {meta["profundidade"]}')
    if meta['totais']['registros'] != len(regs):
        erro(f'{sigla}: tabela.json declara {meta["totais"]["registros"]} registros, '
             f'o CSV tem {len(regs)}')

    folhas = cjt - {r['pai'] for r in regs if r['pai']}
    if meta['totais']['folhas'] != len(folhas):
        erro(f'{sigla}: total de folhas divergente')

    # ---- atributos (facetas), quando a tabela os tiver
    if 'atributos' in meta:
        at = ler_csv(os.path.join(pasta, 'atributos.csv'))
        voc = json.load(open(os.path.join(pasta, 'vocabulario-atributos.json'),
                             encoding='utf-8'))
        cods_at = {a['codigo'] for a in at}
        for c in sorted(folhas - cods_at):
            erro(f'{sigla}: folha {c} sem linha de atributos')
        for c in sorted(cods_at - folhas):
            erro(f'{sigla}: atributos informados para {c}, que não é folha')
        for a in at:
            for campo, regra in voc.items():
                bruto = (a.get(campo) or '').strip()
                if not bruto:
                    aviso(f'{sigla}: {a["codigo"]} sem valor de "{regra["rotulo"]}" '
                          f'(célula vazia na norma)')
                    continue
                partes = ([bruto] if bruto in regra['valores']
                          else [x.strip() for x in bruto.split('/')])
                for v in partes:
                    if v and v not in regra['valores']:
                        erro(f'{sigla}: {a["codigo"]} — valor {v!r} fora do vocabulário '
                             f'de "{regra["rotulo"]}"')
    return cjt

def main(base):
    indice = json.load(open(os.path.join(base, 'tabelas.json'), encoding='utf-8'))
    todos = set()
    for t in indice['tabelas']:
        pasta = os.path.join(base, t['caminho'])
        meta = json.load(open(os.path.join(pasta, 'tabela.json'), encoding='utf-8'))
        todos |= validar_tabela(pasta, meta)

    vinc = ler_csv(os.path.join(base, 'glossario', 'vinculos.csv'))
    termos = {t['id'] for t in ler_csv(os.path.join(base, 'glossario', 'termos.csv'))}
    for v in vinc:
        if v['codigo'] not in todos:
            erro(f'glossário: termo {v["termo"]!r} aponta para código inexistente '
                 f'{v["codigo"]}')
        if v['termo_id'] not in termos:
            erro(f'glossário: vínculo sem termo correspondente ({v["termo_id"]})')
        if v['situacao'] == 'divergente':
            aviso(f'glossário: {v["codigo"]} — termo {v["termo"]!r} difere da descrição '
                  f'da tabela ({v["observacao"]})')
    dup = [c for c, n in Counter(v['codigo'] for v in vinc).items() if n > 1]
    for c in dup:
        quais = [v['termo'] for v in vinc if v['codigo'] == c]
        aviso(f'glossário: código {c} vinculado a {len(quais)} termos: {quais}')

    print(f'{len(erros)} erro(s), {len(avisos)} aviso(s)\n')
    for e in erros:
        print('ERRO   ', e)
    for a in avisos:
        print('aviso  ', a)
    return 1 if erros else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1]))
