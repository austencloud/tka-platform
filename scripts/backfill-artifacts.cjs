/**
 * Backfill Script: Extract Hand Paths and Solo Props from Public Sequences
 *
 * Reads all public sequences, decomposes each into its four constituent artifacts
 * (blue hand path, red hand path, blue solo prop, red solo prop), and writes them
 * to the publicHandPaths and publicSoloProps collections.
 *
 * Idempotent: Uses contentHash as the document ID. Safe to re-run — existing
 * documents are skipped (merge write won't overwrite if fields are identical).
 *
 * Usage:
 *   node scripts/backfill-artifacts.cjs                  # live run (all sequences)
 *   node scripts/backfill-artifacts.cjs --dry-run        # show what would be written
 *   node scripts/backfill-artifacts.cjs --limit 10       # process only 10 sequences
 */

const admin = require("firebase-admin");
const { readFileSync } = require("fs");
const { join } = require("path");
const { randomUUID } = require("crypto");

const SERVICE_ACCOUNT_PATH = join(__dirname, "..", "serviceAccountKey.json");

function initFirebase() {
  try {
    const serviceAccount = JSON.parse(
      readFileSync(SERVICE_ACCOUNT_PATH, "utf-8")
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return admin.firestore();
  } catch (err) {
    console.error("Failed to initialize Firebase.");
    console.error(`  Expected service account at: ${SERVICE_ACCOUNT_PATH}`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

function parseLimitArg() {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1 || idx + 1 >= process.argv.length) return Infinity;
  const val = parseInt(process.argv[idx + 1], 10);
  return isNaN(val) ? Infinity : val;
}

const LIMIT = parseLimitArg();

// ---------------------------------------------------------------------------
// Enum values (mirrored from TypeScript sources so we stay in CJS land)
// ---------------------------------------------------------------------------

const GridLocation = {
  NORTH: "n",
  EAST: "e",
  SOUTH: "s",
  WEST: "w",
  NORTHEAST: "ne",
  SOUTHEAST: "se",
  SOUTHWEST: "sw",
  NORTHWEST: "nw",
  CENTER: "c",
};

const GridMode = {
  DIAMOND: "diamond",
  BOX: "box",
  SKEWED: "skewed",
  CENTRIC: "centric",
};

const MotionType = {
  STATIC: "static",
};

const RotationDirection = {
  NO_ROTATION: "noRotation",
};

const Orientation = {
  IN: "in",
};

const CARDINAL_LOCATIONS = new Set([
  GridLocation.NORTH,
  GridLocation.EAST,
  GridLocation.SOUTH,
  GridLocation.WEST,
]);

const INTERCARDINAL_LOCATIONS = new Set([
  GridLocation.NORTHEAST,
  GridLocation.SOUTHEAST,
  GridLocation.SOUTHWEST,
  GridLocation.NORTHWEST,
]);

// ---------------------------------------------------------------------------
// ContentHasher (reimplemented from ContentHasher.ts)
// ---------------------------------------------------------------------------

const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function toBase62(bytes) {
  let result = "";
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  while (value > 0n) {
    result = BASE62_CHARS[Number(value % 62n)] + result;
    value = value / 62n;
  }
  return result.padStart(22, "0");
}

function hash128(input) {
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x100000001b3n;
  const FNV_PRIME = 0x00000100000001b3n;
  for (let i = 0; i < input.length; i++) {
    const c = BigInt(input.charCodeAt(i));
    h1 ^= c;
    h1 = (h1 * FNV_PRIME) & 0xffffffffffffffffn;
    h2 ^= c;
    h2 = (h2 * (FNV_PRIME + 2n)) & 0xffffffffffffffffn;
  }
  const bytes = new Uint8Array(16);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(h1 & 0xffn);
    h1 >>= 8n;
    bytes[i + 8] = Number(h2 & 0xffn);
    h2 >>= 8n;
  }
  return toBase62(bytes);
}

function serializeStep(step) {
  let s = `${step.startLocation}:${step.endLocation}:${step.motionType}:${step.rotationDirection}:${step.turns}:${step.startOrientation}:${step.endOrientation}`;
  if (step.handPath != null) {
    s += `:${step.handPath}`;
    if (step.skewSteps != null) {
      s += `:${step.skewSteps}:${step.skewDir ?? ""}`;
    }
  }
  return s;
}

function hashHandPath(locations) {
  const canonical = locations.join("|");
  return hash128(canonical);
}

function hashSoloProp(soloProp) {
  const parts = [`${soloProp.startLocation}:${soloProp.startOrientation}`];
  for (const step of soloProp.steps) {
    parts.push(serializeStep(step));
  }
  return hash128(parts.join("|"));
}

// ---------------------------------------------------------------------------
// HandPathFactory (reimplemented from HandPathFactory.ts)
// ---------------------------------------------------------------------------

function deriveGridMode(locations) {
  if (locations.includes(GridLocation.CENTER)) return GridMode.CENTRIC;
  const perimeter = locations.filter((loc) => loc !== GridLocation.CENTER);
  if (perimeter.length === 0) return GridMode.DIAMOND;
  if (perimeter.every((loc) => CARDINAL_LOCATIONS.has(loc)))
    return GridMode.DIAMOND;
  if (perimeter.every((loc) => INTERCARDINAL_LOCATIONS.has(loc)))
    return GridMode.BOX;
  return GridMode.SKEWED;
}

function buildBigrams(locations) {
  const bigrams = [];
  for (let i = 0; i < locations.length - 1; i++) {
    bigrams.push(`${locations[i]}_${locations[i + 1]}`);
  }
  return bigrams;
}

function deduplicateLocations(locations) {
  const seen = new Set();
  const result = [];
  for (const loc of locations) {
    if (!seen.has(loc)) {
      seen.add(loc);
      result.push(loc);
    }
  }
  return result;
}

function createHandPath(locations) {
  if (locations.length === 0) {
    throw new Error("HandPathFactory: locations must not be empty");
  }
  const startLocation = locations[0];
  const endLocation = locations[locations.length - 1];
  const contentHash = hashHandPath(locations);
  return {
    id: contentHash, // content-addressed: same path shape = same doc ID
    locations,
    contentHash,
    startLocation,
    endLocation,
    length: locations.length,
    bigrams: buildBigrams(locations),
    uniqueLocations: deduplicateLocations(locations),
    impliedGridMode: deriveGridMode(locations),
    isClosed: startLocation === endLocation,
  };
}

// ---------------------------------------------------------------------------
// SoloPropFactory (reimplemented from SoloPropFactory.ts)
// ---------------------------------------------------------------------------

function extractHandPathLocations(steps) {
  if (steps.length === 0) return [];
  const locations = [steps[0].startLocation];
  for (const step of steps) {
    locations.push(step.endLocation);
  }
  return locations;
}

function createSoloProp(steps, startLocation, startOrientation) {
  if (steps.length === 0) {
    throw new Error("SoloPropFactory: steps must not be empty");
  }
  const handPathLocations = extractHandPathLocations(steps);
  const handPath = createHandPath(handPathLocations);
  const contentHash = hashSoloProp({ startLocation, startOrientation, steps });
  return {
    id: contentHash, // content-addressed: same solo prop = same doc ID
    steps,
    startLocation,
    startOrientation,
    contentHash,
    handPath,
    length: steps.length,
    bigrams: handPath.bigrams,
    impliedGridMode: handPath.impliedGridMode,
  };
}

// ---------------------------------------------------------------------------
// Decomposition helpers
// ---------------------------------------------------------------------------

function motionToSoloPropStep(motion, duration) {
  return {
    startLocation: motion.startLocation,
    endLocation: motion.endLocation,
    startOrientation: motion.startOrientation,
    endOrientation: motion.endOrientation,
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
    turns: motion.turns,
    handPath: motion.handPath ?? null,
    skewSteps: motion.skewSteps ?? null,
    skewDir: motion.skewDir ?? null,
    duration,
  };
}

function makePlaceholderStep(location, orientation, duration) {
  return {
    startLocation: location,
    endLocation: location,
    startOrientation: orientation,
    endOrientation: orientation,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    duration,
  };
}

function extractSoloPropFromSequence(data, color) {
  const startPositionMotions =
    data.startPosition?.motions ?? data.startingPosition?.motions;

  const startLocationFromPos = startPositionMotions?.[color]?.startLocation;
  const startOrientationFromPos =
    startPositionMotions?.[color]?.startOrientation;

  const firstStepMotion = data.steps[0]?.motions?.[color];

  const startLocation =
    startLocationFromPos ?? firstStepMotion?.startLocation ?? GridLocation.NORTH;

  const startOrientation =
    startOrientationFromPos ??
    firstStepMotion?.startOrientation ??
    Orientation.IN;

  const steps = data.steps.map((step) => {
    const motion = step.motions?.[color];
    if (!motion) {
      return makePlaceholderStep(startLocation, startOrientation, step.duration);
    }
    return motionToSoloPropStep(motion, step.duration);
  });

  return createSoloProp(steps, startLocation, startOrientation);
}

// ---------------------------------------------------------------------------
// Firestore serialization helpers (strip undefined, convert Date)
// ---------------------------------------------------------------------------

function handPathToDoc(hp, ownerId) {
  const doc = {
    locations: hp.locations,
    contentHash: hp.contentHash,
    startLocation: hp.startLocation,
    endLocation: hp.endLocation,
    length: hp.length,
    bigrams: hp.bigrams,
    uniqueLocations: hp.uniqueLocations,
    impliedGridMode: hp.impliedGridMode,
    isClosed: hp.isClosed,
    ownerId,
    dateCreated: admin.firestore.FieldValue.serverTimestamp(),
  };
  return doc;
}

function soloPropToDoc(sp, ownerId) {
  const doc = {
    steps: sp.steps,
    startLocation: sp.startLocation,
    startOrientation: sp.startOrientation,
    contentHash: sp.contentHash,
    handPath: {
      locations: sp.handPath.locations,
      contentHash: sp.handPath.contentHash,
      startLocation: sp.handPath.startLocation,
      endLocation: sp.handPath.endLocation,
      length: sp.handPath.length,
      bigrams: sp.handPath.bigrams,
      uniqueLocations: sp.handPath.uniqueLocations,
      impliedGridMode: sp.handPath.impliedGridMode,
      isClosed: sp.handPath.isClosed,
    },
    length: sp.length,
    bigrams: sp.bigrams,
    impliedGridMode: sp.impliedGridMode,
    ownerId,
    dateCreated: admin.firestore.FieldValue.serverTimestamp(),
  };
  return doc;
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Collect artifacts from a sequence document into the maps
// ---------------------------------------------------------------------------

function collectArtifacts(data, docId, ownerId, handPathDocs, soloPropDocs, stats) {
  // If the sequence already has compositional fields, use those directly
  if (data.blueSoloProp && data.redSoloProp) {
    const blueHP = data.blueSoloProp.handPath;
    if (blueHP?.contentHash && !handPathDocs.has(blueHP.contentHash)) {
      handPathDocs.set(blueHP.contentHash, { doc: handPathToDoc(blueHP, ownerId), ownerId });
    }
    const redHP = data.redSoloProp.handPath;
    if (redHP?.contentHash && !handPathDocs.has(redHP.contentHash)) {
      handPathDocs.set(redHP.contentHash, { doc: handPathToDoc(redHP, ownerId), ownerId });
    }
    const blueSP = data.blueSoloProp;
    if (blueSP?.contentHash && !soloPropDocs.has(blueSP.contentHash)) {
      soloPropDocs.set(blueSP.contentHash, { doc: soloPropToDoc(blueSP, ownerId), ownerId });
    }
    const redSP = data.redSoloProp;
    if (redSP?.contentHash && !soloPropDocs.has(redSP.contentHash)) {
      soloPropDocs.set(redSP.contentHash, { doc: soloPropToDoc(redSP, ownerId), ownerId });
    }
    stats.sequencesProcessed++;
    return;
  }

  // Fallback: decompose from steps
  if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
    stats.sequencesSkipped++;
    return;
  }

  try {
    const blueSoloProp = extractSoloPropFromSequence(data, "blue");
    const redSoloProp = extractSoloPropFromSequence(data, "red");

    if (!handPathDocs.has(blueSoloProp.handPath.contentHash)) {
      handPathDocs.set(blueSoloProp.handPath.contentHash, { doc: handPathToDoc(blueSoloProp.handPath, ownerId), ownerId });
    }
    if (!handPathDocs.has(redSoloProp.handPath.contentHash)) {
      handPathDocs.set(redSoloProp.handPath.contentHash, { doc: handPathToDoc(redSoloProp.handPath, ownerId), ownerId });
    }
    if (!soloPropDocs.has(blueSoloProp.contentHash)) {
      soloPropDocs.set(blueSoloProp.contentHash, { doc: soloPropToDoc(blueSoloProp, ownerId), ownerId });
    }
    if (!soloPropDocs.has(redSoloProp.contentHash)) {
      soloPropDocs.set(redSoloProp.contentHash, { doc: soloPropToDoc(redSoloProp, ownerId), ownerId });
    }
    stats.sequencesProcessed++;
  } catch (err) {
    stats.errors++;
    console.error(`  ERROR on ${docId} (${data.word || data.name || "unnamed"}): ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Batch writer
// ---------------------------------------------------------------------------

async function writeBatched(db, collectionPath, docsMap, stats, field, label) {
  console.log(`Writing ${label}...`);
  let batch = db.batch();
  let batchCount = 0;
  let total = 0;

  for (const [hash, { doc }] of docsMap) {
    const ref = db.collection(collectionPath).doc(hash);
    batch.set(ref, doc, { merge: true });
    batchCount++;
    total++;

    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch (${total} ${label} so far)`);
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }
  stats[field] += total;
}

// ---------------------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\nBackfill Artifacts${DRY_RUN ? " (DRY RUN)" : ""}${LIMIT < Infinity ? ` (limit: ${LIMIT})` : ""}\n`
  );
  console.log("Connecting to Firestore...");

  const db = initFirebase();

  const stats = {
    sequencesProcessed: 0,
    sequencesSkipped: 0,
    handPathsWritten: 0,
    soloPropsWritten: 0,
    usersProcessed: 0,
    errors: 0,
  };

  // =========================================================================
  // PHASE 1: Public sequences → publicHandPaths + publicSoloProps
  // =========================================================================

  const publicHP = new Map();
  const publicSP = new Map();

  console.log("=== Phase 1: Public Sequences ===");
  console.log("Reading publicSequences...");
  let pubQuery = db.collection("publicSequences");
  if (LIMIT < Infinity) {
    pubQuery = pubQuery.limit(LIMIT);
  }
  const pubSnapshot = await pubQuery.get();
  console.log(`  Found ${pubSnapshot.docs.length} public sequences`);

  for (const doc of pubSnapshot.docs) {
    const data = doc.data();
    const ownerId = data.ownerId || "unknown";
    collectArtifacts(data, doc.id, ownerId, publicHP, publicSP, stats);
  }

  console.log(`  Unique public hand paths: ${publicHP.size}`);
  console.log(`  Unique public solo props: ${publicSP.size}`);

  if (!DRY_RUN) {
    await writeBatched(db, "publicHandPaths", publicHP, stats, "handPathsWritten", "public hand paths");
    await writeBatched(db, "publicSoloProps", publicSP, stats, "soloPropsWritten", "public solo props");
  }

  // =========================================================================
  // PHASE 2: User sequences → users/{uid}/handPaths + users/{uid}/soloProps
  // =========================================================================

  console.log("\n=== Phase 2: User Collections ===");
  console.log("Listing all users...");
  const usersSnapshot = await db.collection("users").get();
  const userIds = usersSnapshot.docs.map((d) => d.id);
  console.log(`  Found ${userIds.length} users`);

  for (const uid of userIds) {
    const seqCollection = db.collection(`users/${uid}/sequences`);
    let userQuery = seqCollection;
    if (LIMIT < Infinity) {
      userQuery = userQuery.limit(LIMIT);
    }
    const userSeqSnapshot = await userQuery.get();

    if (userSeqSnapshot.docs.length === 0) continue;

    const userHP = new Map();
    const userSP = new Map();

    for (const doc of userSeqSnapshot.docs) {
      const data = doc.data();
      collectArtifacts(data, doc.id, uid, userHP, userSP, stats);
    }

    if (userHP.size === 0 && userSP.size === 0) continue;

    stats.usersProcessed++;
    console.log(`  User ${uid}: ${userSeqSnapshot.docs.length} sequences → ${userHP.size} hand paths, ${userSP.size} solo props`);

    if (!DRY_RUN) {
      // Write to user's personal collections
      let batch = db.batch();
      let batchCount = 0;

      for (const [hash, { doc }] of userHP) {
        const ref = db.collection(`users/${uid}/handPaths`).doc(hash);
        batch.set(ref, doc, { merge: true });
        batchCount++;
        stats.handPathsWritten++;
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      for (const [hash, { doc }] of userSP) {
        const ref = db.collection(`users/${uid}/soloProps`).doc(hash);
        batch.set(ref, doc, { merge: true });
        batchCount++;
        stats.soloPropsWritten++;
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
    }
  }

  // =========================================================================
  // Report
  // =========================================================================

  console.log("\n--- Backfill Summary ---");
  console.log(`  Sequences processed:  ${stats.sequencesProcessed}`);
  console.log(`  Sequences skipped:    ${stats.sequencesSkipped}`);
  console.log(`  Users processed:      ${stats.usersProcessed}`);
  console.log(`  Hand paths written:   ${DRY_RUN ? `${publicHP.size} public (dry run)` : stats.handPathsWritten}`);
  console.log(`  Solo props written:   ${DRY_RUN ? `${publicSP.size} public (dry run)` : stats.soloPropsWritten}`);
  console.log(`  Errors:               ${stats.errors}`);

  if (DRY_RUN) {
    console.log("\n  (Dry run -- no documents were modified)\n");
  } else {
    console.log("\n  Done.\n");
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
