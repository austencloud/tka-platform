export interface LegacyDisplayNameIdentity {
  userId: string | null;
  isFullAccount: boolean;
  displayName: string | null;
}

export interface LegacyDisplayNameMigrationDependencies {
  expectedUserId: string;
  legacyUserName: string | null | undefined;
  getIdentity: () => LegacyDisplayNameIdentity;
  updateDisplayName: (displayName: string) => Promise<unknown>;
}

export type LegacyDisplayNameMigrationResult =
  | "migrated"
  | "canonical-name-present"
  | "legacy-name-missing"
  | "identity-changed";

/**
 * Copies the retired settings.userName field into Firebase Auth once.
 *
 * The caller must supply settings read from the expected account's Firestore
 * document. Browser-local settings are intentionally not accepted as an
 * identity source because the same browser can be used by multiple accounts.
 */
export async function migrateLegacyDisplayNameFromSettings(
  deps: LegacyDisplayNameMigrationDependencies
): Promise<LegacyDisplayNameMigrationResult> {
  const identity = deps.getIdentity();

  if (
    !identity.isFullAccount ||
    !identity.userId ||
    identity.userId !== deps.expectedUserId
  ) {
    return "identity-changed";
  }

  if (identity.displayName?.trim()) {
    return "canonical-name-present";
  }

  const legacyName = deps.legacyUserName?.trim();
  if (!legacyName) {
    return "legacy-name-missing";
  }

  await deps.updateDisplayName(legacyName);
  return "migrated";
}
