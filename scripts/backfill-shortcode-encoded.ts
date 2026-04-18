#!/usr/bin/env tsx
/**
 * Backfill the `encoded` field on every shortcode doc that lacks one.
 *
 * For each shortcode in Firestore:
 *   1. Skip if `encoded` already present
 *   2. Reconstruct SequenceData (from inline `sequenceData` if present,
 *      or from public-index lookup via `sequenceId`/`sequence`)
 *   3. Call SequenceEncoder.encodeForQR() to produce the "s~..." blob
 *   4. updateDoc with the new field
 *
 * Runs idempotently. Safe to re-run. Dry-run by default.
 *
 * Usage:
 *   npx tsx scripts/backfill-shortcode-encoded.ts              (dry run)
 *   npx tsx scripts/backfill-shortcode-encoded.ts --confirm    (write)
 *   npx tsx scripts/backfill-shortcode-encoded.ts --limit=100  (cap for testing)
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { SequenceEncoder } from "../src/lib/shared/navigation/services/implementations/SequenceEncoder";
import type { SequenceData } from "../src/lib/shared/foundation/domain/models/SequenceData";

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
const includeDecks = !process.argv.includes("--no-decks");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]!, 10) : Infinity;
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Encoder — constructed directly. The encoder has no DI deps for encode-only use.
// ---------------------------------------------------------------------------

const encoder = new SequenceEncoder();

// ---------------------------------------------------------------------------
// Hydration strategies (simplified mirror of ShortCodeManager.hydrateFromRecord)
// ---------------------------------------------------------------------------

interface ShortCodeDoc {
  sequence?: string;
  sequenceId?: string;
  ownerId?: string;
  sequenceData?: Record<string, unknown>;
  encoded?: string;
}

// Prefetched index of publicSequences + wanted deck sequences.
// publicSequences is small (~438 docs) so we load it whole. Deck sequences
// are ~420k in aggregate — we only keep docs whose id or word is referenced
// by an orphan shortcode.
const publicByWord = new Map<string, any>();
const publicById = new Map<string, any>();

// Wanted set — collected in pass 1 from orphan shortcodes, used in pass 2
// as a filter while streaming deck sequences.
const wantedIds = new Set<string>();
const wantedWords = new Set<string>();

async function prefetchPublicIndex(): Promise<void> {
  console.log("Prefetching publicSequences index...");
  const pubSnap = await db.collection("publicSequences").get();
  for (const d of pubSnap.docs) {
    const data = d.data();
    if (data.word) publicByWord.set(data.word, data);
    if (data.name && data.name !== data.word) publicByWord.set(data.name, data);
    publicById.set(d.id, data);
    if (data.id && data.id !== d.id) publicById.set(data.id, data);
  }
  console.log(`  loaded ${pubSnap.docs.length} public sequences`);
  console.log();
}

/**
 * Pass 1 — scan shortcodes, collect (sequenceId, word) pairs from orphans
 * that also can't be hydrated from the public index. This is the *wanted*
 * set the deck prefetch will filter against.
 */
