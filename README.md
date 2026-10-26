# Tabelas Taxonômicas da SPU

Consulta pública às tabelas taxonômicas da Secretaria do Patrimônio da União, aprovadas por
resolução do Comitê de Gestão do Conhecimento (ComGC).

**Site:** <https://spu-projetoseprocessos.github.io/tabelas-taxonomicas-spu/>

| Tabela | Norma vigente | Registros |
|---|---|---|
| TT-01 — Tipos de Uso Imobiliário | Resolução ComGC/SPU/MGI nº 3, de 3 de outubro de 2025 | 96 |
| TT-02 — Regimes de Destinação Imobiliária | Resolução ComGC/SPU/MGI nº 5, de 24 de outubro de 2025 | 62 |

> **Fonte oficial.** As resoluções do ComGC e o registro no
> [MemóriaSPU](https://memoria-spu.gestao.gov.br) são a fonte oficial da taxonomia. Este
> repositório é uma interface de consulta e a mesma informação em formato estruturado,
> conferida contra o texto das normas.

## O que o site faz

- navegação em **árvore**, com teclado, e em **mapa**, explodindo galho a galho;
- **filtros** pelos atributos do Anexo II da TT-02 (natureza, prazo, efeito patrimonial e outros);
- **busca** em todas as tabelas e no glossário da SPU, com filtro de escopo;
- **ficha** de cada código: definição, observação, nota de aplicação, fundamentação legal,
  instrumento, exemplos, atributos, subdivisões, termos de glossário e norma de origem;
- **link permanente** por código (`#tt02/02.01.02.04`), para citar em processo, ofício ou sistema;
- **exportação** em CSV e JSON do recorte visível.

## Os dados

Os arquivos em `dados/` são o produto principal — o site é um consumidor deles, e qualquer
sistema pode ser outro. Para cada tabela: `registros.csv` (fonte editável), `registros.json`
e `arvore.json` (derivados), `tabela.json` (norma, rótulos de nível, totais) e, quando a norma
tiver anexo de atributos, `atributos.csv` com o vocabulário controlado.

Formato descrito campo a campo em [docs/esquema-de-dados.md](docs/esquema-de-dados.md).

`dados/glossario/` traz os termos exportados do MemóriaSPU e os vínculos termo ↔ código, cada
um marcado como validado ou divergente, com o endereço do verbete no acervo.

## Reproduzir

Tudo o que gera os dados está em `ferramentas/`, e as fontes (PDFs das resoluções e export do
glossário) estão em `origem/`. Só precisa de Python 3; a extração dos PDFs usa `pymupdf`.

```bash
python3 ferramentas/gerar_dados.py origem dados    # normas + glossário -> dados canônicos
python3 ferramentas/validar.py dados               # conferência: falha com qualquer erro
python3 ferramentas/verificar_links.py dados       # confere os endereços do glossário (usa rede)
python3 ferramentas/servir.py 8765                 # ver o site em http://127.0.0.1:8765/
```

## Acrescentar uma tabela nova

1. Transcrever o anexo da resolução para `dados/<nova-tabela>/registros.csv`, no formato de
   `docs/esquema-de-dados.md`.
2. Criar `tabela.json` com a norma, os rótulos de nível, a profundidade, a cor e o nome do
   último nível (`rotulo_folha`).
3. Se a norma tiver anexo de atributos, criar `atributos.csv` e `vocabulario-atributos.json`.
4. Rodar `validar.py` — a publicação só segue com zero erro.
5. Acrescentar a entrada em `dados/tabelas.json`.
6. Guardar o PDF do SEI em `origem/`.

Nenhum desses passos mexe no código do site: ele lê o índice e se adapta ao que cada tabela
declara.

## Conferência automática

`ferramentas/validar.py` roda a cada push (ver `.github/workflows/validar.yml`) e verifica:
código bem formado e sem duplicados, pai existente, nível coerente, descrição e definição
preenchidas, totais conferidos, toda folha com atributos onde a tabela os tiver, valores
dentro do vocabulário e vínculo de glossário apontando para código existente.

Os avisos que sobram são achados reais nas fontes, descritos em
[docs/achados-da-conversao.md](docs/achados-da-conversao.md) — inclusive dois defeitos nas
próprias resoluções e três vínculos errados no glossário.

## Licença

Código sob licença MIT (`LICENSE`). O conteúdo das tabelas vem de atos normativos públicos do
ComGC/SPU e pode ser reutilizado citando a norma de origem. As fontes tipográficas em
`fontes/` estão sob SIL Open Font License 1.1.
