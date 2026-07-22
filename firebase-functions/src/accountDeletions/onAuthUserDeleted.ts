/**
 * Account deletion tombstone — Auth onDelete trigger.
 *
 * Fires on ANY Firebase Auth user deletion (in-app self-delete, console,
 * future admin tooling). v2 identity triggers are blocking-only (no delete
 * event), so this is v1: `firebase-functions/v1` → `auth.user().onDelete()`.
 * That handler receives the full UserRecord (email, displayName,
 * metadata.creationTime, providerData) — the console/other-path deletions
 * this trigger also has to cover have no other source for those fields.
 *
 * Cascade steps run independently (each try/caught) so one failure never
 * blocks the rest — a failed notifyAdmins ping must not leave orphaned
 * Firestore data, and a failed cleanup must not suppress the tombstone.
 */

import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import type { UserRecord } from "firebase-admin/auth";
import { notifyAdmins } from "../pulse/notifyAdmins";

const RETENTION_DAYS = 365;

function displayNameOf(user: UserRecord): string {
  return user.displayName || user.email || user.uid;
}

async function writeTombstone(user: UserRecord): Promise<void> {
  const db = admin.firestore();
  const deletedAt = admin.firestore.Timestamp.now();
  const expireAt = admin.firestore.Timestamp.fromMillis(
    deletedAt.toMillis() + RETENTION_DAYS * 24 * 60 * 60 * 1000
  );

  // Merge preserves a `reason` the client wrote to this doc pre-deletion
  // (see AccountManager.deleteAccount) while the trigger fills in the
  // identity fields only the Admin SDK / UserRecord can see.
  await db
    .collection("accountDeletions")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
        providerIds: [
          ...user.providerData.map((p) => p.providerId),
          ...(user.customClaims?.instagram === true ? ["instagram.com"] : []),
        ],
        accountCreatedAt: user.metadata.creationTime
          ? admin.firestore.Timestamp.fromDate(
              new Date(user.metadata.creationTime)
            )
          : null,
        deletedAt,
        expireAt,
      },
      { merge: true }
    );
}

async function cascadeDeleteFirestore(uid: string): Promise<void> {
  const db = admin.firestore();
  // Removes the doc and ALL subcollections (collections, devices,
  // onboarding, settings, activityLog, notifications, ...).
  await db.recursiveDelete(db.doc(`users/${uid}`));
}

async function removePresence(uid: string): Promise<void> {
  await admin.database().ref(`presence/${uid}`).remove();
}

async function removeInstagramAuthLinks(uid: string): Promise<void> {
  const db = admin.firestore();
  const links = await db
    .collection("instagramAuthLinks")
    .where("uid", "==", uid)
    .get();
  if (links.empty) return;

  const batch = db.batch();
  for (const link of links.docs) batch.delete(link.ref);
  await batch.commit();
}

async function pingAdmins(
  user: UserRecord,
  reason: string | null
): Promise<void> {
  const name = displayNameOf(user);
  const message = reason
    ? `${name} deleted their account — reason: "${reason}"`
    : `${name} deleted their account`;

  await notifyAdmins({
    type: "admin-account-deleted",
    message,
    fromUserId: null, // the account no longer exists; never suppress via self-noise check
    data: { deletedUserId: user.uid, deletedUserEmail: user.email ?? null },
  });
}

export const onAuthUserDeleted = functionsV1.auth
  .user()
  .onDelete(async (user: UserRecord) => {
    // Anonymous accounts (no linked provider) are deleted in bulk by the
    // daily cleanupStaleAnonymousAccounts sweep. Tombstoning them is noise
    // (no email/name to remember) and would ping admins once per swept
    // account. Cascade cleanup below still runs — a guest can leave a
    // users/{uid} subtree and a presence node behind.
    const isAnonymous =
      (!user.providerData || user.providerData.length === 0) &&
      user.customClaims?.instagram !== true;

    let reason: string | null = null;
    if (!isAnonymous) {
      try {
        const existing = await admin
          .firestore()
          .collection("accountDeletions")
          .doc(user.uid)
          .get();
        reason = (existing.data()?.reason as string | undefined) ?? null;
      } catch (err) {
        functionsV1.logger.error(
          "onAuthUserDeleted: failed to read pre-existing tombstone reason",
          { uid: user.uid, err }
        );
      }

      try {
        await writeTombstone(user);
      } catch (err) {
        functionsV1.logger.error(
          "onAuthUserDeleted: failed to write tombstone",
          {
            uid: user.uid,
            err,
          }
        );
      }
    }

    try {
      await cascadeDeleteFirestore(user.uid);
    } catch (err) {
      functionsV1.logger.error(
        "onAuthUserDeleted: failed to cascade-delete Firestore subtree",
        { uid: user.uid, err }
      );
    }

    try {
      await removePresence(user.uid);
    } catch (err) {
      functionsV1.logger.error("onAuthUserDeleted: failed to remove presence", {
        uid: user.uid,
        err,
      });
    }

    try {
      await removeInstagramAuthLinks(user.uid);
    } catch (err) {
      functionsV1.logger.error(
        "onAuthUserDeleted: failed to remove Instagram auth links",
        { uid: user.uid, err }
      );
    }

    if (!isAnonymous) {
      try {
        await pingAdmins(user, reason);
      } catch (err) {
        functionsV1.logger.error("onAuthUserDeleted: failed to notify admins", {
          uid: user.uid,
          err,
        });
      }
    }

    return null;
  });
