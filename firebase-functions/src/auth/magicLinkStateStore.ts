import {
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import * as admin from "firebase-admin";

const MAGIC_LINK_STATE_COLLECTION = "magicLinkSignInStates";
export const MAGIC_LINK_STATE_LIFETIME_MS = 30 * 60 * 1000;
export const MAGIC_LINK_CODE_MAX_ATTEMPTS = 5;
const MAGIC_LINK_CODE_LENGTH = 6;
const CODE_HASH_BYTES = 32;

// Firestore TTL cleanup can lag behind the timestamp. Resolution checks the
// timestamp itself, so a document waiting to be deleted never extends a link.

interface MagicLinkSignInStateDocument {
  email: string;
  requestId: string;
  codeSalt: string;
  codeHash: string;
  codeAttempts: number;
  codeConsumedAt: admin.firestore.Timestamp | null;
  initiatingUid: string | null;
  createdAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
}

export interface MagicLinkSignInState {
  state: string;
  expiresAtMs: number;
  oneTimeCode: string;
}

export interface ResolvedMagicLinkSignInState {
  email: string;
  expiresAtMs: number;
}

export interface RedeemedMagicLinkCode {
  email: string;
  initiatingUid: string | null;
}

interface ParsedMagicLinkCodeState extends RedeemedMagicLinkCode {
  codeSalt: string;
  codeHash: string;
  codeAttempts: number;
}

export function isMagicLinkStateId(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isMagicLinkRequestId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isMagicLinkCode(value: string): boolean {
  return new RegExp(`^\\d{${MAGIC_LINK_CODE_LENGTH}}$`).test(value);
}

function hashMagicLinkCode(code: string, salt: Buffer): Buffer {
  return scryptSync(code, salt, CODE_HASH_BYTES, {
    N: 16_384,
    r: 8,
    p: 1,
  });
}

export function verifyMagicLinkCode(
  code: string,
  saltBase64: string,
  hashBase64: string
): boolean {
  if (!isMagicLinkCode(code)) return false;

  try {
    const expected = Buffer.from(hashBase64, "base64");
    const actual = hashMagicLinkCode(code, Buffer.from(saltBase64, "base64"));
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
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
  email: string,
  requestId: string,
  initiatingUid: string | null = null
): Promise<MagicLinkSignInState> {
  const state = randomBytes(32).toString("base64url");
  const oneTimeCode = randomInt(0, 1_000_000)
    .toString()
    .padStart(MAGIC_LINK_CODE_LENGTH, "0");
  const codeSalt = randomBytes(16);
  const now = Date.now();
  const expiresAtMs = now + MAGIC_LINK_STATE_LIFETIME_MS;

  await admin
    .firestore()
    .collection(MAGIC_LINK_STATE_COLLECTION)
    .doc(state)
    .set({
      email,
      requestId,
      codeSalt: codeSalt.toString("base64"),
      codeHash: hashMagicLinkCode(oneTimeCode, codeSalt).toString("base64"),
      codeAttempts: 0,
      codeConsumedAt: null,
      initiatingUid,
      createdAt: admin.firestore.Timestamp.fromMillis(now),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
    } satisfies MagicLinkSignInStateDocument);

  return { state, expiresAtMs, oneTimeCode };
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

export function parseMagicLinkCodeState(
  value: unknown,
  nowMs: number
): ParsedMagicLinkCodeState | null {
  if (typeof value !== "object" || value === null) return null;

  const candidate = value as {
    email?: unknown;
    initiatingUid?: unknown;
    codeSalt?: unknown;
    codeHash?: unknown;
    codeAttempts?: unknown;
    codeConsumedAt?: unknown;
    expiresAt?: { toMillis?: () => number };
  };
  const expiresAtMs = candidate.expiresAt?.toMillis?.();
  if (
    typeof candidate.email !== "string" ||
    !candidate.email ||
    (candidate.initiatingUid !== null &&
      typeof candidate.initiatingUid !== "string") ||
    typeof candidate.codeSalt !== "string" ||
    typeof candidate.codeHash !== "string" ||
    typeof candidate.codeAttempts !== "number" ||
    candidate.codeAttempts < 0 ||
    candidate.codeAttempts >= MAGIC_LINK_CODE_MAX_ATTEMPTS ||
    candidate.codeConsumedAt != null ||
    typeof expiresAtMs !== "number" ||
    expiresAtMs <= nowMs
  ) {
    return null;
  }

  return {
    email: candidate.email,
    initiatingUid: candidate.initiatingUid,
    codeSalt: candidate.codeSalt,
    codeHash: candidate.codeHash,
    codeAttempts: candidate.codeAttempts,
  };
}

/**
 * Consume the code bound to a request. Invalid, expired, used, and locked codes
 * deliberately share one null result so callers do not expose account state.
 */
export async function redeemMagicLinkCode(
  requestId: string,
  code: string
): Promise<RedeemedMagicLinkCode | null> {
  if (!isMagicLinkRequestId(requestId) || !isMagicLinkCode(code)) return null;

  const db = admin.firestore();
  const snapshot = await db
    .collection(MAGIC_LINK_STATE_COLLECTION)
    .where("requestId", "==", requestId)
    .limit(1)
    .get();
  const match = snapshot.docs[0];
  if (!match) return null;

  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(match.ref);
    const parsed = parseMagicLinkCodeState(current.data(), Date.now());
    if (!parsed) return null;

    if (!verifyMagicLinkCode(code, parsed.codeSalt, parsed.codeHash)) {
      transaction.update(match.ref, {
        codeAttempts: parsed.codeAttempts + 1,
      });
      return null;
    }

    transaction.update(match.ref, {
      codeConsumedAt: admin.firestore.Timestamp.now(),
    });
    return {
      email: parsed.email,
      initiatingUid: parsed.initiatingUid,
    };
  });
}
