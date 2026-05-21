import { describe, it, expect, beforeEach } from "vitest";
import { FishEventSystem } from "$lib/shared/3d/environments/scenes/ocean/FishEventSystem";
import { Vector3 } from "three";

function makeTraits(fishCount: number): Float32Array {
  const data = new Float32Array(fishCount * 4);
  for (let i = 0; i < fishCount; i++) {
    data[i * 4 + 0] = 1.0;  // speedMult
    data[i * 4 + 1] = 1.0;  // socialMult
    data[i * 4 + 2] = 0.8;  // boldness
    data[i * 4 + 3] = 0.5;  // dartSeed
  }
  return data;
}

function makeUniforms() {
  return {
    uDartCount: { value: 0 },
    uDartIndices: { value: new Int32Array(8).fill(-1) },
    uDartStrength: { value: 2.0 },
    uExcursionCount: { value: 0 },
    uExcursionIndices: { value: new Int32Array(4).fill(-1) },
    uExcursionBias: { value: new Float32Array(4) },
    uScatterOrigin: { value: new Vector3() },
  };
}

describe("FishEventSystem", () => {
  let system: FishEventSystem;
  let uniforms: ReturnType<typeof makeUniforms>;
  const fishCount = 10;

  beforeEach(() => {
    system = new FishEventSystem(fishCount, makeTraits(fishCount));
    uniforms = makeUniforms();
  });

  it("initializes with zero active darts", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(0, uniforms, ray);
    expect(uniforms.uDartCount.value).toBe(0);
  });

  it("fires darts after cooldown expires", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(20, uniforms, ray);
    expect(uniforms.uDartCount.value).toBeGreaterThan(0);
    expect(uniforms.uDartCount.value).toBeLessThanOrEqual(8);
  });

  it("limits active darts to 8 max", () => {
    const bigSystem = new FishEventSystem(100, makeTraits(100));
    const ray = new Vector3(100, 100, 100);
    bigSystem.tick(50, uniforms, ray);
    expect(uniforms.uDartCount.value).toBeLessThanOrEqual(8);
  });

  it("clears darts each tick (single-frame impulses)", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(20, uniforms, ray);
    const firstCount = uniforms.uDartCount.value;
    expect(firstCount).toBeGreaterThan(0);
    system.tick(0.016, uniforms, ray);
    expect(uniforms.uDartCount.value).toBeLessThanOrEqual(8);
  });

  it("copies ray position to scatter uniform", () => {
    const ray = new Vector3(5, 3, -2);
    system.tick(0.016, uniforms, ray);
    expect(uniforms.uScatterOrigin.value.x).toBe(5);
    expect(uniforms.uScatterOrigin.value.y).toBe(3);
    expect(uniforms.uScatterOrigin.value.z).toBe(-2);
  });

  it("fires vertical excursions", () => {
    const ray = new Vector3(100, 100, 100);
    system.tick(30, uniforms, ray);
    expect(uniforms.uExcursionCount.value).toBeGreaterThanOrEqual(0);
    expect(uniforms.uExcursionCount.value).toBeLessThanOrEqual(4);
  });

  it("boldness affects dart cooldown — timid fish dart sooner", () => {
    const timidTraits = new Float32Array(4 * 4);
    const boldTraits = new Float32Array(4 * 4);
    for (let i = 0; i < 4; i++) {
      timidTraits[i * 4 + 2] = 0.5;
      timidTraits[i * 4 + 3] = 0.5;
      boldTraits[i * 4 + 2] = 1.3;
      boldTraits[i * 4 + 3] = 0.5;
    }
    const timidSystem = new FishEventSystem(4, timidTraits);
    const boldSystem = new FishEventSystem(4, boldTraits);
    const timidUniforms = makeUniforms();
    const boldUniforms = makeUniforms();
    const ray = new Vector3(100, 100, 100);
    timidSystem.tick(8, timidUniforms, ray);
    boldSystem.tick(8, boldUniforms, ray);
    expect(timidUniforms.uDartCount.value).toBeGreaterThanOrEqual(
      boldUniforms.uDartCount.value
    );
  });
});
