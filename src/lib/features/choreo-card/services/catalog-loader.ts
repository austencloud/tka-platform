import { collection, getDocs, query, where, limit, startAfter, orderBy, type QueryDocumentSnapshot } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import type { Catalog } from "../domain/models/Catalog";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  getSystemCatalogsPath,
  getSystemCatalogSequencesPath,
} from "$lib/shared/library/data/firestore-paths";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";

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
  return steps.map((step, index) => {
    const raw = step as unknown as Record<string, unknown>;
    const beat = typeof raw.beat === "number" ? raw.beat : undefined;
    // The factory fills any hand missing from the raw Firestore blob with an
    // invisible placeholder (both-required canonical Step shape).
    return createStepData({
      ...step,
      stepNumber: step.stepNumber ?? (beat !== undefined ? beat + 1 : index + 1),
      duration: step.duration ?? 1,
      blueReversal: step.blueReversal ?? false,
      redReversal: step.redReversal ?? false,
      isBlank: step.isBlank ?? false,
      motions: hydrateMotions(step.motions),
    });
  });
}

const CATALOG_CACHE_KEY = "catalogLoader.cachedCatalogs";

export function getCachedCatalogs(): Catalog[] | null {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Catalog[];
  } catch {
    return null;
  }
}

function purgeStaleKeys(): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("deckLoader.seqs.") || key.startsWith("deckLoader.seqsTs."))) {
        stale.push(key);
      }
    }
    for (const key of stale) localStorage.removeItem(key);
  } catch { /* ignore */ }
}

let hasPurged = false;

function cacheCatalogs(catalogs: Catalog[]): void {
  try {
    if (!hasPurged) {
      purgeStaleKeys();
      hasPurged = true;
    }
    localStorage.removeItem(CATALOG_CACHE_KEY);
    const trimmed = catalogs.map(d => ({
      ...d,
      families: d.families.map(f => ({
        ...f,
        sequenceIds: [] as readonly string[],
      })),
    }));
    const json = JSON.stringify(trimmed);
    localStorage.setItem(CATALOG_CACHE_KEY, json);
  } catch {
    // quota exceeded
  }
}

export async function loadCatalogs(): Promise<Catalog[]> {
  const db = await getFirestoreInstance();
  const catalogsRef = collection(db, getSystemCatalogsPath());
  const snapshot = await getDocs(catalogsRef);
  const catalogs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Catalog);
  cacheCatalogs(catalogs);
  return catalogs;
}

export async function loadCatalogSequences(catalogId: string): Promise<SequenceData[]> {
  const db = await getFirestoreInstance();
  const seqRef = collection(db, getSystemCatalogSequencesPath(catalogId));
  const snapshot = await getDocs(seqRef);
  return snapshot.docs.map((d) => hydrateDoc(d));
}

export async function loadSequencesByIds(catalogId: string, sequenceIds: string[]): Promise<SequenceData[]> {
  if (sequenceIds.length === 0) return [];

  const db = await getFirestoreInstance();
  const results: SequenceData[] = [];

  const BATCH_SIZE = 30;
  for (let i = 0; i < sequenceIds.length; i += BATCH_SIZE) {
    const batch = sequenceIds.slice(i, i + BATCH_SIZE);
    const q = query(
      collection(db, getSystemCatalogSequencesPath(catalogId)),
      where("__name__", "in", batch)
    );
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      results.push(hydrateDoc(d));
    }
  }

  return results;
}

export async function loadCatalogSequencesPage(
  catalogId: string,
  pageSize: number,
  afterDoc?: QueryDocumentSnapshot,
): Promise<{ sequences: SequenceData[]; lastDoc: QueryDocumentSnapshot | null }> {
  const db = await getFirestoreInstance();
  const seqRef = collection(db, getSystemCatalogSequencesPath(catalogId));
  const q = afterDoc
    ? query(seqRef, orderBy("__name__"), startAfter(afterDoc), limit(pageSize))
    : query(seqRef, orderBy("__name__"), limit(pageSize));
  const snapshot = await getDocs(q);
  return {
    sequences: snapshot.docs.map((d) => hydrateDoc(d)),
    lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  };
}

// Shared hydration logic for a single Firestore document
function hydrateDoc(d: QueryDocumentSnapshot): SequenceData {
  return hydrateSequence({ id: d.id, ...d.data() });
}

/**
 * Hydrate a RAW catalog sequence blob (Firestore doc data, or a doc embedded
 * elsewhere — e.g. shop product coverCards) into render-ready SequenceData:
 * createMotionData fills arrow/prop placement data, steps get canonical
 * placeholders, reversals derive when absent. Rendering a raw blob without
 * this silently drops every arrow and prop.
 */
export function hydrateSequence(raw: Record<string, unknown>): SequenceData {
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
