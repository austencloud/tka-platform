import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  increment,
  arrayUnion,
  documentId,
  type Firestore,
  type DocumentData,
} from "firebase/firestore";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { ensureComposition } from "$lib/shared/foundation/services/sequence-hydrator";
import {
  getUserSequencesPath,
  getUserSequencePath,
  getPublicSequencePath,
} from "$lib/shared/library/data/firestore-paths";
import { notifyLibraryMutated } from "$lib/shared/library/library-events";
import type {
  LibrarySequence,
  SequenceVisibility,
} from "$lib/shared/library/domain/models/library-sequence";
import type { PublicIndexSyncer } from "./public-index-syncer";
import { LibraryError } from "$lib/shared/library/domain/library-error";

type MapDocFn = (doc: DocumentData, id: string) => LibrarySequence;

export class LibraryBatchOperations {
  constructor(
    private getFirestore: () => Promise<Firestore>,
    private getUserId: () => string,
    private mapDocToLibrarySequence: MapDocFn,
    private publicIndexSyncer: PublicIndexSyncer,
    private reportError: (
      message: string,
      error: unknown,
      action: string,
      additionalData?: Record<string, unknown>,
      severity?: "error" | "warning"
    ) => void
  ) {}

  async deleteSequences(sequenceIds: string[]): Promise<void> {
    if (sequenceIds.length === 0) return;

    const firestore = await this.getFirestore();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    const sequencesRef = collection(firestore, getUserSequencesPath(userId));
    const BATCH_SIZE = 30;
    const existingSequences = new Map<string, LibrarySequence>();

    for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
      const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
      const batchQuery = query(sequencesRef, where(documentId(), "in", chunk));
      const batchSnapshot = await getDocs(batchQuery);

      for (const docSnap of batchSnapshot.docs) {
        existingSequences.set(
          docSnap.id,
          this.mapDocToLibrarySequence(docSnap.data(), docSnap.id)
        );
      }
    }

    let deletedCount = 0;
    for (const sequenceId of sequenceIds) {
      const existing = existingSequences.get(sequenceId);
      if (existing) {
        if (existing.visibility === "public") {
          batch.delete(doc(firestore, getPublicSequencePath(sequenceId)));
        }
        batch.delete(doc(firestore, getUserSequencePath(userId, sequenceId)));
        deletedCount++;
      }
    }

    const userDocRef = deletedCount > 0 ? doc(firestore, `users/${userId}`) : null;
    if (deletedCount > 0 && userDocRef) {
      batch.update(userDocRef, {
        sequenceCount: increment(-deletedCount),
      });
    }

    try {
      await trackWrite(() => batch.commit(), "library");

      for (const sequenceId of sequenceIds) {
        if (existingSequences.has(sequenceId)) {
          notifyLibraryMutated(sequenceId);
        }
      }

      if (userDocRef) {
        const userSnap = await getDoc(userDocRef);
        const count = (userSnap.data()?.["sequenceCount"] as number) ?? 0;
        if (count < 0) {
          await updateDoc(userDocRef, { sequenceCount: 0 });
        }
      }
    } catch (error) {
      this.reportError(
        "Failed to delete sequences. Please try again.",
        error,
        "delete-sequences-batch"
      );
      throw new LibraryError("Failed to delete sequences", "NETWORK");
    }
  }

  async moveToCollection(
    sequenceIds: string[],
    collectionId: string
  ): Promise<void> {
    const firestore = await this.getFirestore();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    for (const sequenceId of sequenceIds) {
      const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));
      batch.update(docRef, {
        collectionIds: arrayUnion(collectionId),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await trackWrite(() => batch.commit(), "library");
    } catch (error) {
      console.error("[LibraryRepository] Failed to move to collection:", error);
      toast.error("Failed to move sequences. Please try again.");
      throw new LibraryError(
        "Failed to move sequences to collection",
        "NETWORK"
      );
    }
  }

  async addTagsToSequences(
    sequenceIds: string[],
    tagIds: string[]
  ): Promise<void> {
    const firestore = await this.getFirestore();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);

    for (const sequenceId of sequenceIds) {
      const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));
      batch.update(docRef, {
        tagIds: arrayUnion(...tagIds),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await trackWrite(() => batch.commit(), "library");
    } catch (error) {
      console.error("[LibraryRepository] Failed to add tags:", error);
      toast.error("Failed to add tags. Please try again.");
      throw new LibraryError("Failed to add tags to sequences", "NETWORK");
    }
  }

  async setVisibilityBatch(
    sequenceIds: string[],
    visibility: SequenceVisibility
  ): Promise<void> {
    if (sequenceIds.length === 0) return;

    const firestore = await this.getFirestore();
    const userId = this.getUserId();
    const batch = writeBatch(firestore);
    const now = serverTimestamp();

    const toPublish: LibrarySequence[] = [];
    const toUnpublish: string[] = [];

    const sequencesRef = collection(firestore, getUserSequencesPath(userId));
    const BATCH_SIZE = 30;

    for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
      const chunk = sequenceIds.slice(i, i + BATCH_SIZE);
      const batchQuery = query(sequencesRef, where(documentId(), "in", chunk));
      const batchSnapshot = await getDocs(batchQuery);

      for (const docSnap of batchSnapshot.docs) {
        const existing = this.mapDocToLibrarySequence(
          docSnap.data(),
          docSnap.id
        );
        const docRef = doc(firestore, getUserSequencePath(userId, docSnap.id));

        batch.update(docRef, {
          visibility,
          visibilityChangedAt: now,
          updatedAt: now,
        });

        if (visibility === "public" && existing.visibility !== "public") {
          const withComposition = ensureComposition(existing);
          toPublish.push({ ...existing, ...withComposition, visibility });
        } else if (
          visibility !== "public" &&
          existing.visibility === "public"
        ) {
          toUnpublish.push(docSnap.id);
        }
      }
    }

    try {
      await trackWrite(() => batch.commit(), "library");
    } catch (error) {
      console.error("[LibraryRepository] Failed to update visibility:", error);
      toast.error("Failed to update visibility. Please try again.");
      throw new LibraryError("Failed to update sequence visibility", "NETWORK");
    }

    try {
      await Promise.all([
        ...toPublish.map((seq) =>
          this.publicIndexSyncer.syncToPublicIndex(seq, userId)
        ),
        ...toUnpublish.map((id) =>
          this.publicIndexSyncer.removeFromPublicIndex(id)
        ),
      ]);
    } catch (error) {
      console.error("[LibraryRepository] Failed to sync public index:", error);
      toast.warning("Visibility updated, but public index sync failed.");
    }
  }
}
