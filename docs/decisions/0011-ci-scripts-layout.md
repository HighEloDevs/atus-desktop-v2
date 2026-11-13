# 0011 — Organização e enxugamento dos scripts da esteira

## Contexto

`.github/scripts/` misturava scripts reais e testes (`tests/` guardava até um verificador de build), os nomes não seguiam padrão, havia código sem uso (`coverage/rust-llvm.sh` não rodava em nenhum job) e o workflow listava os testes um a um, o que deixava testes novos sem execução sem que ninguém notasse. Também havia verificações repetidas no mesmo run e no mesmo SHA.

## Decisão

- **Scripts por SO.** `scripts/linux|macos|windows/` e `scripts/shared/` (versão, cobertura, release). O SO não entra no nome do arquivo.
- **Nome `<verbo>-<objeto>`** com um conjunto fixo de verbos (`install`, `configure`, `run`, `smoke`, `check`, `collect`, `report`, `strip`, `publish`, `press`), descrito em `.github/scripts/README.md`.
- **Testes em `.github/tests/`, espelhando `.github/`.** O teste de `scripts/a/b.sh` é `tests/scripts/a/b.test.<ext>`. O workflow chama os testes por glob de pasta. `tests/layout.test.mjs` verifica o espelho, os nomes e que cada teste é executado por algum glob do workflow.
- **Removidos:**
  - `rust-llvm.sh` e seu teste (sem uso);
  - `release-gates.mjs` e seu teste (repetia o `if:` do `publish-release`);
  - `verify-linux-bundles.py` e seu teste (o smoke em contêiner e o inventário da release já exigem e abrem um pacote de cada formato; `dpkg-deb --info` e `rpm -qpi` continuam);
  - os testes dos scripts de smoke (a execução do smoke no CI já os exercita; as travas de runner descartável ficam nos scripts);
  - o job `summary`, `record.sh`, `summarize` e a action `upload-test-logs` (o resultado fica nos logs de cada job);
  - passos repetidos (`ubuntu-deps.test` no `build-linux`, testes de release no `publish-release`).
- **`workflows/build.test.mjs` enxuto**: de 21 verificações de texto sobre o YAML para 5, que protegem o grafo de jobs, os jobs por plataforma, o gating de PR e a trava de publicação.

## Consequências

- Os testes da configuração da esteira cobrem só o essencial. É uma exceção consciente à regra de "teste de regressão em toda melhoria": comportamentos já exercidos pelo próprio CI (smokes, bundles) não ganham teste à parte.
- Sem a summary, falhas aparecem apenas nos logs do job, sem a tabela consolidada de testes.
- Os planos em `docs/superpowers/` citam os caminhos antigos e não foram alterados.
