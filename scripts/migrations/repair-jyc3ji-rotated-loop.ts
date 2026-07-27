/**
 * Repair the jyC3ji/ZaJWw6 rotated-LOOP mints (Austen review, 2026-07-27).
 *
 * The stored 16-beat quartered rotated LOOP derives ΩYΘZ×4 against the
 * label's ZΘYΘ×4. Aligned cyclically, the two disagree on exactly ONE beat
 * per repeat: the label's Θ plays as Ω. A chain-constrained brute force over
 * the canonical letter matcher + orientation calculator proves the flip:
 * with both hands' paths and the chain orientations held fixed, Θ requires
 * blue's w→s motion to be PRO-family and Ω comes from ANTI-family — the
 * stored beat is anti. Same pro↔anti inversion defect family as ZLCD/HVJY,
 * here baked into the seed itself (every repeat inherits it). The stored
 * beat's own orientation metadata also fails today's canonical calculator,
 * so the whole seed's orientation chain is recomputed and the loop rebuilt
 * through the canonical StrictRotatedLOOPExecutor.
 *
 * The repaired word is the label's circle read from the STORED start
 * position (beta7): ΘYΘZ×4 — cyclically identical to the printed ZΘYΘ×4,
 * one phase earlier. Labels are stamped to the derived word (the strict
 * schema-2 invariant: label == payload derivation).
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-jyc3ji-rotated-loop.ts           # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-jyc3ji-rotated-loop.ts --apply
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
import { calculateEndOrientation } from "../../src/lib/shared/render/core/calculations/orientation";
import { sha256Hex } from "../../src/lib/shared/foundation/utils/canonical-digest";
import { registerLoopDetector } from "../../src/lib/shared/create/get-loop-detector";
import { loopDetector } from "../../src/lib/features/create/generate/circular/services/loop-detector";
import { strictRotatedLOOPExecutor } from "../../src/lib/features/create/generate/circular/services/strict-rotated-loop-executor";
import { Period } from "../../src/lib/features/create/generate/circular/domain/models/circular-models";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "../../src/lib/shared/foundation/domain/models/step-data";

registerLoopDetector(loopDetector);
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const APPLY = process.argv.includes("--apply");
const SOURCE_CODE = "jyC3ji";
const TWIN_CODE = "ZaJWw6";
const OLD_LABEL = "ZΘYΘZΘYΘZΘYΘZΘYΘ";
const EXPECTED_WORD = "ΘYΘZΘYΘZΘYΘZΘYΘZ";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function recomputeSeedOrientations(startPosition: AnyRec, seed: AnyRec[]): void {
  let prev = startPosition;
  for (const step of seed) {
    for (const color of ["blue", "red"] as const) {
      const prevMotion = (prev.motions as AnyRec)[color] as AnyRec;
      const motion = (step.motions as AnyRec)[color] as AnyRec;
      motion.startOrientation = prevMotion.endOrientation;
      motion.endOrientation = calculateEndOrientation({
        motionType: String(motion.motionType),
        turns: motion.turns as number | "fl",
        rotationDirection: String(motion.rotationDirection),
        startLocation: String(motion.startLocation),
        endLocation: String(motion.endLocation),
        startOrientation: String(motion.startOrientation),
      });
    }
    prev = step;
  }
}

function assertContinuity(startPosition: AnyRec, steps: AnyRec[]): void {
  let prev = startPosition;
  for (const [i, step] of steps.entries()) {
    for (const color of ["blue", "red"] as const) {
      const prevMotion = (prev.motions as AnyRec)[color] as AnyRec;
      const motion = (step.motions as AnyRec)[color] as AnyRec;
      if (motion.startLocation !== prevMotion.endLocation)
        throw new Error(
          `beat ${i + 1} ${color}: startLocation ${motion.startLocation} != previous endLocation ${prevMotion.endLocation}`
        );
      if (motion.startOrientation !== prevMotion.endOrientation)
        throw new Error(
          `beat ${i + 1} ${color}: startOrientation ${motion.startOrientation} != previous endOrientation ${prevMotion.endOrientation}`
        );
    }
    prev = step;
  }
  for (const color of ["blue", "red"] as const) {
    const startMotion = (startPosition.motions as AnyRec)[color] as AnyRec;
    const lastMotion = ((steps[steps.length - 1]!.motions as AnyRec)[color] ??
      {}) as AnyRec;
    if (
      lastMotion.endLocation !== startMotion.endLocation ||
      lastMotion.endOrientation !== startMotion.endOrientation
    )
      throw new Error(
        `${color} does not close: ends ${lastMotion.endLocation}/${lastMotion.endOrientation}, start is ${startMotion.endLocation}/${startMotion.endOrientation}`
      );
  }
}

/** The two chain-compatible Θ realizations of the seed's first beat, in
 *  preference order: the float form mirrors how this sequence's OTHER Θ is
 *  realized (hand-alternating floats); the whole-turn pro form is the
 *  fallback. */
