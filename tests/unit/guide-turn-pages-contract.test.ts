/**
 * Static contract test for the Level-2 turn pages' Phase 3 rewire.
 *
 * TurnsPage, TwoTurnsShiftsPage, and TwoTurnsDashStaticPage used to render a
 * baked LiftedTurnFrame drawing (a lifted staff+arrow image over a bare
 * hand-dot grid) instead of a real pictograph — the source of their
 * tiny-render defect (see docs/superpowers/specs/
 * 2026-07-14-halved-pictograph-pipeline-design.md §7/§11 Phase 3). They now
 * render real pictographs end to end: real PictographContainer frames for
 * start/end/halfway/combined, and buildHalvedStep for the midpoint. This test
 * locks that at the source level — LiftedTurnFrame is gone, and the pages
 * cannot silently regress back to the baked-image path.
 *
 * If this test fails, fix the page — do not loosen the assertions.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const LIFTED_TURN_FRAME_PATH =
  "src/routes/(public)/guide/level-2/_components/LiftedTurnFrame.svelte";

const PAGES: Record<string, string> = {
  TurnsPage: "src/routes/(public)/guide/level-2/_pages/TurnsPage.svelte",
  TwoTurnsShiftsPage: "src/routes/(public)/guide/level-2/_pages/TwoTurnsShiftsPage.svelte",
  TwoTurnsDashStaticPage: "src/routes/(public)/guide/level-2/_pages/TwoTurnsDashStaticPage.svelte",
};

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

const pageEntries = Object.entries(PAGES).map(([name, rel]) => [name, read(rel)] as const);

describe("Level-2 turn pages contract (halved-pictograph Phase 3 rewire)", () => {
  it("LiftedTurnFrame.svelte no longer exists on disk", () => {
    expect(existsSync(path.join(repoRoot, LIFTED_TURN_FRAME_PATH))).toBe(false);
  });

  it.each(pageEntries)("%s does not reference LiftedTurnFrame", (_name, source) => {
    expect(source).not.toContain("LiftedTurnFrame");
  });

  it.each(pageEntries)("%s imports PictographContainer", (_name, source) => {
    expect(source).toContain("PictographContainer.svelte");
    expect(source).toMatch(/<PictographContainer\b/);
  });

  it.each(pageEntries)("%s references buildHalvedStep", (_name, source) => {
    expect(source).toContain("buildHalvedStep");
  });
});
