# 0013 — Auto-update pelas releases do GitHub e notas obrigatórias

## Contexto

Cada merge na `main` publica uma release com os pacotes, mas o app não sabe quando há versão nova, e o corpo da release era a lista automática de PRs, escrita para quem desenvolve. Queremos que o ATUS baixe atualizações em segundo plano, instale só quando a pessoa permitir e mostre o que mudou com texto, imagens e vídeos.

O conceito visual (botão no header, banner diário, página **Novidades**) foi revisado num artefato antes do código.

## Decisão

**Aceito e implementado (0.2.4):**

- **Sem versões RC.** Toda versão é `M.m.p` e vai para todos. `check-version.mjs` e `publish-release.mjs` recusam pré-releases; o caminho de RC do `build-windows` (MSI descartado) e do `build-linux` (`Release` do RPM) foi removido. Consequência: um merge com problema chega direto a quem usa o app, e os testes do CI são a única barreira.
- **Notas obrigatórias.** Todo PR que sobe a versão traz `docs/releases/vM.m.p.md` (formato em `docs/releases/README.md`). `check-release-notes.mjs` roda em `check-version` e `release-version` e recusa arquivo ausente ou fora do formato: cabeçalho com `title`, `date` e `summary`; seções Novidades, Melhorias e Correções; sem HTML; links só https; imagens locais com legenda, PNG/JPEG/WebP/SVG até 2 MB e GIF até 5 MB, conferidas pela assinatura do arquivo (SVG sem scripts, eventos, referências externas nem `<text>`); no máximo um vídeo do YouTube por novidade. O `publish-release` usa as notas como título e corpo da release, com imagens apontando para o commit publicado. As versões 0.2.0 e 0.2.3, anteriores à regra, ganharam notas retroativas no repositório; as releases já publicadas no GitHub não foram alteradas.

**Aceito e implementado (0.2.6): assinatura e manifestos.**

