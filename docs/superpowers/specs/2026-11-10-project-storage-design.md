# Armazenamento e listagem de projetos

## Objetivo e escopo

Permitir criar, salvar, abrir e reencontrar projetos de análise em macOS e Windows. Cada projeto é um arquivo SQLite portátil com extensão `.atus`; seu conteúdo é a fonte de verdade para o trabalho, sem dependência da pasta original dos dados importados nem do índice de recentes. Esta entrega contempla o estado da análise atualmente disponível, ainda demonstrativa, e prepara sua evolução sem prometer o motor científico real.

O PDF de especificações propõe, em AT-15, ida e volta sem perda, migração e tratamento de corrupção; AT-16 prevê múltiplas análises posteriormente. O legado usa JSON. A importação de projetos legados requer fixtures e levantamento do formato e será tratada como etapa própria, sem declarar AT-15 concluído antes dela.

## Abordagens consideradas

1. **Pasta padrão e índice local de recentes — escolhida.** A lista combina uma varredura da pasta padrão com caminhos registrados ao abrir projetos. Os arquivos permanecem independentes do índice, e alterações feitas no gerenciador de arquivos aparecem na lista.
2. **Índice local de todos os projetos.** Centraliza metadados, mas exige reconciliar continuamente o índice com arquivos movidos, removidos ou adicionados fora do aplicativo.

## Arquivos e ciclo de vida

- A pasta padrão é `ATUS/projects` dentro da pasta Documentos do usuário, obtida por API do sistema. Criá-la quando necessário; não presumir o nome localizado de Documentos nem usar um caminho fixo de plataforma.
- Uma nova análise cria um `.atus` nessa pasta com nome inicial `Projeto sem título.atus`, reservando atomicamente um nome disponível sem sobrescrever arquivos. Se a criação falhar, manter a sessão em memória e apresentar erro e opção de tentar novamente ou salvar em outro local.
- **Abrir** aceita `.atus` de qualquer pasta acessível. Validar o arquivo antes de substituir a sessão atual; erro de leitura, arquivo inválido, corrompido ou versão futura preserva a sessão e apresenta mensagem acionável.
- **Salvar** solicita a gravação imediata do estado atual. O salvamento automático agrupa alterações próximas e grava depois de um curto período de inatividade; o atraso exato é decisão de implementação testável. Exibir estados pendente, salvando, salvo e erro de forma acessível.
- Antes de trocar de projeto, fechar a janela ou encerrar, concluir gravações pendentes. Se falhar, manter a sessão e oferecer tentar novamente, salvar como ou descartar explicitamente as alterações não salvas; cancelar mantém a sessão.
- **Salvar como** cria uma cópia completa no caminho escolhido e passa a trabalhar nela somente após sucesso. Uma substituição de arquivo existente exige confirmação; falha ou cancelamento preserva o arquivo e a sessão originais. A cópia passa a constar nos recentes.
- Escrever de modo transacional e serializar gravações para que falhas ou interrupções não deixem um projeto parcialmente atualizado. Mudanças durante uma gravação permanecem pendentes e são gravadas posteriormente; uma conclusão antiga não pode marcar alterações mais recentes como salvas.
- Detectar alterações externas ou acesso concorrente antes de sobrescrever dados e oferecer uma saída que preserve o trabalho. Não efetuar mesclagem silenciosa. A estratégia específica de detecção e resolução será detalhada no plano.

## Conteúdo e formato

Persistir os dados e configurações necessários para recuperar integralmente o trabalho do usuário: séries, valores importados ou editados, nomes, ordem e personalização; seleção e configurações de gráfico; expressão, parâmetros, intervalo e opções de ajuste; e resultados exibidos quando fizerem parte do estado recuperável. Preservar valores de edição ainda inválidos quando representam trabalho do usuário. Estados efêmeros como menus abertos, foco e mensagens transitórias não precisam ser persistidos.

Dados importados são incorporados ao projeto, não apenas referenciados pelo caminho do arquivo de origem. Os resultados do serviço atual continuam identificados como **simulação** depois de reabrir; não se apresentam como resultados científicos. Ausências e valores numéricos devem sobreviver à ida e volta sem conversão silenciosa.

A estratégia de journal e fechamento deve preservar a portabilidade de um único arquivo, inclusive ao copiar um projeto fechado; arquivos auxiliares temporários necessários durante o uso não podem ser omitidos de uma cópia ativa. Inspecionar candidatos à listagem ou abertura não deve criar nem alterar arquivos.

O SQLite deve conter uma identificação de formato e versão de esquema explícitas, distintas da versão do aplicativo. O modelo inicial deve admitir múltiplas análises em versões futuras, sem implementar histograma ou multiplot agora. Alterações de esquema terão migrações versionadas e testadas; versões desconhecidas mais novas não serão modificadas. Uma migração deve preservar o arquivo original em caso de falha. O desenho das tabelas, biblioteca SQLite e mecanismo de cópia segura serão definidos no plano e em decisão arquitetural, antes da implementação.

## Listagem e recentes

A página inicial mostra uma única lista: arquivos `.atus` encontrados diretamente na pasta padrão, combinados com projetos abertos ou salvos em qualquer local. O índice de recentes é local ao aplicativo e armazena caminhos e datas de último acesso, sem conter os dados de análise. Atualizar o acesso após abertura ou salvamento como bem-sucedidos. Projetos recentes aparecem por acesso mais recente; arquivos encontrados na pasta padrão sem registro de acesso vêm depois, em ordem determinística.

Deduplicar caminhos equivalentes considerando as regras da plataforma; uma entrada recente da pasta padrão aparece uma única vez. Arquivos externos ausentes permanecem visíveis como indisponíveis, com ações **Localizar** e **Remover dos recentes**. Localizar valida o arquivo escolhido antes de atualizar o registro. Remover dos recentes não apaga o arquivo; um arquivo ainda presente na pasta padrão continua aparecendo como projeto encontrado. Um índice corrompido deve ser recuperado ou recriado sem apagar projetos. Uma falha parcial de leitura da pasta ou do índice deve ser comunicada sem impedir abrir arquivos manualmente. Perder o índice não afeta projetos, e a pasta padrão pode ser redescoberta.

## Limites e verificação

Não inclui sincronização na nuvem, colaboração simultânea, motor científico, histograma ou multiplot. A importação do JSON legado não deve ser confundida com abrir um `.atus` e precisa de projeto e validação próprios.

Verificar com testes automatizados e cenários de interface: criação sem sobrescrita; ida e volta de todos os campos persistidos, incluindo dados importados e indicação de simulação; salvamento automático e manual com alterações concorrentes; salvar como e falhas sem perda; abertura inválida, corrompida ou de versão futura sem substituir a sessão; interrupção e falha de escrita; migração e preservação em falha; descoberta, deduplicação, ordenação, arquivo ausente, localização e remoção dos recentes; e caminhos reais de Documentos em macOS e Windows. O primeiro fluxo científico completo segue dependente do motor real e de suas fixtures e tolerâncias.
