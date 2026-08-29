import { Bone } from "three";
import { describe, expect, it } from "vitest";

import type { BoneName } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/contracts/IAvatarSkeletonBuilder";
import { AvatarSkeletonBuilder } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarSkeletonBuilder";

type TestableSkeletonBuilder = {
  mapBoneToMap: (bone: Bone, bones: Map<BoneName, Bone>) => void;
};

describe("avatar skeleton canonical bone mapping", () => {
  it("keeps each canonical spine bone at its authored level", () => {
    const builder =
      new AvatarSkeletonBuilder() as unknown as TestableSkeletonBuilder;
    const mappedBones = new Map<BoneName, Bone>();

    for (const name of ["Spine", "Spine1", "Spine2"] as const) {
      const bone = new Bone();
      bone.name = name;
      builder.mapBoneToMap(bone, mappedBones);
    }

    expect(mappedBones.get("Spine")?.name).toBe("Spine");
    expect(mappedBones.get("Spine1")?.name).toBe("Spine1");
    expect(mappedBones.get("Spine2")?.name).toBe("Spine2");
  });
});
