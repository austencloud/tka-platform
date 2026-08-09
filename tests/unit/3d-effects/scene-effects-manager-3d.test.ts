import { describe, expect, it } from "vitest";
import { Scene } from "three";
import { SceneEffectsManager3D } from "$lib/shared/3d/effects/scene-effects/scene-effects-manager-3d";
import { isTrackedTip } from "$lib/shared/3d/effects/scene-effects/scene-effect-source-3d";

describe("SceneEffectsManager3D", () => {
  it("owns one scene-level mesh per material variant and releases them together", () => {
    const scene = new Scene();
    const manager = new SceneEffectsManager3D();
    manager.initialize(scene);

    // Existing six particle/material variants plus twelve scene-level visual
    // layers for Ink, Silk, Animal, and Pulse.
    expect(scene.children).toHaveLength(18);
    manager.update(1 / 60);
    manager.dispose();
    expect(scene.children).toHaveLength(0);
  });

  it("assigns stable, non-overlapping source ranges to rigs", () => {
    const manager = new SceneEffectsManager3D();
    const first = manager.registerRig({ playing: false, sources: [] });
    const second = manager.registerRig({ playing: false, sources: [] });
    expect(second.sourceIdBase - first.sourceIdBase).toBe(4);
    first.dispose();
    second.dispose();
  });
});

describe("isTrackedTip", () => {
  it("keeps left/right tracking aligned with canonical tip indices", () => {
    expect(isTrackedTip("left_end", 0)).toBe(true);
    expect(isTrackedTip("left_end", 1)).toBe(false);
    expect(isTrackedTip("right_end", 0)).toBe(false);
    expect(isTrackedTip("right_end", 1)).toBe(true);
    expect(isTrackedTip("both_ends", 0)).toBe(true);
    expect(isTrackedTip("both_ends", 1)).toBe(true);
  });
});
