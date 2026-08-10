import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("PropPlacementGrid ownership", () => {
  const rootPath =
    "src/lib/shared/pictograph/grid/components/PropPlacementGrid.svelte";
  const overlayPath =
    "src/lib/shared/pictograph/grid/components/PropPlacementInteractionOverlay.svelte";
  const statePath =
    "src/lib/shared/pictograph/grid/state/prop-placement-state.svelte.ts";
  const aimPath =
    "src/lib/shared/pictograph/grid/state/prop-placement-aim-state.svelte.ts";
  const modelPath =
    "src/lib/shared/pictograph/grid/services/prop-placement-view-model.ts";

  it("keeps the public component as a composition root", () => {
    const root = read(rootPath);

    expect(root).toContain("createPropPlacementState");
    expect(root).toContain("createPropPlacementAimState");
    expect(root).toContain("<PropPlacementInteractionOverlay");
    expect(root).toContain("export function moveProp");
    expect(root).toContain("export function undoPlacement");
    expect(root).toContain("export function resetPlacement");
  });

  it("keeps state, gesture, calculation, and overlay ownership separate", () => {
    const root = read(rootPath);
    const overlay = read(overlayPath);
    const state = read(statePath);
    const aim = read(aimPath);
    const model = read(modelPath);

    expect(root).not.toContain("function shapeDepth");
    expect(root).not.toContain("function pushHistory");
    expect(root).not.toContain("function computeGammaArc");
    expect(root).not.toContain('class="interaction-overlay"');
    expect(state).toContain("function pushHistory");
    expect(aim).toContain("function shapeDepth");
    expect(model).toContain("computeGammaGuideArc");
    expect(overlay).toContain('class="interaction-overlay"');
  });

  it("continues to delegate orientation and point math to the canonical owners", () => {
    const aim = read(aimPath);
    const model = read(modelPath);

    expect(aim).toContain("orientationFromDrag");
    expect(aim).toContain("aimDirectionsFor");
    expect(model).toContain("getPlacementGridPoints");
    expect(model).toContain("calculateBetaOffset");
  });
});
