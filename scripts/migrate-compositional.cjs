/**
 * Migration Script: Three-Tier Compositional Sequence Model
 *
 * Reads all sequences from Firestore (user libraries + public sequences) and
 * decomposes each one into its compositional fields:
 *   - blueSoloProp / redSoloProp  (solo prop paths)
 *   - stepPairings                (per-beat pairing data)
 *   - blueSoloHash / redSoloHash  (content hashes)
 *
 * Existing steps[] are preserved — this script only ADDS new fields.
 *
 * Usage:
 *   node scripts/migrate-compositional.cjs              # live run
 *   node scripts/migrate-compositional.cjs --dry-run    # report only
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
  return {
    id: randomUUID(),
    locations,
    contentHash: hashHandPath(locations),
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
    id: randomUUID(),
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
// SequenceDecomposer (reimplemented from SequenceDecomposer.ts)
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

function extractSoloProp(sequence, color) {
  const startPositionMotions =
    sequence.startPosition?.motions ?? sequence.startingPosition?.motions;

  const startLocationFromPos = startPositionMotions?.[color]?.startLocation;
  const startOrientationFromPos =
    startPositionMotions?.[color]?.startOrientation;

  const firstStepMotion = sequence.steps[0]?.motions?.[color];

  const startLocation =
    startLocationFromPos ?? firstStepMotion?.startLocation ?? GridLocation.NORTH;

  const startOrientation =
    startOrientationFromPos ??
    firstStepMotion?.startOrientation ??
    Orientation.IN;

  const steps = sequence.steps.map((step) => {
    const motion = step.motions?.[color];
    if (!motion) {
      return makePlaceholderStep(startLocation, startOrientation, step.duration);
    }
    return motionToSoloPropStep(motion, step.duration);
  });

  return createSoloProp(steps, startLocation, startOrientation);
}

function extractStepPairings(sequence) {
  return sequence.steps.map((step) => ({
    letter: step.letter ?? null,
    blueReversal: step.blueReversal ?? false,
    redReversal: step.redReversal ?? false,
    startPosition: step.startPosition ?? null,
    endPosition: step.endPosition ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Full decomposition for a single sequence document
// ---------------------------------------------------------------------------

function decomposeSequence(doc) {
  const data = doc;

  if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
    return null; // nothing to decompose
  }

  const blueSoloProp = extractSoloProp(data, "blue");
  const redSoloProp = extractSoloProp(data, "red");
  const stepPairings = extractStepPairings(data);

  return {
    blueSoloProp,
    redSoloProp,
    stepPairings,
    blueSoloHash: blueSoloProp.contentHash,
    redSoloHash: redSoloProp.contentHash,
  };
}

// ---------------------------------------------------------------------------
// Firestore traversal
// ---------------------------------------------------------------------------

async function migrateCollection(db, collectionPath, stats) {
  const snapshot = await db.collection(collectionPath).get();
  const docs = snapshot.docs;

  if (docs.length === 0) return;

  console.log(`  ${collectionPath}: ${docs.length} documents`);

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of docs) {
    const data = doc.data();

    // Already migrated — skip
    if (data.blueSoloProp) {
      stats.alreadyMigrated++;
      continue;
    }

    // No steps to decompose — skip
    if (!data.steps || !Array.isArray(data.steps) || data.steps.length === 0) {
      stats.skipped++;
      continue;
    }

    try {
      const compositionalFields = decomposeSequence(data);
      if (!compositionalFields) {
        stats.skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `    [dry-run] Would migrate: ${doc.id} (${data.word || data.name || "unnamed"}, ${data.steps.length} steps)`
        );
      } else {
        batch.update(doc.ref, compositionalFields);
        batchCount++;

        // Flush batch when it hits the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      stats.migrated++;
    } catch (err) {
      stats.errors++;
      console.error(
        `    ERROR on ${collectionPath}/${doc.id}: ${err.message}`
      );
    }
  }

  // Flush remaining batch
  if (!DRY_RUN && batchCount > 0) {
    await batch.commit();
  }
}

async function migrateUserSequences(db, stats) {
  // Get all user documents that have a sequences subcollection.
  // Firestore doesn't let us list subcollections across all users in one call,
  // so we iterate over all user documents.
  const usersSnapshot = await db.collection("users").get();
  console.log(`  Found ${usersSnapshot.docs.length} user documents`);

  for (const userDoc of usersSnapshot.docs) {
    const seqPath = `users/${userDoc.id}/sequences`;
    const seqSnapshot = await db.collection(seqPath).limit(1).get();
    if (!seqSnapshot.empty) {
      await migrateCollection(db, seqPath, stats);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\nCompositional Sequence Migration${DRY_RUN ? " (DRY RUN)" : ""}\n`
  );
  console.log("Connecting to Firestore...");

  const db = initFirebase();

  const stats = {
    migrated: 0,
    alreadyMigrated: 0,
    skipped: 0,
    errors: 0,
  };

  // 1. Public sequences
  console.log("\nProcessing publicSequences...");
  await migrateCollection(db, "publicSequences", stats);

  // 2. User sequences
  console.log("\nProcessing user sequences...");
  await migrateUserSequences(db, stats);

  // Report
  console.log("\n--- Migration Summary ---");
  console.log(`  Migrated:         ${stats.migrated}`);
  console.log(`  Already migrated: ${stats.alreadyMigrated}`);
  console.log(`  Skipped (no steps): ${stats.skipped}`);
  console.log(`  Errors:           ${stats.errors}`);

  if (DRY_RUN) {
    console.log("\n  (Dry run — no documents were modified)\n");
  } else {
    console.log("\n  Done.\n");
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
