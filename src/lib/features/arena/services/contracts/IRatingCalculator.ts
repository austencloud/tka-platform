/**
 * IRatingCalculator
 *
 * Pure Glicko-2 math. Stateless. Takes two ratings and an outcome,
 * returns updated rating parameters for both sides.
 */

import type { RatingUpdate } from "../../domain/models/arena-models";

export interface IRatingCalculator {
  /**
   * Compute updated Glicko-2 parameters after a single match.
   * Winner scored 1.0, loser scored 0.0.
   */
  computeUpdate(
    winnerMu: number,
    winnerPhi: number,
    winnerSigma: number,
    loserMu: number,
    loserPhi: number,
    loserSigma: number
  ): RatingUpdate;

  /**
   * Expected score of player A against player B.
   * Returns a value in [0, 1].
   */
  expectedScore(muA: number, phiA: number, muB: number, phiB: number): number;

  /**
   * Inflate rating deviation based on elapsed time (days).
   * Models uncertainty growing when a player is inactive.
   */
  inflatePhi(phi: number, sigma: number, daysSinceLastMatch: number): number;

  /**
   * Conservative display rating: mu - 2*phi.
   * New entries start at the bottom and climb as uncertainty drops.
   */
  displayRating(mu: number, phi: number): number;
}
