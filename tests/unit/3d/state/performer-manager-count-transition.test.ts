import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AVATAR_ID } from "@austencloud/scene-3d";
import { createPerformerManager } from "$lib/shared/3d/state/performer-manager.svelte";

describe("performer manager count transitions", () => {
  let now = 1_000;

  beforeEach(() => {
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pops a new performer into its destination while the existing cast slides", () => {
    const manager = createPerformerManager({
      initialAvatarId: DEFAULT_AVATAR_ID,
      maxPerformers: 8,
    });
    manager.initialize();

    const original = manager.performers[0];
    expect(original?.position.x).toBe(0);
    expect(original?.position.z).toBe(0);

    manager.addPerformer();

    const added = manager.performers[1];
    expect(added?.position.x).toBe(1);
    expect(added?.position.z).toBe(0);
    expect(original?.position.x).toBe(0);
    expect(original?.position.z).toBe(0);

    manager.updateFormationTransition(now + 160);
    expect(original?.position.x).toBeCloseTo(-0.5);
    expect(original?.position.z).toBe(0);
    expect(added?.position.x).toBe(1);
    expect(added?.position.z).toBe(0);

    manager.updateFormationTransition(now + 320);
    expect(original?.position.x).toBe(-1);
    expect(original?.position.z).toBe(0);
    expect(added?.position.x).toBe(1);
    expect(added?.position.z).toBe(0);

    manager.destroy();
  });

  it("removes immediately and slides survivors into the closed layout", () => {
    const manager = createPerformerManager({
      initialAvatarId: DEFAULT_AVATAR_ID,
      maxPerformers: 8,
    });
    manager.initialize();
    manager.addPerformer();
    manager.updateFormationTransition(now + 320);

    const survivor = manager.performers[0];
    expect(survivor?.position.x).toBe(-1);
    expect(survivor?.position.z).toBe(0);

    now = 2_000;
    manager.removePerformer();

    expect(manager.performers).toHaveLength(1);
    expect(survivor?.position.x).toBe(-1);
    expect(survivor?.position.z).toBe(0);

    manager.updateFormationTransition(now + 160);
    expect(survivor?.position.x).toBeCloseTo(-0.5);
    expect(survivor?.position.z).toBe(0);

    manager.updateFormationTransition(now + 320);
    expect(survivor?.position.x).toBe(0);
    expect(survivor?.position.z).toBe(0);

    manager.destroy();
  });
});
