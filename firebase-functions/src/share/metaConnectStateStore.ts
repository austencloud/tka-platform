/**
 * The short-lived handshake record for a publish-connect popup.
 *
 * A sibling of `instagramOAuthStateStore`, deliberately NOT a shared one. The
 * sign-in store's document shape carries identity-resolution fields
 * (`requesterWasAnonymous`, `resolvedUid`, `collision`) that only make sense
 * when the callback mints a Firebase session. This flow never touches Firebase
 * Auth — it attaches a publishing credential to an already-signed-in uid — so
 * folding the two together would mean a single document whose meaning depends
 * on which flow wrote it. Sign-in is load-bearing; it stays untouched.
 */

import { randomBytes } from "node:crypto";
import * as admin from "firebase-admin";
import type { MetaConnectionTarget } from "./metaConnectionStore";

const COLLECTION = "metaConnectStates";
const LIFETIME_MS = 10 * 60 * 1000;

export type MetaConnectStatus = "pending" | "processing" | "complete" | "error";

export type MetaConnectFailureCode =
  | "meta/cancelled"
  | "meta/state-invalid"
  | "meta/state-expired"
  | "meta/no-pages"
  | "meta/not-configured"
  | "meta/provider-error";

export class MetaConnectError extends Error {
  constructor(readonly code: MetaConnectFailureCode) {
    super(code);
    this.name = "MetaConnectError";
  }
}

export interface MetaConnectStateDocument {
  requesterUid: string;
  target: MetaConnectionTarget;
  returnOrigin: string;
  status: MetaConnectStatus;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  accountName?: string;
  errorCode?: MetaConnectFailureCode;
}

export function isMetaConnectStateId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export async function createMetaConnectState(input: {
  requesterUid: string;
  target: MetaConnectionTarget;
  returnOrigin: string;
}): Promise<{ state: string; expiresAtMs: number }> {
  const state = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAtMs = now + LIFETIME_MS;

  await admin
    .firestore()
    .collection(COLLECTION)
    .doc(state)
    .set({
      ...input,
      status: "pending",
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    } satisfies MetaConnectStateDocument);

  return { state, expiresAtMs };
}

/** Transitions pending → processing inside a transaction so a replayed
 *  callback cannot spend the same authorization code twice. */
export async function claimMetaConnectState(state: string): Promise<{
  ref: admin.firestore.DocumentReference;
  data: MetaConnectStateDocument;
}> {
  if (!isMetaConnectStateId(state)) {
    throw new MetaConnectError("meta/state-invalid");
  }

  const db = admin.firestore();
  const ref = db.collection(COLLECTION).doc(state);
  const data = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new MetaConnectError("meta/state-invalid");

    const value = snapshot.data() as MetaConnectStateDocument;
    if (value.expiresAt.toMillis() <= Date.now()) {
      throw new MetaConnectError("meta/state-expired");
    }
    if (value.status !== "pending") {
      throw new MetaConnectError("meta/state-invalid");
    }

    transaction.update(ref, {
      status: "processing",
      processingAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return value;
  });

  return { ref, data };
}

export async function markMetaConnectComplete(
  ref: admin.firestore.DocumentReference,
  accountName: string
): Promise<void> {
  await ref.set(
    {
      status: "complete",
      accountName,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markMetaConnectError(
  ref: admin.firestore.DocumentReference,
  code: MetaConnectFailureCode
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

export async function getMetaConnectState(state: string): Promise<{
  ref: admin.firestore.DocumentReference;
  data?: MetaConnectStateDocument;
}> {
  const ref = admin.firestore().collection(COLLECTION).doc(state);
  const snapshot = await ref.get();
  return {
    ref,
    data: snapshot.exists
      ? (snapshot.data() as MetaConnectStateDocument)
      : undefined,
  };
}

export function metaConnectFailureMessage(code: MetaConnectFailureCode): string {
  switch (code) {
    case "meta/cancelled":
      return "Authorization was cancelled.";
    case "meta/no-pages":
      return "No Pages came through. Try again and share all your Pages.";
    case "meta/state-expired":
      return "This connection request expired. Try again.";
    case "meta/not-configured":
      return "Posting is not configured on this deployment yet.";
    default:
      return "Meta could not complete the connection.";
  }
}
