/**
 * LOOP Type Migration Script
 *
 * Analyzes sequences in sequence-index.json and adds loopType and isCircular fields
 * based on Continuous Assembly Pattern detection.
 *
 * Usage: node scripts/migrate-loop-types.js [--dry-run]
 *
 * Options:
 *   --dry-run    Preview changes without writing to file
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SEQUENCE_INDEX_PATH = resolve(
  __dirname,
  "../static/data/sequence-index.json"
);

// LOOP Type definitions (mirrored from circular-models.ts)
const LOOPType = {
  STRICT_ROTATED: "strict_rotated",
  STRICT_MIRRORED: "strict_mirrored",
  STRICT_SWAPPED: "strict_swapped",
  STRICT_INVERTED: "strict_inverted",
  MIRRORED_SWAPPED: "mirrored_swapped",
  SWAPPED_INVERTED: "swapped_inverted",
  MIRRORED_INVERTED: "mirrored_inverted",
  ROTATED_SWAPPED: "rotated_swapped",
  ROTATED_INVERTED: "rotated_inverted",
  MIRRORED_ROTATED: "mirrored_rotated",
  MIRRORED_ROTATED_INVERTED: "mirrored_rotated_inverted",
  MIRRORED_SWAPPED_INVERTED: "mirrored_swapped_inverted",
};

const LOOPComponent = {
  ROTATED: "rotated",
  MIRRORED: "mirrored",
  SWAPPED: "swapped",
  INVERTED: "inverted",
};

// Component to LOOPType mapping
const COMPONENT_TO_LOOP_TYPE = {
  rotated: LOOPType.STRICT_ROTATED,
  mirrored: LOOPType.STRICT_MIRRORED,
  swapped: LOOPType.STRICT_SWAPPED,
  inverted: LOOPType.STRICT_INVERTED,
  "mirrored,swapped": LOOPType.MIRRORED_SWAPPED,
  "inverted,swapped": LOOPType.SWAPPED_INVERTED,
  "inverted,mirrored": LOOPType.MIRRORED_INVERTED,
  "rotated,swapped": LOOPType.ROTATED_SWAPPED,
  "inverted,rotated": LOOPType.ROTATED_INVERTED,
  "mirrored,rotated": LOOPType.MIRRORED_ROTATED,
  "inverted,mirrored,rotated": LOOPType.MIRRORED_ROTATED_INVERTED,
  "inverted,mirrored,swapped": LOOPType.MIRRORED_SWAPPED_INVERTED,
};

// Position maps for LOOP detection
const HALVED_LOOPS = new Set([
  "alpha1,alpha3",
  "alpha3,alpha1",
  "alpha2,alpha4",
  "alpha4,alpha2",
  "alpha5,alpha7",
  "alpha7,alpha5",
  "alpha6,alpha8",
  "alpha8,alpha6",
  "beta1,beta3",
  "beta3,beta1",
  "beta2,beta4",
  "beta4,beta2",
  "beta5,beta7",
  "beta7,beta5",
  "beta6,beta8",
  "beta8,beta6",
  "gamma1,gamma9",
  "gamma9,gamma1",
  "gamma3,gamma11",
  "gamma11,gamma3",
  "gamma5,gamma13",
  "gamma13,gamma5",
  "gamma7,gamma15",
  "gamma15,gamma7",
]);

const VERTICAL_MIRROR_MAP = {
  alpha1: "alpha2",
  alpha2: "alpha1",
  alpha3: "alpha4",
  alpha4: "alpha3",
  alpha5: "alpha6",
  alpha6: "alpha5",
  alpha7: "alpha8",
  alpha8: "alpha7",
  beta1: "beta2",
  beta2: "beta1",
  beta3: "beta4",
  beta4: "beta3",
  beta5: "beta6",
  beta6: "beta5",
  beta7: "beta8",
  beta8: "beta7",
  gamma1: "gamma2",
  gamma2: "gamma1",
  gamma3: "gamma4",
  gamma4: "gamma3",
};

const INVERTED_LETTER_MAP = {
  A: "V",
  V: "A",
  B: "W",
  W: "B",
  C: "X",
  X: "C",
  D: "Y",
  Y: "D",
  E: "Z",
  Z: "E",
  F: "Σ",
  Σ: "F",
  G: "Δ",
  Δ: "G",
  H: "θ",
  θ: "H",
  I: "Ω",
  Ω: "I",
};

/**
 * Extract beats from the fullMetadata.sequence array
 */
