/**
 * @module
 * Lesson "Queda livre com faiscador": the IFUSP "ovinho" falls between two wires and a spark
 * synchronized with the mains marks its position on a waxed paper tape every 1/60 s.
 *
 * The experiment, its parameters and the real results quoted on the guide page come from
 * Guimarães-Filho et al., XVI SNEF (2005). The guide page builds the model from the forces,
 * derives why the mean velocity of an interval belongs to its midpoint, describes the reading
 * of the tape and its uncertainty, shows the systematic errors with their mitigation and ends
 * with the case where the free-fall model stops being enough. Every number quoted is checked
 * by tests/unit/learn-gravity.test.mjs.
 */

import type { GuideFit, Lesson } from "../lesson";
import cover from "./gravity/cover.svg";
import forces from "./gravity/forces.svg";
import reading from "./gravity/reading.svg";
import setup from "./gravity/setup.svg";
import tape from "./gravity/tape.svg";

/**
 * Reference value used to judge compatibility (m/s²): g at the IFUSP teaching labs,
 * measured with a gravimeter by IAG-USP researchers, 9.7864(3) m/s², as quoted by
 * Guimarães-Filho et al., "Aprendendo física com o uso de experimentos de grande precisão
 * em laboratórios didáticos: o estudo da queda de um corpo", XVI SNEF (2005).
 */
export const REFERENCE_G = 9.7864;

/** Free-air gravity gradient (s⁻²): how much g drops per metre of height. */
export const FREE_AIR_GRADIENT = 3.086e-6;

/** Mains frequency (Hz): the spark marks the tape once per cycle. */
export const MAINS_FREQUENCY = 60;

/**
 * The ovinho of SNEF 2005: mass (kg), volume (m³), frontal area (m²), drag coefficient and
 * the mean air density of the experiments (kg/m³).
 */
export const OVINHO = { mass: 0.0843, volume: 41e-6, area: 9.15e-4, drag: 0.45, airDensity: 1.11 };

/**
 * Lengths of the 17 intervals of two cycles read on the tape (mm), from mark 0 to mark 34.
 *
 * Simulated, not measured: the fall of the ovinho with g = 9.7864 m/s², buoyancy and
 * quadratic drag, released 21.3 ms before mark 0. Each length got a Gaussian reading noise of
 * 0.65 mm (seeded) and was rounded to the millimetre; together they make the 0.7 mm stated.
 * The seed is the first whose χ² and fitted acceleration both fall within one standard
 * deviation of what the simulation predicts: a typical tape, not one chosen to match g.
 */
export const INTERVALS_MM = [
  13, 24, 33, 45, 55, 67, 77, 89, 99, 110, 121, 133, 142, 154, 164, 175, 187,
];

/** Uncertainty of every velocity (m/s): 0.7 mm over two cycles of the mains. */
const SV = 0.021;

/**
 * Rows [t, v, σv]: the mean velocity of each interval, at the time of its middle mark,
 * counted from mark 0. Times are rounded to 0.1 ms in the sheet.
 */
const rows: [number, number, number][] = INTERVALS_MM.map((mm, k) => [
  Math.round(((2 * k + 1) / MAINS_FREQUENCY) * 1e4) / 1e4,
  Math.round(((mm * MAINS_FREQUENCY) / 2) * 10) / 1e4,
  SV,
]);

/** Fit of the tape with the model v = v₀ + a·t, both parameters free. */
const tapeFit: GuideFit = {
  equation: "v0 + a*x",
  parameters: [
    { name: "a", value: 9.7831584, uncertainty: Math.sqrt(0.000972808398) },
    { name: "v0", value: 0.20690947, uncertainty: Math.sqrt(0.000104037154) },
  ],
};

/**
 * Fits quoted by the guide page; solved again by the tests.
 *
 * - `fixedV0`: the tape with v₀ = 0 imposed, the systematic error of taking mark 0 as the
 *   release.
 */
export const guideFits = {
  fixedV0: {
    equation: "a*x",
    parameters: [{ name: "a", value: 10.331334, uncertainty: 0.015574505 }],
    chiSquared: 425.09569,
  },
};

