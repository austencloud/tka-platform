import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Deck } from "../domain/models/Deck";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import {
  getSystemDecksPath,
  getSystemDeckSequencesPath,
} from "$lib/features/library/data/firestore-paths";
import { reversalDetector } from "$lib/features/create/shared/services/reversal-detector";

/**
 * Derive the TKA letter from a grid position string.
 * Alpha positions → α, Beta → β, Gamma → γ
 */
function letterFromGridPosition(gridPosition: unknown): Letter | null {
  if (!gridPosition) return null;
  const pos = String(gridPosition).toLowerCase();
  if (pos.startsWith("alpha")) return Letter.ALPHA;
  if (pos.startsWith("beta")) return Letter.BETA;
  if (pos.startsWith("gamma")) return Letter.GAMMA;
  return null;
}

/**
 * Hydrate raw motion data by running through createMotionData()
 * to fill in defaults (arrowPlacementData, propPlacementData, etc.)
 */
function hydrateMotions(
  motions: PictographData["motions"] | undefined
): Partial<Record<MotionColor, MotionData>> {
  const hydrated: Partial<Record<MotionColor, MotionData>> = {};
  for (const [color, motion] of Object.entries(motions ?? {})) {
    if (motion) {
      hydrated[color as MotionColor] = createMotionData(motion);
    }
  }
  return hydrated;
}

function hydrateSteps(
  steps: readonly StepData[] | undefined
): readonly StepData[] {
  if (!steps || steps.length === 0) return [];
  return steps.map((step) => ({
    ...step,
    motions: hydrateMotions(step.motions),
  }));
}

const DECK_CACHE_KEY = "deckLoader.cachedDecks";

export function getCachedDecks(): Deck[] | null {
  try {
    const raw = localStorage.getItem(DECK_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Deck[];
  } catch {
    return null;
  }
}

function cacheDecks(decks: Deck[]): void {
  try {
    const json = JSON.stringify(decks);
    console.log('[deck-perf] caching %d decks (%d KB)', decks.length, Math.round(json.length / 1024));
    localStorage.setItem(DECK_CACHE_KEY, json);
    console.log('[deck-perf] cache write success');
  } catch (e) {
    console.warn('[deck-perf] cache write failed:', e);
  }
}

export async function loadDecks(): Promise<Deck[]> {
  const db = await getFirestoreInstance();
  const decksRef = collection(db, getSystemDecksPath());
  const snapshot = await getDocs(decksRef);
  const decks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Deck);
  cacheDecks(decks);
  return decks;
}

export async function loadDeckSequences(deckId: string): Promise<SequenceData[]> {
  const db = await getFirestoreInstance();
  const seqRef = collection(db, getSystemDeckSequencesPath(deckId));
  const snapshot = await getDocs(seqRef);
  return snapshot.docs.map((d) => hydrateDoc(d));
}

export async function loadSequencesByIds(deckId: string, sequenceIds: string[]): Promise<SequenceData[]> {
  if (sequenceIds.length === 0) return [];

  const db = await getFirestoreInstance();
  const results: SequenceData[] = [];

  // Firestore `in` queries support max 30 items per batch
  const BATCH_SIZE = 30;
  for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
    const batch = sequenceIds.slice(i, i + BATCH_SIZE);
    const q = query(
      collection(db, getSystemDeckSequencesPath(deckId)),
      where("__name__", "in", batch)
    );
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      results.push(hydrateDoc(d));
    }
  }

  return results;
}

// Shared hydration logic for a single Firestore document
function hydrateDoc(d: import("firebase/firestore").QueryDocumentSnapshot): SequenceData {
  const raw = { id: d.id, ...d.data() };
  const seq = createSequenceData(raw);

  const startPosition = seq.startPosition
    ? {
        ...seq.startPosition,
        motions: hydrateMotions(seq.startPosition.motions),
        letter: seq.startPosition.letter ?? letterFromGridPosition(seq.startPosition.gridPosition),
      }
    : undefined;

  const hydrated: SequenceData = {
    ...seq,
    steps: hydrateSteps(seq.steps),
    ...(startPosition && { startPosition }),
  };

  const hasStoredReversals = hydrated.steps.some(
    (s) => s.blueReversal !== undefined || s.redReversal !== undefined
  );
  if (hasStoredReversals) return hydrated;

  return reversalDetector.processReversals(hydrated);
}
