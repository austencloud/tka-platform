import { describe, expect, it } from "vitest";
import {
  createBlossomRuntimeConfig,
  createBlossomStageTransform,
  detectBlossomQuality,
  type BlossomQualityTier,
} from "$lib/shared/3d/environments/scenes/cherry-blossom/blossom-runtime";

describe("Blossom authored environment runtime", () => {
  describe("stage transform", () => {
    it("preserves the authored default stage and exact world stage-top height", () => {
      const transform = createBlossomStageTransform({
        stageWidth: 6,
        stageDepth: 6,
        stageZOffset: 0,
        groundY: -1.2,
      });

      expect(transform.position).toEqual([0, -1.2, 0]);
      expect(transform.scale).toEqual([1, 1, 1]);
      expect(transform.stageTopY).toBeCloseTo(-0.85, 10);
    });

    it("expands an asymmetric stage clearing from its half-diagonal", () => {
      const transform = createBlossomStageTransform({
        stageWidth: 12,
        stageDepth: 8,
        stageZOffset: 0,
        groundY: 0,
      });
      const halfDiagonal = Math.hypot(6, 4);

      expect(transform.horizontalScale).toBeCloseTo(
        halfDiagonal / 5 + 0.08,
        10
      );
      expect(transform.scale[0]).toBe(transform.scale[2]);
      expect(transform.scale[1]).toBe(1);
      expect(transform.horizontalScale * 5 - halfDiagonal).toBeCloseTo(0.4, 10);
    });

    it("centers the complete authored garden on a negative stage Z offset", () => {
      const transform = createBlossomStageTransform({
        stageWidth: 8,
        stageDepth: 6,
        stageZOffset: -3.75,
        groundY: -0.4,
      });

      expect(transform.position).toEqual([0, -0.4, -3.75]);
      expect(transform.horizontalScale).toBeCloseTo(1.08, 10);
      expect(transform.stageTopY).toBeCloseTo(-0.05, 10);
    });

    it("is deterministic for identical stage inputs", () => {
      const input = {
        stageWidth: 10,
        stageDepth: 7,
        stageZOffset: -2,
        groundY: -1,
      };

      expect(createBlossomStageTransform(input)).toEqual(
        createBlossomStageTransform(input)
      );
    });
  });

  describe("quality budgets", () => {
    function runtimeFor(tier: BlossomQualityTier) {
      return createBlossomRuntimeConfig({
        tier,
        prefersReducedMotion: false,
        stageWidth: 6,
        stageDepth: 6,
        stageZOffset: 0,
        groundY: 0,
        particleCounts: {
          petals: 120,
          distantPetals: 60,
          fireflies: 20,
        },
        lightIntensities: {
          hemisphere: 1.5,
          key: 2,
        },
      });
    }

    it("reduces every dynamic budget monotonically by tier", () => {
      const high = runtimeFor("high");
      const medium = runtimeFor("medium");
      const low = runtimeFor("low");

      expect(high.particles.petals).toBeGreaterThan(medium.particles.petals);
      expect(medium.particles.petals).toBeGreaterThan(low.particles.petals);
      expect(high.particles.distantPetals).toBeGreaterThan(
        medium.particles.distantPetals
      );
      expect(medium.particles.distantPetals).toBeGreaterThan(
        low.particles.distantPetals
      );
      expect(high.particles.fireflies).toBeGreaterThan(
        medium.particles.fireflies
      );
      expect(medium.particles.fireflies).toBeGreaterThan(
        low.particles.fireflies
      );
      expect(high.lights.hemisphere).toBeGreaterThan(medium.lights.hemisphere);
      expect(medium.lights.hemisphere).toBeGreaterThan(low.lights.hemisphere);
      expect(high.maxPixelRatio).toBeGreaterThan(medium.maxPixelRatio);
      expect(medium.maxPixelRatio).toBeGreaterThan(low.maxPixelRatio);
    });

    it("omits secondary particle tasks on low quality", () => {
      const low = runtimeFor("low");

      expect(low.particles).toEqual({
        petals: 42,
        distantPetals: 0,
        fireflies: 0,
      });
      expect(low.maxPixelRatio).toBe(1);
    });

    it("suppresses every moving particle layer for reduced motion", () => {
      const reduced = createBlossomRuntimeConfig({
        tier: "high",
        prefersReducedMotion: true,
        stageWidth: 6,
        stageDepth: 6,
        stageZOffset: 0,
        groundY: 0,
        particleCounts: {
          petals: 120,
          distantPetals: 60,
          fireflies: 20,
        },
        lightIntensities: {
          hemisphere: 1.5,
          key: 2,
        },
      });

      expect(reduced.particles).toEqual({
        petals: 0,
        distantPetals: 0,
        fireflies: 0,
      });
    });

    it("assigns mobile devices to the low tier", () => {
      expect(
        detectBlossomQuality({
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)",
          hardwareConcurrency: 8,
          gpuRenderer: "Apple GPU",
        })
      ).toBe("low");
    });
  });
});
