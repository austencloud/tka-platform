/**
 * Error Telemetry Reporter
 *
 * Silently logs non-blocking errors to the Firestore `errorTelemetry` collection.
 * When the same error occurs multiple times within 24 hours (matched by message +
 * module + action), it increments the count on the existing document rather than
 * creating duplicates.
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { ShowErrorOptions } from "$lib/shared/error/domain/error-models";

const COLLECTION = "errorTelemetry";
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function reportErrorTelemetry(options: ShowErrorOptions): Promise<void> {
  try {
    const db = await getFirestoreInstance();

    const message = options.message;
    const module = options.context?.module ?? "unknown";
    const action = options.context?.action ?? "unknown";
    const key = `${message}::${module}::${action}`;

    const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

    const col = collection(db, COLLECTION);
    const q = query(
      col,
      where("key", "==", key),
      where("lastSeen", ">=", cutoff)
    );

    const snapshot = await getDocs(q);

    const lastStack = options.error?.stack ?? null;
    const lastAdditionalData =
      (options.context?.additionalData as object | undefined) ?? null;

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0]!;
      await updateDoc(existingDoc.ref, {
        count: increment(1),
        lastSeen: serverTimestamp(),
        lastStack,
        lastAdditionalData,
      });
    } else {
      await addDoc(col, {
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
