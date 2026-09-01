/**
 * Migrate legacy `sequenceData.beats` sequence docs to the current compositional
 * schema (stepPairings + blue/redSoloProp + path/solo hashes + sequenceLength +
 * contentHash + canonical startPosition).
 *
 * Background: a handful of 2025-era sequence docs store their motion array under
 * a nested `sequenceData.beats` blob and carry none of the compositional fields.
 * The library loader can't derive steps from them, so they read as "0 steps"
 * everywhere. This backfills the compositional fields (reusing the app's own
 * `ensureComposition` + `computeHash` — no hand-rolled derivation) and removes
 * the legacy blob.
 *
 * Safety:
 *   - Dry-run by default. Pass --apply to write.
 *   - Idempotent: only touches docs that LACK stepPairings AND have a beats blob.
 *   - Verifies the word reconstructed from the derived stepPairings matches the
 *     original word before writing. A mismatch aborts that doc (no write).
 *
 * Usage:
 *   npx tsx scripts/migrations/migrate-legacy-beats-to-compositional.ts            # dry-run, default user
 *   npx tsx scripts/migrations/migrate-legacy-beats-to-compositional.ts --apply
 *   npx tsx scripts/migrations/migrate-legacy-beats-to-compositional.ts --user <uid> --apply
 */

import { initFirestore } from "../lib/firestore-provider.js";
import { ensureComposition } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import {
  computeHash,
  CONTENT_HASH_VERSION,
} from "../../src/lib/shared/library/services/sequence-content-hasher";
import { deriveWord } from "../../src/lib/shared/foundation/services/word-deriver";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

// Node's global crypto carries subtle on 20+, but guard for older runtimes since
// computeHash uses crypto.subtle.digest.
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();

type AnyRec = Record<string, unknown>;

/**
 * Recursively drop undefined values (Firestore rejects them). Local copy of the
 * app's helper — the shared module imports auth, which can't resolve under tsx.
 * NOTE: never run a payload containing FieldValue sentinels through this; it
 * deep-copies plain objects and would mangle them. Sentinels are added after.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[key] = stripUndefined(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === "object" && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/** A doc is legacy when it has no stepPairings but does carry a beats blob. */
function isLegacyBeatsDoc(data: AnyRec): boolean {
  const seqData = (data["sequenceData"] as AnyRec) ?? {};
  const hasPairings =
    Array.isArray(data["stepPairings"]) &&
    (data["stepPairings"] as unknown[]).length > 0;
  const beats = (seqData["beats"] as unknown[]) ?? (data["beats"] as unknown[]);
  return !hasPairings && Array.isArray(beats) && beats.length > 0;
}

/** Build a current-schema SequenceData from the legacy beats blob. */
function legacyToSequenceData(docId: string, data: AnyRec): SequenceData {
  const seqData = (data["sequenceData"] as AnyRec) ?? {};
  const beats =
    (seqData["beats"] as AnyRec[]) ?? (data["beats"] as AnyRec[]) ?? [];

  // Legacy beats already carry motions in the current MotionData shape (same
  // string enum values: cw/ccw/out/dash/...). Carry them through and normalize
  // the beat-context fields (beatNumber -> stepNumber, isBeat -> isStep).
  const steps = beats.map((b, i) => ({
    ...b,
    isStep: true,
    stepNumber:
      typeof b["beatNumber"] === "number" ? (b["beatNumber"] as number) : i + 1,
    duration: typeof b["duration"] === "number" ? (b["duration"] as number) : 1,
    leftReversal: Boolean(b["blueReversal"]),
    rightReversal: Boolean(b["redReversal"]),
    isBlank: Boolean(b["isBlank"]),
  }));

  const legacySP =
    (seqData["startPosition"] as AnyRec) ??
    (seqData["startingPositionBeat"] as AnyRec) ??
    (data["startPosition"] as AnyRec) ??
    (data["startingPositionBeat"] as AnyRec);

  const gridMode =
    (data["gridMode"] as string) ??
    (seqData["gridMode"] as string) ??
    "diamond";

  const startPosition = legacySP
    ? {
        isStartPosition: true as const,
        id: (legacySP["id"] as string) ?? `start-${docId}`,
        letter: (legacySP["letter"] as string | null) ?? null,
        endPosition:
          (legacySP["endPosition"] as unknown) ??
          (legacySP["startPosition"] as unknown) ??
          null,
        motions: legacySP["motions"],
        gridMode: (legacySP["gridMode"] as string) ?? gridMode,
      }
    : undefined;

  const word =
    (data["word"] as string) ??
    (seqData["word"] as string) ??
    (data["name"] as string) ??
    (seqData["name"] as string) ??
    docId;

  const metaName =
    ((data["metadata"] as AnyRec)?.["name"] as string) ?? undefined;
  const name =
    (data["name"] as string) ?? (seqData["name"] as string) ?? metaName ?? word;

  return {
    ...data,
    id: docId,
    word,
    name,
    gridMode,
    steps,
    startPosition,
  } as unknown as SequenceData;
}

