import { describe, it, expect } from "vitest";
import { MmLocomotionController } from "./mm-locomotion-controller";
import { makeFakeRig } from "./test-support/fake-rig";

describe("MmLocomotionController step-to-XZ", () => {
  it("moves the root toward the target position and settles", async () => {
    const rig = makeFakeRig();
    const c = new MmLocomotionController(rig);
    await c.initialize();
    c.setTargetPosition(0.3, 0.0);
    for (let i = 0; i < 240; i++) c.update(1 / 60); // 4 s
    expect(Math.abs(rig.root.position.x - 0.3)).toBeLessThan(0.02);
    expect(Math.abs(rig.root.position.z - 0.0)).toBeLessThan(0.02);
  });

  it("with no target, the root stays at origin (no regression)", async () => {
    const rig = makeFakeRig();
    const c = new MmLocomotionController(rig);
    await c.initialize();
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(Math.abs(rig.root.position.x)).toBeLessThan(1e-6);
    expect(Math.abs(rig.root.position.z)).toBeLessThan(1e-6);
  });
});
