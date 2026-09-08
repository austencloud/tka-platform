import { describe, expect, it } from "vitest";
import { normalizeLegacyVideoRecordSettings } from "./video-record-settings.svelte";

describe("video-record settings compatibility", () => {
  it("restores literal blue/red motion visibility", () => {
    expect(
      normalizeLegacyVideoRecordSettings({
        referenceView: "animation",
        animationSettings: {
          speed: 1,
          showTrails: true,
          blueMotionVisible: false,
          redMotionVisible: true,
        },
        gridSettings: { animated: false, bpm: 60 },
      }).animationSettings
    ).toMatchObject({
      leftMotionVisible: false,
      rightMotionVisible: true,
    });
  });
});
