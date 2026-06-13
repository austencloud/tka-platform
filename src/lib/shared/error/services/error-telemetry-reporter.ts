/**
 * Error Telemetry Reporter
 *
 * Silently logs non-blocking errors to the Firestore `errorTelemetry` collection.
 * The collection is write-only from the client (rules deny reads), so dedup can't
 * query for an existing doc — instead the doc ID is deterministic: the same error
 * on the same UTC day always writes to the same document. Recurrences increment
 * the count via updateDoc; the first occurrence falls through to setDoc.
 */

import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { ShowErrorOptions } from "$lib/shared/error/domain/error-models";

const COLLECTION = "errorTelemetry";

// FNV-1a 32-bit — keeps arbitrary error messages (slashes and all) out of the doc ID.
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// An update against a missing doc surfaces as "permission-denied", not
// "not-found", when security rules are in play: the rules can't evaluate
// resource.data, and Firestore masks the error to avoid leaking whether the
// doc exists. Our update payload never touches a rules-restricted field, so
// either code can only mean "no doc yet — create it".
function isMissingDocError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "not-found" || code === "permission-denied";
}

export async function reportErrorTelemetry(options: ShowErrorOptions): Promise<void> {
  try {
    const db = await getFirestoreInstance();

    const message = options.message;
    const module = options.context?.module ?? "unknown";
    const action = options.context?.action ?? "unknown";
    const key = `${message}::${module}::${action}`;

    const utcDay = new Date().toISOString().slice(0, 10);
    const docRef = doc(db, COLLECTION, `${utcDay}_${fnv1aHash(key)}`);

    const lastStack = options.error?.stack ?? null;
    const lastAdditionalData =
      (options.context?.additionalData as object | undefined) ?? null;

    try {
      // updateDoc requires the doc to exist — that's the dedup check.
      await updateDoc(docRef, {
        count: increment(1),
        lastSeen: serverTimestamp(),
        lastStack,
        lastAdditionalData,
      });
    } catch (err) {
      if (!isMissingDocError(err)) throw err;

      await setDoc(docRef, {
        key,
        message,
        technicalDetails: options.technicalDetails ?? null,
        module,
        action,
        severity: options.severity ?? "error",
        count: 1,
        firstSeen: serverTimestamp(),
        lastSeen: serverTimestamp(),
        lastStack,
        lastAdditionalData,
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
        resolved: false,
      });
    }
  } catch (err) {
    console.warn("[ErrorTelemetryReporter] Failed to report telemetry:", err);
  }
}
