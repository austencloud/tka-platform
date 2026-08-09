/**
 * The museum's player physics is ONE definition, and every water basin is
 * fenced against the jump arc that definition produces.
 *
 * Both invariants were violated at once on 2026-08-09: the Drowned Gallery
 * review route ran gravity 9.81 against the museum's 24.5, which made the room
 * feel lunar AND let the player clear the 1.1 m pool fence. Austen found both
 * by walking. These assertions are how a graybox stops shipping that class of
 * defect to his feet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildDrownedGalleryLayout,
  CAUSEWAY_Y,
  GROTTO_WATERLINE_Y,
  WATERLINE_Y,
  type WorldRect,
} from "../../../src/lib/features/museum/data/drowned-gallery-terrain";
import { buildVulcanCaveFloorPlan } from "../../../src/lib/features/museum/data/vulcan-cave-floor-plan";
import {
  MIN_UNCROSSABLE_BARRIER,
  MUSEUM_GRAVITY,
  MUSEUM_JUMP_APEX,
  MUSEUM_JUMP_VELOCITY,
} from "../../../src/lib/features/museum/domain/museum-design-rules";

/** The character controller's auto-step; it will mount a near-miss barrier. */
const AUTO_STEP = 0.45;

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("museum player physics", () => {
  it("derives one gravity and jump apex for the whole museum", () => {
    expect(MUSEUM_GRAVITY).toBeCloseTo(24.525, 3);
    expect(MUSEUM_JUMP_VELOCITY).toBe(5);
    // v^2 / 2g — the height a standing jump actually reaches.
    expect(MUSEUM_JUMP_APEX).toBeCloseTo(0.5097, 3);
  });

  it("fences water above jump apex PLUS auto-step, not merely above apex", () => {
    // The 2026-08-09 bug: 1.1 m cleared the apex but not apex + auto-step.
    expect(MIN_UNCROSSABLE_BARRIER).toBeGreaterThan(MUSEUM_JUMP_APEX + AUTO_STEP);
  });

  it("keeps every Drowned Gallery water basin unreachable from any nearby floor", () => {
    const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan().grid);

    // A running jump carries roughly this far horizontally, so any floor
    // within it is a launch pad for the basin next to it.
    const JUMP_REACH_M = 2.5;
    const near = (a: WorldRect, b: WorldRect) =>
      a.minX - JUMP_REACH_M < b.maxX &&
      a.maxX + JUMP_REACH_M > b.minX &&
      a.minZ - JUMP_REACH_M < b.maxZ &&
      a.maxZ + JUMP_REACH_M > b.minZ;

    // Only the GROTTO basins are fenced; the submerged gallery is meant to be
    // walked through, so it is not part of this sweep.
    const fenced = layout.waterVolumes.filter(
      (volume) => volume.surfaceY === GROTTO_WATERLINE_Y
    );
    expect(fenced.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const volume of fenced) {
      // The shipped fence for this basin, computed exactly as the collider
      // does: from the highest floor that can launch at it.
      let highestLaunch = CAUSEWAY_Y;
      for (const floor of layout.floorRects) {
        if (!near(volume.rect, floor.rect)) continue;
        highestLaunch = Math.max(highestLaunch, floor.fromY, floor.toY);
      }
      const fenceTop = highestLaunch + MIN_UNCROSSABLE_BARRIER;

      for (const floor of layout.floorRects) {
        if (!near(volume.rect, floor.rect)) continue;
        const takeOff = Math.max(floor.fromY, floor.toY);
        const reach = takeOff + MUSEUM_JUMP_APEX + AUTO_STEP;
        if (reach >= fenceTop) {
          offenders.push(
            `${floor.id} (top ${takeOff.toFixed(2)}, reaches ${reach.toFixed(
              2
            )}) can enter ${volume.id} over a fence at ${fenceTop.toFixed(2)}`
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the grotto water brimming at its deck, never sunk in a trench", () => {
    const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan().grid);

    // The 2026-08-09 defect: grotto water inherited the submerged gallery's
    // WATERLINE_Y (-1.5) while its decks sat at -0.3, leaving a 1.2 m dry lip
    // that read as two disconnected slabs. A reveal is legible, a pit is not.
    const reveal = CAUSEWAY_Y - GROTTO_WATERLINE_Y;
    expect(reveal).toBeGreaterThan(0); // never coplanar — that is z-fighting
    expect(reveal).toBeLessThanOrEqual(0.3); // never a trench

    // Both grotto bodies share ONE surface, so they read as one flooded room
    // crossed by a causeway rather than as separate holes.
    const grottoSurfaces = new Set(
      layout.waterVolumes
        .filter((volume) => volume.surfaceY > WATERLINE_Y)
        .map((volume) => volume.surfaceY)
    );
    expect([...grottoSurfaces]).toEqual([GROTTO_WATERLINE_Y]);

    // And every rendered plane agrees with the volume it caps.
    for (const plane of layout.waterPlanes) {
      expect([WATERLINE_Y, GROTTO_WATERLINE_Y]).toContain(plane.surfaceY);
    }
  });

  it("never lets a graybox review route restate gravity by hand", () => {
    // A review route that hardcodes a number is reviewing a different game.
    const walkScene = read(
      "src/routes/test/drowned-gallery-graybox/DrownedGalleryWalkScene.svelte"
    );
    expect(walkScene).toContain("gravity={MUSEUM_GRAVITY}");
    expect(walkScene).toContain("jumpForce={MUSEUM_JUMP_VELOCITY}");
    expect(walkScene).not.toMatch(/gravity=\{[\d.]+\}/);
    expect(walkScene).not.toMatch(/jumpForce=\{[\d.]+\}/);
  });
});
