# ATUS Desktop — contexto para agentes

## Manutenção deste arquivo

Este é um documento vivo. Leia-o antes de trabalhar neste repositório e atualize-o na mesma mudança sempre que surgir ou mudar uma estrutura, decisão relevante, convenção ou lembrete importante. Mantenha o conteúdo conciso, atual e verificável; remova orientações superadas e diferencie decisões aceitas de propostas e questões em aberto. Não registre segredos ou dados pessoais.

## Objetivo

Construir o ATUS Desktop v2, software científico gratuito e open source para estudantes que analisam dados de física experimental. A v2 deve tornar a análise mais simples, verificável e reproduzível, preservando as capacidades científicas relevantes do legado. O fluxo prioritário é importar ou colar dados, mapear variáveis e incertezas, informar o modelo, ajustar, inspecionar os resultados e salvar o projeto.

## Fontes e estado do projeto

- `docs/references/atus-desktop-v2-especificacoes-0.1.pdf`: plano inicial de 08/11/2026, com catálogo AT-01 a AT-22, critérios de aceite propostos, dependências e referências do legado. É um documento de trabalho, não uma lista de funcionalidades concluídas ou decisões aprovadas.
- `docs/references/atus-recorte-brandbook-1.0.html`: proposta de identidade ATUS / Recorte, com princípios visuais, componentes e assets. O mockup é demonstrativo e não é a aplicação implementada.
- Legado: `HighEloDevs/Analysis-Tool-for-Undergrad-Students`, snapshot de referência `ab7673488849838a8a317279f8b4f1e611148734`. O inventário ainda precisa de validação funcional.
- Fundação inicial com Tauri 2, Rust e frontend React/TypeScript com Vite, Tailwind CSS 4 e shadcn/ui. A homepage e a sidebar são iniciais; a seção Sobre resume a história e equipe da página atusweb.com.br/about, com funcionalidades futuras sinalizadas; priorize uma interface compacta de aplicativo desktop em vez de uma página editorial; a tela de análise usa uma área de trabalho com painel de configuração e canvas, baseada no módulo regression de `atus-ui-rrouter`, e pode carregar dados fixos do protótipo C++ e há um teste da ponte; o motor científico real ainda não foi implementado. O empacotamento para macOS e Windows está configurado; os artefatos são de teste e não assinados.

## Convenções de linguagem

- Escreva código, identificadores e nomes de arquivos e pastas em inglês. A interface permanece em português, conforme a orientação de produto.

## Princípios de implementação

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

- Pré-requisitos: Node.js, npm, Rust/Cargo e dependências de sistema do Tauri. No macOS, as Command Line Tools são suficientes para desktop.
- Em `src/frontend/`, execute `npm ci`, `npm run build`, `npm run tauri -- dev` e `npm run tauri -- build` (build de distribuição na plataforma atual). O Tauri usa a configuração em `src/desktop/`; o servidor Vite usa a porta 1420.
- Em `src/frontend/`, use `npm run lint` / `npm run lint:fix` e `npm run format:check` / `npm run format`. ESLint verifica TypeScript e regras de React; Prettier formata os arquivos do frontend. O CI executa as verificações sem modificá-los.
- Links dos perfis na página Sobre abrem no navegador padrão pelo plugin Tauri Opener; os endereços permitidos ficam em `src/desktop/capabilities/default.json`.
- O atalho de nova análise é `Cmd+Option+N` no macOS e `Ctrl+Alt+N` nos demais sistemas. O atalho e o acesso rápido abrem a tela de análise demonstrativa.
- O Vite usa `--configLoader runner`: o carregador padrão ficou bloqueado neste ambiente com Node 26.
- `org.atus.desktop` é identificador provisório; confirme antes de distribuir. A ponte inicial compila C++ via `cc`; ela retorna somente dados de demonstração. Execute `cargo test --manifest-path src/desktop/Cargo.toml` para verificar a integração.

## Estrutura atual

- `AGENTS.md`: contexto e instruções vivas do repositório.
- `README.md`: apresentação e estado inicial para pessoas colaboradoras.
- `.github/workflows/`: build de verificação e empacotamento Tauri em macOS e Windows; os artefatos são de teste, não releases assinadas.
- `src/frontend/`: aplicação React; `components.json` configura shadcn/ui, `src/App.tsx` contém a homepage inicial e `src/styles/globals.css` os tokens e estilos globais; `src/components/ui/` para componentes de interface, `features/` para funcionalidades, `hooks/`, `lib/` e `styles/` para recursos compartilhados, `public/` para assets estáticos e `tests/unit/` e `tests/integration/` para testes.
- `src/desktop/`: núcleo desktop em Rust, com `src/`, ponte C++ em `build.rs` e teste da fronteira nativa em `src/main.rs`.
- `src/scientific-engine/`: motor científico C++, com interfaces públicas em `include/`, implementação em `src/` e testes unitários e de integração em `tests/`.
- `docs/decisions/`: futuras decisões arquiteturais.
- `docs/references/`: documentos originais de especificação e identidade.
- `LICENSE`: licença do repositório; preserve seu conteúdo.
