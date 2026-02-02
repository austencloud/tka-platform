/**
 * LOOPPresetRepository
 *
 * Firebase implementation for managing user-created LOOP presets.
 * Path: users/{userId}/loopPresets/{presetId}
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  increment,
  Timestamp,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { ILOOPPresetRepository } from "../contracts/ILOOPPresetRepository";
import type {
  UserLOOPPreset,
  CreateUserPresetInput,
} from "../../domain/models/loop-selection-types";
import type { LOOPComponent } from "../../domain/models/generate-models";

export class LOOPPresetRepository implements ILOOPPresetRepository {
  /**
   * Get the collection reference for a user's presets
   */
  private async getPresetsCollection(userId: string) {
    const firestore = await getFirestoreInstance();
    return collection(firestore, "users", userId, "loopPresets");
  }

  /**
   * Get the document reference for a specific preset
   */
  private async getPresetDoc(userId: string, presetId: string) {
    const firestore = await getFirestoreInstance();
    return doc(firestore, "users", userId, "loopPresets", presetId);
  }

  async getUserPresets(userId: string): Promise<UserLOOPPreset[]> {
    const presetsRef = await this.getPresetsCollection(userId);
    const q = query(presetsRef, orderBy("usageCount", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => this.mapDocToPreset(doc.id, doc.data()));
  }

  async getPreset(
    userId: string,
    presetId: string
  ): Promise<UserLOOPPreset | null> {
    const docRef = await this.getPresetDoc(userId, presetId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      return null;
    }

    return this.mapDocToPreset(snapshot.id, snapshot.data());
  }

  async createPreset(
    userId: string,
    input: CreateUserPresetInput
  ): Promise<UserLOOPPreset> {
    const presetsRef = await this.getPresetsCollection(userId);
    const newDocRef = doc(presetsRef);

    const preset: Omit<UserLOOPPreset, "id"> = {
      name: input.name,
      components: input.components,
      icon: input.icon,
      createdAt: Timestamp.now(),
      usageCount: 0,
    };

    await setDoc(newDocRef, preset);

    return {
      id: newDocRef.id,
      ...preset,
    };
  }

  async updatePreset(
    userId: string,
    presetId: string,
    updates: Partial<CreateUserPresetInput>
  ): Promise<void> {
    const docRef = await this.getPresetDoc(userId, presetId);
    await updateDoc(docRef, updates);
  }

  async deletePreset(userId: string, presetId: string): Promise<void> {
    const docRef = await this.getPresetDoc(userId, presetId);
    await deleteDoc(docRef);
  }

  async incrementUsageCount(userId: string, presetId: string): Promise<void> {
    const docRef = await this.getPresetDoc(userId, presetId);
    await updateDoc(docRef, {
      usageCount: increment(1),
    });
  }

  async subscribeToUserPresets(
    userId: string,
    callback: (presets: UserLOOPPreset[]) => void
  ): Promise<() => void> {
    const presetsRef = await this.getPresetsCollection(userId);
    const q = query(presetsRef, orderBy("usageCount", "desc"));

    return onSnapshot(q, (snapshot) => {
      const presets = snapshot.docs.map((doc) =>
        this.mapDocToPreset(doc.id, doc.data())
      );
      callback(presets);
    });
  }

  /**
   * Map a Firestore document to a UserLOOPPreset
   */
  private mapDocToPreset(
    id: string,
    data: Record<string, unknown>
  ): UserLOOPPreset {
    return {
      id,
      name: data.name as string,
      components: data.components as LOOPComponent[],
      icon: data.icon as string | undefined,
      createdAt: data.createdAt as Timestamp,
      usageCount: (data.usageCount as number) || 0,
    };
  }
}
