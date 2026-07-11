/**
 * Migration: remove redundant literal-repeat sequences from LOOP deck catalogs.
 *
 * A handful of stored deck sequences are a shorter closing loop copied to
 * length (the YΦΔ×4 defect, 2026-07-10): an 8-beat doc that is really a 4-beat
 * loop repeated, a 12-beat that is really a 4-beat quartered rotation tripled.
 * These are NOT valid content for their length-bucket deck — the genuine loop
 * is the shorter one. This deletes the redundant docs and repairs the catalog's
 * family index + totalSequences, leaving genuine sequences and stepCount intact
 * (the deck stays uniform-length).
 *
 * We DELETE rather than collapse in place: collapsing an 8-beat doc to 4 beats
 * would leave a 4-beat entry mislabeled inside an 8-beat catalog. And we do NOT
 * re-enumerate — the original decks' exact seeding flags aren't reproducible, so
 * regeneration changes genuine content.
 *
 * Redundancy is detected with the same engine reducer used everywhere else
 * (reduceToMinimalLoop): only a LITERAL repeat (every pass identical in motion
 * geometry AND orientation) qualifies. Genuine transforms and orientation
 * cycles are never touched.
 *
 * SAFETY: dry-run by default. Pass --apply to write. Batched deletes/updates.
 *
 * RUN:
 *   TKA_ADMIN=1 npx tsx scripts/migrations/remove-redundant-loop-sequences.ts        # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/remove-redundant-loop-sequences.ts --apply
 */

import { initFirestore } from "../lib/firestore-provider.js";
import { reduceToMinimalLoop } from "../../packages/sequence-engine/dist/loop/reduction/minimal-loop-reducer.js";

const APPLY = process.argv.includes("--apply");
const BATCH_LIMIT = 450;

interface RawStep {
  beat?: number;
  stepNumber?: number;
  [k: string]: unknown;
}

/** Normalize the doc's ordering field into stepNumber the reducer reads. */
function normalize(steps: RawStep[]): RawStep[] {
  return steps
    .map((s) => ({
      ...s,
      stepNumber: typeof s.stepNumber === "number" ? s.stepNumber : (s.beat ?? 0) + 1,
    }))
    .sort((a, b) => (a.stepNumber as number) - (b.stepNumber as number));
}

async function main() {
  const { db, isAdmin } = await initFirestore();
  console.log(`[remove-redundant] mode=${APPLY ? "APPLY" : "DRY-RUN"} admin=${isAdmin}`);

  const catalogsSnap = await db.collection("catalogs").get();
  const loopCatalogs = catalogsSnap.docs.filter(
    (d) => (d.data() as { collection?: string }).collection === "LOOPs",
  );
  console.log(`[remove-redundant] ${loopCatalogs.length} LOOPs catalog(s) of ${catalogsSnap.size} total`);

  let totalSeqs = 0;
  let totalRemoved = 0;
  let batch = db.batch();
  let batchOps = 0;
  const flush = async () => {
    if (batchOps === 0) return;
    if (APPLY) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  for (const catalogDoc of loopCatalogs) {
    const catalogId = catalogDoc.id;
    const seqSnap = await db.collection(`catalogs/${catalogId}/sequences`).get();
    const redundantIds = new Set<string>();

    for (const seqDoc of seqSnap.docs) {
      totalSeqs++;
      const data = seqDoc.data() as { steps?: RawStep[] };
      const steps = Array.isArray(data.steps) ? [...data.steps] : [];
      if (steps.length < 2) continue;
      if (reduceToMinimalLoop(normalize(steps)).reduced) {
        redundantIds.add(seqDoc.id);
      }
    }

    if (redundantIds.size === 0) continue;

    console.log(`\n${catalogId}: removing ${redundantIds.size} of ${seqSnap.size}`);
    for (const id of redundantIds) console.log(`  - ${id}`);
    totalRemoved += redundantIds.size;

    // Delete the redundant sequence docs.
    for (const seqDoc of seqSnap.docs) {
      if (!redundantIds.has(seqDoc.id)) continue;
      if (APPLY) {
        batch.delete(seqDoc.ref);
        batchOps++;
        if (batchOps >= BATCH_LIMIT) await flush();
      }
    }

    // Repair the catalog: drop deleted ids from every family, fix totalSequences.
    const catalogData = catalogDoc.data() as {
      families?: Array<{ sequenceIds?: string[] } & Record<string, unknown>>;
      totalSequences?: number;
    };
    const families = Array.isArray(catalogData.families) ? catalogData.families : [];
    const newFamilies = families.map((fam) => ({
      ...fam,
      sequenceIds: (fam.sequenceIds ?? []).filter((sid) => !redundantIds.has(sid)),
    }));
    const newTotal = newFamilies.reduce((n, f) => n + (f.sequenceIds?.length ?? 0), 0);
    console.log(`  ↳ totalSequences ${catalogData.totalSequences ?? "?"}→${newTotal} (stepCount unchanged)`);
    if (APPLY) {
      batch.update(catalogDoc.ref, { families: newFamilies, totalSequences: newTotal });
      batchOps++;
      if (batchOps >= BATCH_LIMIT) await flush();
    }
  }

  await flush();
  console.log(
    `\n[remove-redundant] scanned ${totalSeqs}; ${totalRemoved} ${APPLY ? "removed" : "would remove"}.`,
  );
  if (!APPLY && totalRemoved > 0) console.log("[remove-redundant] re-run with --apply to write.");
}

main().catch((err) => {
  console.error("[remove-redundant] failed:", err);
  process.exit(1);
});
