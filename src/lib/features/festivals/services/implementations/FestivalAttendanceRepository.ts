/**
 * FestivalAttendanceRepository
 *
 * Tracks who's going (or interested in) each festival.
 * Each user gets one document per festival they've marked.
 *
 * Path: festivals/{festivalId}/attendance/{userId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  getCountFromServer,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { FestivalAttendance } from "../../domain/models/festival";

export class FestivalAttendanceRepository {
  async getCount(festivalId: string): Promise<number> {
    const db = await getFirestoreInstance();
    const ref = collection(db, "festivals", festivalId, "attendance");
    const result = await getCountFromServer(ref);
    return result.data().count;
  }

  async getAttendees(festivalId: string): Promise<FestivalAttendance[]> {
    const db = await getFirestoreInstance();
    const ref = collection(db, "festivals", festivalId, "attendance");
    const snap = await getDocs(ref);
    return snap.docs.map((d) => d.data() as FestivalAttendance);
  }

  async setAttendance(
    festivalId: string,
    userId: string,
    data: Omit<FestivalAttendance, "festivalId" | "userId">
  ): Promise<void> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "festivals", festivalId, "attendance", userId);
    await setDoc(ref, {
      ...data,
      festivalId,
      userId,
      createdAt: serverTimestamp(),
    });
  }

  async removeAttendance(festivalId: string, userId: string): Promise<void> {
    const db = await getFirestoreInstance();
    await deleteDoc(doc(db, "festivals", festivalId, "attendance", userId));
  }
}
