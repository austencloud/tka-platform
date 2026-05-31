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
  cumulativeParities,
  type ResolvedReversalPattern,
} from "../domain/reversal-transform";
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import type { Catalog } from "../domain/models/Catalog";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { Letter } from "$lib/shared/foundation/domain/models/letter";

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
export function transformSequence(
  seq: SequenceData,
  pattern: ResolvedReversalPattern,
  edges: CsvEdge[],
): SequenceData {
  const clone = JSON.parse(JSON.stringify(seq)) as SequenceData;
  const steps = (clone.steps ?? []) as readonly StepData[];

  // Reversal is CUMULATIVE (matching reversal-detector.ts: a beat reverses when
  // its spin differs from the previous beat). The pattern symbol TOGGLES a running
  // per-hand parity; a beat's motion is flipped from base whenever parity is true.
  // The stored reversal flag marks the toggle beat (the spin-change), which is what
  // the detector re-derives. Absolute per-beat flipping made PPPP uniform-anti,
  // which the detector reads back as "continuous" — the bug this replaces.
  const parities = cumulativeParities(pattern.sequence, steps.length);
  const transformedSteps = steps.map((step, beatIndex) => {
    const { blueReversal: blueToggle, redReversal: redToggle } = getReversalFlagsForBeat(
      pattern.sequence,
      beatIndex,
    );
    const blueParity = parities.blue[beatIndex] ?? false;
    const redParity = parities.red[beatIndex] ?? false;

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

    flipMotion(blue, blueParity);
    flipMotion(red, redParity);
    mutable.blueReversal = blueToggle;
    mutable.redReversal = redToggle;

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
  const reoriented = recalculateAllOrientations(withSteps);

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

// ---------------------------------------------------------------------------
// Live, idempotent reversal apply (create module)
// ---------------------------------------------------------------------------

type Spin = "cw" | "ccw";

/** A motion's spin, or null when it isn't spinning (static / dash / no dir). */
function spinOf(motion: MutableMotion | undefined): Spin | null {
  if (!motion) return null;
  if (motion.rotationDirection === "cw") return "cw";
  if (motion.rotationDirection === "ccw") return "ccw";
  return null;
}

/**
 * Solve which beats of one hand must flip so that the *detected* reversals of
 * the result land exactly on the caller's `desired` cells.
 *
 * A reversal is "this beat's spin differs from the previous spinning beat"
 * (matching `reversal-detector.ts`). So we walk the hand's spinning beats in
 * order, anchor the first to its current spin, and set every later beat's target
 * spin to flip-from-previous iff its cell is on. A beat flips only when its
 * current spin already disagrees with that target — which makes a second apply
 * of the same matrix a no-op (idempotent) and the rendered dots match the matrix
 * 1:1 (WYSIWYG).
 *
 * Non-spinning beats (static / dash) can't carry a reversal, so their cells are
 * inert. The first spinning beat's cell is honoured on a loop via the wrap (when
 * the hand reverses an even number of times the loop closes and the wrap
 * reversal falls out automatically); on a non-loop it has no predecessor and is
 * inert, exactly as the detector reports.
 */
export function solveHandFlips(
  motions: (MutableMotion | undefined)[],
  desired: boolean[],
): boolean[] {
  const len = motions.length;
  const flips = new Array<boolean>(len).fill(false);

  let firstSpin = -1;
  for (let i = 0; i < len; i++) {
    if (spinOf(motions[i])) {
      firstSpin = i;
      break;
    }
  }
  if (firstSpin < 0) return flips; // hand never spins → nothing to reverse

  // Anchor the first spinning beat to its current spin (flips[firstSpin] = false).
  let target: Spin = spinOf(motions[firstSpin])!;
  for (let i = firstSpin + 1; i < len; i++) {
    const base = spinOf(motions[i]);
    if (!base) continue; // non-spinning beat: inert cell
    if (desired[i]) target = target === "cw" ? "ccw" : "cw";
    flips[i] = base !== target;
  }
  return flips;
}

/**
 * Apply a reversal matrix to a live sequence, idempotently.
 *
 * `blueReversals` / `redReversals` are per-beat "reverse here" flags (already
 * tiled to the sequence length). Unlike {@link transformSequence} (which toggles
 * relative to the current motions and is therefore designed to run once on a
 * clean catalog base), this solves for an absolute target spin and flips only
 * the delta — so re-applying the same matrix changes nothing, and the reversal
 * dots the detector renders match the matrix exactly.
 *
 * Reuses the proven flip → re-derive-letter → recompute-orientation pipeline.
 */
export function applyReversalMatrix(
  seq: SequenceData,
  blueReversals: boolean[],
  redReversals: boolean[],
  edges: CsvEdge[],
): SequenceData {
  const clone = JSON.parse(JSON.stringify(seq)) as SequenceData;
  const steps = (clone.steps ?? []) as readonly StepData[];

  const blueMotions = steps.map(
    (s) => (s as unknown as { motions?: { blue?: MutableMotion } }).motions?.blue,
  );
  const redMotions = steps.map(
    (s) => (s as unknown as { motions?: { red?: MutableMotion } }).motions?.red,
  );

  const blueFlips = solveHandFlips(blueMotions, blueReversals);
  const redFlips = solveHandFlips(redMotions, redReversals);

  const transformedSteps = steps.map((step, beatIndex) => {
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

    flipMotion(blue, blueFlips[beatIndex] ?? false);
    flipMotion(red, redFlips[beatIndex] ?? false);
    mutable.blueReversal = blueReversals[beatIndex] ?? false;
    mutable.redReversal = redReversals[beatIndex] ?? false;

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

  const withSteps = updateSequenceData(clone, { steps: transformedSteps });
  const reoriented = recalculateAllOrientations(withSteps);

  const word = reoriented.steps
    .map((s) => (s.letter as Letter | null | undefined) ?? "")
    .join("");

  return updateSequenceData(reoriented, { word, name: word });
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
 * undefined optional fields (e.g. `asymmetric`, `sourceCatalog`); strip them.
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
