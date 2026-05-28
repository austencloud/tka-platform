/**
 * Client-side reversal seed service.
 *
 * Seeds one reversal pattern live, in the browser: for each base catalog it
 * loads the catalog's sequences, clones + transforms each (flip motionType
 * pro↔anti AND rotationDirection cw↔ccw on reversed hands, set reversal flags),
 * re-derives letters via the pictograph CSV lookup, recomputes the orientation
 * chain, then writes a materialized variant catalog (+ its sequences) to
 * Firestore.
 *
 * Reversal flips prop spin, NOT hand path / TnD family — so the base catalog's
 * family → seqId mapping is preserved verbatim (seq ids are unchanged), and the
 * variant catalog reuses the base catalog's `families` array as-is.
 *
 * Mirrors the proven Node reference `scripts/seed-reversal-decks.cjs`
 * (`applyReversalToSequence`, `recalcOrientations`, the deck/sequence write
 * shape, and batched writes).
 */

import { doc, writeBatch } from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import {
  getSystemCatalogPath,
  getSystemCatalogSequencePath,
} from "$lib/shared/library/data/firestore-paths";
import { loadCatalogSequences } from "./catalog-loader";
import {
  loadDiamondEdges,
  lookupLetter,
  type CsvEdge,
} from "./pictograph-letter-lookup";
import {
  getReversalFlagsForBeat,
  applyReversalToMotion,
  type ResolvedReversalPattern,
} from "../domain/reversal-transform";
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import type { Catalog } from "../domain/models/Catalog";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";

/** Firestore batch limit is 500 writes; mirror the reference's 450 headroom. */
const BATCH_SIZE = 450;

/** A plain, mutable working copy of a single motion during transform. */
interface MutableMotion {
  motionType?: string;
  rotationDirection?: string;
  startLocation?: string;
  endLocation?: string;
  [key: string]: unknown;
}

/**
 * Flip a single motion in place when its hand is reversed:
 *   - motionType pro↔anti (static/dash unchanged — delegated to the domain helper)
 *   - rotationDirection cw↔ccw (noRotation / undefined unchanged)
 */
function flipMotion(motion: MutableMotion | undefined, reversed: boolean): void {
  if (!motion || !reversed) return;
  if (typeof motion.motionType === "string") {
    motion.motionType = applyReversalToMotion(motion.motionType, true);
  }
  if (motion.rotationDirection === "cw") motion.rotationDirection = "ccw";
  else if (motion.rotationDirection === "ccw") motion.rotationDirection = "cw";
}

/**
 * Clone + transform a single base sequence into its reversal variant.
 *
 * The clone is a deep JSON copy: this strips class prototypes and `undefined`
 * fields (both of which Firestore rejects) and yields plain mutable objects
 * that we can transform without violating the readonly domain types.
 */
function transformSequence(
  seq: SequenceData,
  pattern: ResolvedReversalPattern,
  edges: CsvEdge[],
): SequenceData {
  const clone = JSON.parse(JSON.stringify(seq)) as SequenceData;
  const steps = (clone.steps ?? []) as readonly StepData[];

  // Per-beat reversal: each beat flips from its OWN current value (matching the
  // reference). Reversal flags are read from the pattern tiled over the beats.
  const transformedSteps = steps.map((step, beatIndex) => {
    const { blueReversal, redReversal } = getReversalFlagsForBeat(
      pattern.sequence,
      beatIndex,
    );

    const mutable = step as unknown as {
      motions?: { blue?: MutableMotion; red?: MutableMotion };
      startPosition?: string | null;
      endPosition?: string | null;
      letter?: string | null;
      blueReversal?: boolean;
      redReversal?: boolean;
    };

    const blue = mutable.motions?.blue;
    const red = mutable.motions?.red;

    flipMotion(blue, blueReversal);
    flipMotion(red, redReversal);
    mutable.blueReversal = blueReversal;
    mutable.redReversal = redReversal;

    // Re-derive the letter from the CSV. Match is on positions + motionType +
    // locations only (NOT rotationDirection) — consistent with the reference.
    if (blue && red) {
      const letter = lookupLetter(edges, {
        startPosition: String(mutable.startPosition ?? ""),
        endPosition: String(mutable.endPosition ?? ""),
        blue: {
          motionType: String(blue.motionType ?? ""),
          startLocation: String(blue.startLocation ?? ""),
          endLocation: String(blue.endLocation ?? ""),
        },
        red: {
          motionType: String(red.motionType ?? ""),
          startLocation: String(red.startLocation ?? ""),
          endLocation: String(red.endLocation ?? ""),
        },
      });
      if (letter) mutable.letter = letter;
    }

    return step;
  });

  // Recompute the orientation chain from the start position baseline. The flip
  // changed motionType/rotationDirection, so end orientations cascade.
  const withSteps = updateSequenceData(clone, { steps: transformedSteps });
  const reoriented = recalculateAllOrientations(withSteps, orientationCalculator);

  // Recompute the displayed word from the new letters.
  const word = reoriented.steps
    .map((s) => (s.letter as Letter | null | undefined) ?? "")
    .join("");

  return updateSequenceData(reoriented, {
    word,
    name: word,
    // `reversalPattern` is not part of SequenceData's typed surface; it travels
    // through to Firestore for parity with the reference deck/sequence shape.
    ...({ reversalPattern: pattern.id } as Partial<SequenceData>),
  });
}

