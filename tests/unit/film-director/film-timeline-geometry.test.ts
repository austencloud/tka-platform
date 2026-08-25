import { describe, expect, it } from "vitest";

import {
  buildTimelineSegments,
  fractionAtSeconds,
  secondsAtFraction,
} from "../../../src/routes/test/film-director/_lib/film-timeline-geometry";

const scenes = [
  { id: "a", title: "Reveal", startSeconds: 0, durationSeconds: 10 },
  { id: "b", title: "Turn", startSeconds: 10, durationSeconds: 30 },
];

describe("buildTimelineSegments", () => {
  it("sizes each segment by its share of the film", () => {
    const segments = buildTimelineSegments(scenes, 40);
    expect(segments.map((s) => s.width)).toEqual([0.25, 0.75]);
    expect(segments.map((s) => s.offset)).toEqual([0, 0.25]);
  });

  it("covers the whole track with no gap", () => {
    const segments = buildTimelineSegments(scenes, 40);
    const last = segments[segments.length - 1]!;
    expect(last.offset + last.width).toBeCloseTo(1, 10);
  });

  it("returns nothing for a zero-length film rather than dividing by zero", () => {
    expect(buildTimelineSegments(scenes, 0)).toEqual([]);
  });

  it("keeps the scene index so a click can select it", () => {
    expect(buildTimelineSegments(scenes, 40).map((s) => s.index)).toEqual([0, 1]);
  });
});

describe("secondsAtFraction", () => {
  it("maps the track onto the film", () => {
    expect(secondsAtFraction(0.25, 40)).toBe(10);
  });

  it("clamps a pointer dragged past either end", () => {
    expect(secondsAtFraction(-0.4, 40)).toBe(0);
    expect(secondsAtFraction(1.8, 40)).toBe(40);
  });
});

describe("fractionAtSeconds", () => {
  it("is the inverse of secondsAtFraction", () => {
    expect(fractionAtSeconds(secondsAtFraction(0.6, 40), 40)).toBeCloseTo(0.6, 10);
  });

  it("is zero for a zero-length film", () => {
    expect(fractionAtSeconds(5, 0)).toBe(0);
  });
});
