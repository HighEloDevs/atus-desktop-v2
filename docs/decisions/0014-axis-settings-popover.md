# 0014 — Configuração dos eixos no próprio gráfico

## Contexto

Os limites, a escala, as divisões e a grade dos eixos ficavam só na aba **Personalização**, longe do que mudavam. O protótipo aprovado (artefato "Eixos interativos") leva essa configuração para o gráfico: passar o mouse sobre os números de um eixo destaca a faixa, e um clique abre uma janela com os ajustes daquele eixo. Junto vieram ajustes que não existiam: sentido invertido, eixo na borda, passo fixo, subdivisões, traços, grade secundária, formato e tamanho dos números, tamanho do título e rotação dos números do X.

## Decisão

- **Onde clicar.** A área de cada eixo é a faixa dos números, nas bordas: à esquerda para Y e embaixo para X. Isso vale mesmo quando a linha do eixo cruza o meio do gráfico. Com o painel de resíduos ligado, os números do X ficam no painel, e a faixa vai junto. O eixo Y dos resíduos tem a mesma faixa e a mesma janela ("Eixo dos resíduos"), sem escala logarítmica nem eixo na borda: ele é linear, simétrico em torno de zero e sempre fica na borda. Os limites dessa janela são os mesmos das opções do painel de resíduos. O título do eixo fica fora da faixa e continua editável com clique (`EditableChartLabel`). A faixa é um botão HTML sobre o SVG: clique, Enter ou Espaço abrem, Esc fecha e o foco volta à faixa. Arrastar sobre ela não move a vista, e a faixa não aparece na imagem exportada.
- **Janela.** Segue o visual do painel de resíduos: cabeçalho "Eixo X/Y", seções com título em maiúsculas, linhas de opção com ícone e interruptor, e rodapé com **Copiar estilo para Y/X** e **Restaurar padrão**. Os ajustes ficam em três abas:
  - **Intervalo:** limites (mínimo – máximo), escala logarítmica, inverter sentido e eixo na borda;
  - **Marcações:** espaçamento automático (divisões) ou passo fixo, subdivisões, traços (fora, dentro, cruzados), grade principal e secundária;
  - **Texto:** título, sua fonte e, nos eixos Y, sua rotação (0° ou 90°, lendo de baixo para cima); formato dos números (automático, decimal, científico), casas decimais, fonte e rotação dos números (0°, 45° ou 90°, em todos os eixos).

  Não há textos de ajuda. Só erros de validação aparecem: mínimo ≥ máximo, limite ≤ 0 em escala log e passo inválido ou pequeno demais.
- **Modelo.** Cada eixo tem um objeto `AxisSettings` (`xAxis`, `yAxis` e `residualAxis` em `ChartValues`), com a lógica pura em `components/chart/axisSettings.ts`. Os campos antigos (`xMin`, `xMax`, `yMin`, `yMax`, `xLog`, `yLog`, `ticks`, `grid`, `residualYMin`, `residualYMax`) continuam expostos pelo hook como leitura e escrita derivadas desses objetos.
- **Paridade com a barra lateral.** A aba Personalização não ganha campos. Os que existem nos dois lugares editam o mesmo estado:
  - limites e escala log de cada eixo;
  - **Divisões** e **Linhas de grade**, que na barra lateral valem para os dois eixos: escrever nelas muda X e Y. Quando os eixos diferem, Divisões fica vazio com o texto de exemplo "X 5 · Y 8", e a grade aparece ligada se algum eixo tiver grade;
  - o título do eixo e sua fonte também são o mesmo estado no gráfico e na janela.
- **Migração.** Ao abrir um projeto, `xAxis`/`yAxis` têm prioridade. Sem eles, o eixo é montado a partir dos campos antigos, e o que faltar recebe o padrão. O hook continua salvando os campos derivados, então uma versão anterior do app ainda lê limites, escala, divisões e grade.
- **Padrões.** Os padrões reproduzem o gráfico anterior: números com 10 px, título com 11 px e na horizontal, formato automático (`formatTick`; nos resíduos, com sinal), 5 divisões (3 nos resíduos, que têm pouca altura), grade ligada e sem subdivisões. A margem esquerda, compartilhada pelo gráfico e pelo painel de resíduos, cabe os números dos dois. A única mudança visível é que os traços dos eixos agora aparecem, para fora, porque o protótipo não tem a opção "sem traços".
- **Restaurar padrão** volta todos os ajustes do eixo, mas mantém o texto do título, que é conteúdo do usuário. **Copiar estilo** copia marcações e texto (subdivisões, traços, grades, formato, casas, fontes), mas não os limites, a escala, o espaçamento nem as rotações. Os resíduos copiam para o Y.

## Alternativas descartadas

- **Abas ou seções empilhadas sem abas.** As seções cobriam boa parte do gráfico e a janela rolava.
- **Remover os campos da aba Personalização.** Eles ficam para quem já se acostumou. Por isso a aba não recebe campos novos.
- **Área clicável em toda a margem.** Conflitava com a edição do título por clique.

## Consequências

- `ChartValues` ganhou dois objetos com 16 campos cada. Projetos antigos migram na leitura, sem perda.
- A margem esquerda e a inferior crescem com a fonte, a largura e a rotação dos números.
- Falta verificação manual no app desktop, principalmente da janela sobre o gráfico com zoom e do painel de resíduos com números girados.
