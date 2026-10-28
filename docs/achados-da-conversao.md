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

## 4. Na minuta de funções finalísticas — TT-XX (documento de trabalho, 98 itens)

A transcrição veio do `.docx` da proposta, na versão **com todas as alterações controladas
aceitas** — que é a versão finalizada, já que nenhuma das três rodadas de revisão apaga o que
outra escreveu: são 121 inserções de conteúdo de uma revisora, 385 marcas só de formatação de
tabela de outra, e a rodada mais recente, que renumerou a tabela e criou a função
`03.01.04`. O arquivo **não traz comentários**; se havia, perderam-se nessa cópia.

A estrutura está sã: 98 códigos, nenhum duplicado, nenhum órfão, e a primeira palavra de cada
definição confere com o nível em 97 dos 98 registros (Macrofunção no 1º, Função no 2º,
Subfunção no 3º, Categoria no 4º) — o único desvio é um plural, "Subfunções".

O que precisa de correção por quem redige:

| Achado | Onde |
|---|---|
| **Número da tabela indefinido** | O documento usa o prefixo `0X`, e dois itens guardam o `03` da numeração de trabalho (`03.01.04.02`, `03.04.01.01`). Adotou-se `03`, provisoriamente |
| **Ano errado do Decreto-Lei** | `03.01.03` cita "Decreto-Lei 9.760/**1948**"; nos outros seis registros que o citam o ano é **1946**, que é o correto |
| **Três padrões de caixa nos nomes** | Caixa de sentença em 79 registros, caixa alta em cinco (`03.02`, `03.04`, `03.06`, `03.07` e o "COERCITIVA" do `03.06.01.02`) e Title Case em dez (`03.01`, `03.01.02.05`, `03.03`, `03.04.03.01`, `03.04.03.02`, `03.05`, `03.07.01`, `03.07.01.04`, `03.07.02`, `03.07.04`). Os quinze foram padronizados para caixa de sentença na extração — ver `CAIXA_PADRONIZADA` em `ferramentas/extrair_minuta.py` |
| **Concordância em `03.04`** | "Destinação e gestão econômica patrimonial **imobiliário**": os núcleos são femininos, deveria ser "imobiliária". Nos outros três de nível 1 o masculino concorda com "ingresso", "controle" e "conhecimento". **Não corrigido** — é mérito de redação, não de transcrição |
| Ponto final em nome | `03.07.01.05` — "Gestão do ciclo de vida e dos dados mestres patrimoniais." |
| **Sete folhas sem exemplos** | De 98 registros, 63 trazem "Exemplos de documentos" e 35 não trazem. Nos intermediários isso é aceitável; nos sete de último nível, não — `03.01.01.03`, `03.01.01.04`, `03.01.04.01`, `03.01.04.02`, `03.02.03.02`, `03.03.02` e `03.05.02` |
| **Remissão a tabela inexistente** | `03.02.02.01` delega a classificação a uma "Tabela Taxonômica própria de Regimes de Ingresso Patrimonial"; o ComGC instituiu só a TT-01 e a TT-02 |
| **TT-02 citada de três formas** | "TT 02/2025" (`03.04`), "TT 02" (`03.04.02`) e "Tabela Taxonômica nº 02/2025" (`03.04.02.01`); a Resolução nº 5/2025 institui "Tabela Taxonômica nº 02 – Regimes de Destinação Imobiliária (TT-02)" |
| Dois nomes que são instruções | `03.02.02.01` e `03.04.02.01`, este com 148 caracteres — conteúdo de definição, não de nome |
| Plural fora do padrão | `03.04.02.01` abre a definição com "Subfunções"; as outras 97 usam a palavra do nível no singular |
| Rótulo da lista de exemplos varia | "Exemplos de documentos:", "Exemplos de documentos" (sem dois-pontos) e "Exemplos:"; em dois registros o rótulo fecha o parágrafo da definição em vez de abrir um próprio |
| Bloco de referências solto | Só `03.01.03` termina com "Referências: …", que aqui virou `fundamento_legal`. Nos demais, nada equivale à "Fundamentação legal (União)" da TT-01 e da TT-02 |

## 5. Na minuta de regimes de ingresso — TT-03 (minuta de resolução, 37 itens no Anexo I)

| Achado | Onde |
|---|---|
| **Número errado da Lei de Execuções Fiscais** | `03.01.02.06` cita "Lei nº **6380**/1980"; é a **Lei nº 6.830/1980**. O art. 24 citado é o correto, só o número da lei saiu com os dígitos trocados |
| **Oito códigos do Anexo II sem o prefixo da tabela** | As observações mandam classificar em `01.02.03.01`, `01.01.05.01` e outros seis; `01.…` é o prefixo da TT-01, **que está em vigor**, então a instrução leva à tabela errada. Deveriam ser `03.01.02.03.01`, `03.01.01.05.01` etc. |
| **Subregimes de doação citam pai inexistente** | `03.01.02.05.01` e `03.01.02.05.02` abrem com "Subregime de **recebimento** por doação"; o pai chama-se "**Aquisição** por doação", e não há registro com aquele nome |
| Resolução sem número e sem data | O cabeçalho traz `nº......., DE ......... DE ............ DE 2026` |
| Nove códigos escritos com espaço | `03. 01.01.01` e outros oito; o espaço foi removido na transcrição |
| Citações legais em cinco formatos | `Lei nº 10.406/2002`, `Lei nº 10.406`, `Lei nº10.406/2002`, `Lei 14133/2021`, `Lei nº 6380/1980` |
| Parêntese não fechado | `03.01.01.05.02`: "(Código Civil, arts 1238 a 1244" |
| Rótulo sem "(União)" | `03.01.01.01` escreve "Fundamentação legal:" onde os outros 26 escrevem "Fundamentação legal (União):" |
| Caixa dos termos — **não alterada** | Sete termos com maiúsculas internas ("Recebimento por Cessão de uso Gratuita"). A convenção é ambígua: a TT-02 aprovada capitaliza regimes nomeados. Decisão pendente de quem redige |
| Hierarquia assimétrica — **não é defeito** | Sob `03.01` há subclasse antes dos regimes; sob `03.02` os regimes penduram direto na classe. A TT-02, aprovada, tem a mesma assimetria |
| Anexo II fora do site | A Tabela Taxonômica de Correspondência nº 03 é de-para com o SPUnet, não taxonomia: não tem hierarquia para navegar. `ferramentas/extrair_ingresso.py` já a lê, em `correspondencia()` |

## 6. Resultado da validação automática

`0 erro(s), 7 aviso(s)` — os sete avisos são exatamente os achados reais listados acima
(2 das normas, 5 do glossário). O relatório completo está em `relatorios/validacao.txt`.
