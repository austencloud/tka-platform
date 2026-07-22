import { randomBytes } from "node:crypto";
import * as admin from "firebase-admin";
import {
  InstagramAuthPolicyError,
  type InstagramAuthFailureCode,
  type InstagramAuthIntent,
} from "./instagramAuthPolicy";

const OAUTH_STATE_COLLECTION = "instagramOAuthStates";
const OAUTH_STATE_LIFETIME_MS = 10 * 60 * 1000;

export type InstagramOAuthStateStatus =
  | "pending"
  | "processing"
  | "complete"
  | "error";

export interface InstagramOAuthStateDocument {
  requesterUid: string;
  requesterWasAnonymous: boolean;
  intent: InstagramAuthIntent;
  returnOrigin: string;
  status: InstagramOAuthStateStatus;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  resolvedUid?: string;
  collision?: boolean;
  instagramUsername?: string;
  errorCode?: InstagramAuthFailureCode;
}

export function isInstagramStateId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function createInstagramOAuthState(input: {
  requesterUid: string;
  requesterWasAnonymous: boolean;
  intent: InstagramAuthIntent;
  returnOrigin: string;
}): Promise<{ state: string; expiresAtMs: number }> {
  const state = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAtMs = now + OAUTH_STATE_LIFETIME_MS;
  await admin
    .firestore()
    .collection(OAUTH_STATE_COLLECTION)
    .doc(state)
    .set({
      ...input,
      status: "pending",
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    } satisfies InstagramOAuthStateDocument);

  return { state, expiresAtMs };
}

export async function claimInstagramOAuthState(state: string): Promise<{
  ref: admin.firestore.DocumentReference;
  data: InstagramOAuthStateDocument;
}> {
  if (!isInstagramStateId(state)) {
    throw new InstagramAuthPolicyError("instagram/state-invalid");
  }

  const db = admin.firestore();
  const ref = db.collection(OAUTH_STATE_COLLECTION).doc(state);
  const data = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      throw new InstagramAuthPolicyError("instagram/state-invalid");
    }

    const value = snapshot.data() as InstagramOAuthStateDocument;
    if (value.expiresAt.toMillis() <= Date.now()) {
      throw new InstagramAuthPolicyError("instagram/state-expired");
    }
    if (value.status !== "pending") {
      throw new InstagramAuthPolicyError("instagram/state-invalid");
    }

    transaction.update(ref, {
      status: "processing",
      processingAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return value;
  });

  return { ref, data };
}

export async function markInstagramOAuthStateError(
  ref: admin.firestore.DocumentReference,
  code: InstagramAuthFailureCode
): Promise<void> {
  await ref.set(
    {
      status: "error",
      errorCode: code,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getInstagramOAuthState(state: string): Promise<{
  ref: admin.firestore.DocumentReference;
  exists: boolean;
  data?: InstagramOAuthStateDocument;
}> {
  const ref = admin.firestore().collection(OAUTH_STATE_COLLECTION).doc(state);
  const snapshot = await ref.get();
  return {
    ref,
    exists: snapshot.exists,
    data: snapshot.exists
      ? (snapshot.data() as InstagramOAuthStateDocument)
      : undefined,
  };
}
