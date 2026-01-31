/**
 * SequenceDataProvider - Unified sequence data loading
 *
 * Abstracts the complexity of loading sequence data from multiple sources:
 * - Local Dexie/IndexedDB (sequences created by the user)
 * - Firebase/Firestore (public sequences from the gallery)
 *
 * Components use this single service instead of juggling multiple loaders.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceDataProvider } from "../contracts/ISequenceDataProvider";
import type { ISequenceRepository } from "$lib/features/create/shared/services/contracts/ISequenceRepository";
import type { IBrowseLoader } from "$lib/features/browse/sequences/display/services/contracts/IBrowseLoader";

export class SequenceDataProvider implements ISequenceDataProvider {
  constructor(
    private readonly localRepository: ISequenceRepository,
    private readonly publicLoader: IBrowseLoader
  ) {}

  /**
   * Check if a sequence has full motion data.
   * Lightweight gallery sequences only have metadata (word, thumbnailUrl, etc.)
   * but no steps array with motion information.
   */
  private hasMotionData(sequence: SequenceData): boolean {
    return (
      Array.isArray(sequence.steps) &&
      sequence.steps.length > 0 &&
      sequence.steps.some((step) => step?.motions?.blue && step?.motions?.red)
    );
  }

  /**
   * Ensure the sequence has a word property populated.
   * Derives from steps if necessary.
   */
  private ensureWordPopulated(sequence: SequenceData): SequenceData {
    if (sequence.word) return sequence;

    const derivedWord =
      sequence.steps
        ?.filter((step) => !!step.letter)
        .map((step) => step.letter)
        .join("") || "";

    if (!derivedWord) return sequence;
    return { ...sequence, word: derivedWord };
  }

  async hydrateSequence(sequence: SequenceData): Promise<SequenceData> {
    // Already has full motion data - no hydration needed
    if (this.hasMotionData(sequence)) {
      return this.ensureWordPopulated(sequence);
    }

    const identifier = sequence.word || sequence.name;
    if (!identifier) {
      return this.ensureWordPopulated(sequence);
    }

    // Try local repository first (user's own sequences in IndexedDB)
    try {
      const localSequence = await this.localRepository.getSequence(identifier);
      if (localSequence && this.hasMotionData(localSequence)) {
        return this.ensureWordPopulated(localSequence);
      }
    } catch (error) {
      // Local lookup failed, continue to next source
    }

    // Try public loader (Firebase sequences)
    try {
      const publicSequence =
        await this.publicLoader.loadFullSequenceData(identifier);
      if (publicSequence && this.hasMotionData(publicSequence)) {
        return this.ensureWordPopulated(publicSequence);
      }
    } catch (error) {
      // Public lookup failed
    }

    // Return original if all hydration attempts failed
    return this.ensureWordPopulated(sequence);
  }

  async loadByIdentifier(identifier: string): Promise<SequenceData | null> {
    // Try local repository first
    try {
      const localSequence = await this.localRepository.getSequence(identifier);
      if (localSequence && this.hasMotionData(localSequence)) {
        return this.ensureWordPopulated(localSequence);
      }
    } catch (error) {
      console.debug("[SequenceDataProvider] Local lookup failed:", error);
    }

    // Try public loader
    try {
      const publicSequence =
        await this.publicLoader.loadFullSequenceData(identifier);
      if (publicSequence) {
        return this.ensureWordPopulated(publicSequence);
      }
    } catch (error) {
      console.debug("[SequenceDataProvider] Public lookup failed:", error);
    }

    return null;
  }
}
