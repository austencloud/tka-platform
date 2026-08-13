/**
 * Who is behind a `users/{uid}` write — the decision Pulse gets wrong when it
 * trusts the doc alone.
 *
 * `createOrUpdateUserDocument` writes `isAnonymous`, but it is not the only
 * writer. A guest's first library save merges `sequenceCount` +
 * `lastActivityDate` onto `users/{uid}`, and on dev that path MINTS the doc
 * (createOrUpdateUserDocument deliberately skips anonymous sessions outside
 * PROD). The result is an identity-less doc: no displayName, no isAnonymous.
 * Pulse read that as a brand-new full account and paged an admin with
 * "New user signed up: Someone".
 *
 * Auth is the authority. These helpers take the auth record when it is
 * available and fall back to the doc's own flag when the lookup fails.
 */

/** The subset of an auth record these decisions need. */
export interface AuthIdentity {
  email: string | null;
  displayName: string | null;
  /** No linked provider and no email = an anonymous session. */
  isAnonymous: boolean;
}

type DocData = Record<string, unknown> | null | undefined;

/**
 * Agent browser profiles use reserved `agent-*` Firebase UIDs. Real Firebase
 * accounts use generated IDs, while the provisioner assigns this prefix only
 * to automation identities such as the shared Codex + Claude profile.
 */
export function isAgentUserId(userId: string | null | undefined): boolean {
  return userId?.startsWith("agent-") ?? false;
}

/**
 * Is this session a guest? Auth wins; when it is unavailable, fall back to the
 * doc's flag, which is what Pulse used before and is right for every doc
 * createOrUpdateUserDocument wrote.
 */
export function isGuestSession(
  identity: AuthIdentity | null,
  docData: DocData
): boolean {
  if (identity) return identity.isAnonymous;
  return docData?.["isAnonymous"] === true;
}

/**
 * Did a guest just become a full account? The pre-write doc counts as a guest
 * when its flag is true OR absent — absent is the identity-less doc above, and
 * treating it as "already a full account" turned real upgrades into a generic
 * "is back in the app" ping.
 */
export function isGuestUpgrade(before: DocData, after: DocData): boolean {
  return before?.["isAnonymous"] !== false && after?.["isAnonymous"] === false;
}

/**
 * Best available name. The doc's own fields first (a user can rename
 * themselves), then the auth record, then the guest/unknown fallbacks.
 */
export function resolveDisplayName(
  docData: DocData,
  identity: AuthIdentity | null
): string {
  const fromDoc =
    (docData?.["displayName"] as string) || (docData?.["username"] as string);
  if (fromDoc) return fromDoc;

  if (identity?.displayName) return identity.displayName;
  if (identity?.email) return identity.email.split("@")[0];

  if (isGuestSession(identity, docData)) return "A guest";
  return "Someone";
}
