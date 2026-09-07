/**
 * Pure planner for lazy legacy Favorite migration.
 *
 * The repository executes the returned compatibility write without blocking
 * the personal read. Keeping the decision pure makes idempotency and stale
 * source recovery directly testable.
 */
import type { SavedGeneratorSetup } from "./models/favorite-config";
import type { StartEndOptions } from "$lib/shared/create/state/panel-coordination-state.svelte";
import {
  normalizePersistedGenerationConfig,
  normalizePersistedStartEndOptions,
} from "./generator-persistence-normalizer";

export const LEGACY_FAVORITE_SETUP_ID = "legacy-favorite";

export interface LegacyFavoriteRecord {
  sourceSetupId?: string;
  config: Record<string, unknown>;
  startEndOptions?: Record<string, unknown> | null;
  setAt?: Date;
}

export interface MigrationWrite {
  setup: SavedGeneratorSetup;
  linkFavoriteToSetupId: string | null;
}

export interface PersonalMigrationPlan {
  setups: SavedGeneratorSetup[];
  sharedSetupId: string | null;
  write: MigrationWrite | null;
}

export function planPersonalMigration(
  setups: SavedGeneratorSetup[],
  favorite: LegacyFavoriteRecord | null,
  now: Date
): PersonalMigrationPlan {
  if (!favorite) {
    return {
      setups,
      sharedSetupId: null,
      write: null,
    };
  }

  const sourceId = favorite.sourceSetupId;
  if (sourceId && setups.some((setup) => setup.id === sourceId)) {
    return {
      setups,
      sharedSetupId: sourceId,
      write: null,
    };
  }

  const setupId = sourceId ?? LEGACY_FAVORITE_SETUP_ID;
  const recovered: SavedGeneratorSetup = {
    id: setupId,
    name: "My Favorite",
    config: normalizePersistedGenerationConfig(
      favorite.config
    ) as SavedGeneratorSetup["config"],
    startEndOptions: normalizePersistedStartEndOptions(
      (favorite.startEndOptions ?? null) as StartEndOptions | null
    ),
    createdAt: favorite.setAt ?? now,
    updatedAt: now,
  };

  return {
    setups: [...setups.filter((setup) => setup.id !== setupId), recovered],
    sharedSetupId: setupId,
    write: {
      setup: recovered,
      linkFavoriteToSetupId: sourceId ? null : setupId,
    },
  };
}
