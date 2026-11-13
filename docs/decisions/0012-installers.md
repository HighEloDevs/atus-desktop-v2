# 0012 — Instaladores `.dmg` e `.msi`

## Contexto

A release publicava, no macOS, só o `.app` compactado em `.zip` e, no Windows, só o instalador NSIS. Quem usa o Mac espera um `.dmg`, e laboratórios de universidades com computadores gerenciados (GPO, Intune, SCCM) esperam um `.msi`.

## Decisão

- **macOS: `.dmg` e `.zip`.** Os dois `build-macos-*` geram `--bundles app,dmg`. `macos/smoke-dmg.sh` monta a imagem somente leitura, exige um único `.app` e o link `Applications` e abre o app com o `smoke-app.sh`. O `.zip` continua na release por compatibilidade. Com `CI=true`, o bundler do Tauri não estiliza a janela do `.dmg` pelo Finder (que travaria em runner sem interface).
- **Windows: NSIS e MSI lado a lado.** O NSIS instala por usuário, sem administrador, e é o caminho natural para um futuro auto-updater; o MSI instala para a máquina toda e serve a implantações gerenciadas. `windows/smoke-msi.ps1` instala com `msiexec /qn`, abre o app e desinstala; roda depois do smoke do NSIS. As duas instalações podem coexistir no mesmo computador.
- **MSI em toda versão.** O WiX só aceita versões numéricas. Até a 0.2.3, RCs não levavam MSI; desde a 0.2.4 não há mais RCs (`0013-auto-update.md`) e `selectArtifacts` exige o `.msi` em toda release.
- **`upgradeCode` fixo** em `tauri.conf.json`. Sem ele o Tauri deriva o código do `identifier`, que ainda é provisório; trocá-lo depois impediria atualizar instalações existentes.

## Alternativas descartadas

- **Versão numérica derivada para RC no MSI** (por exemplo `0.2.0-rc.9` → `0.2.9`): permitiria publicar MSI em RC, mas criaria uma ordem de versões própria do Windows para validar. Superada: não há mais RCs.
- **`.dmg` substituindo o `.zip`:** menos arquivos, mas quebra quem já baixa o `.zip`.
- **Trocar o NSIS pelo MSI:** exigiria administrador na instalação e perderia a instalação por usuário.

## Consequências

- Pacotes continuam não assinados. Gatekeeper (macOS) e SmartScreen (Windows) avisam na primeira abertura; assinatura e notarização ficam para depois.
- O updater do Tauri também atualiza instalações `.msi`, mas pede permissão de administrador; em laboratórios sem administrador quem atualiza é o TI, com um novo `.msi` (`0013-auto-update.md`).
- O caminho do executável instalado pelo MSI (`%ProgramFiles%\ATUS Desktop`) e a chave `bundle.windows.wix.version` foram escritos a partir da documentação do Tauri e só ficam confirmados no primeiro run de `build-windows`.
- Ainda não foram testadas à mão a instalação do `.msi` numa VM e a atualização entre versões estáveis.
