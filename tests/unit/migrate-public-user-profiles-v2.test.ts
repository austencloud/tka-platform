import { describe, expect, it } from "vitest";
import { buildUserProfileMigrationPlan } from "../../scripts/migrations/migrate-public-user-profiles-v2";

describe("public profile security migration", () => {
  it("preserves owner-private and admin-private fields before stripping root", () => {
    const plan = buildUserProfileMigrationPlan({
      displayName: "Sky",
      email: "private@example.test",
      lastLocation: { lat: 1, lng: 2 },
      adminLabel: "Tuesday jam",
      adminNotes: "Private",
    });
    expect(plan.ownerPrivatePatch).toEqual({
      email: "private@example.test",
      lastLocation: { lat: 1, lng: 2 },
    });
    expect(plan.adminPrivatePatch).toEqual({
      adminLabel: "Tuesday jam",
      adminNotes: "Private",
    });
    expect(plan.publicPatch).toEqual({ publicProfileVersion: 2 });
    expect(plan.deleteFields).toEqual(
      expect.arrayContaining([
        "email",
        "lastLocation",
        "adminLabel",
        "adminNotes",
      ])
    );
  });

  it("preserves existing private values, including explicit null", () => {
    const plan = buildUserProfileMigrationPlan(
      { email: "stale", adminLabel: "legacy" },
      { email: null },
      { adminLabel: "current" }
    );
    expect(plan.ownerPrivatePatch).toBeNull();
    expect(plan.adminPrivatePatch).toBeNull();
  });

  it("moves settings and moderation data to their canonical documents", () => {
    const plan = buildUserProfileMigrationPlan({
      notificationPreferences: { email: false },
      featureOverrides: { betaComposer: true },
      hasActiveWarning: true,
      lastWarningReportId: "report-1",
    });

    expect(plan.notificationPreferencesPatch).toEqual({
      notificationPreferences: { email: false },
    });
    expect(plan.featureOverridesPatch).toEqual({
      betaComposer: true,
    });
    expect(plan.moderationStatusPatch).toEqual({
      hasActiveWarning: true,
      lastWarningReportId: "report-1",
    });
    expect(plan.deleteFields).toEqual(
      expect.arrayContaining([
        "notificationPreferences",
        "featureOverrides",
        "hasActiveWarning",
        "lastWarningReportId",
      ])
    );
  });

  it("does not mark a profile carrying an unknown field", () => {
    const plan = buildUserProfileMigrationPlan({
      displayName: "Sky",
      secretAnswer: "not-public",
    });
    expect(plan.publicPatch).toEqual({});
    expect(plan.unknownFields).toEqual(["secretAnswer"]);
  });

  it("removes an existing public marker when a future unknown field appears", () => {
    const plan = buildUserProfileMigrationPlan({
      publicProfileVersion: 2,
      displayName: "Sky",
      futureSecret: "not-public",
    });

    expect(plan.publicPatch).toEqual({});
    expect(plan.deleteFields).toContain("publicProfileVersion");
    expect(plan.unknownFields).toEqual(["futureSecret"]);
    expect(plan.changed).toBe(true);
  });

  it("leaves malformed feature overrides unmarked instead of discarding them", () => {
    const plan = buildUserProfileMigrationPlan({
      displayName: "Sky",
      featureOverrides: "legacy-value",
    });
    expect(plan.featureOverridesPatch).toBeNull();
    expect(plan.deleteFields).not.toContain("featureOverrides");
    expect(plan.unknownFields).toContain("featureOverrides");
    expect(plan.publicPatch).toEqual({});
  });

  it("is a no-op for an already migrated safe profile", () => {
    expect(
      buildUserProfileMigrationPlan({
        publicProfileVersion: 2,
        displayName: "Sky",
      })
    ).toMatchObject({
      ownerPrivatePatch: null,
      adminPrivatePatch: null,
      publicPatch: {},
      changed: false,
    });
  });
});
