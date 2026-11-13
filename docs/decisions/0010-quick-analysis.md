# 0010 — Análise rápida por atalho global e ATUS em segundo plano

## Contexto

Quem analisa dados de laboratório costuma ter os valores numa planilha e só quer ver o ajuste. Abrir o ATUS, criar um projeto, colar os dados e digitar a equação são vários passos. A proposta é um atalho de sistema (`⌃⌘B` no macOS, `Ctrl+Win+B` nos demais) que abre uma janela pequena, no estilo de um lançador, para informar a equação e colar os dados. Ao ajustar, o ATUS abre num projeto novo com o ajuste já executado. A janela é só uma porta de entrada: não mostra resultados nem guarda estado próprio.

Para o atalho funcionar, o processo precisa continuar vivo depois que a janela principal fecha.

## Decisão

- **Uma segunda webview do mesmo app React.** O núcleo Rust (`src/desktop/src/quick.rs`) cria a janela `quick` oculta na inicialização: sem moldura, sempre no topo, fora da barra de tarefas, 720×540. O atalho (`tauri-plugin-global-shortcut`) só a mostra, por isso ela abre na hora. `main.tsx` escolhe `QuickAnalysisWindow` pelo rótulo da janela (no navegador, `?window=quick`).
- **Componentes compartilhados.** A janela usa o campo de equação e a tabela do app, extraídos para `EquationField` (de `FitControls`) e `DataPointsTable` (de `DataTableDialog`), e a validação de pontos de `parseValidPoints` (saiu de `AnalysisPage`). Ao abrir, ela lê o clipboard pelo plugin nativo e só aceita automaticamente textos com ao menos dois pontos.
- **Repasse pelo Rust.** `quick_submit` valida o pedido, guarda em `PendingQuickAnalysis`, esconde a janela rápida, mostra (ou recria) a principal e emite `quick-analysis-requested`. A principal busca com `take_quick_analysis` ao montar e ao receber o evento, então uma janela recém-criada não perde o pedido e um segundo `take` volta vazio.
- **Equação opcional.** Só os dados são obrigatórios. Sem equação, o botão vira **Abrir no ATUS**, o conjunto nasce sem função e a tela de análise não roda ajuste; com equação, a janela valida a sintaxe e o ajuste roda ao abrir.
- **Projeto pelo caminho de Nova análise.** O `App` cria o projeto com `projectClient.create`, a partir de um snapshot com um conjunto (`Dados da análise rápida`) e a equação, e a `AnalysisPage` roda os ajustes uma vez ao abrir. Se houver análise aberta, um diálogo pede confirmação; o projeto atual é salvo antes (`canLeave`).
- **Segundo plano.** Fechar a janela principal continua salvando e destruindo a janela como antes. A janela rápida oculta mantém o processo vivo. Um ícone na bandeja (`background.rs`) oferece **Análise rápida**, **Abrir ATUS** e **Sair do ATUS**. No macOS, clicar no Dock recria a janela principal.
- **Sair é explícito.** `ExitRequested` vindo do sistema (por exemplo Cmd+Q) com a janela principal aberta é adiado e vira o evento `app-quit-requested`. O frontend salva (`useQuitRequest`, ligado ao `useProjectSave` ou à tela inicial) e chama `app_quit`. Sem janela principal, o app sai na hora.
- **Uma instância.** `tauri-plugin-single-instance` faz uma segunda execução mostrar a janela principal da que já roda, em vez de disputar o atalho e a bandeja.

## Alternativas descartadas

- **Esconder a janela principal em vez de fechá-la:** mudaria o salvamento ao fechar e deixaria um projeto aberto e oculto.
- **Criar a janela rápida sob demanda:** economiza memória, mas cada abertura levaria o tempo de carregar a webview.
- **Mandar o pedido só pelo evento:** se perde quando a janela principal ainda está carregando.
- **Cantos arredondados com janela transparente:** no macOS exige `macOSPrivateApi`, que impede a App Store. A janela usa moldura própria e sombra do sistema; no macOS os cantos ficam retos.

## Consequências

- O processo fica vivo até a pessoa sair. A webview oculta custa memória; ainda não foi medida.
- O ajuste aberto pela janela rápida usa o serviço mock, como o resto do app, até o motor C++ existir.
- Sem `libayatana-appindicator`, o Linux pode não mostrar a bandeja; o app registra o erro e continua. Em Wayland, atalhos globais não são confiáveis. No Windows, `Ctrl+Win+B` pode colidir com atalhos do sistema. Windows e Linux ainda sem verificação manual; o atalho deveria passar a ser configurável.
- A janela rápida é visível em todas as áreas de trabalho (`visible_on_all_workspaces`), para abrir na área atual em vez de levar a pessoa de volta à área onde foi criada. No macOS, ela ainda não aparece por cima de apps em tela cheia; isso exige um painel nativo (`NSPanel` ou o comportamento `FullScreenAuxiliary`). No Windows, a opção não tem efeito e as áreas de trabalho virtuais ainda precisam de teste manual.
- O app não inicia com o sistema: o atalho só vale depois da primeira abertura. Um `autostart` opcional fica para depois.
- O smoke desktop agora escolhe a janela pelo rótulo, porque a sessão WebDriver pode começar na janela rápida, e cobre o repasse de `quick_submit` até a criação do projeto. Verificado localmente em macOS Apple Silicon; o atalho de teclado e a bandeja não foram acionados por automação (o ambiente não tinha permissão de Acessibilidade).