async function main(): Promise<void> {
  const { db, FieldValue, sdk, isAdmin } = await initFirestore();
  console.log(`Firestore via ${sdk} SDK (admin=${isAdmin}) — user ${userId}`);
  console.log(APPLY ? "MODE: APPLY (writing)" : "MODE: DRY-RUN (no writes)\n");

  const colRef = db.collection(`users/${userId}/sequences`);
  const snap = await colRef.get();

  let scanned = 0;
  let legacy = 0;
  let migrated = 0;
  let skippedMismatch = 0;
  let failed = 0;

  for (const docSnap of snap.docs) {
    scanned++;
    const data = docSnap.data() as AnyRec;
    if (data["isDeleted"] === true) continue;
    if (!isLegacyBeatsDoc(data)) continue;
    legacy++;

    const docId = docSnap.id;
    try {
      const seq = legacyToSequenceData(docId, data);
      const beatsCount = seq.steps.length;

      const composed = ensureComposition(seq);
      const pairings = composed.stepPairings ?? [];
      const contentHash = await computeHash(composed);

      // Verify the derived word matches the original — proof the transform is faithful.
      const originalWord = seq.word;
      const derivedWord = deriveWord({
        ...composed,
        steps: seq.steps,
      } as SequenceData);
      const wordMatch = derivedWord === originalWord;

      console.log(`── ${docId}`);
      console.log(`   word:            "${originalWord}"`);
      console.log(`   beats → steps:   ${beatsCount}`);
      console.log(
        `   stepPairings:    ${pairings.length}  (derived word "${derivedWord}", match=${wordMatch})`
      );
      console.log(`   leftSoloHash:    ${composed.leftSoloHash}`);
      console.log(`   rightSoloHash:   ${composed.rightSoloHash}`);
      console.log(`   sequenceLength:  ${beatsCount}`);
      console.log(`   contentHash:     ${contentHash}`);

      if (!wordMatch || pairings.length !== beatsCount) {
        console.log(
          `   ⚠️  ABORT this doc — word/pairings mismatch, not writing.\n`
        );
        skippedMismatch++;
        continue;
      }

      // Strip undefined from the DATA only (Firestore rejects undefined), then
      // attach the delete sentinels — they must not pass through stripUndefined.
      const cleanData = stripUndefined({
        word: seq.word,
        name: seq.name,
        gridMode: seq.gridMode,
        startPosition: seq.startPosition as unknown as AnyRec,
        stepPairings: composed.stepPairings as unknown as AnyRec,
        leftSoloProp: composed.leftSoloProp as unknown as AnyRec,
        rightSoloProp: composed.rightSoloProp as unknown as AnyRec,
        leftPathHash: composed.leftPathHash,
        rightPathHash: composed.rightPathHash,
        leftSoloHash: composed.leftSoloHash,
        rightSoloHash: composed.rightSoloHash,
        sequenceLength: beatsCount,
        contentHash,
        contentHashVersion: CONTENT_HASH_VERSION,
      });
      const update: AnyRec = {
        ...cleanData,
        // Drop the legacy blob + redundant counters now that the canonical
        // compositional fields above are present.
        sequenceData: FieldValue.delete(),
        beatCount: FieldValue.delete(),
        startingPositionBeat: FieldValue.delete(),
      };

      if (APPLY) {
        await docSnap.ref.update(update);
        console.log(`   ✅ written.\n`);
        migrated++;
      } else {
        console.log(`   (dry-run — would write the above)\n`);
        migrated++;
      }
    } catch (err) {
      failed++;
      console.log(
        `   ❌ FAILED: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  console.log("──────── summary ────────");
  console.log(`scanned:           ${scanned}`);
  console.log(`legacy beats docs: ${legacy}`);
  console.log(`${APPLY ? "migrated" : "would migrate"}: ${migrated}`);
  console.log(`skipped (mismatch): ${skippedMismatch}`);
  console.log(`failed:            ${failed}`);
  if (!APPLY) console.log(`\nRe-run with --apply to write.`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
