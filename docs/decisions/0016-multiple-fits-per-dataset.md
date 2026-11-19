# 0016 — Vários ajustes no mesmo conjunto de dados

**Status:** aceita e implementada no frontend, ainda sem verificação manual no app desktop. O protótipo navegável (HTML, com dados e ajustes ilustrativos) serviu para discutir a interface antes da implementação.

## Contexto

Na análise de dados de física experimental, é comum comparar modelos com os mesmos pontos (reta × exponencial no resfriamento) ou ajustar o mesmo modelo em trechos diferentes (região linear × saturação). Hoje o desktop tem um ajuste por conjunto: para comparar dois modelos, é preciso importar os dados duas vezes.

O atus-web resolve isso com **Novo ajuste com estes dados** (`app/lib/dataset-analysis.ts`). O ajuste extra é um `DataSet` comum com `sharedDataId` apontando para o conjunto dono, `data: []` e os pontos emprestados por `resolveDatasetView`. Na sidebar ele aparece como card filho, recuado sob o dono. Problemas observados:

- **Pontos desenhados em dobro:** `renderPoints` desenha os pontos de cada `DataSet` visível, inclusive dos filhos, então os mesmos pontos aparecem sobrepostos em cores diferentes, e o tooltip os repete.
- **Ajuste novo em branco:** modelo `none`, sem equação, intervalo nem opções de incerteza, embora o caso comum seja variar o ajuste atual.
- **Cor aleatória:** fora da paleta, quando no desktop a cor de série é semântica.
- **Nome instável:** o card mostra "ajuste N" pela posição entre os irmãos, enquanto o nome salvo é outro. Remover um irmão renumera os demais.
- **Remoção em cascata sem aviso:** remover o dono apaga os filhos sem dizer quais.

## Alternativas

1. **Copiar o modelo do atus-web** (conjunto filho com `sharedDataId`). Exige filtrar os filhos em todo lugar que trata o conjunto como dados: gráfico, tooltip, `Cmd/Ctrl+1–9`, tabela, histograma, exportação e legenda. O erro dos pontos duplicados mostra que esse filtro é fácil de esquecer.
2. **Um conjunto com uma lista de ajustes** (`Dataset.fits: Fit[]`). Os dados existem uma vez, e cada ajuste guarda só o que é dele: equação, parâmetros iniciais, intervalo em X, opções de incerteza, estilo da curva e resultado.
3. **Ajuste como entidade da análise**, com referência ao conjunto. É mais flexível (um modelo para vários conjuntos, ajuste global), mas esse caso não está pedido e complica a sidebar.

## Decisão

Adotar a alternativa 2. O código fica em `features/analysis/fit/dataset-fits.ts` (lógica pura: migração, letras, cor e traço, agrupamento), `FitList.tsx` (sidebar), `FitComparison.tsx` (aba **Comparar** do painel de resultados), `RemoveDatasetDialog.tsx` e `components/chart/rangeBand.ts` (faixa no gráfico).

### Modelo

- `Dataset` passa a ter `fits: Fit[]`, com pelo menos um item. Os campos de ajuste que hoje ficam no `Dataset` (`equation`, parâmetros, intervalo, `ignoreUncertainty*`, `lineStyle`, `lineWidth`, `result`, `fitState`, `fitError`) passam para o `Fit`. Os dados, o símbolo, o raio e a cor dos pontos ficam no `Dataset`.
- Cada `Fit` tem `id`, uma **letra estável** (A, B, C… nunca reutilizada no conjunto) e um rótulo opcional editável. O nome exibido é `"<conjunto> · A"`, ou o rótulo, quando houver.
- **Persistência:** `state_json` é `TEXT` sem validação de esquema no Rust (`src/desktop/src/project/store.rs`, `model.rs` com `serde_json::Value`). A migração acontece na leitura, como em `AxisSettings`: um estado antigo sem `fits` vira `fits[0]` com os campos atuais. Não há migração SQL. O teste de ida e volta precisa cobrir o projeto antigo.

### Interface

