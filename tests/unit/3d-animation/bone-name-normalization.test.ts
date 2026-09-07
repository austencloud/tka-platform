import { Bone, Object3D, Skeleton, SkinnedMesh } from "three";
import { describe, expect, it, vi } from "vitest";
import { normalizeBoneName } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/bone-name-normalization";
import { AvatarSkeletonBuilder } from "../../../node_modules/@austencloud/scene-3d/src/lib/services/implementations/AvatarSkeletonBuilder";
import {
  FINGER_BONES,
  type FingerChains,
} from "../../../node_modules/@austencloud/scene-3d/src/lib/domain/models/GripPose";

/**
 * Catalog rigs keep the Mixamo export namespace on every joint
 * (`mixamorig:LeftHandThumb1`, `mixamorig12:LeftHandThumb1`), while rigs that
 * went through character intake have it stripped (`hand_l`, `thumb1_l`). Both
 * have to resolve, or the wrist goal, palm socket and shaft-channel correction
 * silently switch themselves off.
 */

/** Build a skeleton whose finger joints follow one naming convention. */
function skeletonWith(fingerName: (side: "Left" | "Right", bone: string) => string): Skeleton {
  const bones: Bone[] = [];
  for (const side of ["Left", "Right"] as const) {
    const hand = new Bone();
    hand.name = fingerName(side, "Hand").replace(/hand$/i, "Hand");
    bones.push(hand);
    for (const bone of FINGER_BONES) {
      const joint = new Bone();
      joint.name = fingerName(side, bone);
      bones.push(joint);
    }
  }
  return new Skeleton(bones);
}

/** Invoke the builder's private chain resolution against a synthetic skeleton. */
function resolveChains(skeleton: Skeleton | null, label = "test-rig"): FingerChains | null {
  const builder = new AvatarSkeletonBuilder() as unknown as {
    skeleton: Skeleton | null;
    buildFingerChains(label: string): FingerChains | null;
  };
  builder.skeleton = skeleton;
  return builder.buildFingerChains(label);
}

describe("normalizeBoneName", () => {
  it("drops a Mixamo export namespace, with or without digits", () => {
    expect(normalizeBoneName("mixamorig:LeftHandThumb1")).toBe("lefthandthumb1");
    expect(normalizeBoneName("mixamorig12:LeftHandThumb1")).toBe("lefthandthumb1");
    expect(normalizeBoneName("mixamorig8:RightHand")).toBe("righthand");
  });

  it("drops the namespace three.js has already sanitized the colon out of", () => {
    // PropertyBinding.sanitizeNodeName deletes `[ ] . : /`, so by the time a
    // loaded GLB reaches this package the separator is gone.
    expect(normalizeBoneName("mixamorigLeftHandThumb1")).toBe("lefthandthumb1");
    expect(normalizeBoneName("mixamorig12LeftHandThumb1")).toBe("lefthandthumb1");
    expect(normalizeBoneName("mixamorig8RightHand")).toBe("righthand");
  });

  it("leaves every supported unprefixed convention untouched apart from case", () => {
    expect(normalizeBoneName("LeftHandThumb1")).toBe("lefthandthumb1");
    expect(normalizeBoneName("L_Thumb1")).toBe("l_thumb1");
    expect(normalizeBoneName("thumb1_l")).toBe("thumb1_l");
    expect(normalizeBoneName("hand_l")).toBe("hand_l");
  });

  it("strips only the leading namespace segment, never name content", () => {
    // A colon is the namespace separator; anything after the first one is the
    // joint's own name and must survive verbatim.
    expect(normalizeBoneName("Armature:index_04_leaf_l")).toBe("index_04_leaf_l");
    expect(normalizeBoneName("rig:a:b")).toBe("a:b");
    expect(normalizeBoneName("thumb1_l")).not.toBe("");
  });
});

