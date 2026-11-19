/**
 * @module
 * Lesson of the Como medir track: reading a vernier caliper of 0,05 mm.
 *
 * The vernier has 20 divisions over 39 mm. The reading uncertainty is half of 0,05 mm,
 * written with one significant figure as 0,03 mm, and the value keeps the hundredths only:
 * padding it with a zero to match a two-figure uncertainty is one of the mistakes the IFUSP
 * group found in student reports (Marineli, Oliveira, Guimarães-Filho and Pacca, SNEF 2003).
 */

import type { MeasureLesson } from "../measure/measure-lesson";
import { VERNIER_005 } from "../measure/reading";

/** The vernier caliper lesson. */
export const caliperLesson: MeasureLesson = {
  id: "caliper",
  kind: "instrument",
  track: "measure",
  version: 1,
  instrument: "caliper",
  title: "Paquímetro de 0,05 mm",
  summary: "Ler o nônio de 0,05 mm: milímetros inteiros, traço que coincide e incerteza.",
  minutes: 8,
  topics: ["0,05 mm", "± 0,03 mm"],
  example: 23.65,
  vernier: VERNIER_005,
  steps: [
    {
      id: "zero",
      label: "Confira o zero e encaixe",
      html: "Feche os bicos antes de medir: o <b>zero do nônio</b> tem de coincidir com o zero da escala. Depois abra, encaixe a peça e encoste os bicos sem apertar.",
      why: "Se o zero não coincidir com os bicos fechados, o instrumento tem erro de zero. Anote e desconte em todas as medidas.",
      focus: "zero",
      closed: true,
    },
    {
      id: "whole",
      label: "Leia os milímetros",
      html: "Olhe o zero do nônio. O último traço da escala de cima que ele já passou é o <b>{M}</b>: são <b>{M} mm</b> inteiros.",
      focus: "vernierZero",
      highlight: ["vernierZero"],
    },
    {
      id: "coincident",
      label: "Ache o traço que coincide",
      html: "Procure no nônio o traço que fica <b>alinhado</b> com um traço da escala de cima. Aqui é o traço <b>{n}</b>, {labels}.",
      why: "Os números do nônio marcam décimos de milímetro, mas há um traço a cada 0,05 mm. Conte traços, não números.",
      focus: "coincident",
      highlight: ["coincident"],
    },
    {
      id: "sum",
      label: "Some as partes",
      html: "Cada traço do nônio vale <b>0,05 mm</b>. Some os milímetros inteiros com os traços contados.",
      rule: "{M} + {n} × 0,05 = {L} mm",
      focus: "coincident",
      highlight: ["vernierZero", "coincident"],
    },
    {
      id: "uncertainty",
      label: "Escreva com incerteza",
      html: "A menor divisão do paquímetro é 0,05 mm. A incerteza de leitura é a metade dela, arredondada para um algarismo significativo, porque é uma estimativa.",
      rule: "0,05 mm ÷ 2 = 0,025 mm → 0,03 mm",
      result: "L = ({L} ± 0,03) mm",
      note: "Valor e incerteza terminam na mesma casa decimal. Não complete o valor com zero ({L}0) para acompanhar uma incerteza de dois algarismos: o certo é arredondar a incerteza.",
      why: "Esse é um dos erros mais comuns que o grupo do IFUSP encontrou nos relatórios de Laboratório de Mecânica, ao lado de medidas sem incerteza e excesso de algarismos (Marineli, Oliveira, Guimarães-Filho e Pacca, SNEF 2003).",
      focus: "coincident",
      highlight: ["coincident"],
    },
  ],
  references: [
    "Marineli, F.; Oliveira, M. C.; Guimarães-Filho, Z. O.; Pacca, J. L. A. Uma interpretação para os erros nas representações das medidas realizadas no laboratório didático. XV SNEF, 2003.",
    "Tabacniks, M. H. Conceitos básicos da teoria de erros. IFUSP, revisão 2009.",
  ],
};
