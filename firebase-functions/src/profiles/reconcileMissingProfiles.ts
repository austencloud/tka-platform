/**
 * Safety net: Auth accounts with no `users/{uid}` document.
 *
 * onAuthUserCreated closes the signup path, but two gaps remain that only a
 * sweep can cover:
 *
 *   1. Guests who upgrade in place. The uid already exists in Auth, so onCreate
 *      never fires again; the upgrade's profile write is the same unreliable
 *      client write that lost two profiles on 2026-08-05.
 *   2. Anything the trigger itself missed — a deploy gap, an exhausted retry.
 *
 * Provisioning the document also fires pulseUserActivity, so a recovered
 * account produces the normal "New user signed up" admin notification. The
 * repair is not silent, which is the whole point: the original bug survived a
 * week precisely because nothing announced it.
 */

import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import type { UserRecord } from "firebase-admin/auth";
import { provisionUserProfile } from "./provisionUserProfile";

/** Don't resurrect long-dead accounts on the first run; recent gaps are the bug. */
const MAX_AGE_DAYS = 30;

async function listAllAuthUsers(): Promise<UserRecord[]> {
  const users: UserRecord[] = [];
  let page = await admin.auth().listUsers(1000);
  users.push(...page.users);
  while (page.pageToken) {
    page = await admin.auth().listUsers(1000, page.pageToken);
    users.push(...page.users);
  }
  return users;
}

export const reconcileMissingProfiles = functionsV1.pubsub
  .schedule("every 30 minutes")
  .onRun(async () => {
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const users = await listAllAuthUsers();

    const candidates = users.filter((u) => {
      const isAnonymous = u.providerData.length === 0 && !u.email;
      if (isAnonymous) return false;
      return Date.parse(u.metadata.creationTime) >= cutoff;
    });

    let repaired = 0;
    for (const user of candidates) {
      try {
        const outcome = await provisionUserProfile(user);
        if (outcome === "created") {
          repaired++;
          console.warn(
            `[reconcileMissingProfiles] REPAIRED missing profile for ${user.uid} (${user.email ?? "no email"}), created ${user.metadata.creationTime}`
          );
        }
      } catch (err) {
        console.error(
          `[reconcileMissingProfiles] failed for ${user.uid}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    console.log(
      `[reconcileMissingProfiles] checked ${candidates.length} recent accounts, repaired ${repaired}`
    );
    return null;
  });
