# Reversal Pattern Deck Expansion - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 reversal patterns as a new browseable dimension to both VTG and LOOP deck collections, starting with the 6 simple patterns (Phase 1).

**Architecture:** Reversal patterns are orthogonal to existing deck dimensions (loop type, beat count, turns, hand path family). The enumerator generates continuous sequences first, then applies reversal transformations as a post-processing step. Each reversal variant becomes its own deck in Firestore. The UI adds BY REVERSAL as a third browseable axis alongside BY FAMILY/BY RATIO (VTG) and BY BEATS/BY TURNS (LOOPs).

**Tech Stack:** TypeScript, Svelte 5, CJS scripts (enumerator/seeder), Firebase Firestore, CSV pictograph data

**Spec:** `docs/superpowers/specs/2026-03-26-reversal-pattern-deck-expansion-design.md`
**Reference:** `docs/reference/reversal-patterns.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/features/choreo-card/domain/reversal-patterns.ts` | Reversal pattern definitions (15 patterns, lookup helpers) |
| `src/lib/features/choreo-card/components/VtgReversalGrid.svelte` | BY REVERSAL card grid for VTG view |
| `src/lib/features/choreo-card/components/ReversalPatternCard.svelte` | Individual reversal pattern card with dot visualization |
| `src/lib/features/choreo-card/components/LoopCollectionView.svelte` | Multi-axis LOOP browser (replaces flat list) |
| `src/lib/features/choreo-card/components/LoopBeatGrid.svelte` | BY BEATS card grid |
| `src/lib/features/choreo-card/components/LoopTurnsGrid.svelte` | BY TURNS card grid |
| `src/lib/features/choreo-card/components/LoopReversalGrid.svelte` | BY REVERSAL card grid for LOOPs |
| `scripts/apply-reversal-pattern.cjs` | Reversal transformation logic (shared by enumerator and seeder) |
| `scripts/seed-reversal-decks.cjs` | Seed reversal variant decks to Firestore |
| `tests/unit/reversal-pattern-transform.test.ts` | Tests for reversal transformation (silent bug risk) |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/choreo-card/domain/models/Deck.ts` | Add `reversalPattern`, `loopType`, `beatCount` fields |
| `src/lib/features/choreo-card/components/VtgCollectionView.svelte` | Add BY REVERSAL as third toggle option |
| `src/lib/features/choreo-card/components/DeckBrowser.svelte` | Route LOOPs collection to LoopCollectionView instead of flat list |
| `scripts/enumerate-deck.cjs` | Add `--reversalPattern` flag, import transformation |

---

## Task 1: Reversal Pattern Definitions

**Files:**
- Create: `src/lib/features/choreo-card/domain/reversal-patterns.ts`

- [ ] **Step 1: Create the reversal pattern config file**

```typescript
// src/lib/features/choreo-card/domain/reversal-patterns.ts

export interface ReversalPatternDef {
  readonly id: string;
  readonly label: string;
  readonly family: 'simple' | 'solo' | 'dense-weave' | 'sparse-weave';
  readonly sequence: string;
  readonly period: number;
  readonly minBeats: number;
}

export const REVERSAL_PATTERNS: readonly ReversalPatternDef[] = [
  // Simple family (period 1-2)
  { id: 'continuous',   label: 'Continuous',   family: 'simple', sequence: '----', period: 1, minBeats: 4 },
  { id: 'book',         label: 'Book',         family: 'simple', sequence: 'PPPP', period: 1, minBeats: 4 },
  { id: 'red-book',     label: 'Red Book',     family: 'simple', sequence: 'RRRR', period: 1, minBeats: 4 },
  { id: 'blue-book',    label: 'Blue Book',    family: 'simple', sequence: 'BBBB', period: 1, minBeats: 4 },
  { id: 'long-book',    label: 'Long Book',    family: 'simple', sequence: 'P-P-', period: 2, minBeats: 4 },
  { id: 'alternating',  label: 'Alternating',  family: 'simple', sequence: 'RBRB', period: 2, minBeats: 4 },
  // Solo family (period 8-32)
  { id: 'solo-1', label: 'Solo 1', family: 'solo', sequence: 'RBBRBRRB',                                 period: 8,  minBeats: 8 },
  { id: 'solo-2', label: 'Solo 2', family: 'solo', sequence: 'RBBRBRRBBRRBRBBR',                         period: 16, minBeats: 16 },
  { id: 'solo-3', label: 'Solo 3', family: 'solo', sequence: 'RBBRBRRBBRRBRBBRBRRBRBBRRBBRBRRB',         period: 32, minBeats: 32 },
  // Dense Weave family (period 8-32)
  { id: 'dense-weave-1', label: 'Dense Weave 1', family: 'dense-weave', sequence: 'RPBPRPBP',                                 period: 8,  minBeats: 8 },
  { id: 'dense-weave-2', label: 'Dense Weave 2', family: 'dense-weave', sequence: 'RPBPRPBPBPRPBPRP',                         period: 16, minBeats: 16 },
  { id: 'dense-weave-3', label: 'Dense Weave 3', family: 'dense-weave', sequence: 'RPBPRPBPBPRPBPRPBPRPBPRPRPBPRPBP',         period: 32, minBeats: 32 },
  // Sparse Weave family (period 8-32)
  { id: 'sparse-weave-1', label: 'Sparse Weave 1', family: 'sparse-weave', sequence: 'RBRPBRBP',                                 period: 8,  minBeats: 8 },
  { id: 'sparse-weave-2', label: 'Sparse Weave 2', family: 'sparse-weave', sequence: 'RBRPBRBPBRBPRBRP',                         period: 16, minBeats: 16 },
  { id: 'sparse-weave-3', label: 'Sparse Weave 3', family: 'sparse-weave', sequence: 'RBRPBRBPBRBPRBRPBRBPRBRPRBRPBRBP',         period: 32, minBeats: 32 },
] as const;

export const SIMPLE_PATTERNS = REVERSAL_PATTERNS.filter(p => p.family === 'simple');

export function getReversalPattern(id: string): ReversalPatternDef | undefined {
  return REVERSAL_PATTERNS.find(p => p.id === id);
}

