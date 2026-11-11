# ATUS Desktop — contexto para agentes

## Manutenção deste arquivo

Este é um documento vivo. Leia-o antes de trabalhar neste repositório e atualize-o na mesma mudança sempre que surgir ou mudar uma estrutura, decisão relevante, convenção ou lembrete importante. Mantenha o conteúdo conciso, atual e verificável; remova orientações superadas e diferencie decisões aceitas de propostas e questões em aberto. Não registre segredos ou dados pessoais.

## Objetivo

Construir o ATUS Desktop v2, software científico gratuito e open source para estudantes que analisam dados de física experimental. A v2 deve tornar a análise mais simples, verificável e reproduzível, preservando as capacidades científicas relevantes do legado. O fluxo prioritário é importar ou colar dados, mapear variáveis e incertezas, informar o modelo, ajustar, inspecionar os resultados e salvar o projeto.

## Fontes e estado do projeto

- `docs/references/atus-desktop-v2-especificacoes-0.1.pdf`: plano inicial de 08/11/2026, com catálogo AT-01 a AT-22, critérios de aceite propostos, dependências e referências do legado. É um documento de trabalho, não uma lista de funcionalidades concluídas ou decisões aprovadas.
- `docs/references/atus-recorte-brandbook-1.0.html`: proposta de identidade ATUS / Recorte, com princípios visuais, componentes e assets. O mockup é demonstrativo e não é a aplicação implementada.
- Legado: `HighEloDevs/Analysis-Tool-for-Undergrad-Students`, snapshot de referência `ab7673488849838a8a317279f8b4f1e611148734`. O inventário ainda precisa de validação funcional.
- Fundação inicial com Tauri 2, Rust e frontend React/TypeScript com Vite, Tailwind CSS 4 e shadcn/ui. A homepage e a sidebar são iniciais; a seção Sobre resume a história e equipe da página atusweb.com.br/about, com funcionalidades futuras sinalizadas; priorize uma interface compacta de aplicativo desktop em vez de uma página editorial; a tela de análise usa uma área de trabalho com painel de configuração e um componente de gráfico D3 com pontos e controles de visualização, pode carregar dados fixos do protótipo C++ e há um teste da ponte; o gráfico permite importar CSV/TXT/DAT e sobrepor e personalizar séries, com identidade simples para um conjunto, cards expansíveis para vários e menu de ações na aba Análise; o exemplo C++ continua usando dados fixos; o motor científico real ainda não foi implementado. A interface oferece um serviço mock em `features/analysis/fit/fit-service.ts`, que desenha uma diagonal ilustrativa e não avalia equações nem calcula ajustes; seu contrato é provisório. A interface interpreta expressões com mathjs, mostra prévia LaTeX e aceita parâmetros, intervalo em X e opções de incerteza; o mock usa somente o intervalo, sem calcular o modelo. O painel sob o gráfico mostra resultados fictícios identificados como simulação; parâmetros, incertezas e métricas não são resultados científicos. O empacotamento para macOS e Windows está configurado; os artefatos são de teste e não assinados.

## Convenções de linguagem

- Escreva código, identificadores e nomes de arquivos e pastas em inglês. A interface permanece em português, conforme a orientação de produto.
- Documente todos os módulos e classes e todas as funções e métodos públicos em inglês, no padrão da linguagem (JSDoc, rustdoc ou Doxygen). Descreva propósito, parâmetros, retorno, erros, efeitos colaterais e pré-condições relevantes ao contrato. Inclua exemplos de uso quando ajudarem a compreender a API e mantenha a documentação atualizada junto com a implementação.

## Princípios de implementação

- Toda melhoria deve vir com um teste de regressão que cubra o comportamento alterado. Adicione ou atualize o teste na mesma mudança e execute as verificações relevantes.

