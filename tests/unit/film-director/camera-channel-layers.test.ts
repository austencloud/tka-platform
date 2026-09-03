/**
 * The layer stack, and what taking a channel costs.
 *
 * The channel architecture's central claim is decision D2: layers compose
 * bottom to top, and the topmost layer that owns a channel owns it whole. That
 * makes two things testable that the fused keyframe list could not even state.
 *
 *   - A manual channel replaces exactly its own scalar. Everything else keeps
 *     sampling out of the layer below, unchanged.
 *   - Seeding is copy-on-write from what composed underneath, so promoting a
 *     channel and then changing nothing is a no-op the sampler cannot see.
 *
 * Those two together are what makes an override safe to try: it changes what
 * you touched and it is exactly reversible.
 */
import { describe, expect, it } from "vitest";

import {
  buildCameraChannels,
  cameraChannelGroup,
  holdsFlatForChannel,
  isCameraChannelId,
  resolveChannel,
  sampleCameraChannel,
  sampleCameraFrame,
  seedManualChannel,
  type ManualCameraChannel,
} from "../../../src/routes/test/film-director/_lib/director-camera-channels";
import type { ResolvedDirectorCameraKeyframe } from "../../../src/routes/test/film-director/_lib/film-director-schema";

/** A dolly right while the lens widens, so several channels differ over time. */
const KEYFRAMES: ResolvedDirectorCameraKeyframe[] = [
  {
    atSeconds: 0,
    position: [0, 1.5, -6],
    target: [0, 1.5, 0],
    fovDeg: 40,
    interpolation: "smooth",
    easing: "ease-in-out",
  },
  {
    atSeconds: 2,
    position: [2, 1.5, -6],
    target: [0, 1.5, 0],
    fovDeg: 50,
    interpolation: "smooth",
    easing: "ease-in-out",
  },
  {
    atSeconds: 4,
    position: [4, 1.5, -6],
    target: [0, 1.5, 0],
    fovDeg: 60,
    interpolation: "smooth",
    easing: "ease-in-out",
  },
];

function manualHeight(value: number): ManualCameraChannel[] {
  return [
    {
      id: "camera.position.y",
      keys: [
        {
          atSeconds: 0,
          value,
          interpolation: "smooth",
          easing: "ease-in-out",
        },
      ],
    },
  ];
}

describe("channel addresses", () => {
  it("narrows a real address and rejects anything else", () => {
    expect(isCameraChannelId("camera.lens.fov")).toBe(true);
    expect(isCameraChannelId("camera.lens.aperture")).toBe(false);
  });

  it("holds a flat segment for the lens and the aim, not for the rig", () => {
    expect(holdsFlatForChannel("camera.lens.fov")).toBe(true);
    expect(holdsFlatForChannel("camera.roll")).toBe(true);
    expect(holdsFlatForChannel("camera.aim.yaw")).toBe(true);
    expect(holdsFlatForChannel("camera.position.x")).toBe(false);
  });

  it("moves the three aim scalars as one group and everything else alone", () => {
    expect(cameraChannelGroup("camera.aim.pitch")).toEqual([
      "camera.aim.yaw",
      "camera.aim.pitch",
      "camera.aim.distance",
    ]);
    expect(cameraChannelGroup("camera.target.x")).toEqual(["camera.target.x"]);
  });
});

describe("the manual layer owns a channel outright", () => {
  it("replaces its own scalar", () => {
    const store = buildCameraChannels(KEYFRAMES, manualHeight(9));
    expect(sampleCameraFrame(store, 1).position[1]).toBeCloseTo(9, 9);
  });

  it("leaves every other channel sampling out of the layer below", () => {
    const base = buildCameraChannels(KEYFRAMES);
    const layered = buildCameraChannels(KEYFRAMES, manualHeight(9));
    for (let step = 0; step <= 8; step += 1) {
      const at = (step / 8) * 4;
      const before = sampleCameraFrame(base, at);
      const after = sampleCameraFrame(layered, at);
      expect(after.position[0]).toBeCloseTo(before.position[0], 9);
      expect(after.position[2]).toBeCloseTo(before.position[2], 9);
      expect(after.fovDeg).toBeCloseTo(before.fovDeg, 9);
      expect(after.rollDeg).toBeCloseTo(before.rollDeg, 9);
    }
  });

  it("resolves to the manual channel rather than the base one", () => {
    const store = buildCameraChannels(KEYFRAMES, manualHeight(9));
    expect(resolveChannel(store, "camera.position.y")!.keys).toHaveLength(1);
    expect(resolveChannel(store, "camera.position.x")!.keys).toHaveLength(3);
  });

  it("ignores a channel that states no keys, which owns nothing", () => {
    const store = buildCameraChannels(KEYFRAMES, [
      { id: "camera.position.y", keys: [] },
    ]);
    expect(resolveChannel(store, "camera.position.y")!.keys).toHaveLength(3);
  });

  it("sorts keys it was handed out of order", () => {
    const store = buildCameraChannels(KEYFRAMES, [
      {
        id: "camera.lens.fov",
        keys: [
          { atSeconds: 3, value: 80, interpolation: "smooth", easing: "linear" },
          { atSeconds: 1, value: 30, interpolation: "smooth", easing: "linear" },
        ],
      },
    ]);
    expect(resolveChannel(store, "camera.lens.fov")!.keys.map((key) => key.t))
      .toEqual([1, 3]);
  });
});

