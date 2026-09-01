/**
 * Migration: repair mislabeled swap+rotate / mirror+swap LOOP tags.
 *
 * Before 2026-07-13, generation for ROTATED_SWAPPED, ROTATED_SWAPPED_INVERTED,
 * MIRRORED_SWAPPED_INVERTED, and MIRRORED_ROTATED_INVERTED_SWAPPED accepted
 * degenerate start positions (alpha for swap+rotate; anything but beta1/beta5
 * for mirror+swap). The resulting sequences carry a loopType tag whose
 * transformation is not actually present in the content (e.g. a
 * "rotated_swapped_inverted" doc whose halves are related by swap+invert only).
 *
 * This migration re-detects every stored sequence tagged with one of the four
 * affected types using the engine's LOOPDetector and repairs disagreements:
 *   - detector returns a different implemented type → rewrite loopType and the
 *     dashed tag to the detected type
 *   - detector returns null (unclassifiable) → remove loopType and the dashed
 *     type tag (the "circular"/"cap" tags stay only if the sequence is
 *     actually circular)
 *
 * Scans: collectionGroup("sequences") (users/{uid}/sequences AND
 * catalogs/{id}/sequences) plus the publicSequences mirror.
 *
 * SAFETY: dry-run by default. Pass --apply to write.
 *
 * RUN:
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-mislabeled-loop-tags.ts          # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-mislabeled-loop-tags.ts --apply
 */

import { initFirestore } from "../lib/firestore-provider.js";
import { FieldValue } from "firebase-admin/firestore";
import { loopDetectorClass } from "../../packages/sequence-engine/dist/loop/detection/LOOPDetector.js";
import { gridPositionDeriver } from "../../packages/sequence-engine/dist/core/positions/GridPositionDeriver.js";

const APPLY = process.argv.includes("--apply");
// Catalog (deck) sequences are excluded by default: repairing them declares
// most of a shipped deck invalid (the l1-halved-mirrored-swapped-inverted
// deck was enumerated from starts the fixed-point math forbids) — that is a
// deck-level product decision (re-enumerate vs prune), not a tag repair.
const INCLUDE_CATALOGS = process.argv.includes("--include-catalogs");
const BATCH_LIMIT = 400;

const AFFECTED = new Set([
  "rotated_swapped",
  "rotated_swapped_inverted",
  "mirrored_swapped_inverted",
  "mirrored_rotated_inverted_swapped",
]);

interface RawMotion {
  motionType?: string;
  startLocation?: string;
  endLocation?: string;
  rotationDirection?: string;
  startOrientation?: string;
  endOrientation?: string;
  turns?: number;
}

interface RawStep {
  id?: string;
  letter?: string;
  startPosition?: string;
  endPosition?: string;
  beat?: number;
  stepNumber?: number;
  motions?: { left?: RawMotion; right?: RawMotion };
  leftMotion?: RawMotion;
  rightMotion?: RawMotion;
}

interface SeqDoc {
  loopType?: string;
  tags?: string[];
  steps?: RawStep[];
  /** User-library docs store the letter steps as `beats`. */
  beats?: RawStep[];
  startPosition?: RawStep | string;
  startingPosition?: RawStep | string;
  word?: string;
}

function toEngineMotion(m: RawMotion | undefined) {
  return {
    motionType: m?.motionType ?? "static",
    startLocation: m?.startLocation ?? "n",
    endLocation: m?.endLocation ?? "n",
    rotationDirection: m?.rotationDirection ?? "noRotation",
    startOrientation: m?.startOrientation,
    endOrientation: m?.endOrientation,
    turns: m?.turns ?? 0,
  };
}

/** Derive a grid position (e.g. "alpha3") from the two hands' locations. */
function derivePosition(leftLoc: string, rightLoc: string): string | undefined {
  try {
    return gridPositionDeriver.getGridPositionFromLocations(leftLoc, rightLoc) ?? undefined;
  } catch {
    return undefined;
  }
}

