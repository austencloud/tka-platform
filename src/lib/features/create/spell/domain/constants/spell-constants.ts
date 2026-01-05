/**
 * Spell Tab Constants
 *
 * Constants for the word-to-sequence generation feature.
 */

import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { LetterAlias, SpellPreferences } from "../models/spell-models";

/**
 * Maximum word length for MVP
 */
export const MAX_WORD_LENGTH = 10;

/**
 * Default preferences for spell generation
 */
export const DEFAULT_SPELL_PREFERENCES: SpellPreferences = {
  minimizeReversals: true,
  preferContinuous: true,
  favorMotionType: null,
  makeCircular: false,
  selectedLOOPType: null, // null = show options after generation
};

/**
 * Aliases for Greek letters - allows users to type text and get the symbol
 * Case-insensitive matching is applied during parsing
 */
export const GREEK_LETTER_ALIASES: LetterAlias[] = [
  // Sigma variants
  { alias: "sigma", letter: Letter.SIGMA },
  { alias: "sig", letter: Letter.SIGMA },
  { alias: "sigma-", letter: Letter.SIGMA_DASH },
  { alias: "sig-", letter: Letter.SIGMA_DASH },

  // Delta variants
  { alias: "delta", letter: Letter.DELTA },
  { alias: "del", letter: Letter.DELTA },
  { alias: "delta-", letter: Letter.DELTA_DASH },
  { alias: "del-", letter: Letter.DELTA_DASH },

  // Theta variants
  { alias: "theta", letter: Letter.THETA },
  { alias: "the", letter: Letter.THETA },
  { alias: "theta-", letter: Letter.THETA_DASH },
  { alias: "the-", letter: Letter.THETA_DASH },

  // Omega variants
  { alias: "omega", letter: Letter.OMEGA },
  { alias: "ome", letter: Letter.OMEGA },
  { alias: "omega-", letter: Letter.OMEGA_DASH },
  { alias: "ome-", letter: Letter.OMEGA_DASH },

  // Phi variants
  { alias: "phi", letter: Letter.PHI },
  { alias: "phi-", letter: Letter.PHI_DASH },

  // Psi variants
  { alias: "psi", letter: Letter.PSI },
  { alias: "psi-", letter: Letter.PSI_DASH },

  // Lambda variants
  { alias: "lambda", letter: Letter.LAMBDA },
  { alias: "lam", letter: Letter.LAMBDA },
  { alias: "lambda-", letter: Letter.LAMBDA_DASH },
  { alias: "lam-", letter: Letter.LAMBDA_DASH },

  // Lowercase Greek (static positions)
  { alias: "alpha", letter: Letter.ALPHA },
  { alias: "alp", letter: Letter.ALPHA },
  { alias: "beta", letter: Letter.BETA },
  { alias: "bet", letter: Letter.BETA },
  { alias: "gamma", letter: Letter.GAMMA },
  { alias: "gam", letter: Letter.GAMMA },
];

/**
 * All Greek letters that can be inserted via the palette
 * Organized by category for UI display
 */
export const GREEK_LETTER_PALETTE = {
  shift: [Letter.SIGMA, Letter.DELTA, Letter.THETA, Letter.OMEGA] as Letter[],
  crossShift: [
    Letter.SIGMA_DASH,
    Letter.DELTA_DASH,
    Letter.THETA_DASH,
    Letter.OMEGA_DASH,
  ] as Letter[],
  dash: [Letter.PHI, Letter.PSI, Letter.LAMBDA] as Letter[],
  dualDash: [Letter.PHI_DASH, Letter.PSI_DASH, Letter.LAMBDA_DASH] as Letter[],
  static: [Letter.ALPHA, Letter.BETA, Letter.GAMMA] as Letter[],
};

/**
 * Display labels for Greek letters in the UI
 */
export const GREEK_LETTER_DISPLAY: Record<string, string> = {
  [Letter.SIGMA]: "Σ",
  [Letter.DELTA]: "Δ",
  [Letter.THETA]: "θ",
  [Letter.OMEGA]: "Ω",
  [Letter.SIGMA_DASH]: "Σ-",
  [Letter.DELTA_DASH]: "Δ-",
  [Letter.THETA_DASH]: "θ-",
  [Letter.OMEGA_DASH]: "Ω-",
  [Letter.PHI]: "Φ",
  [Letter.PSI]: "Ψ",
  [Letter.LAMBDA]: "Λ",
  [Letter.PHI_DASH]: "Φ-",
  [Letter.PSI_DASH]: "Ψ-",
  [Letter.LAMBDA_DASH]: "Λ-",
  [Letter.ALPHA]: "α",
  [Letter.BETA]: "β",
  [Letter.GAMMA]: "γ",
};

/**
 * Letters that can serve as "bridge" letters to transition between position groups
 * These are letters that start in one position group and end in another
 */
export const BRIDGE_LETTER_CANDIDATES = {
  // From alpha to beta
  alphaToBeta: [Letter.J, Letter.K, Letter.L, Letter.PSI] as Letter[],
  // From alpha to gamma
  alphaToGamma: [Letter.SIGMA, Letter.DELTA] as Letter[],
  // From beta to alpha
  betaToAlpha: [Letter.D, Letter.E, Letter.F, Letter.PHI] as Letter[],
  // From beta to gamma
  betaToGamma: [Letter.SIGMA_DASH, Letter.DELTA_DASH] as Letter[],
  // From gamma to alpha
  gammaToAlpha: [Letter.W, Letter.X, Letter.W_DASH, Letter.X_DASH] as Letter[],
  // From gamma to beta
  gammaToBeta: [Letter.Y, Letter.Z, Letter.Y_DASH, Letter.Z_DASH] as Letter[],
};