- Chave do updater (minisign, Ed25519, id `895E126F456242E6`) nos secrets `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, usados só no passo de build dos quatro `build-*`; a chave pública e o endpoint `releases/latest/download/latest.json` ficam em `plugins.updater` do `tauri.conf.json`, com `bundle.createUpdaterArtifacts: true`. Builds locais sem a chave usam `npm run tauri -- build --no-sign`.
- A release leva os pacotes assinados (`.deb`, `.rpm`, AppImage, NSIS, MSI e `atus-macos-{arm64,intel}.app.tar.gz`). Antes de publicar, `check-updater-signatures.mjs` confere cada `.sig` contra a chave pública do commit; uma chave privada que não corresponda à pública barra a release.
- `latest.json` tem uma entrada por formato instalado (`{os}-{arch}-{bundle}`: `darwin-*-app`, `windows-x86_64-{nsis,msi}`, `linux-x86_64-{appimage,deb,rpm}`) e as entradas `{os}-{arch}` como fallback (NSIS, AppImage, `.app`), com as assinaturas embutidas e `pub_date` igual à data do commit, para que a retomada de um rascunho produza o mesmo arquivo. Conferido no código do `tauri-plugin-updater` 2.14.1 e da CLI 2.12.4, que assina `.deb` e `.rpm`.
- **Primeira chave descartada.** A 0.2.5 entrou na `main` com a chave `B507D6B4FA9F269B`, mas o secret da senha não correspondia à chave e os quatro `build-*` falharam ao assinar ("Wrong password for that key"); nada foi publicado. A chave foi refeita e a 0.2.5 nunca existiu como release: suas notas passaram para a 0.2.6. Ao gerar ou trocar a chave, confira a senha com `tauri signer sign` antes de gravar o secret.
- `changelog.json` (schema 1) traz as notas de todas as versões, da mais nova para a mais antiga. **Mudança em relação à proposta:** as imagens apontam para `raw.githubusercontent.com` no commit publicado, em vez de serem enviadas como assets de cada release; o endereço é imutável, funciona para as notas retroativas e o GitHub entrega SVG como `image/svg+xml`. A CSP do app precisará liberar esse domínio para imagens.

**Aceito e implementado (0.2.7): updater no Rust, ainda desligado.**

- `src/desktop/src/update.rs` com `tauri-plugin-updater` 2.14. O plugin e os comandos `update_status`, `update_check`, `update_download`, `update_cancel_download` e `update_install` estão registrados, mas **nada procura atualizações sozinho**: só a interface (próximo PR) chama. O plugin fica sem permissão no capability da janela, então o conteúdo web só alcança os comandos do ATUS, não os do plugin (coberto no teste de integração). Não usa `tauri-plugin-process`: `AppHandle::restart` já basta.
- **Estados** (evento `update-state`, contrato com o frontend, `kind` em camelCase): `idle`, `unavailable`, `checking`, `upToDate`, `available`, `downloading` (andamento a cada 1%), `ready`, `installing`, `manual` e `error` (com a etapa). O download roda em segundo plano, é verificado pelo plugin (assinatura minisign) e cancelável; instalar só é aceito em `ready`.
- **`requireSignedVersion: true`**: a assinatura precisa nomear a versão anunciada (`version:` no comentário confiável, que a CLI 2.12 já escreve). Impede que um `latest.json` adulterado combine um número novo com um pacote antigo. O `publish-release` confere que cada `.sig` nomeia a versão da release.
- **Builds de desenvolvimento nunca se atualizam** (`unavailable`): vale para `debug_assertions` e para binários que não dizem como foram instalados (Linux/Windows). Só o build de teste de integração atualiza, contra um servidor local.
- **Salvar antes de instalar é do frontend.** No Windows o plugin termina o processo com `std::process::exit` logo depois de abrir o instalador, passando por cima do guarda de saída; no macOS e no Linux o ATUS reinicia com `AppHandle::restart`, cujo código de saída o guarda já deixa passar (teste em `background.rs`). Antes de sair no Windows, o ícone da bandeja é removido.
- **Falhas de permissão.** `.deb`/`.rpm`: o plugin tenta `pkexec`, depois uma janela de senha (`zenity`/`kdialog`) e por fim `sudo` no terminal; senha recusada vira `manual` (`permissionDenied`/`installFailed`). A instalação roda numa thread própria e o comando volta na hora, então nada trava a interface; `installing` traz `startedAt` para a interface perceber uma instalação que demora. Um AppImage cuja pasta o usuário não pode gravar vira `manual` (`notWritable`): o plugin move o arquivo em execução e grava o novo no lugar, então é a pasta que precisa ser gravável.
- **MSI por máquina: a recusa não é detectável na hora.** O plugin abre o `msiexec` e encerra o ATUS antes de o Windows pedir a permissão. O ATUS grava `update-attempt.json` na pasta de dados antes de instalar; na próxima abertura, se a versão em execução ainda for menor que a tentada, a verificação reporta `manual` (`previousAttemptFailed`) em vez de oferecer a mesma instalação automática de novo.
- **Verificação periódica silenciosa.** Com uma atualização já anunciada, baixada ou à espera de instalação manual, uma nova verificação não passa por `checking`, não descarta o pacote já baixado quando encontra a mesma versão e, se falhar, não troca o estado por um erro. Uma instalação que falha (`error`, etapa `install`) permite baixar de novo.
- O download não é guardado em disco: se o ATUS for fechado antes de instalar, baixa de novo na próxima vez.
- Teste de integração (`smoke.updater.e2e.mjs`): servidor local com chave minisign descartável, 11 casos, sem instalar de verdade; ver `docs/testing/desktop-e2e.md`. Os comandos `update_test_*` só existem com `desktop-e2e`.

**Aceito e implementado (0.2.8): interface do updater.** O PR 4 foi dividido em dois, e cada metade publica uma versão; esta é a primeira (a página Novidades é a 0.2.9).

- `features/updates/`: `UpdateProvider` (estado da interface), `UpdateButton`, `UpdateBanner` e `UpdateDialog`. A interface só usa `invoke` e `getCurrentWindow().listen`, e vive apenas na janela principal (a janela de análise rápida não a monta).
- **Parte do estado vem só do evento.** O provedor lê `update_status` uma vez ao montar (o núcleo guarda o `ready` ou o `downloading` enquanto a janela está fechada) e depois segue o evento `update-state`; o retorno dos comandos é ignorado, para um retorno atrasado não desfazer um evento mais novo.
- **Automático só em produção** (`import.meta.env.PROD`): primeira verificação 5 s depois de abrir, depois a cada 6 h, e download em segundo plano de uma versão anunciada, uma vez por versão. `tauri dev` e o smoke desktop (que usa o servidor do Vite) esperam alguém pedir. Falhas desses passos ficam em silêncio; só o que a pessoa pediu (instalar, tentar de novo, cancelar) vira aviso. O build de teste de integração também responde `unavailable` enquanto nenhum servidor de teste foi configurado, para nunca falar com o GitHub.
- **Botão no header**, nos estados `available` (**Baixar atualização**), `downloading` (anel com % e popover com cancelar), `ready` (**Atualizar**, ponto coral), `installing`, `error` (**Tentar de novo**) e `manual` (popover com o motivo e **Baixar X.Y.Z**). Na tela de análise ele fica na barra de ferramentas principal, que existe mesmo com o painel lateral fechado, em variante compacta (só o ícone, com o nome acessível).
- **Banner uma vez por dia por versão**, com o registro em `localStorage` (`atus.update-banner`), tolerando armazenamento ausente, bloqueado ou corrompido. Fechar esconde até o dia seguinte; uma versão mais nova reabre na hora.
- **Instalar** salva antes: a tela com o projeto aberto registra `saving.flush` (`useBeforeUpdateInstall`); se o salvamento falhar, nada é instalado e aparece um aviso. Sem projeto aberto, instala direto. O `ready` e o `manual` carregam o resumo da release (`notes`), para o banner mostrá-lo mesmo depois de reiniciar.
- **Local somente leitura** (`manual`, `readOnlyLocation`): no macOS, um app rodando de uma imagem de disco (`/Volumes/...`) ou de uma cópia que o Gatekeeper moveu para um local temporário (`AppTranslocation`) não consegue se substituir; a interface orienta a mover o ATUS para Aplicativos.
- O link permitido é só a página de releases (`opener:allow-open-url`). O teste de integração (`smoke.updater.e2e.mjs`) agora também dirige a interface real: banner, botão, confirmação e a instalação registrada.
- **Configuração para desligar o download automático: adiada.** O app ainda não tem tela de Configurações; entra junto com ela.
- Os números `0.1.0` fixos na barra lateral e na tela Sobre foram trocados pela versão real (`APP_VERSION`, injetada do `package.json` no build).

**Aceito e implementado (0.2.9): página Novidades.**

- `features/news/`: a página com a lista de versões à esquerda (nova, instalada) e as notas da selecionada à direita, o rodapé de instalação (o mesmo estado do botão do header), a galeria com ampliação por teclado (setas e Esc), a miniatura de vídeo (abre o YouTube no navegador; o app nunca carrega o player), imagens que falham com um aviso discreto e o texto das notas (`**negrito**`, `*itálico*`, `` `código` ``, links) montado só com nós de texto.
- **De onde vêm as notas.** As da versão instalada e as anteriores vão **embutidas no build** por um plugin do Vite (`vite-plugin-changelog.ts`, módulo `virtual:changelog`) que roda o mesmo validador e o mesmo gerador da release (`check-release-notes.mjs`, `createChangelog`): o que a release recusaria também quebra o build. As das versões novas chegam no **`latest.json`** (campo `changelog`, o mesmo objeto do `changelog.json`), que o plugin do updater guarda em `Update.raw_json`; o comando `update_changelog` a entrega ao frontend. O app não busca `changelog.json` direto: a CSP só permite IPC e os downloads de release do GitHub não enviam CORS.
- **O que chega de fora é dado não confiável** (o `latest.json` não é assinado): `parseChangelog` descarta o que não tem o formato esperado, limita tamanhos e quantidades, e só aceita imagens e capas em `raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/...` **já no formato normalizado** (um `..` ou `%2e%2e` que resolvesse para outro repositório passaria numa checagem de texto e carregaria de outro lugar), com extensão de imagem e sem consulta; vídeos só do YouTube; links só nos lugares abaixo, e o app abre sempre o endereço normalizado. Nada usa `dangerouslySetInnerHTML`.
- **Links permitidos** (notas e `opener`): `github.com/HighEloDevs/...`, `youtu.be`, `www.youtube.com`, `atusweb.com.br` e `www.atusweb.com.br`. A lista está em três lugares que têm de andar juntos: `isAllowedLink` no validador das notas (que agora recusa o resto no PR), `isAllowedLink` no frontend (mesma tabela de casos nos dois testes) e `opener:allow-open-url` em `capabilities/default.json`.
- **CSP:** `img-src 'self' https://raw.githubusercontent.com`, nada mais aberto. A CSP só vale no app empacotado (o servidor de desenvolvimento não a aplica), então foi verificada num build `tauri build --debug --no-sign --features desktop-e2e`: a capa vinda do GitHub carrega e imagens de outros hosts (inclusive `avatars.githubusercontent.com`) são bloqueadas.
- **Abertura automática.** Na primeira execução depois de atualizar (a versão em execução é maior que a última registrada em `localStorage`) a página abre sozinha, uma vez. Na primeira execução de todas nada abre. Um ponto ao lado de **Novidades** avisa que há uma atualização cuja página ainda não foi aberta, e o banner da tela inicial ganhou **Ver novidades**.
- A tela de análise não tem a barra lateral, então o banner dela não tem **Ver novidades**; o botão compacto abre a confirmação.
- `isAllowedImage` foi corrigida por um teste: a primeira versão testava o texto e deixava passar `…/atus-desktop-v2/../../Outro/repo/a.png`.

