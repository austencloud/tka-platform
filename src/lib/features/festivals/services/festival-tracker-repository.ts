/**
 * festival-tracker-repository
 *
 * Persists each user's per-festival tracking state - application status,
 * workshops submitted, notes, and key dates - in a user-owned subcollection.
 *
 * Path: userFestivalTracking/{userId}/tracked/{festivalId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { UserFestivalTracker } from "../domain/models/festival-tracker";

export async function get(userId: string, festivalId: string): Promise<UserFestivalTracker | null> {
  const db = await getFirestoreInstance();
  const ref = doc(db, "userFestivalTracking", userId, "tracked", festivalId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserFestivalTracker;
}

export async function getAllForUser(userId: string): Promise<Map<string, UserFestivalTracker>> {
  const db = await getFirestoreInstance();
  const ref = collection(db, "userFestivalTracking", userId, "tracked");
  const snap = await getDocs(ref);
  const result = new Map<string, UserFestivalTracker>();
  for (const d of snap.docs) {
    result.set(d.id, d.data() as UserFestivalTracker);
  }
  return result;
}

export async function set(userId: string, festivalId: string, data: Partial<UserFestivalTracker>): Promise<void> {
  const db = await getFirestoreInstance();
  const ref = doc(db, "userFestivalTracking", userId, "tracked", festivalId);
  await setDoc(
    ref,
    {
      ...data,
      userId,
      festivalId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteTracker(userId: string, festivalId: string): Promise<void> {
  const db = await getFirestoreInstance();
  await deleteDoc(doc(db, "userFestivalTracking", userId, "tracked", festivalId));
}
