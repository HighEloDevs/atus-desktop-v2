/** A small, valid changelog in the shape `changelog.json` has, shared by the news tests. */
export const SHA = "a".repeat(40);
export const RAW = `https://raw.githubusercontent.com/HighEloDevs/atus-desktop-v2/${SHA}/docs/releases`;

export const VIDEO_URL = "https://youtu.be/dQw4w9WgXcQ";

/** Three versions, newest first: video and cover; gallery and links; text only. */
export function rawChangelog() {
  return {
    schema: 1,
    versions: [
      {
        version: "0.3.0",
        date: "2026-12-02",
        title: "Resíduos à vista",
        summary: "O ajuste agora mostra onde ele erra.",
        cover: `${RAW}/assets/v0.3.0/cover.svg`,
        features: [
          {
            title: "Painel de resíduos",
            text: ["Fica sob o gráfico e acompanha o zoom. Ative em `Resíduos`."],
            images: [],
            video: {
              title: "Resíduos em 40 segundos",
              url: VIDEO_URL,
              poster: `${RAW}/assets/v0.3.0/poster.png`,
            },
          },
          {
            title: "Análise rápida",
            text: [
              "Aperte `⌃⌘B`.",
              "Veja **mais** no [projeto](https://github.com/HighEloDevs/atus-desktop-v2).",
            ],
            images: [],
            video: { title: "Análise rápida", url: VIDEO_URL, poster: null },
          },
        ],
        improvements: ["O tooltip responde às setas do teclado."],
        fixes: ["O MSI instala na pasta certa."],
      },
      {
        version: "0.2.4",
        date: "2026-11-20",
        title: "Gráfico pronto para o relatório",
        summary: "Leve o gráfico direto para o relatório.",
        cover: null,
        features: [
          {
            title: "Exportar o gráfico",
            text: ["Copie ou salve em *PNG* ou JPEG."],
            images: [
              { alt: "Menu do botão de cópia", url: `${RAW}/assets/v0.2.4/menu.png` },
              { alt: "Salvar como PNG ou JPEG", url: `${RAW}/assets/v0.2.4/salvar.png` },
              { alt: "Atalho em ação", url: `${RAW}/assets/v0.2.4/atalho.gif` },
            ],
            video: null,
          },
        ],
        improvements: [],
        fixes: ["Colar dados com vírgula decimal funciona no Windows."],
      },
      {
        version: "0.2.3",
        date: "2026-11-13",
        title: "Instaladores para laboratórios",
        summary: "Novos formatos de instalação.",
        cover: null,
        features: [
          {
            title: "Imagem .dmg no macOS",
            text: ["Arraste o ATUS para Aplicativos."],
            images: [],
            video: null,
          },
        ],
        improvements: [],
        fixes: [],
      },
    ],
  };
}
