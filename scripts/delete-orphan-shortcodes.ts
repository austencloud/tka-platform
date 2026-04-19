#!/usr/bin/env tsx
/**
 * Delete shortcode docs that have no recoverable source data.
 *
 * "Orphan" = a shortcode that:
 *   - Has no `encoded` field (inline blob), AND
 *   - Has no usable `sequenceData` (inline step data), AND
 *   - Its `users/{ownerId}/sequences/{sequenceId}` source doc doesn't exist
 *     (or there's no ownerId), AND
 *   - Its `sequenceId` isn't present in the publicSequences index by id, AND
 *   - Its `sequence` (word) isn't present in the publicSequences index by word
 *
 * These codes can't be resolved — the underlying sequence is gone.
 *
 * Runs idempotently. Safe to re-run. Dry-run by default.
 *
 * Usage:
 *   npx tsx scripts/delete-orphan-shortcodes.ts           (dry run, writes
 *                                                          orphan list to file)
 *   npx tsx scripts/delete-orphan-shortcodes.ts --confirm (actually delete)
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Firebase Admin bootstrap
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const dryRun = !process.argv.includes("--confirm");
const BATCH_SIZE = 500;
const OUTPUT_FILE = path.join(__dirname, "..", "static", "data", "snapshots", "orphan-shortcodes.json");

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------

interface ShortCodeDoc {
  sequence?: string;
  sequenceId?: string;
  ownerId?: string;
  sequenceData?: Record<string, unknown>;
  encoded?: string;
}

interface OrphanRecord {
  code: string;
  word: string | null;
  sequenceId: string | null;
  ownerId: string | null;
  category: "no-encoded-no-owner" | "user-owned-deleted" | "public-orphan";
}

const publicByWord = new Set<string>();
const publicById = new Set<string>();

async function prefetchPublicIndex(): Promise<void> {
  console.log("Prefetching publicSequences index...");
  const pubSnap = await db.collection("publicSequences").get();
  for (const d of pubSnap.docs) {
    const data = d.data();
    if (data.word) publicByWord.add(data.word);
    if (data.name) publicByWord.add(data.name);
    publicById.add(d.id);
    if (data.id) publicById.add(data.id);
  }
  console.log(`  loaded ${pubSnap.docs.length} public sequences\n`);
}

async function findOrphans(): Promise<OrphanRecord[]> {
  const orphans: OrphanRecord[] = [];
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let total = 0;
  let alreadyEncoded = 0;
  let hydratablePublic = 0;

  while (true) {
    let q = db.collection("shortcodes").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const d of snap.docs) {
      total++;
      const data = d.data() as ShortCodeDoc;

      if (typeof data.encoded === "string" && data.encoded.length > 0) {
        alreadyEncoded++;
        continue;
      }
      if (data.sequenceData && Array.isArray((data.sequenceData as any).steps)) {
        alreadyEncoded++;
        continue;
      }
      if (
        (data.sequenceId && publicById.has(data.sequenceId)) ||
        (data.sequence && publicByWord.has(data.sequence))
      ) {
        hydratablePublic++;
        continue;
      }

      // Classify by origin
      let category: OrphanRecord["category"];
      if (data.ownerId && data.sequenceId) {
        // Need to probe Firestore to know if source exists; we did that in the
        // backfill script. Here we assume if ownerId+sequenceId are present
        // but nothing matched above, the user doc is likely gone. Mark
        // conservatively — we'll still probe below.
        category = "user-owned-deleted";
      } else if (data.sequenceId && data.sequenceId.includes("-") && !data.ownerId) {
        // Dashed sequenceId without ownerId = deck-era orphan (quartered-loop deck)
        category = "public-orphan";
      } else {
        category = "no-encoded-no-owner";
      }

      orphans.push({
        code: d.id,
        word: data.sequence ?? null,
        sequenceId: data.sequenceId ?? null,
        ownerId: data.ownerId ?? null,
        category,
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(`Scan summary:`);
  console.log(`  Total scanned       : ${total}`);
  console.log(`  Already resolvable  : ${alreadyEncoded + hydratablePublic}`);
  console.log(`  Orphans (to delete) : ${orphans.length}`);

  const byCategory = orphans.reduce<Record<string, number>>((acc, o) => {
    acc[o.category] = (acc[o.category] || 0) + 1;
    return acc;
  }, {});
  console.log(`  By category:`);
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`    ${cat.padEnd(24)}: ${count}`);
  }
  console.log();

  return orphans;
}

async function verifyUserOrphans(orphans: OrphanRecord[]): Promise<OrphanRecord[]> {
  // For each user-owned candidate, probe Firestore to confirm the source
  // sequence is actually gone. Keep only the confirmed ones.
  const toProbe = orphans.filter(o => o.category === "user-owned-deleted");
  console.log(`Probing ${toProbe.length} user-owned candidates for missing source docs...`);

  const verified: OrphanRecord[] = [];
  const CONCURRENCY = 20;
  let done = 0;

  async function worker(start: number): Promise<void> {
    for (let i = start; i < toProbe.length; i += CONCURRENCY) {
      const o = toProbe[i]!;
      try {
        const ref = db.doc(`users/${o.ownerId}/sequences/${o.sequenceId}`);
        const snap = await ref.get();
        if (!snap.exists) verified.push(o);
      } catch {
        // Treat probe failure as "unverified — leave alone"
      }
      done++;
      if (done % 200 === 0) console.log(`  probed ${done}/${toProbe.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  console.log(`  verified ${verified.length}/${toProbe.length} are missing source docs\n`);

  // Combine: non-user orphans (no probe needed) + verified user orphans
  const nonUser = orphans.filter(o => o.category !== "user-owned-deleted");
  return [...nonUser, ...verified];
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

async function deleteOrphans(orphans: OrphanRecord[]): Promise<void> {
  let batch = db.batch();
  let batchCount = 0;
  let totalDeleted = 0;

  for (const o of orphans) {
    batch.delete(db.collection("shortcodes").doc(o.code));
    batchCount++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      totalDeleted += batchCount;
      console.log(`  committed batch: ${totalDeleted} deleted so far`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    totalDeleted += batchCount;
  }

  console.log(`  total deleted: ${totalDeleted}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(dryRun ? "=== DRY RUN (pass --confirm to delete) ===\n" : "=== LIVE DELETE ===\n");

  await prefetchPublicIndex();
  const candidates = await findOrphans();
  const verified = await verifyUserOrphans(candidates);

  // Write list to disk regardless of mode — audit trail
  writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        totalOrphans: verified.length,
        byCategory: verified.reduce<Record<string, number>>((acc, o) => {
          acc[o.category] = (acc[o.category] || 0) + 1;
          return acc;
        }, {}),
        orphans: verified,
      },
      null,
      2
    )
  );
  console.log(`Wrote orphan list: ${OUTPUT_FILE}`);
  console.log();

  if (dryRun) {
    console.log(`DRY RUN — no docs deleted. Re-run with --confirm to actually delete ${verified.length} docs.`);
    process.exit(0);
  }

  console.log(`Deleting ${verified.length} orphan shortcodes...`);
  await deleteOrphans(verified);
  console.log(`\nDone.`);
  process.exit(0);
}

main().catch(err => {
  console.error("Delete failed:", err);
  process.exit(1);
});
