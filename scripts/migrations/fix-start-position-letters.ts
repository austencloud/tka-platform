/**
 * Re-derive startPosition for sequence docs whose stored start cell carries the
 * WRONG glyph — the first step's letter (U/B/V…) instead of the start POSITION
 * (alpha/beta/gamma). Earlier saves (and the first startPosition backfill) wrote
 * letter = firstStep.letter; the renderer trusts a start position that has
 * motions, so it rendered the wrong glyph.
 *
 * Recomputes the correct start position by stripping the stored one and running
 * the (now-fixed) hydrate(), which derives the position from the first step's
 * blue+red start locations. Overwrites only when the stored letter differs from
 * the derived alpha/beta/gamma — already-correct docs are skipped.
 *
 *   npx tsx scripts/migrations/fix-start-position-letters.ts            # dry-run
 *   npx tsx scripts/migrations/fix-start-position-letters.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();

const POSITION_LETTERS = new Set(["α", "β", "γ"]);

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      out[k] = stripUndefined(v as Record<string, unknown>);
    } else if (Array.isArray(v)) {
      out[k] = v.map((it) =>
        it !== null && typeof it === "object" && !Array.isArray(it)
          ? stripUndefined(it as Record<string, unknown>)
          : it
      );
    } else out[k] = v;
  }
  return out as T;
}

/** Force re-derivation: strip the stored startPosition, then hydrate. */
function deriveCorrect(docId: string, data: AnyRec): AnyRec | null {
  try {
    const h = hydrate({ ...(data as object), id: docId, startPosition: undefined } as SequenceData) as AnyRec;
    const sp = h["startPosition"] as AnyRec | undefined;
    const m = sp?.["motions"] as AnyRec | undefined;
    if (sp && m && Object.keys(m).length > 0) return sp;
    return null;
  } catch {
    return null;
  }
}

async function processCollection(db: AnyRec, label: string, path: string): Promise<void> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let scanned = 0, relabeled = 0, filled = 0, ok = 0, unfixable = 0, failed = 0;
  console.log(`\n──────── ${label} (${path}) ────────`);
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    scanned++;
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    if (!Array.isArray(data["stepPairings"]) || (data["stepPairings"] as unknown[]).length === 0) continue;

    const correct = deriveCorrect(d.id, data);
    const existing = data["startPosition"] as AnyRec | undefined;
    const existingLetter = existing?.["letter"];
    const correctLetter = correct?.["letter"];

    if (!correct) {
      // Only count as unfixable if it also currently lacks a good glyph.
      if (!existing || !POSITION_LETTERS.has(String(existingLetter))) unfixable++;
      continue;
    }
    if (existing && existingLetter === correctLetter && POSITION_LETTERS.has(String(existingLetter))) {
      ok++;
      continue;
    }

    const word = (data["word"] as string) ?? (data["name"] as string) ?? d.id;
    const wasMissing = !existing?.["motions"];
    if (APPLY) {
      try {
        await (d.ref as AnyRec)["update"]({ startPosition: stripUndefined(correct) });
      } catch (err) {
        failed++;
        console.log(`  ❌ "${word}" ${d.id} — ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
    }
    if (wasMissing) filled++; else relabeled++;
    console.log(`  ${APPLY ? "✅" : "·"} "${word}" ${d.id}  ${JSON.stringify(existingLetter)} → ${JSON.stringify(correctLetter)}`);
  }
  console.log(`  scanned=${scanned} already-ok=${ok} ${APPLY ? "relabeled" : "would-relabel"}=${relabeled} filled=${filled} unfixable=${unfixable} failed=${failed}`);
}

async function main(): Promise<void> {
  const { db, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  await processCollection(db, "user library", `users/${userId}/sequences`);
  await processCollection(db, "public mirror", "publicSequences");
  if (!APPLY) console.log(`\nRe-run with --apply to write.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
