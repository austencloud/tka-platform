// Bakes the 22 l1-tnd-motions base words to static/data/hero/tnd-base-words.json.
// These are the ONLY data the firebase-free landing hero pool needs: every
// shape-matrix cell+mode realization is CONSTRUCTED from a base word at runtime
// (turn pattern + orientation + grid), so we ship the 22 seeds, not the ~8160
// realizations. Docs are written verbatim (raw Firestore shape); the runtime
// pool hydrates them via hydrateSequence, identical to the app's catalog-loader.
//
// Usage: npx tsx --tsconfig scripts/tsconfig.json scripts/build-tnd-base-words.ts
// Requires: serviceAccountKey.json in project root.
// Rerun only when scripts/seed-tnd-deck.ts reseeds the catalog.
import admin from "firebase-admin";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CATALOG_ID = "l1-tnd-motions";
const OUT_PATH = resolve(__dirname, "../static/data/hero/tnd-base-words.json");

const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, "../serviceAccountKey.json"), "utf8"),
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  const snap = await db
    .collection("catalogs")
    .doc(CATALOG_ID)
    .collection("sequences")
    .get();

  const words = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (words.length === 0) {
    throw new Error(
      `No sequences under catalogs/${CATALOG_ID}/sequences — is the catalog seeded?`,
    );
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(words), "utf8");
  console.log(
    `Wrote ${words.length} base words to ${OUT_PATH} ` +
      `(${(JSON.stringify(words).length / 1024).toFixed(1)} KB)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
