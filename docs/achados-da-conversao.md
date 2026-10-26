# Achados da conversão — o que apareceu ao comparar norma, protótipo e glossário

A conversão foi feita a partir dos **PDFs das resoluções**, não do protótipo. A comparação
entre as três fontes expôs problemas em cada uma delas.

## 1. No protótipo HTML (dados que estavam sendo exibidos)

| Achado | Detalhe |
|---|---|
| Falta um registro da TT-02 | `02.01.02.04 — Concessão de Direito de Superfície` não existe no protótipo, mas seus dois filhos existem: ficam órfãos e **sem caminho de navegação**. 61 registros contra 62 da norma |
| Definições deslocadas | Como consequência da falta acima, há registros exibindo a definição de **outro** regime. Exemplo verificado: `02.01.02.03.02 — Concessão de Direito Real de Uso Onerosa` exibe a definição e o fundamento da Concessão de Direito de Superfície |
| **54 das 96 definições da TT-01 estão encurtadas** | Não é diferença de formatação: há conteúdo normativo suprimido. Exemplos: `01.03.02` perdeu toda a enumeração entre parênteses ("coleta ou apanha de produtos, como madeiras, látex, sementes, fibras, frutos e raízes… extração de minérios e rochas do solo, dos rios e do mar"); `01.02.01` perdeu "(agricultura)" e "(pecuária)"; `01.03.03` perdeu "incluindo Áreas de Preservação Permanente (APP), Reserva Legais e outras zonas…" |
| Anexo II ausente | As sete facetas das 46 folhas da TT-02 não estavam nos dados |
| Blocos colados na definição | "Observação:", "Fundamentação legal (União):" e "Instrumento:" dentro da mesma string |

Consequência prática: a página pública não pode ser gerada a partir do protótipo. A conversão
agora publicada vem da norma e tem conferência automática.

## 2. Nas próprias resoluções (precisam de correção pelo ComGC)

| Achado | Detalhe |
|---|---|
| `01.06.02.01` com definição truncada | A definição começa em minúscula e no meio da frase: "em programas habitacionais de interesse social, em áreas urbanas…" — falta a abertura ("Uso imobiliário destinado à moradia…"). Termina com "construção assistida. com infraestrutura básica." |
| `02.01.02.01.02 — Aforamento oneroso` | A célula "Pagamento em dinheiro" está **vazia** no Anexo II. Sendo regime oneroso, a leitura provável é "Sim", mas não cabe presumir: fica em branco e sinalizado |
| Rótulos de nível a mais | A TT-02 declara seis rótulos (até "Detalhamento") para uma estrutura de cinco níveis; a TT-01, quatro rótulos para três níveis |

Os dois primeiros itens são candidatos a errata ou a correção na próxima alteração das tabelas.

## 3. No glossário exportado do MemóriaSPU (234 termos)

| Achado | Detalhe |
|---|---|
| O vínculo já existe no acervo | 72 termos trazem "Código do termo" e "Tabela taxonômica" preenchidos — **o vínculo não precisa ser inventado, precisa ser colhido e conferido** |
| Só TT-01 | Todos os 72 códigos são da TT-01; nenhum termo aponta para a TT-02 (que é mais recente) |
| **Dois códigos vinculados ao termo errado** | `01.06.02` está no termo "Uso em infraestrutura ferroviária e metroviária" (o código desse uso é da família `01.09`), e `01.15.01` está no termo "Usufruto Indígena" (família `01.11`). Nos dois casos o código já pertence a outro termo, correto, no mesmo glossário |
| Um termo funde dois códigos | "Uso Para Aquicultura e Pesca" aponta para `01.02.02`, que na norma é só "Uso para aquicultura" — a pesca é `01.02.03` |
| Versão defasada em dois termos | Dois termos ainda citam a Resolução nº 2/2025 como fonte, quando a vigente é a nº 3/2025 |
| 26 registros da TT-01 sem termo | De 96 códigos, 70 têm termo no glossário |
| 67 de 72 definições são idênticas | O glossário replica a definição da taxonomia. Não deve haver duas versões do mesmo texto: a taxonomia é a fonte, e o glossário agrega o que é dele (informações complementares, referência, legislação) |
| Export sem link permanente | A coluna "Link de acesso" veio **vazia nos 234 termos**, e as colunas de relação (fluxos, publicações, manifestações jurídicas, vídeos) também. Sem a URL do termo não há como linkar do site de volta para o MemóriaSPU |

## 4. Resultado da validação automática

`0 erro(s), 7 aviso(s)` — os sete avisos são exatamente os achados reais listados acima
(2 das normas, 5 do glossário). O relatório completo está em `relatorios/validacao.txt`.
