/**
 * Backfill shortcodeHashes/{hash} index docs for every existing shortcode.
 *
 * Canonical code per hash = OLDEST createdAt (matches the client's
 * deterministic legacy pick). Idempotent: hashes that already have an index
 * doc are skipped. Never touches the shortcodes collection itself — dup
 * docs stay resolvable forever (printed cards may carry any of them).
 *
 * Run: node scripts/backfill-shortcode-hash-index.mjs [--dry-run]
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const serviceAccount = JSON.parse(
  readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8")
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// 1. Group all shortcodes by encoderHash, keeping the oldest doc per hash.
const snap = await db.collection("shortcodes").select("encoderHash", "createdAt").get();
console.log("shortcode docs:", snap.size);

const canonical = new Map(); // hash → { code, createdAt }
let noHash = 0;
for (const doc of snap.docs) {
  const hash = doc.get("encoderHash");
  if (!hash) { noHash++; continue; }
  const createdAt = doc.get("createdAt") ?? "";
  const prev = canonical.get(hash);
  if (!prev || createdAt < prev.createdAt) {
    canonical.set(hash, { code: doc.id, createdAt });
  }
}
console.log("distinct hashes:", canonical.size, "| docs without hash (skipped):", noHash);

// 2. Skip hashes that already have an index doc (idempotency + lazy heals).
const existing = await db.collection("shortcodeHashes").select().get();
const have = new Set(existing.docs.map((d) => d.id));
console.log("index docs already present:", have.size);

const todo = [...canonical.entries()].filter(([hash]) => !have.has(hash));
console.log("index docs to write:", todo.length, DRY_RUN ? "(dry run — not writing)" : "");

// 3. Batched writes, 500 per batch (Firestore limit).
if (!DRY_RUN) {
  let written = 0;
  for (let i = 0; i < todo.length; i += 500) {
    const batch = db.batch();
    for (const [hash, { code, createdAt }] of todo.slice(i, i + 500)) {
      batch.set(db.collection("shortcodeHashes").doc(hash), {
        code,
        createdAt,
        backfilled: true,
      });
    }
    await batch.commit();
    written += Math.min(500, todo.length - i);
    console.log(`  written ${written}/${todo.length}`);
  }
}
console.log("done");
process.exit(0);
