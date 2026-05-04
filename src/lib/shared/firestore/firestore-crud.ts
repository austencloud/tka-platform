import { z } from "zod";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  startAfter as firestoreStartAfter,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { stripUndefined } from "./firestore-helpers";
import type { ListOptions, WriteOptions } from "./firestore-types";

function buildQuery(
  collectionPath: string,
  db: import("firebase/firestore").Firestore,
  options?: ListOptions,
) {
  const constraints: import("firebase/firestore").QueryConstraint[] = [];

  if (options?.where) {
    for (const clause of options.where) {
      constraints.push(where(clause.field, clause.op, clause.value));
    }
  }
  if (options?.orderBy) {
    for (const ob of options.orderBy) {
      constraints.push(orderBy(ob.field, ob.direction ?? "asc"));
    }
  }
  if (options?.limit) {
    constraints.push(firestoreLimit(options.limit));
  }
  if (options?.startAfter !== undefined) {
    constraints.push(firestoreStartAfter(options.startAfter));
  }

  return query(collection(db, collectionPath), ...constraints);
}

interface SchemaLike<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } };
}

function parseDoc<T>(
  schema: SchemaLike<T>,
  id: string,
  data: Record<string, unknown>,
  collectionPath: string,
): T | null {
  const result = schema.safeParse({ id, ...data });
  if (result.success) return result.data;
  console.warn(
    `[firestore] Validation failed for ${collectionPath}/${id}:`,
    result.error.issues,
  );
  return null;
}

export async function firestoreGet<T>(
  collectionPath: string,
  id: string,
  schema: SchemaLike<T>,
): Promise<T | null> {
  const db = await getFirestoreInstance();
  const snap = await getDoc(doc(db, collectionPath, id));
  if (!snap.exists()) return null;
  return parseDoc(schema, snap.id, snap.data() as Record<string, unknown>, collectionPath);
}

export async function firestoreList<T>(
  collectionPath: string,
  schema: SchemaLike<T>,
  options?: ListOptions,
): Promise<T[]> {
  const db = await getFirestoreInstance();
  const q = buildQuery(collectionPath, db, options);
  const snap = await getDocs(q);
  const items: T[] = [];
  for (const d of snap.docs) {
    const parsed = parseDoc(schema, d.id, d.data() as Record<string, unknown>, collectionPath);
    if (parsed !== null) items.push(parsed);
  }
  return items;
}

export async function firestoreSet<T extends Record<string, unknown>>(
  collectionPath: string,
  id: string | null,
  data: T,
  options?: WriteOptions,
): Promise<string> {
  const db = await getFirestoreInstance();
  const cleaned = stripUndefined({ ...data });

  const isCreate = id === null;
  const timestamps: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (isCreate) {
    timestamps.createdAt = serverTimestamp();
  }

  const docData = { ...cleaned, ...timestamps };

  const doWrite = async () => {
    if (isCreate) {
      const ref = await addDoc(collection(db, collectionPath), docData);
      return ref.id;
    }
    const ref = doc(db, collectionPath, id);
    if (options?.merge) {
      await setDoc(ref, docData, { merge: true });
    } else {
      await setDoc(ref, docData);
    }
    return id;
  };

  if (options?.trackOffline) {
    return trackWrite(doWrite, options.repoName);
  }
  return doWrite();
}

export async function firestoreDelete(
  collectionPath: string,
  id: string,
  options?: { trackOffline?: boolean; repoName?: string },
): Promise<void> {
  const db = await getFirestoreInstance();
  const ref = doc(db, collectionPath, id);

  const doDelete = () => deleteDoc(ref);

  if (options?.trackOffline) {
    await trackWrite(doDelete, options.repoName);
  } else {
    await doDelete();
  }
}

export function firestoreListen<T>(
  collectionPath: string,
  schema: SchemaLike<T>,
  callback: (items: T[]) => void,
  options?: ListOptions,
  onError?: (error: Error) => void,
): () => void {
  let unsubscribe: (() => void) | null = null;

  getFirestoreInstance().then((db) => {
    const q = buildQuery(collectionPath, db, options);
    unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: T[] = [];
        for (const d of snap.docs) {
          const parsed = parseDoc(
            schema,
            d.id,
            d.data() as Record<string, unknown>,
            collectionPath,
          );
          if (parsed !== null) items.push(parsed);
        }
        callback(items);
      },
      (error) => {
        if (onError) {
          onError(error);
        } else {
          console.warn(`[firestore] Listener error on ${collectionPath}:`, error);
        }
      },
    );
  });

  return () => {
    unsubscribe?.();
  };
}
