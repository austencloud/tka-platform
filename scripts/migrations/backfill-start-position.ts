/**
 * Backfill the `startPosition` field onto sequence docs that were saved
 * compositionally WITHOUT it (newer LOOP/generator saves). The runtime already
 * reconstructs startPosition at load via hydrate(), but the persisted doc and
 * its public mirror lack it — so stale cached thumbnails and the community
 * gallery render an empty start cell. This writes the SAME startPosition the
 * runtime derives, making storage self-sufficient.
 *
 * Reuses the app's own hydrate() — no hand-rolled derivation.
 *
 * Safety:
 *   - Dry-run by default. --apply to write.
 *   - Only touches docs that LACK a renderable startPosition (no motions).
 *   - Skips a doc if hydrate can't produce a valid startPosition.
 *
 * Usage:
 *   npx tsx scripts/migrations/backfill-start-position.ts            # dry-run, user library + public mirror
 *   npx tsx scripts/migrations/backfill-start-position.ts --apply
 *   npx tsx scripts/migrations/backfill-start-position.ts --user <uid> --apply
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

/** Recursively drop undefined (Firestore rejects it). Local copy — app helper imports auth. */
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

function hasRenderableStartPosition(data: AnyRec): boolean {
  const sp = data["startPosition"] as AnyRec | undefined;
  const m = sp?.["motions"] as AnyRec | undefined;
  return !!m && Object.keys(m).length > 0;
}

/** Returns the derived startPosition, or null if it can't be reconstructed. */
function deriveStartPosition(docId: string, data: AnyRec): AnyRec | null {
  try {
    const hydrated = hydrate({ ...(data as object), id: docId } as SequenceData) as AnyRec;
    const sp = hydrated["startPosition"] as AnyRec | undefined;
    const m = sp?.["motions"] as AnyRec | undefined;
    if (sp && m && Object.keys(m).length > 0) return sp;
    return null;
  } catch {
    return null;
  }
}

async function processCollection(
  db: AnyRec,
  label: string,
  path: string
): Promise<{ scanned: number; needed: number; fixed: number; failed: number }> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let scanned = 0, needed = 0, fixed = 0, failed = 0;
  console.log(`\n──────── ${label} (${path}) ────────`);
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    scanned++;
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    if (hasRenderableStartPosition(data)) continue;
    needed++;
    const sp = deriveStartPosition(d.id, data);
    const word = (data["word"] as string) ?? (data["name"] as string) ?? d.id;
    if (!sp) {
      failed++;
      console.log(`  ⚠️  "${word}" ${d.id} — hydrate could not derive startPosition (SKIP)`);
      continue;
    }
    const m = sp["motions"] as AnyRec;
    const blue = (m["blue"] as AnyRec)?.["startLocation"];
    const red = (m["red"] as AnyRec)?.["startLocation"];
    if (APPLY) {
      try {
        await (d.ref as AnyRec)["update"]({ startPosition: stripUndefined(sp) });
      } catch (err) {
        failed++;
        console.log(`  ❌ "${word}" ${d.id} — write failed: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
    }
    console.log(`  ${APPLY ? "✅" : "·"} "${word}" ${d.id} → blue@${blue} red@${red} letter=${JSON.stringify(sp["letter"])}`);
    fixed++;
  }
  console.log(`  scanned=${scanned} needs-start-pos=${needed} ${APPLY ? "written" : "would-write"}=${fixed} unfixable=${failed}`);
  return { scanned, needed, fixed, failed };
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`Firestore via ${sdk} (admin=${isAdmin}) — user ${userId}`);
  console.log(APPLY ? "MODE: APPLY (writing)" : "MODE: DRY-RUN (no writes)");

  const lib = await processCollection(db, "user library", `users/${userId}/sequences`);
  const pub = await processCollection(db, "public mirror", "publicSequences");

  console.log(`\n──────── summary ────────`);
  console.log(`library:  needed=${lib.needed} ${APPLY ? "fixed" : "would-fix"}=${lib.fixed} unfixable=${lib.failed}`);
  console.log(`public:   needed=${pub.needed} ${APPLY ? "fixed" : "would-fix"}=${pub.fixed} unfixable=${pub.failed}`);
  if (!APPLY) console.log(`\nRe-run with --apply to write. (Public-mirror writes need owner/admin on each doc.)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
