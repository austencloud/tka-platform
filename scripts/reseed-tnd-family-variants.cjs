/**
 * One-time migration: rebuild the `families` array on TnD reversal variant
 * catalogs that were seeded with a single collapsed { id: "unknown" } family.
 *
 * Reversal preserves hand-path family membership and sequence ids, so the
 * correct families array is exactly the base continuous catalog's. We copy it.
 *
 * Usage:
 *   node scripts/reseed-tnd-family-variants.cjs            # apply
 *   node scripts/reseed-tnd-family-variants.cjs --dry-run  # preview only
 */
const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
let db;
try {
  const serviceAccount = require(serviceAccountPath);
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const SIX_FAMILY_IDS = ["split-same", "tog-same", "quarter-same", "split-opp", "tog-opp", "quarter-opp"];
// Longest-first: "-red-book" must be tested before "-book" or it strips to "...-red".
const PATTERN_SUFFIXES = ["red-book", "blue-book", "long-book", "alternating", "book"];

function hasSixFamilies(families) {
  if (!Array.isArray(families)) return false;
  const ids = new Set(families.map((f) => f.id));
  return SIX_FAMILY_IDS.every((id) => ids.has(id));
}

// The correct base is the SAME-turn-ratio continuous catalog: strip the pattern
// suffix from the variant id. sourceDeck is unreliable — on most variants it
// points at the original enumeration root (l1-vtg-motions), not the ratio base.
function resolveBaseId(doc) {
  for (const suffix of PATTERN_SUFFIXES) {
    if (doc.id.endsWith(`-${suffix}`)) return doc.id.slice(0, -(suffix.length + 1));
  }
  return null;
}

function seqIdSet(families) {
  return new Set((families ?? []).flatMap((f) => f.sequenceIds ?? []));
}

function setsEqual(a, b) {
  return a.size === b.size && [...a].every((v) => b.has(v));
}

async function main() {
  const snap = await db.collection("decks").where("collection", "==", "TnD").get();
  const byId = new Map();
  snap.forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));

  const broken = [...byId.values()].filter(
    (c) => c.asymmetric !== true && !hasSixFamilies(c.families),
  );

  let rewritten = 0, skipped = 0;
  for (const doc of broken) {
    const baseId = resolveBaseId(doc);
    const base = baseId ? byId.get(baseId) : null;
    if (!base || !hasSixFamilies(base.families)) {
      console.warn(`SKIP ${doc.id}: no same-ratio base with six families (baseId=${baseId})`);
      skipped++;
      continue;
    }
    // Integrity guard: the variant's existing seq ids must match the base's,
    // or copying base.families would point at non-existent sequence docs.
    if (!setsEqual(seqIdSet(doc.families), seqIdSet(base.families))) {
      console.warn(`SKIP ${doc.id}: seq-id set differs from base ${baseId} — not safe to copy families`);
      skipped++;
      continue;
    }
    console.log(`${doc.id}: ${(doc.families ?? []).map((f) => f.id).join(",")} -> 6 families (from ${baseId})`);
    if (!DRY_RUN) {
      await db.collection("decks").doc(doc.id).update({ families: base.families });
    }
    rewritten++;
  }
  console.log(`\n${DRY_RUN ? "[dry-run] would rewrite" : "rewrote"} ${rewritten}, skipped ${skipped}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