function extractBeats(sequence) {
  if (!sequence?.fullMetadata?.sequence) {
    return null;
  }

  const rawSequence = sequence.fullMetadata.sequence;

  // Filter to get only beat objects (have 'letter' field, not metadata or start position)
  const beats = rawSequence.filter((item) => {
    if (typeof item !== "object" || item === null) return false;
    if ("word" in item) return false; // Skip metadata entry
    if ("sequence_start_position" in item) return false; // Skip start position
    if (item.beat === 0) return false; // Skip start position
    return Boolean(item.letter);
  });

  return beats;
}

/**
 * Get start position from fullMetadata
 */
function getStartPosition(sequence) {
  if (!sequence?.fullMetadata?.sequence) return null;

  const rawSequence = sequence.fullMetadata.sequence;

  // Find start position entry
  const startEntry = rawSequence.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      ("sequence_start_position" in item || item.beat === 0)
  );

  if (!startEntry) return null;

  // Extract position from blue_attributes.end_loc + grid position logic
  const blueAttrs = startEntry.blue_attributes;
  if (!blueAttrs?.end_loc) return null;

  // The grid position would be derived from the end_loc
  // For now, return the raw start position info
  return startEntry.sequence_start_position || null;
}

/**
 * Get end position from the last beat
 */
function getEndPosition(beats) {
  if (!beats || beats.length === 0) return null;

  const lastBeat = beats[beats.length - 1];
  if (!lastBeat) return null;

  // Try to get position from blue_attributes.end_loc
  const blueAttrs = lastBeat.blue_attributes;
  return blueAttrs?.end_loc || null;
}

/**
 * Check if sequence is circular by comparing start and end positions
 * Detects circularity by comparing the end_pos of start position and last beat
 */
function checkCircularity(sequence) {
  if (!sequence?.fullMetadata?.sequence) return false;

  const rawSequence = sequence.fullMetadata.sequence;

  // Find start position entry (beat 0)
  const startEntry = rawSequence.find(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      ("sequence_start_position" in item || item.beat === 0)
  );

  if (!startEntry?.end_pos) return false;

  // Find last beat (highest beat number that isn't the start)
  const beats = rawSequence.filter(
    (item) =>
      typeof item === "object" && item !== null && item.beat > 0 && item.letter
  );

  if (beats.length === 0) return false;

  const lastBeat = beats[beats.length - 1];
  if (!lastBeat?.end_pos) return false;

  // Compare positions - circular if they match
  const startPos = String(startEntry.end_pos).toLowerCase();
  const endPos = String(lastBeat.end_pos).toLowerCase();

  return startPos === endPos;
}

// Detect rotation component
function detectsRotation(beats) {
  const length = beats.length;
  if (length < 2 || length % 2 !== 0) return false;

  const halfLength = length / 2;
  const firstBeat = beats[0];
  const halfBeat = beats[halfLength - 1];

  // Get positions from blue_attributes
  const startLoc = firstBeat?.blue_attributes?.start_loc;
  const endLoc = halfBeat?.blue_attributes?.end_loc;

  if (!startLoc || !endLoc) return false;

  // This is a simplified check - full implementation would need grid position mapping
  return false; // Disabled for initial migration - requires more complex analysis
}

// Detect mirroring component
function detectsMirroring(beats) {
  const length = beats.length;
  if (length < 2 || length % 2 !== 0) return false;

  // Simplified check - would need position data analysis
  return false; // Disabled for initial migration
}

// Detect swapping component (blue/red exchange)
function detectsSwapping(beats) {
  const length = beats.length;
  if (length < 2 || length % 2 !== 0) return false;

  const halfLength = length / 2;

  for (let i = 0; i < Math.min(halfLength, 2); i++) {
    // Check first 2 pairs
    const firstBeat = beats[i];
    const secondBeat = beats[halfLength + i];

    if (!firstBeat || !secondBeat) continue;

    const firstBlue = firstBeat.blue_attributes;
    const firstRed = firstBeat.red_attributes;
    const secondBlue = secondBeat.blue_attributes;
    const secondRed = secondBeat.red_attributes;

    if (firstBlue && firstRed && secondBlue && secondRed) {
      // Check if motion types are swapped
      if (secondBlue.motion_type !== firstRed.motion_type) return false;
      if (secondRed.motion_type !== firstBlue.motion_type) return false;
    }
  }

  return true;
}

// Detect inversion component
function detectsInversion(beats) {
  const length = beats.length;
  if (length < 2 || length % 2 !== 0) return false;

  const halfLength = length / 2;

  for (let i = 0; i < Math.min(halfLength, 2); i++) {
    // Check first 2 pairs
    const firstBeat = beats[i];
    const secondBeat = beats[halfLength + i];

    if (!firstBeat || !secondBeat) continue;

    // Check letter inversion
    if (firstBeat.letter && secondBeat.letter) {
      const expectedLetter =
        INVERTED_LETTER_MAP[firstBeat.letter.toUpperCase()];
      if (
        expectedLetter &&
        secondBeat.letter.toUpperCase() !== expectedLetter
      ) {
        return false;
      }
    }
  }

  return true;
}