- **Um conjunto com um ajuste fica exatamente como hoje.** Mesma marcação, mesmos atributos `data-tour` e mesmos eventos de lição (`equation.changed`, `fit.succeeded`, `details.opened`). A lição de queda livre (`tests/integration/app-learn.test.mjs`) não pode mudar.
- O menu "…" do conjunto ganha **Novo ajuste com estes dados**, que **duplica o ajuste em foco**: mesma equação, mesmos parâmetros iniciais, mesmo intervalo e mesmas opções. Duplicar é o caso comum, e criar um ajuste em branco é uma opção secundária no mesmo submenu.
- Com dois ou mais ajustes, o card do conjunto mostra uma **lista de ajustes**: uma linha por ajuste, com amostra da curva, letra, equação (KaTeX) e olho. Uma linha fica em foco e expande os controles atuais (`FitControls`). Clicar em outra linha troca o foco.
- **Identidade visual:** os pontos têm a cor do conjunto. As curvas dos ajustes usam a mesma família de cor, com **traço diferente por letra** (A contínuo, B tracejado, C pontilhado…) e variação de luminosidade. Assim, o ajuste não depende só da cor (acessibilidade), e a amostra do traço na sidebar é o próprio identificador.
- **Intervalo no gráfico:** o gráfico mostra a faixa do ajuste em foco do conjunto selecionado, com alças arrastáveis (ou movidas pelas setas), quando o conjunto tem mais de um ajuste ou quando o ajuste já tem intervalo digitado. Um ajuste único sem intervalo não mostra faixa, como hoje. Os campos de intervalo continuam sendo a fonte da verdade: o arraste mostra uma prévia e, ao soltar, grava os campos e refaz só aquele ajuste, sem toast de sucesso (falhas ainda aparecem). Os pontos fora da faixa ficam esmaecidos, e pressionar uma alça não move o gráfico (filtro do zoom).
- **Comparação:** quando um conjunto tem dois ou mais ajustes com resultado, o painel de resultados ganha a visão **Comparar**, com uma coluna por ajuste: equação, NGL, χ² (ou somatória dos resíduos e incerteza considerada, pelas regras da 0009), os parâmetros **do próprio ajuste** e os resíduos em gráficos pequenos com **a mesma escala Y** para todas as colunas.
  - **Não** alinhar parâmetros pelo nome entre equações diferentes: o `a` de `a*x+b` e o `a` de `a*exp(-x/tau)` são grandezas diferentes. A exceção é quando as equações são idênticas (por exemplo, o mesmo modelo em intervalos diferentes): aí as linhas se alinham e a diferença entre os valores fica visível.
  - **Não** acrescentar χ² reduzido, R², p-valor nem selo de "melhor ajuste". A decisão 0009 os excluiu e continua valendo: a comparação mostra as grandezas do V1 lado a lado, e o julgamento fica com o estudante.
- Passar o mouse sobre uma coluna, um cartão ou uma linha de ajuste destaca a curva (`highlightedSeriesId` passa a aceitar id de ajuste).

### Comportamentos que mudam

| Ação                                    | Comportamento proposto                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Cmd/Ctrl+1–9`                          | Continua indexando conjuntos, nunca ajustes. Substitui os dados e preserva todos os ajustes.                                                                                   |
| **Substituir dados** / editar dados     | Preserva todos os ajustes e limpa todos os resultados do conjunto.                                                                                                             |
| **Executar ajustes** (`Cmd/Ctrl+Enter`) | Executa todos os ajustes com equação, de todos os conjuntos. Uma falha vira cartão vermelho só daquele ajuste.                                                                 |
| Análise rápida                          | Cria um conjunto com `fits[0]`. Nada muda para quem usa.                                                                                                                       |
| Legenda                                 | Uma entrada por ajuste visível (`legendEquation` por ajuste), com a amostra do traço.                                                                                          |
| Painel de resíduos                      | Mostra os resíduos de um ajuste por vez, por padrão o ajuste em foco, com seletor por letra. Resíduos de vários ajustes sobrepostos, todos dos mesmos pontos, ficam ilegíveis. |
| Remover conjunto com ajustes            | Pede confirmação listando os ajustes que serão removidos.                                                                                                                      |
| Remover ajuste                          | Só existe com dois ou mais ajustes. O último ajuste não se remove: para isso, remove-se o conjunto.                                                                            |
| Tooltip                                 | Cada ponto aparece uma vez, porque os pontos pertencem ao conjunto.                                                                                                            |

### Em aberto

- **Reajuste durante o arraste:** no protótipo, o ajuste é refeito enquanto a faixa é arrastada. No app, ele é refeito uma vez, ao soltar. Refazer durante o arraste depende do custo do motor C++.
- **Personalização por ajuste:** o traço e a cor dos ajustes B em diante são derivados da letra e da cor do conjunto. A aba Personalização ainda edita só o conjunto (pontos e o traço do ajuste A).
- Atalho para duplicar o ajuste em foco: não usar `Cmd/Ctrl+Shift+S` nem `Cmd/Ctrl+Shift+C`, que já estão ocupados. `Cmd/Ctrl+D` precisa ser verificado nos três sistemas.
- Exportação do relatório comparativo (cópia dos parâmetros de vários ajustes).
- Ajuste global (um modelo para vários conjuntos com parâmetros compartilhados) fica fora desta proposta.

## Consequências

- O contrato com o motor (`FitRequest`/`FitResponse`) não muda: cada ajuste continua sendo uma chamada com os pontos do conjunto.
- `AnalysisPage.tsx` precisa separar a lista de conjuntos da lista de ajustes. É uma boa hora para extrair o card do conjunto do arquivo, que hoje tem mais de mil linhas.
- Testes de regressão: migração na leitura (estado antigo → `fits[0]`), ida e volta com vários ajustes, duplicação preservando a configuração, `Cmd/Ctrl+1–9` preservando ajustes, confirmação de remoção e a lição de queda livre inalterada.
