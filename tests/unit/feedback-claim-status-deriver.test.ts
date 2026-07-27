import { describe, expect, it } from "vitest";
import { ClaimStatusDeriver } from "../../src/lib/features/feedback/services/claim-status-deriver";
import type { FeedbackItem } from "../../src/lib/shared/feedback/domain/models/feedback-models";

function feedbackItem(overrides: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: "feedback-item",
    status: "new",
    ...overrides,
  } as FeedbackItem;
}

describe("ClaimStatusDeriver", () => {
  const deriver = new ClaimStatusDeriver();

  it("shows an active claim as in-progress", () => {
    const result = deriver.deriveEffectiveStatus(
      feedbackItem({
        status: "new",
        claimToken: "token",
        claimedAt: new Date(),
        lastActivity: new Date(),
      })
    );

    expect(result.displayStatus).toBe("in-progress");
    expect(result.claimHealth).toBe("active");
  });

  it("returns orphaned in-progress work to the available queue", () => {
    const result = deriver.deriveEffectiveStatus(
      feedbackItem({ status: "in-progress" })
    );

    expect(result.displayStatus).toBe("new");
    expect(result.claimHealth).toBe("orphaned");
  });

  it("returns stale in-progress work to the available queue", () => {
    const staleDate = new Date(Date.now() - 60 * 60 * 1000);
    const result = deriver.deriveEffectiveStatus(
      feedbackItem({
        status: "in-progress",
        claimToken: "token",
        claimedAt: staleDate,
        lastActivity: staleDate,
      })
    );

    expect(result.displayStatus).toBe("new");
    expect(result.claimHealth).toBe("stale");
  });

  it("preserves review status when no claim exists", () => {
    const result = deriver.deriveEffectiveStatus(
      feedbackItem({ status: "in-review" })
    );

    expect(result.displayStatus).toBe("in-review");
    expect(result.claimHealth).toBe("none");
  });
});
