import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { AvatarAnimator } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarAnimator";

type PoleStateProbe = {
  leftPoleVector: Vector3;
  leftClearancePoleVector: Vector3;
  rememberClearArmRoute: (
    side: "left" | "right",
    ratio: number,
    pole: Vector3
  ) => void;
};

const packageFile = (path: string) =>
  readFileSync(
    resolve(process.cwd(), "node_modules/@austencloud/scene-3d", path),
    "utf8"
  );

describe("avatar pole-clearance stability", () => {
  it("keeps collision routes out of the smoothed preferred-pole state", () => {
    const animator = new AvatarAnimator(
      {} as never,
      {} as never
    ) as unknown as PoleStateProbe;
    const preferredPole = new Vector3(0, 0, 1);
    const measuredClearPole = new Vector3(-1, 0, 0);

    animator.leftPoleVector.set(1, 0, 0);
    for (let frame = 0; frame < 60; frame++) {
      animator.leftPoleVector.lerp(preferredPole, 0.15).normalize();
      animator.rememberClearArmRoute("left", 1, measuredClearPole);
    }

    expect(animator.leftPoleVector.angleTo(preferredPole)).toBeLessThan(0.001);
    expect(
      animator.leftClearancePoleVector.angleTo(measuredClearPole)
    ).toBeLessThan(0.001);
  });

  it("ships the separated preferred and clearance states in source and runtime", () => {
    for (const code of [
      packageFile("src/lib/services/implementations/AvatarAnimator.ts"),
      packageFile("dist/lib/services/implementations/AvatarAnimator.js"),
    ]) {
      expect(code).toContain("leftClearancePoleVector");
      expect(code).toContain("rightClearancePoleVector");
      expect(code).not.toMatch(
        /leftPoleVector\.copy\([\s\S]{0,120}resolveForearmFaceClearance/
      );
      expect(code).not.toMatch(
        /rightPoleVector\.copy\([\s\S]{0,120}resolveForearmFaceClearance/
      );
    }
  });
});
