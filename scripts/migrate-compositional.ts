/**
 * Compositional Fields Migration
 *
 * Adds blueSoloProp, redSoloProp, stepPairings, and content hash fields to
 * existing Firestore sequence documents. This supports the new compositional
 * data model that lets queries find sequences by hand path similarity.
 *
 * Safety guarantees:
 *   - Only adds fields, never removes or overwrites existing ones
 *   - Skips any document that already has `blueSoloProp`
 *   - Skips any step that has no motions (blank beats)
 *   - Idempotent: safe to run multiple times
 *
 * Collections processed:
 *   - users/{uid}/sequences  (all user libraries)
 *   - publicSequences        (public gallery index — stores steps inline)
 *
 * Usage:
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/migrate-compositional.ts --dry-run
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/migrate-compositional.ts --commit
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// $lib/ path aliases are resolved via scripts/tsconfig.json
import { ContentHasher } from "../src/lib/shared/foundation/services/implementations/ContentHasher.js";
import { HandPathFactory } from "../src/lib/shared/foundation/services/implementations/HandPathFactory.js";
import { SoloPropFactory } from "../src/lib/shared/foundation/services/implementations/SoloPropFactory.js";
import {
  GridLocation,
} from "../src/lib/shared/pictograph/grid/domain/enums/grid-enums.js";
import {
  MotionType,
  RotationDirection,
  Orientation,
  HandPath,
  SkewDirection,
} from "../src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.js";

import type { SoloPropStepData } from "../src/lib/shared/foundation/domain/models/SoloPropStepData.js";
import type { StepPairingData } from "../src/lib/shared/foundation/domain/models/StepPairingData.js";
import type { SoloPropData } from "../src/lib/shared/foundation/domain/models/SoloPropData.js";

// ============================================================================
// Configuration
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SERVICE_ACCOUNT_PATH = path.resolve(PROJECT_ROOT, "serviceAccountKey.json");

const BATCH_LIMIT = 500;
const LOG_EVERY = 100;
const PAGE_SIZE = 200;

// ============================================================================
// Argument Parsing
// ============================================================================

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--commit");

// ============================================================================
// Domain Services (instantiated once, reused across all documents)
// ============================================================================

const hasher = new ContentHasher();
const handPathFactory = new HandPathFactory(hasher);
const soloPropFactory = new SoloPropFactory(handPathFactory, hasher);

// ============================================================================
// Firestore Document Shape (raw, untyped from Firestore)
// ============================================================================

interface FirestoreMotion {
  startLocation?: string;
  endLocation?: string;
  motionType?: string;
  rotationDirection?: string;
  turns?: number | string;
  startOrientation?: string;
  endOrientation?: string;
  handPath?: string;
  skewSteps?: number;
  skewDir?: string;
}

interface FirestoreStep {
  stepNumber?: number;
  stepNumber?: number;
  letter?: string | null;
  startPosition?: string | null;
  endPosition?: string | null;
  blueReversal?: boolean;
  redReversal?: boolean;
  duration?: number;
  motions?: {
    blue?: FirestoreMotion;
    red?: FirestoreMotion;
  };
}

interface FirestoreSequenceDoc {
  steps?: FirestoreStep[];
  beats?: FirestoreStep[];
  blueSoloProp?: unknown;
  [key: string]: unknown;
}

// ============================================================================
// Conversion: Firestore motion object → SoloPropStepData
// ============================================================================

/**
 * Maps a raw Firestore string value to a GridLocation enum member.
 * Returns null if the value is missing or unrecognized.
 */
function toGridLocation(raw: string | undefined | null): GridLocation | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  // GridLocation enum values are already lowercase strings ("n", "e", "ne", etc.)
  const match = Object.values(GridLocation).find((v) => v === normalized);
  return match ?? null;
}

function toMotionType(raw: string | undefined | null): MotionType {
  if (!raw) return MotionType.STATIC;
  const normalized = raw.toLowerCase();
  return (Object.values(MotionType).find((v) => v === normalized) as MotionType) ?? MotionType.STATIC;
}

