import { describe, expect, it } from "vitest";
import {
  LEGACY_FAVORITE_SETUP_ID,
  planPersonalMigration,
} from "../setup-migration";
import type { SavedGeneratorSetup } from "../models/favorite-config";

const NOW = new Date("2026-07-30T12:00:00Z");

const setup = (id: string, name = id): SavedGeneratorSetup =>
  ({
    id,
    name,
    config: { level: 1 },
    startEndOptions: null,
    createdAt: NOW,
    updatedAt: NOW,
  }) as unknown as SavedGeneratorSetup;

const legacyFavorite = (sourceSetupId?: string) => ({
  sourceSetupId,
  config: { level: 3 },
  startEndOptions: null,
  setAt: new Date("2026-03-21T00:00:00Z"),
});

describe("planPersonalMigration", () => {
  it("plans no write when no Favorite exists", () => {
    const existing = setup("a");
    const plan = planPersonalMigration([existing], null, NOW);

    expect(plan).toEqual({
      setups: [existing],
      sharedSetupId: null,
      write: null,
    });
  });

  it("migrates an unlinked Favorite to the deterministic legacy ID", () => {
    const plan = planPersonalMigration([], legacyFavorite(), NOW);

    expect(plan.write?.setup.id).toBe(LEGACY_FAVORITE_SETUP_ID);
    expect(plan.write?.setup.name).toBe("My Favorite");
    expect(plan.write?.linkFavoriteToSetupId).toBe(
      LEGACY_FAVORITE_SETUP_ID
    );
    expect(plan.sharedSetupId).toBe(LEGACY_FAVORITE_SETUP_ID);
    expect(plan.setups.map((item) => item.id)).toContain(
      LEGACY_FAVORITE_SETUP_ID
    );
  });

  it("is idempotent after migration", () => {
    const first = planPersonalMigration([], legacyFavorite(), NOW);
    const second = planPersonalMigration(
      first.setups,
      legacyFavorite(LEGACY_FAVORITE_SETUP_ID),
      NOW
    );

    expect(second.write).toBeNull();
    expect(second.sharedSetupId).toBe(LEGACY_FAVORITE_SETUP_ID);
    expect(second.setups).toEqual(first.setups);
  });

  it("re-adopts a missing source at its exact ID without touching others", () => {
    const plan = planPersonalMigration(
      [setup("keep-me")],
      legacyFavorite("gone-id"),
      NOW
    );

    expect(plan.write?.setup.id).toBe("gone-id");
    expect(plan.write?.linkFavoriteToSetupId).toBeNull();
    expect(plan.setups.map((item) => item.id).sort()).toEqual([
      "gone-id",
      "keep-me",
    ]);
  });

  it("needs no write when the linked source exists", () => {
    const plan = planPersonalMigration(
      [setup("s1")],
      legacyFavorite("s1"),
      NOW
    );

    expect(plan.write).toBeNull();
    expect(plan.sharedSetupId).toBe("s1");
  });
});
