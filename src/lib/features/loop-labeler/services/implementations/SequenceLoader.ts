import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { getPublicSequencesPath } from "$lib/features/library/data/firestore-paths";
import type { SequenceEntry, RawStepData, RawMotionAttributes } from "../contracts/IStepDataConverter";
import type { LabeledSequence } from "../contracts/ILOOPLabelsFirebaseRepository";
import type {
  ISequenceLoader,
  FilterMode,
  SequenceStats,
} from "../contracts/ISequenceLoader";

/**
 * Service for loading and filtering sequences from Firestore.
 *
 * Loads lightweight index from publicSequences for fast browsing,
 * then lazy-fetches full sequence data from the source library document
 * when a specific sequence is selected.
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
        // sourceRef points to the full sequence doc: "users/{ownerId}/sequences/{id}"
        // Fall back to constructing it from ownerId if sourceRef is missing (legacy docs)
        const sourceRef = (data.sourceRef as string)
          || (data.ownerId ? `users/${data.ownerId}/sequences/${docSnap.id}` : undefined);

        sequences.push({
          id: docSnap.id,
          word: data.word || "",
          isCircular: data.isCircular ?? false,
          loopType: data.loopType ?? null,
          thumbnails: data.thumbnails ?? [],
          sequenceLength: data.sequenceLength ?? 0,
          gridMode: data.gridMode ?? "diamond",
          sourceRef,
        });
      });

      return sequences;
    } catch (error) {
      console.error("Failed to load sequences from Firestore:", error);
      return [];
    }
  }

  async loadSequenceDetail(sourceRef: string): Promise<RawStepData[] | null> {
    console.log(`[SequenceLoader] Loading detail from: ${sourceRef}`);
    try {
      const firestore = await getFirestoreInstance();
      const docSnap = await getDoc(doc(firestore, sourceRef));

      if (!docSnap.exists()) {
        console.warn(`[SequenceLoader] Source document not found: ${sourceRef}`);
        return null;
      }

      const data = docSnap.data();
      const steps = data["steps"] as Array<unknown> | undefined;
      const startPos = data["startPosition"] || data["startingPosition"];
      console.log(`[SequenceLoader] Found doc. steps: ${steps?.length ?? 0}, startPosition: ${!!startPos}, gridMode: ${data["gridMode"]}`);

      const result = this.convertToRawSequence(data);
      console.log(`[SequenceLoader] Converted to ${result.length} raw elements`);
      return result;
    } catch (error) {
      console.error(`[SequenceLoader] Failed to load detail from ${sourceRef}:`, error);
      return null;
    }
  }

  /**
   * Convert a Firestore LibrarySequence document to the RawStepData[] format
   * expected by the Loop Labeler's detection pipeline.
   *
   * Firestore stores StepData with `motions.blue`/`motions.red` and field names
   * like `startLocation`, `endLocation`. The detection pipeline expects
   * `blueAttributes`/`redAttributes` with abbreviated names like `startLoc`, `endLoc`.
   */
  private convertToRawSequence(data: Record<string, unknown>): RawStepData[] {
    const result: RawStepData[] = [];

    // Element 0: Metadata header
    result.push({
      word: (data["word"] as string) || (data["name"] as string) || "",
      author: (data["author"] as string) || "",
      level: (data["level"] as number) || undefined,
      gridMode: (data["gridMode"] as string) || "diamond",
      isCircular: (data["isCircular"] as boolean) ?? false,
    });

    // Element 1: Start position (beat 0)
    const startPos = (data["startPosition"] || data["startingPosition"]) as Record<string, unknown> | undefined;
    if (startPos) {
      const motions = startPos["motions"] as Record<string, Record<string, unknown>> | undefined;
      const gridPos = (startPos["gridPosition"] as string) || (startPos["startPosition"] as string) || "";
      result.push({
        beat: 0,
        sequenceStartPosition: gridPos,
        endPos: gridPos, // Start position's endPos = its own grid position (for circularity check)
        letter: (startPos["letter"] as string) || undefined,
        blueAttributes: motions ? this.convertMotionToRawAttributes(motions["blue"]) : undefined,
        redAttributes: motions ? this.convertMotionToRawAttributes(motions["red"]) : undefined,
      });
    }

    // Elements 2+: Actual steps (beat >= 1)
    const steps = (data["steps"] || []) as Array<Record<string, unknown>>;
    // Support nested sequenceData structure (some legacy docs)
    const seqData = data["sequenceData"] as Record<string, unknown> | undefined;
    const actualSteps = steps.length > 0
      ? steps
      : ((seqData?.["steps"] || []) as Array<Record<string, unknown>>);

    for (const step of actualSteps) {
      const motions = step["motions"] as Record<string, Record<string, unknown>> | undefined;
      const stepNumber = (step["stepNumber"] as number) ?? 0;
      if (stepNumber < 1) continue;

      result.push({
        beat: stepNumber,
        letter: (step["letter"] as string) || undefined,
        startPos: (step["startPosition"] as string) || undefined,
        endPos: (step["endPosition"] as string) || undefined,
        blueAttributes: motions ? this.convertMotionToRawAttributes(motions["blue"]) : undefined,
        redAttributes: motions ? this.convertMotionToRawAttributes(motions["red"]) : undefined,
      });
    }

    return result;
  }

  /**
   * Convert a Firestore MotionData object to the abbreviated RawMotionAttributes
   * format used by the detection pipeline.
   */
  private convertMotionToRawAttributes(
    motion: Record<string, unknown> | undefined
  ): RawMotionAttributes | undefined {
    if (!motion) return undefined;

    return {
      motionType: (motion["motionType"] as string) || undefined,
      startLoc: (motion["startLocation"] as string) || undefined,
      endLoc: (motion["endLocation"] as string) || undefined,
      startOri: (motion["startOrientation"] as string) || undefined,
      endOri: (motion["endOrientation"] as string) || undefined,
      propRotDir: (motion["rotationDirection"] as string) || undefined,
      turns: motion["turns"] as number | string | undefined,
    };
  }

  filterSequences(
    sequences: SequenceEntry[],
    labels: Map<string, LabeledSequence>,
    filterMode: FilterMode
  ): SequenceEntry[] {
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
