# 0006 — Branch `staging` entre as branches de trabalho e a `main`

## Contexto

Cada merge na `main` publica uma release (pré-release para versões RC), e os testes completos de macOS só rodam em PRs para a `main`. Antes desta decisão, branches de trabalho entravam direto na `main`: duas mudanças aprovadas isoladamente podiam falhar juntas, e o resultado já saía em release.

## Alternativas

- **Só a `main` protegida (situação anterior).** Simples, mas a integração de várias mudanças acontece na própria `main`, que publica.
- **Staging por convenção, sem trava.** Barato, mas nada impede um PR direto para a `main`.
- **Staging com trava de origem na `main` (escolhida).** Custa um job curto e uma ruleset a mais.

## Decisão

- A `staging` recebe todo o trabalho por PR e é onde as mudanças se integram. Ela é protegida por rulesets próprias (`.github/rulesets/staging-ci.json` e `staging-review.json`): PR obrigatório, sem push direto, sem force push, sem exclusão e checks `test-linux` e `test-windows`.
- A `main` só aceita PRs vindos da `staging` do próprio repositório. O job `check-source-branch` do `Build desktop` valida a origem e é um check obrigatório em `main-ci.json`. PRs de forks são recusados mesmo que a branch se chame `staging`.
- O PR de promoção `staging` → `main` roda a matriz completa (macOS, `check-version`) e carrega o aumento de versão.
- Pushes na `staging` não geram pacotes nem release; só a `main` publica.

## Consequências

- Os PRs de trabalho ficam mais rápidos: macOS só roda na promoção, então uma falha específica de macOS aparece depois do merge na `staging`, e não no PR da mudança.
- O aumento de versão passa a ser um PR para a `staging` antes da promoção.
- A `staging` pode ficar à frente da `main` por um tempo, e promoções devem ser frequentes para não acumular mudanças.
- A ruleset da `main` só passa a exigir `check-source-branch` depois que o job existir na `main`; antes disso o check nunca reportaria e bloquearia todos os PRs. Aplicar a mudança no GitHub é um passo manual posterior ao primeiro merge de promoção.
- Se a promoção virar gargalo, avaliar rodar o macOS também nos PRs para a `staging` ou um agendamento noturno.
