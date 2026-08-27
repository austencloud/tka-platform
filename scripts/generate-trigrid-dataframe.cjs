/**
 * Trigrid Pictograph Dataframe Generator
 *
 * Generates TrigridPictographDataframe.csv for the 3-point equilateral triangle grid.
 *
 * Trigrid alphabet (22 letters):
 *   Type 1 (Dual-Shift): G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V
 *   Type 2 (Shift):       W, X, Y, Z
 *   Type 6 (Static):      β, γ
 *
 * Position space (upright mode):
 *   Beta:  beta1 (N,N), beta2 (SE,SE), beta3 (SW,SW)
 *   Gamma: gamma1 (N,SE), gamma2 (SE,N), gamma3 (N,SW),
 *          gamma4 (SW,N), gamma5 (SE,SW), gamma6 (SW,SE)
 *
 * Usage: node scripts/generate-trigrid-dataframe.cjs [--dry-run]
 */

const fs = require("fs");
const path = require("path");

// Grid geometry

/** The 3 vertices in CW order for upright mode */
const VERTICES = ["n", "se", "sw"];

/** Get the next vertex CW */
function cwNeighbor(v) {
  return VERTICES[(VERTICES.indexOf(v) + 1) % 3];
}

/** Get the next vertex CCW */
function ccwNeighbor(v) {
  return VERTICES[(VERTICES.indexOf(v) + 2) % 3];
}

// Position enumeration

/**
 * All 9 positions: 3 beta + 6 gamma (ordered pairs)
 * Each position = { name, blue, red }
 */
const POSITIONS = [];

// Beta: both hands at same vertex
VERTICES.forEach((v, i) => {
  POSITIONS.push({ name: `beta${i + 1}`, blue: v, red: v });
});

// Gamma: hands at different vertices (ordered — blue/red assignment matters)
let gammaIdx = 1;
for (let i = 0; i < VERTICES.length; i++) {
  for (let j = 0; j < VERTICES.length; j++) {
    if (i !== j) {
      POSITIONS.push({
        name: `gamma${gammaIdx}`,
        blue: VERTICES[i],
        red: VERTICES[j],
      });
      gammaIdx++;
    }
  }
}

/** Look up position name from blue/red locations */
function findPosition(blue, red) {
  const pos = POSITIONS.find((p) => p.blue === blue && p.red === red);
  return pos ? pos.name : null;
}

/** Get position group (beta or gamma) */
function positionGroup(posName) {
  return posName.startsWith("beta") ? "beta" : "gamma";
}

// ============================================================================
// Motion helpers
// ============================================================================

/**
 * Shift a hand from one vertex to another.
 * Returns the destination vertex given a start vertex and direction (cw/ccw).
 */
function shift(vertex, direction) {
  return direction === "cw" ? cwNeighbor(vertex) : ccwNeighbor(vertex);
}

// ============================================================================
// CSV row generation
// ============================================================================

const CSV_HEADER =
  "letter,startPosition,endPosition,timing,direction," +
  "blueMotionType,blueRotationDirection,blueStartLocation,blueEndLocation," +
  "redMotionType,redRotationDirection,redStartLocation,redEndLocation";

function makeRow(letter, startPos, endPos, timing, direction, blue, red) {
  return [
    letter,
    startPos,
    endPos,
    timing,
    direction,
    blue.motionType,
    blue.rotationDir,
    blue.startLoc,
    blue.endLoc,
    red.motionType,
    red.rotationDir,
    red.startLoc,
    red.endLoc,
  ].join(",");
}

// ============================================================================
// Letter generators
// ============================================================================

const rows = [];

/**
 * Generate Beta → Beta letters (G, H, I)
 * Both hands at same vertex, both shift same orbital direction → still beta.
 *
 * G: tog-same, both pro
 * H: tog-same, both anti
 * I: tog-same, blue pro + red anti
 */
function generateBetaToBeta() {
  const letters = [
    { letter: "G", blueMotion: "pro", redMotion: "pro" },
    { letter: "H", blueMotion: "anti", redMotion: "anti" },
    { letter: "I", blueMotion: "pro", redMotion: "anti" },
  ];

  for (const { letter, blueMotion, redMotion } of letters) {
    // From each beta position, both hands can shift CW or CCW together
    for (let i = 0; i < VERTICES.length; i++) {
      const startVertex = VERTICES[i];
      const startPos = `beta${i + 1}`;

      for (const dir of ["cw", "ccw"]) {
        const endVertex = shift(startVertex, dir);
        const endIdx = VERTICES.indexOf(endVertex);
        const endPos = `beta${endIdx + 1}`;

        rows.push(
          makeRow(letter, startPos, endPos, "tog", "same", {
            motionType: blueMotion,
            rotationDir: dir,
            startLoc: startVertex,
            endLoc: endVertex,
          }, {
            motionType: redMotion,
            rotationDir: dir,
            startLoc: startVertex,
            endLoc: endVertex,
          })
        );
      }
    }
  }
}

