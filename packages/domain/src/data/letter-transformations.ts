import type {
  InversionPair,
  CompoundPair,
  CounterpartSubType,
  GammaInternalGroup,
} from "../types/transformation.js";

export const TRANSFORMATION_DESCRIPTION = "Formal relationships between letters used in LOOP generation and polyrhythmic analysis" as const;

/** Pro/Anti motion type swap pairs */
export const INVERSION_PAIRS: InversionPair[] = [
  ["A", "B"],
  ["D", "E"],
  ["G", "H"],
  ["J", "K"],
  ["M", "N"],
  ["P", "Q"],
  ["S", "T"],
  ["U", "V"],
  ["W", "X"],
  ["Y", "Z"],
  ["Σ", "Δ"],
  ["Θ", "Ω"],
] as const;

export const INVERSION_PAIR_DESCRIPTIONS: Record<string, string> = {
  AB: "alpha to alpha prospin vs antispin",
  DE: "beta to alpha isolation vs antispin",
  GH: "beta to beta prospin vs antispin",
  JK: "alpha to beta isolation vs antispin",
  MN: "gamma to gamma isolation vs antispin",
  PQ: "gamma to gamma isolation vs antispin",
  ST: "gamma to gamma quarter-same iso vs antispin",
  UV: "gamma to gamma quarter-same iso vs antispin",
  WX: "gamma to alpha pro vs anti",
  YZ: "gamma to beta pro vs anti",
  "ΣΔ": "alpha to gamma pro vs anti",
  "ΘΩ": "beta to gamma pro vs anti",
} as const;

/** Alpha-to-Beta transition pairs that complete circular motion */
export const COMPOUND_PAIRS: CompoundPair[] = [
  { letters: ["D", "J"], mnemonic: "Disco Jam", rotation: "isolation" },
  { letters: ["E", "K"], mnemonic: "Exploding Kitten", rotation: "antispin" },
  { letters: ["F", "L"], mnemonic: "Fruity Loops", rotation: "hybrid" },
  { letters: ["M", "P"], mnemonic: "Magic Potion", rotation: "isolation" },
  { letters: ["N", "Q"], mnemonic: "Never Quit", rotation: "antispin" },
  { letters: ["O", "R"], mnemonic: "Open Road", rotation: "hybrid" },
  { letters: ["Φ", "Ψ"], mnemonic: null, rotation: "dash" },
] as const;

/** Letters sharing gamma endpoint but swapping alpha vs beta */
export const ALPHA_BETA_COUNTERPARTS: Record<string, CounterpartSubType> = {
  gammaConvergent: {
    description: "Both letters end at gamma, from different origins",
    pairs: [
      { letters: ["Σ", "Θ"], note: "alpha to gamma vs beta to gamma (prospin)" },
      { letters: ["Δ", "Ω"], note: "alpha to gamma vs beta to gamma (antispin)" },
      { letters: ["Σ-", "Θ-"], note: "beta to gamma vs alpha to gamma (prospin)" },
      { letters: ["Δ-", "Ω-"], note: "beta to gamma vs alpha to gamma (antispin)" },
    ],
  },
  gammaDivergent: {
    description: "Both letters start at gamma, to different destinations",
    pairs: [
      { letters: ["W", "Y"], note: "gamma to alpha vs gamma to beta (prospin)" },
      { letters: ["X", "Z"], note: "gamma to alpha vs gamma to beta (antispin)" },
      { letters: ["W-", "Y-"], note: "gamma to alpha vs gamma to beta (prospin)" },
      { letters: ["X-", "Z-"], note: "gamma to alpha vs gamma to beta (antispin)" },
    ],
  },
} as const satisfies Record<string, CounterpartSubType>;

/** Gamma-to-Gamma transitions within the same section */
export const GAMMA_INTERNAL_GROUPS: GammaInternalGroup = {
  description: "Gamma to Gamma transitions within the same section",
  note: "These letters combine freely with each other (all in combines_with)",
  groups: {
    quarterOpp: ["M", "N", "O", "P", "Q", "R"],
    quarterSame: ["S", "T", "U", "V"],
  },
} as const;
