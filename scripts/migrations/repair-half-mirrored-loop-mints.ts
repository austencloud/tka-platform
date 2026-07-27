/**
 * Repair the B2ZM/PAI0 half-mirrored LOOP mints (Austen review, 2026-07-27).
 *
 * Both codes were minted 2026-05-02 from the same sequence (shared
 * encoderHash) with loopType "mirrored" and label "Λ-γYΘγΛ-γYΘγ" — but the
 * stored second repeat is a HALF-APPLIED vertical mirror: red's locations
 * were mirrored (e↔w) without flipping its rotations, and blue was copied
 * verbatim instead of mirrored. The result plays a different relative
 * configuration (beats 8/9 derive W/Σ instead of Y/Θ) and contradicts the
 * label. Austen reviewed the code and ruled the label right: theta both
 * times.
 *
 * The repair regenerates repeat 2 from repeat 1 through the app's OWN
 * canonical executor (StrictMirroredLOOPExecutor, Period.HALVED) — the
 * transform that should have run at creation — then re-encodes, restamps,
 * and moves the hash claim. Refuses to write unless BOTH derivation channels
 * (embedded steps and a decode of the fresh blob) independently derive the
 * exact label.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-half-mirrored-loop-mints.ts           # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-half-mirrored-loop-mints.ts --apply
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
import { Period } from "../../src/lib/features/create/generate/circular/domain/models/circular-models";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "../../src/lib/shared/foundation/domain/models/step-data";

registerLoopDetector(loopDetector);
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const APPLY = process.argv.includes("--apply");
const SOURCE_CODE = "B2ZM"; // carries the embedded mint copy
const TWIN_CODE = "PAI0"; // blob-only twin; owns the hash claim
const EXPECTED_LABEL = "Λ-γYΘγΛ-γYΘγ";
const OLD_HASH =
  "15884043dc86a5038f77d94fd9a81e336147f2f7284a0c7d27f7c7343eab6634";

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
  const { db, isAdmin } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    isAdmin: boolean;
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

  const source = await docOf(SOURCE_CODE);
  const twin = await docOf(TWIN_CODE);

  // --- preconditions: this repair is for exactly the reviewed defect --------
  for (const [code, data] of [
    [SOURCE_CODE, source.data],
    [TWIN_CODE, twin.data],
  ] as const) {
    const label = String(data.sequenceName ?? data.sequence ?? "");
    if (label !== EXPECTED_LABEL)
      throw new Error(`${code}: label ${JSON.stringify(label)} is not the reviewed one`);
    if (data.encoderHash !== OLD_HASH)
      throw new Error(`${code}: encoderHash is not the reviewed mint hash`);
  }
  const embed = source.data.sequenceData as AnyRec | undefined;
  const steps = embed?.steps as AnyRec[] | undefined;
  if (!embed || !Array.isArray(steps) || steps.length !== 10)
    throw new Error(`${SOURCE_CODE}: embedded copy missing or not 10 beats`);
  if (embed.loopType !== "mirrored")
    throw new Error(`${SOURCE_CODE}: loopType is ${JSON.stringify(embed.loopType)}, not mirrored`);

  // --- regenerate repeat 2 through the canonical executor -------------------
  const startPosition = clone(embed.startPosition as AnyRec);
  const rep1 = clone(steps.slice(0, 5));
  const executorInput = [
    clone(startPosition),
    ...clone(rep1),
  ] as unknown as StepData[];
  const rebuilt = strictMirroredLOOPExecutor.executeLOOP(
    executorInput,
    Period.HALVED
  ) as unknown as AnyRec[];
  const rebuiltSteps = rebuilt.slice(1); // drop the start-position entry
  if (rebuiltSteps.length !== 10)
    throw new Error(`executor produced ${rebuiltSteps.length} beats, expected 10`);

  assertContinuity(startPosition, rebuiltSteps);

  // --- both derivation channels must independently spell the label ----------
  const embeddedDerived = deriveFromSteps(rebuiltSteps, "embedded");
  if (!embeddedDerived.complete || embeddedDerived.word !== EXPECTED_LABEL)
    throw new Error(
      `embedded channel derives ${JSON.stringify(embeddedDerived.word)} (complete: ${embeddedDerived.complete}), not the label`
    );

  const newEmbed: AnyRec = clone({
    ...embed,
    word: EXPECTED_LABEL,
    startPosition,
    steps: rebuiltSteps,
  });
  const asSequence = {
    id: SOURCE_CODE,
    ...newEmbed,
  } as unknown as SequenceData;

  const blob = await encodeSequenceForQR(asSequence);
  const decoded = (await decodeSequenceFromQR(blob)) as SequenceData;
  const encodedDerived = deriveFromSteps(
    (decoded.steps ?? []) as unknown as AnyRec[],
    "encoded"
  );
  if (!encodedDerived.complete || encodedDerived.word !== EXPECTED_LABEL)
    throw new Error(
      `encoded round-trip derives ${JSON.stringify(encodedDerived.word)} (complete: ${encodedDerived.complete}), not the label`
    );

  const newHash = await sha256Hex(encodeSequence(asSequence));

  console.log(`repeat 2 regenerated: ${embeddedDerived.word} (${embeddedDerived.stepCount} beats)`);
  console.log(`blob round-trip:      ${encodedDerived.word}`);
  console.log(`encoderHash:          ${OLD_HASH.slice(0, 12)}… → ${newHash.slice(0, 12)}…`);

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
    `repair-half-mirrored-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repair: "half-mirrored LOOP repeat 2 regenerated via StrictMirroredLOOPExecutor",
        codes: [SOURCE_CODE, TWIN_CODE],
        oldHash: OLD_HASH,
        newHash,
        previous: {
          [SOURCE_CODE]: {
            encoded: source.data.encoded,
            sequenceData: source.data.sequenceData,
          },
          [TWIN_CODE]: { encoded: twin.data.encoded },
        },
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  const stamps: AnyRec = {
    sequenceData: newEmbed,
    encoded: blob,
    encoderHash: newHash,
    payloadWord: EXPECTED_LABEL,
    payloadStepCount: 10,
    payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    sequenceName: EXPECTED_LABEL,
    sequence: EXPECTED_LABEL,
  };
  await (source.ref["update"] as (u: AnyRec) => Promise<unknown>)(clone(stamps));
  await (twin.ref["update"] as (u: AnyRec) => Promise<unknown>)(clone(stamps));

  // Move the hash claim: the twin keeps canonical ownership, same as before.
  const oldClaimRef = (db.collection as (p: string) => AnyRec)(
    "shortcodeHashes"
  )["doc"](OLD_HASH) as AnyRec;
  const oldClaimSnap = await (oldClaimRef["get"] as () => Promise<AnyRec>)();
  const oldClaim = (oldClaimSnap.data as () => AnyRec | undefined)() ?? {};
  const newClaimRef = (db.collection as (p: string) => AnyRec)(
    "shortcodeHashes"
  )["doc"](newHash) as AnyRec;
  await (newClaimRef["set"] as (d: AnyRec) => Promise<unknown>)({
    code: TWIN_CODE,
    createdAt: oldClaim.createdAt ?? new Date().toISOString(),
    backfilled: true,
  });
  await (oldClaimRef["delete"] as () => Promise<unknown>)();

  console.log(`${SOURCE_CODE} + ${TWIN_CODE} repaired; claim moved to ${newHash.slice(0, 12)}….`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
