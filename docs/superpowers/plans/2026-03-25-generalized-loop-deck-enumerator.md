# Generalized LOOP Deck Enumerator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a parameterized CLI script that exhaustively enumerates every valid LOOP sequence for any LOOP type, slice size, seed length, and level — then deduplicates to one representative per letter-combination and outputs browsable deck data.

**Architecture:** Single CJS script (`scripts/enumerate-deck.cjs`) that loads the CSV adjacency graph, DFS-walks all paths of the specified seed length, filters by the LOOP-type-specific end-position constraint, executes the LOOP transformation via the sequence engine, deduplicates by `(startPosition, word)`, and outputs to console/JSON/Firestore.

**Tech Stack:** Node.js CJS script, `@tka/sequence-engine` compiled JS (LOOP executors, position maps, validation sets), Firebase Admin SDK (optional Firestore seeding)

**Spec:** `docs/superpowers/specs/2026-03-25-generalized-loop-deck-enumerator-design.md`

---

### Task 1: CLI Argument Parsing and Validation

**Files:**
- Create: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Create the script with CLI parsing**

```javascript
#!/usr/bin/env node
/**
 * Generalized LOOP Deck Enumerator
 *
 * Exhaustively enumerates every valid LOOP sequence for a given configuration.
 * Deduplicates to one representative per letter-combination per start position.
 *
 * Usage:
 *   node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1
 *   node scripts/enumerate-deck.cjs --loopType strict_rotated --slice quartered --seedLength 2 --level 1 --dry-run
 *   node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --out deck.json
 */

const { LOOPType } = require("../packages/sequence-engine/dist/loop/loop-types.js");

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const loopType = getArg("loopType");
const slice = getArg("slice");
const seedLength = parseInt(getArg("seedLength") || "0", 10);
const level = parseInt(getArg("level") || "0", 10);
const gridMode = getArg("gridMode") || "diamond";
const dryRun = hasFlag("dry-run");
const outPath = getArg("out");
const seedFirestore = hasFlag("seed-firestore");
const startPositionsArg = getArg("startPositions");

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALL_LOOP_TYPES = new Set(Object.values(LOOPType));

if (!loopType || !ALL_LOOP_TYPES.has(loopType)) {
  console.error(`Invalid --loopType. Must be one of: ${[...ALL_LOOP_TYPES].join(", ")}`);
  process.exit(1);
}

if (slice !== "halved" && slice !== "quartered") {
  console.error("--slice must be 'halved' or 'quartered'");
  process.exit(1);
}

if (!seedLength || seedLength < 1) {
  console.error("--seedLength must be a positive integer");
  process.exit(1);
}

if (level < 1 || level > 3) {
  console.error("--level must be 1, 2, or 3");
  process.exit(1);
}

// Validate LOOP type + slice size combination
const QUARTERED_CAPABLE = new Set([
  "strict_rotated", "rotated_swapped", "rotated_inverted",
  "mirrored_rotated", "mirrored_inverted_rotated",
  "mirrored_rotated_inverted_swapped",
]);

if (slice === "quartered" && !QUARTERED_CAPABLE.has(loopType)) {
  console.error(`LOOP type "${loopType}" only supports halved mode, not quartered.`);
  process.exit(1);
}

console.log(`\nLOOP Deck Enumerator`);
console.log(`  Type: ${loopType}`);
console.log(`  Slice: ${slice}`);
console.log(`  Seed length: ${seedLength} beats`);
console.log(`  Level: ${level}`);
console.log(`  Grid: ${gridMode}`);
console.log(`  Dry run: ${dryRun}`);
if (outPath) console.log(`  Output: ${outPath}`);
console.log("");
```

- [ ] **Step 2: Run to verify CLI parsing works**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --dry-run`
Expected: Prints configuration summary without errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): scaffold generalized LOOP deck enumerator CLI"
```

---

### Task 2: CSV Loading and Adjacency Map Construction

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add CSV loading and level-filtered adjacency map**

Append after the validation section:

