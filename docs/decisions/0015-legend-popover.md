# 0015 — Configuração da legenda no próprio gráfico

## Contexto

A legenda só podia ser arrastada ou, na aba **Personalização**, ligada e desligada e posta na horizontal ou na vertical. O protótipo aprovado (artefato "Legenda interativa") aplica à legenda o mesmo padrão dos eixos (decisão 0014): ao passar o mouse ela se destaca, e um clique abre uma janela com seus ajustes.

## Decisão

- **Interação.** A legenda é um botão. Ao passar o mouse aparece um contorno tracejado e a dica "Legenda · clique para ajustar, arraste para mover". Arrastar mais de 4 px move a legenda, como antes, e o clique que encerra o arrasto não abre a janela. Um clique simples, Enter ou Espaço abrem a janela; Esc fecha.
- **Janela.** Usa as mesmas peças das janelas dos eixos (`PopoverFields.tsx`, `OptionRow`) e tem três abas:
  - **Conteúdo:** linha de ajuste (amostra do traço de cada conjunto), equação do ajuste e título.
  - **Posição:** canto, numa grade 3 × 3, e orientação; na horizontal, também o número de colunas (o padrão é "auto", que quebra a linha livremente).
  - **Aparência:** fundo (nenhum, translúcido, sólido), borda, fonte e tamanho dos marcadores.
- **Rodapé.** **Ocultar legenda** e **Restaurar padrão**. Com a legenda oculta, um botão "Mostrar legenda" no canto do gráfico a traz de volta; ele fica fora da imagem exportada. Restaurar volta posição, orientação e aparência, mas mantém o título, que é conteúdo do usuário.
- **Equação.** É a do ajuste de cada conjunto, com os parâmetros livres substituídos pelos valores arredondados pela incerteza, como no cartão de resultado (`features/analysis/fit/fitted-equation.ts`). Parâmetros fixos continuam como símbolo. Sem ajuste bem-sucedido, a linha mostra só o nome.
- **Modelo.** `legend`, `legendOrientation` e `legendPosition` continuam como estavam e são o mesmo estado da aba Personalização (Mostrar legenda e Orientação). Os campos novos ficam em `legendStyle` (`components/chart/legendSettings.ts`). Projetos antigos recebem os padrões, que reproduzem a legenda anterior. A única diferença visível é que o marcador passa a ter o símbolo do conjunto (círculo, quadrado ou losango), no lugar do caractere "●".
- **Fora do gráfico** fica para depois. Essa opção tira espaço do gráfico, precisa entrar na imagem exportada e muda a margem compartilhada com o painel de resíduos.

## Consequências

- A grade de cantos marca um canto só quando a posição coincide com ele. Depois de um arrasto, nenhum fica marcado.
- Os cantos usam a área inteira do gráfico, como o arrasto já fazia, então o canto superior direito fica sob a barra de navegação do gráfico, que aparece ao passar o mouse.
- Falta verificação manual no app desktop.
