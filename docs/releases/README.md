# Notas de versão

Toda versão do ATUS precisa de um arquivo `vM.m.p.md` nesta pasta, escrito no mesmo PR que sobe a versão. O texto é para quem usa o app: diga o que mudou para a pessoa, não como foi implementado. O CI recusa o PR se o arquivo da versão nova faltar ou estiver fora do formato (`.github/scripts/shared/release/check-release-notes.mjs`).

As notas viram o corpo da release no GitHub e, com o auto-update, a página **Novidades** do app (`docs/decisions/0013-auto-update.md`).

## Formato

```md
---
title: Resíduos à vista
date: 2026-12-02
summary: O ajuste agora mostra onde ele erra.
cover: assets/v0.3.0/cover.png
---

## Novidades

### Painel de resíduos

Fica sob o gráfico e acompanha o zoom.

![Painel com a faixa ±σ](assets/v0.3.0/residuos.png)

[Resíduos em 40 segundos](https://youtu.be/ID_DO_VIDEO)

## Melhorias

- O tooltip responde às setas do teclado.

## Correções

- O instalador .msi instala na pasta certa.
```

- **Cabeçalho:** `title`, `date` (AAAA-MM-DD) e `summary` (uma frase) são obrigatórios. `cover` é opcional (1280 × 720, 16:9) e aparece no banner e no topo da página.
- **Seções:** `## Novidades`, `## Melhorias` e `## Correções`, nessa ordem. Inclua só as que tiverem conteúdo; pelo menos uma é obrigatória.
- **Novidades:** cada uma começa com `### título` e precisa de um texto. Pode ter imagens e um vídeo.
- **Melhorias e Correções:** só listas `- item`. Um item pode continuar na linha seguinte, com recuo de dois espaços.

## Imagens e vídeos

- **Imagem:** `![legenda](assets/vM.m.p/arquivo.png)` sozinha na linha. A legenda é obrigatória. Uma imagem vira figura ao lado do texto; várias seguidas viram galeria (no máximo 8 por novidade).
- **Formatos e limites:** PNG, JPEG, WebP e SVG até 2 MB; GIF até 5 MB. O CI confere se o arquivo existe, o tamanho e se o conteúdo é mesmo do formato da extensão.
- **SVG:** precisa de `viewBox` e deve ser autossuficiente: sem scripts, eventos (`onload`…), `foreignObject`, DTD, `@import` ou referências externas (só `#id` interno e imagens `data:` embutidas). Desenhe textos como caminhos, sem `<text>`, porque as fontes variam entre computadores. Capas em 1280 × 720.
- **Onde guardar:** em `assets/vM.m.p/`. Caminhos são relativos a esta pasta.
- **Vídeo:** um link do YouTube sozinho na linha, `[título](https://youtu.be/ID)` ou `https://www.youtube.com/watch?v=ID`, com `?t=`/`&t=` opcional. No máximo um por novidade. O app mostra uma miniatura e abre o vídeo no navegador.
- **Pôster do vídeo:** `[![título](assets/vM.m.p/poster.png)](https://youtu.be/ID)`. Sem pôster, o app usa um padrão.

## Restrições

- Sem HTML (nem comentários `<!-- -->`) e sem títulos `#`.
- Links só com `https://`.
- Versões de pré-release (`-rc`) não são publicadas.
