import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { authState } from "$lib/shared/auth/state/authState.svelte";

// firestoreDate lives in its own worker-safe module (no auth/firebase-client
// import). Re-exported here so existing firestore-helpers / barrel consumers
// keep working unchanged.
export { firestoreDate } from "./firestore-date";

export function stripUndefined<T extends Record<string, unknown>>(
  obj: T,
): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = stripUndefined(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export function requireAuth(): string {
  const userId = authState.effectiveUserId;
  if (!userId) {
    throw new Error("Authentication required");
  }
  return userId;
}

export function buildCollectionRef(
  db: Firestore,
  path: string,
): CollectionReference {
  return collection(db, path);
}

export function buildDocRef(
  db: Firestore,
  path: string,
  id: string,
): DocumentReference {
  return doc(db, path, id);
}
