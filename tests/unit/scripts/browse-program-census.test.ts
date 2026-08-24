import { describe, expect, it } from "vitest";
import {
  mediaTimestamp,
  subjectLinkCount,
  timestampMillis,
} from "../../../scripts/diagnostics/browse-program-census";

describe("browse program census aggregation", () => {
  it("normalizes the timestamp shapes found across legacy media", () => {
    expect(timestampMillis({ seconds: 100 })).toBe(100_000);
    expect(timestampMillis("2026-08-22T00:00:00.000Z")).toBe(
      Date.parse("2026-08-22T00:00:00.000Z")
    );
    expect(
      mediaTimestamp({
        createdAt: { seconds: 100 },
        updatedAt: { seconds: 200 },
      })
    ).toBe(200_000);
  });

  it("counts canonical and showcase subject shapes without double guessing", () => {
    expect(subjectLinkCount({ associations: [{}, {}] })).toBe(2);
    expect(subjectLinkCount({ linkedSequences: [{}] })).toBe(1);
    expect(subjectLinkCount({ sequenceId: "sequence-1" })).toBe(1);
    expect(subjectLinkCount({ sequenceId: "" })).toBe(0);
  });
});