```javascript
// ---------------------------------------------------------------------------
// CSV Loading
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const CSV_PATHS = {
  diamond: path.join(__dirname, "..", "static", "data", "pictographs", "DiamondPictographDataframe.csv"),
  box: path.join(__dirname, "..", "static", "data", "pictographs", "BoxPictographDataframe.csv"),
  skewed: path.join(__dirname, "..", "static", "data", "pictographs", "SkewedPictographDataframe.csv"),
};

const csvPath = CSV_PATHS[gridMode];
if (!csvPath || !fs.existsSync(csvPath)) {
  console.error(`No CSV found for grid mode "${gridMode}"`);
  process.exit(1);
}

const csvContent = fs.readFileSync(csvPath, "utf-8");
const csvLines = csvContent.split("\n");
const headers = csvLines[0].split(",").map(h => h.trim());

// Level -> maximum turns allowed
const LEVEL_MAX_TURNS = { 1: 0, 2: 1, 3: 1 };
// Level 3 also allows 0.5 (float) — handled in the filter
const maxTurns = LEVEL_MAX_TURNS[level] ?? 0;

const edges = [];
for (let i = 1; i < csvLines.length; i++) {
  const cols = csvLines[i].split(",").map(c => c.trim());
  if (cols.length < 13 || !cols[0]) continue;

  const edge = {
    letter: cols[0],
    startPos: cols[1],
    endPos: cols[2],
    timing: cols[3],
    direction: cols[4],
    blueMotionType: cols[5],
    blueRotDir: cols[6],
    blueStartLoc: cols[7],
    blueEndLoc: cols[8],
    redMotionType: cols[9],
    redRotDir: cols[10],
    redStartLoc: cols[11],
    redEndLoc: cols[12],
  };

  // Level filtering: L1 = 0 turns only (all CSV rows are 0-turn at base)
  // Turn allocation happens separately; the CSV data is all 0-turn variations.
  // So for L1 enumeration, we use all CSV rows as-is.
  // For L2/L3, we'd need to generate turn-allocated variants — deferred for now.
  edges.push(edge);
}

// Build adjacency map: startPosition -> [edges]
const adjacency = {};
for (const e of edges) {
  if (!adjacency[e.startPos]) adjacency[e.startPos] = [];
  adjacency[e.startPos].push(e);
}

console.log(`Loaded ${edges.length} variations from ${gridMode} CSV`);
console.log(`Adjacency map: ${Object.keys(adjacency).length} positions\n`);
```

- [ ] **Step 2: Test CSV loading**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --dry-run`
Expected: "Loaded 576 variations from diamond CSV" (or similar count) + adjacency map size.

- [ ] **Step 3: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): add CSV loading and adjacency map construction"
```

---

### Task 3: End-Position Constraint Resolution

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add LOOP-type-specific validation set lookup**

Append after adjacency map construction:

