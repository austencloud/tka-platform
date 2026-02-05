import { LetterType } from "./LetterType";

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
  SIGMA = "\u03A3",
  DELTA = "\u0394",
  THETA = "\u0398",
  OMEGA = "\u03A9",
  MU = "\u03BC",
  NU = "\u03BD",

  // Type3: Cross-Shift (8 cross variants)
  W_DASH = "W-",
  X_DASH = "X-",
  Y_DASH = "Y-",
  Z_DASH = "Z-",
  SIGMA_DASH = "\u03A3-",
  DELTA_DASH = "\u0394-",
  THETA_DASH = "\u0398-",
  OMEGA_DASH = "\u03A9-",

  // Type4: Dash (3 Greek dash letters)
  PHI = "\u03A6",
  PSI = "\u03A8",
  LAMBDA = "\u039B",

  // Type5: Dual-Dash (3 dual dash variants)
  PHI_DASH = "\u03A6-",
  PSI_DASH = "\u03A8-",
  LAMBDA_DASH = "\u039B-",

  // Type6: Static (lowercase Greek letters for static positions)
  ALPHA = "\u03B1",
  BETA = "\u03B2",
  GAMMA = "\u03B3",
  ZETA = "\u03B6",
  ETA = "\u03B7",
  TAU = "\u03C4",
  TERRA = "\u2295",
}

export function getLetterType(letter: Letter): LetterType {
  if (
    [
      Letter.A, Letter.B, Letter.C, Letter.D, Letter.E, Letter.F,
      Letter.G, Letter.H, Letter.I, Letter.J, Letter.K, Letter.L,
      Letter.M, Letter.N, Letter.O, Letter.P, Letter.Q, Letter.R,
      Letter.S, Letter.T, Letter.U, Letter.V,
    ].includes(letter)
  ) {
    return LetterType.TYPE1;
  }

  if (
    [
      Letter.W, Letter.X, Letter.Y, Letter.Z,
      Letter.SIGMA, Letter.DELTA, Letter.THETA, Letter.OMEGA,
      Letter.MU, Letter.NU,
    ].includes(letter)
  ) {
    return LetterType.TYPE2;
  }

  if (
    [
      Letter.W_DASH, Letter.X_DASH, Letter.Y_DASH, Letter.Z_DASH,
      Letter.SIGMA_DASH, Letter.DELTA_DASH, Letter.THETA_DASH, Letter.OMEGA_DASH,
    ].includes(letter)
  ) {
    return LetterType.TYPE3;
  }

  if ([Letter.PHI, Letter.PSI, Letter.LAMBDA].includes(letter)) {
    return LetterType.TYPE4;
  }

  if ([Letter.PHI_DASH, Letter.PSI_DASH, Letter.LAMBDA_DASH].includes(letter)) {
    return LetterType.TYPE5;
  }

  if (
    [
      Letter.ALPHA, Letter.BETA, Letter.GAMMA,
      Letter.ZETA, Letter.ETA, Letter.TAU, Letter.TERRA,
    ].includes(letter)
  ) {
    return LetterType.TYPE6;
  }

  throw new Error(`Unknown letter: ${letter}`);
}
