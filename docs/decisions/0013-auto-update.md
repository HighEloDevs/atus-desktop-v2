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

**Aceito, a implementar em etapas:**

2. **Updater no Rust** (`tauri-plugin-updater` ≥ 2.10 e `tauri-plugin-process`), desligado até existir a interface. Todos os formatos se atualizam: `.app`, NSIS, MSI, AppImage, `.deb` e `.rpm`. MSI, `.deb` e `.rpm` pedem permissão de administrador; se negada, o app mostra "Baixar manualmente".
3. **Interface.** Download em segundo plano; instalação só com clique, depois de salvar o projeto aberto. Botão **Atualizar** sempre no header enquanto houver versão nova; banner no máximo uma vez por dia; página **Novidades** com o histórico de versões, uma miniatura de vídeo por novidade (abre o YouTube no navegador), imagens em galeria com ampliação no app e GIF/WebP animados. O Markdown das notas é tratado como dado não confiável.
4. **Testes.** Atualização real automatizada no Windows NSIS; demais formatos em checklist manual até a primeira versão com updater.

## Alternativas descartadas

- **Player do YouTube embutido.** O app carrega de `tauri://localhost`/`http://tauri.localhost`, que o YouTube pode recusar em embeds; exigiria uma página intermediária ou liberar o YouTube na CSP. O link abre no navegador.
- **Notas opcionais com lista automática como fallback.** Deixaria versões sem texto para quem usa o app.
- **Só instalador por usuário no Windows.** Simplificaria o updater, mas laboratórios gerenciados precisam do `.msi` (`0012-installers.md`).
- **Diálogo modal de novidades.** Trocado por uma página com histórico, revisada no artefato.

## Consequências

- Quem está na 0.2.3 ou antes instala à mão, uma vez, a primeira versão com updater.
- Trocar a chave do updater exige que a versão com a chave nova seja assinada com a antiga; perder a chave privada impede atualizar as instalações existentes.
- Pendências: confirmar no plugin os nomes das chaves por formato no `latest.json` e se o bundler gera `.sig` para `.deb` e `.rpm`; validar Gatekeeper após atualização sem assinatura Apple.
