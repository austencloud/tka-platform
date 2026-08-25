import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BackgroundType } from "@austencloud/backgrounds";
import { STAGE } from "@austencloud/scene-3d";
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
  BackgroundType.PRIDE,
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

  describe("scenes rendering the canonical <Stage3D>", () => {
    // A scene that renders Stage3D without a `height` prop gets a deck top at
    // STAGE.STAGE_DECK_HEIGHT. If it declares any other native surface, the
    // difference offsets the entire environment and the performers' feet end
    // up inside the deck. Blossom shipped 0.35 here and sank feet by 0.20 m.
    const SCENES_DIR = "src/lib/shared/3d/environments/scenes";
    const SCENE_BACKGROUNDS: Record<string, BackgroundType> = {
      "ForestScene.svelte": BackgroundType.FOREST,
      "AutumnScene.svelte": BackgroundType.AUTUMN,
      "BlossomScene.svelte": BackgroundType.BLOSSOM,
    };

    const rendersStage3D = readdirSync(SCENES_DIR)
      .filter((file) => file.endsWith("Scene.svelte"))
      .filter((file) =>
        /<Stage3D[\s/>]/.test(readFileSync(join(SCENES_DIR, file), "utf8"))
      );

    it("has a known background mapping for each one", () => {
      expect(rendersStage3D.sort()).toEqual(
        Object.keys(SCENE_BACKGROUNDS).sort()
      );
    });

    it.each(rendersStage3D)("declares the deck top for %s", (file) => {
      const source = readFileSync(join(SCENES_DIR, file), "utf8");
      const tag = source.match(/<Stage3D[^>]*>/)?.[0] ?? "";
      // A scene passing its own height would need its own declared surface.
      expect(tag).not.toMatch(/\bheight=/);

      const backgroundType = SCENE_BACKGROUNDS[file];
      expect(getNativeStageSurfaceY(backgroundType, true)).toBe(
        STAGE.STAGE_DECK_HEIGHT
      );
      expect(
        getStageCoordinateFrame(backgroundType, true).environmentYOffset
      ).toBe(0);
    });
  });

  it("moves Cloudbreak's raised terrace under the fixed performer anchor", () => {
    const frame = getStageCoordinateFrame(BackgroundType.CELESTIAL, true);

    expect(frame.nativeSurfaceY).toBe(0.225);
    expect(frame.nativeSurfaceY + frame.environmentYOffset).toBeCloseTo(
      CANONICAL_PERFORMER_ANCHOR_Y
    );
  });

  it.each(BACKGROUNDS)(
    "recognizes %s as a 3D environment",
    (backgroundType) => {
      expect(isRenderable3DEnvironment(backgroundType)).toBe(true);
    }
  );
});
