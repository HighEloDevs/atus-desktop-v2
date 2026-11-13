# Publicação automática: desenho de ativação

A publicação automática está ativa para cada merge na `main` (pré-release para RC, pacotes não assinados), embora as validações abaixo ainda estejam pendentes. O CI atual ainda não oferece cobertura Rust de produção com denominador comprovado, nem testes completos dos pacotes instalados e dos fluxos desktop em todas as plataformas. As versões RC também precisam de um mapeamento validado para cada instalador. Publicar enquanto essas condições não existem daria à release garantias que não foram verificadas.

## Fluxo previsto

1. Em cada push resultante de merge na `main`, a execução de release registra o SHA exato e processa todos os commits de merge elegíveis, inclusive quando múltiplos merges chegam em sequência. Ela não deve usar uma configuração de concorrência que descarte execuções pendentes. Antes de ativar, testar a fila real ou usar um mecanismo persistente de reconciliação que processe todos os SHAs ainda não publicados.
2. Fazer checkout do SHA registrado, ler `src/desktop/tauri.conf.json`, comparar com a versão anterior, verificar sincronização dos arquivos e buscar tags remotas. Validar SemVer e rejeitar tag existente que aponte para outro commit. O gate de PR também exige base atualizada; impedir push direto à `main`.
3. Executar no SHA integrado todos os testes e gates aprovados, inclusive cobertura >90% por linguagem, E2E desktop e instalação/execução de todos os formatos suportados. Gerar os pacotes em jobs confiáveis para Linux, Windows e macOS Intel e Apple Silicon. Um teste do PR não comprova o conteúdo do merge.
4. O job agregador, dependente de todos os jobs obrigatórios, baixa artefatos somente da mesma execução confiável, confere origem, SHA, arquitetura e inventário explícito de todos os formatos. Só então calcula manifesto e `SHA256SUMS` e executa `verifyManifest`. Os hashes comprovam integridade dos arquivos, não sua proveniência.
5. Um único job de publicação, com `contents: write`, cria a tag no SHA verificado e uma release em rascunho. Faz upload de cada artefato e checksum, confere o inventário remoto e gera notas. Marca como pré-release quando a versão tiver componente de pré-release; publica somente após confirmar todos os arquivos. O restante do workflow usa apenas `contents: read`.
6. A retomada verifica tag, SHA e identidade. Uma release publicada ou tag com identidade diferente gera erro, sem sobrescrita. Um rascunho da mesma tag e mesmo SHA pode retomar uploads de forma idempotente; falhas deixam rascunho, nunca uma release incompleta pública.

## Verificações antes da ativação

- Demonstrar que os testes completos e cobertura passam na matriz aprovada; validar instalação e abertura de `.deb`, `.rpm` e AppImage em ambientes adequados, incluindo Fedora para RPM.
- Demonstrar ordenação e limites das versões `0.2.0-rc.1`, `0.2.0-rc.2` e `0.2.0` em cada pacote, inclusive instalação e atualização, sem colisão entre versão nativa e SemVer.
- Configurar e testar proteção de `main`, aprovação e bypass restrito, checks obrigatórios e atualização da branch. Não tratar PRs de forks como fonte confiável para publicação nem fornecer-lhes credenciais.
- Exercitar em repositório de teste falha de build, upload parcial, reexecução, tag conflitante e dois merges próximos; confirmar que cada SHA elegível resulta em uma release completa e que nenhuma execução pendente é descartada.
- Definir e verificar o comportamento de falha e reprocessamento quando uma versão anterior falhar, para que uma release posterior não oculte o erro. Testar ausência e revogação de permissões de escrita.
- Identificar os artefatos como não assinados até que assinatura e notarização sejam implementadas e verificadas.

Os nomes finais de jobs e arquivos de release dependem dos resultados dos testes dos empacotadores. Este documento não ativa workflows, tags ou releases.

## Workflow de release

