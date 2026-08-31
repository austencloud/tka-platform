/**
 * Backfill Deck Release Metadata
 *
 * Older deck-release manifests predate the `name`/`description` fields and the
 * `bluePropType`/`redPropType` render snapshot. Without a pinned prop snapshot,
 * the print-preview content-hash cache misses on every view (the key falls back
 * to the viewer's live settings), forcing a full re-render. This backfill writes
 * the missing fields so existing decks render from cache on the first view after
 * one re-render.
 *
 * Defaults (only written where the field is currently missing):
 *   name          <- existing `notes` if non-empty, else "Deck #NNN"
 *   bluePropType  <- "staff"  (PropType.STAFF — the deck-standard prop)
 *   redPropType   <- "staff"
 *
 * Manifests live at: deckReleases/counter/manifests/{NNN}
 *
 * Usage:
 *   node scripts/backfill-deck-release-meta.cjs --dry-run   # preview
 *   node scripts/backfill-deck-release-meta.cjs             # apply
 */

const admin = require("firebase-admin");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const MANIFESTS_COLLECTION = "deckReleases/counter/manifests";
const DEFAULT_PROP = "staff";

let db;

try {
  const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");
  const serviceAccount = require(serviceAccountPath);

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  db = admin.firestore();
} catch (error) {
  console.error("Failed to initialize Firebase:", error.message);
  process.exit(1);
}

function deckLabel(deckNumber) {
  return `Deck #${String(deckNumber ?? 0).padStart(3, "0")}`;
}

async function backfill() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Backfill Deck Release Metadata ${DRY_RUN ? "(DRY RUN)" : ""}`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    const snapshot = await db.collection(MANIFESTS_COLLECTION).get();

    if (snapshot.empty) {
      console.log("No deck-release manifests found.\n");
      return;
    }

    console.log(`Found ${snapshot.size} manifest(s).\n`);

    const changes = [];
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const patch = {};

      if (data.name === undefined) {
        const notes = typeof data.notes === "string" ? data.notes.trim() : "";
        patch.name = notes.length > 0 ? notes : deckLabel(data.deckNumber);
      }
      if (data.leftPropType === undefined) patch.leftPropType = DEFAULT_PROP;
      if (data.rightPropType === undefined) patch.rightPropType = DEFAULT_PROP;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      changes.push({ id: doc.id, patch });
    }

    if (changes.length === 0) {
      console.log(`No changes needed. (${skipped} already complete)\n`);
      return;
    }

    console.log(`Changes needed for ${changes.length} manifest(s):\n`);
    for (const c of changes) {
      console.log(`  ${c.id}  ->  ${JSON.stringify(c.patch)}`);
    }
    console.log();

    if (!DRY_RUN) {
      console.log("Applying changes...\n");
      const BATCH_SIZE = 500;
      for (let i = 0; i < changes.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const slice = changes.slice(i, i + BATCH_SIZE);
        for (const c of slice) {
          batch.set(db.collection(MANIFESTS_COLLECTION).doc(c.id), c.patch, { merge: true });
        }
        await batch.commit();
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: updated ${slice.length} manifest(s)`);
      }
      console.log();
    }

    console.log(`${"=".repeat(80)}`);
    console.log(`Summary:`);
    console.log(`  Total manifests:    ${snapshot.size}`);
    console.log(`  Updated:            ${changes.length}`);
    console.log(`  Skipped (complete): ${skipped}`);
    console.log(`  Status:             ${DRY_RUN ? "DRY RUN - no changes applied" : "Changes applied"}`);
    console.log(`${"=".repeat(80)}\n`);
  } catch (error) {
    console.error("Error during backfill:", error);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

backfill();
