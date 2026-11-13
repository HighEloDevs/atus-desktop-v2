# Publicação automática: desenho de ativação

A publicação automática está ativa para cada merge na `main` (pacotes não assinados), embora as validações abaixo ainda estejam pendentes. Toda versão é estável (`M.m.p`): versões RC não são mais publicadas (`docs/decisions/0013-auto-update.md`). O CI atual ainda não oferece cobertura Rust de produção com denominador comprovado, nem testes completos dos pacotes instalados e dos fluxos desktop em todas as plataformas. Publicar enquanto essas condições não existem daria à release garantias que não foram verificadas.

## Fluxo previsto

1. Em cada push resultante de merge na `main`, a execução de release registra o SHA exato e processa todos os commits de merge elegíveis, inclusive quando múltiplos merges chegam em sequência. Ela não deve usar uma configuração de concorrência que descarte execuções pendentes. Antes de ativar, testar a fila real ou usar um mecanismo persistente de reconciliação que processe todos os SHAs ainda não publicados.
2. Fazer checkout do SHA registrado, ler `src/desktop/tauri.conf.json`, comparar com a versão anterior, verificar sincronização dos arquivos e buscar tags remotas. Aceitar só `M.m.p`, exigir as notas `docs/releases/vM.m.p.md` válidas e rejeitar tag existente que aponte para outro commit. O gate de PR também exige base atualizada; impedir push direto à `main`.
3. Executar no SHA integrado todos os testes e gates aprovados, inclusive cobertura >90% por linguagem, E2E desktop e instalação/execução de todos os formatos suportados. Gerar os pacotes em jobs confiáveis para Linux, Windows e macOS Intel e Apple Silicon. Um teste do PR não comprova o conteúdo do merge.
4. O job agregador, dependente de todos os jobs obrigatórios, baixa artefatos somente da mesma execução confiável, confere origem, SHA, arquitetura e inventário explícito de todos os formatos. Só então calcula manifesto e `SHA256SUMS` e executa `verifyManifest`. Os hashes comprovam integridade dos arquivos, não sua proveniência.
5. Um único job de publicação, com `contents: write`, cria a tag no SHA verificado e uma release em rascunho. Faz upload de cada artefato e checksum, confere o inventário remoto e usa as notas da versão como título e corpo da release; publica somente após confirmar todos os arquivos. O restante do workflow usa apenas `contents: read`.
6. A retomada verifica tag, SHA e identidade. Uma release publicada ou tag com identidade diferente gera erro, sem sobrescrita. Um rascunho da mesma tag e mesmo SHA pode retomar uploads de forma idempotente; falhas deixam rascunho, nunca uma release incompleta pública.

## Verificações antes da ativação

- Demonstrar que os testes completos e cobertura passam na matriz aprovada; validar instalação e abertura de `.deb`, `.rpm` e AppImage em ambientes adequados, incluindo Fedora para RPM.
- Demonstrar instalação e atualização estável → estável em cada pacote.
- Configurar e testar proteção de `main`, aprovação e bypass restrito, checks obrigatórios e atualização da branch. Não tratar PRs de forks como fonte confiável para publicação nem fornecer-lhes credenciais.
- Exercitar em repositório de teste falha de build, upload parcial, reexecução, tag conflitante e dois merges próximos; confirmar que cada SHA elegível resulta em uma release completa e que nenhuma execução pendente é descartada.
- Definir e verificar o comportamento de falha e reprocessamento quando uma versão anterior falhar, para que uma release posterior não oculte o erro. Testar ausência e revogação de permissões de escrita.
- Identificar os artefatos como não assinados até que assinatura e notarização sejam implementadas e verificadas.

Os nomes finais de jobs e arquivos de release dependem dos resultados dos testes dos empacotadores. Este documento não ativa workflows, tags ou releases.

## Workflow de release

A publicação é o último job do `Build desktop` (`publish-release`), executado só em push na `main`, quando os quatro `build-*` passaram, e com `contents: write` apenas nele. Cada `build-*` depende do `test-*` e do `integration-*` da sua plataforma, que dependem de `release-version`/`check-version`, então o sucesso dos builds implica o dos testes. O `if:` do job exige o sucesso dos quatro builds no contexto `needs` da própria execução (o que também vale para re-execuções parciais), e o job baixa os artefatos da mesma execução. Cada merge na `main` publica uma release estável, com pacotes não assinados; `check-version` e `release-version` exigem notas válidas para a versão (`check-release-notes.mjs`).

Depois disso, o job confere o inventário, a versão, o SHA e os hashes, cria ou retoma um rascunho e só publica após validar os arquivos enviados. As validações de publicação concorrente e de recuperação em um repositório de teste continuam necessárias antes da ativação efetiva.

As publicações usam `concurrency.queue: max` e não cancelam as anteriores; o GitHub limita essa fila a 100 execuções pendentes, e novas execuções acima desse limite podem ser canceladas. A operação deve monitorar falhas e reexecutar manualmente execuções recusadas; esta fila não garante entrega ilimitada nem ordem de merge. A retomada nunca sobrescreve assets: arquivos existentes devem ter hash idêntico, caso contrário a execução falha.

## Versões RC (histórico)

Até a 0.2.3 o fluxo publicava versões `M.m.p-rc.n` como pré-release, sem validar a ordem nativa delas em `.app`, `.msi`, `.deb` e `.rpm`. Com a decisão de não publicar mais RCs (`docs/decisions/0013-auto-update.md`), esse problema deixou de existir: `check-version.mjs` e `publish-release.mjs` recusam versões com pré-release. As pré-releases antigas continuam no GitHub só como histórico.

## Inventário de pacotes

Cada release leva, com SHA256 e manifesto: `atus-linux.{deb,rpm,AppImage}`, `atus-windows.exe` (NSIS), `atus-macos-{arm64,intel}.{zip,dmg}` e `atus-windows.msi`. `selectArtifacts` (`publish-release.mjs`) exige exatamente um arquivo de cada. Os smokes de `.dmg` (`macos/smoke-dmg.sh`) e `.msi` (`windows/smoke-msi.ps1`) rodam em todo `build-*`; ainda faltam a atualização de MSI estável → estável e a instalação de `.msi` e `.dmg` verificada à mão. Consulte `docs/decisions/0012-installers.md`.
