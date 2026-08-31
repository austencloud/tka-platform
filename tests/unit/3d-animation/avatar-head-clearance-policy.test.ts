import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageRoot = resolve(
  process.cwd(),
  "node_modules/@austencloud/scene-3d"
);

const animatorSource = readFileSync(
  resolve(
    packageRoot,
    "src/lib/services/implementations/AvatarAnimator.ts"
  ),
  "utf8"
);

const animatorRuntime = readFileSync(
  resolve(packageRoot, "dist/lib/services/implementations/AvatarAnimator.js"),
  "utf8"
);

describe("avatar head-clearance policy", () => {
  it("keeps unreachable-target posture compensation within four degrees", () => {
    expect(animatorSource).toContain(
      "const MAX_REACH_LEAN = (4 * Math.PI) / 180"
    );
    expect(animatorRuntime).toContain(
      "const MAX_REACH_LEAN = (4 * Math.PI) / 180"
    );
  });

  it.each([
    ["source", animatorSource],
    ["runtime", animatorRuntime],
  ])(
    "lets the elbow solver own arm-to-face clearance in the %s build",
    (_label, animator) => {
      expect(animator).not.toContain("MAX_FOREARM_HEAD_DODGE");
      expect(animator).not.toContain("FOREARM_DODGE_ENGAGE_DISTANCE");
      expect(animator).not.toContain("forearmDodgeEnabled");
      expect(animator).not.toContain("evaluateForearm");
    }
  );

  it("retains staff-driven head avoidance", () => {
    const methodStart = animatorSource.indexOf("private applyHeadDodge(");
    const methodEnd = animatorSource.indexOf(
      "private applyWorldHeadDodge(",
      methodStart
    );
    const method = animatorSource.slice(methodStart, methodEnd);

    expect(methodStart).toBeGreaterThan(-1);
    expect(methodEnd).toBeGreaterThan(methodStart);
    expect(method).toContain("this.headThreats.length");
    expect(method).toContain("targetAngle = bestFactor * MAX_HEAD_DODGE");
    expect(method).not.toContain("getLeftArmChain");
    expect(method).not.toContain("getRightArmChain");
  });
});
