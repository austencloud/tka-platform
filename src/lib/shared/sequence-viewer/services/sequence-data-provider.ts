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
import type { SequenceRepository } from "$lib/shared/create/services/SequenceRepository";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { cellPreWarmer } from "./cell-pre-warmer";

export class SequenceDataProvider {
  /** In-flight prefetch promises keyed by sequence identifier */
  private prefetchCache = new Map<string, Promise<SequenceData>>();

  /** Completed prefetch results keyed by sequence identifier */
  private hydrationResults = new Map<string, SequenceData>();

  constructor(
    private readonly localRepository: SequenceRepository,
    private readonly publicLoader: PublicSequencesLoader
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
    return { ...sequence, word: simplifyRepeatedWord(derivedWord) };
  }

  async hydrateSequence(sequence: SequenceData): Promise<SequenceData> {
    // Already has full motion data - no hydration needed
    if (this.hasMotionData(sequence)) {
      return this.ensureWordPopulated(sequence);
    }

    const key = this.deriveCacheKey(sequence);

    // Check completed prefetch cache - instant return
    if (key) {
      const cached = this.hydrationResults.get(key);
      if (cached) {
        return cached;
      }

      // Check in-flight prefetch - await it instead of starting a new fetch
      const inFlight = this.prefetchCache.get(key);
      if (inFlight) {
        return inFlight;
      }
    }

    return this.hydrateSequenceInternal(sequence);
  }

  prefetch(sequence: SequenceData): void {
    if (this.hasMotionData(sequence)) return;

    const key = this.deriveCacheKey(sequence);
    if (!key) return;
    if (this.hydrationResults.has(key) || this.prefetchCache.has(key)) return;

    const promise = this.hydrateSequenceInternal(sequence).then((hydrated) => {
      this.hydrationResults.set(key, hydrated);

      // Chain cell pre-warming now that we have real step data
      if (this.hasMotionData(hydrated)) {
        cellPreWarmer.preWarmSequence(hydrated, "user-visible");
      }

      return hydrated;
    });

    this.prefetchCache.set(key, promise);
  }

  getCached(sequence: SequenceData): SequenceData | null {
    const key = this.deriveCacheKey(sequence);
    if (!key) return null;
    return this.hydrationResults.get(key) ?? null;
  }

  /**
   * Derive a stable cache key from a sequence's identifier.
   */
  private deriveCacheKey(sequence: SequenceData): string | null {
    return sequence.id || sequence.word || sequence.name || null;
  }

  /**
   * Core hydration logic - tries local repo then public loader.
   *
   * When the sequence has a unique ID, prefer ID-based lookup so we load
   * the exact variation the user clicked rather than an arbitrary match
   * for the same word.
   */
  private async hydrateSequenceInternal(
    sequence: SequenceData
  ): Promise<SequenceData> {
    // Try ID-based lookup first (returns the exact variation)
    if (sequence.id) {
      try {
        const localById =
          await this.localRepository.getSequence(sequence.id);
        if (localById && this.hasMotionData(localById)) {
          return this.ensureWordPopulated(localById);
        }
      } catch {
        // ID lookup failed, continue to word-based fallback
      }
    }

    // Fall back to word-based lookup (may return a different variation)
    const identifier = sequence.word || sequence.id;
    if (!identifier) {
      return this.ensureWordPopulated(sequence);
    }

    // Try local repository by word name
    try {
      const localSequence =
        await this.localRepository.getSequence(identifier);
      if (localSequence && this.hasMotionData(localSequence)) {
        return this.ensureWordPopulated(localSequence);
      }
    } catch {
      // Local lookup failed, continue to next source
    }

    // Try public loader (Firebase sequences)
    try {
      const publicSequence =
        await this.publicLoader.loadFullSequenceData(identifier);
      if (publicSequence && this.hasMotionData(publicSequence)) {
        return this.ensureWordPopulated(publicSequence);
      }
    } catch {
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
