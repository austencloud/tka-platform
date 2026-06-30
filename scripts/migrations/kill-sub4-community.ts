/**
 * One-shot: remove specific sub-4-step sequences from the community gallery
 * (publicSequences) and downgrade each owner's source doc to private so it stays
 * consistent and won't re-publish. Keeps the owner's private copy (policy: any
 * length allowed in your own library, 4-step minimum only for the community).
 *
 * Cross-owner writes → requires the Admin SDK:
 *   TKA_ADMIN=1 npx tsx scripts/migrations/kill-sub4-community.ts           # dry-run
 *   TKA_ADMIN=1 npx tsx scripts/migrations/kill-sub4-community.ts --apply
 */
import { initFirestore } from "../lib/firestore-provider.js";

type AnyRec = Record<string, unknown>;
const APPLY = process.argv.slice(2).includes("--apply");

// The two offenders surfaced by scripts/diagnostics/audit-community-min-length.ts
const IDS = [
  "seq_1778555437610_4uq90nqe5", // "E"  (1 step)  — Paul Langton
  "seq_1773172546683_zuqsv5jdt", // "FJ" (2 steps) — Kevin Rabinowitz
];

async function main(): Promise<void> {
  const { db, FieldValue, sdk, isAdmin } = (await initFirestore()) as AnyRec & { db: AnyRec };
  console.log(`via ${sdk} (admin=${isAdmin}) — ${APPLY ? "APPLY" : "DRY-RUN"}`);
  if (!isAdmin) {
    console.error("Refusing: cross-owner writes need the Admin SDK. Re-run with TKA_ADMIN=1.");
    process.exit(1);
  }

  let removed = 0, downgraded = 0, missing = 0, failed = 0;
  for (const id of IDS) {
    const pubRef = (db.collection as (p: string) => AnyRec)("publicSequences")["doc"](id);
    const pubSnap = await (pubRef as AnyRec)["get"]();
    const pub = (pubSnap as AnyRec)["exists"] ? (pubSnap as AnyRec)["data"]() as AnyRec : null;
    if (!pub) {
      missing++;
      console.log(`  ⚠️  ${id} — not in publicSequences (already gone)`);
    } else {
      const word = (pub["word"] as string) ?? (pub["name"] as string) ?? "(unnamed)";
      const owner = (pub["ownerId"] as string) ?? "";
      console.log(`  ${APPLY ? "DELETE" : "would-delete"}  public "${word}"  owner=${owner}  [${id}]`);
      if (APPLY) {
        try {
          await (pubRef as AnyRec)["delete"]();
          removed++;
          // Downgrade the source doc so it's not marked public-but-unmirrored.
          if (owner) {
            const srcRef = (db.doc as (p: string) => AnyRec)(`users/${owner}/sequences/${id}`);
            const srcSnap = await (srcRef as AnyRec)["get"]();
            if ((srcSnap as AnyRec)["exists"]) {
              await (srcRef as AnyRec)["update"]({
                visibility: "private",
                visibilityChangedAt: (FieldValue as AnyRec)["serverTimestamp"](),
              });
              downgraded++;
              console.log(`         source → private  [users/${owner}/sequences/${id}]`);
            } else {
              console.log(`         source doc absent — nothing to downgrade`);
            }
          }
        } catch (e) {
          failed++;
          console.log(`         failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  }

  console.log(`\n${APPLY ? "removed" : "would-remove"}=${removed} downgraded=${downgraded} missing=${missing} failed=${failed}`);
  if (!APPLY) console.log("Re-run with --apply to delete.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
