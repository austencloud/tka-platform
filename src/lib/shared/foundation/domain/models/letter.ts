import { LetterType } from "./letter-type";

/**
 * Letter Enum - all TKA letters
 */
export enum Letter {
  // Type1: Dual-Shift (A-V, 22 letters)
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  E = "E",
  F = "F",
  G = "G",
  H = "H",
  I = "I",
  J = "J",
  K = "K",
  L = "L",
  M = "M",
  N = "N",
  O = "O",
  P = "P",
  Q = "Q",
  R = "R",
  S = "S",
  T = "T",
  U = "U",
  V = "V",

  // Type2: Shift (8 letters including Greek)
  W = "W",
  X = "X",
  Y = "Y",
  Z = "Z",
  SIGMA = "Σ",
  DELTA = "Δ",
  THETA = "Θ",
  OMEGA = "Ω",
  MU = "μ",
  NU = "ν",

  // Type3: Cross-Shift (8 cross variants)
  W_DASH = "W-",
  X_DASH = "X-",
  Y_DASH = "Y-",
  Z_DASH = "Z-",
  SIGMA_DASH = "Σ-",
  DELTA_DASH = "Δ-",
  THETA_DASH = "Θ-",
  OMEGA_DASH = "Ω-",

  // Type4: Dash (4 Greek dash letters - one dashes, one static)
  PHI = "Φ",
  PSI = "Ψ",
  LAMBDA = "Λ",
  TAU_DASH = "τ-",

  // Type5: Dual-Dash (3 dual dash variants)
  PHI_DASH = "Φ-",
  PSI_DASH = "Ψ-",
  LAMBDA_DASH = "Λ-",

  // Type6: Static (lowercase Greek letters for static positions)
  ALPHA = "α",
  BETA = "β",
  GAMMA = "γ",
  ZETA = "ζ",
  ETA = "η",
  TAU = "τ",
  TERRA = "⊕",
}
/**
 * Get the LetterType for any letter enum value
 */
export function getLetterType(letter: Letter): LetterType {
  // Type1: Dual-Shift (A-V)
  if (
    [
      Letter.A,
      Letter.B,
      Letter.C,
      Letter.D,
      Letter.E,
      Letter.F,
      Letter.G,
      Letter.H,
      Letter.I,
      Letter.J,
      Letter.K,
      Letter.L,
      Letter.M,
      Letter.N,
      Letter.O,
      Letter.P,
      Letter.Q,
      Letter.R,
      Letter.S,
      Letter.T,
      Letter.U,
      Letter.V,
    ].includes(letter)
  ) {
    return LetterType.TYPE1;
  }

  // Type2: Shift (including Mu, Nu)
  if (
    [
      Letter.W,
      Letter.X,
      Letter.Y,
      Letter.Z,
      Letter.SIGMA,
      Letter.DELTA,
      Letter.THETA,
      Letter.OMEGA,
      Letter.MU,
      Letter.NU,
    ].includes(letter)
  ) {
    return LetterType.TYPE2;
  }

  // Type3: Cross-Shift
  if (
    [
      Letter.W_DASH,
      Letter.X_DASH,
      Letter.Y_DASH,
      Letter.Z_DASH,
      Letter.SIGMA_DASH,
      Letter.DELTA_DASH,
      Letter.THETA_DASH,
      Letter.OMEGA_DASH,
    ].includes(letter)
  ) {
    return LetterType.TYPE3;
  }

  // Type4: Dash (one dashes, one static)
  if ([Letter.PHI, Letter.PSI, Letter.LAMBDA, Letter.TAU_DASH].includes(letter)) {
    return LetterType.TYPE4;
  }

  // Type5: Dual-Dash
  if ([Letter.PHI_DASH, Letter.PSI_DASH, Letter.LAMBDA_DASH].includes(letter)) {
    return LetterType.TYPE5;
  }

  // Type6: Static (α, β, γ, ζ, η, τ, ⊕)
  if (
    [
      Letter.ALPHA,
      Letter.BETA,
      Letter.GAMMA,
      Letter.ZETA,
      Letter.ETA,
      Letter.TAU,
      Letter.TERRA,
    ].includes(letter)
  ) {
    return LetterType.TYPE6;
  }

  throw new Error(`Unknown letter: ${letter}`);
}
