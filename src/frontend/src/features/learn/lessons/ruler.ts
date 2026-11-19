/**
 * @module
 * Lesson of the Como medir track: reading a millimetre ruler.
 *
 * Follows the conventions of the didactic laboratory of IFUSP: estimate the tenth of
 * millimetre as the doubtful digit and write half of the smallest division, with one
 * significant figure, as the reading uncertainty (Tabacniks, IFUSP 2009). The scale note
 * comes from the calibration of the laboratory rulers (Guimarães-Filho et al., SNEF 2005).
 */

import type { MeasureLesson } from "../measure/measure-lesson";

/** The ruler lesson. */
export const rulerLesson: MeasureLesson = {
  id: "ruler",
  kind: "instrument",
  track: "measure",
  version: 1,
  instrument: "ruler",
  title: "Régua",
  summary: "Ler a régua milimetrada, estimar o dígito duvidoso e escrever a incerteza.",
  minutes: 5,
  topics: ["1 mm", "± 0,5 mm"],
  example: 42.3,
  steps: [
    {
      id: "zero",
      label: "Encoste no zero",
      html: "Coloque uma ponta da peça exatamente sobre o traço do <b>zero</b>. A borda da régua começa antes do zero: medir a partir da borda soma um pedaço que não é da peça.",
      why: "Muitas réguas têm a ponta gasta. Se o zero estiver estragado, encoste no traço de 1 cm e subtraia 10 mm no fim.",
      focus: "zero",
      highlight: ["zero"],
    },
    {
      id: "parallax",
      label: "Olhe de cima",
      html: "Leia com o olho bem em cima da ponta da peça, olhando na vertical. Olhar de lado desloca a leitura: é o erro de <b>paralaxe</b>.",
      figure: "parallax",
      focus: "end",
      highlight: ["end"],
    },
    {
      id: "division",
      label: "Ache a menor divisão",
      html: "Entre dois traços vizinhos há <b>1 mm</b>. Essa é a menor divisão da régua. Os números grandes marcam centímetros.",
      why: "A escala também pode estar errada. No IFUSP, as réguas de acrílico do laboratório didático eram curtas, e a queda livre medida com elas precisava ser corrigida por 0,99865 (Guimarães-Filho et al., SNEF 2005). Para mais exatidão, compare a régua com uma escala de referência.",
      focus: "division",
      highlight: ["division"],
    },
    {
      id: "doubtful",
      label: "Estime o dígito duvidoso",
      html: "A ponta da peça está entre <b>{a}</b> e <b>{b} mm</b>. Divida esse milímetro em dez com os olhos e estime onde a ponta cai: cerca de <b>{L} mm</b>.",
      why: "Os algarismos lidos na escala são exatos; o último, estimado, é o duvidoso. Ele também é significativo: escrever só o milímetro inteiro joga fora uma informação que você tem.",
      focus: "end",
      highlight: ["endInterval", "end"],
    },
    {
      id: "uncertainty",
      label: "Escreva com incerteza",
      html: "Toda medida vem com a incerteza de leitura. Nesta régua ela é metade da menor divisão.",
      rule: "1 mm ÷ 2 = 0,5 mm",
      result: "L = ({L} ± 0,5) mm",
      note: "Incerteza estimada leva um só algarismo significativo: 0,5 mm, e não 0,50 mm. O valor tem as mesmas casas decimais que ela.",
      focus: "end",
      highlight: ["uncertainty"],
    },
  ],
  references: [
    "Tabacniks, M. H. Conceitos básicos da teoria de erros. IFUSP, revisão 2009.",
    "Marineli, F.; Oliveira, M. C.; Guimarães-Filho, Z. O.; Pacca, J. L. A. Uma interpretação para os erros nas representações das medidas realizadas no laboratório didático. XV SNEF, 2003.",
    "Guimarães-Filho, Z. O. et al. Aprendendo física com o uso de experimentos de grande precisão em laboratórios didáticos: o estudo da queda de um corpo. XVI SNEF, 2005.",
  ],
};
