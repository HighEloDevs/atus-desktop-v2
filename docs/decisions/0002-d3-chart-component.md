# 0002 — Componente de gráficos com D3

## Contexto

A análise demonstrativa desenhava um SVG com coordenadas fixas, específico para os dados do exemplo. O aplicativo precisa de uma entrada reutilizável para visualizar dados científicos sem acoplar o gráfico à ponte nativa.

## Alternativas e critérios

As alternativas consideradas foram manter o SVG manual, adotar uma biblioteca de gráficos pronta ou usar D3 para escalas e geração de caminhos com renderização React. Os critérios foram flexibilidade para gráficos científicos, integração com React e adaptação a dados e dimensões variáveis.

## Decisão

Usar D3 para escalas, marcas dos eixos e geração da linha, mantendo os elementos SVG sob controle do React. O componente recebe pontos e uma linha opcional, mede o espaço disponível e não depende do motor científico. Esta interface inicial não define os futuros recursos de análise, incertezas ou personalização.

## Consequências

A aplicação ganha uma porta de entrada reutilizável e domínios calculados a partir dos dados. D3 adiciona dependências ao frontend; acessibilidade, comportamento visual e novos recursos de gráficos continuam sendo responsabilidade do projeto.

## Evolução

O componente também oferece histograma, barras de incerteza quando fornecidas, escalas configuráveis, zoom, personalização e exportação de imagem. A tela continua alimentada apenas pelo exemplo fixo; múltiplos conjuntos e resultados científicos dependem de contratos ainda não implementados.
