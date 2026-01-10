import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  getDoc,
  type Firestore,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type {
  ILOOPLabelsFirebaseRepository,
  LabeledSequence,
} from "../contracts/ILOOPLabelsFirebaseRepository";

const LOOP_LABELS_COLLECTION = "loop-labels";
const PUBLIC_SEQUENCES_COLLECTION = "publicSequences";
const LOCAL_STORAGE_KEY = "loop-labels";

/**
 * Service for Firebase persistence of LOOP labels
 */
export class LOOPLabelsFirebaseRepository implements ILOOPLabelsFirebaseRepository {
  private firestore: Firestore | null = null;
  private syncStatus: "synced" | "syncing" | "error" = "synced";

  /**
   * Initialize Firestore instance (called lazily)
   */
  private async ensureFirestore(): Promise<Firestore> {
    if (!this.firestore) {
      this.firestore = await getFirestoreInstance();
    }
    return this.firestore;
  }

  async saveLabelToFirebase(
    word: string,
    label: LabeledSequence
  ): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      this.syncStatus = "syncing";

      await setDoc(doc(firestore, LOOP_LABELS_COLLECTION, word), {
        ...label,
        updatedAt: new Date().toISOString(),
      });

      this.syncStatus = "synced";
    } catch (error) {
      console.error("Failed to save to Firebase:", error);
      this.syncStatus = "error";
      throw error;
    }
  }

  async deleteLabelFromFirebase(word: string): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      this.syncStatus = "syncing";

      await deleteDoc(doc(firestore, LOOP_LABELS_COLLECTION, word));

      this.syncStatus = "synced";
    } catch (error) {
      console.error("Failed to delete from Firebase:", error);
      this.syncStatus = "error";
      throw error;
    }
  }

  subscribeToLabels(
    callback: (labels: Map<string, LabeledSequence>) => void
  ): () => void {
    // Load initial data from Firebase
    this.loadFromFirebase()
      .then((labels) => callback(labels))
      .catch((error) => {
        console.error("Failed to load labels from Firebase:", error);
        // Fall back to localStorage
        callback(this.loadFromLocalStorage());
      });

    // Note: For real-time updates, you could use onSnapshot here
    // For now, this is a one-time load with manual refresh

    return () => {
      // Cleanup function (no-op for now)
    };
  }

  saveToLocalStorage(labels: Map<string, LabeledSequence>): void {
    try {
      const obj = Object.fromEntries(labels);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  loadFromLocalStorage(): Map<string, LabeledSequence> {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return new Map();
  }

  async syncLocalStorageToFirebase(
    labels: Map<string, LabeledSequence>
  ): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      this.syncStatus = "syncing";

      const entries = Array.from(labels.entries());

      let successCount = 0;
      for (const [word, label] of entries) {
        try {
          await setDoc(doc(firestore, LOOP_LABELS_COLLECTION, word), {
            ...label,
            updatedAt: new Date().toISOString(),
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to sync "${word}":`, error);
        }
      }

      this.syncStatus = successCount === entries.length ? "synced" : "error";
    } catch (error) {
      console.error("Failed to sync to Firebase:", error);
      this.syncStatus = "error";
      throw error;
    }
  }

  /**
   * Load all labels from Firebase
   */
  private async loadFromFirebase(): Promise<Map<string, LabeledSequence>> {
    const firestore = await this.ensureFirestore();
    const snapshot = await getDocs(
      collection(firestore, LOOP_LABELS_COLLECTION)
    );

    const labels = new Map<string, LabeledSequence>();
    snapshot.forEach((docSnap) => {
      labels.set(docSnap.id, docSnap.data() as LabeledSequence);
    });

    return labels;
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): "synced" | "syncing" | "error" {
    return this.syncStatus;
  }

  /**
   * Delete a sequence from the publicSequences collection
   * Also deletes the associated LOOP label
   */
  async deleteSequenceFromDatabase(
    sequenceId: string,
    word: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const firestore = await this.ensureFirestore();
      this.syncStatus = "syncing";

      // Check if sequence exists in publicSequences
      const sequenceRef = doc(
        firestore,
        PUBLIC_SEQUENCES_COLLECTION,
        sequenceId
      );
      const sequenceSnap = await getDoc(sequenceRef);

      if (!sequenceSnap.exists()) {
        console.warn(`Sequence "${sequenceId}" not found in publicSequences`);
        // Continue anyway to delete the LOOP label
      } else {
        // Delete from publicSequences
        await deleteDoc(sequenceRef);
      }

      // Also delete the LOOP label if it exists
      const labelRef = doc(firestore, LOOP_LABELS_COLLECTION, word);
      const labelSnap = await getDoc(labelRef);
      if (labelSnap.exists()) {
        await deleteDoc(labelRef);
      }

      this.syncStatus = "synced";
      return { success: true };
    } catch (error) {
      console.error("Failed to delete sequence from database:", error);
      this.syncStatus = "error";
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}
