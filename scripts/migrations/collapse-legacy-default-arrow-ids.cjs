#!/usr/bin/env node
/**
 * Migration: collapse legacy 2-part default arrow placement doc ids.
 *
 * The default_arrow_adjustments collection mixes two id formats:
 *   - legacy  "{gridMode}_{motionType}"            (seed, no propType field)
 *   - canonical "{gridMode}_{propType}_{motionType}" (prop-scoped, what the
 *                 app reads + writes today)
 *
 * On reload both decode to the same canonical id, so which one wins depends on
 * Firestore's name-sort load order — a latent silent-clobber of real overrides.
 * This migration rewrites every legacy doc to its canonical "_staff_" id,
 * MERGING into any existing canonical doc (the canonical doc is authoritative:
 * its hand-tuned override values win; the legacy seed only fills gaps), then
 * deletes the legacy doc. After it runs, one physical doc per canonical id.
 *
 * Usage:
 *   node scripts/migrations/collapse-legacy-default-arrow-ids.cjs            # dry run
 *   node scripts/migrations/collapse-legacy-default-arrow-ids.cjs --execute  # apply
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const EXECUTE = process.argv.includes("--execute");
const COLLECTION = "default_arrow_adjustments";

function loadServiceAccount() {
  // Two names exist in this repo's history; accept either.
  const candidates = [
    path.join(__dirname, "../../firebase-service-account.json"),
    path.join(__dirname, "../../serviceAccountKey.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return require(p);
  }
  console.error(
    "Missing service account. Expected one of:\n  " + candidates.join("\n  "),
  );
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(loadServiceAccount()) });
const db = admin.firestore();

/** Legacy = exactly two underscore-separated segments ("{grid}_{motion}"). */
function isLegacyId(id) {
  return id.split("_").length === 2;
}

/** "{grid}_{motion}" → "{grid}_staff_{motion}". */
function toCanonicalId(legacyId) {
  const [grid, motion] = legacyId.split("_");
  return `${grid}_staff_${motion}`;
}

/**
 * Two-level overlay: start from `base` placements, let `auth` override every
 * (placementKey, turns) it defines. `auth` is the canonical doc (authoritative).
 */
function mergePlacements(base, auth) {
  const out = {};
  for (const [k, byTurns] of Object.entries(base || {})) out[k] = { ...byTurns };
  for (const [k, byTurns] of Object.entries(auth || {})) {
    out[k] = { ...(out[k] || {}), ...byTurns };
  }
  return out;
}

async function main() {
  const snap = await db.collection(COLLECTION).get();
  const byId = new Map();
  snap.docs.forEach((d) => byId.set(d.id, d.data()));

  const legacy = [...byId.keys()].filter(isLegacyId).sort();
  if (legacy.length === 0) {
    console.log("No legacy 2-part docs found. Nothing to do.");
    return;
  }

  console.log(`${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${legacy.length} legacy doc(s):\n`);

  const batch = db.batch();
  for (const legacyId of legacy) {
    const canonicalId = toCanonicalId(legacyId);
    const legacyData = byId.get(legacyId);
    const canonicalData = byId.get(canonicalId); // may be undefined
    const [grid, motion] = legacyId.split("_");

    // Canonical doc is authoritative; legacy seed is the base it overlays.
    const placements = mergePlacements(
      legacyData.placements,
      canonicalData ? canonicalData.placements : {},
    );
    const legacyKeys = Object.keys(legacyData.placements || {}).length;
    const canonKeys = canonicalData ? Object.keys(canonicalData.placements || {}).length : 0;
    const mergedKeys = Object.keys(placements).length;

    console.log(
      `  ${legacyId}  →  ${canonicalId}` +
        (canonicalData ? `  (merge: legacy ${legacyKeys} + canonical ${canonKeys} → ${mergedKeys} keys, canonical wins conflicts)` : `  (rename: ${mergedKeys} keys)`),
    );

    if (EXECUTE) {
      const merged = {
        gridMode: grid,
        propType: "staff",
        motionType: motion,
        placements,
        // Preserve provenance of the authoritative doc when present.
        updatedAt: (canonicalData && canonicalData.updatedAt) || legacyData.updatedAt || new Date(),
        updatedBy: (canonicalData && canonicalData.updatedBy) || legacyData.updatedBy || "migration",
      };
      batch.set(db.collection(COLLECTION).doc(canonicalId), merged);
      batch.delete(db.collection(COLLECTION).doc(legacyId));
    }
  }

  if (EXECUTE) {
    await batch.commit();
    console.log(`\nDone. Collapsed ${legacy.length} legacy doc(s) into canonical ids.`);
  } else {
    console.log(`\nDry run only. Re-run with --execute to apply.`);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