/**
 * Generate Beta → Gamma letters (J, K, L)
 * Both hands at same vertex, shift opposite orbital directions → gamma.
 *
 * J: tog-opp, both pro
 * K: tog-opp, both anti
 * L: tog-opp, blue pro + red anti
 */
function generateBetaToGamma() {
  const letters = [
    { letter: "J", blueMotion: "pro", redMotion: "pro" },
    { letter: "K", blueMotion: "anti", redMotion: "anti" },
    { letter: "L", blueMotion: "pro", redMotion: "anti" },
  ];

  for (const { letter, blueMotion, redMotion } of letters) {
    for (let i = 0; i < VERTICES.length; i++) {
      const startVertex = VERTICES[i];
      const startPos = `beta${i + 1}`;

      // Blue goes CW, Red goes CCW
      {
        const blueEnd = shift(startVertex, "cw");
        const redEnd = shift(startVertex, "ccw");
        const endPos = findPosition(blueEnd, redEnd);
        if (endPos) {
          rows.push(
            makeRow(letter, startPos, endPos, "tog", "opp", {
              motionType: blueMotion,
              rotationDir: "cw",
              startLoc: startVertex,
              endLoc: blueEnd,
            }, {
              motionType: redMotion,
              rotationDir: "ccw",
              startLoc: startVertex,
              endLoc: redEnd,
            })
          );
        }
      }

      // Blue goes CCW, Red goes CW
      {
        const blueEnd = shift(startVertex, "ccw");
        const redEnd = shift(startVertex, "cw");
        const endPos = findPosition(blueEnd, redEnd);
        if (endPos) {
          rows.push(
            makeRow(letter, startPos, endPos, "tog", "opp", {
              motionType: blueMotion,
              rotationDir: "ccw",
              startLoc: startVertex,
              endLoc: blueEnd,
            }, {
              motionType: redMotion,
              rotationDir: "cw",
              startLoc: startVertex,
              endLoc: redEnd,
            })
          );
        }
      }
    }
  }
}

/**
 * Generate Gamma → Gamma Type 1 letters (M, N, O, P, Q, R)
 * Both hands at different vertices, both shift.
 *
 * There are 4 orbital combos from any gamma:
 *   blue CW + red CW   → may produce gamma or beta
 *   blue CW + red CCW   → may produce gamma or beta
 *   blue CCW + red CW   → may produce gamma or beta
 *   blue CCW + red CCW  → may produce gamma or beta
 *
 * We filter to only gamma→gamma outcomes.
 *
 * M: split-opp, both pro     (M/N/O parallel diamond M/N/O)
 * N: split-opp, both anti
 * O: split-opp, blue pro + red anti
 * P: split-same, both pro    (P/Q/R parallel diamond P/Q/R)
 * Q: split-same, both anti
 * R: split-same, blue pro + red anti
 */
function generateGammaToGamma() {
  const letters = [
    { letter: "M", timing: "split", direction: "opp", blueMotion: "pro", redMotion: "pro" },
    { letter: "N", timing: "split", direction: "opp", blueMotion: "anti", redMotion: "anti" },
    { letter: "O", timing: "split", direction: "opp", blueMotion: "pro", redMotion: "anti" },
    { letter: "P", timing: "split", direction: "same", blueMotion: "pro", redMotion: "pro" },
    { letter: "Q", timing: "split", direction: "same", blueMotion: "anti", redMotion: "anti" },
    { letter: "R", timing: "split", direction: "same", blueMotion: "pro", redMotion: "anti" },
  ];

  // For each letter, find which orbital direction combos produce gamma→gamma
  for (const { letter, timing, direction, blueMotion, redMotion } of letters) {
    // Determine which orbital combos match the timing/direction
    // "same direction" = both hands orbit same way (both CW or both CCW)
    // "opp direction" = hands orbit opposite ways (one CW, one CCW)
    const orbitalCombos =
      direction === "same"
        ? [["cw", "cw"], ["ccw", "ccw"]]
        : [["cw", "ccw"], ["ccw", "cw"]];

    // From each gamma position
    const gammaPositions = POSITIONS.filter((p) => p.name.startsWith("gamma"));

    for (const startP of gammaPositions) {
      for (const [blueDir, redDir] of orbitalCombos) {
        const blueEnd = shift(startP.blue, blueDir);
        const redEnd = shift(startP.red, redDir);
        const endPos = findPosition(blueEnd, redEnd);

        // Only keep gamma→gamma transitions
        if (endPos && positionGroup(endPos) === "gamma") {
          rows.push(
            makeRow(letter, startP.name, endPos, timing, direction, {
              motionType: blueMotion,
              rotationDir: blueDir,
              startLoc: startP.blue,
              endLoc: blueEnd,
            }, {
              motionType: redMotion,
              rotationDir: redDir,
              startLoc: startP.red,
              endLoc: redEnd,
            })
          );
        }
      }
    }
  }
}