describe("seeding is copy-on-write", () => {
  it("promoting a channel and changing nothing changes nothing", () => {
    const base = buildCameraChannels(KEYFRAMES);
    const seeded = seedManualChannel(base, "camera.position.x");
    const promoted = buildCameraChannels(KEYFRAMES, [seeded]);
    for (let step = 0; step <= 40; step += 1) {
      const at = (step / 40) * 4;
      expect(sampleCameraFrame(promoted, at).position[0]).toBeCloseTo(
        sampleCameraFrame(base, at).position[0],
        9
      );
    }
  });

  it("seeds from what composed underneath, not from the bottom layer", () => {
    const layered = buildCameraChannels(KEYFRAMES, manualHeight(9));
    expect(seedManualChannel(layered, "camera.position.y").keys).toEqual([
      { atSeconds: 0, value: 9, interpolation: "smooth", easing: "ease-in-out" },
    ]);
  });

  it("seeds an unowned channel as one honest key at zero", () => {
    const empty = buildCameraChannels([]);
    expect(seedManualChannel(empty, "camera.lens.fov", 50).keys).toEqual([
      {
        atSeconds: 0,
        value: 50,
        interpolation: "smooth",
        easing: "ease-in-out",
      },
    ]);
  });

  it("carries each key's own interpolation and easing across the promotion", () => {
    const cut: ResolvedDirectorCameraKeyframe[] = [
      { ...KEYFRAMES[0]!, interpolation: "step", easing: "linear" },
      KEYFRAMES[1]!,
    ];
    const seeded = seedManualChannel(
      buildCameraChannels(cut),
      "camera.position.x"
    );
    expect(seeded.keys[0]!.interpolation).toBe("step");
    expect(seeded.keys[0]!.easing).toBe("linear");
  });
});

describe("hand-keying the aim direction", () => {
  /**
   * The trap this covers: the aim point is assembled from yaw, pitch and
   * distance only while the governing yaw key says `aimSpace: "angles"`. A
   * manual yaw channel that did not say so would be built, sampled, and then
   * discarded in favour of the cartesian target channels underneath — so
   * dragging a pan key would appear to do nothing at all.
   */
  it("takes effect, which means the yaw is what steers the target", () => {
    const store = buildCameraChannels(KEYFRAMES, [
      {
        id: "camera.aim.yaw",
        keys: [
          { atSeconds: 0, value: 90, interpolation: "smooth", easing: "linear" },
        ],
      },
      {
        id: "camera.aim.pitch",
        keys: [
          { atSeconds: 0, value: 0, interpolation: "smooth", easing: "linear" },
        ],
      },
      {
        id: "camera.aim.distance",
        keys: [
          { atSeconds: 0, value: 6, interpolation: "smooth", easing: "linear" },
        ],
      },
    ]);
    const frame = sampleCameraFrame(store, 1);
    // Yaw 90 degrees from a rig on the x axis looks along +x, six metres out.
    expect(frame.target[0] - frame.position[0]).toBeCloseTo(6, 6);
    expect(frame.target[2] - frame.position[2]).toBeCloseTo(0, 6);
  });

  it("holds a stated hold rather than letting the spline bow it", () => {
    const store = buildCameraChannels(KEYFRAMES, [
      {
        id: "camera.aim.yaw",
        keys: [
          { atSeconds: 0, value: 0, interpolation: "smooth", easing: "linear" },
          { atSeconds: 1, value: 30, interpolation: "smooth", easing: "linear" },
          { atSeconds: 2, value: 30, interpolation: "smooth", easing: "linear" },
          { atSeconds: 3, value: 90, interpolation: "smooth", easing: "linear" },
        ],
      },
    ]);
    const yaw = resolveChannel(store, "camera.aim.yaw")!;
    expect(sampleCameraChannel(yaw, 1.5)).toBeCloseTo(30, 9);
  });
});
