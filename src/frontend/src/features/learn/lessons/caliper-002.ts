/**
 * @module
 * Lesson of the Como medir track: reading a vernier caliper of 0,02 mm.
 *
 * The vernier has 50 divisions over 49 mm, numbered every 5 lines; each line is 0,02 mm and
 * the coinciding line `n` meets the main-scale line `mm + n`. The reading uncertainty, half
 * of 0,02 mm, is 0,01 mm and already has one significant figure. The didactic laboratory of
 * IFUSP uses calipers of 0,02 mm and of 0,05 mm (Física Experimental 1, IFUSP 2011).
 */

import type { MeasureLesson } from "../measure/measure-lesson";
import { VERNIER_002 } from "../measure/reading";

/** The 0,02 mm vernier caliper lesson. */
export const caliper002Lesson: MeasureLesson = {
  id: "caliper-002",
  kind: "instrument",
  track: "measure",
  version: 1,
  instrument: "caliper",
  title: "Paquímetro de 0,02 mm",
  summary: "Ler o nônio de 50 traços: milímetros inteiros, traço que coincide e incerteza.",
  minutes: 8,
  topics: ["0,02 mm", "± 0,01 mm"],
  example: 23.64,
  vernier: VERNIER_002,
  steps: [
    {
      id: "zero",
      label: "Confira o zero e encaixe",
      html: "Feche os bicos antes de medir: o <b>zero do nônio</b> tem de coincidir com o zero da escala. Depois abra, encaixe a peça e encoste os bicos sem apertar.",
      why: "Confira a menor divisão gravada no cursor. O laboratório didático tem paquímetros de 0,02 mm e de 0,05 mm, e o nônio de um não se lê como o do outro.",
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
      why: "Este nônio tem 50 traços em 49 mm. Os números marcam décimos de milímetro a cada 5 traços, e cada traço vale 0,02 mm. Conte traços, não números.",
      focus: "coincident",
      highlight: ["coincident"],
    },
    {
      id: "sum",
      label: "Some as partes",
      html: "Cada traço do nônio vale <b>0,02 mm</b>. Some os milímetros inteiros com os traços contados.",
      rule: "{M} + {n} × 0,02 = {L} mm",
      focus: "coincident",
      highlight: ["vernierZero", "coincident"],
    },
    {
      id: "uncertainty",
      label: "Escreva com incerteza",
      html: "A menor divisão deste paquímetro é 0,02 mm. A incerteza de leitura é a metade dela.",
      rule: "0,02 mm ÷ 2 = 0,01 mm",
      result: "L = ({L} ± 0,01) mm",
      note: "A incerteza já tem um só algarismo significativo, e o valor termina na mesma casa decimal, a dos centésimos.",
      focus: "coincident",
      highlight: ["coincident"],
    },
  ],
  references: [
    "Marineli, F.; Oliveira, M. C.; Guimarães-Filho, Z. O.; Pacca, J. L. A. Uma interpretação para os erros nas representações das medidas realizadas no laboratório didático. XV SNEF, 2003.",
    "Tabacniks, M. H. Conceitos básicos da teoria de erros. IFUSP, revisão 2009.",
    "Pascholati, P. R. (org.). Física Experimental 1. IFUSP, 2011.",
  ],
};