/**
 * Generate Gamma → Gamma quarter-time letters (S, T, U, V)
 *
 * Quarter-time means the hands are offset by 1/4 of the cycle.
 * On the trigrid, this likely means one hand shifts while the other
 * is mid-shift (creating an offset timing pattern).
 *
 * S: quarter-same, both pro
 * T: quarter-same, both anti
 * U: quarter-same, blue pro + red anti
 * V: quarter-opp, both pro
 *
 * NOTE: Quarter-time on trigrid needs domain verification.
 * Using same orbital combos as M-R for now with "quarter" timing.
 */
function generateQuarterTime() {
  const letters = [
    { letter: "S", timing: "quarter", direction: "same", blueMotion: "pro", redMotion: "pro" },
    { letter: "T", timing: "quarter", direction: "same", blueMotion: "anti", redMotion: "anti" },
    { letter: "U", timing: "quarter", direction: "same", blueMotion: "pro", redMotion: "anti" },
    { letter: "V", timing: "quarter", direction: "opp", blueMotion: "pro", redMotion: "pro" },
  ];

  const gammaPositions = POSITIONS.filter((p) => p.name.startsWith("gamma"));

  for (const { letter, timing, direction, blueMotion, redMotion } of letters) {
    const orbitalCombos =
      direction === "same"
        ? [["cw", "cw"], ["ccw", "ccw"]]
        : [["cw", "ccw"], ["ccw", "cw"]];

    for (const startP of gammaPositions) {
      for (const [blueDir, redDir] of orbitalCombos) {
        const blueEnd = shift(startP.blue, blueDir);
        const redEnd = shift(startP.red, redDir);
        const endPos = findPosition(blueEnd, redEnd);

        if (endPos && positionGroup(endPos) === "gamma") {
          rows.push(
            makeRow(letter, startP.name, endPos, timing, direction, {
              motionType: blueMotion,
              rotationDir: blueDir,
              startLoc: startP.blue,
              endLoc: blueEnd,
            }, {
              motionType: redMotion,
              rotationDir: redDir,
              startLoc: startP.red,
              endLoc: redEnd,
            })
          );
        }
      }
    }
  }
}

/**
 * Generate Type 2 letters (W, X, Y, Z)
 * One hand shifts, one stays static.
 *
 * W: gamma→gamma, blue shifts pro, red static
 * X: gamma→gamma, blue shifts anti, red static
 * Y: gamma→beta, blue shifts pro, red static
 * Z: gamma→beta, blue shifts anti, red static
 */
