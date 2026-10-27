# -*- coding: utf-8 -*-
"""Gera os dados canônicos das tabelas taxonômicas e do glossário.

Entrada : PDFs das resoluções + CSVs exportados do MemóriaSPU
Saída   : proposta/dados/** (CSV editável + JSON derivado + índice)
"""
import csv, glob, json, os, re, sys, unicodedata
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extrair_normas as en
import extrair_minuta as em

SEP = ' | '          # separador de campo multivalorado nos CSV

# ---------------------------------------------------------------- utilidades
def ascii_slug(s):
    s = unicodedata.normalize('NFKD', s or '')
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s)).strip('-')

def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', s)

def nivel(codigo):
    return len(codigo.split('.')) - 1

def pai(codigo):
    partes = codigo.split('.')
    return '.'.join(partes[:-1]) if len(partes) > 2 else ''

def lista(texto):
    """Quebra 'Exemplos: a; b; c' ou 'art. X; art. Y' em lista."""
    t = (texto or '').strip()
    if not t or t == '-':
        return []
    t = re.sub(r'^Exemplos?:\s*', '', t)
    partes = [p.strip(' .;') for p in re.split(r';', t)]
    return [p for p in partes if p]

def multi(valor, permitidos=()):
    """'Discricionário / Vinculado' e 'Sim/ Não' -> lista de valores.

    Valores do vocabulário que contêm barra ('Precário / obrigacional') são
    reconhecidos antes da quebra, para não serem partidos em dois.
    """
    v = (valor or '').strip()
    if not v:
        return []
    if v in permitidos:
        return [v]
    return [p.strip() for p in re.split(r'\s*/\s*', v) if p.strip()]

