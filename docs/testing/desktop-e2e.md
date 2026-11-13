# Teste de fumaça desktop experimental

Este teste opt-in abre a janela Tauri real, cria um projeto pela interface e usa a ponte Tauri para salvar e reabrir uma alteração. Não testa os comandos de salvar e abrir pela interface nem instalação ou diálogos nativos. Foi experimentado localmente apenas em macOS Apple Silicon; Windows, Linux e runners CI ainda precisam de validação.

O driver está embutido apenas com a feature Cargo `desktop-e2e`, não habilitada por padrão. Essa feature recusa builds sem `debug_assertions`, de modo que o executável de distribuição não deve contê-la. O driver escuta somente em `127.0.0.1` e permite controlar a aplicação: use-o apenas durante os testes, sem dados reais ou outras pessoas compartilhando a sessão local, e encerre o executável depois.

Crie um diretório vazio dentro do diretório temporário do sistema e configure seu caminho absoluto na variável `ATUS_DESKTOP_E2E_PROJECT_DIR` nos terminais 2 e 3. O teste exige o mesmo caminho em ambos e recusa diretórios fora do diretório temporário. O app com essa feature não usa Documentos para criar ou listar projetos. O teste evita registrar o projeto na lista persistida de recentes.

Em três terminais, a partir da raiz do repositório:

1. `cd src/frontend && npm ci && npm run dev`
2. `cargo build --manifest-path src/desktop/Cargo.toml --features desktop-e2e` e então `ATUS_DESKTOP_E2E_PROJECT_DIR="<diretório>" TAURI_WEBDRIVER_PORT=4455 src/desktop/target/debug/atus-desktop` (no Windows, use a sintaxe do shell para as variáveis e o executável `.exe`).
3. `cd src/frontend && ATUS_DESKTOP_E2E_PROJECT_DIR="<diretório>" ATUS_DESKTOP_E2E_URL=http://127.0.0.1:4455 node --test tests/desktop/smoke.e2e.mjs` (no Windows, configure as variáveis com a sintaxe do shell).

As portas 1420 e 4455 devem estar livres. Encerre os dois processos e remova o diretório temporário ao terminar. Um servidor em execução na porta escolhida pode ser controlado pelo teste; confirme que ele é o aplicativo de teste. A opção usa apenas o cliente HTTP nativo do Node, sem os pacotes npm WebDriver. A dependência Rust adicional e sua árvore ainda precisam de auditoria de segurança antes de se tornar gate no CI.

No Linux, o experimento `xvfb-run -a .github/scripts/desktop-e2e/run-linux.sh` inicia e encerra os processos, usa um diretório temporário e isola o diretório pessoal do aplicativo. Antes, instale as dependências do Tauri, Xvfb e `xauth`, execute `npm ci` em `src/frontend` e compile a feature de teste conforme acima. Este runner ainda não foi validado em Linux ou CI e não é gate de PR.

## Análise rápida

`src/frontend/tests/desktop/smoke.quick-analysis.e2e.mjs` percorre a análise rápida no aplicativo real, numa única instância, e termina encerrando o aplicativo. Os runners dos quatro sistemas (macOS Apple Silicon e Intel, Windows e Linux) o executam depois de `smoke.e2e.mjs`, que precisa começar com o diretório de projetos vazio, e conferem que o processo saiu com código 0. Os dois arquivos usam os auxiliares de `tests/desktop/driver.mjs`.

Um WebDriver não aperta atalhos globais, não clica na bandeja nem escreve no clipboard do sistema. A feature `desktop-e2e` traz por isso comandos `quick_test_*` (`src/desktop/src/quick_e2e.rs`), que chamam as mesmas funções que essas entradas chamam e informam o estado nativo: janelas, registro do atalho e bandeja. Eles não existem fora dessa feature.

O teste cobre: janela rápida pré-criada e oculta, atalho registrado e bandeja criada; abertura pelo atalho com o clipboard já lido; `Esc` ocultando sem perder os dados; abrir só com dados (sem função) e sem ajuste; dados e função inválidos sem envio; confirmação ao substituir uma análise aberta (recusar e aceitar) com ajuste automático e projeto salvo; fechar a janela principal mantendo o ATUS vivo e o atalho recriando a janela; **Abrir ATUS** da bandeja; uma segunda execução trazendo a janela principal de volta; salvar uma imagem de gráfico em caminho com espaços e acentos; renomear, arquivar e restaurar um projeto; e sair salvando a última edição e encerrando o processo.

Um teste extra aperta o atalho de verdade, quando o runner fornece `ATUS_E2E_KEY_COMMAND`: entrada sintética no Windows (`.github/scripts/desktop-e2e/press-shortcut.ps1`) e `osascript` com o System Events no macOS em CI (localmente isso exige permissão de Acessibilidade, então é ignorado). No Linux ele não roda: com eventos XTEST do `xdotool` num Xvfb sem gerenciador de janelas, o atalho registrado pela biblioteca de atalhos globais não disparou, mesmo com a tecla Super ligada ao modificador Mod4. O tratamento do atalho no Linux é exercitado pelo comando `quick_test_press_shortcut`, mas o disparo pelo sistema ainda precisa de verificação manual num desktop X11.

Não coberto: foco do teclado na janela rápida depois de aparecer, aparecer sobre apps em tela cheia ou em outra área de trabalho, clique no ícone da bandeja, reabrir pelo Dock do macOS e Cmd+Q do sistema.
