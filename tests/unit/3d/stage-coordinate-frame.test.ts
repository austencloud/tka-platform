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

  describe("scenes building the canonical stage deck", () => {
    // A scene that builds the canonical deck without overriding its height
    // gets a deck top at STAGE.STAGE_DECK_HEIGHT. If it declares any other
    // native surface, the difference offsets the entire environment and the
    // performers' feet end up inside the deck. Blossom shipped 0.35 here and
    // sank feet by 0.20 m.
    //
    // The 2026-09-04 worker-renderer refactors moved Autumn's and Blossom's
    // deck out of their Svelte scenes into imperative `worlds/*-stage.ts`
    // builders, so both kinds of owner are enumerated. A deck owner is any
    // file under `environments/` that mounts <Stage3D> or reads the canonical
    // deck height; `domain/` is excluded because it defines that height rather
    // than standing performers on it.
    const ENVIRONMENTS_DIR = "src/lib/shared/3d/environments";
    const DECK_OWNER_BACKGROUNDS: Record<string, BackgroundType> = {
      "scenes/forest/ForestConfigurableScene.svelte": BackgroundType.FOREST,
      "scenes/forest/ForestProductionScene.svelte": BackgroundType.FOREST,
      "worlds/autumn/autumn-stage.ts": BackgroundType.AUTUMN,
      "worlds/blossom/blossom-stage.ts": BackgroundType.BLOSSOM,
    };

    function collectFiles(relativeDir: string): string[] {
      return readdirSync(join(ENVIRONMENTS_DIR, relativeDir), {
        withFileTypes: true,
      }).flatMap((entry) => {
        const relativePath = relativeDir
          ? `${relativeDir}/${entry.name}`
          : entry.name;
        return entry.isDirectory() ? collectFiles(relativePath) : relativePath;
      });
    }

    const environmentFiles = collectFiles("").filter(
      (file) =>
        (file.endsWith(".svelte") || file.endsWith(".ts")) &&
        !file.includes(".test.")
    );

    const deckOwners = environmentFiles
      .filter((file) => !file.startsWith("domain/"))
      .filter((file) => {
        const source = readFileSync(join(ENVIRONMENTS_DIR, file), "utf8");
        return (
          /<Stage3D[\s/>]/.test(source) ||
          /STAGE_DECK_HEIGHT|CANONICAL_PERFORMER_ANCHOR_Y/.test(source)
        );
      });

    it("has a known background mapping for each one", () => {
      expect(deckOwners.sort()).toEqual(
        Object.keys(DECK_OWNER_BACKGROUNDS).sort()
      );
    });

    it.each(deckOwners)("declares the deck top for %s", (file) => {
      const source = readFileSync(join(ENVIRONMENTS_DIR, file), "utf8");

      if (file.endsWith(".svelte")) {
        const tag = source.match(/<Stage3D[^>]*>/)?.[0] ?? "";
        // A scene passing its own height would need its own declared surface.
        expect(tag).toContain("<Stage3D");
        expect(tag).not.toMatch(/\bheight=/);
      } else {
        // The imperative builders take their deck top from the canonical
        // constant. Where one accepts a height override, that override is only
        // safe while nothing passes it, so every call site is checked too.
        const deckTopSource = source.match(/deckTop\s*=\s*(\w+)/)?.[1];
        expect(deckTopSource).toBeDefined();
        if (deckTopSource !== "CANONICAL_PERFORMER_ANCHOR_Y") {
          expect(source).toMatch(
            new RegExp(
              `${deckTopSource}\\s*=\\s*options\\.height \\?\\? STAGE\\.STAGE_DECK_HEIGHT`
            )
          );
        }

        const creator = source.match(/export function (create\w*Stage)\(/)?.[1];
        expect(creator).toBeDefined();
        const callSites = environmentFiles
          .filter((candidate) => candidate !== file)
          .flatMap(
            (candidate) =>
              readFileSync(join(ENVIRONMENTS_DIR, candidate), "utf8").match(
                new RegExp(`${creator}\\(\\{[^}]*\\}`, "g")
              ) ?? []
          );
        expect(callSites.length).toBeGreaterThan(0);
        for (const callSite of callSites) {
          expect(callSite).not.toMatch(/\bheight\s*:/);
        }
      }

      const backgroundType = DECK_OWNER_BACKGROUNDS[file];
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