def escrever_csv(caminho, colunas, linhas):
    with open(caminho, 'w', encoding='utf-8', newline='') as fh:
        w = csv.DictWriter(fh, fieldnames=colunas, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for l in linhas:
            w.writerow({c: l.get(c, '') for c in colunas})

def escrever_json(caminho, obj):
    json.dump(obj, open(caminho, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ------------------------------------------------- notas de aplicação da norma
NOTAS = {
    '01.10': ('Classificação mantida em caráter provisório até a implementação da seleção '
              'múltipla de usos nos sistemas corporativos. A seleção em processos de destinação '
              'exige validação pela Unidade Central ou análise posterior de conformidade, e os '
              'múltiplos usos devem ser discriminados na descrição da finalidade, com código e '
              'denominação (art. 2º da Resolução ComGC/SPU/MGI nº 3/2025).'),
}
SITUACAO = {
    '01.18': 'restrito_migracao',   # a própria norma veda a marcação pelo usuário
}

# ------------------------------------------------------------ montagem de tabela
def montar_registros(brutos):
    saida = []
    for r in brutos:
        cod = r['codigo']
        saida.append({
            'codigo': cod,
            'nivel': nivel(cod),
            'pai': pai(cod),
            'descricao': r['descricao'].strip(),
            'definicao': r['definicao'].strip(),
            'observacao': r['observacao'].strip(),
            'fundamento_legal': SEP.join(lista(r['fundamento_legal'])),
            'instrumento': SEP.join(lista(r['instrumento'])),
            'exemplos': SEP.join(lista(r['exemplos'])),
            'situacao': SITUACAO.get(cod, 'vigente'),
            'nota_de_aplicacao': NOTAS.get(cod, ''),
        })
    return saida

def arvore(registros):
    por_cod = {r['codigo']: r for r in registros}
    filhos = defaultdict(list)
    for r in sorted(registros, key=lambda x: x['codigo']):
        filhos[r['pai']].append(r['codigo'])
    def no(cod):
        r = por_cod[cod]
        kids = [no(c) for c in filhos[cod]]
        return {'codigo': cod, 'descricao': r['descricao'], 'nivel': r['nivel'],
                'folha': not kids, 'situacao': r['situacao'],
                **({'filhos': kids} if kids else {})}
    return [no(c) for c in filhos['']]

def totais(registros):
    folhas = {r['codigo'] for r in registros} - {r['pai'] for r in registros if r['pai']}
    return {'registros': len(registros), 'folhas': len(folhas),
            'por_nivel': dict(sorted(Counter(r['nivel'] for r in registros).items()))}

COLS_REG = ['codigo', 'nivel', 'pai', 'descricao', 'definicao', 'observacao',
            'fundamento_legal', 'instrumento', 'exemplos', 'situacao', 'nota_de_aplicacao']

def copiar_norma(pasta_base, destino, meta):
    """Leva o PDF da resolução para junto dos dados, para a ficha poder abri-lo."""
    import shutil
    if not meta.get('norma_vigente'):
        return ''                      # minuta: não há resolução para abrir
    arquivo = meta['norma_vigente'].get('arquivo')
    origem = arquivo and os.path.join(pasta_base, arquivo)
    if not origem or not os.path.exists(origem):
        return ''
    pasta = os.path.join(destino, 'normas')
    os.makedirs(pasta, exist_ok=True)
    shutil.copyfile(origem, os.path.join(pasta, arquivo))
    return f'normas/{arquivo}'


def gravar_tabela(destino, meta, registros, atributos=None, vocabulario=None):
    os.makedirs(destino, exist_ok=True)
    escrever_csv(f'{destino}/registros.csv', COLS_REG, registros)
    regs_json = []
    for r in registros:
        d = dict(r)
        for campo in ('fundamento_legal', 'instrumento', 'exemplos'):
            d[campo] = [x for x in r[campo].split(SEP) if x]
        regs_json.append(d)
    escrever_json(f'{destino}/registros.json', regs_json)
    escrever_json(f'{destino}/arvore.json', arvore(registros))
    meta = dict(meta, totais=totais(registros))
    if atributos is not None:
        escrever_csv(f'{destino}/atributos.csv', COLS_AT, atributos)
        escrever_json(f'{destino}/atributos.json',
                      [{**{'codigo': a['codigo']},
                        **{k: multi(a[k], vocabulario[k]['valores'])
                           for k in COLS_AT if k != 'codigo'}}
                       for a in atributos])
        escrever_json(f'{destino}/vocabulario-atributos.json', vocabulario)
        meta['atributos'] = {'arquivo': 'atributos.csv', 'registros': len(atributos),
                             'aplica_se_a': 'folhas'}
    escrever_json(f'{destino}/tabela.json', meta)
    return meta

COLS_AT = ['codigo', 'discricionariedade', 'natureza', 'pagamento_em_dinheiro',
           'baixa_patrimonial', 'prazo', 'efeito_patrimonial', 'uso_determinado']

# ----------------------------------------------------------------- metadados
META_TT01 = {
    'id': 'tt01-uso-imobiliario',
    'sigla': 'TT-01',
    'titulo': 'Tipos de Uso Imobiliário',
    'eixo': 'Uso do imóvel',
    'cor': '#A4461E',
    'dominio': 'Uso atribuído ao imóvel da União',
    'rotulos_nivel': ['Tipo de uso imobiliário', 'Uso de 2º nível', 'Uso de 3º nível'],
    'rotulo_folha': 'usos',
    'profundidade': 3,
    'norma_vigente': {
        'ato': 'Resolução ComGC/SPU/MGI nº 3, de 3 de outubro de 2025',
        'efeito': 'altera o Anexo da Resolução ComGC/SPU nº 2/2025',
        'publicacao': '2025-10-08',
        'sei_documento': '54419957',
        'processo_sei': '19739.024321/2025-60',
        'arquivo': 'SEI_54419957_Resolucao_3.pdf',
    },
    'historico': [
        {'ato': 'Resolução ComGC/SPU nº 2, de 9 de maio de 2025', 'efeito': 'institui a TT-01',
         'situacao': 'anexo substituído pela Resolução nº 3/2025'},
        {'ato': 'Resolução ComGC/SPU/MGI nº 3, de 3 de outubro de 2025',
         'efeito': 'altera o Anexo (versão vigente)', 'situacao': 'vigente'},
    ],
    'fonte_oficial': 'https://memoriaspu.gestao.gov.br',
    'tem_exemplos': True,
}

META_TT02 = {
    'id': 'tt02-regimes-destinacao',
    'sigla': 'TT-02',
    'titulo': 'Regimes de Destinação Imobiliária',
    'eixo': 'Destinação do imóvel',
    'cor': '#17585E',
    'dominio': 'Regime jurídico-administrativo da destinação do imóvel',
    'rotulos_nivel': ['Classe de regime', 'Subclasse', 'Categoria', 'Regime', 'Submodalidade'],
    'rotulo_folha': 'regimes',
    'profundidade': 5,
    'norma_vigente': {
        'ato': 'Resolução ComGC/SPU/MGI nº 5, de 24 de outubro de 2025',
        'efeito': 'institui a TT-02',
        'publicacao': '2025-10-24',
        'sei_documento': '54999155',
        'processo_sei': '19739.024321/2025-60',
        'arquivo': 'SEI_54999155_Resolucao_5_TT02.pdf',
    },
    'historico': [
        {'ato': 'Resolução ComGC/SPU/MGI nº 5, de 24 de outubro de 2025',
         'efeito': 'institui a TT-02', 'situacao': 'vigente'},
    ],
    'fonte_oficial': 'https://memoriaspu.gestao.gov.br',
    'tem_exemplos': False,
}

# A TT-03 ainda não é norma: entra como minuta, com a marcação que avisa disso
# em toda parte da interface. Não há ato, não há PDF de resolução — a fonte é o
# documento de trabalho, na versão com as alterações controladas aceitas.
META_TT03 = {
    'id': 'tt03-funcoes-finalisticas',
    'sigla': 'TT-03',
    'titulo': 'Funções Finalísticas de Gestão Patrimonial Imobiliária',
    'eixo': 'Função finalística',
    'cor': '#4F6132',
    'dominio': 'Função finalística exercida na gestão do patrimônio imobiliário da União',
    'rotulos_nivel': ['Macrofunção', 'Função', 'Subfunção', 'Categoria'],
    'rotulo_folha': 'funções',
    'profundidade': 4,
    'situacao': 'minuta',
    'aviso': ('Esta tabela ainda não foi aprovada: não há resolução do Comitê de Gestão do '
              'Conhecimento que a institua. Códigos, descrições e definições podem mudar '
              'até a aprovação — não devem ser usados como referência normativa nem '
              'registrados em sistema.'),
    'norma_vigente': None,
    'origem': {
        'tipo': 'minuta',
        'documento': 'Proposta de Tabela Taxonômica — Funções finalísticas de gestão '
                     'patrimonial imobiliária',
        'rotulo': 'Minuta — ainda sem resolução do ComGC',
        'versao': '2026-10-27',
        'nota': ('Transcrição do documento de trabalho na versão com todas as alterações '
                 'controladas aceitas. O número da tabela ainda não foi atribuído: o '
                 'documento traz o prefixo 0X e aqui se adota 03, provisoriamente.'),
    },
    'historico': [],
    'fonte_oficial': 'https://memoriaspu.gestao.gov.br',
    'tem_exemplos': True,
}

VOCABULARIO = {
    'discricionariedade': {'rotulo': 'Discricionário ou vinculado',
                           'valores': ['Discricionário', 'Vinculado']},
    'natureza': {'rotulo': 'Natureza', 'valores': ['Gratuita', 'Onerosa']},
    'pagamento_em_dinheiro': {'rotulo': 'Pagamento em dinheiro', 'valores': ['Sim', 'Não']},
    'baixa_patrimonial': {'rotulo': 'Baixa patrimonial', 'valores': ['Sim', 'Não']},
    'prazo': {'rotulo': 'Prazo', 'valores': ['Determinado', 'Indeterminado']},
    'efeito_patrimonial': {'rotulo': 'Efeito patrimonial',
                           'valores': ['Definitivo', 'Resolúvel', 'Precário / obrigacional']},
    'uso_determinado': {'rotulo': 'Uso determinado', 'valores': ['Sim', 'Não']},
}

# ------------------------------------------------------------------ glossário
BASE_GLOSSARIO = 'https://memoria-spu.gestao.gov.br/glossario-spu/'

# o endereço desejado já estava ocupado no acervo e o verbete ficou com sufixo
EXCECOES_LINK = {
    'uso-para-producao-industrial': 'uso-para-producao-industrial-2',
    'uso-para-pratica-esportiva': 'uso-para-pratica-esportiva-2',
}

def link_glossario(termo):
    """Endereço do verbete. A regra do acervo é minúsculas, sem acento e hífen no
    lugar de qualquer outro caractere; as exceções acima foram conferidas uma a uma
    (ver ferramentas/verificar_links.py)."""
    s = ascii_slug(termo)
    return BASE_GLOSSARIO + EXCECOES_LINK.get(s, s) + '/'

COLS_TERMO = ['id', 'termo', 'definicao', 'informacoes_complementares', 'referencia',
              'legislacao_e_normativos', 'acervo', 'url_memoriaspu', 'arquivo_origem']
COLS_VINC = ['termo_id', 'termo', 'tabela', 'codigo', 'tipo_relacao', 'origem',
             'situacao', 'observacao']

def ler_glossario(pasta):
    linhas = []
    for f in sorted(glob.glob(os.path.join(pasta, 'glossario-spu-*.csv'))):
        with open(f, encoding='utf-8-sig', newline='') as fh:
            for x in csv.DictReader(fh):
                x['_arquivo'] = os.path.basename(f)
                linhas.append(x)
    return linhas

def montar_glossario(linhas, registros_por_codigo):
    termos, vinculos, usados = [], [], Counter()
    for x in linhas:
        termo = (x.get('Termo') or '').strip()
        base = ascii_slug(termo) or 'termo'
        usados[base] += 1
        tid = base if usados[base] == 1 else f'{base}-{usados[base]}'
        termos.append({
            'id': tid, 'termo': termo,
            'definicao': (x.get('Definição') or '').strip(),
            'informacoes_complementares': (x.get('Informações complementares') or '').strip(),
            'referencia': (x.get('Referência') or '').strip(),
            'legislacao_e_normativos': (x.get('Legislação e normativos') or '').strip(),
            'acervo': (x.get('Identificação do acervo') or '').strip(),
            'url_memoriaspu': (x.get('Link de acesso') or '').strip() or link_glossario(termo),
            'arquivo_origem': x['_arquivo'],
        })
        cod = (x.get('Código do termo') or '').strip()
        if not cod:
            continue
        reg = registros_por_codigo.get(cod)
        if not reg:
            sit, obs = 'codigo_inexistente', 'código citado não existe na tabela vigente'
        elif norm(termo) == norm(reg['descricao']):
            sit, obs = 'validado', ''
        else:
            sit, obs = 'divergente', f"descrição na tabela: {reg['descricao']}"
        vinculos.append({
            'termo_id': tid, 'termo': termo,
            'tabela': 'tt01-uso-imobiliario' if cod.startswith('01') else
                      ('tt02-regimes-destinacao' if cod.startswith('02') else ''),
            'codigo': cod, 'tipo_relacao': 'define',
            'origem': 'export-memoriaspu', 'situacao': sit, 'observacao': obs,
            'norma_citada': (x.get('Tabela taxonômica') or '').strip(),
        })
    return termos, vinculos

# -------------------------------------------------------------- minuta TT-03
# O .docx da proposta é documento interno de trabalho, com nomes de revisores no
# controle de alterações: ele não vai para o repositório publicado. Quando está
# presente, a minuta é extraída dele; quando não, vale o registros.csv já
# transcrito, que é a fonte revisável prevista no esquema.
PADRAO_MINUTA = '*Proposta_Tabela_Taxon*.docx'

def registros_minuta(pasta_base, destino):
    achados = sorted(glob.glob(os.path.join(pasta_base, PADRAO_MINUTA)))
    if achados:
        return montar_registros(em.extrair(achados[-1])), os.path.basename(achados[-1])
    csv_existente = os.path.join(destino, META_TT03['id'], 'registros.csv')
    if os.path.exists(csv_existente):
        with open(csv_existente, encoding='utf-8', newline='') as fh:
            # o CSV devolve tudo como texto; o nível é número no JSON derivado
            return [dict(r, nivel=int(r['nivel'])) for r in csv.DictReader(fh)], ''
    raise SystemExit(f'minuta da TT-03: nem {PADRAO_MINUTA} em {pasta_base} '
                     f'nem {csv_existente}')

def entrada_indice(m):
    """Linha do índice. Uma minuta não tem ato: no lugar dele vai o rótulo da
    origem, e a situação é o que faz a interface mostrar o aviso."""
    n = m.get('norma_vigente')
    return {
        'id': m['id'], 'sigla': m['sigla'], 'titulo': m['titulo'],
        'eixo': m['eixo'], 'cor': m['cor'], 'dominio': m['dominio'],
        'rotulo_folha': m.get('rotulo_folha', 'itens'),
        'situacao': m.get('situacao', 'vigente'),
        'aviso': m.get('aviso', ''),
        'norma_publicacao': n['publicacao'] if n else m['origem']['versao'],
        'norma_vigente': n['ato'] if n else m['origem']['rotulo'],
        'caminho': m['id'], 'profundidade': m['profundidade'],
        'totais': m['totais'],
        'tem_atributos': 'atributos' in m,
        'tem_exemplos': m['tem_exemplos'],
    }

# ----------------------------------------------------------------------- main
def main(pasta_base, destino):
    os.makedirs(destino, exist_ok=True)
    en.main(os.path.join(pasta_base, META_TT01['norma_vigente']['arquivo']),
            os.path.join(pasta_base, META_TT02['norma_vigente']['arquivo']),
            os.path.join(destino, '_bruto.json'))
    bruto = json.load(open(os.path.join(destino, '_bruto.json'), encoding='utf-8'))

    reg01 = montar_registros(bruto['tt01'])
    reg02 = montar_registros(bruto['tt02'])
    atributos = [{c: a.get(c, '') for c in COLS_AT} for a in bruto['tt02_atributos']]

    for meta in (META_TT01, META_TT02, META_TT03):
        if meta.get('norma_vigente'):
            meta['norma_vigente']['pdf'] = copiar_norma(pasta_base, destino, meta)

    reg03, _ = registros_minuta(pasta_base, destino)
    m1 = gravar_tabela(os.path.join(destino, META_TT01['id']), META_TT01, reg01)
    m2 = gravar_tabela(os.path.join(destino, META_TT02['id']), META_TT02, reg02,
                       atributos, VOCABULARIO)
    m3 = gravar_tabela(os.path.join(destino, META_TT03['id']), META_TT03, reg03)

    por_codigo = {r['codigo']: r for r in reg01 + reg02}   # a minuta não recebe vínculo
    termos, vinculos = montar_glossario(ler_glossario(pasta_base), por_codigo)
    pasta_g = os.path.join(destino, 'glossario')
    os.makedirs(pasta_g, exist_ok=True)
    escrever_csv(os.path.join(pasta_g, 'termos.csv'), COLS_TERMO, termos)
    escrever_csv(os.path.join(pasta_g, 'vinculos.csv'), COLS_VINC + ['norma_citada'], vinculos)
    escrever_json(os.path.join(pasta_g, 'glossario.json'),
                  {'termos': termos, 'vinculos': vinculos})

    indice = {
        'versao_esquema': '1.0',
        'tabelas': [entrada_indice(m) for m in (m1, m2, m3)],
        'glossario': {'caminho': 'glossario', 'termos': len(termos),
                      'vinculos': len(vinculos)},
    }
    escrever_json(os.path.join(destino, 'tabelas.json'), indice)
    os.remove(os.path.join(destino, '_bruto.json'))
    print(f"TT-01 {m1['totais']}\nTT-02 {m2['totais']}\nTT-03 {m3['totais']} (minuta)")
    print(f'glossário: {len(termos)} termos, {len(vinculos)} vínculos')

if __name__ == '__main__':
    main(*sys.argv[1:3])
