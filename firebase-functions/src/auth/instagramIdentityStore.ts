import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";
import { resolveInstagramIdentity } from "./instagramAuthPolicy";
import type { InstagramProfile } from "./instagramApiClient";
import type { InstagramOAuthStateDocument } from "./instagramOAuthStateStore";

const AUTH_LINK_COLLECTION = "instagramAuthLinks";

function linkDocumentId(instagramUserId: string): string {
  return `instagram_${instagramUserId}`;
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maxLength ? trimmed : undefined;
}

function claimsWithoutInstagram(
  claims: Record<string, unknown> | undefined
): Record<string, unknown> {
  const result = { ...(claims ?? {}) };
  delete result.instagram;
  return result;
}

function instagramUserFieldDeletions(): Record<string, unknown> {
  return {
    instagramAuthId: admin.firestore.FieldValue.delete(),
    instagramUsername: admin.firestore.FieldValue.delete(),
    instagramAuthAccountType: admin.firestore.FieldValue.delete(),
    instagramAuthLinkedAt: admin.firestore.FieldValue.delete(),
    instagramAuthRevokedAt: admin.firestore.FieldValue.delete(),
    instagramAuthDisplayNameValue: admin.firestore.FieldValue.delete(),
    instagramAuthPhotoURLValue: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

export async function resolveAndStoreInstagramIdentity(input: {
  stateRef: admin.firestore.DocumentReference;
  state: InstagramOAuthStateDocument;
  instagramUserId: string;
  profile: InstagramProfile;
}): Promise<{ resolvedUid: string; collision: boolean }> {
  const db = admin.firestore();
  const linkRef = db
    .collection(AUTH_LINK_COLLECTION)
    .doc(linkDocumentId(input.instagramUserId));

  return db.runTransaction(async (transaction) => {
    const linkSnapshot = await transaction.get(linkRef);
    const existingUid = linkSnapshot.exists
      ? (safeString(linkSnapshot.data()?.uid, 128) ?? null)
      : null;
    const resolution = resolveInstagramIdentity({
      intent: input.state.intent,
      requesterUid: input.state.requesterUid,
      requesterWasAnonymous: input.state.requesterWasAnonymous,
      existingUid,
    });

    const timestamp = admin.firestore.Timestamp.now();
    transaction.set(
      linkRef,
      {
        provider: "instagram",
        instagramUserId: input.instagramUserId,
        uid: resolution.resolvedUid,
        lastAuthorizedAt: timestamp,
        revokedAt: admin.firestore.FieldValue.delete(),
        ...(resolution.createLink ? { createdAt: timestamp } : {}),
      },
      { merge: true }
    );
    transaction.update(input.stateRef, {
      resolvedUid: resolution.resolvedUid,
      collision: resolution.collision,
      ...(input.profile.username
        ? { instagramUsername: input.profile.username }
        : {}),
    });

    return {
      resolvedUid: resolution.resolvedUid,
      collision: resolution.collision,
    };
  });
}

export async function applyInstagramIdentity(input: {
  uid: string;
  instagramUserId: string;
  profile: InstagramProfile;
  requesterWasAnonymous: boolean;
}): Promise<void> {
  const auth = admin.auth();
  const user = await auth.getUser(input.uid);
  const instagramOnly =
    user.providerData.length === 0 && user.customClaims?.instagram === true;
  const canAdoptInstagramProfile = input.requesterWasAnonymous || instagramOnly;

  const displayName =
    input.profile.name ||
    (input.profile.username ? `@${input.profile.username}` : "Instagram user");
  const updates: admin.auth.UpdateRequest = {};
  const adoptsDisplayName = canAdoptInstagramProfile && !user.displayName;
  const adoptsPhotoURL =
    canAdoptInstagramProfile &&
    !user.photoURL &&
    Boolean(input.profile.profilePictureUrl);
  if (adoptsDisplayName) {
    updates.displayName = displayName;
  }
  if (adoptsPhotoURL && input.profile.profilePictureUrl) {
    updates.photoURL = input.profile.profilePictureUrl;
  }

  const writes: Array<Promise<unknown>> = [
    auth.setCustomUserClaims(input.uid, {
      ...(user.customClaims ?? {}),
      instagram: true,
    }),
  ];
  if (Object.keys(updates).length > 0) {
    writes.push(auth.updateUser(input.uid, updates));
  }

  const userDocument: Record<string, unknown> = {
    instagramAuthId: input.instagramUserId,
    instagramAuthLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
    instagramAuthRevokedAt: admin.firestore.FieldValue.delete(),
    isAnonymous: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (input.profile.username) {
    userDocument.instagramUsername = input.profile.username;
  }
  if (input.profile.accountType) {
    userDocument.instagramAuthAccountType = input.profile.accountType;
  }
  if (adoptsDisplayName) {
    userDocument.instagramAuthDisplayNameValue = displayName;
  }
  if (adoptsPhotoURL && input.profile.profilePictureUrl) {
    userDocument.instagramAuthPhotoURLValue = input.profile.profilePictureUrl;
  }
  writes.push(
    admin
      .firestore()
      .collection("users")
      .doc(input.uid)
      .set(userDocument, { merge: true })
  );

  await Promise.all(writes);

  // Keep exactly one Instagram credential per TKA account. This also removes
  // a revoked identity after the person deliberately connects a replacement.
  const links = await admin
    .firestore()
    .collection(AUTH_LINK_COLLECTION)
    .where("uid", "==", input.uid)
    .get();
  const currentLinkId = linkDocumentId(input.instagramUserId);
  const staleLinks = links.docs.filter((link) => link.id !== currentLinkId);
  if (staleLinks.length > 0) {
    const batch = admin.firestore().batch();
    for (const link of staleLinks) batch.delete(link.ref);
    await batch.commit();
  }
}

export async function unlinkInstagramIdentity(uid: string): Promise<void> {
  const auth = admin.auth();
  const user = await auth.getUser(uid);
  if (user.providerData.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "Instagram is the only sign-in method",
      { reason: "instagram/only-method" }
    );
  }

  const db = admin.firestore();
  const links = (
    await db
      .collection(AUTH_LINK_COLLECTION)
      .where("uid", "==", uid)
      .limit(5)
      .get()
  ).docs;
  const batch = db.batch();
  for (const link of links) {
    if (link.data()?.uid === uid) batch.delete(link.ref);
  }
  batch.set(db.collection("users").doc(uid), instagramUserFieldDeletions(), {
    merge: true,
  });

  await Promise.all([
    batch.commit(),
    auth.setCustomUserClaims(uid, claimsWithoutInstagram(user.customClaims)),
  ]);
}

export type InstagramDataDeletionResult =
  | "account-deleted"
  | "instagram-data-deleted"
  | "not-found";

/** Remove every Instagram-derived identifier after Meta verifies the request. */
export async function deleteInstagramDataForMetaRequest(
  instagramUserId: string
): Promise<InstagramDataDeletionResult> {
  const db = admin.firestore();
  const auth = admin.auth();
  const linkRef = db
    .collection(AUTH_LINK_COLLECTION)
    .doc(linkDocumentId(instagramUserId));
  const link = await linkRef.get();
  if (!link.exists) return "not-found";

  const uid = safeString(link.data()?.uid, 128);
  if (!uid) {
    await linkRef.delete();
    return "not-found";
  }

  let user: admin.auth.UserRecord;
  try {
    user = await auth.getUser(uid);
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      await linkRef.delete();
      return "not-found";
    }
    throw error;
  }

  const userRef = db.collection("users").doc(uid);
  const userDocument = await userRef.get();
  const recordedDisplayName = safeString(
    userDocument.data()?.instagramAuthDisplayNameValue,
    256
  );
  const recordedPhotoURL = safeString(
    userDocument.data()?.instagramAuthPhotoURLValue,
    2048
  );

  // A custom-token-only Firebase user has no remaining way to authenticate
  // once Instagram data is removed, so fulfill the request as account deletion.
  if (user.providerData.length === 0) {
    await userRef.set(instagramUserFieldDeletions(), { merge: true });
    await auth.deleteUser(uid);
    await linkRef.delete();
    return "account-deleted";
  }

  const authUpdate: admin.auth.UpdateRequest = {};
  if (recordedDisplayName && user.displayName === recordedDisplayName) {
    authUpdate.displayName = null;
  }
  if (recordedPhotoURL && user.photoURL === recordedPhotoURL) {
    authUpdate.photoURL = null;
  }

  const authWrites: Array<Promise<unknown>> = [
    auth.setCustomUserClaims(uid, claimsWithoutInstagram(user.customClaims)),
    auth.revokeRefreshTokens(uid),
  ];
  if (Object.keys(authUpdate).length > 0) {
    authWrites.push(auth.updateUser(uid, authUpdate));
  }
  await Promise.all(authWrites);

  const batch = db.batch();
  batch.delete(linkRef);
  batch.set(userRef, instagramUserFieldDeletions(), { merge: true });
  await batch.commit();
  return "instagram-data-deleted";
}

/** Revoke active sessions while preserving the uid lookup for reconnection. */
export async function deauthorizeInstagramIdentity(
  instagramUserId: string
): Promise<void> {
  const db = admin.firestore();
  const linkRef = db
    .collection(AUTH_LINK_COLLECTION)
    .doc(linkDocumentId(instagramUserId));
  const link = await linkRef.get();
  if (!link.exists) return;

  const uid = safeString(link.data()?.uid, 128);
  if (!uid) return;

  try {
    const auth = admin.auth();
    const user = await auth.getUser(uid);
    await Promise.all([
      auth.setCustomUserClaims(uid, claimsWithoutInstagram(user.customClaims)),
      auth.revokeRefreshTokens(uid),
      linkRef.set(
        { revokedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      ),
      db.collection("users").doc(uid).set(
        {
          instagramAuthRevokedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      await linkRef.delete();
      return;
    }
    throw error;
  }
}
