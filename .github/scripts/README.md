# Scripts da esteira

Scripts reais usados pelo workflow `Build desktop` (`.github/workflows/build.yml`). Os testes ficam em `.github/tests/`, espelhando esta árvore.

## Organização

- `linux/`, `macos/`, `windows/`: scripts de um único sistema operacional. O SO não entra no nome do arquivo.
- `shared/`: o que roda em qualquer SO (versão, cobertura, release).

## Nomes

`<verbo>-<objeto>.<ext>`, em inglês e kebab-case. Arquivos de dados levam nome de substantivo (`rust-source-inventory.json`).

| Verbo | Significado |
|---|---|
| `install` | instala dependências no runner |
| `configure` | ajusta o ambiente do runner |
| `run` | executa uma suíte (e2e) |
| `smoke` | instala ou monta um pacote e abre o app |
| `check` | valida algo e falha se estiver errado |
| `collect` | gera um relatório de cobertura |
| `report` | imprime informação sem falhar |
| `strip` | remove algo de um relatório |
| `publish` | publica a release |
| `press` | simula entrada do sistema |

## Testes

`.github/tests/scripts/<mesma pasta>/<mesmo nome>.test.<ext>` testa o script de mesmo nome. Nem todo script precisa de teste, mas todo teste precisa de um script. `.github/tests/layout.test.mjs` verifica o espelho, os nomes e que o workflow executa todos os testes.

## Scripts

| Script | Job |
|---|---|
| `shared/check-version.mjs` | `check-version`, `release-version` |
| `shared/coverage/check-coverage.mjs` | `test-linux`, `test-macos-arm64` |
| `shared/coverage/check-rust-inventory.mjs`, `strip-rust-tests.mjs`, `rust-source-inventory.json` | chamados por `macos/collect-rust-coverage.sh` |
| `shared/coverage/report-uncovered-lines.mjs` | `test-macos-arm64` |
| `shared/release/publish-release.mjs` | `publish-release` |
| `shared/release/check-release-artifacts.mjs` | chamado por `publish-release.mjs` |
| `shared/release/check-release-notes.mjs` | `check-version`, `release-version`; também usado por `publish-release.mjs` |
| `shared/release/check-updater-signatures.mjs` | chamado por `publish-release.mjs` |
| `linux/install-deps.sh`, `configure-dns-fallback.sh` | `integration-linux`, `test-linux`, `build-linux` |
| `linux/run-e2e.sh` | `integration-linux` |
| `linux/collect-cpp-coverage.sh` | `test-linux` |
| `linux/smoke-packages.sh` | `build-linux` |
| `macos/collect-rust-coverage.sh` | `test-macos-arm64`, `integration-macos-*` |
| `macos/smoke-app.sh`, `smoke-dmg.sh`, `check-document-icon.py` | `build-macos-*` |
| `windows/run-e2e.ps1`, `press-shortcut.ps1` | `integration-windows` |
| `windows/smoke-nsis.ps1`, `smoke-msi.ps1` | `build-windows` |