async function collectOrphanLookups(): Promise<void> {
  console.log("Scanning shortcodes for orphan lookups...");
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let total = 0;
  let orphans = 0;

  while (true) {
    let q = db.collection("shortcodes").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const d of snap.docs) {
      total++;
      const data = d.data() as ShortCodeDoc;

      if (typeof data.encoded === "string" && data.encoded.length > 0) continue;
      if (data.sequenceData && Array.isArray((data.sequenceData as any).steps)) continue;
      if (data.ownerId && data.sequenceId) continue; // direct user-collection load handles these

      const hasPublicMatch =
        (data.sequenceId && publicById.has(data.sequenceId)) ||
        (data.sequence && publicByWord.has(data.sequence));
      if (hasPublicMatch) continue;

      orphans++;
      if (data.sequenceId) wantedIds.add(data.sequenceId);
      if (data.sequence) wantedWords.add(data.sequence);
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(
    `  scanned ${total} shortcodes, ${orphans} deck-orphans ` +
    `(wanting ${wantedIds.size} ids + ${wantedWords.size} words)`
  );
  console.log();
}

/**
 * Pass 2 — targeted collectionGroup queries. For each batch of up to 30
 * ids/words, fire a single query against `sequences` across all decks.
 * ~15 round trips total vs 420 full-deck scans.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function ingestDeckDoc(d: admin.firestore.QueryDocumentSnapshot): void {
  const data = d.data();
  const slim = {
    id: d.id,
    word: data.word,
    name: data.name,
    steps: data.steps,
    startPosition: data.startPosition,
    startingPosition: data.startingPosition,
    gridMode: data.gridMode,
    loopType: data.loopType,
    sequenceLength: data.sequenceLength,
  };
  if (data.word) publicByWord.set(data.word, slim);
  if (data.name && data.name !== data.word) publicByWord.set(data.name, slim);
  publicById.set(d.id, slim);
}

async function prefetchDeckIndex(): Promise<void> {
  if (!includeDecks) return;
  if (wantedIds.size === 0 && wantedWords.size === 0) {
    console.log("No deck lookups needed — skipping deck prefetch.");
    console.log();
    return;
  }

  console.log(
    `Resolving ${wantedIds.size} ids + ${wantedWords.size} words via collectionGroup...`
  );

  let hits = 0;

  // We skip direct id-based collectionGroup lookups: wanted ids are UUIDs from
  // shortcode.sequenceId, which don't correspond to deck document ids (those
  // are natural keys like `alpha1_alpha2_...`). Words are the reliable join.

  // Lookup by word — requires a collection-group index on `word`.
  // If it doesn't exist yet Firestore will throw with an auto-create link.
  const wordBatches = chunk(Array.from(wantedWords), 30);
  for (let i = 0; i < wordBatches.length; i++) {
    const batch = wordBatches[i]!;
    try {
      const snap = await db
        .collectionGroup("sequences")
        .where("word", "in", batch)
        .get();
      for (const d of snap.docs) {
        if (publicById.has(d.id)) continue;
        ingestDeckDoc(d);
        hits++;
      }
      console.log(`  word batch ${i + 1}/${wordBatches.length}: +${snap.docs.length} (of ${batch.length} queried)`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("index")) {
        console.log(`  word batch ${i + 1}/${wordBatches.length}: MISSING INDEX — ${msg}`);
        console.log(`  (run with --no-decks or create the collection-group index on 'word')`);
        break;
      }
      throw err;
    }
  }

  console.log(`  resolved ${hits} deck sequences from targeted queries`);
  console.log();
}

/**
 * Reconstruct a minimum viable SequenceData for encoding.
 * Priority: inline sequenceData > direct user-collection load > public index.
 */
async function hydrateForEncoding(code: string, doc: ShortCodeDoc): Promise<SequenceData | null> {
  // 1. Inline — the happy path for shortcodes with embedded data
  if (doc.sequenceData && Array.isArray((doc.sequenceData as any).steps)) {
    return {
      id: code,
      ...(doc.sequenceData as object),
    } as SequenceData;
  }

  // 2. Direct Firestore load (for user-owned sequences)
  if (doc.ownerId && doc.sequenceId) {
    try {
      const ref = db.doc(`users/${doc.ownerId}/sequences/${doc.sequenceId}`);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data()!;
        return { ...data, id: snap.id, ownerId: doc.ownerId } as SequenceData;
      }
    } catch {
      // fall through
    }
  }

  // 3. Public index — for deck sequences / public published without inline data
  if (doc.sequenceId && publicById.has(doc.sequenceId)) {
    return { id: doc.sequenceId, ...publicById.get(doc.sequenceId) } as SequenceData;
  }
  if (doc.sequence && publicByWord.has(doc.sequence)) {
    const data = publicByWord.get(doc.sequence);
    return { id: data.id ?? doc.sequenceId ?? code, ...data } as SequenceData;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

async function main() {
  console.log(dryRun ? "=== DRY RUN (pass --confirm to write) ===\n" : "=== LIVE RUN ===\n");
  if (limit !== Infinity) console.log(`Limit: ${limit} docs\n`);

  await prefetchPublicIndex();
  await collectOrphanLookups();
  await prefetchDeckIndex();

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let total = 0;
  let alreadyEncoded = 0;
  let encoded = 0;
  let noHydration = 0;
  let encoderErrors = 0;
  let updateErrors = 0;
  let batchNumber = 0;

  while (total < limit) {
    let q = db.collection("shortcodes").orderBy("__name__").limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    batchNumber++;
    console.log(`Batch ${batchNumber}: ${snap.docs.length} docs`);

    for (const d of snap.docs) {
      if (total >= limit) break;
      total++;

      const data = d.data() as ShortCodeDoc;

      if (typeof data.encoded === "string" && data.encoded.length > 0) {
        alreadyEncoded++;
        continue;
      }

      const seq = await hydrateForEncoding(d.id, data);
      if (!seq || !Array.isArray(seq.steps) || seq.steps.length === 0) {
        noHydration++;
        if (noHydration <= 10) {
          console.log(`  [${d.id}] no hydration source (word="${data.sequence}", ownerId=${data.ownerId ?? "-"}, sequenceId=${data.sequenceId ?? "-"})`);
        }
        continue;
      }

      let encodedStr: string;
      try {
        encodedStr = await encoder.encodeForQR(seq);
      } catch (err) {
        encoderErrors++;
        if (encoderErrors <= 10) {
          console.log(`  [${d.id}] encoder error: ${(err as Error).message}`);
        }
        continue;
      }

      if (dryRun) {
        if (encoded < 5) {
          console.log(`  [${d.id}] would write encoded (${encodedStr.length} chars)`);
        }
      } else {
        try {
          await d.ref.update({ encoded: encodedStr });
        } catch (err) {
          updateErrors++;
          console.log(`  [${d.id}] update error: ${(err as Error).message}`);
          continue;
        }
      }
      encoded++;

      if (encoded % 200 === 0) {
        console.log(`  progress: ${encoded} encoded so far`);
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total scanned        : ${total}`);
  console.log(`Already had encoded  : ${alreadyEncoded}`);
  console.log(`${dryRun ? "Would encode" : "Encoded"}         : ${encoded}`);
  console.log(`No hydration source  : ${noHydration}`);
  console.log(`Encoder errors       : ${encoderErrors}`);
  console.log(`Update errors        : ${updateErrors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
