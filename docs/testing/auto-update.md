# Atualização automática: o que ainda só se confirma à mão

O teste de integração (`desktop-e2e.md`) cobre o motor e a interface contra um servidor local, sem instalar nada. Instalar de verdade, num pacote de verdade, só se confirma com duas versões publicadas em sequência. Este roteiro é para a **primeira atualização real: 0.2.8 → 0.2.9**.

## Preparação

1. **Feche por completo qualquer ATUS que esteja aberto** (na bandeja, **Sair do ATUS**; fechar só a janela não basta), inclusive uma cópia em Downloads. Todas as cópias têm o mesmo identificador, e o ATUS só deixa uma instância rodar: abrir outra entrega o controle à primeira e sai.
2. Instale a 0.2.8 **uma vez, à mão**, a partir da página de releases (nenhuma versão anterior sabe se atualizar).
3. No macOS, instale arrastando o ATUS para **Aplicativos** e abra de lá. Abrir direto do `.dmg` ou de Downloads sem mover leva ao estado "Baixar manualmente" (`readOnlyLocation`) ou a uma instalação em local temporário.
4. Confira a versão na barra lateral: tem de mostrar `v0.2.8` (as anteriores mostravam `0.1.0` fixo).
5. A 0.2.8 verifica **5 segundos depois de abrir e a cada 6 horas**, e não tem botão para verificar na hora. Depois que a 0.2.9 for publicada, **feche o ATUS por completo e abra de novo** e espere cerca de um minuto (o download é em segundo plano). A partir da 0.2.9 a página Novidades tem **Procurar atualizações**.

## Roteiro

1. Faça o merge da 0.2.9. Quando a release sair, reabra o ATUS da 0.2.8 (passo 5 acima): ele deve baixar em segundo plano e mostrar **Atualizar** no topo (e o banner, uma vez por dia).
2. Abra um projeto, edite algo e **não** salve. Clique em **Atualizar** e confirme: o projeto deve ser salvo, o ATUS deve reiniciar já na 0.2.9, e o projeto deve reabrir com a edição.
3. Confira a versão na barra lateral e em Sobre.
4. Depois de reiniciar, a página **Novidades** deve abrir sozinha na 0.2.9, uma vez, mesmo sendo a primeira vez que o ATUS abre com essa versão (o aviso vem do registro de instalação que a 0.2.8 grava); a capa e as imagens da 0.2.9 devem carregar (precisam de internet). Reabra o ATUS: a página não abre de novo.
5. Antes de atualizar, com a atualização já baixada: o item **Novidades** deve ter um ponto, a versão nova deve aparecer marcada como **nova**, e o botão **Ver novidades** do banner deve abrir a página nela.

## Por formato

| Formato | O que conferir | Verificado |
|---|---|---|
| macOS arm64 e Intel (`.app`) | Atualiza de **Aplicativos**; reinicia; o Gatekeeper não pede nada de novo | — |
| Windows NSIS (`.exe`) | Atualiza sem administrador; o ATUS reabre sozinho | — |
| Windows MSI | Pede permissão de administrador **depois** que o ATUS fecha. Negando: reabrir o ATUS antigo e ver "Baixar manualmente" (`previousAttemptFailed`) | — |
| Linux AppImage | Atualiza se a pasta do arquivo for gravável; senão, "Baixar manualmente" (`notWritable`) | — |
| Linux `.deb` e `.rpm` | A janela de senha aparece; recusar leva a "Baixar manualmente"; aceitar reinicia o ATUS (o executável em uso foi trocado, então confirme que o reinício funciona) | — |

## Imagens das notas por sistema

A política de segurança de conteúdo foi verificada só no macOS (WKWebView), num build empacotado: a capa vinda do GitHub carrega e imagens de outros hosts são bloqueadas. O WebView2 (Windows) e o WebKitGTK (Linux) devem aplicá-la igual, mas isso não foi verificado.

| Sistema | O que conferir | Verificado |
|---|---|---|
| Windows (WebView2) | Na página Novidades, a capa e as imagens da versão carregam | — |
| Linux (WebKitGTK) | O mesmo | — |

## Também

- Sem internet: o botão não aparece e nada é mostrado como erro (a verificação em segundo plano é silenciosa).
- Fechar a janela principal (o ATUS fica na bandeja) com uma atualização já baixada e abrir de novo: o botão **Atualizar** deve voltar na hora.
- Cancelar um download pelo popover: o botão deve mudar para **Baixar atualização** e não voltar a baixar sozinho.