export interface SeedProgress {
  /** Number of base catalogs whose variant has been written so far. */
  written: number;
  /** Total number of base catalogs being seeded. */
  total: number;
  /** Id of the variant catalog just written (present on each progress tick). */
  catalogId?: string;
}

/**
 * Seed a single reversal pattern across the given base catalogs.
 *
 * Writes one variant catalog per base catalog (`<baseId>-<patternId>`), each
 * containing the transformed sequences. Returns the ids of the variant catalogs
 * written.
 *
 * Refuses non-clean-loop patterns (the prop would not return to its starting
 * rotation at the loop boundary) and the no-op "continuous" pattern.
 */
export async function seedReversalPattern(
  baseCatalogs: Catalog[],
  pattern: ResolvedReversalPattern,
  onProgress?: (progress: SeedProgress) => void,
): Promise<string[]> {
  if (!pattern.isCleanLoop) {
    throw new Error(
      `Refusing to seed non-clean-loop reversal pattern "${pattern.id}" (${pattern.sequence}). ` +
        `Each hand must reverse an even number of times so the prop returns to its starting rotation.`,
    );
  }
  if (pattern.id === "continuous") return [];

  const db = await getFirestoreInstance();
  const edges = await loadDiamondEdges();
  const writtenIds: string[] = [];
  const total = baseCatalogs.length;

  for (let c = 0; c < baseCatalogs.length; c++) {
    const base = baseCatalogs[c];
    if (!base) continue;
    const newId = `${base.id}-${pattern.id}`;

    const baseSeqs = await loadCatalogSequences(base.id);
    const transformed = baseSeqs.map((s) => transformSequence(s, pattern, edges));

    // Variant catalog metadata. Reversal preserves the hand-path / TnD family
    // grouping AND the seq ids, so `families` carries over verbatim.
    const variantCatalog: Catalog & { reversalPattern: string } = {
      ...base,
      id: newId,
      name: `${base.name} (${pattern.sequence})`,
      reversalPattern: pattern.id,
      asymmetric: false,
      totalSequences: transformed.length,
    } as Catalog & { reversalPattern: string };

    await writeCatalogWithSequences(db, newId, variantCatalog, transformed);

    writtenIds.push(newId);
    onProgress?.({ written: c + 1, total, catalogId: newId });
  }

  return writtenIds;
}

/**
 * Write a variant catalog document plus all its sequences. Sequences are
 * committed in batches (Firestore caps a batch at 500 writes).
 */
async function writeCatalogWithSequences(
  db: Awaited<ReturnType<typeof getFirestoreInstance>>,
  catalogId: string,
  catalog: Catalog & { reversalPattern: string },
  sequences: SequenceData[],
): Promise<void> {
  // Catalog document write (its own batch — keeps it isolated from the larger
  // sequence batches and mirrors the reference's separate deck set()).
  const catalogBatch = writeBatch(db);
  catalogBatch.set(
    doc(db, getSystemCatalogPath(catalogId)),
    stripUndefined(catalog),
  );
  await catalogBatch.commit();

  for (let i = 0; i < sequences.length; i += BATCH_SIZE) {
    const chunk = sequences.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const seq of chunk) {
      batch.set(
        doc(db, getSystemCatalogSequencePath(catalogId, seq.id)),
        stripUndefined(seq),
      );
    }
    await batch.commit();
  }
}

/**
 * Firestore rejects `undefined` field values. The base catalog object may carry
 * undefined optional fields (e.g. `asymmetric`, `sourceDeck`); strip them.
 * Sequences are already deep-cloned via JSON so they have no undefined fields,
 * but this is cheap insurance and keeps both write paths uniform.
 */
function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}
