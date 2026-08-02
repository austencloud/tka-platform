import { describe, expect, it } from "vitest";
import {
  buildReviewUsernameRepairPlan,
  LEGACY_REVIEW_USERNAME,
  REPAIRED_REVIEW_USERNAME,
  REVIEW_USER_ID,
} from "../../../scripts/migrations/repair-google-review-username";

describe("Google review username repair", () => {
  it("repairs the legacy profile and moves its owned claim", () => {
    expect(
      buildReviewUsernameRepairPlan(
        {
          username: LEGACY_REVIEW_USERNAME,
          usernameLowercase: LEGACY_REVIEW_USERNAME,
        },
        { userId: REVIEW_USER_ID },
        null
      )
    ).toEqual({
      profilePatch: {
        username: REPAIRED_REVIEW_USERNAME,
        usernameLowercase: REPAIRED_REVIEW_USERNAME,
      },
      createDestinationClaim: true,
      deleteSourceClaim: true,
      changed: true,
    });
  });

  it("is idempotent after the profile and claim are repaired", () => {
    expect(
      buildReviewUsernameRepairPlan(
        {
          username: REPAIRED_REVIEW_USERNAME,
          usernameLowercase: REPAIRED_REVIEW_USERNAME,
        },
        null,
        { userId: REVIEW_USER_ID }
      )
    ).toEqual({
      profilePatch: null,
      createDestinationClaim: false,
      deleteSourceClaim: false,
      changed: false,
    });
  });

  it("refuses to overwrite a username that belongs to another account", () => {
    expect(() =>
      buildReviewUsernameRepairPlan(
        { username: LEGACY_REVIEW_USERNAME },
        null,
        { userId: "different-user" }
      )
    ).toThrow("refusing to steal");
  });

  it("refuses to overwrite a profile that drifted from the incident value", () => {
    expect(() =>
      buildReviewUsernameRepairPlan(
        { username: "reviewer-changed-this" },
        null,
        null
      )
    ).toThrow("refusing to overwrite");
  });

  it("does not delete an invalid source claim owned by another account", () => {
    const plan = buildReviewUsernameRepairPlan(
      { username: LEGACY_REVIEW_USERNAME },
      { userId: "different-user" },
      null
    );

    expect(plan.deleteSourceClaim).toBe(false);
    expect(plan.changed).toBe(true);
  });
});