export function getCompatiblePatterns(beatCount: number): ReversalPatternDef[] {
  return REVERSAL_PATTERNS.filter(p => beatCount % p.period === 0 && beatCount >= p.minBeats);
}

export const REVERSAL_FAMILIES = ['simple', 'solo', 'dense-weave', 'sparse-weave'] as const;
export type ReversalFamily = typeof REVERSAL_FAMILIES[number];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/domain/reversal-patterns.ts
git commit -m "feat(decks): add reversal pattern definitions config"
```

---

## Task 2: Extend Deck Interface

**Files:**
- Modify: `src/lib/features/choreo-card/domain/models/Deck.ts`

- [ ] **Step 1: Add new fields to Deck interface**

Add three new optional readonly fields after the existing `turns` field (line 20):

```typescript
readonly reversalPattern?: string;  // pattern id from reversal-patterns.ts. Defaults to "continuous".
readonly loopType?: string;         // "rotated", etc. Required for LOOP decks.
readonly beatCount?: number;        // 4, 6, 8, 12, 16
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/domain/models/Deck.ts
git commit -m "feat(decks): extend Deck interface with reversalPattern, loopType, beatCount"
```

---

## Task 3: Reversal Transformation Logic

This is the core algorithm. It transforms a continuous sequence by applying a reversal pattern — flipping motion types (pro↔anti) on reversed hands, then recomputing letters and orientations.

**Files:**
- Create: `scripts/apply-reversal-pattern.cjs`
- Create: `tests/unit/reversal-pattern-transform.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/reversal-pattern-transform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// We test the transformation logic at the unit level.
// These are silent-bug candidates: if pro/anti flip is wrong,
// the sequence looks valid but produces wrong letters.

describe('applyReversalToMotion', () => {
  it('flips pro to anti on a reversed hand', () => {
    // A "pro" motion with reversal should become "anti"
    const result = applyReversalToMotion('pro', true);
    expect(result).toBe('anti');
  });

  it('flips anti to pro on a reversed hand', () => {
    const result = applyReversalToMotion('anti', true);
    expect(result).toBe('pro');
  });

  it('leaves motion unchanged when not reversed', () => {
    const result = applyReversalToMotion('pro', false);
    expect(result).toBe('pro');
  });

  it('leaves static unchanged even when reversed', () => {
    // Statics at L1 have no rotation to reverse
    const result = applyReversalToMotion('static', true);
    expect(result).toBe('static');
  });
});

