import { z } from "zod";
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from "firebase/firestore";
import { authState } from "$lib/shared/auth/state/authState.svelte";

export const firestoreDate = z.preprocess((val) => {
  if (val && typeof val === "object" && "toDate" in val) {
    return (val as { toDate(): Date }).toDate();
  }
  return val;
}, z.coerce.date());

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
