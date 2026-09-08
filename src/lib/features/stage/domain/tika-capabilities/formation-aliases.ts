import type { TikaDirectorFormation } from "../tika-director-vocabulary";

/** Everyday names for the sixteen formations, keyed by normalized command text. */
export const FORMATION_ALIASES: ReadonlyMap<string, TikaDirectorFormation> =
  new Map([
    ["v", "v-shape"],
    ["vee", "v-shape"],
    ["v shape", "v-shape"],
    ["v-shape", "v-shape"],
    ["v formation", "v-shape"],
    ["chevron", "v-shape"],
    ["wedge", "v-shape"],
    ["arrowhead", "v-shape"],
    ["circle", "circle"],
    ["ring", "circle"],
    ["triangle", "triangle"],
    ["diamond", "diamond"],
    ["2x2", "grid-2x2"],
    ["2x2 grid", "grid-2x2"],
    ["2×2 grid", "grid-2x2"],
    ["two by two", "grid-2x2"],
    ["two by two grid", "grid-2x2"],
    ["grid-2x2", "grid-2x2"],
    ["grid", "grid"],
    ["stagger", "stagger"],
    ["staggered", "stagger"],
    ["staggered line", "stagger"],
    ["cluster", "cluster"],
    ["diagonal", "diagonal"],
    ["diagonal line", "diagonal"],
    ["line", "line"],
    ["row", "line"],
    ["straight line", "line"],
    ["single file", "line"],
    ["tunnel", "tunnel-stack"],
    ["tunnel stack", "tunnel-stack"],
    ["tunnel-stack", "tunnel-stack"],
    ["back to back", "back-to-back"],
    ["back-to-back", "back-to-back"],
    ["facing each other", "facing-each-other"],
    ["facing one another", "facing-each-other"],
    ["facing-each-other", "facing-each-other"],
    ["stage left and right", "stage-lr"],
    ["stage-lr", "stage-lr"],
    ["side by side", "side-by-side"],
    ["side-by-side", "side-by-side"],
    ["solo", "solo"],
  ]);

/** How a formation reads in a sentence back to the user. */
export const FORMATION_LABELS: Readonly<Record<TikaDirectorFormation, string>> =
  {
    line: "line",
    triangle: "triangle",
    diamond: "diamond",
    circle: "circle",
    "v-shape": "V",
    grid: "grid",
    "grid-2x2": "2x2 grid",
    stagger: "staggered line",
    cluster: "cluster",
    diagonal: "diagonal",
    solo: "solo spot",
    "tunnel-stack": "tunnel",
    "back-to-back": "back-to-back pair",
    "facing-each-other": "facing pair",
    "stage-lr": "stage left and right split",
    "side-by-side": "side-by-side pair",
  };

export function formationLabel(formation: TikaDirectorFormation): string {
  return FORMATION_LABELS[formation];
}
