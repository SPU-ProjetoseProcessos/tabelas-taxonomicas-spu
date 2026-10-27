# -*- coding: utf-8 -*-
"""Extrai a minuta da TT-03 do documento Word da proposta.

A minuta ainda não é norma: a fonte é um .docx com controle de alterações.
Este script lê a versão **com todas as alterações aceitas** — que é a versão
finalizada, já que nenhuma das três rodadas de revisão apaga o que outra
escreveu — e devolve os registros no mesmo formato que `extrair_normas`.

Uso: python3 extrair_minuta.py caminho/da/proposta.docx saida.json
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
CODIGO = re.compile(r'^0[X\d](?:\.\d{2}){1,5}$')
# o documento ainda não tem número de tabela: o prefixo está como 0X, e dois
# itens guardam o 03 da numeração de trabalho
PREFIXO = '03'
# o rótulo da lista varia no documento: com e sem dois-pontos, 'Exemplos de
# documentos' e só 'Exemplos'; em dois registros ele fecha o parágrafo da
# definição em vez de abrir um parágrafo próprio
MARCA_EXEMPLOS = re.compile(r'Exemplos(?:\s+de\s+documentos)?\s*:?\s*', re.I)
# um único registro (03.01.03) fecha a definição com um bloco de referências
# legais; é o mesmo campo que nas outras tabelas vem como "Fundamentação legal"
MARCA_REFERENCIAS = re.compile(r'\s*Refer[êe]ncias?:\s*')


def q(tag):
    return W + tag


def texto(no):
    """Texto do nó com as alterações controladas aceitas: o que foi inserido
    entra, o que foi excluído (w:delText, dentro de w:del) fica fora."""
    partes = []
    for filho in no:
        t = filho.tag
        if t == q('t'):
            partes.append(filho.text or '')
        elif t == q('tab'):
            partes.append(' ')
        elif t in (q('br'), q('cr')):
            partes.append('\n')
        elif t in (q('del'), q('delText'), q('rPr'), q('pPr'), q('rPrChange'),
                   q('pPrChange'), q('sectPr'), q('proofErr')):
            continue
        else:
            partes.append(texto(filho))
    return ''.join(partes)


def celula(tc):
    """Parágrafos da célula, um por linha, sem linhas vazias."""
    linhas = [' '.join(texto(p).split()) for p in tc.iter(q('p'))]
    return [l for l in linhas if l]


def normalizar_codigo(bruto):
    c = ' '.join(bruto.split())
    return PREFIXO + c[2:] if CODIGO.match(c) else ''


def separar_exemplos(linhas):
    """Parte a célula da definição no parágrafo que abre a lista de exemplos.

    Depois do rótulo, cada exemplo vem num parágrafo próprio; em parte do
    documento eles também estão separados por ponto-e-vírgula dentro da linha.
    """
    achado = next(((i, m) for i, l in enumerate(linhas)
                    if (m := MARCA_EXEMPLOS.search(l))), None)
    if achado is None:
        return ' '.join(' '.join(linhas).split()), []
    corte, marca = achado
    definicao = ' '.join(' '.join(linhas[:corte] + [linhas[corte][:marca.start()]]).split())
    resto = [linhas[corte][marca.end():]] + linhas[corte + 1:]
    itens = []
    for linha in resto:
        for item in re.split(r';', linha):
            item = item.strip(' .;')
            if item:
                itens.append(item)
    return definicao, itens


def separar_referencias(definicao):
    """Tira do fim da definição o bloco 'Referências: …', quando houver."""
    partes = MARCA_REFERENCIAS.split(definicao, maxsplit=1)
    if len(partes) == 1:
        return definicao, ''
    return partes[0].strip(), partes[1].strip(' .')


# A minuta nomeia de três jeitos: caixa de sentença em 79 dos 98 registros,
# caixa alta em cinco e Title Case em dez. As TT-01 e TT-02 nomeiam em caixa de
# sentença, que é também a maioria daqui — então os outros dois são desvio, não
# estilo. A padronização fica aqui, na extração, para que o CSV publicado e uma
# releitura do .docx cheguem ao mesmo texto.
#
# Cada entrada guarda o nome **como está no documento**: se uma revisão mexer
# nesse nome, a extração para em vez de aplicar a correção a um texto que já
# não é aquele — ou de deixar a caixa alta passar calada. Só a caixa muda;
# concordância e grafia ficam como no original e vão para a errata.
CAIXA_PADRONIZADA = {
    '03.02': ('GESTÃO DO INGRESSO PATRIMONIAL IMOBILIÁRIO',
              'Gestão do ingresso patrimonial imobiliário'),
    '03.04': ('DESTINAÇÃO E GESTÃO ECONÔMICA PATRIMONIAL ImobiliáriO',
              'Destinação e gestão econômica patrimonial imobiliário'),
    '03.06': ('CONTROLE PATRIMONIAL IMOBILIÁRIO',
              'Controle patrimonial imobiliário'),
    '03.06.01.02': ('Fiscalização patrimonial imobiliária COERCITIVA',
                    'Fiscalização patrimonial imobiliária coercitiva'),
    '03.07': ('GOVERNANÇA DE DADOS, INFORMAÇÃO E CONHECIMENTO PATRIMONIAL IMOBILIÁRIO',
              'Governança de dados, informação e conhecimento patrimonial imobiliário'),
    # Title Case: nenhum destes tem nome próprio ou sigla dentro, então a
    # inicial é a única maiúscula que sobrevive
    '03.01': ('Caracterização Patrimonial Imobiliária',
              'Caracterização patrimonial imobiliária'),
    '03.01.02.05': ('Demarcação de Terrenos para Regularização Fundiária de Interesse Social',
                    'Demarcação de terrenos para regularização fundiária de interesse social'),
    '03.03': ('Avaliação e Contabilidade Patrimonial Imobiliária',
              'Avaliação e contabilidade patrimonial imobiliária'),
    '03.04.03.01': ('Declaração de Interesse para o Serviço Público',
                    'Declaração de interesse para o serviço público'),
    '03.04.03.02': ('Reserva para Venda', 'Reserva para venda'),
    '03.05': ('Gestão de Receitas Patrimoniais Imobiliárias',
              'Gestão de receitas patrimoniais imobiliárias'),
    '03.07.01': ('Governança de Dados e Informação',
                 'Governança de dados e informação'),
    '03.07.01.04': ('Inteligência e Análise Informacional Patrimonial',
                    'Inteligência e análise informacional patrimonial'),
    '03.07.02': ('Gestão da Geoinformação Patrimonial',
                 'Gestão da geoinformação patrimonial'),
    '03.07.04': ('Gestão da Memória Institucional',
                 'Gestão da memória institucional'),
}


def padronizar_caixa(codigo, nome, aplicadas):
    """Baixa a caixa dos nomes listados, conferindo que o original não mudou."""
    par = CAIXA_PADRONIZADA.get(codigo)
    if par is None:
        return nome
    origem, corrigido = par
    if nome != origem:
        raise SystemExit(
            f'{codigo}: o nome no documento mudou desde que a padronização de '
            f'caixa foi escrita.\n  no documento: {nome!r}\n  esperado:     '
            f'{origem!r}\nRevise CAIXA_PADRONIZADA em extrair_minuta.py.')
    aplicadas.add(codigo)
    return corrigido


def extrair(caminho_docx):
    with zipfile.ZipFile(caminho_docx) as z:
        raiz = ET.fromstring(z.read('word/document.xml'))
    tabelas = list(raiz.iter(q('tbl')))
    if len(tabelas) != 1:
        raise SystemExit(f'esperava uma tabela no documento, encontrei {len(tabelas)}')
    registros = []
    aplicadas = set()
    for tr in tabelas[0].findall(q('tr')):
        celulas = [celula(tc) for tc in tr.findall(q('tc'))]
        if len(celulas) < 3 or not celulas[0]:
            continue
        cod = normalizar_codigo(celulas[0][0])
        if not cod:
            continue                      # cabeçalho da tabela
        definicao, exemplos = separar_exemplos(celulas[2])
        definicao, referencias = separar_referencias(definicao)
        registros.append({
            'codigo': cod,
            'descricao': padronizar_caixa(
                cod, ' '.join(' '.join(celulas[1]).split()), aplicadas),
            'definicao': definicao,
            'observacao': '',
            'fundamento_legal': referencias,
            'instrumento': '',
            'exemplos': '; '.join(exemplos),
        })
    faltando = set(CAIXA_PADRONIZADA) - aplicadas
    if faltando:
        raise SystemExit(f'padronização de caixa não encontrou os códigos '
                         f'{sorted(faltando)} no documento')
    return registros


def main(docx, saida):
    registros = extrair(docx)
    json.dump({'tt03': registros}, open(saida, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f'TT-03 (minuta): {len(registros)} registros')


if __name__ == '__main__':
    main(*sys.argv[1:3])
