/**
 * The lane arithmetic a channel row is made of.
 *
 * This is the half of the editor that is easy to get subtly wrong and
 * impossible to notice by looking: a range that collapses on a flat channel, a
 * y axis that runs the wrong way, a retime that lets one key overtake another
 * and silently rewrites which segment governs which span. None of those show
 * up as a broken-looking screen. They show up as a shot that changed.
 */
import { describe, expect, it } from "vitest";

import {
  channelCurvePoints,
  channelLabel,
  channelRange,
  formatChannelValue,
  keyAtPointer,
  laneCurvePath,
  laneX,
  laneY,
  MIN_KEY_GAP_SECONDS,
  moveKey,
  secondsAtLaneX,
  valueAtLaneY,
  CHANNEL_ROW_GROUPS,
} from "../../../src/routes/test/film-director/_lib/camera-channel-editor";
import {
  CAMERA_CHANNEL_IDS,
  type CameraChannel,
} from "../../../src/routes/test/film-director/_lib/director-camera-channels";
import type { ResolvedDirectorCameraChannelKey } from "../../../src/routes/test/film-director/_lib/film-director-schema";

function key(
  atSeconds: number,
  value: number
): ResolvedDirectorCameraChannelKey {
  return { atSeconds, value, interpolation: "smooth", easing: "ease-in-out" };
}

describe("every channel has a row", () => {
  it("names all of them exactly once", () => {
    const listed = CHANNEL_ROW_GROUPS.flatMap((group) => group.ids);
    expect([...listed].sort()).toEqual([...CAMERA_CHANNEL_IDS].sort());
  });

  it("labels and formats each one in the unit it is measured in", () => {
    expect(channelLabel("camera.aim.yaw")).toBe("Pan");
    expect(formatChannelValue("camera.aim.yaw", 12.34)).toBe("12.3°");
    expect(formatChannelValue("camera.position.y", 1.5)).toBe("1.50m");
  });
});

describe("channelRange", () => {
  it("pads a moving channel so its extremes are handles, not edges", () => {
    const range = channelRange([{ v: 0 }, { v: 10 }]);
    expect(range.min).toBeLessThan(0);
    expect(range.max).toBeGreaterThan(10);
  });

  it("gives a flat channel a band rather than a zero-height range", () => {
    const range = channelRange([{ v: 4 }, { v: 4 }]);
    expect(range.max - range.min).toBeGreaterThan(0);
    expect(range.min).toBeLessThan(4);
    expect(range.max).toBeGreaterThan(4);
  });

  it("still has height when the flat value is zero", () => {
    const range = channelRange([{ v: 0 }]);
    expect(range.max - range.min).toBeGreaterThan(0);
  });
});

describe("lane coordinates", () => {
  const range = { min: 0, max: 10 };

  it("runs time left to right and clamps outside the scene", () => {
    expect(laneX(0, 4)).toBe(0);
    expect(laneX(2, 4)).toBe(0.5);
    expect(laneX(9, 4)).toBe(1);
  });

  it("runs value bottom to top, which is top-down in lane coordinates", () => {
    expect(laneY(10, range)).toBe(0);
    expect(laneY(0, range)).toBe(1);
    expect(laneY(5, range)).toBeCloseTo(0.5, 9);
  });

  it("round-trips a point back to the value it was drawn from", () => {
    for (const value of [0, 2.5, 7.25, 10]) {
      expect(valueAtLaneY(laneY(value, range), range)).toBeCloseTo(value, 9);
    }
    for (const at of [0, 1.4, 3.9]) {
      expect(secondsAtLaneX(laneX(at, 4), 4)).toBeCloseTo(at, 9);
    }
  });
});

describe("keyAtPointer", () => {
  const keys = [
    { t: 0, v: 0 },
    { t: 2, v: 10 },
    { t: 4, v: 0 },
  ];
  const range = { min: 0, max: 10 };

  it("finds the key the pointer landed on", () => {
    expect(keyAtPointer(keys, { x: 0.5, y: 0 }, range, 4)).toBe(1);
    expect(keyAtPointer(keys, { x: 1, y: 1 }, range, 4)).toBe(2);
  });

  it("returns null for a press on empty lane, which is a scrub", () => {
    expect(keyAtPointer(keys, { x: 0.5, y: 1 }, range, 4)).toBeNull();
  });

  it("has nothing to find in a channel with no keys", () => {
    expect(keyAtPointer([], { x: 0.5, y: 0.5 }, range, 4)).toBeNull();
  });
});

