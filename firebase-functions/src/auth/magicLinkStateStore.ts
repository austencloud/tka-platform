import { randomBytes } from "node:crypto";
import * as admin from "firebase-admin";

const MAGIC_LINK_STATE_COLLECTION = "magicLinkSignInStates";
export const MAGIC_LINK_STATE_LIFETIME_MS = 30 * 60 * 1000;

// Firestore TTL cleanup can lag behind the timestamp. Resolution checks the
// timestamp itself, so a document waiting to be deleted never extends a link.

interface MagicLinkSignInStateDocument {
  email: string;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
}

export interface MagicLinkSignInState {
  state: string;
  expiresAtMs: number;
}

export interface ResolvedMagicLinkSignInState {
  email: string;
  expiresAtMs: number;
}

export function isMagicLinkStateId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function parseMagicLinkSignInState(
  value: unknown,
  nowMs: number
): ResolvedMagicLinkSignInState | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as {
    email?: unknown;
    expiresAt?: { toMillis?: () => number };
  };
  const expiresAtMs = candidate.expiresAt?.toMillis?.();
  if (
    typeof candidate.email !== "string" ||
    !candidate.email ||
    typeof expiresAtMs !== "number" ||
    expiresAtMs <= nowMs
  ) {
    return null;
  }

  return { email: candidate.email, expiresAtMs };
}

export async function createMagicLinkSignInState(
  email: string
): Promise<MagicLinkSignInState> {
  const state = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAtMs = now + MAGIC_LINK_STATE_LIFETIME_MS;

  await admin
    .firestore()
    .collection(MAGIC_LINK_STATE_COLLECTION)
    .doc(state)
    .set({
      email,
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    } satisfies MagicLinkSignInStateDocument);

  return { state, expiresAtMs };
}

export async function resolveMagicLinkSignInState(
  state: string
): Promise<ResolvedMagicLinkSignInState | null> {
  if (!isMagicLinkStateId(state)) return null;

  const snapshot = await admin
    .firestore()
    .collection(MAGIC_LINK_STATE_COLLECTION)
    .doc(state)
    .get();
  if (!snapshot.exists) return null;

  return parseMagicLinkSignInState(snapshot.data(), Date.now());
}
