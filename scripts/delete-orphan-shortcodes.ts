#!/usr/bin/env tsx
/**
 * Delete shortcode docs that have no self-contained recoverable payload.
 *
 * Durability invariant (matches firestore.rules): a shortcode is durable if
 * and only if it carries either:
 *   - A non-empty `encoded` field (self-contained "s~..." blob), OR
 *   - A non-empty `sequenceData.steps` array (embedded inline)
 *
 * Everything else is a zombie. publicSequences matches don't save a
 * shortcode — publicSequences carries metadata only (no steps), so a resolver
 * hit against it still requires the sequence to exist in a user or deck
 * collection. That external state is mutable and has failed us before — see
 * docs/superpowers/specs/2026-04-18-shortcode-durability-roadmap.md.
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
  category:
    | "no-encoded-no-owner"
    | "user-owned-no-payload"
    | "public-orphan-no-payload";
}

async function findOrphans(): Promise<OrphanRecord[]> {
  const orphans: OrphanRecord[] = [];
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let total = 0;
  let durable = 0;

  while (true) {
    let q = db.collection("shortcodes").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const d of snap.docs) {
      total++;
      const data = d.data() as ShortCodeDoc;

      const hasEncoded = typeof data.encoded === "string" && data.encoded.length > 0;
      const stepsArr = data.sequenceData && Array.isArray((data.sequenceData as any).steps)
        ? ((data.sequenceData as any).steps as unknown[])
        : null;
      const hasInlineSteps = stepsArr != null && stepsArr.length > 0;

      // Durability invariant: carries its own payload. Keep it.
      if (hasEncoded || hasInlineSteps) {
        durable++;
        continue;
      }

      // Everything else is a zombie. publicSequences hits don't save it —
      // that collection holds metadata only, and the actual sequence data
      // lives in mutable user/deck collections that have been the source of
      // every orphan wave so far.
      let category: OrphanRecord["category"];
      if (data.ownerId && data.sequenceId) {
        category = "user-owned-no-payload";
      } else if (data.sequenceId) {
        category = "public-orphan-no-payload";
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
  console.log(`  Durable (kept)      : ${durable}`);
  console.log(`  Zombies (to delete) : ${orphans.length}`);

  const byCategory = orphans.reduce<Record<string, number>>((acc, o) => {
    acc[o.category] = (acc[o.category] || 0) + 1;
    return acc;
  }, {});
  console.log(`  By category:`);
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`    ${cat.padEnd(28)}: ${count}`);
  }
  console.log();

  return orphans;
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

  const orphans = await findOrphans();

  // Write list to disk regardless of mode — audit trail
  writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dryRun,
        totalOrphans: orphans.length,
        byCategory: orphans.reduce<Record<string, number>>((acc, o) => {
          acc[o.category] = (acc[o.category] || 0) + 1;
          return acc;
        }, {}),
        orphans,
      },
      null,
      2
    )
  );
  console.log(`Wrote orphan list: ${OUTPUT_FILE}`);
  console.log();

  if (dryRun) {
    console.log(`DRY RUN — no docs deleted. Re-run with --confirm to actually delete ${orphans.length} docs.`);
    process.exit(0);
  }

  console.log(`Deleting ${orphans.length} orphan shortcodes...`);
  await deleteOrphans(orphans);
  console.log(`\nDone.`);
  process.exit(0);
}

main().catch(err => {
  console.error("Delete failed:", err);
  process.exit(1);
});
