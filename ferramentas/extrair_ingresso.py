# -*- coding: utf-8 -*-
"""Extrai a minuta da TT-03 — Regimes de Ingresso Patrimonial Imobiliário.

A fonte é diferente da minuta de funções finalísticas: aqui o .docx é a minuta
da **resolução inteira**, sem controle de alterações e sem comentários, com dois
anexos em forma de tabela. O Anexo I é a tabela taxonômica; o Anexo II é uma
tabela de correspondência (de-para) entre os valores de hoje no SPUnet e os
códigos novos, que não é taxonomia e não entra na árvore.

A célula de definição traz, em parágrafos próprios, os mesmos campos que a TT-02
tem em colunas: "Fundamentação legal (União): …" e "Instrumento: …". Os
parágrafos que vêm antes deles e depois do primeiro são observação.

Uso: python3 extrair_ingresso.py caminho/da/minuta.docx saida.json
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
# o documento escreve alguns códigos com espaço depois do prefixo ("03. 01.01")
CODIGO = re.compile(r'^03(?:\s*\.\s*\d{2}){1,5}$')
MARCA_FUNDAMENTO = re.compile(r'^Fundamenta[çc][ãa]o\s+legal(?:\s*\(União\))?\s*:\s*', re.I)
MARCA_INSTRUMENTO = re.compile(r'^Instrumento\s*:\s*', re.I)


def q(tag):
    return W + tag


def texto(no):
    return ''.join(n.text or '' for n in no.iter(q('t')))


def celula(tc):
    """Parágrafos da célula, um por linha, sem linhas vazias."""
    return [l for l in (' '.join(texto(p).split()) for p in tc.iter(q('p'))) if l]


def normalizar_codigo(bruto):
    c = re.sub(r'\s+', '', bruto)
    return c if CODIGO.match(' '.join(bruto.split())) else ''


def separar_campos(linhas):
    """Parte a célula de definição em definição, observação, fundamento e
    instrumento. Os dois últimos são rotulados no próprio parágrafo."""
    definicao, observacao, fundamento, instrumento = '', [], [], []
    for linha in linhas:
        if (m := MARCA_FUNDAMENTO.match(linha)):
            fundamento.append(linha[m.end():].strip(' .;'))
        elif (m := MARCA_INSTRUMENTO.match(linha)):
            instrumento.append(linha[m.end():].strip(' .;'))
        elif not definicao:
            definicao = linha
        else:
            observacao.append(linha)
    # devolve texto, como os outros extratores: quem separa em lista é o
    # `lista()` do gerador, que quebra no ponto-e-vírgula
    return definicao, ' '.join(observacao), '; '.join(fundamento), '; '.join(instrumento)


def extrair(caminho_docx):
    with zipfile.ZipFile(caminho_docx) as z:
        raiz = ET.fromstring(z.read('word/document.xml'))
    tabelas = list(raiz.iter(q('tbl')))
    if len(tabelas) != 2:
        raise SystemExit(f'esperava dois anexos em tabela, encontrei {len(tabelas)}')
    registros = []
    for tr in tabelas[0].findall(q('tr')):          # Anexo I
        celulas = [celula(tc) for tc in tr.findall(q('tc'))]
        if len(celulas) < 3 or not celulas[0]:
            continue
        cod = normalizar_codigo(celulas[0][0])
        if not cod:
            continue                                # cabeçalho da tabela
        definicao, observacao, fundamento, instrumento = separar_campos(celulas[2])
        registros.append({
            'codigo': cod,
            'descricao': ' '.join(' '.join(celulas[1]).split()),
            'definicao': definicao,
            'observacao': observacao,
            'fundamento_legal': fundamento,
            'instrumento': instrumento,
            'exemplos': '',
        })
    return registros


def correspondencia(caminho_docx):
    """Anexo II: o de-para com o SPUnet. Não é taxonomia — fica fora da árvore e
    é devolvido à parte, para quem quiser conferir a migração."""
    with zipfile.ZipFile(caminho_docx) as z:
        raiz = ET.fromstring(z.read('word/document.xml'))
    linhas = []
    for tr in list(raiz.iter(q('tbl')))[1].findall(q('tr')):
        cels = [' '.join(' '.join(celula(tc)).split()) for tc in tr.findall(q('tc'))]
        if len(cels) >= 4 and cels[0] and cels[0].upper() != 'DE SPUNET (FORMA DE INCORPORAÇÃO/TIPO DE AQUISIÇÃO)':
            linhas.append({'de_spunet': cels[0], 'codigo': cels[1],
                           'valor': cels[2], 'observacoes': cels[3]})
    return linhas


def main(docx, saida):
    registros = extrair(docx)
    json.dump({'tt03': registros}, open(saida, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'TT-03 ingresso (minuta): {len(registros)} registros | '
          f'Anexo II: {len(correspondencia(docx))} correspondências')


if __name__ == '__main__':
    main(*sys.argv[1:3])