```javascript
// ---------------------------------------------------------------------------
// End-Position Constraint Resolution
// ---------------------------------------------------------------------------

const {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
  HALVED_LOOPS,
  QUARTERED_LOOPS,
} = require("../packages/sequence-engine/dist/loop/position-maps/circular-position-maps.js");

const {
  INVERTED_LOOP_VALIDATION_SET,
  MIRRORED_LOOP_VALIDATION_SET,
  FLIPPED_LOOP_VALIDATION_SET,
  SWAPPED_LOOP_VALIDATION_SET,
  MIRRORED_SWAPPED_VALIDATION_SET,
  MIRRORED_INVERTED_VALIDATION_SET,
  ROTATED_SWAPPED_HALVED_VALIDATION_SET,
  ROTATED_SWAPPED_QUARTERED_VALIDATION_SET,
} = require("../packages/sequence-engine/dist/loop/position-maps/strict-loop-position-maps.js");

/**
 * Get the validation set for a given LOOP type + slice size.
 * Returns a Set of "start,end" strings that are valid seed endpoints.
 */
function getValidationSet(lt, sl) {
  switch (lt) {
    case "strict_rotated":
      return sl === "quartered" ? QUARTERED_LOOPS : HALVED_LOOPS;
    case "strict_mirrored":
      return MIRRORED_LOOP_VALIDATION_SET;
    case "strict_flipped":
      return FLIPPED_LOOP_VALIDATION_SET;
    case "strict_swapped":
      return SWAPPED_LOOP_VALIDATION_SET;
    case "strict_inverted":
    case "swapped_inverted":
    case "rewound":
      return INVERTED_LOOP_VALIDATION_SET;
    case "mirrored_swapped":
      return MIRRORED_SWAPPED_VALIDATION_SET;
    case "mirrored_inverted":
      return MIRRORED_INVERTED_VALIDATION_SET;
    case "rotated_swapped":
      return sl === "quartered"
        ? ROTATED_SWAPPED_QUARTERED_VALIDATION_SET
        : ROTATED_SWAPPED_HALVED_VALIDATION_SET;
    case "rotated_inverted":
      return sl === "quartered" ? QUARTERED_LOOPS : HALVED_LOOPS;
    case "mirrored_rotated":
    case "mirrored_inverted_rotated":
    case "mirrored_rotated_inverted_swapped":
      // These use composed position constraints — fall back to HALVED_LOOPS
      // for halved, QUARTERED_LOOPS for quartered (rotation is the base constraint)
      return sl === "quartered" ? QUARTERED_LOOPS : HALVED_LOOPS;
    default:
      console.error(`No validation set for LOOP type "${lt}"`);
      process.exit(1);
  }
}

const validationSet = getValidationSet(loopType, slice);

// Determine valid start positions and their required end positions
const DEFAULT_STARTS = ["alpha1", "beta5", "gamma11"];
const requestedStarts = startPositionsArg
  ? startPositionsArg.split(",").map(s => s.trim())
  : DEFAULT_STARTS;

// Build start -> requiredEnd map from validation set
const startEndMap = {};
for (const pair of validationSet) {
  const [start, end] = pair.split(",");
  if (requestedStarts.includes(start)) {
    startEndMap[start] = end;
  }
}

const validStarts = Object.keys(startEndMap);
if (validStarts.length === 0) {
  console.error("No valid start positions found for this LOOP type + slice combination.");
  console.error(`Requested: ${requestedStarts.join(", ")}`);
  process.exit(1);
}

console.log("Start positions and required endpoints:");
for (const [start, end] of Object.entries(startEndMap)) {
  console.log(`  ${start} → must end at ${end}`);
}
console.log("");
```

- [ ] **Step 2: Test constraint resolution for halved rotated**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --dry-run`
Expected: Shows alpha1→alpha5, beta5→beta1, gamma11→gamma3 (or similar 180° pairs).

- [ ] **Step 3: Test constraint resolution for quartered rotated (existing L1 case)**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice quartered --seedLength 2 --level 1 --dry-run`
Expected: Shows alpha1→alpha3, beta5→beta7, gamma11→gamma13.

- [ ] **Step 4: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): add LOOP-type-specific end-position constraint resolution"
```

---

### Task 4: DFS Tree Walk Enumeration

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add DFS enumeration of valid seed paths**

Append after constraint resolution:

```javascript
// ---------------------------------------------------------------------------
// Letter Types (for hand-path family grouping)
// ---------------------------------------------------------------------------

const TYPES = {
  'A': 1, 'B': 1, 'C': 1, 'D': 1, 'E': 1, 'F': 1,
  'G': 1, 'H': 1, 'I': 1, 'J': 1, 'K': 1, 'L': 1,
  'M': 1, 'N': 1, 'O': 1, 'P': 1, 'Q': 1, 'R': 1,
  'S': 1, 'T': 1, 'U': 1, 'V': 1,
  'W': 2, 'X': 2, 'Y': 2, 'Z': 2, 'Σ': 2, 'Δ': 2, 'Θ': 2, 'Ω': 2,
  'W-': 3, 'X-': 3, 'Y-': 3, 'Z-': 3, 'Σ-': 3, 'Δ-': 3, 'Θ-': 3, 'Ω-': 3,
  'Φ': 4, 'Ψ': 4, 'Λ': 4,
  'Φ-': 5, 'Ψ-': 5, 'Λ-': 5,
  'α': 6, 'β': 6, 'γ': 6,
};

const TYPE_NAMES = {
  1: 'Dual-Shift', 2: 'Shift', 3: 'Cross-Shift',
  4: 'Dash', 5: 'Dual-Dash', 6: 'Static',
};

// ---------------------------------------------------------------------------
// DFS Enumeration
// ---------------------------------------------------------------------------

/**
 * Check if two consecutive beats have compatible rotation directions.
 */