A publicação é o último job do `Build desktop` (`publish-release`), executado só em push na `main`, quando os quatro `build-*` passaram, e com `contents: write` apenas nele. Cada `build-*` depende do `test-*` e do `integration-*` da sua plataforma, que dependem de `release-version`/`check-version`, então o sucesso dos builds implica o dos testes. O `if:` do job exige o sucesso dos quatro builds no contexto `needs` da própria execução (o que também vale para re-execuções parciais), e o job baixa os artefatos da mesma execução. Decisão: o gate `native-version-order` foi removido, então cada merge na `main` publica uma release, marcada como pré-release para versões RC, com pacotes não assinados e com a ordem de versão nativa de RC ainda não validada (ver abaixo).

Depois disso, o job confere o inventário, a versão, o SHA e os hashes, cria ou retoma um rascunho e só publica após validar os arquivos enviados. As validações de RC, de publicação concorrente e de recuperação em um repositório de teste continuam necessárias antes da ativação efetiva.

As publicações usam `concurrency.queue: max` e não cancelam as anteriores; o GitHub limita essa fila a 100 execuções pendentes, e novas execuções acima desse limite podem ser canceladas. A operação deve monitorar falhas e reexecutar manualmente execuções recusadas; esta fila não garante entrega ilimitada nem ordem de merge. A retomada nunca sobrescreve assets: arquivos existentes devem ter hash idêntico, caso contrário a execução falha.

## Experimento de versão RC (macOS ARM)

Em build local de teste do Tauri CLI 2.12.4, com `--debug --bundles app --config '{"version":"0.2.0-rc.1"}'`, o app foi gerado, mas seu `Info.plist` contém `0.2.0-rc.1` tanto em `CFBundleVersion` quanto em `CFBundleShortVersionString`. A documentação atual da Apple exige componentes numéricos nesses dois campos; portanto esse resultado não comprova um pacote distribuível válido. A configuração Tauri oferece `bundle.macOS.bundleVersion`, mas a versão curta também precisa ser tratada e a ordem de upgrades testada.

**Proposta, ainda não adotada:** restringir a entrada inicial a `M.m.p-rc.n` e `M.m.p`, preservando SemVer na release; para macOS usar versão curta `M.m.p` e versão de build numérica `(100*M+m+1).(p+1).n` para RC ou `(100*M+m+1).(p+1).99` para estável. Limitar `M <= 98`, `m <= 99`, `p <= 98`, `1 <= n <= 98`; rejeitar qualquer outra forma para evitar colisões. A proposta mantém ordem lexicográfica numérica dentro desses limites, mas ainda precisa de testes reais do Tauri, Finder e atualização antes de aprovação. O nome exibido da versão RC também precisa permanecer claro para usuários.

No código-fonte do Tauri CLI 2.12.4, o instalador NSIS usa `nsis_tauri_utils::SemverCompare`, mas isso não comprova instalação e atualização no Windows. Os geradores Debian e RPM recebem a string de versão do Tauri; a política Debian trata `-` como separador de revisão e ordena `~` antes de versões estáveis, portanto não se deve presumir que `0.2.0-rc.1` ordena como SemVer. A conversão para `0.2.0~rc.1` é uma possibilidade para ambos, sujeita à validação com `dpkg` e `rpm` e ao suporte efetivo do bundler. AppImage não tem gerenciador de versão nativo equivalente. A publicação de RC foi habilitada sem esses experimentos (o gate `native-version-order` foi removido); eles continuam pendentes e podem levar a corrigir ou retirar releases já publicadas.

Fontes primárias: [CFBundleVersion](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleversion), [CFBundleShortVersionString](https://developer.apple.com/documentation/bundleresources/information-property-list/cfbundleshortversionstring), [política Debian](https://www.debian.org/doc/debian-policy/ch-controlfields.html#version), [template NSIS do Tauri 2.12.4](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi).
