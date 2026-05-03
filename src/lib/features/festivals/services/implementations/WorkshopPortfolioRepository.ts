/**
 * WorkshopPortfolioRepository
 *
 * Persists a user's teaching portfolio: workshop templates, bios,
 * performance credits, social links, and insurance info.
 *
 * Path: userProfiles/{userId}/workshopPortfolio (single document)
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { TeachingPortfolio } from "../../domain/models/teaching-portfolio";

export class WorkshopPortfolioRepository {
  async get(userId: string): Promise<TeachingPortfolio | null> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "userProfiles", userId, "workshopPortfolio", "data");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as TeachingPortfolio;
    // Backwards compat: acts field added after initial release
    if (!data.acts) data.acts = [];
    return data;
  }

  async set(userId: string, portfolio: TeachingPortfolio): Promise<void> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "userProfiles", userId, "workshopPortfolio", "data");
    // Strip any Timestamp objects with non-serializable .toDate methods,
    // then re-add timestamps via serverTimestamp()
    const cleaned = JSON.parse(JSON.stringify(portfolio));
    delete cleaned.createdAt;
    delete cleaned.updatedAt;
    // Preserve createdAt on updates by checking if doc exists
    const existing = await getDoc(ref);
    await setDoc(ref, {
      ...cleaned,
      userId,
      createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}
