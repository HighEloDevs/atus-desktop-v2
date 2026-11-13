<p align="center">
  <img src="docs/assets/banner.svg" alt="ATUS" width="100%">
</p>

# ATUS Desktop

O ATUS Desktop é uma ferramenta científica gratuita e de código aberto para análise de dados de física experimental. Importe ou cole seus dados, mapeie variáveis e incertezas, informe o modelo, ajuste, inspecione os resultados e salve o projeto.

## Recursos

- Importação de CSV/TXT/DAT ou colagem da área de transferência (`Cmd/Ctrl+B`), com várias séries sobrepostas e personalizáveis.
- Gráfico com barras de incerteza, tooltip, eixos em cruz, escala logarítmica e exportação de imagem (PNG/JPEG).
- Editor de equação com prévia em LaTeX, parâmetros e intervalo de ajuste.
- Projetos `.atus` (SQLite versionado) com salvamento automático, Salvar como, recentes, renomear, arquivar e excluir.

## Stack

| Camada   | Tecnologia                                                |
| -------- | --------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, D3 |
| Desktop  | Tauri 2 e Rust                                            |
| Motor    | C++, integrado via C ABI e compilado pelo `build.rs`      |

## Pré-requisitos

- **Node.js 22** e npm.
- **Rust** estável com Cargo, via [rustup](https://rustup.rs/).
- **Compilador C/C++** com suporte a C++17.
- **Dependências de sistema do Tauri 2**, conforme a plataforma ([guia oficial](https://v2.tauri.app/start/prerequisites/)):
  - **macOS:** Command Line Tools (`xcode-select --install`). O Xcode completo não é necessário.
  - **Windows:** Microsoft C++ Build Tools (carga de trabalho "Desenvolvimento para desktop com C++") e WebView2.
  - **Linux (Debian/Ubuntu):**
    ```sh
    sudo apt install libwebkit2gtk-4.1-dev build-essential clang curl wget file \
      libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
    ```

## Como rodar localmente

```sh
git clone <url-do-repositório> atus-desktop
cd atus-desktop/src/frontend
npm ci
npm run tauri -- dev
```

A primeira execução compila as dependências Rust e pode demorar alguns minutos. O comando abre a janela do aplicativo com recarga automática do frontend (servidor Vite na porta `1420`, que precisa estar livre).

Para ver só a interface no navegador, sem o núcleo desktop (projetos em disco e clipboard nativo não funcionam), execute `npm run dev` e abra <http://127.0.0.1:1420>.

## Comandos úteis

Todos em `src/frontend/`, salvo indicação.

| Comando                                             | O que faz                                   |
| --------------------------------------------------- | ------------------------------------------- |
| `npm run build`                                     | Verifica tipos e gera o frontend em `dist/` |
| `npm test`                                          | Testes do frontend (Vitest)                 |
| `npm run test:coverage`                             | Testes com cobertura                        |
| `npm run lint` / `npm run lint:fix`                 | ESLint                                      |
| `npm run format:check` / `npm run format`           | Prettier                                    |
| `cargo test --manifest-path src/desktop/Cargo.toml` | Testes Rust, na raiz do repositório         |
| `npm run tauri -- build`                            | Pacote para a plataforma atual              |

Os pacotes gerados não são assinados. No macOS, `npm run tauri -- build --debug --bundles app` gera o `ATUS Desktop.app`, que associa a extensão `.atus` ao aplicativo: dê dois cliques em um `.atus` para abri-lo.

## Projetos `.atus`

**Nova análise** cria um arquivo em `ATUS/projects`, dentro da pasta Documentos do sistema. **Abrir projeto** aceita arquivos de outras pastas e os inclui nos recentes. As mudanças são gravadas automaticamente. **Salvar** antecipa a gravação e **Salvar como** cria uma cópia em um caminho livre. Se o arquivo mudar em outra instância, use **Salvar como** para preservar a edição atual. A primeira abertura de um arquivo v1 cria um backup ao lado dele e migra o esquema para v2.

## Referências

- [Especificações funcionais e técnicas](docs/references/atus-desktop-v2-especificacoes-0.1.pdf)
- [Brandbook ATUS / Recorte](docs/references/atus-recorte-brandbook-1.0.html): identidade visual e assets; abra o HTML no navegador.
- [AGENTS.md](AGENTS.md): contexto, orientações e decisões do repositório.
- [CONTRIBUTING.md](CONTRIBUTING.md): como contribuir.
- Versão anterior: [Analysis-Tool-for-Undergrad-Students](https://github.com/HighEloDevs/Analysis-Tool-for-Undergrad-Students).

## Licença

Consulte [LICENSE](LICENSE).
