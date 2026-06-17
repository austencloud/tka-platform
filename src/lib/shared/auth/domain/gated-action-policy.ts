import type { PendingActionType } from "$lib/shared/sequence-viewer/services/pending-action-queue";

/**
 * Actions that publish content to shared/public collections under a visible
 * identity require a permanent (non-anonymous) account. Own-subtree writes
 * (save, favorite) and no-write actions (remix navigates to Create; sendTo
 * shares a URL) are allowed for anonymous guests.
 */
const FULL_ACCOUNT_ACTIONS: ReadonlySet<PendingActionType> = new Set(["publish"]);

export function requiresFullAccount(type: PendingActionType): boolean {
  return FULL_ACCOUNT_ACTIONS.has(type);
}
