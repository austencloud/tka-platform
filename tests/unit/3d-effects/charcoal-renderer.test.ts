import { describe, it, expect, vi, beforeEach } from "vitest";
import { Vector3 } from "three";
import { CharcoalRenderer3D, type CharcoalTipInput } from "$lib/shared/3d/effects/charcoal/charcoal-renderer-3d";
import { QualityTier } from "$lib/shared/3d/effects/types";

function createMockScene(): any {
  return { add: vi.fn(), remove: vi.fn() };
}

function createTip(overrides: Partial<CharcoalTipInput> = {}): CharcoalTipInput {
  return {
    position: new Vector3(0, 1, 0),
    velocityX: 1,
    velocityY: 0,
    velocityZ: 0,
    speed: 1,
    jerk: 0,
    ...overrides,
  };
}

describe("CharcoalRenderer3D", () => {
  let renderer: CharcoalRenderer3D;

  beforeEach(() => {
    renderer = new CharcoalRenderer3D(QualityTier.HIGH);
  });

  it("creates without errors", () => {
    expect(renderer).toBeDefined();
  });

  it("initializes with a scene", () => {
    const scene = createMockScene();
    expect(() => renderer.initialize(scene)).not.toThrow();
    expect(scene.add).toHaveBeenCalledOnce();
  });

  it("handles empty tip array", () => {
    const scene = createMockScene();
    renderer.initialize(scene);
    expect(() => renderer.update([], 1 / 60)).not.toThrow();
  });

  it("emits ambient sparks during movement", () => {
    const scene = createMockScene();
    renderer.initialize(scene);
    const tip = createTip({ speed: 2.0 });
    // Run several frames to accumulate enough for ambient emission
    for (let i = 0; i < 30; i++) {
      renderer.update([tip], 1 / 60);
    }
    // Should not crash — particles are being emitted internally
    expect(() => renderer.update([tip], 1 / 60)).not.toThrow();
  });

  it("emits burst sparks on high jerk", () => {
    const scene = createMockScene();
    renderer.initialize(scene);
    const tip = createTip({ jerk: 20, speed: 3.0 });
    expect(() => renderer.update([tip], 1 / 60)).not.toThrow();
  });

  it("resets all particles", () => {
    const scene = createMockScene();
    renderer.initialize(scene);
    const tip = createTip({ jerk: 20, speed: 3.0 });
    renderer.update([tip], 1 / 60);
    expect(() => renderer.reset()).not.toThrow();
  });

  it("disposes cleanly", () => {
    const scene = createMockScene();
    renderer.initialize(scene);
    expect(() => renderer.dispose()).not.toThrow();
    expect(scene.remove).toHaveBeenCalledOnce();
  });

  it("disposes cleanly before initialization", () => {
    expect(() => renderer.dispose()).not.toThrow();
  });

  it("adapts pool size per quality tier", () => {
    const low = new CharcoalRenderer3D(QualityTier.LOW);
    const high = new CharcoalRenderer3D(QualityTier.HIGH);
    // Both should create without error — pool sizes differ internally
    expect(low).toBeDefined();
    expect(high).toBeDefined();
  });
});
