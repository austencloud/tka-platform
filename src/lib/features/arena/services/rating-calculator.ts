/**
 * RatingCalculator
 *
 * Glicko-2 implementation per Mark Glickman's paper:
 * "Example of the Glicko-2 System" (2013)
 *
 * All math operates on the Glicko-2 internal scale (mu, phi)
 * where the Glicko-1 rating r maps to mu = (r - 1500) / 173.7178
 * and RD maps to phi = RD / 173.7178.
 *
 * We store ratings on the Glicko-1 scale (1500 center, ~350 RD)
 * and convert internally.
 */

import type { RatingUpdate } from "../domain/models/arena-models";
import {
  GLICKO2_TAU,
  GLICKO2_EPSILON,
} from "../domain/constants/arena-constants";

const SCALE = 173.7178;

export function computeUpdate(
  winnerMu: number,
  winnerPhi: number,
  winnerSigma: number,
  loserMu: number,
  loserPhi: number,
  loserSigma: number
): RatingUpdate {
  // Update winner (score = 1.0)
  const winnerResult = updateSingle(
    winnerMu,
    winnerPhi,
    winnerSigma,
    loserMu,
    loserPhi,
    1.0
  );

  // Update loser (score = 0.0)
  const loserResult = updateSingle(
    loserMu,
    loserPhi,
    loserSigma,
    winnerMu,
    winnerPhi,
    0.0
  );

  return {
    winnerMu: winnerResult.mu,
    winnerPhi: winnerResult.phi,
    winnerSigma: winnerResult.sigma,
    loserMu: loserResult.mu,
    loserPhi: loserResult.phi,
    loserSigma: loserResult.sigma,
  };
}

export function expectedScore(
  muA: number,
  phiA: number,
  muB: number,
  phiB: number
): number {
  // Convert to Glicko-2 scale
  const mu2A = (muA - 1500) / SCALE;
  const mu2B = (muB - 1500) / SCALE;
  const phi2B = phiB / SCALE;

  return E(mu2A, mu2B, phi2B);
}

export function inflatePhi(phi: number, sigma: number, daysSinceLastMatch: number): number {
  if (daysSinceLastMatch <= 0) return phi;
  const phi2 = phi / SCALE;
  const inflated = Math.sqrt(phi2 * phi2 + sigma * sigma * daysSinceLastMatch);
  return inflated * SCALE;
}

export function displayRating(mu: number, phi: number): number {
  return Math.round(mu - 2 * phi);
}

// Glicko-2 internals

/**
 * Update a single player's rating after one game against one opponent.
 * All inputs/outputs on Glicko-1 scale.
 */
function updateSingle(
  myMu: number,
  myPhi: number,
  mySigma: number,
  oppMu: number,
  oppPhi: number,
  score: number
): { mu: number; phi: number; sigma: number } {
  // Step 1: Convert to Glicko-2 scale
  const mu = (myMu - 1500) / SCALE;
  const phi = myPhi / SCALE;
  const muOpp = (oppMu - 1500) / SCALE;
  const phiOpp = oppPhi / SCALE;

  // Step 2: Compute variance (v) and delta
  const gOpp = g(phiOpp);
  const eVal = E(mu, muOpp, phiOpp);
  const v = 1 / (gOpp * gOpp * eVal * (1 - eVal));
  const delta = v * gOpp * (score - eVal);

  // Step 3: Determine new volatility (sigma')
  const newSigma = computeNewSigma(phi, v, delta, mySigma);

  // Step 4: Update phi using new sigma
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

  // Step 5: Compute new phi and mu
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gOpp * (score - eVal);

  // Convert back to Glicko-1 scale
  return {
    mu: newMu * SCALE + 1500,
    phi: newPhi * SCALE,
    sigma: newSigma,
  };
}

/** Glicko-2 g function: reduces opponent's impact based on their uncertainty */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** Expected score function */
function E(mu: number, muOpp: number, phiOpp: number): number {
  return 1 / (1 + Math.exp(-g(phiOpp) * (mu - muOpp)));
}

/**
 * Compute new volatility using the Illinois algorithm (Glickman's Step 5).
 * This is an iterative root-finding on the volatility function.
 */
function computeNewSigma(
  phi: number,
  v: number,
  delta: number,
  sigma: number
): number {
  const tau = GLICKO2_TAU;
  const a = Math.log(sigma * sigma);
  const phiSq = phi * phi;
  const deltaSq = delta * delta;

  // f(x) from Glickman's paper
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const num1 = ex * (deltaSq - phiSq - v - ex);
    const den1 = 2 * (phiSq + v + ex) * (phiSq + v + ex);
    return num1 / den1 - (x - a) / (tau * tau);
  };

  // Initialize bounds A and B
  let A = a;
  let B: number;

  if (deltaSq > phiSq + v) {
    B = Math.log(deltaSq - phiSq - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) {
      k++;
    }
    B = a - k * tau;
  }

  // Illinois algorithm iteration
  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > GLICKO2_EPSILON) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }

    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}
