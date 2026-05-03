/**
 * FestivalRepository
 *
 * Basic CRUD for festival documents in Firestore.
 * Festivals live at festivals/{festivalId}.
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Festival } from "../../domain/models/festival";
export class FestivalRepository {
  async getById(id: string): Promise<Festival | null> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "festivals", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Festival;
  }

  async create(festival: Omit<Festival, "id">): Promise<string> {
    const db = await getFirestoreInstance();
    // Firestore rejects undefined values - strip them
    const cleaned = JSON.parse(JSON.stringify(festival));
    const ref = await addDoc(collection(db, "festivals"), {
      ...cleaned,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async update(id: string, data: Partial<Festival>): Promise<void> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "festivals", id);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }

  async delete(id: string): Promise<void> {
    const db = await getFirestoreInstance();
    await deleteDoc(doc(db, "festivals", id));
  }
}
