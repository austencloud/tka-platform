import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  type Firestore,
  type DocumentData,
} from "firebase/firestore";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { firestoreList } from "$lib/shared/firestore";
import { LibrarySequenceDocSchema } from "$lib/shared/library/domain/library-schemas";
import {
  getUserSequencesPath,
  getUserSequencePath,
  getPublicSequencePath,
} from "$lib/shared/library/data/firestore-paths";
import { notifyLibraryMutated } from "$lib/shared/library/library-events";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import type { IPublicIndexSyncer as PublicIndexSyncer } from "$lib/shared/library/services/IPublicIndexSyncer";
import { LibraryError } from "$lib/shared/library/domain/library-error";

export class LibraryRecycleBin {
  constructor(
    private getFirestore: () => Promise<Firestore>,
    private getUserId: () => string,
    private getSequence: (id: string) => Promise<LibrarySequence | null>,
    private publicIndexSyncer: PublicIndexSyncer,
    private reportError: (
      message: string,
      error: unknown,
      action: string,
      additionalData?: Record<string, unknown>,
      severity?: "error" | "warning"
    ) => void
  ) {}

  async softDeleteSequence(sequenceId: string): Promise<void> {
    const firestore = await this.getFirestore();
    const userId = this.getUserId();
    const existing = await this.getSequence(sequenceId);

    if (!existing) {
      throw new LibraryError("Sequence not found", "NOT_FOUND", sequenceId);
    }

    if (existing.visibility === "public" && this.publicIndexSyncer) {
      try {
        await this.publicIndexSyncer.removeFromPublicIndex(sequenceId);
      } catch (error) {
        this.reportError(
          "Sequence moved to recycle bin, but it may still appear in the community gallery.",
          error,
          "soft-delete-public-index-remove",
          { sequenceId },
          "warning"
        );
      }
    }

    try {
      await trackWrite(
        () =>
          updateDoc(doc(firestore, getUserSequencePath(userId, sequenceId)), {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }),
        "library"
      );
      notifyLibraryMutated(sequenceId);
    } catch (error) {
      this.reportError(
        "Failed to move sequence to recycle bin.",
        error,
        "soft-delete-sequence",
        { sequenceId }
      );
      throw new LibraryError("Failed to soft-delete sequence", "NETWORK", sequenceId);
    }
  }

  async restoreSequence(sequenceId: string): Promise<void> {
    const firestore = await this.getFirestore();
    const userId = this.getUserId();

    try {
      await trackWrite(
        () =>
          updateDoc(doc(firestore, getUserSequencePath(userId, sequenceId)), {
            isDeleted: false,
            deletedAt: null,
            updatedAt: serverTimestamp(),
          }),
        "library"
      );
      notifyLibraryMutated(sequenceId);
    } catch (error) {
      this.reportError(
        "Failed to restore sequence from recycle bin.",
        error,
        "restore-sequence",
        { sequenceId }
      );
      throw new LibraryError("Failed to restore sequence", "NETWORK", sequenceId);
    }
  }

  async purgeSequence(sequenceId: string): Promise<void> {
    // getSequence filters out soft-deleted docs, so a non-null result means the
    // sequence is still ACTIVE (not in the recycle bin). An active sequence must
    // be soft-deleted before it can be purged. (A null result means it's either
    // soft-deleted or absent — both fall through to the getDoc check below, which
    // confirms it's actually in the bin via isDeleted before deleting.)
    const stillActive = await this.getSequence(sequenceId);

    if (stillActive) {
      throw new LibraryError(
        "Cannot purge an active sequence. Soft-delete it first to move it to the recycle bin.",
        "INVALID_DATA",
        sequenceId
      );
    }

    const firestore = await this.getFirestore();
    const userId = this.getUserId();
    const docRef = doc(firestore, getUserSequencePath(userId, sequenceId));
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return;
    }

    const data = docSnap.data();
    if (!data?.["isDeleted"]) {
      throw new LibraryError(
        "Cannot purge a sequence that is not in the recycle bin.",
        "INVALID_DATA",
        sequenceId
      );
    }

    try {
      await trackWrite(() => deleteDoc(docRef), "library");
      notifyLibraryMutated(sequenceId);
    } catch (error) {
      this.reportError(
        "Failed to permanently delete sequence.",
        error,
        "purge-sequence",
        { sequenceId }
      );
      throw new LibraryError("Failed to purge sequence", "NETWORK", sequenceId);
    }
  }

  async getDeletedSequences(): Promise<LibrarySequence[]> {
    const userId = this.getUserId();
    const docs = await firestoreList(
      getUserSequencesPath(userId),
      LibrarySequenceDocSchema,
      {
        where: [{ field: "isDeleted", op: "==", value: true }],
        orderBy: [{ field: "deletedAt", direction: "desc" }],
      },
    );

    return docs.map((d) => {
      const data = d as DocumentData;
      return { ...data, id: data.id } as LibrarySequence;
    });
  }

  async emptyRecycleBin(): Promise<void> {
    const deleted = await this.getDeletedSequences();
    if (deleted.length === 0) return;

    const firestore = await this.getFirestore();
    const userId = this.getUserId();

    const BATCH_LIMIT = 500;

    for (let i = 0; i < deleted.length; i += BATCH_LIMIT) {
      const chunk = deleted.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(firestore);

      for (const seq of chunk) {
        batch.delete(doc(firestore, getUserSequencePath(userId, seq.id)));

        if (seq.visibility === "public") {
          batch.delete(doc(firestore, getPublicSequencePath(seq.id)));
        }
      }

      try {
        await trackWrite(() => batch.commit(), "library");
      } catch (error) {
        this.reportError(
          "Failed to empty recycle bin. Some sequences may remain.",
          error,
          "empty-recycle-bin"
        );
        throw new LibraryError("Failed to empty recycle bin", "NETWORK");
      }
    }

    for (const seq of deleted) {
      notifyLibraryMutated(seq.id);
    }
  }
}
