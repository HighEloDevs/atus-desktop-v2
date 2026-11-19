/**
 * @module
 * Lesson of the Como medir track: reading an outside micrometer of 0 to 25 mm.
 *
 * The spindle advances 0,5 mm per turn and the thimble has 50 divisions, so each division is
 * 0,01 mm. The reading uncertainty is half of it, 0,005 mm, and, as on the ruler, the
 * thousandth is estimated between two thimble lines as the doubtful digit (Tabacniks, IFUSP
 * 2009). A wrong micrometer uncertainty is one of the errors the IFUSP group counted in
 * student reports (Marineli, Oliveira, Guimarães-Filho and Pacca, SNEF 2003).
 */

import type { MeasureLesson } from "../measure/measure-lesson";

/** The micrometer lesson. */
export const micrometerLesson: MeasureLesson = {
  id: "micrometer",
  kind: "instrument",
  track: "measure",
  version: 1,
  instrument: "micrometer",
  title: "Micrômetro",
  summary: "Ler bainha e tambor, estimar o milésimo e escrever a incerteza.",
  minutes: 8,
  topics: ["0,01 mm", "± 0,005 mm"],
  example: 7.872,
  steps: [
    {
      id: "zero",
      label: "Confira o zero",
      html: "Feche o micrômetro girando pela <b>catraca</b> até ela estalar. A borda do tambor tem de ficar no zero da bainha, com o <b>0</b> do tambor na linha de referência.",
      why: "Gire sempre pela catraca: ela limita a força, para não amassar a peça nem forçar o fuso. Se o zero não coincidir, anote o erro de zero e desconte em todas as medidas.",
      focus: "zero",
      highlight: ["zero", "thimbleLine"],
      closed: true,
    },
    {
      id: "sleeve",
      label: "Leia a bainha",
      html: "Encoste a peça entre a bigorna e o fuso, girando pela catraca. A borda do tambor já passou do traço <b>{M}</b> de cima da bainha: são <b>{M} mm</b>. {half}",
      why: "Os traços de cima da bainha marcam milímetros; os de baixo, os meios milímetros. Uma volta do tambor anda 0,5 mm.",
      focus: "sleeve",
      highlight: ["sleeveMm", "half"],
    },
    {
      id: "thimble",
      label: "Leia o tambor",
      html: "Olhe o tambor na linha de referência da bainha. Ela cai entre os traços <b>{t}</b> e <b>{t1}</b>, um pouco depois do {t}: cerca de <b>{T}</b> divisões.",
      why: "Cada traço do tambor vale 0,01 mm. A fração da divisão, estimada com os olhos, é o dígito duvidoso, como os décimos de milímetro na régua.",
      focus: "thimble",
      highlight: ["thimbleLine"],
    },
    {
      id: "sum",
      label: "Some as partes",
      html: "Some a bainha, o meio milímetro, se apareceu, e o tambor, a 0,01 mm por divisão.",
      rule: "{M} + {B} + {T} × 0,01 = {L} mm",
      focus: "thimble",
      highlight: ["sleeveMm", "half", "thimbleLine"],
    },
    {
      id: "uncertainty",
      label: "Escreva com incerteza",
      html: "A menor divisão do micrômetro é a do tambor, 0,01 mm. A incerteza de leitura é a metade dela.",
      rule: "0,01 mm ÷ 2 = 0,005 mm",
      result: "L = ({L} ± 0,005) mm",
      note: "O valor termina nos milésimos, a mesma casa da incerteza. O último algarismo é o estimado.",
      why: "Errar a incerteza do micrômetro foi um dos erros que o grupo do IFUSP encontrou nos relatórios de Laboratório de Mecânica (Marineli, Oliveira, Guimarães-Filho e Pacca, SNEF 2003).",
      focus: "thimble",
      highlight: ["thimbleLine"],
    },
  ],
  references: [
    "Tabacniks, M. H. Conceitos básicos da teoria de erros. IFUSP, revisão 2009.",
    "Marineli, F.; Oliveira, M. C.; Guimarães-Filho, Z. O.; Pacca, J. L. A. Uma interpretação para os erros nas representações das medidas realizadas no laboratório didático. XV SNEF, 2003.",
    "Pascholati, P. R. (org.). Física Experimental 1. IFUSP, 2011.",
  ],
};