describe('getReversalFlagsForBeat', () => {
  it('returns both true for P symbol', () => {
    const flags = getReversalFlagsForBeat('PPPP', 0);
    expect(flags).toEqual({ blueReversal: true, redReversal: true });
  });

  it('returns red only for R symbol', () => {
    const flags = getReversalFlagsForBeat('RBRB', 0);
    expect(flags).toEqual({ blueReversal: false, redReversal: true });
  });

  it('returns blue only for B symbol', () => {
    const flags = getReversalFlagsForBeat('RBRB', 1);
    expect(flags).toEqual({ blueReversal: true, redReversal: false });
  });

  it('returns both false for - symbol', () => {
    const flags = getReversalFlagsForBeat('P-P-', 1);
    expect(flags).toEqual({ blueReversal: false, redReversal: false });
  });

  it('wraps around using modulo for beats beyond pattern length', () => {
    // Pattern 'P-' has period 2. Beat index 4 should wrap to index 0.
    const flags = getReversalFlagsForBeat('P-', 4);
    expect(flags).toEqual({ blueReversal: true, redReversal: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/reversal-pattern-transform.test.ts`
Expected: FAIL — functions not defined

- [ ] **Step 3: Write the transformation module**

Create `scripts/apply-reversal-pattern.cjs`:

```javascript
// scripts/apply-reversal-pattern.cjs
// Reversal transformation logic for deck enumeration.
// Applies a reversal pattern string to a sequence, flipping motion types
// and setting reversal flags per beat.

/**
 * Reversal pattern definitions (inlined for CJS — canonical source is
 * src/lib/features/choreo-card/domain/reversal-patterns.ts)
 */
const REVERSAL_PATTERNS = {
  'continuous':      { sequence: '----', period: 1 },
  'book':            { sequence: 'PPPP', period: 1 },
  'red-book':        { sequence: 'RRRR', period: 1 },
  'blue-book':       { sequence: 'BBBB', period: 1 },
  'long-book':       { sequence: 'P-P-', period: 2 },
  'alternating':     { sequence: 'RBRB', period: 2 },
  'solo-1':          { sequence: 'RBBRBRRB', period: 8 },
  'solo-2':          { sequence: 'RBBRBRRBBRRBRBBR', period: 16 },
  'solo-3':          { sequence: 'RBBRBRRBBRRBRBBRBRRBRBBRRBBRBRRB', period: 32 },
  'dense-weave-1':   { sequence: 'RPBPRPBP', period: 8 },
  'dense-weave-2':   { sequence: 'RPBPRPBPBPRPBPRP', period: 16 },
  'dense-weave-3':   { sequence: 'RPBPRPBPBPRPBPRPBPRPBPRPRPBPRPBP', period: 32 },
  'sparse-weave-1':  { sequence: 'RBRPBRBP', period: 8 },
  'sparse-weave-2':  { sequence: 'RBRPBRBPBRBPRBRP', period: 16 },
  'sparse-weave-3':  { sequence: 'RBRPBRBPBRBPRBRPBRBPRBRPRBRPBRBP', period: 32 },
};

/**
 * Get reversal flags for a specific beat index given a pattern string.
 * @param {string} patternSequence - The pattern string (e.g. "PPPP", "RBRB")
 * @param {number} beatIndex - 0-based beat index
 * @returns {{ blueReversal: boolean, redReversal: boolean }}
 */
function getReversalFlagsForBeat(patternSequence, beatIndex) {
  const symbol = patternSequence[beatIndex % patternSequence.length];
  switch (symbol) {
    case 'P': return { blueReversal: true,  redReversal: true };
    case 'R': return { blueReversal: false, redReversal: true };
    case 'B': return { blueReversal: true,  redReversal: false };
    case '-': return { blueReversal: false, redReversal: false };
    default:  throw new Error(`Unknown reversal symbol: ${symbol}`);
  }
}

/**
 * Flip a motion type if reversed. Pro becomes anti, anti becomes pro.
 * Static motions are unchanged (no rotation to reverse at L1).
 * @param {string} motionType - "pro", "anti", "static", "dash"
 * @param {boolean} isReversed - whether this hand is reversed on this beat
 * @returns {string} the transformed motion type
 */
function applyReversalToMotion(motionType, isReversed) {
  if (!isReversed) return motionType;
  if (motionType === 'pro') return 'anti';
  if (motionType === 'anti') return 'pro';
  return motionType; // static, dash — unchanged
}

/**
 * Apply a reversal pattern to a full sequence of steps.
 * Mutates the steps array: flips motion types, sets reversal flags.
 * Does NOT recompute letters or orientations (caller must do that
 * using the CSV dataframe lookup).
 *
 * @param {Array} steps - Array of step objects from the enumerator
 * @param {string} patternId - Reversal pattern id (e.g. "book")
 * @returns {Array} The same steps array, mutated
 */
function applyReversalPattern(steps, patternId) {
  const pattern = REVERSAL_PATTERNS[patternId];
  if (!pattern) throw new Error(`Unknown reversal pattern: ${patternId}`);

  const seq = pattern.sequence;

  for (let i = 0; i < steps.length; i++) {
    const flags = getReversalFlagsForBeat(seq, i);
    steps[i].blueReversal = flags.blueReversal;
    steps[i].redReversal = flags.redReversal;

    if (flags.blueReversal) {
      steps[i].blueMotionType = applyReversalToMotion(steps[i].blueMotionType, true);
    }
    if (flags.redReversal) {
      steps[i].redMotionType = applyReversalToMotion(steps[i].redMotionType, true);
    }
  }

  return steps;
}

module.exports = {
  REVERSAL_PATTERNS,
  getReversalFlagsForBeat,
  applyReversalToMotion,
  applyReversalPattern,
};
```

- [ ] **Step 4: Update test to import from the CJS module**

The test needs to import from the CJS module. Update the imports:

```typescript
// At top of tests/unit/reversal-pattern-transform.test.ts
const { applyReversalToMotion, getReversalFlagsForBeat, applyReversalPattern } =
  require('../../scripts/apply-reversal-pattern.cjs');
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/reversal-pattern-transform.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 6: Add integration test for full sequence transformation**

Append to the test file:

```typescript
describe('applyReversalPattern', () => {
  it('applies book pattern — flips all motions on all beats', () => {
    const steps = [
      { blueMotionType: 'pro', redMotionType: 'pro', blueReversal: false, redReversal: false },
      { blueMotionType: 'pro', redMotionType: 'pro', blueReversal: false, redReversal: false },
    ];
    applyReversalPattern(steps, 'book');
    expect(steps[0].blueMotionType).toBe('anti');
    expect(steps[0].redMotionType).toBe('anti');
    expect(steps[0].blueReversal).toBe(true);
    expect(steps[0].redReversal).toBe(true);
    expect(steps[1].blueMotionType).toBe('anti');
    expect(steps[1].redMotionType).toBe('anti');
  });

  it('applies alternating pattern — red on even beats, blue on odd', () => {
    const steps = [
      { blueMotionType: 'pro', redMotionType: 'pro', blueReversal: false, redReversal: false },
      { blueMotionType: 'pro', redMotionType: 'pro', blueReversal: false, redReversal: false },
      { blueMotionType: 'pro', redMotionType: 'pro', blueReversal: false, redReversal: false },
      { blueMotionType: 'pro', redMotionType: 'pro', blueReversal: false, redReversal: false },
    ];
    applyReversalPattern(steps, 'alternating');
    // Beat 0: R — red flips, blue stays
    expect(steps[0].redMotionType).toBe('anti');
    expect(steps[0].blueMotionType).toBe('pro');
    // Beat 1: B — blue flips, red stays
    expect(steps[1].redMotionType).toBe('pro');
    expect(steps[1].blueMotionType).toBe('anti');
    // Beat 2: R again
    expect(steps[2].redMotionType).toBe('anti');
    expect(steps[2].blueMotionType).toBe('pro');
    // Beat 3: B again
    expect(steps[3].redMotionType).toBe('pro');
    expect(steps[3].blueMotionType).toBe('anti');
  });

  it('leaves static motions unchanged even under book pattern', () => {
    const steps = [
      { blueMotionType: 'static', redMotionType: 'static', blueReversal: false, redReversal: false },
    ];
    applyReversalPattern(steps, 'book');
    expect(steps[0].blueMotionType).toBe('static');
    expect(steps[0].redMotionType).toBe('static');
    // Flags are still set — the reversal happened, it just didn't change the motion
    expect(steps[0].blueReversal).toBe(true);
    expect(steps[0].redReversal).toBe(true);
  });
});
```

- [ ] **Step 7: Run all tests**

Run: `npx vitest run tests/unit/reversal-pattern-transform.test.ts`
Expected: All 12 tests PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/apply-reversal-pattern.cjs tests/unit/reversal-pattern-transform.test.ts
git commit -m "feat(decks): add reversal transformation logic with tests"
```

---

## Task 4: Integrate Reversal into Enumerator

**Files:**
- Modify: `scripts/enumerate-deck.cjs`

- [ ] **Step 1: Add --reversalPattern CLI argument**

In the argument parsing section (around line 23-41), add:

```javascript
const reversalPattern = args.includes('--reversalPattern')
  ? args[args.indexOf('--reversalPattern') + 1]
  : null;
```

- [ ] **Step 2: Add validation for the reversal pattern**

After existing validation (around line 86), add:

```javascript
const { REVERSAL_PATTERNS, applyReversalPattern } = require('./apply-reversal-pattern.cjs');

if (reversalPattern) {
  if (!REVERSAL_PATTERNS[reversalPattern]) {
    console.error(`Unknown reversal pattern: ${reversalPattern}`);
    console.error(`Available: ${Object.keys(REVERSAL_PATTERNS).join(', ')}`);
    process.exit(1);
  }
  const patternDef = REVERSAL_PATTERNS[reversalPattern];
  const totalBeats = seedLength * (slice === 'quartered' ? 4 : 2);
  if (totalBeats % patternDef.period !== 0) {
    console.error(`Pattern "${reversalPattern}" (period ${patternDef.period}) incompatible with ${totalBeats}-beat sequences`);
    process.exit(1);
  }
}
```

- [ ] **Step 3: Apply reversal after LOOP execution**

Find where the enumerator collects valid sequences after the DFS walk and LOOP execution. After the sequence steps are assembled but before output, add:

```javascript
if (reversalPattern && reversalPattern !== 'continuous') {
  applyReversalPattern(steps, reversalPattern);
  // Recompute letter from transformed motion types using CSV lookup
  for (const step of steps) {
    const newLetter = lookupLetterFromMotions(step, edges);
    if (newLetter) step.letter = newLetter;
  }
  // Recompute word from new letters
  entry.word = steps.map(s => s.letter).join('');
  entry.seedWord = steps.slice(0, seedLength).map(s => s.letter).join('');
}
```

The `lookupLetterFromMotions` function finds the CSV row matching the step's (blueMotionType, redMotionType, blueStartLoc, blueEndLoc, redStartLoc, redEndLoc) and returns its letter. This lookup already exists in the enumerator's edge-matching logic — extract it into a reusable function.

- [ ] **Step 4: Include reversalPattern in output metadata**

In the output object that gets written to JSON or Firestore, add:

```javascript
reversalPattern: reversalPattern || 'continuous',
```

- [ ] **Step 5: Test with dry-run**

Run: `node scripts/enumerate-deck.cjs --loopType rotated --slice quartered --seedLength 1 --level 1 --gridMode diamond --reversalPattern book --dry-run`

Expected: Output shows sequences with transformed letters (e.g., G→H for tog-same with book pattern). Word field should reflect post-reversal letters. Reversal flags should be set on all beats.

- [ ] **Step 6: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(decks): integrate reversal pattern into deck enumerator"
```

---

## Task 5: Verify Orientation Hypothesis

**Files:**
- No new files — this is a verification task using existing tools

- [ ] **Step 1: Generate book pattern deck in dry-run mode**

Run: `node scripts/enumerate-deck.cjs --loopType rotated --slice quartered --seedLength 1 --level 1 --gridMode diamond --reversalPattern book --dry-run --out /tmp/book-test.json`

- [ ] **Step 2: Check boundary continuity**

Examine the output JSON. For each sequence, verify:
- The last beat's end orientation matches the first beat's start orientation
- The last beat's end position matches the expected rotated position of the first beat's start position

If all sequences pass: hypothesis confirmed. The reversal transformation preserves LOOP boundary continuity for uniform turn values.

If some fail: the re-validation step (pipeline step 7) is needed. Add a boundary check after reversal transformation that rejects failing sequences. Document which patterns/turn values fail.

- [ ] **Step 3: Document findings**

Add results to the spec's "Open Questions" section 1. Either:
- "Hypothesis confirmed: orientation continuity preserved under all simple reversal patterns at L1."
- "Hypothesis partially confirmed: [specific failures]. Filter added to enumerator step 7."

- [ ] **Step 4: Commit documentation update**

```bash
git add docs/superpowers/specs/2026-03-26-reversal-pattern-deck-expansion-design.md
git commit -m "docs: record orientation hypothesis verification results"
```

---

## Task 6: Seed Reversal Decks to Firestore

**Files:**
- Create: `scripts/seed-reversal-decks.cjs`

- [ ] **Step 1: Create the seeder script**

Model after `scripts/seed-vtg-turn-decks.cjs`. The seeder:

1. Takes a source deck ID and a list of reversal patterns
2. For each pattern, loads the source deck's sequences from Firestore
3. Applies the reversal transformation to each sequence
4. Recomputes letters, words, and family groupings
5. Writes the new deck to Firestore with the pattern-suffixed ID

```javascript
// scripts/seed-reversal-decks.cjs
//
// Seeds reversal variant decks from an existing continuous deck.
//
// Usage:
//   node scripts/seed-reversal-decks.cjs --source l1-vtg-motions --patterns book,red-book,blue-book,long-book,alternating
//   node scripts/seed-reversal-decks.cjs --source rotated_quartered_L1_diamond --patterns book --dry-run

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { applyReversalPattern, REVERSAL_PATTERNS } = require('./apply-reversal-pattern.cjs');
const path = require('path');
const fs = require('fs');

// ... Firebase init (same pattern as seed-vtg-turn-decks.cjs) ...

const args = process.argv.slice(2);
const sourceDeckId = args[args.indexOf('--source') + 1];
const patternIds = args[args.indexOf('--patterns') + 1].split(',');
const dryRun = args.includes('--dry-run');
const gridMode = args.includes('--gridMode') ? args[args.indexOf('--gridMode') + 1] : 'diamond';

/**
 * Load CSV pictograph dataframe for letter lookup after reversal.
 * Same CSV loading pattern as enumerate-deck.cjs (lines 102-137).
 */
const CSV_PATHS = {
  diamond: path.join(__dirname, '..', 'static', 'data', 'pictographs', 'DiamondPictographDataframe.csv'),
  box: path.join(__dirname, '..', 'static', 'data', 'pictographs', 'BoxPictographDataframe.csv'),
};

function loadCsvEdges(gridMode) {
  const csvPath = CSV_PATHS[gridMode];
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const vals = line.split(',');
    const edge = {};
    headers.forEach((h, i) => edge[h.trim()] = vals[i]?.trim());
    return edge;
  });
}

/**
 * After reversal flips motion types, look up the new letter from the CSV.
 * Matches on: blueMotionType, redMotionType, blueStartLoc, blueEndLoc,
 * redStartLoc, redEndLoc (the hand path stays the same, only motion type changes).
 */
function recomputeLetterFromCsv(step, csvEdges) {
  const match = csvEdges.find(e =>
    e.blueMotionType === step.blueMotionType &&
    e.redMotionType === step.redMotionType &&
    e.blueStartLoc === step.blueStartLoc &&
    e.blueEndLoc === step.blueEndLoc &&
    e.redStartLoc === step.redStartLoc &&
    e.redEndLoc === step.redEndLoc
  );
  return match ? match.letter : null;
}

async function main() {
  const db = getFirestore();
  const csvEdges = loadCsvEdges(gridMode);

  // Load source deck metadata
  const sourceDeckDoc = await db.doc(`decks/${sourceDeckId}`).get();
  if (!sourceDeckDoc.exists) {
    console.error(`Source deck not found: ${sourceDeckId}`);
    process.exit(1);
  }
  const sourceDeck = sourceDeckDoc.data();

  // Load source sequences
  const seqSnapshot = await db.collection(`decks/${sourceDeckId}/sequences`).get();
  const sourceSequences = seqSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Loaded ${sourceSequences.length} sequences from ${sourceDeckId}`);
  console.log(`Loaded ${csvEdges.length} CSV edges for ${gridMode} grid`);

  for (const patternId of patternIds) {
    if (!REVERSAL_PATTERNS[patternId]) {
      console.error(`Unknown pattern: ${patternId}`);
      continue;
    }

    const newDeckId = `${sourceDeckId}-${patternId}`;
    console.log(`\nGenerating ${newDeckId}...`);

    const transformedSequences = [];

    for (const seq of sourceSequences) {
      // Deep clone the steps
      const steps = JSON.parse(JSON.stringify(seq.steps || []));

      // Apply reversal transformation (flips motion types, sets flags)
      applyReversalPattern(steps, patternId);

      // Recompute letters from CSV using the transformed motion types
      let lettersFailed = false;
      for (const step of steps) {
        const newLetter = recomputeLetterFromCsv(step, csvEdges);
        if (newLetter) {
          step.letter = newLetter;
        } else {
          console.warn(`  Warning: no CSV match for step in ${seq.id} — motion types may be invalid`);
          lettersFailed = true;
        }
      }

      if (lettersFailed) continue; // Skip sequences with unmatchable transformations

      const word = steps.map(s => s.letter).join('');

      transformedSequences.push({
        ...seq,
        steps,
        word,
        reversalPattern: patternId,
      });
    }

    // Regroup into families by hand path
    const familyMap = new Map();
    for (const seq of transformedSequences) {
      const family = seq.handPathFamily || 'unknown';
      if (!familyMap.has(family)) familyMap.set(family, []);
      familyMap.get(family).push(seq);
    }

    const families = [...familyMap.entries()].map(([label, seqs]) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      label,
      typeCombo: seqs[0]?.typeCombo || '',
      sequenceIds: seqs.map(s => s.id),
    }));

    if (dryRun) {
      console.log(`  Would write ${transformedSequences.length} sequences in ${families.length} families`);
      console.log(`  Sample word: ${transformedSequences[0]?.word}`);
      continue;
    }

    // Write deck document
    await db.doc(`decks/${newDeckId}`).set({
      ...sourceDeck,
      id: newDeckId,
      name: `${sourceDeck.name} (${REVERSAL_PATTERNS[patternId].sequence})`,
      reversalPattern: patternId,
      families,
      totalSequences: transformedSequences.length,
    });

    // Write sequences in batches of 450 (Firestore limit is 500 per batch)
    const BATCH_SIZE = 450;
    for (let i = 0; i < transformedSequences.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = transformedSequences.slice(i, i + BATCH_SIZE);
      for (const seq of chunk) {
        batch.set(db.doc(`decks/${newDeckId}/sequences/${seq.id}`), seq);
      }
      await batch.commit();
    }

    console.log(`  Wrote ${transformedSequences.length} sequences to ${newDeckId}`);
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Dry-run against VTG deck**

Run: `node scripts/seed-reversal-decks.cjs --source l1-vtg-motions --patterns book,red-book,blue-book,long-book,alternating --dry-run`

Expected: Shows count of sequences per pattern, sample transformed words. No Firestore writes.

- [ ] **Step 3: Seed VTG reversal decks (if dry-run looks correct)**

Run: `node scripts/seed-reversal-decks.cjs --source l1-vtg-motions --patterns book,red-book,blue-book,long-book,alternating`

Expected: 5 new decks in Firestore (l1-vtg-motions-book, l1-vtg-motions-red-book, etc.)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-reversal-decks.cjs
git commit -m "feat(decks): add reversal deck seeder script"
```

---

## Task 7: ReversalPatternCard Component

**Files:**
- Create: `src/lib/features/choreo-card/components/ReversalPatternCard.svelte`

- [ ] **Step 1: Create the card component**

This card displays a reversal pattern with a dot visualization. Used in both VTG and LOOP reversal grids.

```svelte
<script lang="ts">
  import type { ReversalPatternDef } from '../domain/reversal-patterns';

  interface Props {
    pattern: ReversalPatternDef;
    sequenceCount: number;
    onclick: () => void;
  }

  let { pattern, sequenceCount, onclick }: Props = $props();

  // Show first 8 symbols max in the dot visualization
  const displaySymbols = $derived(
    pattern.sequence.slice(0, Math.min(8, pattern.period)).split('')
  );
</script>

<button class="reversal-card" onclick={onclick}>
  <div class="pattern-dots">
    {#each displaySymbols as symbol}
      <div class="dot-pair">
        {#if symbol === 'P'}
          <span class="dot red"></span>
          <span class="dot blue"></span>
        {:else if symbol === 'R'}
          <span class="dot red"></span>
          <span class="dot empty"></span>
        {:else if symbol === 'B'}
          <span class="dot empty"></span>
          <span class="dot blue"></span>
        {:else}
          <span class="dot empty"></span>
          <span class="dot empty"></span>
        {/if}
      </div>
    {/each}
    {#if pattern.period > 8}
      <span class="ellipsis">...</span>
    {/if}
  </div>

  <div class="card-label">{pattern.label}</div>
  <div class="card-meta">{sequenceCount} sequences</div>
</button>

<style>
  .reversal-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transition: border-color 0.15s ease;
    min-width: 140px;
  }

  .reversal-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .pattern-dots {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .dot-pair {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot.red {
    background: var(--prop-red, #e74c3c);
  }

  .dot.blue {
    background: var(--prop-blue, #3498db);
  }

  .dot.empty {
    background: rgba(255, 255, 255, 0.08);
  }

  .ellipsis {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: var(--font-size-compact, 12px);
  }

  .card-label {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .card-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/ReversalPatternCard.svelte
git commit -m "feat(decks): add ReversalPatternCard component with dot visualization"
```

---

## Task 8: VTG BY REVERSAL View

**Files:**
- Create: `src/lib/features/choreo-card/components/VtgReversalGrid.svelte`
- Modify: `src/lib/features/choreo-card/components/VtgCollectionView.svelte`

- [ ] **Step 1: Create VtgReversalGrid**

```svelte
<script lang="ts">
  import type { Deck } from '../domain/models/Deck';
  import { SIMPLE_PATTERNS, type ReversalPatternDef } from '../domain/reversal-patterns';
  import ReversalPatternCard from './ReversalPatternCard.svelte';

  interface Props {
    decks: Deck[];
    onSelectPattern: (patternId: string) => void;
  }

  let { decks, onSelectPattern }: Props = $props();

  const patternGroups = $derived(
    SIMPLE_PATTERNS.map(pattern => {
      const matchingDecks = decks.filter(d =>
        (d.reversalPattern || 'continuous') === pattern.id
      );
      const sequenceCount = matchingDecks.reduce((sum, d) => sum + d.totalSequences, 0);
      return { pattern, sequenceCount };
    }).filter(g => g.sequenceCount > 0)
  );
</script>

<div class="reversal-grid-header">BY REVERSAL</div>

<div class="reversal-grid">
  {#each patternGroups as { pattern, sequenceCount } (pattern.id)}
    <ReversalPatternCard
      {pattern}
      {sequenceCount}
      onclick={() => onSelectPattern(pattern.id)}
    />
  {/each}
</div>

<style>
  .reversal-grid-header {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    margin-bottom: 16px;
  }

  .reversal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 700px;
    margin: 0 auto;
  }
</style>
```

- [ ] **Step 2: Add BY REVERSAL toggle to VtgCollectionView**

Open `src/lib/features/choreo-card/components/VtgCollectionView.svelte`.

The current toggle (around line 14) has `activeView` state switching between "Family" and "Ratio". Add "Reversal" as a third option.

In the toggle buttons section (around lines 34-59), add a third button:

```svelte
<button
  class="toggle-btn"
  class:active={activeView === 'Reversal'}
  onclick={() => activeView = 'Reversal'}
>By Reversal</button>
```

In the content section, add the Reversal view:

```svelte
{#if activeView === 'Reversal'}
  <VtgReversalGrid
    {decks}
    onSelectPattern={(patternId) => {/* drill down to filtered sequences */}}
  />
{/if}
```

Import the new component at the top:

```svelte
import VtgReversalGrid from './VtgReversalGrid.svelte';
```

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/VtgReversalGrid.svelte src/lib/features/choreo-card/components/VtgCollectionView.svelte
git commit -m "feat(vtg): add BY REVERSAL view to VTG collection browser"
```

---

## Task 9: LOOP Collection View Redesign

**Files:**
- Create: `src/lib/features/choreo-card/components/LoopCollectionView.svelte`
- Create: `src/lib/features/choreo-card/components/LoopBeatGrid.svelte`
- Create: `src/lib/features/choreo-card/components/LoopTurnsGrid.svelte`
- Create: `src/lib/features/choreo-card/components/LoopReversalGrid.svelte`
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

- [ ] **Step 1: Create LoopBeatGrid**

Groups LOOP decks by beat count. Each card shows the beat count, sequence count, and family count.

```svelte
<script lang="ts">
  import type { Deck } from '../domain/models/Deck';

  interface Props {
    decks: Deck[];
    onSelectBeatCount: (beatCount: number) => void;
  }

  let { decks, onSelectBeatCount }: Props = $props();

  interface BeatGroup {
    beatCount: number;
    deckCount: number;
    totalSequences: number;
    familyCount: number;
  }

  const beatGroups: BeatGroup[] = $derived((() => {
    const groups = new Map<number, Deck[]>();
    for (const deck of decks) {
      const bc = deck.beatCount || 0;
      if (!groups.has(bc)) groups.set(bc, []);
      groups.get(bc)!.push(deck);
    }
    return [...groups.entries()]
      .map(([beatCount, groupDecks]) => ({
        beatCount,
        deckCount: groupDecks.length,
        totalSequences: groupDecks.reduce((s, d) => s + d.totalSequences, 0),
        familyCount: new Set(groupDecks.flatMap(d => d.families.map(f => f.label))).size,
      }))
      .sort((a, b) => a.beatCount - b.beatCount);
  })());
</script>

<div class="grid-header">BY BEATS</div>

<div class="beat-grid">
  {#each beatGroups as group (group.beatCount)}
    <button class="beat-card" onclick={() => onSelectBeatCount(group.beatCount)}>
      <div class="beat-count">{group.beatCount}</div>
      <div class="beat-label">beats</div>
      <div class="beat-meta">{group.totalSequences.toLocaleString()} sequences</div>
      <div class="beat-meta">{group.familyCount} families</div>
    </button>
  {/each}
</div>

<style>
  .grid-header {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    margin-bottom: 16px;
  }

  .beat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 700px;
    margin: 0 auto;
  }

  .beat-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 20px 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: border-color 0.15s ease;
  }

  .beat-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .beat-count {
    font-size: 28px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .beat-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .beat-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
```

- [ ] **Step 2: Create LoopTurnsGrid**

Same structure as VtgRatioGrid but sourced from LOOP decks. Groups by turn count.

```svelte
<script lang="ts">
  import type { Deck } from '../domain/models/Deck';

  interface Props {
    decks: Deck[];
    onSelectTurns: (turns: number) => void;
  }

  let { decks, onSelectTurns }: Props = $props();

  const turnGroups = $derived((() => {
    const groups = new Map<number, Deck[]>();
    for (const deck of decks) {
      const t = deck.turns ?? 0;
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t)!.push(deck);
    }
    return [...groups.entries()]
      .map(([turns, groupDecks]) => ({
        turns,
        totalSequences: groupDecks.reduce((s, d) => s + d.totalSequences, 0),
      }))
      .sort((a, b) => a.turns - b.turns);
  })());
</script>

<div class="grid-header">BY TURNS</div>

<div class="turns-grid">
  {#each turnGroups as group (group.turns)}
    <button class="turns-card" onclick={() => onSelectTurns(group.turns)}>
      <div class="turns-value">{group.turns}</div>
      <div class="turns-label">{group.turns === 1 ? 'turn' : 'turns'}</div>
      <div class="turns-meta">{group.totalSequences.toLocaleString()} sequences</div>
    </button>
  {/each}
</div>

<style>
  .grid-header {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    margin-bottom: 16px;
  }

  .turns-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 700px;
    margin: 0 auto;
  }

  .turns-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    padding: 20px 16px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    transition: border-color 0.15s ease;
  }

  .turns-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .turns-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--theme-text, #ffffff);
  }

  .turns-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .turns-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }
</style>
```

- [ ] **Step 3: Create LoopReversalGrid**

Same structure as VtgReversalGrid but for LOOP decks. Uses ReversalPatternCard.

```svelte
<script lang="ts">
  import type { Deck } from '../domain/models/Deck';
  import { REVERSAL_PATTERNS, REVERSAL_FAMILIES, type ReversalFamily } from '../domain/reversal-patterns';
  import { getCompatiblePatterns } from '../domain/reversal-patterns';
  import ReversalPatternCard from './ReversalPatternCard.svelte';

  interface Props {
    decks: Deck[];
    onSelectPattern: (patternId: string) => void;
  }

  let { decks, onSelectPattern }: Props = $props();

  const patternGroups = $derived(
    REVERSAL_PATTERNS
      .map(pattern => {
        const matchingDecks = decks.filter(d =>
          (d.reversalPattern || 'continuous') === pattern.id
        );
        const sequenceCount = matchingDecks.reduce((sum, d) => sum + d.totalSequences, 0);
        return { pattern, sequenceCount };
      })
      .filter(g => g.sequenceCount > 0)
  );

  const groupedByFamily = $derived((() => {
    const groups = new Map<string, { pattern: ReversalPatternDef; sequenceCount: number }[]>();
    for (const item of patternGroups) {
      const family = item.pattern.family;
      if (!groups.has(family)) groups.set(family, []);
      groups.get(family)!.push(item);
    }
    return groups;
  })());

  const familyLabels: Record<string, string> = {
    'simple': 'Simple',
    'solo': 'Solo',
    'dense-weave': 'Dense Weave',
    'sparse-weave': 'Sparse Weave',
  };
</script>

<div class="grid-header">BY REVERSAL</div>

{#each REVERSAL_FAMILIES as family (family)}
  {@const items = groupedByFamily.get(family)}
  {#if items && items.length > 0}
    <div class="family-section">
      <div class="family-label">{familyLabels[family]}</div>
      <div class="reversal-grid">
        {#each items as { pattern, sequenceCount } (pattern.id)}
          <ReversalPatternCard
            {pattern}
            {sequenceCount}
            onclick={() => onSelectPattern(pattern.id)}
          />
        {/each}
      </div>
    </div>
  {/if}
{/each}

<style>
  .grid-header {
    text-align: center;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    letter-spacing: 0.15em;
    margin-bottom: 16px;
  }

  .family-section {
    margin-bottom: 24px;
  }

  .family-label {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    margin-bottom: 10px;
    padding-left: 4px;
  }

  .reversal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    max-width: 700px;
    margin: 0 auto;
  }
</style>
```

- [ ] **Step 4: Create LoopCollectionView orchestrator**

This replaces the flat deck list for the LOOPs collection. Has a loop type pill bar (top) and three-axis toggle (BY BEATS | BY TURNS | BY REVERSAL).

```svelte
<script lang="ts">
  import type { Deck } from '../domain/models/Deck';
  import LoopBeatGrid from './LoopBeatGrid.svelte';
  import LoopTurnsGrid from './LoopTurnsGrid.svelte';
  import LoopReversalGrid from './LoopReversalGrid.svelte';

  interface Props {
    decks: Deck[];
    onSelectDeck: (deck: Deck) => void;
  }

  let { decks, onSelectDeck }: Props = $props();

  // Loop type filter — only "rotated" is populated for now
  const LOOP_TYPES = [
    { id: 'rotated', label: 'Rotated' },
    { id: 'mirrored', label: 'Mirrored' },
    { id: 'swapped', label: 'Swapped' },
    { id: 'inverted', label: 'Inverted' },
    { id: 'rewound', label: 'Rewound' },
  ] as const;

  let activeLoopType = $state('rotated');
  let activeView = $state<'Beats' | 'Turns' | 'Reversal'>('Beats');

  const filteredDecks = $derived(
    decks.filter(d => (d.loopType || 'rotated') === activeLoopType)
  );

  const populatedLoopTypes = $derived(
    new Set(decks.map(d => d.loopType || 'rotated'))
  );

  function handleSelectBeatCount(beatCount: number) {
    // TODO: drill down to filtered view showing decks with this beat count
    console.log('Selected beat count:', beatCount);
  }

  function handleSelectTurns(turns: number) {
    // TODO: drill down to filtered view
    console.log('Selected turns:', turns);
  }

  function handleSelectPattern(patternId: string) {
    // TODO: drill down to filtered view
    console.log('Selected pattern:', patternId);
  }
</script>

<div class="loop-collection">
  <!-- Loop Type Pill Bar -->
  <div class="loop-type-bar">
    {#each LOOP_TYPES as lt (lt.id)}
      <button
        class="loop-type-pill"
        class:active={activeLoopType === lt.id}
        disabled={!populatedLoopTypes.has(lt.id)}
        onclick={() => activeLoopType = lt.id}
      >
        {lt.label}
      </button>
    {/each}
  </div>

  <!-- Axis Toggle -->
  <div class="axis-toggle">
    <button
      class="toggle-btn"
      class:active={activeView === 'Beats'}
      onclick={() => activeView = 'Beats'}
    >By Beats</button>
    <button
      class="toggle-btn"
      class:active={activeView === 'Turns'}
      onclick={() => activeView = 'Turns'}
    >By Turns</button>
    <button
      class="toggle-btn"
      class:active={activeView === 'Reversal'}
      onclick={() => activeView = 'Reversal'}
    >By Reversal</button>
  </div>

  <!-- Content -->
  <div class="grid-content">
    {#if activeView === 'Beats'}
      <LoopBeatGrid decks={filteredDecks} onSelectBeatCount={handleSelectBeatCount} />
    {:else if activeView === 'Turns'}
      <LoopTurnsGrid decks={filteredDecks} onSelectTurns={handleSelectTurns} />
    {:else}
      <LoopReversalGrid decks={filteredDecks} onSelectPattern={handleSelectPattern} />
    {/if}
  </div>
</div>

<style>
  .loop-collection {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
  }

  .loop-type-bar {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .loop-type-pill {
    padding: 6px 16px;
    border-radius: 20px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .loop-type-pill.active {
    background: var(--theme-accent, #63b3ed);
    color: #000;
    border-color: var(--theme-accent, #63b3ed);
  }

  .loop-type-pill:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .axis-toggle {
    display: flex;
    gap: 4px;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    padding: 4px;
    width: fit-content;
    margin: 0 auto;
  }

  .toggle-btn {
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-btn.active {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, #ffffff);
  }

  .grid-content {
    min-height: 200px;
  }
</style>
```

- [ ] **Step 5: Commit all LOOP view components**

```bash
git add src/lib/features/choreo-card/components/LoopCollectionView.svelte \
        src/lib/features/choreo-card/components/LoopBeatGrid.svelte \
        src/lib/features/choreo-card/components/LoopTurnsGrid.svelte \
        src/lib/features/choreo-card/components/LoopReversalGrid.svelte
git commit -m "feat(decks): add multi-axis LOOP collection browser components"
```

---

## Task 10: Wire LoopCollectionView into DeckBrowser

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

- [ ] **Step 1: Import LoopCollectionView**

Add import at top of DeckBrowser.svelte:

```svelte
import LoopCollectionView from './LoopCollectionView.svelte';
```

- [ ] **Step 2: Route LOOPs collection to LoopCollectionView**

In DeckBrowser.svelte, the LOOPs collection currently falls through to the generic deck list (around lines 449-545). Add a condition that checks if the selected collection is "LOOPs" and renders LoopCollectionView instead of the flat list.

Find the section where `selectedCollection` routes to different views (around line 424-448 for VTG). Add a similar block:

```svelte
{:else if selectedCollection === 'LOOPs'}
  <LoopCollectionView
    decks={filteredDecks}
    onSelectDeck={handleSelectDeck}
  />
```

This replaces the flat DeckRow list for the LOOPs collection with the multi-axis browser.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: No errors

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowser.svelte
git commit -m "feat(decks): wire LoopCollectionView into DeckBrowser"
```

---

## Task 11: Populate Deck Metadata for Existing Decks

Existing LOOP decks in Firestore don't have `loopType`, `beatCount`, or `reversalPattern` fields. These need to be backfilled so the new UI can categorize them.

**Files:**
- Create: `scripts/backfill-deck-metadata.cjs`

- [ ] **Step 1: Create backfill script**

```javascript
// scripts/backfill-deck-metadata.cjs
//
// Adds loopType, beatCount, and reversalPattern fields to existing deck documents.
// Parses the deck ID to infer metadata (e.g., "rotated_quartered_L1_diamond" → loopType: "rotated", beatCount from slice).
//
// Usage:
//   node scripts/backfill-deck-metadata.cjs --dry-run
//   node scripts/backfill-deck-metadata.cjs

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Firebase init (same pattern as other scripts)
// ...

async function main() {
  const db = getFirestore();
  const dryRun = process.argv.includes('--dry-run');

  const snapshot = await db.collection('decks').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;
    const updates = {};

    // Infer loopType from ID
    if (!data.loopType) {
      if (id.includes('rotated')) updates.loopType = 'rotated';
      else if (id.includes('mirrored')) updates.loopType = 'mirrored';
      else if (id.includes('swapped')) updates.loopType = 'swapped';
      else if (id.includes('inverted')) updates.loopType = 'inverted';
      else if (id.includes('rewound')) updates.loopType = 'rewound';
    }

    // Infer beatCount from deck name or sequences
    if (!data.beatCount && data.name) {
      const match = data.name.match(/(\d+)-Beat/);
      if (match) updates.beatCount = parseInt(match[1]);
    }

    // Default reversalPattern
    if (!data.reversalPattern) {
      updates.reversalPattern = 'continuous';
    }

    if (Object.keys(updates).length > 0) {
      if (dryRun) {
        console.log(`Would update ${id}:`, updates);
      } else {
        await doc.ref.update(updates);
        console.log(`Updated ${id}:`, updates);
      }
    }
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Dry-run**

Run: `node scripts/backfill-deck-metadata.cjs --dry-run`
Expected: Shows which decks would be updated with what fields

- [ ] **Step 3: Run backfill**

Run: `node scripts/backfill-deck-metadata.cjs`
Expected: All existing decks updated with metadata

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-deck-metadata.cjs
git commit -m "feat(decks): add metadata backfill script for existing decks"
```

---

## Verification Checklist

After all tasks complete, verify end-to-end:

- [ ] `npm run check` passes with no errors
- [ ] `npm run build` succeeds
- [ ] All unit tests pass: `npx vitest run`
- [ ] VTG collection view shows three toggles: BY FAMILY | BY RATIO | BY REVERSAL
- [ ] BY REVERSAL view shows cards for reversal patterns with dot visualizations
- [ ] LOOPs collection shows multi-axis browser instead of flat list
- [ ] Loop type pill bar works (only Rotated is active)
- [ ] BY BEATS, BY TURNS, BY REVERSAL toggles switch between grid views
- [ ] Reversal deck seeder produces correct transformed words in dry-run mode
- [ ] Orientation hypothesis verified and documented
