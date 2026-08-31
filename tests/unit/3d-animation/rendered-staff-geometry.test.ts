import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Quaternion, Vector3 } from "three";
import { buildRenderedStaffSegment } from "@austencloud/scene-3d";

describe("buildRenderedStaffSegment", () => {
  it("uses the grip-welded world transform instead of an authored axis", () => {
    const grip = new Vector3(1, 2, 3);
    const weldedWorldRotation = new Quaternion().setFromAxisAngle(
      new Vector3(0, 0, 1),
      Math.PI / 2
    );
    const a = new Vector3();
    const b = new Vector3();

    buildRenderedStaffSegment(grip, weldedWorldRotation, 0.5, a, b);

    expect(a.distanceTo(new Vector3(0.5, 2, 3))).toBeLessThan(1e-6);
    expect(b.distanceTo(new Vector3(1.5, 2, 3))).toBeLessThan(1e-6);
  });

  it("feeds collision and head avoidance from the correction-group pose", () => {
    const avatarSource = readFileSync(
      resolve(
        process.cwd(),
        "node_modules/@austencloud/scene-3d/src/lib/components/Avatar3D.svelte"
      ),
      "utf8"
    );

    expect(avatarSource).toMatch(
      /updateRenderedStaffPose\(\s*bluePropCorrectionRef,\s*bluePropAnchorRef/
    );
    expect(avatarSource).toMatch(
      /buildRenderedStaffSegment\(\s*_blueRenderedGrip,\s*_blueRenderedStaffQuat/
    );
    expect(avatarSource).not.toContain(
      "buildStaffSegment(\n          blueWorldProp.worldPosition"
    );
  });
});
