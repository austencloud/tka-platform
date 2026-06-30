/**
 * Read-only audit: list sequences in the community gallery (publicSequences)
 * that fall under the 4-step minimum. Reports id / word / step-count only —
 * deletes nothing. Austen purges manually (right-click remove) or approves a
 * one-shot.
 *
 *   npx tsx scripts/diagnostics/audit-community-min-length.ts
 *   TKA_ADMIN=1 npx tsx scripts/diagnostics/audit-community-min-length.ts   # admin read (all owners)
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;
const MIN_COMMUNITY_STEPS = 4;
const PATH = "publicSequences";

/** Persisted step count: stepPairings is source of truth, then steps, then sequenceLength. */
function stepCount(data: AnyRec): number {
  const sp = data["stepPairings"];
  if (Array.isArray(sp)) return sp.length;
  const steps = data["steps"];
  if (Array.isArray(steps) && steps.length > 0) return steps.length;
  return (data["sequenceLength"] as number) ?? 0;
}

async function main(): Promise<void> {
  const { db, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} (admin=${isAdmin}) — read-only — ${PATH}`);
  const snap = await (db.collection as (p: string) => AnyRec)(PATH)["get"]();

  const offenders: Array<{ id: string; word: string; owner: string; steps: number }> = [];
  let scanned = 0;
  for (const d of (snap.docs as Array<{ id: string; data: () => AnyRec }>)) {
    const data = d.data();
    if (data["isDeleted"] === true) continue;
    scanned++;
    const n = stepCount(data);
    if (n < MIN_COMMUNITY_STEPS) {
      offenders.push({
        id: d.id,
        word: (data["word"] as string) ?? (data["name"] as string) ?? "(unnamed)",
        owner: (data["ownerDisplayName"] as string) ?? (data["ownerId"] as string) ?? "(unknown)",
        steps: n,
      });
    }
  }

  offenders.sort((a, b) => a.steps - b.steps || a.word.localeCompare(b.word));
  console.log(`\nscanned ${scanned} public docs — ${offenders.length} under ${MIN_COMMUNITY_STEPS} steps\n`);
  for (const o of offenders) {
    console.log(`  ${o.steps} step${o.steps === 1 ? "" : "s"}  "${o.word}"  by ${o.owner}  [${o.id}]`);
  }
  if (offenders.length === 0) console.log("  ✅ none — community gallery is clean");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