function rotationCompatible(prevEdge, nextEdge) {
  // noRotation is compatible with anything
  if (prevEdge.blueRotDir === "noRotation" || nextEdge.blueRotDir === "noRotation") {
    // Check red independently
    if (prevEdge.redRotDir !== "noRotation" && nextEdge.redRotDir !== "noRotation") {
      return prevEdge.redRotDir === nextEdge.redRotDir;
    }
    return true;
  }
  if (prevEdge.redRotDir === "noRotation" || nextEdge.redRotDir === "noRotation") {
    return prevEdge.blueRotDir === nextEdge.blueRotDir;
  }
  return prevEdge.blueRotDir === nextEdge.blueRotDir &&
         prevEdge.redRotDir === nextEdge.redRotDir;
}

/**
 * Enumerate all valid seeds of the given length from a start position.
 * Uses depth-first search. Only keeps paths that end at requiredEnd.
 *
 * @param {string} startPos - Starting grid position
 * @param {string} requiredEnd - Required end position for LOOP closure
 * @param {number} depth - Number of beats in seed
 * @returns {Array} Array of valid seeds (each is an array of edges)
 */
function enumerateSeeds(startPos, requiredEnd, depth) {
  const results = [];

  function dfs(currentPos, path) {
    if (path.length === depth) {
      // Check if we've reached the required end position
      if (currentPos === requiredEnd) {
        results.push([...path]);
      }
      return;
    }

    const neighbors = adjacency[currentPos] || [];
    for (const edge of neighbors) {
      // Check rotation continuity with previous beat
      if (path.length > 0 && !rotationCompatible(path[path.length - 1], edge)) {
        continue;
      }
      path.push(edge);
      dfs(edge.endPos, path);
      path.pop();
    }
  }

  dfs(startPos, []);
  return results;
}

// Enumerate from each start position
let totalRawSeeds = 0;
const allSeeds = []; // { startPos, edges[], seedWord, handPathFamily }

for (const startPos of validStarts) {
  const requiredEnd = startEndMap[startPos];
  const seeds = enumerateSeeds(startPos, requiredEnd, seedLength);
  totalRawSeeds += seeds.length;

  for (const edges of seeds) {
    const seedWord = edges.map(e => e.letter).join("");
    const handPathFamily = edges
      .map(e => TYPE_NAMES[TYPES[e.letter] || 0] || "Unknown")
      .join("+");

    allSeeds.push({ startPos, edges, seedWord, handPathFamily });
  }

  console.log(`  ${startPos}: ${seeds.length} raw seeds found`);
}

console.log(`\nTotal raw seeds: ${totalRawSeeds}`);
```

- [ ] **Step 2: Test DFS enumeration for quartered 2-beat (should match ~200 before dedup)**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice quartered --seedLength 2 --level 1 --dry-run`
Expected: Raw seed counts per start position, total should be near the L1 deck's pre-dedup count.

- [ ] **Step 3: Test DFS enumeration for halved 3-beat**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --dry-run`
Expected: Prints raw seed counts — this is the first time we'll see the actual number.

- [ ] **Step 4: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): add DFS tree walk for seed enumeration"
```

---

### Task 5: Deduplication and Grouping

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add dedup by (startPosition, seedWord) and grouping**

Append after enumeration:

```javascript
// ---------------------------------------------------------------------------
// Deduplication: one representative per (startPosition, seedWord)
// ---------------------------------------------------------------------------

const deduped = [];
const seen = new Set();

for (const seed of allSeeds) {
  const key = `${seed.startPos}|${seed.seedWord}`;
  if (seen.has(key)) continue;
  seen.add(key);
  deduped.push(seed);
}

console.log(`After dedup: ${deduped.length} unique sequences (from ${totalRawSeeds} raw)`);

// ---------------------------------------------------------------------------
// Group by hand-path family
// ---------------------------------------------------------------------------

const groups = {};
for (const entry of deduped) {
  if (!groups[entry.handPathFamily]) groups[entry.handPathFamily] = [];
  groups[entry.handPathFamily].push(entry);
}

// Sort groups by type combination (lower types first)
const sortedGroups = Object.entries(groups).sort((a, b) => {
  const aTypes = a[1][0].edges.map(e => TYPES[e.letter] || 99);
  const bTypes = b[1][0].edges.map(e => TYPES[e.letter] || 99);
  for (let i = 0; i < Math.max(aTypes.length, bTypes.length); i++) {
    const diff = (aTypes[i] || 0) - (bTypes[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
});
```

