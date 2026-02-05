/**
 * DimensionCalculationService Tests
 *
 * HIGH VALUE TESTS (9/10) - Critical infrastructure that prevents:
 * - Memory crashes from invalid dimensions
 * - Broken UI from incorrect size calculations
 * - Export failures from dimension validation errors
 *
 * This service handles all dimension calculations for image rendering and export.
 * Wrong calculations = broken rendering, memory issues, or invalid exports.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { SequenceExportOptions } from "../../../src/lib/shared/render/domain/models/SequenceExportOptions";
import { DimensionCalculationService } from "../../../src/lib/shared/render/services/implementations/DimensionCalculationService";

describe("DimensionCalculationService", () => {
  let service: DimensionCalculationService;
  let baseOptions: SequenceExportOptions;

  beforeEach(() => {
    service = new DimensionCalculationService();

    // Create base options matching desktop defaults
    baseOptions = {
      includeStartPosition: true,
      addBeatNumbers: true,
      addReversalSymbols: true,
      addUserInfo: true,
      addWord: true,
      combinedGrids: false,
      addDifficultyLevel: false,
      beatScale: 1.0,
      beatSize: 144,
      margin: 50,
      redVisible: true,
      blueVisible: true,
      userName: "Test User",
      exportDate: "1-1-2024",
      notes: "Test Notes",
      format: "PNG",
      quality: 1.0,
      scale: 1.0,
    };
  });

  // ============================================================================
  // ADDITIONAL HEIGHTS CALCULATION (Core Desktop Compatibility)
  // ============================================================================

  describe("determineAdditionalHeights - Desktop Compatibility", () => {
    it("should calculate heights for 0 beats (no word area)", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        0,
        1.0
      );

      expect(top).toBe(0); // No word area for 0 beats
      expect(bottom).toBe(55); // User info area
    });

    it("should calculate heights for 1 beat", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        1,
        1.0
      );

      expect(top).toBe(150); // Word area for 1 beat
      expect(bottom).toBe(55); // User info area
    });

    it("should calculate heights for 2 beats", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        2,
        1.0
      );

      expect(top).toBe(200); // Word area for 2 beats
      expect(bottom).toBe(75); // User info area
    });

    it("should calculate heights for 3+ beats", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        3,
        1.0
      );

      expect(top).toBe(300); // Word area for 3+ beats
      expect(bottom).toBe(150); // User info area

      // Verify same for higher beat counts
      const [top10, bottom10] = service.determineAdditionalHeights(
        baseOptions,
        10,
        1.0
      );
      expect(top10).toBe(300);
      expect(bottom10).toBe(150);
    });

    it("should respect addWord option", () => {
      const noWordOptions = { ...baseOptions, addWord: false };

      const [top0, bottom0] = service.determineAdditionalHeights(
        noWordOptions,
        0,
        1.0
      );
      expect(top0).toBe(0);

      const [top1, bottom1] = service.determineAdditionalHeights(
        noWordOptions,
        1,
        1.0
      );
      expect(top1).toBe(0);

      const [top3, bottom3] = service.determineAdditionalHeights(
        noWordOptions,
        3,
        1.0
      );
      expect(top3).toBe(0);
    });

    it("should respect addUserInfo option", () => {
      const noUserInfoOptions = { ...baseOptions, addUserInfo: false };

      const [top0, bottom0] = service.determineAdditionalHeights(
        noUserInfoOptions,
        0,
        1.0
      );
      expect(bottom0).toBe(0);

      const [top1, bottom1] = service.determineAdditionalHeights(
        noUserInfoOptions,
        1,
        1.0
      );
      expect(bottom1).toBe(0);

      const [top3, bottom3] = service.determineAdditionalHeights(
        noUserInfoOptions,
        3,
        1.0
      );
      expect(bottom3).toBe(0);
    });

    it("should apply beat scale correctly", () => {
      const scale2x = 2.0;
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        3,
        scale2x
      );

      // 300 * 2.0 = 600, floor(600) = 600
      expect(top).toBe(600);
      // 150 * 2.0 = 300, floor(300) = 300
      expect(bottom).toBe(300);
    });

    it("should floor scaled values", () => {
      const scale = 1.5;
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        3,
        scale
      );

      // 300 * 1.5 = 450, floor(450) = 450
      expect(top).toBe(450);
      // 150 * 1.5 = 225, floor(225) = 225
      expect(bottom).toBe(225);
    });
  });

  // ============================================================================
  // SCALED SIZE CALCULATIONS
  // ============================================================================

  describe("calculateScaledBeatSize", () => {
    it("should calculate scaled beat size correctly", () => {
      expect(service.calculateScaledBeatSize(144, 1.0)).toBe(144);
      expect(service.calculateScaledBeatSize(144, 2.0)).toBe(288);
      expect(service.calculateScaledBeatSize(144, 0.5)).toBe(72);
    });

    it("should floor scaled values", () => {
      expect(service.calculateScaledBeatSize(100, 1.5)).toBe(150);
      expect(service.calculateScaledBeatSize(100, 1.33)).toBe(133);
    });

    it("should throw error for invalid base size", () => {
      expect(() => service.calculateScaledBeatSize(0, 1.0)).toThrow(
        "Invalid size parameters"
      );
      expect(() => service.calculateScaledBeatSize(-10, 1.0)).toThrow(
        "Invalid size parameters"
      );
    });

    it("should throw error for invalid scale", () => {
      expect(() => service.calculateScaledBeatSize(144, 0)).toThrow(
        "Invalid size parameters"
      );
      expect(() => service.calculateScaledBeatSize(144, -1)).toThrow(
        "Invalid size parameters"
      );
    });
  });

  describe("calculateScaledMargin", () => {
    it("should calculate scaled margin correctly", () => {
      expect(service.calculateScaledMargin(50, 1.0)).toBe(50);
      expect(service.calculateScaledMargin(50, 2.0)).toBe(100);
      expect(service.calculateScaledMargin(50, 0.5)).toBe(25);
    });

    it("should floor scaled values", () => {
      expect(service.calculateScaledMargin(50, 1.5)).toBe(75);
      expect(service.calculateScaledMargin(50, 1.33)).toBe(66);
    });

    it("should allow zero margin", () => {
      expect(service.calculateScaledMargin(0, 1.0)).toBe(0);
    });

    it("should throw error for negative margin", () => {
      expect(() => service.calculateScaledMargin(-10, 1.0)).toThrow(
        "Invalid margin parameters"
      );
    });

    it("should throw error for invalid scale", () => {
      expect(() => service.calculateScaledMargin(50, 0)).toThrow(
        "Invalid margin parameters"
      );
      expect(() => service.calculateScaledMargin(50, -1)).toThrow(
        "Invalid margin parameters"
      );
    });
  });

  // ============================================================================
  // DIMENSION VALIDATION (Prevents Crashes)
  // ============================================================================

  describe("validateDimensions", () => {
    it("should validate correct dimensions", () => {
      expect(service.validateDimensions(0, 1.0, baseOptions)).toBe(true);
      expect(service.validateDimensions(16, 1.0, baseOptions)).toBe(true);
      expect(service.validateDimensions(100, 2.0, baseOptions)).toBe(true);
    });

    it("should reject negative beat count", () => {
      expect(service.validateDimensions(-1, 1.0, baseOptions)).toBe(false);
    });

    it("should reject zero or negative beat scale", () => {
      expect(service.validateDimensions(10, 0, baseOptions)).toBe(false);
      expect(service.validateDimensions(10, -1, baseOptions)).toBe(false);
    });

    it("should reject excessive beat scale (memory protection)", () => {
      expect(service.validateDimensions(10, 11, baseOptions)).toBe(false);
      expect(service.validateDimensions(10, 100, baseOptions)).toBe(false);
    });

    it("should accept maximum safe beat scale", () => {
      expect(service.validateDimensions(10, 10, baseOptions)).toBe(true);
    });

    it("should reject null/undefined options", () => {
      expect(service.validateDimensions(10, 1.0, null as any)).toBe(false);
      expect(service.validateDimensions(10, 1.0, undefined as any)).toBe(false);
    });

    it("should reject options with missing boolean properties", () => {
      const invalidOptions = { ...baseOptions };
      delete (invalidOptions as any).addWord;

      expect(service.validateDimensions(10, 1.0, invalidOptions)).toBe(false);
    });
  });

  // ============================================================================
  // HELPER CALCULATIONS
  // ============================================================================

  describe("calculateTotalAdditionalHeight", () => {
    it("should sum top and bottom heights", () => {
      const total = service.calculateTotalAdditionalHeight(baseOptions, 3, 1.0);
      expect(total).toBe(450); // 300 + 150
    });

    it("should handle zero heights", () => {
      const noExtrasOptions = {
        ...baseOptions,
        addWord: false,
        addUserInfo: false,
      };
      const total = service.calculateTotalAdditionalHeight(
        noExtrasOptions,
        3,
        1.0
      );
      expect(total).toBe(0);
    });
  });

  describe("getBaseMargin", () => {
    it("should return base margin constant", () => {
      expect(DimensionCalculationService.getBaseMargin()).toBe(50);
    });
  });

  // ============================================================================
  // WORD AREA DIMENSIONS
  // ============================================================================

  describe("calculateWordAreaDimensions", () => {
    it("should calculate word area for 0 beats (no area)", () => {
      const result = service.calculateWordAreaDimensions(0, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(0);
      expect(result.available).toBe(false);
    });

    it("should calculate word area for 1 beat", () => {
      const result = service.calculateWordAreaDimensions(1, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(150);
      expect(result.available).toBe(true);
    });

    it("should calculate word area for 2 beats", () => {
      const result = service.calculateWordAreaDimensions(2, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(200);
      expect(result.available).toBe(true);
    });

    it("should calculate word area for 3+ beats", () => {
      const result = service.calculateWordAreaDimensions(3, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(300);
      expect(result.available).toBe(true);
    });

    it("should apply beat scale to height", () => {
      const result = service.calculateWordAreaDimensions(3, 2.0, 1000);

      expect(result.height).toBe(600); // 300 * 2.0
    });

    it("should floor scaled heights", () => {
      const result = service.calculateWordAreaDimensions(3, 1.5, 1000);

      expect(result.height).toBe(450); // floor(300 * 1.5)
    });
  });

  // ============================================================================
  // USER INFO AREA DIMENSIONS
  // ============================================================================

  describe("calculateUserInfoAreaDimensions", () => {
    it("should calculate user info area for 0 beats", () => {
      const result = service.calculateUserInfoAreaDimensions(0, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(55);
      expect(result.available).toBe(true);
    });

    it("should calculate user info area for 1 beat", () => {
      const result = service.calculateUserInfoAreaDimensions(1, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(55);
      expect(result.available).toBe(true);
    });

    it("should calculate user info area for 2 beats", () => {
      const result = service.calculateUserInfoAreaDimensions(2, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(75);
      expect(result.available).toBe(true);
    });

    it("should calculate user info area for 3+ beats", () => {
      const result = service.calculateUserInfoAreaDimensions(3, 1.0, 1000);

      expect(result.width).toBe(1000);
      expect(result.height).toBe(150);
      expect(result.available).toBe(true);
    });

    it("should apply beat scale to height", () => {
      const result = service.calculateUserInfoAreaDimensions(3, 2.0, 1000);

      expect(result.height).toBe(300); // 150 * 2.0
    });
  });

  // ============================================================================
  // DIFFICULTY BADGE CALCULATIONS
  // ============================================================================

  describe("calculateDifficultyBadgeArea", () => {
    it("should calculate badge area from additional height", () => {
      const result = service.calculateDifficultyBadgeArea(300);

      expect(result.size).toBe(225); // floor(300 * 0.75)
      expect(result.inset).toBe(37); // floor(300 / 8)
      expect(result.available).toBe(true);
    });

    it("should return zero for no additional height", () => {
      const result = service.calculateDifficultyBadgeArea(0);

      expect(result.size).toBe(0);
      expect(result.inset).toBe(0);
      expect(result.available).toBe(false);
    });

    it("should floor calculated values", () => {
      const result = service.calculateDifficultyBadgeArea(100);

      expect(result.size).toBe(75); // floor(100 * 0.75)
      expect(result.inset).toBe(12); // floor(100 / 8)
    });
  });

  // ============================================================================
  // TEXT SCALING FACTORS (Desktop FontMarginHelper)
  // ============================================================================

  describe("getTextScalingFactors", () => {
    it("should return small scaling for 0-1 beats", () => {
      const factors0 = service.getTextScalingFactors(0);
      expect(factors0.fontScale).toBeCloseTo(1 / 1.3);
      expect(factors0.marginScale).toBeCloseTo(1 / 3);

      const factors1 = service.getTextScalingFactors(1);
      expect(factors1.fontScale).toBeCloseTo(1 / 1.3);
      expect(factors1.marginScale).toBeCloseTo(1 / 3);
    });

    it("should return medium scaling for 2 beats", () => {
      const factors = service.getTextScalingFactors(2);
      expect(factors.fontScale).toBeCloseTo(1 / 1.4);
      expect(factors.marginScale).toBeCloseTo(1 / 2);
    });

    it("should return medium scaling for 3 beats", () => {
      const factors = service.getTextScalingFactors(3);
      expect(factors.fontScale).toBeCloseTo(1 / 1.5);
      expect(factors.marginScale).toBeCloseTo(1 / 2);
    });

    it("should return full scaling for 4+ beats", () => {
      const factors4 = service.getTextScalingFactors(4);
      expect(factors4.fontScale).toBe(1.0);
      expect(factors4.marginScale).toBe(1.0);

      const factors10 = service.getTextScalingFactors(10);
      expect(factors10.fontScale).toBe(1.0);
      expect(factors10.marginScale).toBe(1.0);
    });
  });

  // ============================================================================
  // MEMORY USAGE VALIDATION (Prevents Crashes)
  // ============================================================================

  describe("estimateMemoryUsage", () => {
    it("should calculate memory usage for standard dimensions", () => {
      const memory = service.estimateMemoryUsage(1000, 1000);
      expect(memory).toBe(4000000); // 1000 * 1000 * 4 bytes (RGBA)
    });

    it("should use custom bytes per pixel", () => {
      const memory = service.estimateMemoryUsage(1000, 1000, 3);
      expect(memory).toBe(3000000); // 1000 * 1000 * 3 bytes (RGB)
    });

    it("should calculate memory for large dimensions", () => {
      const memory = service.estimateMemoryUsage(4000, 3000);
      expect(memory).toBe(48000000); // 4000 * 3000 * 4 bytes
    });
  });

  describe("getMaximumRecommendedDimensions", () => {
    it("should return conservative browser limits", () => {
      const limits = service.getMaximumRecommendedDimensions();

      expect(limits.maxWidth).toBe(16384); // 16K width
      expect(limits.maxHeight).toBe(16384); // 16K height
      expect(limits.maxPixels).toBe(268435456); // 256 megapixels
    });
  });

  describe("validateMemoryUsage", () => {
    it("should validate safe dimensions", () => {
      const result = service.validateMemoryUsage(1000, 1000);

      expect(result.safe).toBe(true);
      expect(result.estimatedMB).toBeCloseTo(3.81, 1); // ~4MB
    });

    it("should validate large but safe dimensions", () => {
      const result = service.validateMemoryUsage(4000, 4000);

      expect(result.safe).toBe(true);
      expect(result.estimatedMB).toBeCloseTo(61.04, 1); // ~64MB
    });

    it("should reject dimensions exceeding width limit", () => {
      const result = service.validateMemoryUsage(20000, 1000);

      expect(result.safe).toBe(false);
    });

    it("should reject dimensions exceeding height limit", () => {
      const result = service.validateMemoryUsage(1000, 20000);

      expect(result.safe).toBe(false);
    });

    it("should reject dimensions exceeding pixel limit", () => {
      const result = service.validateMemoryUsage(16385, 16385);

      expect(result.safe).toBe(false); // 268,500,225 pixels exceeds limit
    });

    it("should calculate estimated MB correctly", () => {
      const result = service.validateMemoryUsage(2000, 2000);

      // 2000 * 2000 * 4 = 16,000,000 bytes = ~15.26 MB
      expect(result.estimatedMB).toBeCloseTo(15.26, 1);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (Real-World Scenarios)
  // ============================================================================

  describe("Real-World Export Scenarios", () => {
    it("should handle typical 16-beat sequence export", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        16,
        1.0
      );

      expect(top).toBe(300); // Word area for 16 beats
      expect(bottom).toBe(150); // User info area

      const total = service.calculateTotalAdditionalHeight(
        baseOptions,
        16,
        1.0
      );
      expect(total).toBe(450);
    });

    it("should handle high-resolution export (2x scale)", () => {
      const scale = 2.0;
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        16,
        scale
      );

      expect(top).toBe(600); // 300 * 2.0
      expect(bottom).toBe(300); // 150 * 2.0

      const beatSize = service.calculateScaledBeatSize(144, scale);
      expect(beatSize).toBe(288);

      const margin = service.calculateScaledMargin(50, scale);
      expect(margin).toBe(100);
    });

    it("should handle minimal export (no extras)", () => {
      const minimalOptions = {
        ...baseOptions,
        addWord: false,
        addUserInfo: false,
      };

      const [top, bottom] = service.determineAdditionalHeights(
        minimalOptions,
        16,
        1.0
      );

      expect(top).toBe(0);
      expect(bottom).toBe(0);
    });

    it("should validate memory for typical export", () => {
      // Typical export: 16 beats, 150px each, 2 columns = ~1500x1500
      const result = service.validateMemoryUsage(1500, 1500);

      expect(result.safe).toBe(true);
      expect(result.estimatedMB).toBeLessThan(10); // Should be under 10MB
    });

    it("should prevent memory issues for large exports", () => {
      // Unreasonably large export
      const result = service.validateMemoryUsage(20000, 20000);

      expect(result.safe).toBe(false);
      expect(result.estimatedMB).toBeGreaterThan(1000); // Over 1GB
    });
  });

  // ============================================================================
  // EDGE CASES AND ERROR HANDLING
  // ============================================================================

  describe("Edge Cases", () => {
    it("should handle zero beat count", () => {
      expect(() =>
        service.determineAdditionalHeights(baseOptions, 0, 1.0)
      ).not.toThrow();
    });

    it("should handle very large beat count", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        1000,
        1.0
      );

      // Should still use 3+ beats logic
      expect(top).toBe(300);
      expect(bottom).toBe(150);
    });

    it("should handle fractional beat scale", () => {
      const [top, bottom] = service.determineAdditionalHeights(
        baseOptions,
        3,
        0.75
      );

      expect(top).toBe(225); // floor(300 * 0.75)
      expect(bottom).toBe(112); // floor(150 * 0.75)
    });

    it("should throw error for invalid parameters in determineAdditionalHeights", () => {
      expect(() =>
        service.determineAdditionalHeights(baseOptions, -1, 1.0)
      ).toThrow("Invalid dimension parameters");

      expect(() =>
        service.determineAdditionalHeights(baseOptions, 10, 0)
      ).toThrow("Invalid dimension parameters");

      expect(() =>
        service.determineAdditionalHeights(baseOptions, 10, 11)
      ).toThrow("Invalid dimension parameters");
    });
  });
});
