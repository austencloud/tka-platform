/**
 * Repair the P9LY mirrored-LOOP mint (parity-repair follow-up, 2026-07-27).
 *
 * P9LY is the pro-shift twin of the Λ-γYΘγ family (5247 / 0XHN realize the
 * same word with floats). Its repeat 2 mirrors repeat 1's blue shifts onto
 * the east side — but the generator left the seed's ccw rotation on the
 * mirrored copy: beats 7/8 store blue pro n→e / e→s with CCW, a
 * rotation/handpath combination that exists in no pictograph dataframe, so
 * both beats derive no letter. Repeat 1's counterparts (pro n→w / w→s, ccw)
 * derive the label's Y and Θ. Same half-applied mirrored-transform family as
 * B2ZM/PAI0, expressed as unflipped rotations instead of unmirrored
 * locations.
 *
 * The repair brute-forces each corrupt beat over {pro,anti}×{cw,ccw}
 * through the canonical letter matcher and refuses to write unless exactly
 * ONE candidate derives the label's letter — the label-corroborated
 * uniqueness standard the jyC3ji repair set. The orientation chain is then
 * recomputed, the loop must close, the full derivation must spell the
 * reviewed label, and the fresh blob must round-trip to it.
 *
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-p9ly-mirrored-rotations.ts           # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/repair-p9ly-mirrored-rotations.ts --apply
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { initFirestore } from "../lib/firestore-provider.js";
import {
  contentStepsOf,
  deriveFromSteps,
  letterForBeat,
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
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

registerLoopDetector(loopDetector);
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const APPLY = process.argv.includes("--apply");
const CODE = "P9LY";
const LABEL = "Λ-γYΘγΛ-γYΘγ";
const TOKEN = /[A-ZΑ-Ωα-ω]-?/gu;

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const blueOf = (step: AnyRec): AnyRec =>
  ((step.motions as AnyRec).blue ?? {}) as AnyRec;

const blueSig = (step: AnyRec): string => {
  const b = blueOf(step);
  return [
    b.motionType,
    b.startLocation,
    b.endLocation,
    b.rotationDirection,
    String(b.turns),
  ].join("/");
};

function recomputeOrientations(startPosition: AnyRec, steps: AnyRec[]): void {
  let prev = startPosition;
  for (const step of steps) {
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
          `beat ${i + 1} ${color}: startOrientation mismatch`
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

async function main(): Promise<void> {
  const { db, isAdmin, FieldValue } = (await initFirestore()) as AnyRec & {
    db: AnyRec;
    isAdmin: boolean;
    FieldValue: { delete(): unknown };
  };
  if (!isAdmin) throw new Error("run with TKA_ADMIN=1");

  const ref = (db.collection as (p: string) => AnyRec)("shortcodes")["doc"](
    CODE
  ) as AnyRec;
  const snap = await (ref["get"] as () => Promise<AnyRec>)();
  if (!(snap.exists as boolean)) throw new Error(`shortcodes/${CODE} missing`);
  const data = (snap.data as () => AnyRec)();

  // ── preconditions: the exact reviewed state ────────────────────────────────
  const label = String(
    data.payloadWord ?? data.sequenceName ?? data.sequence ?? ""
  );
  if (label !== LABEL)
    throw new Error(`label ${JSON.stringify(label)} is not the reviewed ${JSON.stringify(LABEL)}`);
  if (data.sequenceData) throw new Error("record unexpectedly has an embed");
  const oldHash = String(data.encoderHash ?? "");

  const decoded = (await decodeSequenceFromQR(
    String(data.encoded)
  )) as unknown as AnyRec;
  const content = contentStepsOf((decoded.steps ?? []) as AnyRec[]).map(
    (s, i) => {
      const step = clone(s);
      step.stepNumber = i + 1;
      return step;
    }
  );
  const startPosition = clone(decoded.startPosition as AnyRec);
  const tokens = (LABEL.match(TOKEN) ?? []) as string[];
  if (content.length !== tokens.length)
    throw new Error(`${content.length} beats vs ${tokens.length} label tokens`);

  const strict = content.map((s) => letterForBeat(s));
  const gaps = strict.flatMap((l, i) => (l === null ? [i] : []));
  if (gaps.join(",") !== "7,8")
    throw new Error(`gaps are [${gaps.join(",")}], expected [7,8] — state changed`);
  const misaligned = strict.flatMap((l, i) =>
    l !== null && l !== tokens[i] ? [i] : []
  );
  if (misaligned.length > 0)
    throw new Error(`derivable beats ${misaligned.join(",")} contradict the label`);
  if (blueSig(content[7]!) !== "pro/n/e/ccw/0")
    throw new Error(`beat 7 blue is ${blueSig(content[7]!)}, not the reviewed pro/n/e/ccw/0`);
  if (blueSig(content[8]!) !== "pro/e/s/ccw/0")
    throw new Error(`beat 8 blue is ${blueSig(content[8]!)}, not the reviewed pro/e/s/ccw/0`);

  // ── label-constrained uniqueness search per corrupt beat ──────────────────
  const fixes: Array<{ beat: number; motionType: string; rotation: string }> =
    [];
  for (const beat of gaps) {
    const target = tokens[beat]!;
    const winners: Array<{ motionType: string; rotation: string }> = [];
    for (const motionType of ["pro", "anti"]) {
      for (const rotation of ["cw", "ccw"]) {
        const trial = clone(content[beat]!);
        Object.assign(blueOf(trial), {
          motionType,
          rotationDirection: rotation,
        });
        if (letterForBeat(trial) === target)
          winners.push({ motionType, rotation });
      }
    }
    if (winners.length !== 1)
      throw new Error(
        `beat ${beat} (${target}): ${winners.length} candidates ${JSON.stringify(winners)} — not uniquely recoverable`
      );
    fixes.push({ beat, ...winners[0]! });
  }

  // ── rebuild, re-derive orientations, gate ─────────────────────────────────
  const repaired = clone(content);
  for (const f of fixes) {
    Object.assign(blueOf(repaired[f.beat]!), {
      motionType: f.motionType,
      rotationDirection: f.rotation,
    });
  }
  recomputeOrientations(startPosition, repaired);
  assertContinuity(startPosition, repaired);
  const derived = deriveFromSteps(repaired, "encoded");
  if (!derived.complete || derived.word !== LABEL)
    throw new Error(
      `repaired payload derives ${JSON.stringify(derived.word)} (complete ${derived.complete}), not the label`
    );

  const newEmbed: AnyRec = {
    word: LABEL,
    isCircular: decoded.isCircular === true,
    startPosition,
    steps: repaired,
  };
  const asSequence = { id: CODE, ...newEmbed } as unknown as SequenceData;
  const blob = await encodeSequenceForQR(asSequence);
  const roundTrip = (await decodeSequenceFromQR(blob)) as SequenceData;
  const rtDerived = deriveFromSteps(
    (roundTrip.steps ?? []) as unknown as AnyRec[],
    "encoded"
  );
  const blobCarries = rtDerived.complete && rtDerived.word === LABEL;
  const newHash = await sha256Hex(encodeSequence(asSequence));

  for (const f of fixes) {
    console.log(
      `beat ${f.beat} (${tokens[f.beat]}): blue ccw → ${f.motionType}/${f.rotation} (unique candidate; repeat-1 mirror twin is ${blueSig(content[f.beat - 5]!)})`
    );
  }
  console.log(`repaired derivation:  ${derived.word} (${derived.stepCount} beats, closes)`);
  console.log(
    `blob round-trip:      ${rtDerived.word}${blobCarries ? "" : "  → wire cannot carry; blob will be DROPPED in favor of the embed"}`
  );
  console.log(`encoderHash:          ${oldHash.slice(0, 12) || "(none)"}… → ${newHash.slice(0, 12)}…`);

  if (!APPLY) {
    console.log("dry-run — re-run with --apply to write.");
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(
    "scripts",
    "migrations",
    "backups",
    `repair-p9ly-${stamp}.json`
  );
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        repair:
          "mirrored-LOOP repeat-2 blue rotations unflipped at mint; label-corroborated unique fix via canonical matcher",
        codes: [CODE],
        fixes,
        oldHash,
        newHash,
        previous: {
          [CODE]: {
            encoded: data.encoded,
            payloadWord: data.payloadWord ?? null,
            payloadStepCount: data.payloadStepCount ?? null,
            payloadSchemaVersion: data.payloadSchemaVersion ?? null,
            sequenceName: data.sequenceName ?? null,
            sequence: data.sequence ?? null,
          },
        },
      },
      null,
      2
    )
  );
  console.log(`backup: ${backupPath}`);

  await (ref["update"] as (u: AnyRec) => Promise<unknown>)({
    encoded: blobCarries ? blob : FieldValue.delete(),
    ...(blobCarries ? {} : { sequenceData: clone(newEmbed) }),
    encoderHash: newHash,
    payloadWord: LABEL,
    payloadStepCount: derived.stepCount,
    payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    sequenceName: LABEL,
    sequence: LABEL,
  });

  // Move the hash claim to the repaired content hash.
  if (oldHash) {
    const oldClaimRef = (db.collection as (p: string) => AnyRec)(
      "shortcodeHashes"
    )["doc"](oldHash) as AnyRec;
    const oldClaimSnap = await (oldClaimRef["get"] as () => Promise<AnyRec>)();
    const oldClaim = (oldClaimSnap.data as () => AnyRec | undefined)() ?? {};
    const newClaimRef = (db.collection as (p: string) => AnyRec)(
      "shortcodeHashes"
    )["doc"](newHash) as AnyRec;
    await (newClaimRef["set"] as (d: AnyRec) => Promise<unknown>)({
      code: String(oldClaim.code ?? CODE),
      createdAt: oldClaim.createdAt ?? new Date().toISOString(),
      backfilled: true,
    });
    if (oldClaimSnap.exists as boolean) {
      await (oldClaimRef["delete"] as () => Promise<unknown>)();
    }
  }

  console.log(`${CODE} repaired; claim moved to ${newHash.slice(0, 12)}….`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