- [ ] **Step 2: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): add deduplication and hand-path family grouping"
```

---

### Task 6: Console Output (Count Table + Deck Listing)

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add formatted console output**

Append after grouping:

```javascript
// ---------------------------------------------------------------------------
// Console Output
// ---------------------------------------------------------------------------

const posLabels = { alpha1: "α1", beta5: "β5", gamma11: "γ11" };

console.log("");
console.log("╔═══════════════════════════════════════════════════════════════╗");
console.log(`║   LEVEL ${level} · ${slice.toUpperCase()} ${loopType.toUpperCase()} LOOP DECK`);
console.log(`║   ${gridMode} grid · ${seedLength}-beat seed · ${seedLength * (slice === "quartered" ? 4 : 2)} total beats`);
console.log(`║   Start positions: ${validStarts.join(", ")}`);
console.log("╚═══════════════════════════════════════════════════════════════╝");

let deckNum = 1;
for (const [family, items] of sortedGroups) {
  console.log("");
  console.log(`  ╔═══ ${family} ═══ ${items.length} sequences ═══╗`);

  for (const startPos of validStarts) {
    const subset = items.filter(i => i.startPos === startPos);
    if (subset.length === 0) continue;

    const label = posLabels[startPos] || startPos;
    console.log(`  ║`);
    console.log(`  ║  From ${label} (${startPos}):`);

    for (const item of subset) {
      const num = String(deckNum).padStart(3, " ");
      console.log(`  ║  #${num}  ${item.seedWord}`);
      deckNum++;
    }
  }
  console.log(`  ╚${"═".repeat(58)}`);
}

// Summary table
console.log("");
console.log("═".repeat(62));
console.log(`  TOTAL: ${deduped.length} unique sequences in the Level ${level} ${slice} ${loopType} Deck`);
console.log("═".repeat(62));

// Per-start-position summary
console.log("");
const colWidth = Math.max(...validStarts.map(s => (posLabels[s] || s).length)) + 2;
const headerRow = validStarts.map(s => (posLabels[s] || s).padStart(colWidth)).join(" │");
console.log(`  ┌${"─".repeat(28)}┬${validStarts.map(() => "─".repeat(colWidth + 1)).join("┬")}┬${"─".repeat(7)}┐`);
console.log(`  │ Hand Path${" ".repeat(18)}│${headerRow} │ Total │`);
console.log(`  ├${"─".repeat(28)}┼${validStarts.map(() => "─".repeat(colWidth + 1)).join("┼")}┼${"─".repeat(7)}┤`);

for (const [family, items] of sortedGroups) {
  const counts = validStarts.map(s => items.filter(i => i.startPos === s).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const countCols = counts.map(c => String(c).padStart(colWidth)).join(" │");
  console.log(`  │ ${family.padEnd(27)}│${countCols} │ ${String(total).padStart(5)} │`);
}

const totals = validStarts.map(s => deduped.filter(i => i.startPos === s).length);
const totalCols = totals.map(c => String(c).padStart(colWidth)).join(" │");
console.log(`  ├${"─".repeat(28)}┼${validStarts.map(() => "─".repeat(colWidth + 1)).join("┼")}┼${"─".repeat(7)}┤`);
console.log(`  │ TOTAL${" ".repeat(22)}│${totalCols} │ ${String(deduped.length).padStart(5)} │`);
console.log(`  └${"─".repeat(28)}┴${validStarts.map(() => "─".repeat(colWidth + 1)).join("┴")}┴${"─".repeat(7)}┘`);
```

- [ ] **Step 2: Test quartered 2-beat output matches L1 deck count of 192**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice quartered --seedLength 2 --level 1 --dry-run`
Expected: TOTAL = 192 (matching the existing `enumerate-l1-deck.cjs`).

- [ ] **Step 3: Run the existing L1 script and compare letter-pair seeds**

Run: `node scripts/enumerate-l1-deck.cjs 2>&1 | grep "TOTAL"`
Compare the total and per-start-position counts with the new script's output.

- [ ] **Step 4: Run halved 3-beat to discover the deck size**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --dry-run`
Expected: First-ever complete count of the L1 halved 3-beat rotated deck.

- [ ] **Step 5: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): add formatted console output with count tables"
```

---

### Task 7: JSON File Output

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add JSON output with --out flag**

Append after console output:

```javascript
// ---------------------------------------------------------------------------
// JSON Output
// ---------------------------------------------------------------------------

if (outPath) {
  const output = {
    metadata: {
      loopType,
      sliceSize: slice,
      seedLength,
      level,
      gridMode,
      totalSequences: deduped.length,
      startPositions: validStarts,
      generatedAt: new Date().toISOString(),
    },
    families: sortedGroups.map(([family, items]) => ({
      name: family,
      count: items.length,
      sequences: items.map(item => ({
        seedWord: item.seedWord,
        startPosition: item.startPos,
        handPathFamily: item.handPathFamily,
        path: item.edges.map(e => e.startPos).concat(item.edges[item.edges.length - 1].endPos),
        beats: item.edges.map(e => ({
          letter: e.letter,
          startPos: e.startPos,
          endPos: e.endPos,
          blueMotionType: e.blueMotionType,
          blueRotDir: e.blueRotDir,
          blueStartLoc: e.blueStartLoc,
          blueEndLoc: e.blueEndLoc,
          redMotionType: e.redMotionType,
          redRotDir: e.redRotDir,
          redStartLoc: e.redStartLoc,
          redEndLoc: e.redEndLoc,
        })),
      })),
    })),
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nDeck written to ${outPath}`);
}

