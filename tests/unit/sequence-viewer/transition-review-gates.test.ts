import { describe, expect, it } from "vitest";
import {
  createEmptyTransitionReviewDecisions,
  parseTransitionReviewDecisions,
} from "../../../src/routes/test/sequence-viewer-transitions/transition-review-gates";

describe("transition review decisions", () => {
  it("starts every transition gate unreviewed", () => {
    const decisions = createEmptyTransitionReviewDecisions();

    expect(Object.keys(decisions)).toHaveLength(9);
    expect(decisions["split-focus"]).toEqual({
      status: "not-reviewed",
      note: "",
      reviewedAt: null,
    });
  });

  it("restores valid decisions and ignores unknown gates", () => {
    const decisions = parseTransitionReviewDecisions(
      JSON.stringify({
        "split-focus": {
          status: "approved",
          note: "Clean at 4K",
          reviewedAt: "2026-08-28T12:00:00.000Z",
        },
        invented: { status: "approved" },
      })
    );

    expect(decisions["split-focus"]).toEqual({
      status: "approved",
      note: "Clean at 4K",
      reviewedAt: "2026-08-28T12:00:00.000Z",
    });
    expect("invented" in decisions).toBe(false);
  });

  it("falls back safely when storage contains malformed data", () => {
    expect(parseTransitionReviewDecisions("not-json")).toEqual(
      createEmptyTransitionReviewDecisions()
    );
    expect(
      parseTransitionReviewDecisions(
        JSON.stringify({ "split-focus": { status: "maybe" } })
      )["split-focus"].status
    ).toBe("not-reviewed");
  });
});
