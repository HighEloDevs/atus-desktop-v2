# 0012 — Instaladores `.dmg` e `.msi`

## Contexto

A release publicava, no macOS, só o `.app` compactado em `.zip` e, no Windows, só o instalador NSIS. Quem usa o Mac espera um `.dmg`, e laboratórios de universidades com computadores gerenciados (GPO, Intune, SCCM) esperam um `.msi`.

## Decisão

- **macOS: `.dmg` e `.zip`.** Os dois `build-macos-*` geram `--bundles app,dmg`. `macos/smoke-dmg.sh` monta a imagem somente leitura, exige um único `.app` e o link `Applications` e abre o app com o `smoke-app.sh`. O `.zip` continua na release por compatibilidade. Com `CI=true`, o bundler do Tauri não estiliza a janela do `.dmg` pelo Finder (que travaria em runner sem interface).
- **Windows: NSIS e MSI lado a lado.** O NSIS instala por usuário, sem administrador, e é o caminho natural para um futuro auto-updater; o MSI instala para a máquina toda e serve a implantações gerenciadas. `windows/smoke-msi.ps1` instala com `msiexec /qn`, abre o app e desinstala; roda depois do smoke do NSIS. As duas instalações podem coexistir no mesmo computador.
- **MSI só em versões estáveis.** O WiX só aceita versões numéricas, então `0.2.1-rc.1` não tem representação. Em RC, o `build-windows` gera um MSI com `bundle.windows.wix.version` = `M.m.p` apenas para exercitar o instalador e o descarta antes do upload; `selectArtifacts(root, version)` exige o `.msi` em versões estáveis e o recusa em pré-releases.
- **`upgradeCode` fixo** em `tauri.conf.json`. Sem ele o Tauri deriva o código do `identifier`, que ainda é provisório; trocá-lo depois impediria atualizar instalações existentes.

## Alternativas descartadas

- **Versão numérica derivada para RC no MSI** (por exemplo `0.2.0-rc.9` → `0.2.9`): permite publicar MSI em RC, mas cria uma ordem de versões própria do Windows para validar.
- **`.dmg` substituindo o `.zip`:** menos arquivos, mas quebra quem já baixa o `.zip`.
- **Trocar o NSIS pelo MSI:** exigiria administrador na instalação e perderia a instalação por usuário.

## Consequências

- Pacotes continuam não assinados. Gatekeeper (macOS) e SmartScreen (Windows) avisam na primeira abertura; assinatura e notarização ficam para depois.
- Em laboratórios sem administrador, o auto-updater não atualiza uma instalação por máquina: quem atualiza é o TI, com um novo `.msi`.
- O caminho do executável instalado pelo MSI (`%ProgramFiles%\ATUS Desktop`) e a chave `bundle.windows.wix.version` foram escritos a partir da documentação do Tauri e só ficam confirmados no primeiro run de `build-windows`.
- Ainda não foram testadas à mão a instalação do `.msi` numa VM e a atualização entre versões estáveis.