**Aceito, a implementar:**

- **Atualização real automatizada no Windows NSIS e o roteiro manual dos demais formatos** (`docs/testing/auto-update.md`), a partir da primeira atualização real (0.2.8 → 0.2.9).

## Alternativas descartadas

- **Player do YouTube embutido.** O app carrega de `tauri://localhost`/`http://tauri.localhost`, que o YouTube pode recusar em embeds; exigiria uma página intermediária ou liberar o YouTube na CSP. O link abre no navegador.
- **Notas opcionais com lista automática como fallback.** Deixaria versões sem texto para quem usa o app.
- **Só instalador por usuário no Windows.** Simplificaria o updater, mas laboratórios gerenciados precisam do `.msi` (`0012-installers.md`).
- **Diálogo modal de novidades.** Trocado por uma página com histórico, revisada no artefato.

## Consequências

- Quem está na 0.2.3 ou antes instala à mão, uma vez, a primeira versão com updater.
- Trocar a chave do updater exige que a versão com a chave nova seja assinada com a antiga; perder a chave privada impede atualizar as instalações existentes.
- Pendências: no `.deb`/`.rpm`, o ATUS reinicia depois que o pacote troca o executável em uso; se `current_exe` passar a apontar para um arquivo removido, o reinício pode falhar. Isso só se verifica numa instalação real (checklist do PR 5). Confirmar no plugin os nomes das chaves por formato no `latest.json` e se o bundler gera `.sig` para `.deb` e `.rpm`; validar Gatekeeper após atualização sem assinatura Apple.