describe("finger chain resolution across naming conventions", () => {
  it("resolves a namespaced Mixamo rig (the 12 shipped catalog characters)", () => {
    const chains = resolveChains(
      skeletonWith((side, bone) => `mixamorig:${side}Hand${bone}`)
    );
    expect(chains).not.toBeNull();
    expect(chains?.left.size).toBe(FINGER_BONES.length);
    expect(chains?.right.size).toBe(FINGER_BONES.length);
    expect(chains?.left.get("Thumb1")?.name).toBe("mixamorig:LeftHandThumb1");
  });

  it("resolves a re-uploaded Mixamo rig whose namespace carries digits", () => {
    const chains = resolveChains(
      skeletonWith((side, bone) => `mixamorig12:${side}Hand${bone}`)
    );
    expect(chains).not.toBeNull();
    expect(chains?.right.get("Pinky3")?.name).toBe("mixamorig12:RightHandPinky3");
  });

  it("resolves the sanitized names three.js actually hands the runtime", () => {
    // This is the shape every shipped catalog rig arrives in: the GLB carries
    // `mixamorig:LeftHandThumb1`, and three deletes the colon on load.
    const chains = resolveChains(
      skeletonWith((side, bone) => `mixamorig${side}Hand${bone}`)
    );
    expect(chains?.left.size).toBe(FINGER_BONES.length);
    expect(chains?.left.get("Thumb1")?.name).toBe("mixamorigLeftHandThumb1");

    const reuploaded = resolveChains(
      skeletonWith((side, bone) => `mixamorig12${side}Hand${bone}`)
    );
    expect(reuploaded?.right.size).toBe(FINGER_BONES.length);
  });

  it("still resolves the three unprefixed conventions", () => {
    const mixamo = resolveChains(skeletonWith((side, bone) => `${side}Hand${bone}`));
    expect(mixamo?.left.size).toBe(FINGER_BONES.length);

    const characters3d = resolveChains(
      skeletonWith((side, bone) => `${side === "Left" ? "L" : "R"}_${bone}`)
    );
    expect(characters3d?.left.get("Index2")?.name).toBe("L_Index2");

    const unreal = resolveChains(
      skeletonWith(
        (side, bone) => `${bone.toLowerCase()}_${side === "Left" ? "l" : "r"}`
      )
    );
    expect(unreal?.right.get("Middle1")?.name).toBe("middle1_r");
  });

  it("keeps the two hands apart under every convention", () => {
    for (const naming of [
      (side: "Left" | "Right", bone: string) => `mixamorig:${side}Hand${bone}`,
      (side: "Left" | "Right", bone: string) =>
        `${side === "Left" ? "L" : "R"}_${bone}`,
      (side: "Left" | "Right", bone: string) =>
        `${bone.toLowerCase()}_${side === "Left" ? "l" : "r"}`,
    ]) {
      const chains = resolveChains(skeletonWith(naming));
      for (const bone of FINGER_BONES) {
        expect(chains?.left.get(bone)).not.toBe(chains?.right.get(bone));
      }
    }
  });

  it("returns null and warns once for a rig with no finger joints", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spine = new Bone();
    spine.name = "mixamorig:Spine";
    const hand = new Bone();
    hand.name = "mixamorig:LeftHand";

    expect(resolveChains(new Skeleton([spine, hand]), "fingerless-rig")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("fingerless-rig");
    expect(warn.mock.calls[0]?.[0]).toContain("found 0 of 30");

    // Same model reloading must not turn a load-time fact into log spam.
    expect(resolveChains(new Skeleton([spine, hand]), "fingerless-rig")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("reports the partial count when only one hand is rigged", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bones: Bone[] = [];
    for (const bone of FINGER_BONES) {
      const joint = new Bone();
      joint.name = `mixamorig:LeftHand${bone}`;
      bones.push(joint);
    }

    expect(resolveChains(new Skeleton(bones), "one-handed-rig")).toBeNull();
    expect(warn.mock.calls[0]?.[0]).toContain("found 15 of 30");
    expect(warn.mock.calls[0]?.[0]).toContain("RightThumb1");
    warn.mockRestore();
  });
});

describe("skeleton selection across a character's several skins", () => {
  /**
   * Catalog characters are exported as a body plus clothing: ch01 ships five
   * skinned meshes, ch07 and ch41 six. Every accessory carries its own reduced
   * skeleton, and in each of those rigs the finger-bearing body skin is not the
   * one traversed last.
   */
  function skinnedMeshWith(name: string, boneNames: string[]): SkinnedMesh {
    const mesh = new SkinnedMesh();
    mesh.name = name;
    mesh.bind(
      new Skeleton(
        boneNames.map((boneName) => {
          const bone = new Bone();
          bone.name = boneName;
          return bone;
        })
      )
    );
    return mesh;
  }

  function loadRoot(root: Object3D, label: string): FingerChains | null {
    const builder = new AvatarSkeletonBuilder() as unknown as {
      processGLTF(
        root: Object3D,
        preparedBounds: { height: number; minY: number } | null,
        label: string
      ): void;
      state: { fingerChains: FingerChains | null };
    };
    builder.processGLTF(root, { height: 1.7, minY: 0 }, label);
    return builder.state.fingerChains;
  }

  const bodyBones = [
    "mixamorig12:LeftHand",
    "mixamorig12:RightHand",
    ...(["Left", "Right"] as const).flatMap((side) =>
      FINGER_BONES.map((bone) => `mixamorig12:${side}Hand${bone}`)
    ),
  ];

  it("keeps the body skeleton when a clothing mesh is traversed last", () => {
    const root = new Object3D();
    root.add(skinnedMeshWith("Ch01_Body", bodyBones));
    root.add(
      skinnedMeshWith("Ch01_Pants", [
        "mixamorig12:Hips",
        "mixamorig12:LeftUpLeg",
        "mixamorig12:RightUpLeg",
      ])
    );

    const chains = loadRoot(root, "multi-skin-body-first");
    expect(chains).not.toBeNull();
    expect(chains?.left.size).toBe(FINGER_BONES.length);
    expect(chains?.right.size).toBe(FINGER_BONES.length);
  });

  it("keeps the body skeleton when it is traversed last", () => {
    const root = new Object3D();
    root.add(
      skinnedMeshWith("Ch07_Eyelashes", ["mixamorig12:Head", "mixamorig12:Neck"])
    );
    root.add(skinnedMeshWith("Ch07_Body", bodyBones));

    expect(loadRoot(root, "multi-skin-body-last")?.left.size).toBe(
      FINGER_BONES.length
    );
  });
});
