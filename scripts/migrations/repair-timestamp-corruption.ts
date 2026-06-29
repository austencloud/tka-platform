/**
 * Repair docs whose createdAt/updatedAt/birthday were written as literal
 * { _methodName: "serverTimestamp" } objects instead of real Timestamps (the
 * stripUndefined-mangles-sentinel bug, now guarded at source).
 *
 * Recovery per corrupt field:
 *   1. The 13-digit epoch embedded in a `seq_<ms>_…` id (creation time).
 *   2. Else the earliest non-corrupt sibling timestamp on the same doc.
 *   3. Else Timestamp.now() — last resort, reported separately.
 * updatedAt recovers to the LATEST known time; createdAt/birthday to the base.
 * Only corrupt fields are written; good fields are left untouched.
 *
 *   npx tsx scripts/migrations/repair-timestamp-corruption.ts            # dry-run
 *   npx tsx scripts/migrations/repair-timestamp-corruption.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();

const FIELDS = ["birthday", "createdAt", "updatedAt"] as const;

function isSentinel(v: unknown): boolean {
  return !!v && typeof v === "object" && "_methodName" in (v as AnyRec);
}
function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  const o = v as AnyRec;
  if (typeof o["toMillis"] === "function") return (o["toMillis"] as () => number)();
  if (typeof o["seconds"] === "number") return (o["seconds"] as number) * 1000;
  if (typeof o["_seconds"] === "number") return (o["_seconds"] as number) * 1000;
  return null;
}
function seqMsFromId(id: string): number | null {
  const m = id.match(/^seq_(\d{13})_/);
  return m ? Number(m[1]) : null;
}

async function repair(
  db: AnyRec,
  Timestamp: AnyRec,
  label: string,
  path: string
): Promise<void> {
  const snap = await (db.collection as (p: string) => AnyRec)(path)["get"]();
  let scanned = 0, repaired = 0, nowFallback = 0, failed = 0;
  console.log(`\n──────── ${label} (${path}) ────────`);
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec; ref: AnyRec }>)) {
    scanned++;
    const data = d.data();
    const corrupt = FIELDS.filter((f) => isSentinel(data[f]));
    if (!corrupt.length) continue;

    const realMs = FIELDS.map((f) => toMillis(data[f])).filter((n): n is number => n != null);
    const seqMs = seqMsFromId(d.id);
    const baseMs = seqMs ?? (realMs.length ? Math.min(...realMs) : null);
    const latestMs = realMs.length ? Math.max(...realMs) : baseMs;

    const updates: AnyRec = {};
    let usedNow = false;
    for (const f of corrupt) {
      const ms = f === "updatedAt" ? (latestMs ?? baseMs) : baseMs;
      if (ms == null) {
        updates[f] = (Timestamp["now"] as () => unknown)();
        usedNow = true;
      } else {
        updates[f] = (Timestamp["fromMillis"] as (m: number) => unknown)(ms);
      }
    }
    if (usedNow) nowFallback++;

    const when = baseMs ? new Date(baseMs).toISOString().slice(0, 10) : "NOW";
    if (APPLY) {
      try {
        await (d.ref as AnyRec)["update"](updates);
      } catch (e) {
        failed++;
        console.log(`  ❌ "${data["word"] ?? ""}" ${d.id} — write failed: ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
    }
    console.log(`  ${APPLY ? "✅" : "·"} "${data["word"] ?? ""}" ${d.id} fix=[${corrupt.join(",")}] → ${when}${usedNow ? " (NOW fallback)" : ""}`);
    repaired++;
  }
  console.log(`  scanned=${scanned} ${APPLY ? "repaired" : "would-repair"}=${repaired} now-fallback=${nowFallback} failed=${failed}`);
}

async function main(): Promise<void> {
  const { db, Timestamp, sdk } = (await initFirestore()) as AnyRec & { db: AnyRec; Timestamp: AnyRec };
  console.log(`via ${sdk} — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  await repair(db, Timestamp, "user library", `users/${userId}/sequences`);
  await repair(db, Timestamp, "public mirror", "publicSequences");
  if (!APPLY) console.log(`\nRe-run with --apply to write.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
