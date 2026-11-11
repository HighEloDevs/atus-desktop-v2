# 0004 — Investigação das plataformas de CI

## Contexto e objetivo

A proposta é exigir testes no Ubuntu x64, Windows x64 e macOS Intel e Apple Silicon, verificando pacotes Linux também em Fedora. É necessário medir cobertura real por linguagem e preservar a distinção entre pré-release e versão estável nos instaladores. Este registro descreve investigação inicial, não comprova que os gates propostos funcionem.

## Evidências locais

A investigação foi feita em macOS ARM64, Node 26.13.0 e Cargo 1.99.1. O frontend possui quatro testes de integração (`src/frontend/tests/integration`), executados pelo test runner do Node e carregando TSX via Vite SSR. O Rust possui onze testes marcados `#[test]`, incluindo a ponte, e o C++ contém `mock_analysis.cpp` sem suíte própria. O motor não implementa cálculo científico.

Após `npm ci`, a medição original com o test runner do Node mostrou 100% com a tabela de arquivos vazia; esse resultado não mede cobertura da aplicação. Os testes passaram a usar Vitest com cobertura V8, incluindo arquivos TS/TSX não executados: a medição inicial local indicou 187/1008 linhas (18,55%), abaixo da meta. O npm informou vulnerabilidades moderadas; não foram analisadas aqui.

A coleta LLVM exploratória de Rust mediu 512/696 linhas (73,56%), incluindo código de testes e apenas caminhos compilados para macOS ARM; ela ainda não é adequada como gate de produção. O C++ demonstrativo mediu 4/4 linhas localmente, sem comprovar comportamento científico. É necessário estabelecer uma política verificável de inclusão e exclusões e ampliar os testes antes de ativar os limites. Não alegar que a cobertura supera 90% por linguagem sem esse trabalho.

## Plataformas e alternativas

A documentação do GitHub lista runners padrão `ubuntu-24.04`, `windows-2025`, `macos-15-intel` e `macos-15` ARM para repositórios públicos. Labels e disponibilidade devem ser validados durante a execução real. [Runners hospedados](https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job).

A documentação atual do Tauri indica `@wdio/tauri-service`, com servidor WebDriver embutido, para Windows, Linux e macOS; `tauri-driver` diretamente não oferece driver para macOS. Esta é uma alternativa para experimentar, não evidência de que diálogos nativos, aplicativo empacotado e runners sem sessão gráfica estejam cobertos. Testes de mock runtime não executam a WebView nativa. [Testes do Tauri](https://v2.tauri.app/develop/tests/) e [WebDriver](https://v2.tauri.app/develop/tests/webdriver/).

Nenhum experimento de automação gráfica foi executado nesta investigação. Não foram testados Windows, macOS Intel, Ubuntu ou Fedora, nem instalação/abertura de `.deb`, `.rpm` e AppImage. Um contêiner Fedora pode verificar instalação, mas não demonstra sozinho funcionamento em desktop real. Não tornar esses checks obrigatórios até demonstrar a execução apropriada de cada um.

## Versões RC

Ainda não foram construídos instaladores com `0.2.0-rc.1`, `0.2.0-rc.2` e `0.2.0`. Em particular, não há evidência local para escolher um mapeamento numérico nativo, nem para declarar sua ordem, limites e ausência de colisões entre RC e estável. O fluxo deve rejeitar versões não demonstradas em vez de publicar um pacote com versão incorreta; validar os formatos nativos e upgrades antes de ativar publicação automática de RC.

## Proteção

A consulta `gh api repos/leoeiji/atus-desktop/rulesets` retornou `[]`; a conta autenticada tem permissão administrativa e o repositório é público. O GitHub documenta regras com bypass restrito a PR e regras distintas de checks, mas a interação efetiva precisa ser testada antes da ativação. Repositórios pessoais não dispõem de equipes para a regra de revisão por equipe; uma aprovação genérica pode vir de alguém com permissão de escrita e não necessariamente de um maintainer. Avaliar CODEOWNERS e a lista de proprietários antes de garantir essa política. [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [bypass](https://docs.github.com/en/rest/repos/rules).

## Decisão provisória

Usar a matriz e a política de testes aprovadas como objetivo, mantendo as verificações de plataforma, cobertura e empacotamento acima como pré-condições de implantação. Nenhuma regra de branch ou release automática deve ser declarada pronta com base apenas nesta investigação.
