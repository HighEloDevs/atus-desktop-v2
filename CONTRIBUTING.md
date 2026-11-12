# Contribuindo com o ATUS Desktop

Consulte o [README](README.md) para preparar o ambiente e o [AGENTS.md](AGENTS.md) para as convenções e o estado atual do projeto.

## Fluxo de branches: tudo passa pela `staging`

```text
sua branch ──PR──▶ staging ──PR de promoção──▶ main ──▶ release
```

- **Nenhuma mudança vai direto para a `main`.** Crie sua branch a partir da `staging` e abra o PR com base `staging`. O PR de promoção `staging` → `main` é o único aceito pela `main`: o check `check-source-branch` falha para qualquer outra origem.
- Os PRs para a `staging` rodam os testes de Linux e Windows (`test-linux`, `test-windows`). Os de macOS e a verificação de versão rodam no PR de promoção.
- A `main` publica uma release a cada merge, então o aumento de versão (`node .github/scripts/version.mjs bump <versão>` sincroniza os arquivos; `check --base origin/main` confere) entra na `staging` por PR antes da promoção.
- Correções urgentes seguem o mesmo caminho: PR para a `staging` e, em seguida, a promoção.
- Ambas as branches são protegidas por rulesets versionadas em `.github/rulesets/`: PR obrigatório, checks obrigatórios, sem push direto, sem force push e sem exclusão. Alterar uma ruleset exige sincronizar o arquivo com o GitHub.

## Mudanças e testes

- Crie worktrees em `.worktree/` na raiz do repositório, a partir da `staging`.
- Escreva código e identificadores em inglês e textos da interface em português.
- Inclua ou atualize um teste de regressão que cubra cada melhoria e execute as verificações relevantes.
- Registre decisões arquiteturais em `docs/decisions/` e atualize o contexto do projeto no `AGENTS.md` quando necessário.
- Para persistência, verifique ida e volta, versões anteriores e preservação do trabalho em falhas. Para cálculo científico, use fixtures e tolerâncias justificadas.

## Descrição dos pull requests

Comece pelo problema e pelo comportamento resultante. Descreva a mudança para uma pessoa que não acompanhou a conversa. Ajuste a extensão ao escopo, remova instruções e seções vazias, e mantenha título e descrição coerentes com a implementação final.

Em **Verificação**, informe o que foi executado, em qual ambiente e com qual resultado. Diferencie testes automatizados, testes manuais e verificações pendentes. Inclua evidência visual para mudanças de interface quando ajudar a revisão. Funcionalidades demonstrativas devem ser identificadas como simulação.

O GitHub preenche novos PRs com o [template de corpo](.github/pull_request_template.md). Use a mesma estrutura ao atualizar um PR existente.

### Template

```markdown
## Problema e resultado

<!-- Descreva o problema e o comportamento final. Use um exemplo concreto quando ajudar. -->

## Alterações

<!-- Liste as mudanças que ajudam a revisar o PR e explique decisões relevantes. -->

## Verificação

<!-- Informe comandos, resultados e testes de regressão. Para testes manuais, registre plataforma, passos e resultado observado. Diferencie verificações locais das executadas no CI. -->

## Limites e pendências

<!-- Registre restrições, compatibilidade, migrações ou verificações pendentes relevantes. Remova esta seção se não se aplicar. -->
```
