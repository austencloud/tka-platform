/**
 * Persists video curator data to Firestore
 */
import type { IVideoCuratorPersister, VideoUpdateData } from "../contracts/IVideoCuratorPersister";
import type { VideoCategory, UserProfile } from "../../types";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

export class VideoCuratorPersister implements IVideoCuratorPersister {
  async saveCategories(categories: VideoCategory[]): Promise<void> {
    console.log("[VideoCuratorPersister] Saving categories:", categories);
    const { doc, setDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await setDoc(doc(db, "config", "videoCategories"), {
      categories,
      updatedAt: new Date(),
    });
    console.log("[VideoCuratorPersister] Categories saved successfully");
  }

  async saveQuickPerformers(performers: UserProfile[]): Promise<void> {
    console.log("[VideoCuratorPersister] Saving quick performers:", performers);
    const { doc, setDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await setDoc(doc(db, "config", "quickPerformers"), {
      performers: performers.map((p) => ({ id: p.id, displayName: p.displayName })),
      updatedAt: new Date(),
    });
    console.log("[VideoCuratorPersister] Quick performers saved successfully");
  }

  async updateVideo(shortcode: string, updates: VideoUpdateData): Promise<void> {
    const { doc, updateDoc, deleteField } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    // Convert null values to deleteField() for clean data
    const firestoreUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      firestoreUpdates[key] = value === null ? deleteField() : value;
    }

    await updateDoc(doc(db, "showcaseVideos", shortcode), firestoreUpdates);
  }

  async toggleFeatured(shortcode: string, newValue: boolean): Promise<void> {
    const { doc, updateDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await updateDoc(doc(db, "showcaseVideos", shortcode), { featured: newValue });
  }
}
