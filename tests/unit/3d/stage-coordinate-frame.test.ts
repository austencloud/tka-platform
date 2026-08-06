import { describe, expect, it } from "vitest";
import { BackgroundType } from "@austencloud/backgrounds";
import {
  CANONICAL_PERFORMER_ANCHOR_Y,
  getNativeStageSurfaceY,
  getStageCoordinateFrame,
  isRenderable3DEnvironment,
} from "$lib/shared/3d/environments/domain/stage-coordinate-frame";

const BACKGROUNDS = [
  BackgroundType.FOREST,
  BackgroundType.AUTUMN,
  BackgroundType.COSMIC,
  BackgroundType.WINTER,
  BackgroundType.OCEAN,
  BackgroundType.EMBER,
  BackgroundType.BLOSSOM,
  BackgroundType.RAINBOW,
  BackgroundType.CELESTIAL,
  BackgroundType.VOID,
] as const;

describe("stage coordinate frame", () => {
  it.each(BACKGROUNDS)(
    "keeps the performer anchor fixed in %s",
    (backgroundType) => {
      for (const stageEnabled of [false, true]) {
        const frame = getStageCoordinateFrame(backgroundType, stageEnabled);
        expect(frame.performerAnchorY).toBe(CANONICAL_PERFORMER_ANCHOR_Y);
        expect(frame.nativeSurfaceY + frame.environmentYOffset).toBeCloseTo(
          CANONICAL_PERFORMER_ANCHOR_Y
        );
      }
    }
  );

  it("moves Ocean instead of moving the performer", () => {
    const withStage = getStageCoordinateFrame(BackgroundType.OCEAN, true);
    const withoutStage = getStageCoordinateFrame(BackgroundType.OCEAN, false);

    expect(withStage.environmentYOffset).toBeCloseTo(-1.95);
    expect(withoutStage.environmentYOffset).toBeCloseTo(-0.95);
    expect(withStage.performerAnchorY).toBe(withoutStage.performerAnchorY);
  });

  it("aligns Autumn's authored deck top with the canonical performer anchor", () => {
    const frame = getStageCoordinateFrame(BackgroundType.AUTUMN, true);

    expect(getNativeStageSurfaceY(BackgroundType.AUTUMN, true)).toBe(
      CANONICAL_PERFORMER_ANCHOR_Y
    );
    expect(frame.environmentYOffset).toBe(0);
  });

  it.each(BACKGROUNDS)(
    "recognizes %s as a 3D environment",
    (backgroundType) => {
      expect(isRenderable3DEnvironment(backgroundType)).toBe(true);
    }
  );
});
