# Contribuindo com o ATUS Desktop

Consulte o [README](README.md) para preparar o ambiente e o [AGENTS.md](AGENTS.md) para as convenções e o estado atual do projeto.

## Mudanças e testes

- Crie worktrees em `.worktree/` na raiz do repositório.
- Escreva código e identificadores em inglês e textos da interface em português.
- Inclua ou atualize um teste de regressão que cubra cada melhoria e execute as verificações relevantes.
- Registre decisões arquiteturais em `docs/decisions/` e atualize o contexto do projeto no `AGENTS.md` quando necessário.
- Todo PR para a `main` sobe a versão (`node .github/scripts/shared/check-version.mjs bump M.m.p`) e traz as notas dela em `docs/releases/vM.m.p.md`, escritas para quem usa o app. O formato está em [docs/releases/README.md](docs/releases/README.md); confira com `node .github/scripts/shared/release/check-release-notes.mjs`.
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
