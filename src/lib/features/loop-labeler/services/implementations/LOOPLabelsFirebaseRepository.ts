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
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import type { LabeledSequence } from "../contracts/types";

const LOOP_LABELS_COLLECTION = "loop-labels";
const PUBLIC_SEQUENCES_COLLECTION = "publicSequences";
const LOCAL_STORAGE_KEY = "loop-labels";

/**
 * Service for Firebase persistence of LOOP labels
 *
 * Sync strategy:
 * - Firebase is the source of truth
 * - localStorage is a cache for fast startup and offline fallback
 * - On load: Fetch from Firebase, merge with localStorage (recover any local-only items)
 * - On save: Write to Firebase FIRST, then update localStorage cache
 */
export class LOOPLabelsFirebaseRepository {
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

      await trackWrite(
        () =>
          setDoc(doc(firestore, LOOP_LABELS_COLLECTION, word), {
            ...label,
            updatedAt: new Date().toISOString(),
          }),
        "loop-labels"
      );

      this.syncStatus = "synced";
      console.log(`[LOOP Labels] Saved "${word}" to Firebase`);
    } catch (error) {
      console.error(`[LOOP Labels] Failed to save "${word}" to Firebase:`, error);
      this.syncStatus = "error";
      throw error;
    }
  }

  async deleteLabelFromFirebase(word: string): Promise<void> {
    try {
      const firestore = await this.ensureFirestore();
      this.syncStatus = "syncing";

      await trackWrite(
        () => deleteDoc(doc(firestore, LOOP_LABELS_COLLECTION, word)),
        "loop-labels"
      );

      this.syncStatus = "synced";
      console.log(`[LOOP Labels] Deleted "${word}" from Firebase`);
    } catch (error) {
      console.error(`[LOOP Labels] Failed to delete "${word}" from Firebase:`, error);
      this.syncStatus = "error";
      throw error;
    }
  }

  subscribeToLabels(
    callback: (labels: Map<string, LabeledSequence>) => void
  ): () => void {
    // Load and merge data from Firebase and localStorage
    this.loadAndMergeLabels()
      .then((labels) => {
        console.log(
          `[LOOP Labels] Loaded ${labels.size} labels (Firebase + localStorage merge)`
        );
        callback(labels);
      })
      .catch((error) => {
        console.error("[LOOP Labels] Failed to load from Firebase:", error);
        // Fall back to localStorage only
        const localLabels = this.loadFromLocalStorage();
        console.log(
          `[LOOP Labels] Falling back to localStorage: ${localLabels.size} labels`
        );
        callback(localLabels);
      });

    return () => {
      // Cleanup function (no-op for now - could use onSnapshot for real-time)
    };
  }

  /**
   * Load from Firebase and merge with localStorage.
   * Any labels in localStorage but not in Firebase get synced up (recovery).
   */
  private async loadAndMergeLabels(): Promise<Map<string, LabeledSequence>> {
    const firebaseLabels = await this.loadFromFirebase();
    const localLabels = this.loadFromLocalStorage();

    // Find labels in localStorage that aren't in Firebase (need recovery sync)
    const localOnlyWords: string[] = [];
    for (const [word, localLabel] of localLabels) {
      if (!firebaseLabels.has(word)) {
        localOnlyWords.push(word);
        firebaseLabels.set(word, localLabel);
      }
    }

    // Sync any local-only labels to Firebase (recovery)
    if (localOnlyWords.length > 0) {
      console.log(
        `[LOOP Labels] Found ${localOnlyWords.length} local-only labels, syncing to Firebase...`
      );
      for (const word of localOnlyWords) {
        const label = localLabels.get(word)!;
        try {
          await this.saveLabelToFirebase(word, label);
        } catch (error) {
          console.error(
            `[LOOP Labels] Failed to recover-sync "${word}":`,
            error
          );
        }
      }
    }

    // Update localStorage cache with merged data
    this.saveToLocalStorage(firebaseLabels);

    return firebaseLabels;
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