function toRotationDirection(raw: string | undefined | null): RotationDirection {
  if (!raw) return RotationDirection.NO_ROTATION;
  const normalized = raw.toLowerCase();
  // Special-case the Firestore-stored "norotation" variant
  if (normalized === "norotation" || normalized === "no_rotation") return RotationDirection.NO_ROTATION;
  return (Object.values(RotationDirection).find((v) => v === normalized) as RotationDirection) ?? RotationDirection.NO_ROTATION;
}

function toOrientation(raw: string | undefined | null): Orientation {
  if (!raw) return Orientation.IN;
  // Orientation values are camelCase (e.g. "clockIn") — match case-insensitively
  const normalized = raw.toLowerCase();
  const found = Object.values(Orientation).find((v) => v.toLowerCase() === normalized);
  return (found as Orientation) ?? Orientation.IN;
}

function toHandPath(raw: string | undefined | null): HandPath | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  const found = Object.values(HandPath).find((v) => v.toLowerCase() === normalized);
  return (found as HandPath) ?? null;
}

function toSkewDirection(raw: string | undefined | null): SkewDirection | null {
  if (!raw) return null;
  // SkewDirection values are "+" and "-"
  if (raw === "+" || raw === SkewDirection.PLUS) return SkewDirection.PLUS;
  if (raw === "-" || raw === SkewDirection.MINUS) return SkewDirection.MINUS;
  return null;
}

