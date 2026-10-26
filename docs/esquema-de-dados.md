# Esquema canônico dos dados — proposta v1.0

Princípio: **o dado é o produto.** A página estática, o sistema corporativo, a planilha e o
MemóriaSPU são consumidores dos mesmos arquivos. A norma é a fonte; o CSV é a transcrição
revisável; o JSON é derivado do CSV por script, nunca editado à mão.

## Organização das pastas

```
dados/
  tabelas.json                  índice de tudo que está publicado
  tt01-uso-imobiliario/
    tabela.json                 metadados da tabela (norma, rótulos de nível, totais)
    registros.csv               FONTE EDITÁVEL — um registro por linha
    registros.json              derivado (campos multivalorados como lista)
    arvore.json                 derivado (hierarquia aninhada, para navegação e mapa)
  tt02-regimes-destinacao/
    tabela.json
    registros.csv
    atributos.csv               FONTE EDITÁVEL — facetas do Anexo II
    vocabulario-atributos.json  valores admitidos por faceta
    registros.json / arvore.json / atributos.json   derivados
  glossario/
    termos.csv                  termos exportados do MemóriaSPU
    vinculos.csv                termo ↔ código de tabela
    glossario.json              derivado
```

Uma tabela nova é **uma pasta nova + uma linha no índice**. Nada no código da página muda.

## `registros.csv`

| Campo | Tipo | Regra |
|---|---|---|
| `codigo` | texto | chave; notação da norma (`01.03.04`); define a hierarquia |
| `nivel` | inteiro | derivado do código e validado contra ele |
| `pai` | texto | derivado; vazio no 1º nível; **tem de existir na tabela** |
| `descricao` | texto | nome do registro, exatamente como na coluna "Descrição" da norma |
| `definicao` | texto | só a definição — sem os blocos abaixo |
| `observacao` | texto | o bloco "Observação:" da norma, separado |
| `fundamento_legal` | lista | separador ` \| `; um dispositivo por item |
| `instrumento` | lista | separador ` \| ` |
| `exemplos` | lista | separador ` \| `; vazio quando a norma traz "-" |
| `situacao` | enum | `vigente`, `restrito_migracao`, `restrito_legal`, `revogado` |
| `nota_de_aplicacao` | texto | orientação de uso que vem do corpo da resolução, não do anexo |

`situacao` resolve o problema dos códigos que existem mas não devem ser oferecidos ao usuário.
Hoje só o `01.18 Sem informação` é `restrito_migracao`, porque a própria norma diz que ele não
será disponibilizado para marcação. O `01.19 Sem uso definido/vinculado` é de uso normal: a
norma restringe os casos em que ele se aplica, não a sua marcação.

`nota_de_aplicacao` carrega o que está no corpo da norma e não no anexo — hoje o caso do
`01.10`, com a regra provisória do art. 2º da Resolução nº 3/2025.

## `atributos.csv` (facetas)

Aplica-se **somente às folhas** — na TT-02, as 46 folhas do Anexo I, que são exatamente as
46 linhas do Anexo II. Colunas: `codigo` + as sete facetas
(`discricionariedade`, `natureza`, `pagamento_em_dinheiro`, `baixa_patrimonial`, `prazo`,
`efeito_patrimonial`, `uso_determinado`).

O CSV preserva a grafia da norma, inclusive os valores duplos (`Definitivo/ Resolúvel`);
o JSON derivado normaliza em lista (`["Definitivo","Resolúvel"]`), que é o formato que o
filtro facetado consome. `vocabulario-atributos.json` fecha os valores admitidos — é o que
impede, no futuro, que uma transcrição introduza "Oneroso" onde a norma diz "Onerosa".

## `tabela.json`

Identificação, domínio, `cor` (identidade visual da tabela, usada pela página),
`rotulo_folha` (como chamar o último nível na interface, para não se falar em "folhas"),
`rotulos_nivel` (um rótulo por nível, conferido contra a profundidade), `norma_vigente` (ato, publicação, documento e processo SEI, arquivo do PDF),
`historico` (a cadeia de atos, com o efeito de cada um) e `totais` conferidos pelo validador.

## `glossario/vinculos.csv`

| Campo | Observação |
|---|---|
| `termo_id` | slug estável do termo |
| `tabela`, `codigo` | destino do vínculo |
| `tipo_relacao` | `define` (hoje, o que vem do export), e adiante `relacionado`, `instrumento`, `norma`, `sinonimo_de_busca` |
| `origem` | `export-memoriaspu` ou `curado` — separa o que veio do acervo do que foi decidido aqui |
| `situacao` | `validado`, `divergente`, `codigo_inexistente` |
| `observacao` | o que divergiu |

A coluna `origem` é o que permite reimportar o export do MemóriaSPU sem perder a curadoria
feita no repositório.

## Validação (`ferramentas/validar.py`)

Roda a cada alteração e falha a publicação quando há erro:

1. código bem formado, sem duplicados;
2. `nivel` coerente com o código e `pai` existente na tabela — **é a checagem que pega o
   defeito do protótipo** (`02.01.02.04` ausente com dois filhos órfãos);
3. descrição e definição não vazias;
4. profundidade dentro do declarado e um rótulo por nível;
5. totais do `tabela.json` conferidos contra o CSV;
6. toda folha com linha de atributos, e nenhum atributo em nó que não é folha;
7. valores de faceta dentro do vocabulário;
8. vínculo do glossário apontando para código existente, com aviso quando o termo difere da
   descrição da tabela ou quando um código recebe dois termos.