/** Free-fall lesson: from the spark tape to the acceleration of the fall. */
export const gravityLesson: Lesson = {
  id: "free-fall-spark-timer",
  kind: "experiment",
  track: "experiments",
  version: 4,
  title: "Queda livre com faiscador",
  summary:
    "O ovinho do IFUSP marca uma fita a cada 1/60 s. Da fita à aceleração de queda, com os erros sistemáticos e o efeito do ar.",
  minutes: 25,
  topics: ["MUV", "ajuste linear", "erros sistemáticos"],
  cover,
  guide: {
    lead: "Antes de abrir o ATUS, entenda de onde vêm os dados e por que o modelo tem a forma que tem. É isso que permite confiar na aceleração que vai sair do ajuste e saber quando desconfiar dela.",
    sections: [
      {
        id: "objetivo",
        title: "O que vamos medir",
        blocks: [
          {
            kind: "text",
            html: "Existem muitas formas de medir a aceleração da gravidade: pêndulo, plano inclinado, cronometragem, vídeo. Aqui usamos o experimento de queda livre do Instituto de Física da USP, o <b>ovinho</b>. Um corpo oval cai entre dois fios ligados a um gerador de alta tensão sincronizado com a rede elétrica. A cada ciclo da rede, uma faísca passa pelo anel metálico do ovinho e queima um ponto numa fita de papel encerado. A fita guarda a posição do corpo a cada 1/60 s.",
          },
          {
            kind: "text",
            html: "O que se mede é a <b>aceleração de queda</b>, <i>a</i>. Ela não é lida em lugar nenhum: sai do ajuste de um modelo aos dados da fita. O modelo de queda livre diz que <i>a</i> = <i>g</i>. Se isso vale, e com que precisão, é o que a lição investiga.",
          },
          {
            kind: "callout",
            tone: "rule",
            title: "Valor de referência: <i>g</i> = 9,7864 ± 0,0003 m/s²",
            html: "Para julgar o resultado, comparamos com a aceleração da gravidade nos laboratórios didáticos do IFUSP, medida com um gravímetro por pesquisadores do IAG-USP (Instituto de Astronomia, Geofísica e Ciências Atmosféricas). É o valor usado nas disciplinas de Física Experimental do IFUSP (Guimarães-Filho et al., SNEF 2005). A incerteza dele é cem vezes menor que a de uma fita, então na comparação ela pode ser desprezada. Em outra cidade, use o valor local: <i>g</i> muda com a latitude e a altitude.",
          },
          {
            kind: "callout",
            tone: "rule",
            title: "Os dados desta lição são simulados",
            html: "As marcas não vieram de uma fita real. Foram calculadas com a física completa da queda (<i>g</i> = 9,7864 m/s², empuxo e resistência do ar), com o ovinho do IFUSP: 84,3 g, 41 cm³, área frontal de 9,15 cm² e coeficiente de arrasto 0,45, os valores do artigo. Cada intervalo recebeu um erro de leitura sorteado e foi arredondado ao milímetro. Por isso todos os números desta página podem ser conferidos. Eles mostram o método, mas não substituem a sua fita.",
          },
          {
            kind: "figure",
            src: setup,
            alt: "Montagem do faiscador: o ovinho cai entre dois fios ligados a um gerador de alta tensão sincronizado com a rede; a cada 1/60 s uma faísca passa pelo anel do ovinho e marca um ponto na fita de papel encerado.",
            caption:
              "A montagem. O tempo vem da rede elétrica, uma faísca por ciclo. A posição fica gravada na fita e é lida depois, com calma, com uma régua.",
          },
        ],
      },
      {
        id: "modelo",
        title: "Do fenômeno ao modelo",
        blocks: [
          {
            kind: "text",
            html: "O modelo não é escolhido: ele é deduzido. O ponto de partida são as forças. Durante a queda, três forças agem sobre o ovinho: o peso, <i>mg</i>, para baixo; o empuxo do ar, <i>E</i> = ρ<sub>ar</sub><i>Vg</i>, para cima; e a resistência do ar, <i>F</i><sub>ar</sub>, contrária ao movimento. Medindo <i>y</i> para baixo, a segunda lei de Newton fica:",
          },
          {
            kind: "equation",
            latex: "m\\,\\frac{dv}{dt} = m\\,g - E - F_{\\text{ar}}",
            note: "<i>v</i> = <i>dy</i>/<i>dt</i> é a velocidade, positiva para baixo.",
          },
          {
            kind: "callout",
            tone: "hypothesis",
            title: "O ar é desprezível",
            html: "Se o empuxo e a resistência do ar forem muito menores que o peso, saem da equação. Essa hipótese não é óbvia: depende do corpo que cai e da precisão que se quer, e precisa ser verificada (próxima seção).",
          },
          {
            kind: "text",
            html: "<b>1. Aceleração.</b> Sem o ar, a massa se cancela e a aceleração de queda é a própria <i>g</i>. Ela é constante: em 2 m de queda, <i>g</i> varia menos de um milionésimo do seu valor, muito abaixo do que a medida consegue ver.",
          },
          { kind: "equation", latex: "\\frac{dv}{dt} = a = g" },
          {
            kind: "text",
            html: "<b>2. Velocidade.</b> Separando as variáveis e integrando de <i>t</i> = 0, quando a velocidade é <i>v</i><sub>0</sub>, até um instante <i>t</i> qualquer:",
          },
          {
            kind: "equation",
            latex:
              "\\int_{v_0}^{v(t)} dv' = \\int_0^{t} a\\,dt' \\quad\\Rightarrow\\quad v(t) - v_0 = a\\,t \\quad\\Rightarrow\\quad v(t) = v_0 + a\\,t",
            note: "As variáveis com apóstrofo são as de integração, para não confundir com os limites.",
          },
          {
            kind: "text",
            html: "<b>3. Posição.</b> A velocidade é a derivada da posição. Integrando de novo, agora a partir de <i>y</i><sub>0</sub>, a posição em <i>t</i> = 0:",
          },
          {
            kind: "equation",
            latex:
              "\\frac{dy}{dt} = v_0 + a\\,t \\quad\\Rightarrow\\quad \\int_{y_0}^{y(t)} dy' = \\int_0^{t} \\left(v_0 + a\\,t'\\right) dt' = v_0\\,t + \\tfrac{1}{2}\\,a\\,t^2",
          },
          {
            kind: "text",
            html: "<b>4. Função horária da posição.</b> O resultado é o movimento uniformemente variado:",
          },
          {
            kind: "equation",
            latex: "y(t) = y_0 + v_0\\,t + \\tfrac{1}{2}\\,a\\,t^2",
          },
          {
            kind: "text",
            html: "<b>5. O que a fita mede.</b> A fita não dá velocidades, dá posições. Entre duas marcas separadas por 2τ, com τ = 1/60 s, o ovinho anda Δ<i>s</i>. Dividindo por 2τ, temos a velocidade média no intervalo, que é a média da velocidade no tempo. Para o movimento uniformemente variado, ela é exatamente a velocidade no instante do meio:",
          },
          {
            kind: "equation",
            latex:
              "\\bar v = \\frac{y(t+\\tau) - y(t-\\tau)}{2\\tau} = \\frac{1}{2\\tau}\\int_{t-\\tau}^{t+\\tau} \\left(v_0 + a\\,t'\\right) dt' = v_0 + a\\,t",
            note: "<i>t</i> é o instante da marca do meio. A aceleração não precisa ser pequena: o resultado é exato porque <i>v</i> é linear em <i>t</i>.",
          },
          {
            kind: "text",
            html: "É por isso que o laboratório faz um gráfico de <i>v</i> por <i>t</i>: com as velocidades médias atribuídas ao meio de cada intervalo, o modelo é uma <b>reta</b>, de inclinação <i>a</i> e intercepto <i>v</i><sub>0</sub>. Cada passo da dedução é uma hipótese que pode falhar: o ar desprezível e <i>g</i> constante (passo 1), e <i>v</i> linear em <i>t</i> (passo 5), que só vale se a aceleração for constante. <i>v</i><sub>0</sub> é a velocidade na marca 0. Como a marca 0 não é a soltura, <i>v</i><sub>0</sub> não é zero, e isso vai importar.",
          },
          {
            kind: "callout",
            tone: "rule",
            title: "Convenções",
            html: "<i>y</i> cresce para baixo. <i>t</i> = 0 é a marca 0, a primeira marca bem separada das vizinhas. No ATUS, a variável do eixo horizontal se chama sempre <i>x</i>, então o modelo fica <code>v0 + a*x</code>.",
          },
        ],
      },
      {
        id: "ar",
        title: "Quando o ar pode ser desprezado",
        blocks: [
          {
            kind: "text",
            html: "O empuxo é constante. Dividido pelo peso, depende só das densidades: <i>E</i>/<i>P</i> = ρ<sub>ar</sub><i>V</i>/<i>m</i>. A resistência do ar, nessa faixa de velocidades, cresce com o quadrado da velocidade. Dividindo pelo peso, vemos quanto ela pesa na dinâmica:",
          },
          {
            kind: "equation",
            latex:
              "F_{\\text{ar}} = \\tfrac{1}{2}\\,\\rho_{\\text{ar}}\\,C_D\\,A\\,v^2 \\quad\\Rightarrow\\quad \\frac{F_{\\text{ar}}}{m\\,g} = \\frac{\\rho_{\\text{ar}}\\,C_D\\,A\\,v^2}{2\\,m\\,g}",
            note: "ρ<sub>ar</sub> = 1,11 kg/m³ é a densidade média do ar nos experimentos, <i>C<sub>D</sub></i> = 0,45 o coeficiente de arrasto e <i>A</i> = 9,15 cm² a área frontal do ovinho (SNEF 2005).",
          },
          {
            kind: "text",
            html: "O pior momento é o fim da fita, onde a velocidade é maior: depois de 1,7 m de queda, <i>v</i> ≈ 5,7 m/s.",
          },
          {
            kind: "table",
            caption: "Empuxo e arrasto comparados ao peso, no fim da fita",
            head: ["Corpo", "Massa", "E / P", "F<sub>ar</sub> / P"],
            rows: [
              ["Ovinho", "84 g", "0,05 %", "0,9 %"],
              ["Ovinho oco, mesma forma", "35 g", "0,13 %", "2,2 %"],
            ],
            align: ["left", "right", "right", "right"],
          },
          {
            kind: "figure",
            src: forces,
            alt: "Forças no fim da fita: no ovinho de 84 g o arrasto é 0,91% do peso e o empuxo 0,05%; no ovinho oco de 35 g, com a mesma forma, as duas razões crescem.",
            caption:
              "Com a mesma forma, o ar empurra os dois do mesmo jeito. O que muda é a massa, que resiste: as duas razões vão com 1/<i>m</i>.",
          },
          {
            kind: "text",
            html: "Simulando a queda do ovinho de 84 g com empuxo e arrasto e ajustando a reta, a aceleração sai 0,033 m/s² (0,34 %) menor que <i>g</i>. É compatível com a estimativa do IFUSP para o mesmo ovinho, 0,035(7) m/s². Uma fita tem incerteza de 0,03 m/s², então o efeito fica em torno de uma incerteza: <b>para uma fita, a hipótese vale.</b> Mas o efeito não some. Quando muitas fitas são juntadas e a incerteza cai, ele aparece, como aconteceu no IFUSP (seção 7).",
          },
        ],
      },
      {
        id: "medida",
        title: "Montagem e medida",
        blocks: [
          {
            kind: "list",
            ordered: true,
            items: [
              "Coloque a fita de papel encerado entre o ovinho e um dos fios, esticada e na vertical, rente ao caminho do anel.",
              "Ligue o gerador e solte o ovinho do alto, sem empurrão.",
              "Retire a fita. Perto da soltura as marcas ficam encavaladas: escolha como marca 0 a primeira bem separada das vizinhas e numere as seguintes.",
              "Meça cada intervalo de duas marcas (0 a 2, 2 a 4, …) separadamente, com o zero da régua sobre a primeira marca.",
              "Calcule <i>v</i> = Δ<i>s</i>/(2/60 s) e atribua essa velocidade ao instante da marca do meio, <i>t</i> = (2<i>k</i> + 1)/60 s.",
            ],
          },
          {
            kind: "figure",
            src: tape,
            alt: "O ovinho cai entre os fios, seis vezes mais lento; a cada 1/60 s uma faísca marca a fita, e cada intervalo de duas marcas vira uma linha da tabela, com Δs, t e v.",
            caption:
              "A queda, seis vezes mais lenta. Cada faísca deixa uma marca; cada intervalo de duas marcas vira uma linha da tabela. O espaço entre as marcas cresce porque a velocidade cresce.",
          },
          {
            kind: "text",
            html: "O tempo vem da rede elétrica, não de um cronômetro, e é muito mais preciso que as posições. Por isso tratamos <i>t</i> como exato e só <i>v</i> tem incerteza. Na planilha, <i>t</i> aparece arredondado a 0,1 ms, um erro mil vezes menor que o que mudaria o resultado.",
          },
        ],
      },
      {
        id: "incerteza",
        title: "Leitura e incerteza",
        blocks: [
          {
            kind: "callout",
            tone: "rule",
            title: "Regra do ATUS: metade da menor divisão",
            html: "A incerteza de uma leitura é a metade da menor divisão do instrumento. Na régua milimetrada, isso dá ± 0,5 mm.",
          },
          {
            kind: "figure",
            src: reading,
            alt: "Leitura de um intervalo: o zero da régua fica sobre a marca 10 e a leitura na marca 12 dá 67 mm; cada uma das duas leituras tem incerteza de 0,5 mm, e o intervalo, 0,7 mm.",
            caption:
              "Medir um intervalo são duas leituras: alinhar o zero com uma marca e ler a outra. Cada uma tem a sua incerteza.",
          },
          {
            kind: "text",
            html: "As duas leituras são independentes, então as incertezas se somam em quadratura: σ<sub>Δ<i>s</i></sub> = √(0,5² + 0,5²) ≈ 0,7 mm. Dividindo por 2/60 s, <b>σ<sub><i>v</i></sub> = 0,021 m/s</b> para todos os pontos. Como cada intervalo é medido separadamente, dois intervalos vizinhos não compartilham leituras e seus erros são independentes, como o ajuste supõe.",
          },
          {
            kind: "text",
            html: "A marca não fica no centro do ovinho, e sim onde a faísca atravessa a fita. Isso não importa: é sempre o mesmo ponto do anel, e o deslocamento constante se cancela na diferença Δ<i>s</i>. Um erro que se cancela pelo próprio método é o melhor tipo de erro sistemático.",
          },
        ],
      },
      {
        id: "sistematicos",
        title: "Erros sistemáticos e como mitigá-los",
        blocks: [
          {
            kind: "text",
            html: "Os 0,021 m/s são uma incerteza aleatória: espalham as velocidades para os dois lados da reta, e o ajuste a reduz quando há mais pontos. Erros sistemáticos são outra coisa. Eles deslocam as medidas sempre no mesmo sentido, não diminuem com mais pontos e muitas vezes não aparecem no χ². Precisam ser previstos na montagem e no modelo.",
          },
          {
            kind: "callout",
            tone: "systematic",
            title: "1. A marca 0 não é a soltura",
            html: "O ovinho é solto antes da marca 0: as primeiras marcas, encavaladas, ficaram de fora. Na marca 0 ele já tem velocidade. Um modelo que supõe <i>v</i><sub>0</sub> = 0, a reta pela origem, obriga o ajuste a compensar essa velocidade inclinando a reta.",
          },
          {
            kind: "plot",
            caption:
              "Os mesmos 17 pontos com os dois modelos. A reta pela origem começa abaixo dos primeiros pontos e termina acima dos últimos: os resíduos têm um padrão.",
            xLabel: "t (s)",
            yLabel: "v (m/s)",
            series: [
              { label: "v₀ = 0 imposto", tone: "muted", rows, fit: guideFits.fixedV0 },
              { label: "v₀ livre", tone: "data", rows, fit: tapeFit },
            ],
          },
          {
            kind: "table",
            caption: "A mesma fita, ajustada com dois modelos",
            head: ["Modelo", "a (m/s²)", "χ²/NGL", "|a − g<sub>ref</sub>| / σ<sub>a</sub>"],
            rows: [
              ["<i>a</i><i>t</i>, com <i>v</i><sub>0</sub> = 0", "10,331 ± 0,016", "27", "35"],
              [
                "<i>v</i><sub>0</sub> + <i>a</i><i>t</i>, <i>v</i><sub>0</sub> livre",
                "9,78 ± 0,03",
                "0,91",
                "0,1",
              ],
            ],
            align: ["left", "right", "right", "right"],
          },
          {
            kind: "text",
            html: "O modelo com <i>v</i><sub>0</sub> = 0 dá uma incerteza duas vezes menor, mas o resultado está a 35 incertezas do valor de referência. Aqui o erro é grande o bastante para o χ² denunciar: χ²/NGL = 27, quando o esperado é perto de 1. <b>Uma incerteza pequena não diz que o resultado está certo.</b> Com um atraso menor, a reta errada passaria perto dos pontos e o χ² poderia não avisar. O que protege é o modelo descrever o procedimento real.",
          },
          {
            kind: "callout",
            tone: "mitigation",
            title: "Deixar <i>v</i><sub>0</sub> livre",
            html: "O próprio ajuste mede o atraso: <i>v</i><sub>0</sub> = 0,207 m/s corresponde a uma soltura <i>v</i><sub>0</sub>/<i>a</i> ≈ 21 ms antes da marca 0, pouco mais de uma marca. O preço é uma incerteza maior em <i>a</i>, porque <i>a</i> e <i>v</i><sub>0</sub> ficam correlacionados (−0,87). É a incerteza honesta da medida.",
          },
          {
            kind: "callout",
            tone: "systematic",
            title: "O mesmo erro, medido de verdade",
            html: "No IFUSP, a queda de bolas do alto do Edifício Oscar Sala (34 m) é cronometrada à mão. Todos começam o cronômetro atrasados, porque só reagem ao ver a bola sair do lançador. Os tempos medidos de dia ficaram cerca de 0,25 s menores que os das filmagens em câmera lenta, e a aceleração calculada a partir do repouso saiu maior que <i>g</i> (Guimarães-Filho et al., SNEF 2023).",
          },
          {
            kind: "callout",
            tone: "systematic",
            title: "2. A escala da régua",
            html: "Uma régua também pode estar errada, e todo Δ<i>s</i> vem dela. No IFUSP, as 53 réguas de acrílico do laboratório didático foram comparadas com um paquímetro de 50 cm: as escalas eram curtas, as leituras saíam longas e a aceleração medida precisava ser multiplicada por 0,99865(14) (lote de 1995) ou 0,99935(14) (lote de 2000). Numa fita, o fator 0,99865 tira 0,013 m/s², menos da metade da incerteza; na média de muitas fitas, faz diferença. As escalas metálicas não mostraram diferença perceptível em 50 cm (Guimarães-Filho et al., SNEF 2005).",
          },
          {
            kind: "callout",
            tone: "mitigation",
            title: "Calibrar e corrigir, mesmo que afaste da referência",
            html: "Use uma escala metálica ou compare a régua com uma escala de referência e corrija o resultado pelo fator encontrado. A correção vale na direção que a calibração mostrar: no IFUSP, ela afastou o resultado de <i>g</i>. Corrigimos o que medimos, não o que esperávamos.",
          },
          {
            kind: "callout",
            tone: "systematic",
            title: "3. A frequência da rede",
            html: "Todo <i>t</i> vem da suposição de que a rede tem 60 Hz. Se ela tivesse 59,9 Hz, cada intervalo duraria 0,17 % mais do que a análise supõe. Com 60 Hz nas contas, os tempos ficam curtos, as velocidades ficam altas e <i>a</i>, que vai com 1/<i>t</i>², sai 0,33 % maior, uma incerteza inteira de uma fita. <b>Mitigação:</b> medir a frequência. No IFUSP, ela foi medida com osciloscópios digitais e era sempre compatível com 60 Hz, com incerteza limitada pelo padrão de tempo dos próprios osciloscópios (SNEF 2005).",
          },
        ],
      },
      {
        id: "modelo-inadequado",
        title: "Quando o modelo não serve",
        blocks: [
          {
            kind: "text",
            html: "“Desprezível” depende da precisão. No IFUSP, cada dupla analisa uma fita do ovinho, e cada dupla obtinha uma aceleração compatível com <i>g</i><sub>IAG</sub>. Mas juntando as fitas de uma turma, e depois as das turmas de 1998 a 2003, a incerteza caiu para 0,02 % e a média ficou a 13 incertezas da referência.",
          },
          {
            kind: "table",
            caption:
              "Experimento do ovinho, IFUSP, turmas de 1998 a 2003 (Guimarães-Filho et al., SNEF 2005)",
            head: ["", "Aceleração (m/s²)"],
            rows: [
              ["Média das turmas, sem correções", "9,7608(19)"],
              ["Corrigida pelos efeitos instrumentais (escala das réguas)", "9,7525(27)"],
              ["Prevista com empuxo e arrasto no modelo", "9,7518(65)"],
              ["<i>g</i><sub>IAG</sub>", "9,7864(3)"],
            ],
            align: ["left", "right"],
          },
          {
            kind: "text",
            html: "Os alunos investigaram as causas, divididos em equipes. A régua e a rede elétrica foram calibradas, e a correção da régua afastou ainda mais o resultado de <i>g</i>. A atração da Lua e do Sol foi descartada. O empuxo reduz a aceleração em 0,0052(4) m/s² e o arrasto em 0,0294(65) m/s². Com as duas forças no modelo, a previsão, 9,7518(65) m/s², é compatível com a medida corrigida, 9,7525(27) m/s². O modelo sem ar não estava errado para uma dupla. Ele ficou insuficiente quando a precisão aumentou.",
          },
          {
            kind: "callout",
            tone: "hypothesis",
            title: "Um teste do modelo melhorado: mudar a massa",
            html: "Se o ar é a causa, um ovinho mais leve, com a mesma forma, deve cair com aceleração menor: as duas forças do ar não dependem da massa, e o peso sim. No modelo de queda livre, a massa não muda nada.",
          },
          {
            kind: "equation",
            latex:
              "a \\approx g - \\frac{\\rho_{\\text{ar}}\\,V\\,g + \\tfrac{1}{2}\\,\\rho_{\\text{ar}}\\,C_D\\,A\\,\\langle v^2\\rangle}{m}",
            note: "⟨<i>v</i>²⟩ é a média de <i>v</i>² ao longo da fita. A aceleração de queda é linear em 1/<i>m</i>, e o intercepto, em 1/<i>m</i> → 0, é <i>g</i>.",
          },
          {
            kind: "table",
            caption: "Aceleração de queda prevista pela simulação desta lição, para a mesma fita",
            head: ["Massa do ovinho", "35 g", "50 g", "70 g", "84 g", "120 g"],
            rows: [["<i>a</i> (m/s²)", "9,706", "9,730", "9,746", "9,753", "9,763"]],
            align: ["left", "right", "right", "right", "right", "right"],
          },
          {
            kind: "text",
            html: "Foi o que o grupo do IFUSP fez depois do semestre, com um ovinho oco de massa ajustável entre 35 e 120 g e cerca de 25 quedas. A aceleração de queda variou linearmente com 1/<i>m</i>, e da reta saíram <i>g</i> e o coeficiente de arrasto, compatíveis com os valores usados (SNEF 2005). <b>Um modelo melhor não só explica o desvio: prevê algo novo, que pode ser testado.</b>",
          },
          {
            kind: "callout",
            tone: "systematic",
            title: "O mesmo problema, em outra queda",
            html: "Na queda do Edifício Oscar Sala, trocar as bolinhas com água pelas bolas de tênis aumentou o tempo de queda medido em cerca de 0,13 s, um desvio-padrão. A solução numérica com arrasto dá 2,72(3) s para a bolinha com água e 2,85(4) s para a bola de tênis: o modelo sem ar não serve, ao menos para a bola de tênis (Guimarães-Filho et al., SNEF 2023).",
          },
          {
            kind: "callout",
            tone: "mitigation",
            title: "Como resolver",
            html: "Para uma fita, use um corpo denso, em que o ar fique abaixo da incerteza, e relate o efeito como limitação. Para uma precisão maior, inclua o ar no modelo, com empuxo e arrasto, e teste o que ele prevê, como a dependência com a massa.",
          },
        ],
      },
      {
        id: "resumo",
        title: "O método, em resumo",
        blocks: [
          {
            kind: "list",
            items: [
              "<b>Modelo:</b> velocidade linear no tempo, <i>v</i>(<i>t</i>) = <i>v</i><sub>0</sub> + <i>a</i><i>t</i>, com as velocidades médias de cada intervalo no instante do meio. Na queda livre, <i>a</i> = <i>g</i>. Vale para uma fita porque, no ovinho, empuxo e arrasto tiram cerca de 0,34 % de <i>a</i>, perto de uma incerteza.",
              "<b>Parâmetros livres:</b> <i>a</i> e <i>v</i><sub>0</sub>. Deixar <i>v</i><sub>0</sub> livre absorve a velocidade que o ovinho já tem na marca 0.",
              "<b>Dados:</b> 17 velocidades, a cada 2/60 s, com σ<sub><i>v</i></sub> = 0,021 m/s, vindas de duas leituras de ± 0,5 mm por intervalo.",
              "<b>Critérios para aceitar o resultado:</b> pontos espalhados dos dois lados da reta, sem padrão; χ²/NGL perto de 1; parâmetros com sentido físico; <i>a</i> compatível com a referência.",
              "<b>Limitações a relatar:</b> a escala da régua, a frequência da rede e o ar, que tira cerca de 0,03 m/s² de <i>a</i> e aparece quando muitas fitas são juntadas.",
            ],
          },
          {
            kind: "text",
            html: "Agora, a análise. Você vai copiar os dados da planilha, colar no ATUS, ajustar o modelo e julgar o resultado com esses critérios.",
          },
        ],
      },
      {
        id: "referencias",
        title: "Referências",
        blocks: [
          {
            kind: "list",
            items: [
              "GUIMARÃES-FILHO, Z. O. et al. Aprendendo física com o uso de experimentos de grande precisão em laboratórios didáticos: o estudo da queda de um corpo. In: XVI Simpósio Nacional de Ensino de Física (SNEF), Rio de Janeiro, 2005.",
              "GUIMARÃES-FILHO, Z. et al. O tempo de queda de objetos lançados do alto de um edifício: um experimento didático do IFUSP. In: XXV Simpósio Nacional de Ensino de Física (SNEF), 2023.",
              "VUOLO, J. H. et al. Apostila de Física Experimental 2. São Paulo: IFUSP, 2004.",
              "VUOLO, J. H. Fundamentos da Teoria de Erros. 2. ed. São Paulo: Edgard Blücher, 1996.",
            ],
          },
        ],
      },
    ],
  },
  dataset: {
    sheetName: "ovinho-fita-simulada.xlsx",
    columns: ["t (s)", "v (m/s)", "σv (m/s)"],
    rows,
  },
  // Weighted least squares on the rows above (checked by tests/unit/learn-gravity.test.mjs).
  fit: {
    equation: tapeFit.equation,
    parameters: tapeFit.parameters,
    covariance: [
      [0.000972808398, -0.000275630953],
      [-0.000275630953, 0.000104037154],
    ],
    chiSquared: 13.593397,
  },
  steps: [
    {
      id: "intro",
      view: "intro",
      label: "O experimento",
      title: "Queda livre com faiscador",
      body: "Do modelo à fita, antes de analisar.",
    },
    {
      id: "copy",
      view: "sheet",
      label: "Copiar da planilha",
      target: "lesson-sheet",
      title: "Selecione as três colunas",
      body: "Arraste de <b>A2</b> até <b>C18</b> (o cabeçalho pode entrar junto) e copie com <kbd>{mod}</kbd>+<kbd>C</kbd>.",
      why: "A terceira coluna é a incerteza de v: duas leituras de 0,5 mm divididas por 2/60 s. O ATUS lê as colunas na ordem x, y, σy.",
      waitFor: "sheet.copied",
    },
    {
      id: "paste",
      view: "analysis",
      label: "Colar no ATUS",
      target: "analysis-canvas",
      title: "Cole com {mod}+B",
      body: "Pressione <kbd>{mod}</kbd>+<kbd>B</kbd>. O ATUS lê a área de transferência e cria um conjunto com as 17 velocidades.",
      why: "Depois, {mod}+1 a {mod}+9 trocam os dados de um conjunto mantendo a equação.",
      waitFor: "dataset.created",
    },
    {
      id: "equation",
      view: "analysis",
      label: "Escrever o modelo",
      target: "fit-equation",
      title: "Escreva o modelo do movimento",
      body: "No campo da função, digite <code>v0 + a*x</code>. No ATUS, <b>x</b> é sempre a variável do eixo horizontal, aqui o tempo. A lição segue assim que o modelo estiver certo.",
      why: "a é a aceleração de queda. v₀ fica livre: a marca 0 não é a soltura.",
      waitFor: "equation.matched",
    },
    {
      id: "fit",
      view: "analysis",
      label: "Executar o ajuste",
      target: "fit-run",
      title: "Execute o ajuste",
      body: "Clique em <b>Executar ajustes</b> ou pressione <kbd>{mod}</kbd>+<kbd>Enter</kbd>.",
      why: "O ATUS ajusta a reta pelos mínimos quadrados, com peso 1/σv² em cada ponto.",
      waitFor: "fit.succeeded",
    },
    {
      id: "result",
      view: "analysis",
      label: "O que o ATUS devolve",
      target: "analysis-results",
      title: "Cada parâmetro vem com sua incerteza",
      body: "A reta passa pelos pontos e o cartão mostra os parâmetros arredondados pela incerteza. O que buscamos é <b>a = 9,78 ± 0,03 m/s²</b>, uma incerteza relativa de 0,3 %. Clique em <b>Ver detalhes</b> para o relatório completo.",
      why: "O número de casas decimais vem da incerteza, não do gosto.",
      waitFor: "details.opened",
      focus: "fit-details",
    },
    {
      id: "copy-params",
      view: "analysis",
      label: "Copiar parâmetros",
      target: "copy-parameters",
      title: "O relatório completo",
      body: "Aqui estão χ², graus de liberdade, resíduos e as matrizes de correlação e covariância, onde aparece a correlação de −0,87 entre a e v₀. <b>Copiar parâmetros</b> copia nome, valor e incerteza, para colar numa planilha ou no relatório.",
      waitFor: "params.copied",
      revertOn: "details.closed",
    },
    {
      id: "close-details",
      view: "analysis",
      label: "Voltar ao gráfico",
      target: "fit-details-dialog",
      title: "Volte ao gráfico",
      body: "Feche os detalhes em <b>Fechar</b> ou com <b>Esc</b>.",
      waitFor: "details.closed",
    },
    {
      id: "interpret",
      view: "analysis",
      label: "Julgar o resultado",
      target: "analysis-chart",
      title: "O resultado passa nos critérios?",
      body: "<b>1.</b> Os pontos ficam dos dois lados da reta, sem padrão. <b>2.</b> χ²/NGL = 0,91, dentro do esperado para NGL = 15 (1 ± 0,37). <b>3.</b> |a − 9,7864| / 0,03 = 0,1: compatível com a referência.",
      why: "v₀ = 0,207 ± 0,010 m/s: a soltura foi 21 ms antes da marca 0, o que as marcas encavaladas confirmam. O ar tira 0,03 m/s², uma incerteza: uma fita sozinha não o vê.",
    },
    {
      id: "export",
      view: "analysis",
      label: "Exportar o gráfico",
      target: "chart-export",
      title: "Exporte o gráfico",
      body: "O botão principal copia a imagem do gráfico; a seta ao lado salva PNG ou JPEG.",
      why: "Títulos dos eixos e cores das séries se editam na aba Personalização.",
      waitFor: "chart.exported",
    },
    {
      id: "done",
      view: "analysis",
      label: "Concluir",
      target: "analysis-chart",
      title: "Lição concluída",
      body: "Você obteve a = (9,78 ± 0,03) m/s² de uma fita simulada, verificou que o modelo se sustenta e levou o resultado para o relatório. Não esqueça as limitações: a escala da régua, a frequência da rede e o ar.",
    },
  ],
};
