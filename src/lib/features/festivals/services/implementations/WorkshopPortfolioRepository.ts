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
import type { IWorkshopPortfolioRepository } from "../contracts/IWorkshopPortfolioRepository";

export class WorkshopPortfolioRepository implements IWorkshopPortfolioRepository {
  async get(userId: string): Promise<TeachingPortfolio | null> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "userProfiles", userId, "workshopPortfolio", "data");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as TeachingPortfolio;
  }

  async set(userId: string, portfolio: TeachingPortfolio): Promise<void> {
    const db = await getFirestoreInstance();
    const ref = doc(db, "userProfiles", userId, "workshopPortfolio", "data");
    await setDoc(ref, {
      ...portfolio,
      userId,
      updatedAt: serverTimestamp(),
    });
  }
}