describe("moveKey", () => {
  const keys = [key(0, 0), key(2, 10), key(4, 0)];

  it("moves the key it was asked to and leaves the rest alone", () => {
    const next = moveKey(keys, 1, 2.5, 7, 4);
    expect(next[1]).toEqual({ ...keys[1], atSeconds: 2.5, value: 7 });
    expect(next[0]).toEqual(keys[0]);
    expect(next[2]).toEqual(keys[2]);
  });

  it("never lets a key pass its neighbour", () => {
    expect(moveKey(keys, 1, 99, 5, 4)[1]!.atSeconds).toBeCloseTo(
      4 - MIN_KEY_GAP_SECONDS,
      9
    );
    expect(moveKey(keys, 1, -99, 5, 4)[1]!.atSeconds).toBeCloseTo(
      MIN_KEY_GAP_SECONDS,
      9
    );
  });

  it("keeps the order it was given", () => {
    const dragged = moveKey(keys, 1, 99, 5, 4);
    const times = dragged.map((entry) => entry.atSeconds);
    expect([...times].sort((left, right) => left - right)).toEqual(times);
  });

  it("clamps the ends to the scene rather than off either side of it", () => {
    expect(moveKey(keys, 0, -3, 1, 4)[0]!.atSeconds).toBe(0);
    expect(moveKey(keys, 2, 12, 1, 4)[2]!.atSeconds).toBe(4);
  });

  it("does not fall off the front of a scene whose keys crowd its start", () => {
    const crowded = [key(0, 0), key(0.01, 1)];
    expect(moveKey(crowded, 0, -1, 0, 4)[0]!.atSeconds).toBeGreaterThanOrEqual(
      0
    );
  });

  it("returns the keys untouched when the index names nothing", () => {
    expect(moveKey(keys, 9, 1, 1, 4)).toEqual(keys);
  });

  it("leaves the caller's array alone", () => {
    const before = structuredClone(keys);
    moveKey(keys, 1, 3, 4, 4);
    expect(keys).toEqual(before);
  });
});

describe("the lane draws the curve the sampler plays", () => {
  const stepped: CameraChannel = {
    id: "camera.lens.fov",
    holdsFlat: true,
    keys: [
      { t: 0, v: 30, interpolation: "step", easing: "linear" },
      { t: 2, v: 60, interpolation: "smooth", easing: "linear" },
    ],
  };

  it("holds a cut flat instead of joining its keys with a line", () => {
    const range = { min: 20, max: 70 };
    const points = channelCurvePoints(stepped, range, 2, 8);
    const beforeTheCut = points.slice(0, 8);
    for (const point of beforeTheCut) {
      expect(point.y).toBeCloseTo(laneY(30, range), 9);
    }
  });

  it("emits one more point than the samples it was asked for", () => {
    expect(channelCurvePoints(stepped, { min: 0, max: 100 }, 2, 12)).toHaveLength(
      13
    );
  });

  it("scales lane coordinates into the box it is drawn in", () => {
    const path = laneCurvePath(
      [
        { x: 0, y: 1 },
        { x: 0.5, y: 0.25 },
        { x: 1, y: 0 },
      ],
      100,
      40
    );
    expect(path).toBe("M0.00 40.00 L50.00 10.00 L100.00 0.00");
  });
});

describe("value formatting", () => {
  it("never shows a negative zero, which flickers a minus sign while scrubbing", () => {
    expect(formatChannelValue("camera.aim.yaw", -0.0001)).toBe("0.0°");
    expect(formatChannelValue("camera.position.x", -0.000001)).toBe("0.00m");
  });

  it("still shows a real negative", () => {
    expect(formatChannelValue("camera.position.z", -2.305)).toBe("-2.31m");
  });
});