const BLUE_FIXES: Array<{ name: string; fields: AnyRec }> = [
  {
    name: "float pf:pro/ccw",
    fields: {
      motionType: "float",
      turns: "fl",
      rotationDirection: "noRotation",
      prefloatMotionType: "pro",
      prefloatRotationDirection: "ccw",
    },
  },
  {
    name: "pro ccw t:1.5",
    fields: { motionType: "pro", turns: 1.5, rotationDirection: "ccw" },
  },
];

async function main(): Promise<void> {
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

  const source = await docOf(SOURCE_CODE);
  const twin = await docOf(TWIN_CODE);
  const oldHash = String(source.data.encoderHash ?? "");
  for (const [code, doc] of [
    [SOURCE_CODE, source],
    [TWIN_CODE, twin],
  ] as const) {
    const label = String(doc.data.sequenceName ?? doc.data.sequence ?? "");
    if (label !== OLD_LABEL)
      throw new Error(`${code}: label ${JSON.stringify(label)} is not the reviewed one`);
    if (doc.data.encoderHash !== oldHash)
      throw new Error(`${code}: encoderHash differs — not a content twin`);
  }

  const embed = source.data.sequenceData as AnyRec | undefined;
  const steps = embed?.steps as AnyRec[] | undefined;
  if (!embed || !Array.isArray(steps) || steps.length !== 16)
    throw new Error(`${SOURCE_CODE}: embedded copy missing or not 16 beats`);
  if (embed.loopType !== "rotated")
    throw new Error(`${SOURCE_CODE}: loopType is ${JSON.stringify(embed.loopType)}, not rotated`);

  const startPosition = clone(embed.startPosition as AnyRec);
  let repaired: { steps: AnyRec[]; fixName: string } | null = null;
  const failures: string[] = [];

  for (const fix of BLUE_FIXES) {
    try {
      const seed = clone(steps.slice(0, 4));
      const beat1 = seed[0]!;
      beat1.letter = "Θ";
      Object.assign((beat1.motions as AnyRec).blue as AnyRec, {
        // Clear any stale prefloat before applying the fix's exact fields.
        prefloatMotionType: undefined,
        prefloatRotationDirection: undefined,
        ...fix.fields,
      });
      recomputeSeedOrientations(startPosition, seed);
      const rebuilt = strictRotatedLOOPExecutor.executeLOOP(
        [clone(startPosition), ...clone(seed)] as unknown as StepData[],
        Period.QUARTERED
      ) as unknown as AnyRec[];
      const rebuiltSteps = rebuilt.slice(1);
      if (rebuiltSteps.length !== 16)
        throw new Error(`executor produced ${rebuiltSteps.length} beats`);
      assertContinuity(startPosition, rebuiltSteps);
      const derived = deriveFromSteps(rebuiltSteps, "embedded");
      if (!derived.complete || derived.word !== EXPECTED_WORD)
        throw new Error(
          `derives ${JSON.stringify(derived.word)} (complete: ${derived.complete})`
        );
      repaired = { steps: rebuiltSteps, fixName: fix.name };
      break;
    } catch (e) {
      failures.push(`${fix.name}: ${e instanceof Error ? e.message : e}`);
    }
  }

  if (!repaired) {
    throw new Error(`no candidate fix survives the rebuild gates:\n  ${failures.join("\n  ")}`);
  }

  const newEmbed: AnyRec = clone({
    ...embed,
    word: EXPECTED_WORD,
    startPosition,
    steps: repaired.steps,
  });
  const asSequence = { id: SOURCE_CODE, ...newEmbed } as unknown as SequenceData;

  const blob = await encodeSequenceForQR(asSequence);
  const decoded = (await decodeSequenceFromQR(blob)) as SequenceData;
  const encodedDerived = deriveFromSteps(
    (decoded.steps ?? []) as unknown as AnyRec[],
    "encoded"
  );
  const blobCarries =
    encodedDerived.complete && encodedDerived.word === EXPECTED_WORD;
  const newHash = await sha256Hex(encodeSequence(asSequence));

  console.log(`seed fix chosen:      blue ${repaired.fixName}`);
  console.log(`rebuilt derivation:   ${EXPECTED_WORD} (16 beats, closes)`);
  console.log(
    `blob round-trip:      ${encodedDerived.word}${blobCarries ? "" : "  → wire cannot carry this sequence; defective blob will be DROPPED"}`
  );
  console.log(`label:                ${OLD_LABEL} → ${EXPECTED_WORD} (same circle, stored-start phase)`);
  console.log(`encoderHash:          ${oldHash.slice(0, 12)}… → ${newHash.slice(0, 12)}…`);

  if (!APPLY) {
    console.log("dry-run — re-run with --apply to write.");
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `repair-jyc3ji-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repair: `rotated LOOP seed beat 1 anti→${repaired.fixName}; loop rebuilt via StrictRotatedLOOPExecutor`,
        codes: [SOURCE_CODE, TWIN_CODE],
        oldHash,
        newHash,
        previous: {
          [SOURCE_CODE]: {
            encoded: source.data.encoded,
            sequenceData: source.data.sequenceData,
            sequenceName: source.data.sequenceName,
          },
          [TWIN_CODE]: {
            encoded: twin.data.encoded,
            sequenceName: twin.data.sequenceName,
          },
        },
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  const stamps: AnyRec = {
    encoded: blobCarries ? blob : FieldValue.delete(),
    encoderHash: newHash,
    payloadWord: EXPECTED_WORD,
    payloadStepCount: 16,
    payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    sequenceName: EXPECTED_WORD,
    sequence: EXPECTED_WORD,
  };
  for (const doc of [source, twin]) {
    await (doc.ref["update"] as (u: AnyRec) => Promise<unknown>)({
      ...stamps,
      sequenceData: clone(newEmbed),
    });
  }

  const oldClaimRef = (db.collection as (p: string) => AnyRec)(
    "shortcodeHashes"
  )["doc"](oldHash) as AnyRec;
  const oldClaimSnap = await (oldClaimRef["get"] as () => Promise<AnyRec>)();
  const oldClaim = (oldClaimSnap.data as () => AnyRec | undefined)() ?? {};
  const newClaimRef = (db.collection as (p: string) => AnyRec)(
    "shortcodeHashes"
  )["doc"](newHash) as AnyRec;
  await (newClaimRef["set"] as (d: AnyRec) => Promise<unknown>)({
    code: String(oldClaim.code ?? TWIN_CODE),
    createdAt: oldClaim.createdAt ?? new Date().toISOString(),
    backfilled: true,
  });
  if (oldClaimSnap.exists as boolean) {
    await (oldClaimRef["delete"] as () => Promise<unknown>)();
  }

  console.log(`${SOURCE_CODE} + ${TWIN_CODE} repaired; claim moved to ${newHash.slice(0, 12)}….`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