function toEngineStep(step: RawStep, index: number) {
  const left = toEngineMotion(step.motions?.left ?? step.leftMotion);
  const right = toEngineMotion(step.motions?.right ?? step.rightMotion);
  // User-library beats carry no top-level grid positions — derive them from
  // the hands' motion locations (the same mapping the engine uses).
  const startPosition =
    step.startPosition ?? derivePosition(left.startLocation, right.startLocation);
  const endPosition =
    step.endPosition ?? derivePosition(left.endLocation, right.endLocation);
  return {
    letter: step.letter,
    startPosition,
    endPosition,
    // Provide both shapes: the class detector reads `motions.blue/red`,
    // helper paths read `blueMotion/redMotion`.
    motions: { left, right },
    leftMotion: left,
    rightMotion: right,
    beatIndex: index,
    stepNumber: index,
  };
}

/** Build engine-format steps: start position as step 0 + letter steps. */
function buildEngineSteps(data: SeqDoc) {
  const rawSteps = Array.isArray(data.steps) && data.steps.length > 0
    ? [...data.steps]
    : Array.isArray(data.beats) ? [...data.beats] : [];
  if (rawSteps.length === 0) return null;

  const orderOf = (s: RawStep): number => {
    if (typeof s.stepNumber === "number") return s.stepNumber;
    if (typeof s.beat === "number") return s.beat + 1;
    const m = /^beat-(\d+)$/.exec(s.id ?? "");
    return m ? Number(m[1]) : 0;
  };
  rawSteps.sort((a, b) => orderOf(a) - orderOf(b));

  // Some docs store step 0 (the start position) inside steps; detect that.
  const hasStepZero = rawSteps.some((s) => (s.stepNumber ?? -1) === 0 && !s.letter);

  if (hasStepZero) {
    return rawSteps.map((s, i) => toEngineStep(s, i));
  }

  const startPos =
    typeof data.startPosition === "object" ? data.startPosition
    : typeof data.startingPosition === "object" ? data.startingPosition
    : undefined;
  const startZeroLeftLoc = (startPos?.motions?.left ?? startPos?.leftMotion)?.endLocation;
  const startZeroRightLoc = (startPos?.motions?.right ?? startPos?.rightMotion)?.endLocation;
  const startGrid =
    (typeof data.startPosition === "string" ? data.startPosition : undefined) ??
    (typeof data.startingPosition === "string" ? data.startingPosition : undefined) ??
    startPos?.startPosition ??
    // Library start-position objects carry an id like "derived-start-alpha3"
    (/-(alpha\d+|beta\d+|gamma\d+)$/.exec((startPos as { id?: string } | undefined)?.id ?? "")?.[1]) ??
    (startZeroLeftLoc && startZeroRightLoc
      ? derivePosition(startZeroLeftLoc, startZeroRightLoc)
      : undefined) ??
    rawSteps[0]?.startPosition;

  if (!startGrid) return null;

  const zeroLeft = toEngineMotion(startPos?.motions?.left ?? startPos?.leftMotion);
  const zeroRight = toEngineMotion(startPos?.motions?.right ?? startPos?.rightMotion);
  const stepZero = {
    letter: startPos?.letter ?? "β",
    startPosition: startGrid,
    endPosition: startPos?.endPosition ?? startGrid,
    motions: { left: zeroLeft, right: zeroRight },
    leftMotion: zeroLeft,
    rightMotion: zeroRight,
    beatIndex: 0,
    stepNumber: 0,
  };

  return [stepZero, ...rawSteps.map((s, i) => toEngineStep(s, i + 1))];
}

function dashed(loopType: string): string {
  return loopType.replace(/_/g, "-");
}

