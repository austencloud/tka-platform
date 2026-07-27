/**
 * Why do quarantined INCOMPLETE payloads have underivable letters? For every
 * failing beat across the quarantine, print/bucket its motion-pair signature
 * so the gap class is measured, not guessed: mixed cardinal/intercardinal
 * hands (no diamond OR box row can exist), center locations, float shapes,
 * or a plain missing row.
 *
 *   TKA_ADMIN=1 npx tsx scripts/diagnostics/profile-underivable-beats.ts <labels-manifest.json>
 */
import { readFileSync } from "fs";
import { initFirestore } from "../lib/firestore-provider.js";
import { contentLetters, type AnyRec } from "../migrations/lib/shortcode-derivation";
import { decodeSequenceFromQR } from "../../src/lib/shared/navigation/services/sequence-encoder";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

const CARDINAL = new Set(["n", "e", "s", "w"]);
const INTER = new Set(["ne", "nw", "se", "sw"]);

function locClass(l: string): string {
  if (CARDINAL.has(l)) return "card";
  if (INTER.has(l)) return "inter";
  if (l === "center") return "CENTER";
  return `?${l}`;
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error("usage: … <labels-manifest.json>");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    results: Array<{ code: string; cls: string }>;
  };
  const codes = manifest.results
    .filter((r) => r.cls === "PAYLOAD_INCOMPLETE")
    .map((r) => r.code);
  const { db } = (await initFirestore()) as { db: AnyRec };

  const buckets = new Map<string, number>();
  const samples = new Map<string, string>();
  let failing = 0;
  for (const code of codes) {
    const snap = await (db.doc as (p: string) => AnyRec)(`shortcodes/${code}`)[
      "get" as never
    ]();
    const data = (snap as { data: () => AnyRec }).data() ?? {};
    let steps: AnyRec[] = [];
    const embedded = (data.sequenceData as AnyRec | undefined)?.steps;
    if (Array.isArray(embedded) && embedded.length > 0) steps = embedded as AnyRec[];
    else if (typeof data.encoded === "string") {
      try {
        const decoded = (await decodeSequenceFromQR(data.encoded)) as SequenceData;
        steps = (decoded.steps ?? []) as unknown as AnyRec[];
      } catch { continue; }
    }
    const letters = contentLetters(steps);
    for (let i = 0; i < letters.length; i++) {
      if (letters[i] !== null) continue;
      failing++;
      const step = steps[steps.length === letters.length ? i : i + 1] as AnyRec;
      const motions = step.motions as { blue?: AnyRec; red?: AnyRec } | undefined;
      const b = motions?.blue ?? {};
      const r = motions?.red ?? {};
      const hand = (m: AnyRec): string => {
        const isFloat = String(m.motionType).toLowerCase() === "float";
        const travel =
          isFloat && !m.prefloatMotionType
            ? String(m.startLocation) === String(m.endLocation)
              ? "(IN-PLACE, no prefloat)"
              : "(traveling, no prefloat)"
            : "";
        return `${m.motionType}/${m.startLocation}→${m.endLocation}${travel}`;
      };
      const sig = `blue ${hand(b)}  red ${hand(r)}`;
      // bucket on the structural shape, not exact locations
      const floatMode = (m: AnyRec): string =>
        String(m.motionType).toLowerCase() === "float" && !m.prefloatMotionType
          ? String(m.startLocation) === String(m.endLocation)
            ? "float:inPlace"
            : "float:travel"
          : String(m.motionType);
      const shape = [
        floatMode(b), locClass(String(b.startLocation)), locClass(String(b.endLocation)),
        "|", floatMode(r), locClass(String(r.startLocation)), locClass(String(r.endLocation)),
      ].join(" ");
      buckets.set(shape, (buckets.get(shape) ?? 0) + 1);
      if (!samples.has(shape)) {
        const pf = (m: AnyRec): string =>
          `pf:${m.prefloatMotionType ?? "∅"}/${m.prefloatRotationDirection ?? "∅"}`;
        samples.set(
          shape,
          `${code} beat ${i}: ${sig} | blue ${pf(b)} rot ${b.rotationDirection} | red ${pf(r)} rot ${r.rotationDirection}`
        );
      }
    }
  }
  console.log(`codes ${codes.length}, underivable beats ${failing}`);
  const sorted = [...buckets.entries()].sort((a, b2) => b2[1] - a[1]);
  for (const [shape, n] of sorted) {
    console.log(`\n  ×${n}  ${shape}\n      e.g. ${samples.get(shape)}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