function generateType2() {
  const gammaPositions = POSITIONS.filter((p) => p.name.startsWith("gamma"));

  // W and X: gamma→gamma, one shift one static
  for (const { letter, shiftMotion } of [
    { letter: "W", shiftMotion: "pro" },
    { letter: "X", shiftMotion: "anti" },
  ]) {
    for (const startP of gammaPositions) {
      for (const dir of ["cw", "ccw"]) {
        // Blue shifts, red stays
        {
          const blueEnd = shift(startP.blue, dir);
          const endPos = findPosition(blueEnd, startP.red);
          if (endPos && positionGroup(endPos) === "gamma") {
            rows.push(
              makeRow(letter, startP.name, endPos, "split", "opp", {
                motionType: shiftMotion,
                rotationDir: dir,
                startLoc: startP.blue,
                endLoc: blueEnd,
              }, {
                motionType: "static",
                rotationDir: "noRotation",
                startLoc: startP.red,
                endLoc: startP.red,
              })
            );
          }
        }

        // Red shifts, blue stays
        {
          const redEnd = shift(startP.red, dir);
          const endPos = findPosition(startP.blue, redEnd);
          if (endPos && positionGroup(endPos) === "gamma") {
            rows.push(
              makeRow(letter, startP.name, endPos, "split", "opp", {
                motionType: "static",
                rotationDir: "noRotation",
                startLoc: startP.blue,
                endLoc: startP.blue,
              }, {
                motionType: shiftMotion,
                rotationDir: dir,
                startLoc: startP.red,
                endLoc: redEnd,
              })
            );
          }
        }
      }
    }
  }

  // Y and Z: gamma→beta, one shift one static
  for (const { letter, shiftMotion } of [
    { letter: "Y", shiftMotion: "pro" },
    { letter: "Z", shiftMotion: "anti" },
  ]) {
    for (const startP of gammaPositions) {
      for (const dir of ["cw", "ccw"]) {
        // Blue shifts to red's vertex → beta
        {
          const blueEnd = shift(startP.blue, dir);
          if (blueEnd === startP.red) {
            const endPos = findPosition(blueEnd, startP.red);
            if (endPos && positionGroup(endPos) === "beta") {
              rows.push(
                makeRow(letter, startP.name, endPos, "split", "opp", {
                  motionType: shiftMotion,
                  rotationDir: dir,
                  startLoc: startP.blue,
                  endLoc: blueEnd,
                }, {
                  motionType: "static",
                  rotationDir: "noRotation",
                  startLoc: startP.red,
                  endLoc: startP.red,
                })
              );
            }
          }
        }

        // Red shifts to blue's vertex → beta
        {
          const redEnd = shift(startP.red, dir);
          if (redEnd === startP.blue) {
            const endPos = findPosition(startP.blue, redEnd);
            if (endPos && positionGroup(endPos) === "beta") {
              rows.push(
                makeRow(letter, startP.name, endPos, "split", "opp", {
                  motionType: "static",
                  rotationDir: "noRotation",
                  startLoc: startP.blue,
                  endLoc: startP.blue,
                }, {
                  motionType: shiftMotion,
                  rotationDir: dir,
                  startLoc: startP.red,
                  endLoc: redEnd,
                })
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Generate Type 6 static letters (β, γ)
 * Both hands stay in place. No orbital motion.
 */
function generateStatic() {
  // β: static at beta positions
  for (let i = 0; i < VERTICES.length; i++) {
    const v = VERTICES[i];
    const pos = `beta${i + 1}`;
    rows.push(
      makeRow("β", pos, pos, "none", "none", {
        motionType: "static",
        rotationDir: "noRotation",
        startLoc: v,
        endLoc: v,
      }, {
        motionType: "static",
        rotationDir: "noRotation",
        startLoc: v,
        endLoc: v,
      })
    );
  }

  // γ: static at gamma positions
  const gammaPositions = POSITIONS.filter((p) => p.name.startsWith("gamma"));
  for (const gp of gammaPositions) {
    rows.push(
      makeRow("γ", gp.name, gp.name, "none", "none", {
        motionType: "static",
        rotationDir: "noRotation",
        startLoc: gp.blue,
        endLoc: gp.blue,
      }, {
        motionType: "static",
        rotationDir: "noRotation",
        startLoc: gp.red,
        endLoc: gp.red,
      })
    );
  }
}

// ============================================================================
// Main
// ============================================================================

// Generate all rows
generateBetaToBeta();     // G, H, I
generateBetaToGamma();    // J, K, L
generateGammaToGamma();   // M, N, O, P, Q, R
generateQuarterTime();    // S, T, U, V
generateType2();          // W, X, Y, Z
generateStatic();         // β, γ

// Sort by letter, then start position
rows.sort((a, b) => {
  const [aLetter, aStart] = a.split(",");
  const [bLetter, bStart] = b.split(",");
  if (aLetter !== bLetter) return aLetter.localeCompare(bLetter);
  return aStart.localeCompare(bStart);
});

const csv = [CSV_HEADER, ...rows].join("\n") + "\n";

// Stats
const letterCounts = {};
for (const row of rows) {
  const letter = row.split(",")[0];
  letterCounts[letter] = (letterCounts[letter] || 0) + 1;
}

console.log("=== Trigrid Dataframe Generation ===\n");
console.log(`Total rows: ${rows.length}`);
console.log(`Unique letters: ${Object.keys(letterCounts).length}`);
console.log("\nPer-letter counts:");
for (const [letter, count] of Object.entries(letterCounts).sort()) {
  console.log(`  ${letter}: ${count} variations`);
}

// Verify transition coverage
const transitionPairs = new Set();
for (const row of rows) {
  const parts = row.split(",");
  const startGroup = positionGroup(parts[1]);
  const endGroup = positionGroup(parts[2]);
  transitionPairs.add(`${startGroup}→${endGroup}`);
}
console.log("\nTransition coverage:", [...transitionPairs].sort().join(", "));

const dryRun = process.argv.includes("--dry-run");
if (dryRun) {
  console.log("\n[DRY RUN] Would write to static/data/pictographs/TrigridPictographDataframe.csv");
  console.log("\nFirst 10 rows:");
  console.log(CSV_HEADER);
  rows.slice(0, 10).forEach((r) => console.log(r));
} else {
  const outPath = path.join(
    __dirname,
    "..",
    "static",
    "data",
    "pictographs",
    "TrigridPictographDataframe.csv"
  );
  fs.writeFileSync(outPath, csv, "utf-8");
  console.log(`\nWritten to: ${outPath}`);
}
