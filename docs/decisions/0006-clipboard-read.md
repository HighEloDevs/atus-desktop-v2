# 0006 — Leitura do clipboard pelo plugin nativo, com a API do navegador como alternativa

## Contexto

O atus-web importa dados colados com `Cmd/Ctrl+B` (novo conjunto) e `Cmd/Ctrl+1–9` (substituir o conjunto N), lendo o texto com `navigator.clipboard.readText()`. O desktop v2 precisa da mesma capacidade no fluxo "importar ou colar dados". O pedido original citava `Cmd/Ctrl+Space`, mas essa combinação é reservada pelo sistema (Spotlight no macOS, troca de método de entrada no Windows e no Linux), então o desktop adota os atalhos do web.

## Alternativas

- **`tauri-plugin-clipboard-manager`.** Lê o clipboard pelo núcleo Rust, sem depender do webview, mas adiciona uma dependência, uma permissão em `capabilities/default.json` e código nativo por plataforma.
- **API padrão `navigator.clipboard.readText()`.** Mesma API do web, já usada para escrita em `ChartExportMenu.tsx`, sem mudança em Rust.

## Decisão

Ler pelo `tauri-plugin-clipboard-manager` (permissão `clipboard-manager:allow-read-text`) quando o app roda no Tauri, e por `navigator.clipboard.readText()` no navegador (modo de desenvolvimento e testes). `readClipboardText` é o ponto único dessa escolha. O texto passa pelo mesmo caminho da importação de arquivo (mesmo parser, sem limite de tamanho e mesmo diálogo de separador em caso de falha).

A primeira versão usava só a API do navegador, por ser a mais agnóstica a sistema. Em execução real no macOS, o WKWebView mostrou um balão com o botão "Colar" a cada atalho, o que quebra o fluxo direto. O plugin lê pelo núcleo nativo e não exibe esse aviso.

## Consequências

- Uma dependência a mais (crate e pacote npm) e uma permissão em `capabilities/default.json`; somente a leitura de texto é liberada.
- Falhas de leitura aparecem como erro compreensível, sem encerrar a interface.
- Windows e Linux ainda não foram verificados manualmente.
