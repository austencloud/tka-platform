// src/lib/features/lab/pronunciation-recorder/domain/letter-syllables.ts
import { Letter } from "$lib/shared/foundation/domain/models/letter";

/**
 * Syllables in each letter's spoken name, as `getLetterPronunciation` produces
 * it. Written out rather than derived: no rule turns "W" into three syllables
 * and "Psi" into one, and a wrong count does not fail loudly — it makes the
 * session re-queue a perfectly good read until the word retires.
 */
const SYLLABLES: Record<string, number> = {
  [Letter.A]: 1, [Letter.B]: 1, [Letter.C]: 1, [Letter.D]: 1, [Letter.E]: 1,
  [Letter.F]: 1, [Letter.G]: 1, [Letter.H]: 1, [Letter.I]: 1, [Letter.J]: 1,
  [Letter.K]: 1, [Letter.L]: 1, [Letter.M]: 1, [Letter.N]: 1, [Letter.O]: 1,
  [Letter.P]: 1, [Letter.Q]: 1, [Letter.R]: 1, [Letter.S]: 1, [Letter.T]: 1,
  [Letter.U]: 1, [Letter.V]: 1,

  [Letter.W]: 3, [Letter.X]: 1, [Letter.Y]: 1, [Letter.Z]: 1,
  [Letter.SIGMA]: 2, [Letter.DELTA]: 2, [Letter.THETA]: 2, [Letter.OMEGA]: 3,
  [Letter.MU]: 1, [Letter.NU]: 1,

  [Letter.W_DASH]: 4, [Letter.X_DASH]: 2, [Letter.Y_DASH]: 2, [Letter.Z_DASH]: 2,
  [Letter.SIGMA_DASH]: 3, [Letter.DELTA_DASH]: 3, [Letter.THETA_DASH]: 3,
  [Letter.OMEGA_DASH]: 4,

  [Letter.PHI]: 1, [Letter.PSI]: 1, [Letter.LAMBDA]: 2, [Letter.TAU_DASH]: 2,

  [Letter.PHI_DASH]: 2, [Letter.PSI_DASH]: 2, [Letter.LAMBDA_DASH]: 3,

  [Letter.ALPHA]: 2, [Letter.BETA]: 2, [Letter.GAMMA]: 2, [Letter.ZETA]: 2,
  [Letter.ETA]: 2, [Letter.TAU]: 1, [Letter.TERRA]: 2,
};

export function syllablesOf(letter: string): number {
  return SYLLABLES[letter] ?? 0;
}

export function syllablesInWord(letters: readonly string[]): number {
  return letters.reduce((total, letter) => total + syllablesOf(letter), 0);
}
