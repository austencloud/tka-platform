/**
 * SequenceDataProvider - Unified sequence data loading
 *
 * Abstracts the complexity of loading sequence data from multiple sources:
 * - Local Dexie/IndexedDB (sequences created by the user)
 * - Firebase/Firestore (public sequences from the gallery)
 *
 * Components use this single module instead of juggling multiple loaders.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getSequenceRepository } from "$lib/shared/create/get-sequence-repository";
import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
import { getLoopDetector } from "$lib/shared/create/get-loop-detector";
import { hydrateSequence as hydrateSequenceSemantics } from "$lib/shared/navigation/services/sequence-hydrator";
import { cellPreWarmer } from "./cell-pre-warmer";

/** In-flight prefetch promises keyed by sequence identifier */
const prefetchCache = new Map<string, Promise<SequenceData>>();

/** Completed prefetch results keyed by sequence identifier */
const hydrationResults = new Map<string, SequenceData>();

/**
 * Check if a sequence has full motion data.
 * Lightweight gallery sequences only have metadata (word, thumbnailUrl, etc.)
 * but no steps array with motion information.
 */
function hasMotionData(sequence: SequenceData): boolean {
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
function ensureWordPopulated(sequence: SequenceData): SequenceData {
  if (sequence.word) return sequence;

  const derivedWord =
    sequence.steps
      ?.filter((step) => !!step.letter)
      .map((step) => step.letter)
      .join("") || "";

  if (!derivedWord) return sequence;
  return { ...sequence, word: simplifyRepeatedWord(derivedWord) };
}

async function prepareForViewer(sequence: SequenceData): Promise<SequenceData> {
  return hydrateSequenceSemantics(ensureWordPopulated(sequence), {
    loopDetector: getLoopDetector(),
  });
}

export async function hydrateSequence(
  sequence: SequenceData
): Promise<SequenceData> {
  // Motion data alone is not viewer-ready. Compact links and older library
  // records can carry every motion while still lacking letters, positions,
  // word, grid mode, and LOOP classification.
  if (hasMotionData(sequence)) {
    return prepareForViewer(sequence);
  }

  const key = deriveCacheKey(sequence);

  // Check completed prefetch cache - instant return
  if (key) {
    const cached = hydrationResults.get(key);
    if (cached) {
      return cached;
    }

    // Check in-flight prefetch - await it instead of starting a new fetch
    const inFlight = prefetchCache.get(key);
    if (inFlight) {
      return inFlight;
    }
  }

  return hydrateSequenceInternal(sequence);
}

export function prefetch(sequence: SequenceData): void {
  const key = deriveCacheKey(sequence);
  if (!key) return;
  if (hydrationResults.has(key) || prefetchCache.has(key)) return;

  const promise = hydrateSequenceInternal(sequence).then((hydrated) => {
    hydrationResults.set(key, hydrated);

    // Chain cell pre-warming now that we have real step data
    if (hasMotionData(hydrated)) {
      cellPreWarmer.preWarmSequence(hydrated, "user-visible");
    }

    return hydrated;
  });

  prefetchCache.set(key, promise);
}

export function getCached(sequence: SequenceData): SequenceData | null {
  const key = deriveCacheKey(sequence);
  if (!key) return null;
  return hydrationResults.get(key) ?? null;
}

/**
 * Derive a stable cache key from a sequence's identifier.
 */
function deriveCacheKey(sequence: SequenceData): string | null {
  return sequence.id || sequence.word || sequence.name || null;
}

/**
 * Core hydration logic - tries local repo then public loader.
 *
 * When the sequence has a unique ID, prefer ID-based lookup so we load
 * the exact variation the user clicked rather than an arbitrary match
 * for the same word.
 */
async function hydrateSequenceInternal(
  sequence: SequenceData
): Promise<SequenceData> {
  if (hasMotionData(sequence)) {
    return prepareForViewer(sequence);
  }

  // Try ID-based lookup first (returns the exact variation)
  if (sequence.id) {
    try {
      const localById = await getSequenceRepository().getSequence(sequence.id);
      if (localById && hasMotionData(localById)) {
        return prepareForViewer(localById);
      }
    } catch {
      // ID lookup failed, continue to word-based fallback
    }
  }

  // Fall back to word-based lookup (may return a different variation)
  const identifier = sequence.word || sequence.id;
  if (!identifier) {
    return ensureWordPopulated(sequence);
  }

  // Try local repository by word name
  try {
    const localSequence = await getSequenceRepository().getSequence(identifier);
    if (localSequence && hasMotionData(localSequence)) {
      return prepareForViewer(localSequence);
    }
  } catch {
    // Local lookup failed, continue to next source
  }

  // Try public loader (Firebase sequences)
  try {
    const publicSequence =
      await getBrowseLoader().loadFullSequenceData(identifier);
    if (publicSequence && hasMotionData(publicSequence)) {
      return prepareForViewer(publicSequence);
    }
  } catch {
    // Public lookup failed
  }

  // Return original if all hydration attempts failed
  return prepareForViewer(sequence);
}

export async function loadByIdentifier(
  identifier: string
): Promise<SequenceData | null> {
  // Try local repository first
  try {
    const localSequence = await getSequenceRepository().getSequence(identifier);
    if (localSequence && hasMotionData(localSequence)) {
      return prepareForViewer(localSequence);
    }
  } catch (error) {
    console.debug("[SequenceDataProvider] Local lookup failed:", error);
  }

  // Try public loader
  try {
    const publicSequence =
      await getBrowseLoader().loadFullSequenceData(identifier);
    if (publicSequence) {
      return prepareForViewer(publicSequence);
    }
  } catch (error) {
    console.debug("[SequenceDataProvider] Public lookup failed:", error);
  }

  return null;
}
