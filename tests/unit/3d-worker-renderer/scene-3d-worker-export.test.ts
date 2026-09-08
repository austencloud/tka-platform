import { describe, expect, it } from "vitest";
import { Group, Quaternion } from "three";
import {
  createStaffObject,
  getAvatarModelPath,
} from "@austencloud/scene-3d/worker";

describe("scene-3d worker export", () => {
  it("exposes the renderer-neutral avatar and staff surface", () => {
    expect(getAvatarModelPath("x-bot")).toContain("x-bot");

    const staff = createStaffObject({
      color: "blue",
      length: 0.86,
      thickness: 0.0125,
      layer: 3,
    });

    expect(staff.root.name).toBe("staff-blue");
    expect(staff.root.layers.mask).toBe(1 << 3);
    expect(staff.root.getObjectByName("staff-rotated-body")).toBeTruthy();
    expect(staff.root.getObjectByName("staff-trail-indicator")).toBeTruthy();

    staff.setState({ worldRotation: new Quaternion() });
    expect(
      staff.root.getObjectByName("staff-rotated-body")?.quaternion.length()
    ).toBeCloseTo(1);

    const parent = new Group();
    parent.add(staff.root);
    staff.dispose();
    expect(staff.root.parent).toBeNull();
    expect(parent.children).toHaveLength(0);
    expect(staff.root.children).toHaveLength(0);
  });
});