function toTurns(raw: number | string | undefined | null): number | "fl" {
  if (raw === "fl" || raw === "float") return "fl";
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Converts a raw Firestore motion object into a SoloPropStepData.
 * Returns null if the motion lacks required location fields (e.g. blank beats).
 */
function motionToSoloPropStep(
  motion: FirestoreMotion,
  duration: number
): SoloPropStepData | null {
  const startLocation = toGridLocation(motion.startLocation);
  const endLocation = toGridLocation(motion.endLocation);

  // A motion without start/end locations can't be part of a hand path
  if (!startLocation || !endLocation) return null;

  return {
    startLocation,
    endLocation,
    startOrientation: toOrientation(motion.startOrientation),
    endOrientation: toOrientation(motion.endOrientation),
    motionType: toMotionType(motion.motionType),
    rotationDirection: toRotationDirection(motion.rotationDirection),
    turns: toTurns(motion.turns),
    handPath: toHandPath(motion.handPath),
    skewSteps: motion.skewSteps ?? null,
    skewDir: toSkewDirection(motion.skewDir),
    duration,
  };
}

// ============================================================================
// Decomposition: sequence document → compositional fields
// ============================================================================

interface CompositionalFields {
  blueSoloProp: SoloPropData;
  redSoloProp: SoloPropData;
  stepPairings: StepPairingData[];
  bluePathHash: string;
  redPathHash: string;
  blueSoloHash: string;
  redSoloHash: string;
}

/**
 * Given the raw Firestore document data for a sequence, builds the
 * compositional fields (blueSoloProp, redSoloProp, stepPairings, hashes).
 *
 * Returns null if the sequence can't be decomposed (missing steps, no valid
 * motions for either hand, etc.).
 */
function buildCompositionalFields(
  docData: FirestoreSequenceDoc
): CompositionalFields | null {
  const rawSteps: FirestoreStep[] = docData.steps ?? docData.beats ?? [];

  // Only process actual steps (stepNumber >= 1), not the start position beat
  const steps = rawSteps.filter(
    (s) => (s.stepNumber ?? s.stepNumber ?? 0) >= 1
  );

  if (steps.length === 0) return null;

  const blueSteps: SoloPropStepData[] = [];
  const redSteps: SoloPropStepData[] = [];
  const stepPairings: StepPairingData[] = [];

  for (const step of steps) {
    const duration = step.duration ?? 1;
    const blueMotion = step.motions?.blue;
    const redMotion = step.motions?.red;

    const blueStep = blueMotion ? motionToSoloPropStep(blueMotion, duration) : null;
    const redStep = redMotion ? motionToSoloPropStep(redMotion, duration) : null;

    // Both hands must have valid motions for this step to be usable
    if (!blueStep || !redStep) continue;

    blueSteps.push(blueStep);
    redSteps.push(redStep);

    stepPairings.push({
      letter: (step.letter as any) ?? null,
      blueReversal: step.blueReversal ?? false,
      redReversal: step.redReversal ?? false,
      startPosition: (step.startPosition as any) ?? null,
      endPosition: (step.endPosition as any) ?? null,
    });
  }

  if (blueSteps.length === 0 || redSteps.length === 0) return null;

  // Build SoloProp objects (these compute hand paths and content hashes internally)
  let blueSoloProp: SoloPropData;
  let redSoloProp: SoloPropData;

  try {
    blueSoloProp = soloPropFactory.create(
      blueSteps,
      blueSteps[0]!.startLocation,
      blueSteps[0]!.startOrientation
    );
    redSoloProp = soloPropFactory.create(
      redSteps,
      redSteps[0]!.startLocation,
      redSteps[0]!.startOrientation
    );
  } catch (err) {
    // SoloPropFactory throws on empty steps (shouldn't happen here, but be safe)
    return null;
  }

  return {
    blueSoloProp,
    redSoloProp,
    stepPairings,
    bluePathHash: blueSoloProp.handPath.contentHash,
    redPathHash: redSoloProp.handPath.contentHash,
    blueSoloHash: blueSoloProp.contentHash,
    redSoloHash: redSoloProp.contentHash,
  };
}

// ============================================================================
// Firestore Serialization
// ============================================================================

/**
 * Converts a SoloPropData object into a plain JSON-serializable object
 * suitable for writing to Firestore. SoloPropData contains nested objects
 * with readonly arrays — Firestore needs plain objects/arrays.
 */
function serializeSoloProp(soloProp: SoloPropData): Record<string, unknown> {
  return {
    id: soloProp.id,
    contentHash: soloProp.contentHash,
    startLocation: soloProp.startLocation,
    startOrientation: soloProp.startOrientation,
    length: soloProp.length,
    bigrams: [...soloProp.bigrams],
    impliedGridMode: soloProp.impliedGridMode,
    steps: soloProp.steps.map((step) => ({
      startLocation: step.startLocation,
      endLocation: step.endLocation,
      startOrientation: step.startOrientation,
      endOrientation: step.endOrientation,
      motionType: step.motionType,
      rotationDirection: step.rotationDirection,
      turns: step.turns,
      duration: step.duration,
      ...(step.handPath != null && { handPath: step.handPath }),
      ...(step.skewSteps != null && { skewSteps: step.skewSteps }),
      ...(step.skewDir != null && { skewDir: step.skewDir }),
    })),
    handPath: {
      id: soloProp.handPath.id,
      contentHash: soloProp.handPath.contentHash,
      locations: [...soloProp.handPath.locations],
      startLocation: soloProp.handPath.startLocation,
      endLocation: soloProp.handPath.endLocation,
      length: soloProp.handPath.length,
      bigrams: [...soloProp.handPath.bigrams],
      uniqueLocations: [...soloProp.handPath.uniqueLocations],
      impliedGridMode: soloProp.handPath.impliedGridMode,
      isClosed: soloProp.handPath.isClosed,
    },
  };
}

function serializeStepPairings(
  pairings: StepPairingData[]
): Record<string, unknown>[] {
  return pairings.map((p) => ({
    letter: p.letter,
    blueReversal: p.blueReversal,
    redReversal: p.redReversal,
    startPosition: p.startPosition,
    endPosition: p.endPosition,
  }));
}

// ============================================================================
// Migration Statistics
// ============================================================================

interface Stats {
  total: number;
  migrated: number;
  alreadyMigrated: number;
  noSteps: number;
  decompositionFailed: number;
  errors: number;
}

function printStats(stats: Stats, label: string): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MIGRATION SUMMARY — ${label}`);
  console.log("=".repeat(60));
  console.log(`  Total documents scanned:   ${stats.total}`);
  console.log(`  ${DRY_RUN ? "Would migrate" : "Migrated"}:              ${stats.migrated}`);
  console.log(`  Already migrated (skipped): ${stats.alreadyMigrated}`);
  console.log(`  No steps / blank:          ${stats.noSteps}`);
  console.log(`  Decomposition failed:      ${stats.decompositionFailed}`);
  console.log(`  Errors:                    ${stats.errors}`);
}

// ============================================================================
// Batch Writer
// ============================================================================

/**
 * Collects pending writes and commits them to Firestore in batches of 500.
 * In dry-run mode, logs the writes instead of committing.
 */
class BatchWriter {
  private pending: Array<{
    ref: FirebaseFirestore.DocumentReference;
    data: Record<string, unknown>;
    label: string;
  }> = [];

  add(
    ref: FirebaseFirestore.DocumentReference,
    data: Record<string, unknown>,
    label: string
  ): void {
    this.pending.push({ ref, data, label });
  }

  get size(): number {
    return this.pending.length;
  }

  async flush(db: FirebaseFirestore.Firestore): Promise<void> {
    if (this.pending.length === 0) return;

    if (DRY_RUN) {
      for (const { label } of this.pending) {
        console.log(`  [DRY RUN] Would write: ${label}`);
      }
      this.pending = [];
      return;
    }

    // Commit in chunks of BATCH_LIMIT (Firestore limit is 500 per batch)
    for (let i = 0; i < this.pending.length; i += BATCH_LIMIT) {
      const chunk = this.pending.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const { ref, data } of chunk) {
        batch.update(ref, data);
      }

      await batch.commit();
      console.log(
        `  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} docs`
      );
    }

    this.pending = [];
  }
}

// ============================================================================
// Collection Processors
// ============================================================================

/**
 * Migrates a single Firestore document reference.
 * Returns 'migrated', 'already-migrated', 'no-steps', 'decomposition-failed', or 'error'.
 */
async function processDocument(
  docRef: FirebaseFirestore.DocumentReference,
  docData: FirestoreSequenceDoc,
  writer: BatchWriter,
  label: string
): Promise<"migrated" | "already-migrated" | "no-steps" | "decomposition-failed" | "error"> {
  // Skip: already has compositional fields
  if (docData.blueSoloProp !== undefined) {
    return "already-migrated";
  }

  const rawSteps = docData.steps ?? docData.beats ?? [];
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
    return "no-steps";
  }

  let fields: CompositionalFields | null;
  try {
    fields = buildCompositionalFields(docData);
  } catch (err) {
    console.error(`  ERROR decomposing ${label}: ${(err as Error).message}`);
    return "error";
  }

  if (!fields) {
    return "decomposition-failed";
  }

  const updatePayload: Record<string, unknown> = {
    blueSoloProp: serializeSoloProp(fields.blueSoloProp),
    redSoloProp: serializeSoloProp(fields.redSoloProp),
    stepPairings: serializeStepPairings(fields.stepPairings),
    bluePathHash: fields.bluePathHash,
    redPathHash: fields.redPathHash,
    blueSoloHash: fields.blueSoloHash,
    redSoloHash: fields.redSoloHash,
  };

  writer.add(docRef, updatePayload, label);
  return "migrated";
}

/**
 * Migrates all sequence documents for a single user.
 */
async function migrateUserSequences(
  db: FirebaseFirestore.Firestore,
  uid: string,
  writer: BatchWriter,
  stats: Stats
): Promise<void> {
  const collectionRef = db.collection(`users/${uid}/sequences`);
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let query = collectionRef
      .orderBy("__name__")
      .limit(PAGE_SIZE) as FirebaseFirestore.Query;

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      stats.total++;

      if (stats.total % LOG_EVERY === 0) {
        console.log(`  Progress: ${stats.total} documents scanned...`);
      }

      const result = await processDocument(
        doc.ref,
        doc.data() as FirestoreSequenceDoc,
        writer,
        `users/${uid}/sequences/${doc.id}`
      );

      switch (result) {
        case "migrated": stats.migrated++; break;
        case "already-migrated": stats.alreadyMigrated++; break;
        case "no-steps": stats.noSteps++; break;
        case "decomposition-failed": stats.decompositionFailed++; break;
        case "error": stats.errors++; break;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    if (snapshot.docs.length < PAGE_SIZE) break;
  }
}

/**
 * Migrates all documents in the publicSequences collection.
 * Public sequence documents store steps inline (not via sourceRef).
 */
async function migratePublicSequences(
  db: FirebaseFirestore.Firestore,
  writer: BatchWriter,
  stats: Stats
): Promise<void> {
  const collectionRef = db.collection("publicSequences");
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  console.log("\nProcessing publicSequences...");

  while (true) {
    let query = collectionRef
      .orderBy("__name__")
      .limit(PAGE_SIZE) as FirebaseFirestore.Query;

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      stats.total++;

      if (stats.total % LOG_EVERY === 0) {
        console.log(`  Progress: ${stats.total} documents scanned...`);
      }

      const result = await processDocument(
        doc.ref,
        doc.data() as FirestoreSequenceDoc,
        writer,
        `publicSequences/${doc.id}`
      );

      switch (result) {
        case "migrated": stats.migrated++; break;
        case "already-migrated": stats.alreadyMigrated++; break;
        case "no-steps": stats.noSteps++; break;
        case "decomposition-failed": stats.decompositionFailed++; break;
        case "error": stats.errors++; break;
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1] ?? null;
    if (snapshot.docs.length < PAGE_SIZE) break;
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log(DRY_RUN
    ? "MIGRATE COMPOSITIONAL FIELDS (DRY RUN — pass --commit to write)"
    : "MIGRATE COMPOSITIONAL FIELDS (LIVE — writing to Firestore)"
  );
  console.log("=".repeat(60));
  console.log();

  // Load service account
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Service account not found at: ${SERVICE_ACCOUNT_PATH}`);
    console.error("Place your Firebase service account JSON at the project root.");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
  );

  // Initialize Firebase Admin (dynamic import — CommonJS module in ESM context)
  const admin = await import("firebase-admin");
  if (!admin.default.apps.length) {
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
    });
  }
  const db = admin.default.firestore();

  const writer = new BatchWriter();

  // ---- User sequences ----
  console.log("Loading all users...");
  const usersSnapshot = await db.collection("users").get();
  const uids = usersSnapshot.docs.map((d) => d.id);
  console.log(`Found ${uids.length} users.\n`);

  const userStats: Stats = {
    total: 0,
    migrated: 0,
    alreadyMigrated: 0,
    noSteps: 0,
    decompositionFailed: 0,
    errors: 0,
  };

  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i]!;
    process.stdout.write(`[${i + 1}/${uids.length}] users/${uid}/sequences ... `);
    const before = userStats.total;
    await migrateUserSequences(db, uid, writer, userStats);
    const count = userStats.total - before;
    console.log(`${count} docs`);
  }

  printStats(userStats, "User Sequences");

  // Flush user sequence writes before processing public sequences
  await writer.flush(db);

  // ---- Public sequences ----
  const publicStats: Stats = {
    total: 0,
    migrated: 0,
    alreadyMigrated: 0,
    noSteps: 0,
    decompositionFailed: 0,
    errors: 0,
  };

  await migratePublicSequences(db, writer, publicStats);
  printStats(publicStats, "Public Sequences");
  await writer.flush(db);

  // ---- Overall summary ----
  const combined: Stats = {
    total: userStats.total + publicStats.total,
    migrated: userStats.migrated + publicStats.migrated,
    alreadyMigrated: userStats.alreadyMigrated + publicStats.alreadyMigrated,
    noSteps: userStats.noSteps + publicStats.noSteps,
    decompositionFailed: userStats.decompositionFailed + publicStats.decompositionFailed,
    errors: userStats.errors + publicStats.errors,
  };

  printStats(combined, "TOTAL");

  if (DRY_RUN) {
    console.log("\nDry run complete. Run with --commit to apply changes.");
  } else {
    console.log("\nMigration complete.");
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
