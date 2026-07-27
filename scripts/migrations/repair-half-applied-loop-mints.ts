/**
 * Repair shortcode mints whose LOOP repeat 2 was generated with a
 * HALF-APPLIED transform (Austen-reviewed, 2026-07-27).
 *
 * The defect family: a mirrored-family LOOP generator applied its transform
 * to only part of repeat 2 — B2ZM/PAI0 ("mirrored": red's locations mirrored
 * without rotation flips, blue copied unmirrored), ZLCD/HVJY
 * ("mirrored_inverted": locations and rotations right, but the PRO↔ANTI
 * motion-type/prefloat inversion never applied). Either way the stored
 * repeat 2 derives letters the mint-time label contradicts.
 *
 * The repair regenerates repeat 2 from repeat 1 through the app's OWN
 * canonical executor for the embedded loopType, then re-encodes, restamps,
 * and moves the hash claim. It refuses to write unless BOTH derivation
 * channels (embedded steps and a decode of the fresh blob) independently
 * derive the exact reviewed label — for these records the label is the
 * author-side witness the rebuild must corroborate.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-half-applied-loop-mints.ts <source> <twin|-> <label>           # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-half-applied-loop-mints.ts <source> <twin|-> <label> --apply
 *
 * <source> must carry the embedded mint copy; <twin> (optional, "-" to skip)
 * is a blob-only record sharing the same encoderHash whose claim ownership
 * is preserved.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import {
  deriveFromSteps,
  PAYLOAD_SCHEMA_VERSION,
  type AnyRec,
} from "./lib/shortcode-derivation";
import {
  encodeSequence,
  encodeSequenceForQR,
  decodeSequenceFromQR,
} from "../../src/lib/shared/navigation/services/sequence-encoder";
import { sha256Hex } from "../../src/lib/shared/foundation/utils/canonical-digest";
import { registerLoopDetector } from "../../src/lib/shared/create/get-loop-detector";
import { loopDetector } from "../../src/lib/features/create/generate/circular/services/loop-detector";
import { strictMirroredLOOPExecutor } from "../../src/lib/features/create/generate/circular/services/strict-mirrored-loop-executor";
import { mirroredInvertedLOOPExecutor } from "../../src/lib/features/create/generate/circular/services/mirrored-inverted-loop-executor";
import { Period } from "../../src/lib/features/create/generate/circular/domain/models/circular-models";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "../../src/lib/shared/foundation/domain/models/step-data";

registerLoopDetector(loopDetector);
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

/** Canonical repeat-2 generators by embedded loopType. Every entry takes
 *  [startPosition, ...repeat1] and returns [startPosition, ...fullLoop]. */
