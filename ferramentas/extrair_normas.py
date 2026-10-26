# -*- coding: utf-8 -*-
"""Extrai as tabelas taxonômicas dos PDFs das resoluções do ComGC/SPU.

Entrada : PDFs do SEI (Anexos das resoluções)
Saída   : registros e atributos no esquema canônico (JSON intermediário)

A extração é por linha e por coluna: cada linha de texto do PDF é atribuída a
uma coluna pela sua coordenada x, e um novo registro começa sempre que a
primeira coluna traz um código bem formado. Isso sobrevive a registros que
atravessam a quebra de página, caso em que a linha de continuação vem sem código.
"""
import fitz, json, re, sys

CODIGO = re.compile(r'^0[12](?:\.\d{2}){1,5}$')

RUIDO = re.compile(
    r'^Resolu[çc][ãa]o \d+ \(\d+\)'          # rodapé do SEI
    r'|/ pg\. \d+$'
    r'|Documento assinado'
    r'|assinado eletronicamente'
    r'|conforme hor[áa]rio oficial'
    r'|Decreto n[ºo] 10\.543'
    r'|A autenticidade deste documento'
    r'|colaboragov\.sei\.gov\.br'
    r'|c[óo]digo verificador'
    r'|^Refer[êe]ncia: Processo'
    r'|^SEI n[ºo] \d+$'
    r'|^Boletim de Servi[çc]o'
    r'|^ANEXO'
    r'|^TABELA TAXON[ÔO]MICA'
    r'|^ATRIBUTOS'
    r'|^DOS REGIMES'
    r'|^(C[ÓO]DIGO|DESCRI[ÇC][ÃA]O|DEFINI[ÇC][ÃA]O|EXEMPLOS)$',
    re.IGNORECASE)

PARADA = re.compile(r'^ANEXO II|^ATRIBUTOS DOS REGIMES', re.IGNORECASE)


def linhas(pagina):
    """Devolve (y0, x0, texto) de cada linha de texto da página, em ordem de leitura."""
    saida = []
    for bloco in pagina.get_text('dict')['blocks']:
        for linha in bloco.get('lines', []):
            txt = ''.join(s['text'] for s in linha['spans'])
            txt = re.sub(r'\s+', ' ', txt).strip()
            if txt:
                saida.append((linha['bbox'][1], linha['bbox'][0], txt))
    return sorted(saida)


def coluna(x0, limites):
    i = 0
    while i + 1 < len(limites) and x0 >= limites[i + 1]:
        i += 1
    return i


def emenda(anterior, novo):
    if not anterior:
        return novo
    if anterior.endswith('-'):          # palavra composta quebrada pela diagramação
        return anterior + novo
    return anterior + ' ' + novo


def extrair(pdf, paginas, limites, ncols):
    doc = fitz.open(pdf)
    registros, atual = [], None
    for p in paginas:
        for _y, x0, txt in linhas(doc[p - 1]):
            if PARADA.search(txt):
                return registros
            if RUIDO.search(txt):
                continue
            col = coluna(x0, limites)
            if col == 0 and CODIGO.match(txt):
                atual = {'codigo': txt, 'cels': [''] * (ncols - 1)}
                registros.append(atual)
            elif atual and col > 0:
                atual['cels'][col - 1] = emenda(atual['cels'][col - 1], txt)
    return registros


# ---- blocos embutidos na coluna "Definição" da TT-02 -------------------------
MARCAS = [('observacao', r'Observa[çc][ãa]o:\s*'),
          ('fundamento_legal', r'Fundamenta[çc][ãa]o legal \(Uni[ãa]o\):\s*'),
          ('instrumento', r'Instrumento:\s*')]


def separar_blocos(texto):
    achados = sorted((m.start(), m.end(), campo)
                     for campo, pat in MARCAS for m in re.finditer(pat, texto))
    r = {'definicao': (texto[:achados[0][0]] if achados else texto).strip(),
         'observacao': '', 'fundamento_legal': '', 'instrumento': ''}
    for i, (_ini, fim, campo) in enumerate(achados):
        prox = achados[i + 1][0] if i + 1 < len(achados) else len(texto)
        valor = texto[fim:prox].strip()
        r[campo] = (r[campo] + ' ' + valor).strip() if r[campo] else valor
    return r


LIMITES_TT01 = [34.7, 110.0, 243.0, 400.0]   # código | descrição | definição | exemplos
LIMITES_TT02 = [54.6, 120.6, 234.6]          # código | descrição | definição


def main(pdf_tt01, pdf_tt02, saida):
    tt01 = []
    for r in extrair(pdf_tt01, range(2, 26), LIMITES_TT01, 4):
        desc, defi, ex = r['cels']
        tt01.append({'codigo': r['codigo'], 'descricao': desc,
                     **separar_blocos(defi),
                     'exemplos': '' if ex.strip() in ('', '-') else ex.strip()})

    tt02 = []
    for r in extrair(pdf_tt02, range(2, 9), LIMITES_TT02, 3):
        desc, defi = r['cels']
        tt02.append({'codigo': r['codigo'], 'descricao': desc,
                     **separar_blocos(defi), 'exemplos': ''})

    doc = fitz.open(pdf_tt02)
    limites_at = [c[0] for c in doc[8].find_tables().tables[0].header.cells]
    COLS = ['descricao', 'discricionariedade', 'natureza', 'pagamento_em_dinheiro',
            'baixa_patrimonial', 'prazo', 'efeito_patrimonial', 'uso_determinado']
    atributos = [dict(codigo=r['codigo'], **dict(zip(COLS, r['cels'])))
                 for r in extrair(pdf_tt02, [9, 10], limites_at, 9)]

    json.dump({'tt01': tt01, 'tt02': tt02, 'tt02_atributos': atributos},
              open(saida, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'TT-01: {len(tt01)} registros | TT-02: {len(tt02)} registros | '
          f'atributos: {len(atributos)} folhas')


if __name__ == '__main__':
    main(*sys.argv[1:4])
