# 0006 — Leitura do clipboard pela API padrão do navegador

## Contexto

O atus-web importa dados colados com `Cmd/Ctrl+B` (novo conjunto) e `Cmd/Ctrl+1–9` (substituir o conjunto N), lendo o texto com `navigator.clipboard.readText()`. O desktop v2 precisa da mesma capacidade no fluxo "importar ou colar dados". O pedido original citava `Cmd/Ctrl+Space`, mas essa combinação é reservada pelo sistema (Spotlight no macOS, troca de método de entrada no Windows e no Linux), então o desktop adota os atalhos do web.

## Alternativas

- **`tauri-plugin-clipboard-manager`.** Lê o clipboard pelo núcleo Rust, sem depender do webview, mas adiciona uma dependência, uma permissão em `capabilities/default.json` e código nativo por plataforma.
- **API padrão `navigator.clipboard.readText()`.** Mesma API do web, já usada para escrita em `ResultsPanel.tsx` e `ChartExportMenu.tsx`, sem mudança em Rust.

## Decisão

Usar `navigator.clipboard.readText()`, por ser a opção mais global e agnóstica a sistema operacional. Não foi feito um experimento prévio nos webviews. O texto passa pelo mesmo caminho da importação de arquivo (mesmo parser, mesmo limite de 1 MB e mesmo diálogo de separador em caso de falha).

## Consequências

- Em alguns webviews (por exemplo WKWebView) a leitura pode pedir permissão ou mostrar um aviso de "Colar". Isso ainda não foi observado em execução real e deve ser verificado manualmente em cada sistema.
- Se o comportamento atrapalhar o fluxo, reavaliar o plugin `clipboard-manager` em outra mudança, mantendo `readClipboardText` como ponto único de troca.
- Falhas de leitura aparecem como erro compreensível, sem encerrar a interface.
