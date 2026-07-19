#!/usr/bin/env node
/**
 * Import a sequence from JSON into your Firestore library.
 *
 * Usage:
 *   node scripts/import-sequence.cjs sequence.json
 *   node scripts/import-sequence.cjs sequence.json --notes "My tagline"
 *   cat sequence.json | node scripts/import-sequence.cjs --stdin
 *
 * Reads a full sequence JSON (as exported from the app or pasted from Claude),
 * auto-detects LOOP type, generates required metadata, and writes to
 * users/{uid}/sequences/{id}.
 *
 * Compositional fields (blueSoloProp, redSoloProp, stepPairings) are
 * computed automatically at import time — no manual migration needed.
 */

const { readFileSync } = require("fs");
const { resolve } = require("path");
const crypto = require("crypto");
const { decomposeSequence } = require("./lib/compose-sequence.cjs");

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------

let jsonPath = null;
let useStdin = false;
let notes = null;
let visibility = "private";
let dryRun = false;
let forceCircular = null;
let forceLoopType = null;

function parseCliArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--stdin") {
      useStdin = true;
    } else if (args[i] === "--notes" && args[i + 1]) {
      notes = args[++i];
    } else if (args[i] === "--visibility" && args[i + 1]) {
      visibility = args[++i];
    } else if (args[i] === "--circular") {
      forceCircular = true;
    } else if (args[i] === "--loop-type" && args[i + 1]) {
      forceLoopType = args[++i];
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (!args[i].startsWith("--")) {
      jsonPath = args[i];
    }
  }

  if (!jsonPath && !useStdin) {
    console.error("Usage: node scripts/import-sequence.cjs <file.json> [--notes 'tagline'] [--circular] [--loop-type mirrored_swapped] [--dry-run]");
    console.error("       echo '{...}' | node scripts/import-sequence.cjs --stdin");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUSTEN_UID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";

// ---------------------------------------------------------------------------
// LOOP Detection
// ---------------------------------------------------------------------------

// Maps LOOP component IDs to the loopType enum values used in Firestore
const COMPONENT_TO_LOOP_TYPE = {
  rotated: "rotated",
  mirrored: "mirrored",
  swapped: "swapped",
  inverted: "inverted",
};

/**
 * Convert a raw step (app format with motions.blue/red) to the
 * SequenceStep format expected by the sequence-engine's LOOP detector.
 */
function convertToEngineStep(step, index) {
  const blue = step.motions?.blue || {};
  const red = step.motions?.red || {};
  return {
    letter: step.letter,
    startPosition: step.startPosition,
    endPosition: step.endPosition,
    blueMotion: {
      motionType: blue.motionType,
      startLocation: blue.startLocation,
      endLocation: blue.endLocation,
      rotationDirection: blue.rotationDirection,
      startOrientation: blue.startOrientation,
      endOrientation: blue.endOrientation,
      turns: blue.turns,
    },
    redMotion: {
      motionType: red.motionType,
      startLocation: red.startLocation,
      endLocation: red.endLocation,
      rotationDirection: red.rotationDirection,
      startOrientation: red.startOrientation,
      endOrientation: red.endOrientation,
      turns: red.turns,
    },
    beatIndex: index,
    stepNumber: index,
  };
}

/**
 * Detect LOOP type from raw sequence steps.
 * Returns { isCircular, loopType, description } or null if detection unavailable.
 */
function detectLoop(raw) {
  try {
    const { detectLOOPFromSteps } = require("../packages/sequence-engine/dist/loop/detection/LOOPDetector.js");

    const steps = raw.steps || [];
    const startPos = raw.startPosition || raw.startingPosition;
    const startGridPos = startPos?.startPosition || startPos?.gridPosition;

    // Build engine-format steps with start position as step 0
    const engineSteps = [
      {
        letter: startPos?.letter || "β",
        startPosition: startGridPos || "beta1",
        endPosition: startPos?.endPosition || startGridPos || "beta1",
        blueMotion: {
          motionType: "static",
          startLocation: startPos?.motions?.blue?.startLocation || "n",
          endLocation: startPos?.motions?.blue?.endLocation || "n",
          rotationDirection: "noRotation",
          turns: 0,
        },
        redMotion: {
          motionType: "static",
          startLocation: startPos?.motions?.red?.startLocation || "n",
          endLocation: startPos?.motions?.red?.endLocation || "n",
          rotationDirection: "noRotation",
          turns: 0,
        },
        beatIndex: 0,
        stepNumber: 0,
      },
      ...steps.map((s, i) => convertToEngineStep(s, i + 1)),
    ];

    const result = detectLOOPFromSteps(engineSteps);

    // Map the first detected component to a loopType enum value
    let loopType = null;
    if (result.components && result.components.length > 0) {
      loopType = COMPONENT_TO_LOOP_TYPE[result.components[0]] || result.components[0];
    }

    return {
      isCircular: result.isCircular,
      loopType,
      components: result.components || [],
      description: result.description,
    };
  } catch (err) {
    // sequence-engine not built or not available — skip detection
    console.warn(`LOOP detection unavailable: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read and parse input
// ---------------------------------------------------------------------------

async function readInput() {
  if (useStdin) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFileSync(resolve(jsonPath), "utf8");
}

// ---------------------------------------------------------------------------
// Build Firestore document from raw sequence JSON
// ---------------------------------------------------------------------------

/**
 * Build a complete startPosition object. Two input shapes are tolerated:
 *
 *   1. Rich object (from the app or a prior export): already has .motions.blue
 *      and .motions.red — we just normalize and pass through.
 *   2. Bare string or stub (from MCP generate_sequence, which returns
 *      startPosition as a grid-position string like "beta5"): synthesize a
 *      static startPosition object from the first step's start-side motion
 *      data. Without this, the Firestore doc ends up with undefined
 *      motions, and the thumbnail renderer draws an empty Start cell.
 */
function buildStartPositionObject(startPosInput, steps, sequenceId) {
  if (
    startPosInput &&
    typeof startPosInput === "object" &&
    startPosInput.motions?.blue &&
    startPosInput.motions?.red
  ) {
    const gridPos =
      startPosInput.gridPosition ||
      startPosInput.startPosition ||
      steps?.[0]?.startPosition ||
      null;
    return {
      isStartPosition: true,
      id: startPosInput.id || `start-${sequenceId}`,
      gridPosition: gridPos,
      letter: startPosInput.letter,
      startPosition: startPosInput.startPosition || gridPos,
      endPosition: startPosInput.endPosition || gridPos,
      motions: startPosInput.motions,
    };
  }

  const firstStep = steps?.[0];
  const blueMotion = firstStep?.motions?.blue;
  const redMotion = firstStep?.motions?.red;
  if (!blueMotion || !redMotion) return null;

  const gridPos =
    (typeof startPosInput === "string" ? startPosInput : null) ||
    firstStep.startPosition ||
    null;

  const letter = typeof gridPos === "string"
    ? gridPos.startsWith("alpha") ? "α"
    : gridPos.startsWith("beta") ? "β"
    : gridPos.startsWith("gamma") ? "Γ"
    : null
    : null;

  return {
    isStartPosition: true,
    id: `start-${sequenceId}`,
    gridPosition: gridPos,
    letter,
    startPosition: gridPos,
    endPosition: gridPos,
    motions: {
      blue: {
        color: "blue",
        motionType: "static",
        startLocation: blueMotion.startLocation,
        endLocation: blueMotion.startLocation,
        startOrientation: blueMotion.startOrientation,
        endOrientation: blueMotion.startOrientation,
        rotationDirection: "no_rotation",
        turns: 0,
        isVisible: blueMotion.isVisible !== false,
      },
      red: {
        color: "red",
        motionType: "static",
        startLocation: redMotion.startLocation,
        endLocation: redMotion.startLocation,
        startOrientation: redMotion.startOrientation,
        endOrientation: redMotion.startOrientation,
        rotationDirection: "no_rotation",
        turns: 0,
        isVisible: redMotion.isVisible !== false,
      },
    },
  };
}

/**
 * Build the Firestore library document from raw sequence JSON.
 *
 * @param raw Raw sequence JSON ({word, gridMode, startPosition, steps})
 * @param fieldValue Object with a serverTimestamp() factory (e.g. admin.firestore.FieldValue)
 * @param loopInfo Result of detectLoop(raw), or null
 * @param opts { visibility, notes, forceCircular, forceLoopType, demo }
 */
function buildFirestoreDoc(raw, fieldValue, loopInfo, opts = {}) {
  const optVisibility = opts.visibility ?? visibility;
  const optNotes = opts.notes ?? notes;
  const optForceCircular = opts.forceCircular ?? forceCircular;
  const optForceLoopType = opts.forceLoopType ?? forceLoopType;

  const sequenceId = `seq_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = fieldValue.serverTimestamp();

  const word = raw.word || "";
  const name = word;

  // Use CLI override > LOOP detector > manual end-matches-start check
  const steps = raw.steps || [];
  const startPos = raw.startPosition || raw.startingPosition;
  const startPosObject = buildStartPositionObject(startPos, steps, sequenceId);
  const startGridPos =
    startPosObject?.gridPosition ||
    (typeof startPos === "string" ? startPos : null) ||
    startPos?.startPosition ||
    startPos?.gridPosition;
  const lastStep = steps[steps.length - 1];
  const manualCircular = lastStep && startGridPos
    ? lastStep.endPosition === startGridPos
    : false;
  const isCircular = optForceCircular != null
    ? optForceCircular
    : loopInfo != null
      ? loopInfo.isCircular
      : manualCircular;

  // Determine starting position group (alpha, beta, gamma)
  let startingPositionGroup = null;
  if (startGridPos) {
    if (startGridPos.startsWith("alpha")) startingPositionGroup = "alpha";
    else if (startGridPos.startsWith("beta")) startingPositionGroup = "beta";
    else if (startGridPos.startsWith("gamma")) startingPositionGroup = "gamma";
  }

  const doc = {
    id: sequenceId,
    name,
    word,
    steps: steps.map((step, i) => ({
      beat: step.beat ?? i,
      letter: step.letter,
      startPosition: step.startPosition,
      endPosition: step.endPosition,
      motions: step.motions,
    })),
    startPosition: startPosObject,
    startingPositionGroup,
    gridMode: raw.gridMode || "diamond",
    sequenceLength: steps.length,
    thumbnails: [],
    tags: opts.demo ? ["demo"] : [],
    isFavorite: false,
    isCircular,
    // The publicSequences sync (sync-missing-public-sequences.js) queries
    // metadata.visibility, so it must mirror the top-level field.
    metadata: { visibility: optVisibility },
    ownerId: AUSTEN_UID,
    visibility: optVisibility,
    birthday: now,
    createdAt: now,
    updatedAt: now,
    _version: 1,
  };

  if (opts.demo) {
    doc.demo = true;
  }

  // Add LOOP type — CLI override takes precedence over detector
  if (optForceLoopType) {
    doc.loopType = optForceLoopType;
  } else if (loopInfo?.loopType) {
    doc.loopType = loopInfo.loopType;
  }

  if (optNotes) {
    doc.notes = optNotes;
  }

  // Compute compositional fields (blueSoloProp, redSoloProp, stepPairings)
  const compositional = decomposeSequence(doc);
  if (compositional) {
    Object.assign(doc, compositional);
  }

  // Strip any undefined/null values (Firestore rejects them)
  return {
    id: sequenceId,
    data: Object.fromEntries(
      Object.entries(doc).filter(([, v]) => v !== undefined && v !== null)
    ),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  parseCliArgs();
  const input = await readInput();
  let raw;
  try {
    raw = JSON.parse(input);
  } catch (err) {
    console.error("Failed to parse JSON:", err.message);
    process.exit(1);
  }

  console.log(`Sequence: "${raw.word || "(no word)"}"`);
  console.log(`Steps: ${(raw.steps || []).length}`);
  console.log(`Grid mode: ${raw.gridMode || "diamond"}`);

  // Auto-detect LOOP type
  const loopInfo = detectLoop(raw);
  if (loopInfo) {
    console.log(`Circular: ${loopInfo.isCircular}`);
    if (loopInfo.loopType) {
      console.log(`LOOP type: ${loopInfo.loopType} (${loopInfo.description})`);
    } else if (loopInfo.isCircular) {
      console.log(`LOOP type: freeform (circular but no recognized pattern)`);
    }
  }

  if (dryRun) {
    const mockFieldValue = { serverTimestamp: () => "<SERVER_TIMESTAMP>" };
    const { id, data } = buildFirestoreDoc(raw, mockFieldValue, loopInfo);
    console.log(`\n[DRY RUN] Would save as: users/${AUSTEN_UID}/sequences/${id}`);
    console.log(`Fields: ${Object.keys(data).join(", ")}`);
    console.log(`Visibility: ${data.visibility}`);
    console.log(`isCircular: ${data.isCircular}`);
    if (data.loopType) console.log(`loopType: ${data.loopType}`);
    if (data.notes) console.log(`Notes: ${data.notes}`);
    return;
  }

  // Initialize Firebase Admin
  const admin = require("firebase-admin");
  const serviceAccountPath = resolve(__dirname, "../serviceAccountKey.json");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
  } catch {
    console.error("Missing serviceAccountKey.json in project root.");
    console.error("Place your Firebase service account key there to use this script.");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const db = admin.firestore();
  const { id, data } = buildFirestoreDoc(raw, admin.firestore.FieldValue, loopInfo);

  const docPath = `users/${AUSTEN_UID}/sequences/${id}`;
  console.log(`\nSaving to: ${docPath}`);

  await db.doc(docPath).set(data);

  // Update sequence count
  await db.doc(`users/${AUSTEN_UID}`).set(
    {
      sequenceCount: admin.firestore.FieldValue.increment(1),
      lastActivityDate: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log("Saved successfully.");
  console.log(`ID: ${id}`);
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error:", err);
      process.exit(1);
    });
}

// Reused by scripts/show-sequence.mjs — keep signatures stable.
module.exports = { AUSTEN_UID, detectLoop, buildFirestoreDoc };
