/**
 * Repair docs whose createdAt/updatedAt/birthday were written as literal
 * { _methodName: "serverTimestamp" } objects or whose Timestamp instances were
 * flattened into { _seconds, _nanoseconds } maps by a deep-clean pass.
 *
 * Recovery per corrupt field:
 *   1. A flattened timestamp map keeps its exact seconds and nanoseconds.
 *   2. Otherwise use the 13-digit epoch embedded in a `seq_<ms>_…` id.
 *   3. Else use the earliest non-corrupt sibling timestamp on the same doc.
 *   4. Else Timestamp.now() — last resort, reported separately.
 * updatedAt recovers to the LATEST known time; createdAt/birthday to the base.
 * Only corrupt fields are written; good fields are left untouched.
 *
 *   npx tsx scripts/migrations/repair-timestamp-corruption.ts            # dry-run
 *   npx tsx scripts/migrations/repair-timestamp-corruption.ts --apply
 *   npx tsx scripts/migrations/repair-timestamp-corruption.ts --public-only
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;
const DEFAULT_USER = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const PUBLIC_ONLY = argv.includes("--public-only");
const userId = (() => {
  const i = argv.indexOf("--user");
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : DEFAULT_USER;
})();

const FIELDS = ["birthday", "createdAt", "updatedAt"] as const;

function isSentinel(v: unknown): boolean {
  return !!v && typeof v === "object" && "_methodName" in (v as AnyRec);
}
function isSerializedTimestamp(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const o = v as AnyRec;
  const seconds = o["_seconds"] ?? o["seconds"];
  const nanoseconds = o["_nanoseconds"] ?? o["nanoseconds"];
  return (
    typeof seconds === "number" &&
    typeof nanoseconds === "number" &&
    typeof o["toDate"] !== "function" &&
    typeof o["toMillis"] !== "function"
  );
}
function isCorruptTimestamp(v: unknown): boolean {
  return isSentinel(v) || isSerializedTimestamp(v);
}
function toMillis(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  const o = v as AnyRec;
  if (typeof o["toMillis"] === "function") return (o["toMillis"] as () => number)();
  const seconds = o["seconds"] ?? o["_seconds"];
  const nanoseconds = o["nanoseconds"] ?? o["_nanoseconds"] ?? 0;
  if (typeof seconds === "number" && typeof nanoseconds === "number") {
    return seconds * 1000 + nanoseconds / 1_000_000;
  }
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
    const corrupt = FIELDS.filter((f) => isCorruptTimestamp(data[f]));
    if (!corrupt.length) continue;

    const realMs = FIELDS.map((f) => toMillis(data[f])).filter((n): n is number => n != null);
    const seqMs = seqMsFromId(d.id);
    const baseMs = seqMs ?? (realMs.length ? Math.min(...realMs) : null);
    const latestMs = realMs.length ? Math.max(...realMs) : baseMs;

    const updates: AnyRec = {};
    let usedNow = false;
    for (const f of corrupt) {
      // A flattened Timestamp still contains the exact instant. Prefer that
      // over sequence-id inference so a publication migration cannot rewrite a
      // real birthday to a nearby creation timestamp.
      const serializedMs = isSerializedTimestamp(data[f])
        ? toMillis(data[f])
        : null;
      const ms =
        serializedMs ?? (f === "updatedAt" ? (latestMs ?? baseMs) : baseMs);
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
  if (!PUBLIC_ONLY) {
    await repair(db, Timestamp, "user library", `users/${userId}/sequences`);
  }
  await repair(db, Timestamp, "public mirror", "publicSequences");
  if (!APPLY) console.log(`\nRe-run with --apply to write.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