if (!outPath && !seedFirestore) {
  console.log("\nUse --out <path> to save as JSON or --seed-firestore to write to Firestore.");
}
```

- [ ] **Step 2: Test JSON output**

Run: `node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --out /tmp/test-deck.json`
Expected: JSON file written with metadata + families + sequences.

- [ ] **Step 3: Verify JSON structure**

Run: `node -e "const d = require('/tmp/test-deck.json'); console.log('Sequences:', d.metadata.totalSequences, 'Families:', d.families.length)"`
Expected: Counts match console output.

- [ ] **Step 4: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(enumerate): add JSON file output with --out flag"
```

---

### Task 8: Validation Against Existing L1 Deck

**Files:**
- No new files — this is a verification task

- [ ] **Step 1: Run both scripts and compare**

Run the old script:
```bash
node scripts/enumerate-l1-deck.cjs 2>&1 | tail -20
```

Run the new script:
```bash
node scripts/enumerate-deck.cjs --loopType strict_rotated --slice quartered --seedLength 2 --level 1 --dry-run
```

Compare:
- Total count should be 192 in both
- Per-start-position counts should match (64 each)
- Hand-path family counts should match

- [ ] **Step 2: Compare actual letter-pair seeds**

```bash
node scripts/enumerate-deck.cjs --loopType strict_rotated --slice quartered --seedLength 2 --level 1 --out /tmp/new-deck.json
node -e "
const d = require('/tmp/new-deck.json');
const seeds = d.families.flatMap(f => f.sequences.map(s => s.seedWord)).sort();
console.log('Seeds:', seeds.length);
console.log('First 10:', seeds.slice(0, 10));
console.log('Last 10:', seeds.slice(-10));
"
```

Expected: 192 seeds, matching the L1 deck's letter pairs.

- [ ] **Step 3: If counts differ, investigate and fix**

The most likely discrepancy source is the rotation continuity check — the L1 script checks boundary continuity (b2→b1 rotated), while the generalized script only checks sequential continuity. If counts differ, add boundary continuity checking.

- [ ] **Step 4: Commit any fixes**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "fix(enumerate): align with L1 deck validation"
```

---

### Task 9: Run the Target Deck — L1 Halved Strict Rotated 3-Beat

**Files:**
- No new files — this is the discovery run

- [ ] **Step 1: Generate the deck**

```bash
node scripts/enumerate-deck.cjs --loopType strict_rotated --slice halved --seedLength 3 --level 1 --out decks/strict_rotated_halved_L1_3beat.json
```

- [ ] **Step 2: Record the results**

Note the total count, per-start-position breakdown, and hand-path family distribution. This is the first complete enumeration of this deck — the numbers are new knowledge.

- [ ] **Step 3: Commit the deck data**

```bash
git add decks/strict_rotated_halved_L1_3beat.json
git commit -m "data: L1 halved strict_rotated 3-beat deck enumeration"
```
