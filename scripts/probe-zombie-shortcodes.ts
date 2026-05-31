#!/usr/bin/env tsx
/**
 * Probe: pick N "unencoded but hydratable-per-publicSequences" shortcodes,
 * then for each one fan out across every deck in parallel (`decks/{deck}/
 * sequences/{sequenceId}`) to see if the source actually exists anywhere.
 *
 * Purpose: decide whether the 1233 remaining unencoded shortcodes are
 * zombies (safe to delete) or genuinely resolvable at runtime via deck
 * lookups (need the collection-group index path to fix properly).
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT_PATH = path.join(__dirname, "..", "serviceAccountKey.json");
const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "the-kinetic-alphabet",
  });
}

const db = admin.firestore();

const SAMPLE_COUNT = parseInt(process.argv.find(a => a.startsWith("--n="))?.split("=")[1] ?? "5", 10);

async function main() {
  console.log(`Sampling ${SAMPLE_COUNT} unencoded shortcodes with sequenceId...`);

  // Find shortcodes that are unencoded AND have a sequenceId we can probe
  const candidates: { code: string; sequenceId: string; word: string }[] = [];
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  while (candidates.length < SAMPLE_COUNT) {
    let q = db.collection("shortcodes").orderBy("__name__").limit(500);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const data = d.data();
      if (typeof data.encoded === "string" && data.encoded.length > 0) continue;
      if (!data.sequenceId) continue;
      candidates.push({ code: d.id, sequenceId: data.sequenceId, word: data.sequence ?? "" });
      if (candidates.length >= SAMPLE_COUNT) break;
    }
    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
    if (snap.docs.length < 500) break;
  }

  console.log(`  sampled ${candidates.length}\n`);

  // Load all deck ids (the /decks/ doc list is small — just metadata)
  console.log("Loading deck ids...");
  const decksSnap = await db.collection("catalogs").get();
  const deckIds = decksSnap.docs.map(d => d.id);
  console.log(`  ${deckIds.length} decks\n`);

  for (const c of candidates) {
    console.log(`--- ${c.code} (seqId=${c.sequenceId}, word=${c.word}) ---`);
    const started = Date.now();
    const refs = deckIds.map(deckId => db.doc(`catalogs/${deckId}/sequences/${c.sequenceId}`));
    const snaps = await db.getAll(...refs);
    const hits = snaps
      .map((s, i) => ({ deckId: deckIds[i]!, exists: s.exists }))
      .filter(x => x.exists);
    const ms = Date.now() - started;
    if (hits.length === 0) {
      console.log(`  ZOMBIE — not found in any deck (${ms}ms)`);
    } else {
      console.log(`  FOUND in ${hits.length} deck(s) (${ms}ms):`);
      for (const h of hits) console.log(`    ${h.deckId}`);
    }
    console.log();
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Probe failed:", err);
  process.exit(1);
});
