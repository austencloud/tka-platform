/**
 * Backfill two fields absent on older-format sequence docs (2026-06-29 audit):
 *   - contentHash: computed via the app's own computeHash() over hydrated steps.
 *   - gridMode: inferred from the step locations (box if any intercardinal
 *     location appears, else diamond) — never blindly defaulted.
 * Only writes the fields that are missing.
 *
 *   npx tsx scripts/migrations/backfill-contenthash-gridmode.ts            # dry-run
 *   npx tsx scripts/migrations/backfill-contenthash-gridmode.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";
import { hydrate } from "../../src/lib/shared/foundation/services/sequence-hydrator";
import {
  computeHash,
  CONTENT_HASH_VERSION,
} from "../../src/lib/shared/library/services/sequence-content-hasher";
import type { SequenceData } from "../../src/lib/shared/foundation/domain/models/sequence-data";

// computeHash uses crypto.subtle — guard for older Node runtimes.
if (!(globalThis as { crypto?: { subtle?: unknown } }).crypto?.subtle) {
  const { webcrypto } = await import("node:crypto");
  (globalThis as { crypto?: unknown }).crypto = webcrypto;
}

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();

const CARDINAL = new Set(["n", "e", "s", "w", "north", "east", "south", "west"]);

function inferGridMode(seq: SequenceData): "diamond" | "box" {
  for (const step of seq.steps ?? []) {
    const m = (step as AnyRec)["motions"] as AnyRec | undefined;
    for (const color of ["blue", "red"]) {
      const motion = m?.[color] as AnyRec | undefined;
      for (const loc of [motion?.["startLocation"], motion?.["endLocation"]]) {
        if (loc && !CARDINAL.has(String(loc).toLowerCase())) return "box";
      }
    }
  }
  return "diamond";
}

async function processCollection(db: AnyRec, label: string, path: string): Promise<void> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let scanned = 0, hashWrites = 0, gridWrites = 0, failed = 0, box = 0;
  console.log(`\n──────── ${label} (${path}) ────────`);
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    scanned++;
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    const needHash = !data["contentHash"];
    const needGrid = !data["gridMode"];
    if (!needHash && !needGrid) continue;

    let hydrated: SequenceData;
    try { hydrated = hydrate({ ...(data as object), id: d.id } as SequenceData) as SequenceData; }
    catch { continue; }
    if (!hydrated.steps || hydrated.steps.length === 0) continue;

    const updates: AnyRec = {};
    if (needHash) {
      try {
        updates["contentHash"] = await computeHash(hydrated);
        updates["contentHashVersion"] = CONTENT_HASH_VERSION;
      } catch { /* */ }
    }
    if (needGrid) {
      const gm = inferGridMode(hydrated);
      updates["gridMode"] = gm;
      if (gm === "box") box++;
    }
    if (Object.keys(updates).length === 0) continue;

    if (APPLY) {
      try { await (d.ref as AnyRec)["update"](updates); }
      catch (e) { failed++; if (!String(e).includes("PERMISSION_DENIED")) console.log(`  ❌ ${d.id} ${e instanceof Error ? e.message : e}`); continue; }
    }
    if ("contentHash" in updates) hashWrites++;
    if ("gridMode" in updates) gridWrites++;
  }
  console.log(`  scanned=${scanned} ${APPLY ? "" : "would: "}contentHash=${hashWrites} gridMode=${gridWrites} (box=${box}) failed=${failed}`);
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