- Priorize correção numérica e paridade verificável antes de otimizações. Use fixtures, resultados de referência e tolerâncias absolutas/relativas justificadas; valide convergência e entradas inválidas.
- Separe interface e cálculo por contrato explícito e versionado. A proposta inclui x/y, incertezas opcionais, expressão, parâmetros iniciais, método e opções na entrada; resultados, incertezas, diagnóstico, resíduos e matrizes disponíveis na saída. Unidades, ausências e erros ainda precisam ser definidos.
- Preserve o trabalho do usuário: persistência versionada, testes de ida e volta e migrações sem perda silenciosa; trate arquivos corrompidos e interrupções.
- Produza erros compreensíveis e interfaces acessíveis por teclado, com contraste e estados claros. Operações longas devem informar estado e permitir cancelamento sem encerrar a interface.
- O primeiro fluxo verificável deve percorrer importação → ajuste → gráfico → salvar/reabrir, com fixture, resultado esperado, tolerância, instruções e evidência que permita distinguir falhas de entrada, interface e algoritmo.
- Consulte os critérios e dependências do PDF antes de implementar cada item. Eles são sugestões a validar, não testes já aprovados. Não marque entregas como concluídas sem evidência do comportamento.

## Arquitetura e prioridades

A stack escolhida para o projeto é React, Tailwind CSS e shadcn no frontend; Tauri e Rust no núcleo desktop; e C++ no motor científico. A especificação original apresentava alternativas em avaliação; esta escolha atualiza aquela proposta. A ponte C ABI atual é apenas um protótipo de dados fixos; o contrato científico e as bibliotecas permanecem em aberto. Consulte `docs/decisions/0001-mock-cpp-bridge.md`.

Registre decisões arquiteturais relevantes em `docs/decisions/`, com contexto, alternativas, critérios, experimento quando aplicável, decisão e consequências.

A sequência proposta é fundação (AT-01, AT-19, AT-20), primeiro fluxo (AT-02–05, AT-09, AT-15, AT-22), paridade (AT-06–08, AT-10–13, AT-16, AT-18) e polimento (AT-14, AT-17, AT-21). AT-19 deve orientar os ajustes mesmo onde não conste como dependência rígida. Escopo, critérios e estimativas continuam sujeitos a revisão; não há calendário aprovado.

## Identidade e comunicação

Consulte o brandbook para aplicar a identidade Recorte e seus assets oficiais. A base é grafite `#20272C` sobre papel `#F7F7F3`, com coral `#F25A3C` para foco e atenção e cobalto `#364CFF` para análise, seleção e séries. Preserve proporções da marca e confira o contraste real: branco sobre coral não é adequado para texto pequeno. Inter Display, Inter e fonte monoespaçada são as referências tipográficas. Use linguagem clara, objetiva e acessível em português na interface.

## Desenvolvimento

- O workflow `Build desktop` executa os jobs `test-*` nos PRs e gera pacotes nos jobs `build-*` após os testes em pushes para `main` ou execução manual; os artefatos expiram em três dias. Em Ubuntu, exige cobertura de linhas superior a 90% para o frontend (Vitest/V8, incluindo arquivos não exercitados) e para o motor C++ demonstrativo. PRs para `main` verificam também o aumento e a sincronização da versão. O job `coverage-rust` passou no CI em macOS Apple Silicon, com inventário das fontes e inclusão de código não ligado; `desktop-macos-intel` está em implantação. Caminhos condicionais de outras plataformas não são cobertos pelo relatório. O smoke dos pacotes macOS ainda precisa de validação nos runners; instalação em Windows/macOS, testes desktop multiplataforma e publicação automática ainda não são gates. Consulte `docs/decisions/0004-ci-platform-investigation.md`; a proteção de PR e a aprovação de maintainer ainda dependem de configuração e validação no GitHub.
- Siga [CONTRIBUTING.md](CONTRIBUTING.md) para contribuições e descrições de PR. Use o template de corpo documentado ali e em `.github/pull_request_template.md`, mantendo o escopo final e as evidências de verificação atualizados.

- Crie sempre worktrees novas dentro de `.worktree/` na raiz do repositório, usando uma subpasta por worktree. Os artefatos locais do Superpowers e o diretório de worktrees ficam fora do Git.

