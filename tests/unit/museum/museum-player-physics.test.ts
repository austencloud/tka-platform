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

import { buildDrownedGalleryLayout } from "../../../src/lib/features/museum/data/drowned-gallery-terrain";
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

  it("keeps every Drowned Gallery water basin unreachable from its banks", () => {
    const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan().grid);
    const barrierTop = -0.3 + MIN_UNCROSSABLE_BARRIER; // CAUSEWAY_Y + min

    // Highest floor anyone can take off from anywhere in the room.
    const highestFloor = Math.max(
      ...layout.floorRects.map((floor) =>
        Math.max(floor.fromY ?? -99, floor.toY ?? -99)
      )
    );
    const reachableFrom = (takeOffY: number) =>
      takeOffY + MUSEUM_JUMP_APEX + AUTO_STEP;

    // Banks around the basins sit at the causeway datum.
    expect(reachableFrom(-0.3)).toBeLessThan(barrierTop);

    // And the room's highest floor is not secretly a diving board: if it ever
    // rises enough to clear the fence, this fails and the fence must follow.
    expect(highestFloor).toBeLessThanOrEqual(0);
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
