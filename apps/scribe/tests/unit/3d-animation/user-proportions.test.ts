/**
 * Tests for user proportions calculations
 * Investigating the avatar height/position jumping issue
 */

import { describe, it, expect } from "vitest";
import {
  calculateSceneDimensions,
  feetInchesToCm,
  inchesToCm,
  type UserProportions,
} from "$lib/shared/3d-animation/config/user-proportions";
import { CM_TO_UNITS } from "$lib/shared/3d-animation/config/avatar-proportions";

describe("User Proportions Calculations", () => {
  // Test heights representing typical range
  const testHeights = [
    { label: "5'0\"", feet: 5, inches: 0 },
    { label: "5'6\"", feet: 5, inches: 6 },
    { label: "6'0\"", feet: 6, inches: 0 },
    { label: "6'3\"", feet: 6, inches: 3 },
    { label: "6'6\"", feet: 6, inches: 6 },
  ];

  const standardStaffCm = inchesToCm(34); // 34" staff

  describe("feetInchesToCm conversion", () => {
    it("should convert feet/inches to cm correctly", () => {
      // 5'0" = 60 inches = 152.4 cm
      expect(feetInchesToCm(5, 0)).toBeCloseTo(152.4, 1);

      // 6'0" = 72 inches = 182.88 cm
      expect(feetInchesToCm(6, 0)).toBeCloseTo(182.88, 1);

      // 6'3" = 75 inches = 190.5 cm
      expect(feetInchesToCm(6, 3)).toBeCloseTo(190.5, 1);
    });
  });

  describe("calculateSceneDimensions", () => {
    it("should produce consistent results for the same input", () => {
      const props: UserProportions = {
        heightCm: feetInchesToCm(6, 3),
        staffLengthCm: standardStaffCm,
        build: "average",
      };

      const result1 = calculateSceneDimensions(props);
      const result2 = calculateSceneDimensions(props);

      expect(result1.avatarScale).toBe(result2.avatarScale);
      expect(result1.groundY).toBe(result2.groundY);
      expect(result1.staffLength).toBe(result2.staffLength);
    });

    it("should calculate avatarScale as height ratio to base model", () => {
      const BASE_MODEL_HEIGHT_CM = 188; // From user-proportions.ts

      for (const { label, feet, inches } of testHeights) {
        const heightCm = feetInchesToCm(feet, inches);
        const props: UserProportions = {
          heightCm,
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        const result = calculateSceneDimensions(props);

        const expectedScale = heightCm / BASE_MODEL_HEIGHT_CM;
        expect(result.avatarScale).toBeCloseTo(expectedScale, 4);

        console.log(
          `${label} (${heightCm.toFixed(1)}cm): avatarScale = ${result.avatarScale.toFixed(4)}`
        );
      }
    });

    it("should calculate groundY based on shoulder height", () => {
      const SHOULDER_HEIGHT_RATIO = 0.82; // From user-proportions.ts

      for (const { label, feet, inches } of testHeights) {
        const heightCm = feetInchesToCm(feet, inches);
        const props: UserProportions = {
          heightCm,
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        const result = calculateSceneDimensions(props);

        const shoulderHeightCm = heightCm * SHOULDER_HEIGHT_RATIO;
        const expectedGroundY = -(shoulderHeightCm * CM_TO_UNITS);

        expect(result.groundY).toBeCloseTo(expectedGroundY, 1);

        console.log(
          `${label}: groundY = ${result.groundY.toFixed(1)} (shoulder at Y=0, feet at Y=${result.groundY.toFixed(1)})`
        );
      }
    });

    it("should keep staffLength constant regardless of height", () => {
      const results = testHeights.map(({ feet, inches }) => {
        const props: UserProportions = {
          heightCm: feetInchesToCm(feet, inches),
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        return calculateSceneDimensions(props);
      });

      // All staffLength values should be identical
      const firstStaffLength = results[0].staffLength;
      for (const result of results) {
        expect(result.staffLength).toBe(firstStaffLength);
      }

      console.log(
        `Staff length (34"): ${firstStaffLength.toFixed(1)} scene units`
      );
    });

    it("should keep gridSize constant regardless of height (staff-only)", () => {
      const results = testHeights.map(({ feet, inches }) => {
        const props: UserProportions = {
          heightCm: feetInchesToCm(feet, inches),
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        return calculateSceneDimensions(props);
      });

      // All gridSize values should be identical (staff-based only)
      const firstGridSize = results[0].gridSize;
      for (const result of results) {
        expect(result.gridSize).toBe(firstGridSize);
      }

      console.log(`Grid size: ${firstGridSize.toFixed(1)} scene units`);
    });

    it("should keep handPointRadius constant regardless of height (now staff-based)", () => {
      const results = testHeights.map(({ feet, inches }) => {
        const props: UserProportions = {
          heightCm: feetInchesToCm(feet, inches),
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        return calculateSceneDimensions(props);
      });

      // All handPointRadius values should be identical (now staff-based)
      const firstHandRadius = results[0].handPointRadius;
      for (const result of results) {
        expect(result.handPointRadius).toBe(firstHandRadius);
      }

      console.log(
        `Hand point radius: ${firstHandRadius.toFixed(1)} scene units`
      );
    });

    it("should produce smooth groundY transitions for 1-inch height changes", () => {
      // Test that small height changes produce proportionally small groundY changes
      const baseHeightInches = 72; // 6'0"
      const groundYValues: number[] = [];

      console.log("\nGroundY values for 1-inch increments around 6'0\":");

      for (let i = -3; i <= 3; i++) {
        const heightInches = baseHeightInches + i;
        const heightCm = heightInches * 2.54;
        const props: UserProportions = {
          heightCm,
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        const result = calculateSceneDimensions(props);
        groundYValues.push(result.groundY);

        const feet = Math.floor(heightInches / 12);
        const inches = heightInches % 12;
        console.log(
          `${feet}'${inches}" (${heightCm.toFixed(1)}cm): groundY = ${result.groundY.toFixed(2)}`
        );
      }

      // Check that transitions are smooth (roughly linear)
      // Each inch should change groundY by approximately the same amount
      const deltas: number[] = [];
      for (let i = 1; i < groundYValues.length; i++) {
        deltas.push(groundYValues[i] - groundYValues[i - 1]);
      }

      console.log(
        "\nGroundY deltas per inch:",
        deltas.map((d) => d.toFixed(2))
      );

      // All deltas should be similar (within 0.1 of each other)
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      for (const delta of deltas) {
        expect(Math.abs(delta - avgDelta)).toBeLessThan(0.1);
      }

      console.log(
        `Average groundY change per inch: ${avgDelta.toFixed(2)} scene units`
      );
    });
  });

  describe("Avatar target height in scene units", () => {
    it("should calculate correct target height for setHeight()", () => {
      console.log("\nTarget heights for setHeight() method:");

      for (const { label, feet, inches } of testHeights) {
        const heightCm = feetInchesToCm(feet, inches);
        const targetHeight = heightCm * CM_TO_UNITS; // This is what gets passed to setHeight()

        console.log(
          `${label} (${heightCm.toFixed(1)}cm): targetHeight = ${targetHeight.toFixed(1)} scene units`
        );
      }
    });

    it("should show relationship between avatarScale and targetHeight", () => {
      const BASE_MODEL_HEIGHT_CM = 188;

      console.log("\nRelationship between avatarScale and targetHeight:");
      console.log("(If model bounding box = X, then scale = targetHeight / X)");

      for (const { label, feet, inches } of testHeights) {
        const heightCm = feetInchesToCm(feet, inches);
        const props: UserProportions = {
          heightCm,
          staffLengthCm: standardStaffCm,
          build: "average",
        };
        const result = calculateSceneDimensions(props);
        const targetHeight = heightCm * CM_TO_UNITS;

        // If model bounding box is 2 units (typical GLTF)
        const scaleIfBbox2 = targetHeight / 2;
        // If model bounding box is ~188 units (matches cm)
        const scaleIfBbox188 = targetHeight / 188;

        console.log(`${label}:`);
        console.log(`  targetHeight = ${targetHeight.toFixed(1)}`);
        console.log(`  avatarScale (ratio) = ${result.avatarScale.toFixed(4)}`);
        console.log(`  scale if bbox=2: ${scaleIfBbox2.toFixed(1)}`);
        console.log(`  scale if bbox=188: ${scaleIfBbox188.toFixed(4)}`);
      }
    });
  });
});
