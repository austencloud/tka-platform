export interface UserIdentitySummary {
  displayName?: string | null;
  username?: string | null;
}

export interface UserIdentityLabels {
  primary: string;
  secondary: string | null;
}

/**
 * The display name is what someone chooses to be called in the community. The
 * unique @username stays beside it so people can distinguish similar names.
 */
export function getUserIdentityLabels(
  identity: UserIdentitySummary | null | undefined,
  fallback = "Unknown User"
): UserIdentityLabels {
  const username = identity?.username?.trim() || "";
  const displayName = identity?.displayName?.trim() || "";
  const primary = displayName || (username ? `@${username}` : fallback);
  const secondary =
    username &&
    displayName &&
    username.localeCompare(displayName, undefined, {
      sensitivity: "accent",
    }) !== 0
      ? `@${username}`
      : null;

  return { primary, secondary };
}
