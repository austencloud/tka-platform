import { describe, it, expect } from "vitest";
import { AnimationClip, QuaternionKeyframeTrack, VectorKeyframeTrack } from "three";
import {
  extractCoreBoneName,
  retargetTrackName,
  retargetFullBody,
} from "$lib/shared/3d/services/implementations/LocomotionAnimator";

describe("extractCoreBoneName", () => {
  it("strips mixamorig prefix", () => {
    expect(extractCoreBoneName("mixamorigLeftArm")).toBe("LeftArm");
  });

  it("strips mixamorig1 prefix", () => {
    expect(extractCoreBoneName("mixamorig1Hips")).toBe("Hips");
  });

  it("strips mixamorig: prefix", () => {
    expect(extractCoreBoneName("mixamorig:Spine")).toBe("Spine");
  });

  it("maps characters3d.com leg names", () => {
    expect(extractCoreBoneName("characters3dcom___L_Thigh")).toBe("LeftUpLeg");
    expect(extractCoreBoneName("characters3dcom___R_Calf")).toBe("RightLeg");
  });

  it("maps characters3d.com arm names", () => {
    expect(extractCoreBoneName("characters3dcom___L_Arm")).toBe("LeftArm");
    expect(extractCoreBoneName("characters3dcom___R_ForeArm")).toBe("RightForeArm");
  });

  it("returns standard names unchanged", () => {
    expect(extractCoreBoneName("LeftForeArm")).toBe("LeftForeArm");
    expect(extractCoreBoneName("Hips")).toBe("Hips");
  });

  it("maps alternate naming conventions", () => {
    expect(extractCoreBoneName("LeftUpperArm")).toBe("LeftArm");
    expect(extractCoreBoneName("Chest")).toBe("Spine1");
    expect(extractCoreBoneName("UpperChest")).toBe("Spine2");
  });
});

describe("retargetTrackName", () => {
  it("retargets mixamorig1 to target prefix", () => {
    expect(retargetTrackName("mixamorig1LeftArm.quaternion", "mixamorig")).toBe(
      "mixamorigLeftArm.quaternion"
    );
  });

  it("retargets characters3d names to target prefix", () => {
    expect(
      retargetTrackName("characters3dcom___L_Thigh.quaternion", "mixamorig")
    ).toBe("mixamorigLeftUpLeg.quaternion");
  });

  it("preserves property name through retarget", () => {
    expect(retargetTrackName("mixamorigHips.position", "")).toBe(
      "Hips.position"
    );
  });
});

describe("retargetFullBody", () => {
  it("keeps all quaternion tracks (not just legs)", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigLeftArm.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigLeftUpLeg.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const result = retargetFullBody(clip, "mixamorig");
    expect(result.tracks.length).toBe(3); // ALL kept, not just legs
  });

  it("excludes Hips quaternion tracks (locomotion controls orientation)", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigHips.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const result = retargetFullBody(clip, "mixamorig");
    expect(result.tracks.length).toBe(1);
    expect(result.tracks[0].name).toContain("Spine");
  });

  it("excludes position tracks", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
      new VectorKeyframeTrack("mixamorigSpine.position", [0], [0, 0, 0]),
    ]);

    const result = retargetFullBody(clip, "mixamorig");
    expect(result.tracks.length).toBe(1);
    expect(result.tracks[0].name).toContain("quaternion");
  });

  it("excludes scale tracks", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
      new VectorKeyframeTrack("mixamorigSpine.scale", [0], [1, 1, 1]),
    ]);

    const result = retargetFullBody(clip, "mixamorig");
    expect(result.tracks.length).toBe(1);
  });

  it("retargets bone names in output tracks", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorig1LeftArm.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const result = retargetFullBody(clip, "mixamorig");
    expect(result.tracks[0].name).toBe("mixamorigLeftArm.quaternion");
  });
});
