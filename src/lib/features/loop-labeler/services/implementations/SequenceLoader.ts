import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencesPath } from "$lib/features/library/data/firestore-paths";
import type { SequenceEntry } from "../contracts/IStepDataConverter";
import type { LabeledSequence } from "../contracts/ILOOPLabelsFirebaseRepository";
import type {
  ISequenceLoader,
  FilterMode,
  SequenceStats,
} from "../contracts/ISequenceLoader";

/**
 * Service for loading and filtering sequences from Firestore
 */
export class SequenceLoader implements ISequenceLoader {
  async loadSequences(): Promise<SequenceEntry[]> {
    try {
      const firestore = await getFirestoreInstance();
      const publicSeqRef = collection(firestore, getPublicSequencesPath());
      const q = query(publicSeqRef, orderBy("word", "asc"));
      const snapshot = await getDocs(q);

      const sequences: SequenceEntry[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        sequences.push({
          id: docSnap.id,
          word: data.word || "",
          isCircular: data.isCircular ?? false,
          loopType: data.loopType ?? null,
          thumbnails: data.thumbnails ?? [],
          sequenceLength: data.sequenceLength ?? 0,
          gridMode: data.gridMode ?? "diamond",
        });
      });

      return sequences;
    } catch (error) {
      console.error("Failed to load sequences from Firestore:", error);
      return [];
    }
  }

  filterSequences(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>,
    filterMode: FilterMode
  ): SequenceEntry[] {
    // Apply filter mode
    switch (filterMode) {
      case "needsVerification":
        return sequences.filter(
          (s) => labels.get(s.word)?.needsVerification === true
        );

      case "verified":
        return sequences.filter((s) => {
          const label = labels.get(s.word);
          return label && !label.needsVerification;
        });

      default:
        return sequences;
    }
  }

  calculateStats(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>
  ): SequenceStats {
    const total = sequences.length;

    const needsVerification = Array.from(labels.values()).filter(
      (l) => l.needsVerification === true
    ).length;

    const verified = labels.size - needsVerification;

    return {
      total,
      needsVerification,
      verified,
    };
  }
}
