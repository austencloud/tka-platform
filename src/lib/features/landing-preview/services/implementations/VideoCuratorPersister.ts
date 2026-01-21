/**
 * Persists video curator data to Firestore
 */
import type { IVideoCuratorPersister, VideoUpdateData } from "../contracts/IVideoCuratorPersister";
import type { VideoCategory, UserProfile } from "../../types";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

export class VideoCuratorPersister implements IVideoCuratorPersister {
  async saveCategories(categories: VideoCategory[]): Promise<void> {
    const { doc, setDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await setDoc(doc(db, "config", "videoCategories"), {
      categories,
      updatedAt: new Date(),
    });
  }

  async saveQuickPerformers(performers: UserProfile[]): Promise<void> {
    const { doc, setDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await setDoc(doc(db, "config", "quickPerformers"), {
      performers: performers.map((p) => ({ id: p.id, displayName: p.displayName })),
      updatedAt: new Date(),
    });
  }

  async updateVideo(shortcode: string, updates: VideoUpdateData): Promise<void> {
    const { doc, updateDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await updateDoc(doc(db, "showcaseVideos", shortcode), updates);
  }

  async toggleFeatured(shortcode: string, newValue: boolean): Promise<void> {
    const { doc, updateDoc } = await import("firebase/firestore");
    const db = await getFirestoreInstance();

    await updateDoc(doc(db, "showcaseVideos", shortcode), { featured: newValue });
  }
}
