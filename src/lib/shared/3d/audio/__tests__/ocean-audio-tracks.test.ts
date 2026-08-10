import { describe, expect, it } from "vitest";
import {
  CELESTIAL_TRACK,
  OCEAN_TRACKS,
  getDefaultTrackForVariant,
  getTrackById,
  getTracksForVariant,
} from "../ocean-audio-tracks";

describe("scene audio tracks", () => {
  it("registers the Olive Cloudbreak ambience without changing ocean variants", () => {
    expect(getTracksForVariant("celestial")).toEqual([CELESTIAL_TRACK]);
    expect(getDefaultTrackForVariant("celestial")).toBe(CELESTIAL_TRACK);
    expect(getTrackById(CELESTIAL_TRACK.id)).toBe(CELESTIAL_TRACK);
    expect(OCEAN_TRACKS.every((track) => track.variant !== "celestial")).toBe(
      true
    );
  });
});
