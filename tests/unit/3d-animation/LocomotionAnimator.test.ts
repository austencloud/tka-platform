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

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks.length).toBe(3);
  });

  it("excludes Hips quaternion from main clip", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigHips.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks.length).toBe(1);
    expect(main.tracks[0].name).toContain("Spine");
  });

  it("separates Hips position into additive delta clip", () => {
    const clip = new AnimationClip("test", 1, [
      new VectorKeyframeTrack("mixamorigHips.position", [0, 0.5, 1], [
        0, 95, 0,   // frame 0: base position
        1, 96, 0.5, // frame 1: shifted
        0, 95, 0,   // frame 2: back to base
      ]),
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const { main, hipsPosition } = retargetFullBody(clip, "mixamorig");

    // Main clip should NOT contain the hips position track
    expect(main.tracks.length).toBe(1);
    expect(main.tracks[0].name).toContain("Spine");

    // Hips position clip should exist with delta values
    expect(hipsPosition).not.toBeNull();
    expect(hipsPosition!.tracks.length).toBe(1);

    const posTrack = hipsPosition!.tracks[0];
    const v = posTrack.values;
    // X and Z zeroed (no horizontal drift), Y is delta from first frame
    // Frame 0: (0, 0, 0)
    expect(v[0]).toBe(0);
    expect(v[1]).toBe(0);
    expect(v[2]).toBe(0);
    // Frame 1: X=0 (zeroed), Y=96-95=1, Z=0 (zeroed)
    expect(v[3]).toBe(0);
    expect(v[4]).toBe(1);
    expect(v[5]).toBe(0);
    // Frame 2: back to (0, 0, 0)
    expect(v[6]).toBe(0);
    expect(v[7]).toBe(0);
    expect(v[8]).toBe(0);
  });

  it("returns null hipsPosition when no Hips position track exists", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const { hipsPosition } = retargetFullBody(clip, "mixamorig");
    expect(hipsPosition).toBeNull();
  });

  it("excludes non-Hips position tracks", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
      new VectorKeyframeTrack("mixamorigSpine.position", [0], [0, 0, 0]),
    ]);

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks.length).toBe(1);
    expect(main.tracks[0].name).toContain("quaternion");
  });

  it("excludes scale tracks", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigSpine.quaternion", [0], [0, 0, 0, 1]),
      new VectorKeyframeTrack("mixamorigSpine.scale", [0], [1, 1, 1]),
    ]);

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks.length).toBe(1);
  });

  it("excludes finger tip bones (segment 4+)", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigLeftHandThumb3.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigLeftHandThumb4.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigLeftHandIndex4.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks.length).toBe(1);
    expect(main.tracks[0].name).toContain("Thumb3");
  });

  it("excludes end/terminal bones", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorigHead.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigHeadTop_End.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigLeftToe_End.quaternion", [0], [0, 0, 0, 1]),
      new QuaternionKeyframeTrack("mixamorigRightToe_End.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks.length).toBe(1);
    expect(main.tracks[0].name).toContain("Head");
  });

  it("retargets bone names in output tracks", () => {
    const clip = new AnimationClip("test", 1, [
      new QuaternionKeyframeTrack("mixamorig1LeftArm.quaternion", [0], [0, 0, 0, 1]),
    ]);

    const { main } = retargetFullBody(clip, "mixamorig");
    expect(main.tracks[0].name).toBe("mixamorigLeftArm.quaternion");
  });
});
