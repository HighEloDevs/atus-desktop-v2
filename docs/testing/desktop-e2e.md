# Teste de fumaça desktop experimental

Este teste opt-in abre a janela Tauri real e verifica o cartão **Nova análise**. Não substitui testes do fluxo de projeto, instalação ou diálogos nativos. Foi experimentado localmente apenas em macOS Apple Silicon; Windows, Linux e runners CI ainda precisam de validação.

O driver está embutido apenas com a feature Cargo `desktop-e2e`, não habilitada por padrão. Essa feature recusa builds sem `debug_assertions`, de modo que o executável de distribuição não deve contê-la. O driver escuta somente em `127.0.0.1` e permite controlar a aplicação: use-o apenas durante os testes, sem dados reais ou outras pessoas compartilhando a sessão local, e encerre o executável depois.

Em três terminais, a partir da raiz do repositório:

1. `cd src/frontend && npm ci && npm run dev`
2. `cargo build --manifest-path src/desktop/Cargo.toml --features desktop-e2e` e então `TAURI_WEBDRIVER_PORT=4455 src/desktop/target/debug/atus-desktop` (no Windows, use a sintaxe do shell para a variável e o executável `.exe`).
3. `cd src/frontend && ATUS_DESKTOP_E2E_URL=http://127.0.0.1:4455 node --test tests/desktop/smoke.e2e.mjs` (no Windows, configure a variável com a sintaxe do shell).

As portas 1420 e 4455 devem estar livres. Encerre os dois processos ao terminar. Um servidor em execução na porta escolhida pode ser controlado pelo teste; confirme que ele é o aplicativo de teste. A opção usa apenas o cliente HTTP nativo do Node, sem os pacotes npm WebDriver. A dependência Rust adicional e sua árvore ainda precisam de auditoria de segurança antes de se tornar gate no CI.
