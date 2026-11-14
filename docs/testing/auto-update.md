# Atualização automática: o que ainda só se confirma à mão

O teste de integração (`desktop-e2e.md`) cobre o motor e a interface contra um servidor local, sem instalar nada. Instalar de verdade, num pacote de verdade, só se confirma com duas versões publicadas em sequência. Este roteiro é para a **primeira atualização real: 0.2.8 → 0.2.9**.

## Preparação

1. Instale a 0.2.8 **uma vez, à mão**, a partir da página de releases (nenhuma versão anterior sabe se atualizar).
2. No macOS, instale arrastando o ATUS para **Aplicativos** e abra de lá. Abrir direto do `.dmg` ou de Downloads sem mover leva ao estado "Baixar manualmente" (`readOnlyLocation`) ou a uma instalação em local temporário.
3. Mantenha o ATUS aberto. A verificação automática acontece 5 segundos depois de abrir e a cada 6 horas.

## Roteiro

1. Faça o merge da 0.2.9. Quando a release sair, o ATUS da 0.2.8 deve baixar em segundo plano e mostrar **Atualizar** no topo (e o banner, uma vez por dia).
2. Abra um projeto, edite algo e **não** salve. Clique em **Atualizar** e confirme: o projeto deve ser salvo, o ATUS deve reiniciar já na 0.2.9, e o projeto deve reabrir com a edição.
3. Confira a versão na barra lateral e em Sobre.
4. Depois de reiniciar, a página **Novidades** deve abrir sozinha na 0.2.9, uma vez; a capa e as imagens da 0.2.9 devem carregar (precisam de internet). Reabra o ATUS: a página não abre de novo.
5. Antes de atualizar, com a atualização já baixada: o item **Novidades** deve ter um ponto, a versão nova deve aparecer marcada como **nova**, e o botão **Ver novidades** do banner deve abrir a página nela.

## Por formato

| Formato | O que conferir | Verificado |
|---|---|---|
| macOS arm64 e Intel (`.app`) | Atualiza de **Aplicativos**; reinicia; o Gatekeeper não pede nada de novo | — |
| Windows NSIS (`.exe`) | Atualiza sem administrador; o ATUS reabre sozinho | — |
| Windows MSI | Pede permissão de administrador **depois** que o ATUS fecha. Negando: reabrir o ATUS antigo e ver "Baixar manualmente" (`previousAttemptFailed`) | — |
| Linux AppImage | Atualiza se a pasta do arquivo for gravável; senão, "Baixar manualmente" (`notWritable`) | — |
| Linux `.deb` e `.rpm` | A janela de senha aparece; recusar leva a "Baixar manualmente"; aceitar reinicia o ATUS (o executável em uso foi trocado, então confirme que o reinício funciona) | — |

## Também

- Sem internet: o botão não aparece e nada é mostrado como erro (a verificação em segundo plano é silenciosa).
- Fechar a janela principal (o ATUS fica na bandeja) com uma atualização já baixada e abrir de novo: o botão **Atualizar** deve voltar na hora.
- Cancelar um download pelo popover: o botão deve mudar para **Baixar atualização** e não voltar a baixar sozinho.
