# 0008 — Gerenciamento de projetos

## Contexto

A tela inicial listava só caminhos do histórico local, e não havia como renomear, arquivar, excluir ou localizar um projeto no disco. O nome do projeto existe em dois lugares: a coluna `project.name` do arquivo `.atus` e o nome do arquivo, que antes podiam divergir.

## Alternativas

- Renomear só o nome interno ou só o arquivo: deixa os dois divergirem e confunde a lista (um mostra o nome interno, o outro o arquivo).
- Arquivar com uma marca dentro do banco: exige abrir e gravar o arquivo para listar, e o Finder não mostra a diferença.
- Excluir definitivamente: sem volta para quem apaga por engano.

## Decisão

- **Renomear** atualiza `project.name` e o arquivo `.atus` juntos (`project_rename`), valida o nome, recusa destinos existentes e restaura o nome anterior se a troca do arquivo falhar. Na análise aberta, `useProjectSave.rename` grava as edições pendentes, renomeia pela mesma fila de gravação e passa a usar o novo caminho e o novo snapshot.
- **Arquivar** move o arquivo para `Documentos/ATUS/projects/archived/` (`project_archive`/`project_unarchive`), com sufixo numérico em colisões, e sincroniza o nome interno com o novo arquivo.
- **Excluir** move para a Lixeira do sistema (crate `trash`), depois de confirmação.
- **Abrir a pasta** usa `revealItemInDir` do plugin opener (permissão `opener:allow-reveal-item-in-dir`).
- A tela inicial tem duas tabelas: **Recentes** (histórico local, incluindo projetos fora da pasta padrão) e **Todos os projetos** (pasta padrão e `archived/`, com busca, filtro e ordenação). Os metadados vêm de `project_details`, que não falha a lista quando um arquivo está ausente ou ilegível.
- O histórico continua sendo só caminhos no localStorage; renomear e arquivar o atualizam com `replaceRecentPath`, sem mudar a posição.

## Consequências

- Renomear e arquivar pela home não tocam em um projeto aberto, porque a tela inicial só aparece depois de sair da análise.
- Renomear ou mover o arquivo fora do ATUS continua deixando o caminho antigo indisponível até o usuário localizá-lo.
- Não há coluna "aberto em", pois o histórico não guarda datas.
- Windows e Linux ainda não têm verificação manual da Lixeira e de abrir a pasta.
