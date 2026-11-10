# ATUS Desktop v2

O ATUS Desktop é uma ferramenta científica gratuita e de código aberto para análise de dados de física experimental. A v2 busca oferecer um fluxo simples e reproduzível, preservando e verificando as capacidades científicas relevantes da versão anterior.

O projeto está em fase inicial. A stack escolhida é React, Tailwind CSS e shadcn para o frontend, Tauri com Rust para o desktop e C++ para o motor científico. A aplicação inclui uma tela de análise demonstrativa conectada a um motor C++ que retorna valores fixos; nenhum ajuste científico é realizado. O contrato científico definitivo e os detalhes de distribuição ainda serão definidos. O frontend inicial usa Tailwind CSS e shadcn/ui; importação e projetos ainda estão em desenvolvimento.

## Desenvolvimento

Instale Node.js, npm, Rust e Cargo, além dos [pré-requisitos do Tauri](https://v2.tauri.app/start/prerequisites/). No macOS, para desenvolvimento desktop, as Command Line Tools da Apple são suficientes.

```sh
cd src/frontend
npm ci
npm run tauri -- dev
```

Para compilar o frontend, execute `npm run build` no mesmo diretório. Para gerar um pacote de teste na plataforma atual, execute `npm run tauri -- build`. Os ícones são derivados do brandbook. O identificador `org.atus.desktop` é provisório: confirme-o antes da primeira distribuição pública. Os pacotes ainda não são assinados nem estão prontos para publicação.

O workflow de build gera pacotes de teste para macOS e Windows. A instalação e a remoção em uma máquina Windows limpa ainda precisam de validação manual.

## Qualidade do frontend

Em `src/frontend/`, execute `npm run lint` e `npm run format:check` para verificar o código. Para aplicar correções automáticas, use `npm run lint:fix` e `npm run format`. Essas verificações também são executadas no CI.

## Referências

- [Especificações funcionais e técnicas 0.1](docs/references/atus-desktop-v2-especificacoes-0.1.pdf) — escopo proposto, catálogo funcional e decisões em avaliação.
- [Brandbook ATUS / Recorte 1.0](docs/references/atus-recorte-brandbook-1.0.html) — identidade visual e assets; abra o HTML no navegador.
- [AGENTS.md](AGENTS.md) — contexto vivo, orientações e decisões do repositório.

A especificação é um retrato inicial: seus critérios de aceite e estimativas precisam de validação. O legado usado como referência é [Analysis-Tool-for-Undergrad-Students](https://github.com/HighEloDevs/Analysis-Tool-for-Undergrad-Students), no commit `ab7673488849838a8a317279f8b4f1e611148734`.

## Licença

Consulte [LICENSE](LICENSE).