- Pré-requisitos: Node.js, npm, Rust/Cargo e dependências de sistema do Tauri. No macOS, as Command Line Tools são suficientes para desktop.
- Em `src/frontend/`, execute `npm ci`, `npm run build`, `npm run tauri -- dev` e `npm run tauri -- build` (build de distribuição na plataforma atual). O Tauri usa a configuração em `src/desktop/`; o servidor Vite usa a porta 1420.
- Em `src/frontend/`, execute `npm test` para verificar a renderização dos componentes de projetos.
- Em `src/frontend/`, use `npm run lint` / `npm run lint:fix` e `npm run format:check` / `npm run format`. ESLint verifica TypeScript e regras de React; Prettier formata os arquivos do frontend. O CI executa as verificações sem modificá-los.
- `.gitattributes` mantém arquivos de texto do frontend com finais de linha LF também no Windows, conforme exigido pelo Prettier.
- O smoke desktop experimental usa a feature opt-in `desktop-e2e` e abre um driver local sem autenticação; siga `docs/testing/desktop-e2e.md` e não o use com dados reais. A feature não faz parte do build padrão e é recusada no perfil release convencional.
- `.github/scripts/coverage/rust-desktop-macos.sh` combina perfis Rust dos testes e do smoke no macOS; o coletor inclui código não ligado no alvo e verifica o inventário de fontes; caminhos condicionais de outras plataformas não são cobertos por esse relatório.
- O workflow de release está em preparação e bloqueia a publicação enquanto os gates completos não existirem; `release-version` e `release-artifacts` verificam versão e builds após push para `main`. O fluxo e as validações pendentes estão em `docs/testing/release-rollout.md`.
- Links dos perfis na página Sobre abrem no navegador padrão pelo plugin Tauri Opener; os endereços permitidos ficam em `src/desktop/capabilities/default.json`.
- O atalho de nova análise é `Cmd+Option+N` no macOS e `Ctrl+Alt+N` nos demais sistemas. No desktop, o atalho e o cartão **Nova análise** em **Acesso rápido** criam um projeto em Documentos/ATUS/projects. O cartão **Abrir projeto** abre o seletor nativo, e os recentes exibem o caminho completo do arquivo.
- No macOS, o pacote .app usa `src/desktop/Info.plist` para declarar a associação .atus e o ícone exibido no Finder. O aplicativo solicita confirmação antes de trocar uma análise aberta.
- No macOS, **Arquivo** traz **Salvar projeto** (Cmd+S) e **Salvar como** (Cmd+Shift+S). Nas demais plataformas os comandos ficam no cabeçalho do projeto.
- O Vite usa `--configLoader runner`: o carregador padrão ficou bloqueado neste ambiente com Node 26.
- `org.atus.desktop` é identificador provisório; confirme antes de distribuir. A ponte inicial compila C++ via `cc`; ela retorna somente dados de demonstração. Execute `cargo test --manifest-path src/desktop/Cargo.toml` para verificar a integração.

## Estrutura atual

- `AGENTS.md`: contexto e instruções vivas do repositório.
- `CONTRIBUTING.md`: orientações de contribuição, verificações e template de descrição de PR.
- `README.md`: apresentação e estado inicial para pessoas colaboradoras.
- `.github/workflows/`: verificações, empacotamento e preparação de release; os artefatos são de teste, não releases assinadas.
- `.github/scripts/`: utilitários e testes de CI, cobertura, empacotamento, versionamento e release.
- `src/frontend/`: aplicação React; `components.json` configura shadcn/ui, `src/App.tsx` contém a homepage inicial e `src/styles/globals.css` os tokens e estilos globais; `src/components/ui/` para componentes shadcn de interface, `src/components/chart/` para o gráfico e sua personalização compartilhada com a sidebar, `features/` para funcionalidades, `hooks/`, `lib/` e `styles/` para recursos compartilhados, `public/` para assets estáticos e `tests/unit/` e `tests/integration/` para testes.
- `src/desktop/`: núcleo desktop em Rust, com `src/`, ponte C++ em `build.rs` e teste da fronteira nativa em `src/main.rs`. O módulo `src/project/` mantém arquivos SQLite .atus versionados, gravação transacional, backup de migrations e detecção de edições concorrentes. O frontend integra abertura, recentes, salvamento automático e Salvar como em `src/features/projects/`.
- `src/desktop/migrations/`: esquema inicial e migrações SQL numeradas, embutidos no binário. O Rust controla a ordem, o backup e a transação dos projetos existentes.
- `src/scientific-engine/`: motor científico C++, com interfaces públicas em `include/`, implementação em `src/` e testes unitários e de integração em `tests/`.
- `docs/decisions/`: decisões arquiteturais, incluindo o componente de gráficos com D3.
- `docs/references/`: documentos originais de especificação e identidade.
- `LICENSE`: licença do repositório; preserve seu conteúdo.
