/**
 * For a shortcode with BOTH payloads, compare embedded vs blob-decoded motion
 * fields beat by beat at positions where the derived letters disagree —
 * decides whether a float-letter mismatch comes from the matcher's rotation
 * rule or from the wire format corrupting prefloat data.
 *
 *   TKA_ADMIN=1 npx tsx scripts/diagnostics/probe-float-beat.ts <code>
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { contentLetters, type AnyRec } from "../migrations/lib/shortcode-derivation";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const show = (m: AnyRec | undefined): string =>
  m
    ? `${m.motionType} ${m.startLocation}→${m.endLocation} rot:${m.rotationDirection} turns:${m.turns} pf:${m.prefloatMotionType ?? "∅"}/${m.prefloatRotationDirection ?? "∅"}`
    : "∅";

async function main(): Promise<void> {
  const code = process.argv[2];
  if (!code) throw new Error("usage: probe-float-beat.ts <code>");
  const { db } = (await initFirestore()) as { db: AnyRec };
  const snap = await (db.doc as (p: string) => AnyRec)(`shortcodes/${code}`)["get" as never]();
  const data = (snap as { data: () => AnyRec }).data() ?? {};
  const embedded = ((data.sequenceData as AnyRec)?.steps ?? []) as AnyRec[];
  const decoded = (await decodeSequenceFromQR(data.encoded as string)) as SequenceData;
  const blobSteps = (decoded.steps ?? []) as unknown as AnyRec[];
  const embLetters = contentLetters(embedded);
  const blobLetters = contentLetters(blobSteps);
  console.log(`${code}  label ${JSON.stringify(data.sequenceName)}`);
  console.log(`embedded letters: ${embLetters.map((l) => l ?? "·").join("")}`);
  console.log(`blob     letters: ${blobLetters.map((l) => l ?? "·").join("")}`);
  const embContent = embedded.length === embLetters.length ? embedded : embedded.slice(1);
  const blobContent = blobSteps.length === blobLetters.length ? blobSteps : blobSteps.slice(1);
  for (let i = 0; i < Math.max(embLetters.length, blobLetters.length); i++) {
    if (embLetters[i] === blobLetters[i]) continue;
    const e = embContent[i] as AnyRec | undefined;
    const b = blobContent[i] as AnyRec | undefined;
    const eM = e?.motions as { left?: AnyRec; right?: AnyRec } | undefined;
    const bM = b?.motions as { left?: AnyRec; right?: AnyRec } | undefined;
    console.log(`\nbeat ${i}: embedded letter ${JSON.stringify(embLetters[i])} (stored ${JSON.stringify(e?.letter ?? null)})  vs blob letter ${JSON.stringify(blobLetters[i])}`);
    console.log(`  emb blue: ${show(eM?.left)}`);
    console.log(`  blb blue: ${show(bM?.left)}`);
    console.log(`  emb red:  ${show(eM?.right)}`);
    console.log(`  blb red:  ${show(bM?.right)}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
