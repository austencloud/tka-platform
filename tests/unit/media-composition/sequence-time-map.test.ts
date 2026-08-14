import { describe, expect, it } from "vitest";
import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
import {
  SequenceTimeMapSchema,
  createTempoGridTimeMap,
  mediaTimeToSequencePosition,
  migrateLegacyStepMap,
  sequencePositionToMediaTime,
} from "$lib/shared/media-composition/domain/sequence-time-map";

const sequenceRef = {
  sequenceId: "sequence-a",
  contentHash: "sha256:sequence-a-v1",
};

function legacyStepMap(overrides: Partial<StepMap> = {}): StepMap {
  return {
    beatTimestamps: [1, 1.5, 2, 2.5],
    stepCount: 4,
    source: "manual",
    updatedAt: new Date("2026-08-13T12:00:00.000Z"),
    ...overrides,
  };
}

describe("SequenceTimeMap", () => {
  it("creates a duration-aware editable tempo grid", () => {
    const timeMap = createTempoGridTimeMap({
      sequenceRef,
      mediaSourceId: "video-a",
      mediaDurationSeconds: 8,
      startPositionDuration: 1,
      motionDurations: [1, 2, 4],
      updatedAt: 1,
    });

    expect(timeMap.source).toBe("tempo-grid");
    expect(timeMap.confidence).toBe(0.25);
    expect(timeMap.anchors).toEqual([
      { mediaTimeSeconds: 0, sequencePosition: 0 },
      { mediaTimeSeconds: 1, sequencePosition: 1 },
      { mediaTimeSeconds: 2, sequencePosition: 2 },
      { mediaTimeSeconds: 4, sequencePosition: 3 },
      { mediaTimeSeconds: 8, sequencePosition: 4 },
    ]);
  });

  it("rejects anchors that reverse either axis", () => {
    const result = SequenceTimeMapSchema.safeParse({
      schemaVersion: 1,
      id: "map-a",
      sequenceRef,
      mediaSourceId: "video-a",
      anchors: [
        { mediaTimeSeconds: 0, sequencePosition: 0 },
        { mediaTimeSeconds: 1, sequencePosition: 2 },
        { mediaTimeSeconds: 2, sequencePosition: 1 },
      ],
      source: "manual",
      boundaryPolicy: "clamp",
      updatedAt: 1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects mutable sequence references with no revision identity", () => {
    const result = SequenceTimeMapSchema.safeParse({
      schemaVersion: 1,
      id: "map-a",
      sequenceRef: { sequenceId: "sequence-a" },
      mediaSourceId: "video-a",
      anchors: [
        { mediaTimeSeconds: 0, sequencePosition: 1 },
        { mediaTimeSeconds: 1, sequencePosition: 2 },
      ],
      source: "manual",
      boundaryPolicy: "clamp",
      updatedAt: 1,
    });

    expect(result.success).toBe(false);
  });

  it("maps both directions with fractional positions and clamps boundaries", () => {
    const timeMap = migrateLegacyStepMap({
      stepMap: legacyStepMap(),
      sequenceRef,
      mediaSourceId: "video-a",
      mediaDurationSeconds: 4,
    });

    expect(timeMap.anchors).toEqual([
      { mediaTimeSeconds: 0, sequencePosition: 0 },
      { mediaTimeSeconds: 1, sequencePosition: 1 },
      { mediaTimeSeconds: 1.5, sequencePosition: 2 },
      { mediaTimeSeconds: 2, sequencePosition: 3 },
      { mediaTimeSeconds: 2.5, sequencePosition: 4 },
      { mediaTimeSeconds: 3, sequencePosition: 5 },
    ]);

    expect(mediaTimeToSequencePosition(timeMap, -10)).toBe(0);
    expect(mediaTimeToSequencePosition(timeMap, 0.5)).toBe(0.5);
    expect(mediaTimeToSequencePosition(timeMap, 1.25)).toBe(1.5);
    expect(mediaTimeToSequencePosition(timeMap, 2.25)).toBe(3.5);
    expect(mediaTimeToSequencePosition(timeMap, 99)).toBe(5);

    expect(sequencePositionToMediaTime(timeMap, -1)).toBe(0);
    expect(sequencePositionToMediaTime(timeMap, 1.5)).toBe(1.25);
    expect(sequencePositionToMediaTime(timeMap, 3.5)).toBe(2.25);
    expect(sequencePositionToMediaTime(timeMap, 99)).toBe(3);
  });

  it("uses the median beat interval for the inferred final-beat endpoint", () => {
    const timeMap = migrateLegacyStepMap({
      stepMap: legacyStepMap({
        beatTimestamps: [0, 0.5, 1.5, 2],
      }),
      sequenceRef,
      mediaSourceId: "video-a",
      mediaDurationSeconds: 12,
    });

    expect(timeMap.anchors.at(-1)).toEqual({
      mediaTimeSeconds: 2.5,
      sequencePosition: 5,
    });
    expect(mediaTimeToSequencePosition(timeMap, 10)).toBe(5);
  });

  it("preserves the old detection source without preserving its old name", () => {
    const timeMap = migrateLegacyStepMap({
      stepMap: legacyStepMap({ source: "auto-detected" }),
      sequenceRef,
      mediaSourceId: "video-a",
      mediaDurationSeconds: 4,
    });

    expect(timeMap.source).toBe("audio-detected");
  });

  it("refuses to guess across an incomplete legacy map", () => {
    expect(() =>
      migrateLegacyStepMap({
        stepMap: legacyStepMap({ beatTimestamps: [0, 0.5] }),
        sequenceRef,
        mediaSourceId: "video-a",
        mediaDurationSeconds: 4,
      })
    ).toThrow("one timestamp for every sequence beat");
  });

  it("rejects non-finite lookup values", () => {
    const timeMap = migrateLegacyStepMap({
      stepMap: legacyStepMap(),
      sequenceRef,
      mediaSourceId: "video-a",
      mediaDurationSeconds: 4,
    });

    expect(() => mediaTimeToSequencePosition(timeMap, Number.NaN)).toThrow(
      "finite"
    );
    expect(() => sequencePositionToMediaTime(timeMap, Infinity)).toThrow(
      "finite"
    );
  });
});
