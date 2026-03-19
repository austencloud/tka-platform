/**
 * Canonical difficulty level styles.
 *
 * Both the Svelte UI badges and the canvas image compositor read from here,
 * so the two can never drift apart.
 */

// ── Font ────────────────────────────────────────────────────────────────────
export const DIFFICULTY_FONT_FAMILY = "Cambria, serif";

// ── Badge gradient color stops ──────────────────────────────────────────────
// Each level defines an array of { offset, color } pairs that work for both
// CSS gradients (linear-gradient / radial-gradient) and Canvas gradients.

export interface GradientStop {
  offset: number;
  color: string;
}

export interface DifficultyLevelStyle {
  /** CSS background value for Svelte components */
  cssBg: string;
  /** Gradient stops for canvas rendering */
  stops: GradientStop[];
  /** Border color */
  border: string;
  /** Text color for the level number */
  text: string;
}

const LEVEL_1: DifficultyLevelStyle = {
  cssBg:
    "radial-gradient(ellipse at top left, rgb(224,242,254) 0%, rgb(198,232,253) 30%, rgb(164,218,250) 70%, rgb(130,202,245) 100%)",
  stops: [
    { offset: 0, color: "rgb(224, 242, 254)" },
    { offset: 0.3, color: "rgb(198, 232, 253)" },
    { offset: 0.7, color: "rgb(164, 218, 250)" },
    { offset: 1, color: "rgb(130, 202, 245)" },
  ],
  border: "#000",
  text: "#000",
};

const LEVEL_2: DifficultyLevelStyle = {
  cssBg:
    "linear-gradient(135deg, rgb(170,170,170) 0%, rgb(210,210,210) 15%, rgb(120,120,120) 30%, rgb(180,180,180) 40%, rgb(190,190,190) 55%, rgb(130,130,130) 75%, rgb(110,110,110) 100%)",
  stops: [
    { offset: 0, color: "rgb(170, 170, 170)" },
    { offset: 0.15, color: "rgb(210, 210, 210)" },
    { offset: 0.3, color: "rgb(120, 120, 120)" },
    { offset: 0.4, color: "rgb(180, 180, 180)" },
    { offset: 0.55, color: "rgb(190, 190, 190)" },
    { offset: 0.75, color: "rgb(130, 130, 130)" },
    { offset: 1, color: "rgb(110, 110, 110)" },
  ],
  border: "#000",
  text: "#000",
};

const LEVEL_3: DifficultyLevelStyle = {
  cssBg:
    "radial-gradient(ellipse at top left, rgb(254,240,138) 0%, rgb(253,224,71) 20%, rgb(250,204,21) 40%, rgb(234,179,8) 60%, rgb(202,138,4) 80%, rgb(161,98,7) 100%)",
  stops: [
    { offset: 0, color: "rgb(254, 240, 138)" },
    { offset: 0.2, color: "rgb(253, 224, 71)" },
    { offset: 0.4, color: "rgb(250, 204, 21)" },
    { offset: 0.6, color: "rgb(234, 179, 8)" },
    { offset: 0.8, color: "rgb(202, 138, 4)" },
    { offset: 1, color: "rgb(161, 98, 7)" },
  ],
  border: "#000",
  text: "#000",
};

const LEVEL_4: DifficultyLevelStyle = {
  cssBg:
    "linear-gradient(135deg, rgb(200,162,200) 0%, rgb(170,132,170) 30%, rgb(148,0,211) 60%, rgb(100,0,150) 100%)",
  stops: [
    { offset: 0, color: "rgb(200, 162, 200)" },
    { offset: 0.3, color: "rgb(170, 132, 170)" },
    { offset: 0.6, color: "rgb(148, 0, 211)" },
    { offset: 1, color: "rgb(100, 0, 150)" },
  ],
  border: "#000",
  text: "#000",
};

const LEVEL_5: DifficultyLevelStyle = {
  cssBg:
    "linear-gradient(135deg, rgb(255,90,40) 0%, rgb(255,50,30) 30%, rgb(230,25,15) 60%, rgb(180,10,5) 100%)",
  stops: [
    { offset: 0, color: "rgb(255, 90, 40)" },
    { offset: 0.3, color: "rgb(255, 50, 30)" },
    { offset: 0.6, color: "rgb(230, 25, 15)" },
    { offset: 1, color: "rgb(180, 10, 5)" },
  ],
  border: "#000",
  text: "#000",
};

export const DIFFICULTY_LEVELS: Record<number, DifficultyLevelStyle> = {
  1: LEVEL_1,
  2: LEVEL_2,
  3: LEVEL_3,
  4: LEVEL_4,
  5: LEVEL_5,
};

export const DEFAULT_DIFFICULTY_STYLE = LEVEL_1;

/**
 * Apply gradient stops to a CanvasGradient. Works with both linear and radial
 * gradients — just pass the gradient object you already created.
 */
export function applyGradientStops(
  gradient: CanvasGradient,
  stops: GradientStop[],
): CanvasGradient {
  for (const { offset, color } of stops) {
    gradient.addColorStop(offset, color);
  }
  return gradient;
}
