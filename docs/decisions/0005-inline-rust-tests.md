# 0005 — Testes unitários Rust dentro dos arquivos testados

## Contexto

Os testes unitários do núcleo desktop ficavam em arquivos irmãos ligados por `#[path]` ou `mod`: `project/tests.rs`, `additional_tests.rs`, `menu_tests.rs`, `main_tests.rs` e `store_test_support.rs`. A convenção do Rust Book (cap. 11) é um `#[cfg(test)] mod tests` no fim do próprio arquivo. O crate é só binário, então testes em `tests/` não conseguem importar o código.

## Alternativas

- **Biblioteca `atus` + binário fino + testes de integração em `tests/`.** Separa testes de API pública, mas exige refatorar `main.rs`, `build.rs` e os scripts de cobertura (hoje há um único executável de teste), e cada arquivo em `tests/` vira mais um executável a compilar no CI. Descartada: o ganho não compensa o custo neste estágio.
- **Manter arquivos irmãos.** Funciona, mas foge da convenção e deixa os testes distantes do código.

## Decisão

Cada arquivo termina com `#[cfg(test)] mod tests { ... }` que testa o próprio arquivo; testes que cruzam módulos ficam no módulo do ponto de entrada (por exemplo, `commands.rs`). Fixtures compartilhadas ficam em `project/test_support.rs`, compilado só em testes. O crate permanece só binário. O módulo `tests` deve ser o último item do arquivo, com o fecho `}` na coluna 0.

## Consequências

- O `llvm-cov` só exclui arquivos por nome. `.github/scripts/coverage/rust-strip-tests.mjs` descarta do LCOV tudo a partir do `#[cfg(test)] mod tests` e recalcula os contadores. Ele falha se houver código depois do módulo, mais de um módulo ou módulo fora de linha.
- `project/e2e.rs` (feature `desktop-e2e`) e `project/test_support.rs` continuam excluídos por nome e registrados em `testOnly` no inventário.
- Se surgir uma biblioteca, testes de API pública poderão ir para `tests/`; esta decisão deve então ser revista.
