import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import type { UserRecord } from "firebase-admin/auth";

const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * An anonymous account is stale when it has NO linked provider credential and
 * its last sign-in (or creation) was more than 30 days before `nowMs`.
 */
export function isStaleAnonymousAccount(
  user: UserRecord,
  nowMs: number
): boolean {
  const isAnonymous =
    (!user.providerData || user.providerData.length === 0) &&
    user.customClaims?.instagram !== true;
  if (!isAnonymous) return false;
  const lastActive = Date.parse(
    user.metadata.lastSignInTime || user.metadata.creationTime
  );
  if (Number.isNaN(lastActive)) return false;
  return nowMs - lastActive > STALE_AFTER_MS;
}

/**
 * Daily sweep: delete anonymous accounts idle > 30 days with no linked
 * credential, cascading their /users/{uid} subtree. Logged, not silent.
 */
export const cleanupStaleAnonymousAccounts = functions.pubsub
  .schedule("every 24 hours")
  .timeZone("UTC")
  .onRun(async () => {
    const auth = admin.auth();
    const db = admin.firestore();
    const now = Date.now();

    let sweptCount = 0;
    let pageToken: string | undefined;

    do {
      const page = await auth.listUsers(1000, pageToken);
      const staleUids = page.users
        .filter((u) => isStaleAnonymousAccount(u, now))
        .map((u) => u.uid);

      for (const uid of staleUids) {
        try {
          // Cascade-delete the user's Firestore subtree, then the auth account.
          await db.recursiveDelete(db.doc(`users/${uid}`));
          await auth.deleteUser(uid);
          sweptCount += 1;
        } catch (err) {
          functions.logger.error(
            "cleanupStaleAnonymousAccounts failed to delete account",
            { uid, err }
          );
        }
      }

      pageToken = page.pageToken;
    } while (pageToken);

    functions.logger.info("cleanupStaleAnonymousAccounts swept accounts", {
      sweptCount,
    });
    return null;
  });
