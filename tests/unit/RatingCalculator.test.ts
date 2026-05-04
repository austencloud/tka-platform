/**
 * RatingCalculator Unit Tests
 *
 * Glicko-2 math earns tests: silent bugs in rating calculations
 * would produce wrong rankings without any visible error.
 */

import { describe, it, expect } from "vitest";
import { computeUpdate, expectedScore, inflatePhi, displayRating } from "../../src/lib/features/arena/services/rating-calculator";

describe("RatingCalculator", () => {
  // Default starting values
  const DEFAULT_MU = 1500;
  const DEFAULT_PHI = 350;
  const DEFAULT_SIGMA = 0.06;

  describe("computeUpdate", () => {
    it("should increase winner rating and decrease loser rating", () => {
      const result = computeUpdate(
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA,
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA
      );

      expect(result.winnerMu).toBeGreaterThan(DEFAULT_MU);
      expect(result.loserMu).toBeLessThan(DEFAULT_MU);
    });

    it("should decrease phi (uncertainty) for both sides after a match", () => {
      const result = computeUpdate(
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA,
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA
      );

      expect(result.winnerPhi).toBeLessThan(DEFAULT_PHI);
      expect(result.loserPhi).toBeLessThan(DEFAULT_PHI);
    });

    it("should produce symmetric changes for equal-rated players", () => {
      const result = computeUpdate(
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA,
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA
      );

      // Winner gains same as loser drops (approximately, Glicko-2 isn't perfectly symmetric)
      const winnerGain = result.winnerMu - DEFAULT_MU;
      const loserLoss = DEFAULT_MU - result.loserMu;
      expect(Math.abs(winnerGain - loserLoss)).toBeLessThan(5);
    });

    it("should give larger update when underdog wins", () => {
      // Underdog (lower mu) beats favorite (higher mu)
      const underdogWins = computeUpdate(
        1300, DEFAULT_PHI, DEFAULT_SIGMA,
        1700, DEFAULT_PHI, DEFAULT_SIGMA
      );

      // Favorite beats underdog (expected outcome)
      const favoriteWins = computeUpdate(
        1700, DEFAULT_PHI, DEFAULT_SIGMA,
        1300, DEFAULT_PHI, DEFAULT_SIGMA
      );

      const underdogGain = underdogWins.winnerMu - 1300;
      const favoriteGain = favoriteWins.winnerMu - 1700;
      expect(underdogGain).toBeGreaterThan(favoriteGain);
    });

    it("should produce smaller updates when phi is low (confident ratings)", () => {
      // High confidence (low phi)
      const confidentResult = computeUpdate(
        DEFAULT_MU, 50, DEFAULT_SIGMA,
        DEFAULT_MU, 50, DEFAULT_SIGMA
      );

      // Low confidence (high phi)
      const uncertainResult = computeUpdate(
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA,
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA
      );

      const confidentChange = Math.abs(confidentResult.winnerMu - DEFAULT_MU);
      const uncertainChange = Math.abs(uncertainResult.winnerMu - DEFAULT_MU);
      expect(confidentChange).toBeLessThan(uncertainChange);
    });

    it("should keep sigma (volatility) positive", () => {
      const result = computeUpdate(
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA,
        DEFAULT_MU, DEFAULT_PHI, DEFAULT_SIGMA
      );

      expect(result.winnerSigma).toBeGreaterThan(0);
      expect(result.loserSigma).toBeGreaterThan(0);
    });

    it("should handle extreme rating differences without NaN", () => {
      const result = computeUpdate(
        2500, 50, DEFAULT_SIGMA,
        500, 50, DEFAULT_SIGMA
      );

      expect(Number.isFinite(result.winnerMu)).toBe(true);
      expect(Number.isFinite(result.loserMu)).toBe(true);
      expect(Number.isFinite(result.winnerPhi)).toBe(true);
      expect(Number.isFinite(result.loserPhi)).toBe(true);
    });
  });

  describe("expectedScore", () => {
    it("should return 0.5 for equal ratings", () => {
      const score = expectedScore(DEFAULT_MU, DEFAULT_PHI, DEFAULT_MU, DEFAULT_PHI);
      expect(score).toBeCloseTo(0.5, 2);
    });

    it("should return > 0.5 when A is higher rated", () => {
      const score = expectedScore(1800, 100, 1200, 100);
      expect(score).toBeGreaterThan(0.5);
    });

    it("should return < 0.5 when A is lower rated", () => {
      const score = expectedScore(1200, 100, 1800, 100);
      expect(score).toBeLessThan(0.5);
    });

    it("should return value in [0, 1]", () => {
      const score = expectedScore(2500, 50, 500, 50);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe("inflatePhi", () => {
    it("should not change phi when 0 days elapsed", () => {
      const result = inflatePhi(100, DEFAULT_SIGMA, 0);
      expect(result).toBe(100);
    });

    it("should increase phi over time", () => {
      const result = inflatePhi(100, DEFAULT_SIGMA, 30);
      expect(result).toBeGreaterThan(100);
    });

    it("should increase more with more days elapsed", () => {
      const result7 = inflatePhi(100, DEFAULT_SIGMA, 7);
      const result30 = inflatePhi(100, DEFAULT_SIGMA, 30);
      expect(result30).toBeGreaterThan(result7);
    });
  });

  describe("displayRating", () => {
    it("should return mu - 2*phi", () => {
      expect(displayRating(1500, 350)).toBe(800);
      expect(displayRating(1500, 100)).toBe(1300);
      expect(displayRating(2000, 50)).toBe(1900);
    });

    it("should be conservative for new players", () => {
      // New player with high uncertainty shows low
      const display = displayRating(DEFAULT_MU, DEFAULT_PHI);
      expect(display).toBe(800);
      expect(display).toBeLessThan(DEFAULT_MU);
    });
  });
});
