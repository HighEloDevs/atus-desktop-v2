# 0009 — Resumo do ajuste: cartão mínimo e relatório no formato do V1

## Contexto

O painel "Resultados da análise" mostrava só nome, equação em texto cru e parâmetros fictícios. O atus-web tem um resumo mais completo (`MetricsModal.tsx`), mas o V1 (`atus/src/Model.py`, snapshot `ab76734`) é a referência refinada com os professores. Métricas que o V1 não exibia (RMS dos resíduos, R², p-valor, χ² reduzido, incerteza relativa) não foram validadas e não entram.

## Regra herdada do V1

O V1 calcula uma única quantidade (`chisqr`) e muda só o rótulo:

- **Com incerteza nos pontos:** "NGL" e "Chi²".
- **Sem incerteza nos pontos:** "NGL", "Somatória dos resíduos absolutos ao quadrado" e "Incerteza considerada" = √(somatória / NGL). A incerteza de cada parâmetro e a covariância são multiplicadas por esse valor (a covariância pelo quadrado); a correlação não muda.
- `NGL = nº de pontos − nº de parâmetros livres`. Só parâmetros livres aparecem na lista e nas matrizes.

## Decisão

- **Cartão:** nome, equação (KaTeX), até quatro parâmetros e uma única ação, **Ver detalhes** (o cartão inteiro é clicável). O que passa de quatro vira "+ N parâmetros". Uma falha vira cartão vermelho com o motivo e sem ação. Não há selos de sucesso ou alerta.
- **Relatório:** Ajuste (rótulos acima), Parâmetros (com as opções de cópia do V1: separador, decimal e cabeçalho), gráfico de resíduos e matrizes. A correlação é colorida (cobalto positiva, coral negativa) e é derivada da covariância na interface.
- **Arredondamento:** no cartão, o valor acompanha a casa decimal da incerteza (um algarismo, ou dois quando o primeiro é 1 ou 2), com vírgula decimal. O relatório mostra mais algarismos; a cópia usa os valores completos.
- **Contrato:** `FitResponse` ganhou `hasUncertainty`, `uncertaintyUsed`, `covariance` e `residuals`, e `parameters` lista só os livres. O contrato continua provisório.

## Alternativas descartadas

- Copiar o modal do atus-web: inclui a calculadora de intervalo de confiança e métricas sem validação.
- Selos de status e leitura em texto no cartão: deixavam o cartão carregado.

## Consequências

- O serviço mock gera resíduos, χ² e NGL reais contra a diagonal ilustrativa; incertezas e correlações dos parâmetros são fixas. O motor C++ precisará devolver covariância e resíduos.
- A calculadora de intervalo de confiança do atus-web não foi trazida; o V1 a mantinha em página própria.