async function main() {
  const { db, isAdmin } = await initFirestore();
  if (!isAdmin) {
    console.error("[repair-loop-tags] Requires admin SDK — run with TKA_ADMIN=1");
    process.exit(1);
  }
  console.log(`[repair-loop-tags] mode=${APPLY ? "APPLY" : "DRY-RUN"}`);

  let batch = db.batch();
  let batchOps = 0;
  const flush = async () => {
    if (batchOps === 0) return;
    if (APPLY) await batch.commit();
    batch = db.batch();
    batchOps = 0;
  };

  const stats = { scanned: 0, affected: 0, agree: 0, retyped: 0, untyped: 0, skipped: 0 };

  const processDoc = async (
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    stepsSource?: SeqDoc,
  ) => {
    stats.scanned++;
    const data = doc.data() as SeqDoc;
    const stored = data.loopType;
    if (!stored || !AFFECTED.has(stored)) return;
    stats.affected++;

    const engineSteps = buildEngineSteps(stepsSource ?? data);
    if (!engineSteps || engineSteps.length < 3) {
      stats.skipped++;
      console.log(`  SKIP (no usable steps): ${doc.ref.path}`);
      return;
    }

    let det;
    try {
      det = loopDetectorClass.detectLOOPType(engineSteps);
    } catch (e) {
      stats.skipped++;
      console.log(`  SKIP (detector error: ${(e as Error).message}): ${doc.ref.path}`);
      return;
    }

    const detected: string | null = det?.loopType ?? null;
    if (detected === stored) {
      stats.agree++;
      return;
    }

    const tags = Array.isArray(data.tags) ? data.tags : [];
    const storedTag = dashed(stored);

    if (detected) {
      stats.retyped++;
      const newTags = [
        ...tags.filter((t) => t !== storedTag),
        ...(tags.includes(dashed(detected)) ? [] : [dashed(detected)]),
      ];
      console.log(
        `  RETYPE ${doc.ref.path}\n    ${stored} -> ${detected} (word=${data.word ?? "?"})`,
      );
      if (APPLY) {
        batch.update(doc.ref, { loopType: detected, tags: newTags });
        batchOps++;
      }
    } else {
      stats.untyped++;
      const circular = det?.isCircular === true;
      const newTags = tags.filter(
        (t) => t !== storedTag && (circular || (t !== "circular" && t !== "cap")),
      );
      console.log(
        `  UNTYPE ${doc.ref.path}\n    ${stored} -> (unclassifiable, circular=${circular}) (word=${data.word ?? "?"})`,
      );
      if (APPLY) {
        batch.update(doc.ref, { loopType: FieldValue.delete(), tags: newTags });
        batchOps++;
      }
    }
    if (batchOps >= BATCH_LIMIT) await flush();
  };

  // Per-parent scans with a single-field filter (no composite index needed;
  // an unfiltered collectionGroup scan times out on the 53k+ deck docs).
  const userRefs = await db.collection("users").listDocuments();
  console.log(`[repair-loop-tags] scanning ${userRefs.length} users`);
  for (const userRef of userRefs) {
    const snap = await userRef
      .collection("sequences")
      .where("loopType", "in", [...AFFECTED])
      .get();
    for (const doc of snap.docs) await processDoc(doc);
  }

  const catalogRefs = INCLUDE_CATALOGS
    ? await db.collection("catalogs").listDocuments()
    : [];
  console.log(
    `[repair-loop-tags] scanning ${catalogRefs.length} catalogs` +
      (INCLUDE_CATALOGS ? "" : " (excluded — pass --include-catalogs)"),
  );
  for (const catalogRef of catalogRefs) {
    const snap = await catalogRef
      .collection("sequences")
      .where("loopType", "in", [...AFFECTED])
      .get();
    for (const doc of snap.docs) await processDoc(doc);
  }

  // Public mirror: metadata-only docs — steps live at sourceRef. Detect on
  // the source doc's steps, repair the mirror's loopType/tags.
  const publicSnap = await db
    .collection("publicSequences")
    .where("loopType", "in", [...AFFECTED])
    .get();
  console.log(`[repair-loop-tags] publicSequences affected: ${publicSnap.size} docs`);
  for (const doc of publicSnap.docs) {
    const data = doc.data() as SeqDoc & { sourceRef?: string };
    if (Array.isArray(data.steps) && data.steps.length > 0) {
      await processDoc(doc);
      continue;
    }
    if (!data.sourceRef) {
      stats.skipped++;
      console.log(`  SKIP (no steps, no sourceRef): ${doc.ref.path}`);
      continue;
    }
    const sourceSnap = await db.doc(data.sourceRef).get();
    if (!sourceSnap.exists) {
      stats.skipped++;
      console.log(`  SKIP (dangling sourceRef ${data.sourceRef}): ${doc.ref.path}`);
      continue;
    }
    await processDoc(doc, sourceSnap.data() as SeqDoc);
  }

  await flush();

  console.log(
    `\n[repair-loop-tags] done (${APPLY ? "APPLIED" : "dry-run"}): ` +
      `scanned=${stats.scanned} affected=${stats.affected} agree=${stats.agree} ` +
      `retyped=${stats.retyped} untyped=${stats.untyped} skipped=${stats.skipped}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