const EXECUTORS: Record<string, (input: StepData[]) => StepData[]> = {
  mirrored: (input) =>
    strictMirroredLOOPExecutor.executeLOOP(input, Period.HALVED),
  mirrored_inverted: (input) =>
    mirroredInvertedLOOPExecutor.executeLOOP(input, Period.HALVED),
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function assertContinuity(startPosition: AnyRec, steps: AnyRec[]): void {
  let prev = startPosition;
  for (const [i, step] of steps.entries()) {
    for (const color of ["blue", "red"] as const) {
      const prevMotion = (prev.motions as AnyRec)[color] as AnyRec;
      const motion = (step.motions as AnyRec)[color] as AnyRec;
      if (motion.startLocation !== prevMotion.endLocation) {
        throw new Error(
          `beat ${i + 1} ${color}: startLocation ${motion.startLocation} != previous endLocation ${prevMotion.endLocation}`
        );
      }
      if (motion.startOrientation !== prevMotion.endOrientation) {
        throw new Error(
          `beat ${i + 1} ${color}: startOrientation ${motion.startOrientation} != previous endOrientation ${prevMotion.endOrientation}`
        );
      }
    }
    prev = step;
  }
  // LOOP closure: the final state must return to the start position's state.
  for (const color of ["blue", "red"] as const) {
    const startMotion = (startPosition.motions as AnyRec)[color] as AnyRec;
    const lastMotion = ((steps[steps.length - 1]!.motions as AnyRec)[color] ??
      {}) as AnyRec;
    if (
      lastMotion.endLocation !== startMotion.endLocation ||
      lastMotion.endOrientation !== startMotion.endOrientation
    ) {
      throw new Error(
        `${color} does not close: ends ${lastMotion.endLocation}/${lastMotion.endOrientation}, start is ${startMotion.endLocation}/${startMotion.endOrientation}`
      );
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== "--apply");
  const APPLY = process.argv.includes("--apply");
  const [sourceCode, twinArg, expectedLabel] = args;
  if (!sourceCode || !twinArg || !expectedLabel) {
    throw new Error(
      "usage: repair-half-applied-loop-mints.ts <source> <twin|-> <label> [--apply]"
    );
  }
  const twinCode = twinArg === "-" ? null : twinArg;

  const { db, isAdmin, FieldValue } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    isAdmin: boolean;
    FieldValue: { delete(): unknown };
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");

  const docOf = async (code: string) => {
    const ref = (db.collection as (p: string) => AnyRec)("shortcodes")["doc"](
      code
    ) as AnyRec;
    const snap = await (ref["get"] as () => Promise<AnyRec>)();
    if (!(snap.exists as boolean)) throw new Error(`shortcodes/${code} missing`);
    return { ref, data: (snap.data as () => AnyRec)() };
  };

  const source = await docOf(sourceCode);
  const twin = twinCode ? await docOf(twinCode) : null;
  const targets: Array<readonly [string, { ref: AnyRec; data: AnyRec }]> = twin
    ? [
        [sourceCode, source],
        [twinCode!, twin],
      ]
    : [[sourceCode, source]];

  // --- preconditions ---------------------------------------------------------
  const oldHash = String(source.data.encoderHash ?? "");
  if (!oldHash) throw new Error(`${sourceCode}: no encoderHash`);
  for (const [code, doc] of targets) {
    const label = String(doc.data.sequenceName ?? doc.data.sequence ?? "");
    if (label !== expectedLabel)
      throw new Error(
        `${code}: label ${JSON.stringify(label)} is not the reviewed ${JSON.stringify(expectedLabel)}`
      );
    if (doc.data.encoderHash !== oldHash)
      throw new Error(
        `${code}: encoderHash differs from source — not a content twin`
      );
  }
  const embed = source.data.sequenceData as AnyRec | undefined;
  const steps = embed?.steps as AnyRec[] | undefined;
  if (
    !embed ||
    !Array.isArray(steps) ||
    steps.length < 2 ||
    steps.length % 2 !== 0
  )
    throw new Error(
      `${sourceCode}: embedded copy missing or not an even-length loop (${steps?.length ?? 0} beats)`
    );
  const loopType = String(embed.loopType ?? "");
  const executor = EXECUTORS[loopType];
  if (!executor)
    throw new Error(
      `${sourceCode}: no canonical executor for loopType ${JSON.stringify(loopType)} — extend EXECUTORS only after verifying the transform`
    );

  // --- regenerate repeat 2 through the canonical executor -------------------
  const startPosition = clone(embed.startPosition as AnyRec);
  const half = steps.length / 2;
  const rep1 = clone(steps.slice(0, half));
  const executorInput = [
    clone(startPosition),
    ...clone(rep1),
  ] as unknown as StepData[];
  const rebuilt = executor(executorInput) as unknown as AnyRec[];
  const rebuiltSteps = rebuilt.slice(1); // drop the start-position entry
  if (rebuiltSteps.length !== steps.length)
    throw new Error(
      `executor produced ${rebuiltSteps.length} beats, expected ${steps.length}`
    );

  assertContinuity(startPosition, rebuiltSteps);

  // --- both derivation channels must independently spell the label ----------
  const embeddedDerived = deriveFromSteps(rebuiltSteps, "embedded");
  if (!embeddedDerived.complete || embeddedDerived.word !== expectedLabel)
    throw new Error(
      `embedded channel derives ${JSON.stringify(embeddedDerived.word)} (complete: ${embeddedDerived.complete}), not the label`
    );

  const newEmbed: AnyRec = clone({
    ...embed,
    word: expectedLabel,
    startPosition,
    steps: rebuiltSteps,
  });
  const asSequence = {
    id: sourceCode,
    ...newEmbed,
  } as unknown as SequenceData;

  // A blob is written only when it round-trips to the label. When the wire
  // formats cannot carry the sequence (e.g. inverted floats whose prefloat
  // TYPE the flat fallback drops), the honest state is embed + NO blob:
  // Firestore-backed resolution serves the corrected payload and the skinny
  // R2 snapshot omits the code instead of playing the WRONG sequence offline
  // (same policy as rebuild-truncated-shortcode-payloads'
  // REBUILT_BLOB_DROPPED).
  const blob = await encodeSequenceForQR(asSequence);
  const decoded = (await decodeSequenceFromQR(blob)) as SequenceData;
  const encodedDerived = deriveFromSteps(
    (decoded.steps ?? []) as unknown as AnyRec[],
    "encoded"
  );
  const blobCarries =
    encodedDerived.complete && encodedDerived.word === expectedLabel;

  const newHash = await sha256Hex(encodeSequence(asSequence));

  console.log(`loopType:             ${loopType}`);
  console.log(`repeat 2 regenerated: ${embeddedDerived.word} (${embeddedDerived.stepCount} beats)`);
  console.log(
    `blob round-trip:      ${encodedDerived.word}${blobCarries ? "" : "  → wire cannot carry this sequence; defective blob will be DROPPED"}`
  );
  console.log(`encoderHash:          ${oldHash.slice(0, 12)}… → ${newHash.slice(0, 12)}…`);

  if (!APPLY) {
    console.log("dry-run — re-run with --apply to write.");
    process.exit(0);
  }

  // --- backup manifest before any write -------------------------------------
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `repair-half-applied-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repair: `half-applied ${loopType} LOOP repeat 2 regenerated via canonical executor`,
        codes: targets.map(([code]) => code),
        oldHash,
        newHash,
        previous: Object.fromEntries(
          targets.map(([code, doc]) => [
            code,
            {
              encoded: doc.data.encoded,
              ...(doc.data.sequenceData
                ? { sequenceData: doc.data.sequenceData }
                : {}),
            },
          ])
        ),
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  const stamps: AnyRec = {
    sequenceData: newEmbed,
    encoded: blobCarries ? blob : FieldValue.delete(),
    encoderHash: newHash,
    payloadWord: expectedLabel,
    payloadStepCount: steps.length,
    payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    sequenceName: expectedLabel,
    sequence: expectedLabel,
  };
  for (const [, doc] of targets) {
    // Spread, not clone: a JSON round-trip would destroy the
    // FieldValue.delete() sentinel. Only the embed needs a fresh copy.
    await (doc.ref["update"] as (u: AnyRec) => Promise<unknown>)({
      ...stamps,
      sequenceData: clone(newEmbed),
    });
  }

  // Move the hash claim, preserving the current canonical owner.
  const oldClaimRef = (db.collection as (p: string) => AnyRec)(
    "shortcodeHashes"
  )["doc"](oldHash) as AnyRec;
  const oldClaimSnap = await (oldClaimRef["get"] as () => Promise<AnyRec>)();
  const oldClaim = (oldClaimSnap.data as () => AnyRec | undefined)() ?? {};
  const claimOwner = String(oldClaim.code ?? twinCode ?? sourceCode);
  const newClaimRef = (db.collection as (p: string) => AnyRec)(
    "shortcodeHashes"
  )["doc"](newHash) as AnyRec;
  await (newClaimRef["set"] as (d: AnyRec) => Promise<unknown>)({
    code: claimOwner,
    createdAt: oldClaim.createdAt ?? new Date().toISOString(),
    backfilled: true,
  });
  if (oldClaimSnap.exists as boolean) {
    await (oldClaimRef["delete"] as () => Promise<unknown>)();
  }

  console.log(
    `${targets.map(([code]) => code).join(" + ")} repaired; claim (${claimOwner}) moved to ${newHash.slice(0, 12)}….`
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