// Map components to LOOP type
function mapComponentsToLOOPType(components) {
  if (components.size === 0) return null;

  const sortedComponents = Array.from(components).sort().join(",");
  return COMPONENT_TO_LOOP_TYPE[sortedComponents] || null;
}

// Detect LOOP type for a sequence
function detectLOOPType(sequence) {
  const isCircular = checkCircularity(sequence);

  if (!isCircular) {
    return { isCircular: false, loopType: null };
  }

  const beats = extractBeats(sequence);
  if (!beats || beats.length < 2) {
    return { isCircular: true, loopType: null };
  }

  const components = new Set();

  // Note: Full detection requires grid position analysis
  // For now, we detect swapping and inversion which can be done from motion data
  if (detectsSwapping(beats)) {
    components.add(LOOPComponent.SWAPPED);
  }
  if (detectsInversion(beats)) {
    components.add(LOOPComponent.INVERTED);
  }

  const loopType = mapComponentsToLOOPType(components);

  return {
    isCircular: true,
    loopType,
    components: Array.from(components),
  };
}

// Main migration function
function migrateCapTypes(dryRun = false) {
  console.log(`\n🔄 LOOP Type Migration${dryRun ? " (DRY RUN)" : ""}\n`);
  console.log(`Reading from: ${SEQUENCE_INDEX_PATH}\n`);

  // Read the sequence index
  let data;
  try {
    const content = readFileSync(SEQUENCE_INDEX_PATH, "utf8");
    data = JSON.parse(content);
  } catch (err) {
    console.error("Failed to read sequence-index.json:", err.message);
    process.exit(1);
  }

  const sequences = data.sequences || [];
  console.log(`Found ${sequences.length} sequences\n`);

  const stats = {
    total: sequences.length,
    circular: 0,
    withCapType: 0,
    alreadyHadCapType: 0,
    updated: 0,
    errors: 0,
  };

  const loopTypeCounts = {};

  // Process each sequence
  for (const seq of sequences) {
    try {
      const result = detectLOOPType(seq);

      if (result.isCircular) {
        stats.circular++;

        // Track if it already had loopType
        if (seq.loopType) {
          stats.alreadyHadCapType++;
        }

        // Count LOOP types
        if (result.loopType) {
          stats.withCapType++;
          loopTypeCounts[result.loopType] =
            (loopTypeCounts[result.loopType] || 0) + 1;
        }

        // Update sequence
        const needsUpdate =
          result.isCircular !== seq.isCircular ||
          result.loopType !== seq.loopType;

        if (needsUpdate) {
          if (!dryRun) {
            seq.isCircular = true;
            if (result.loopType) {
              seq.loopType = result.loopType;
            }
          }
          stats.updated++;
        }
      }
    } catch (err) {
      stats.errors++;
      console.error(`Error processing ${seq.word || seq.id}:`, err.message);
    }
  }

  // Write back if not dry run
  if (!dryRun && stats.updated > 0) {
    try {
      writeFileSync(SEQUENCE_INDEX_PATH, JSON.stringify(data, null, 2));
      console.log(`\n✅ Wrote changes to ${SEQUENCE_INDEX_PATH}`);
    } catch (err) {
      console.error("Failed to write sequence-index.json:", err.message);
      process.exit(1);
    }
  }

  // Print results
  console.log("\n📊 Migration Results\n");
  console.log(`Total sequences:     ${stats.total}`);
  console.log(`Circular sequences:  ${stats.circular}`);
  console.log(`With LOOP type:       ${stats.withCapType}`);
  console.log(`Already had LOOP:     ${stats.alreadyHadCapType}`);
  console.log(
    `${dryRun ? "Would update" : "Updated"}:        ${stats.updated}`
  );
  console.log(`Errors:              ${stats.errors}`);

  if (Object.keys(loopTypeCounts).length > 0) {
    console.log("\n📈 LOOP Type Distribution\n");
    const sortedTypes = Object.entries(loopTypeCounts).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [type, count] of sortedTypes) {
      console.log(`  ${type}: ${count}`);
    }
  }

  if (dryRun) {
    console.log("\n⚠️  Dry run complete. No changes were made.");
    console.log("Run without --dry-run to apply changes.\n");
  } else {
    console.log("\n✅ Migration complete!\n");
  }
}

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

migrateCapTypes(dryRun);
