# Mirror-Swap Twin Deck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--twin` flag to `scripts/enumerate-deck.cjs` that doubles any enumerated LOOP deck — for every generated card it also seeds that card's mirror-swap twin (color-swap ∘ vertical-mirror), excluding self-twins.

**Architecture:** A new pure, dependency-free helper module `scripts/twin-transform.cjs` does the geometry (color swap, location mirror, rotation flip, position derivation from the transformed location pair, self-twin detection). The enumerator owns I/O: it requires the engine's vertical-mirror location map + rotation-flip fn and passes them in, re-derives letters and re-propagates orientations with its existing in-script helpers, and writes a second Firestore doc per card inside the existing seeding loop. No app/UI/card-model changes.

**Tech Stack:** Node CommonJS scripts, the `@austencloud` sequence-engine dist (ESM, loaded via Node 24 `require(esm)`), Firestore Admin SDK, Vitest 4 (`vitest --config tests/config/vitest.config.ts`).

**Spec:** `docs/superpowers/specs/2026-05-31-mirror-swap-twin-deck-design.md`

---

## File Structure

**Create:**
- `scripts/twin-transform.cjs` — pure transform module (no engine/Firestore deps). Exports `buildLocationToPositionMap`, `twinSequence`, `isSelfTwin`. Mirrors the `scripts/apply-reversal-pattern.cjs` helper-module pattern (plain CommonJS, no top-level IIFE, `module.exports` at bottom).
- `tests/unit/scripts/twin-transform.test.ts` — Vitest unit tests for the pure module (fake maps injected, deterministic).

**Modify:**
- `scripts/enumerate-deck.cjs` — `--twin` flag parse/validate/log; require the helper at top; inside the `seedFirestore` block require the two engine maps, build `locToPos`, and emit a twin doc per surviving card with letter re-derivation + orientation propagation + self-twin skip + cross-duplicate guard + twin family/count tracking; `-twin` in `deckId`/name/description; merge twin families into `deckData.families`.

---

# PHASE 1 — Pure Transform Module (TDD)

The only unit-testable unit. Everything geometric lives here so it can be tested with injected fake maps and a hand-built location→position table. The enumerator supplies the real engine maps at call time.

### Task 1: `scripts/twin-transform.cjs` + tests

**Files:**
- Create: `scripts/twin-transform.cjs`
- Test: `tests/unit/scripts/twin-transform.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scripts/twin-transform.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import twin from "../../../scripts/twin-transform.cjs";

const { buildLocationToPositionMap, twinSequence, isSelfTwin } = twin;

// Fake vertical mirror (e<->w; n/s/c fixed) — same shape the engine map has.
const mirrorLocationMap: Record<string, string> = {
  n: "n", s: "s", e: "w", w: "e", c: "c",
};
const mirrorRotation = (d: string) =>
  d === "cw" ? "ccw" : d === "ccw" ? "cw" : d;

// Minimal edges covering the two location pairs we assert on. An "edge" is one
// CSV pictograph row: a (blueStartLoc,redStartLoc)->startPos and
// (blueEndLoc,redEndLoc)->endPos fact.
const edges = [
  { blueStartLoc: "w", redStartLoc: "s", startPos: "gamma13",
    blueEndLoc: "w", redEndLoc: "s", endPos: "gamma13" },
  { blueStartLoc: "s", redStartLoc: "e", startPos: "gamma11",
    blueEndLoc: "s", redEndLoc: "e", endPos: "gamma11" },
];

function startStep(over: any = {}) {
  // One static start step: blue@w red@s == gamma13 (mirrors the reference base).
  return {
    id: "start-x",
    letter: "γ",
    startPosition: "gamma13",
    endPosition: "gamma13",
    beatIndex: 0,
    stepNumber: 0,
    duration: 1,
    motions: {
      blue: { motionType: "static", rotationDirection: "noRotation",
        startLocation: "w", endLocation: "w", turns: 0,
        startOrientation: "in", endOrientation: "in", color: "blue" },
      red: { motionType: "static", rotationDirection: "noRotation",
        startLocation: "s", endLocation: "s", turns: 0,
        startOrientation: "in", endOrientation: "in", color: "red" },
    },
    ...over,
  };
}

const deps = { mirrorLocationMap, mirrorRotation };

describe("buildLocationToPositionMap", () => {
  it("keys positions by `${blueLoc}|${redLoc}` from edge start and end", () => {
    const map = buildLocationToPositionMap(edges);
    expect(map["w|s"]).toBe("gamma13");
    expect(map["s|e"]).toBe("gamma11");
  });
});

describe("twinSequence", () => {
  it("color-swaps, mirrors locations + rotation, and derives the position", () => {
    const locToPos = buildLocationToPositionMap(edges);
    const out = twinSequence([startStep()], { ...deps, locToPos });
    const t = out[0];
    // color swap: blue now carries old red (s), red carries old blue (w);
    // vertical mirror then maps w->e on the (old-blue) red hand.
    expect(t.motions.blue.startLocation).toBe("s"); // old red s, mirror s->s
    expect(t.motions.red.startLocation).toBe("e");  // old blue w, mirror w->e
    expect(t.motions.blue.color).toBe("blue");
    expect(t.motions.red.color).toBe("red");
    // derived from (blue s | red e) -> gamma11, NOT VERTICAL_MIRROR_POSITION_MAP
    // (which would give gamma5).
    expect(t.startPosition).toBe("gamma11");
    expect(t.endPosition).toBe("gamma11");
  });

  it("flips rotation direction on a moving beat (cw<->ccw)", () => {
    const locToPos = buildLocationToPositionMap(edges);
    const beat = startStep({
      motions: {
        blue: { motionType: "anti", rotationDirection: "cw",
          startLocation: "w", endLocation: "w", turns: 0,
          startOrientation: "in", endOrientation: "out", color: "blue" },
        red: { motionType: "pro", rotationDirection: "cw",
          startLocation: "s", endLocation: "e", turns: 0,
          startOrientation: "in", endOrientation: "out", color: "red" },
      },
    });
    const t = twinSequence([beat], { ...deps, locToPos })[0];
    // old red (pro, cw) -> blue, mirrored cw->ccw
    expect(t.motions.blue.motionType).toBe("pro");
    expect(t.motions.blue.rotationDirection).toBe("ccw");
    // old blue (anti, cw) -> red, mirrored cw->ccw
    expect(t.motions.red.motionType).toBe("anti");
    expect(t.motions.red.rotationDirection).toBe("ccw");
  });

  it("returns null position when the mirrored pair is absent from the map", () => {
    const locToPos = buildLocationToPositionMap(edges);
    const beat = startStep({
      motions: {
        blue: { motionType: "static", rotationDirection: "noRotation",
          startLocation: "n", endLocation: "n", turns: 0,
          startOrientation: "in", endOrientation: "in", color: "blue" },
        red: { motionType: "static", rotationDirection: "noRotation",
          startLocation: "n", endLocation: "n", turns: 0,
          startOrientation: "in", endOrientation: "in", color: "red" },
      },
    });
    const t = twinSequence([beat], { ...deps, locToPos })[0];
    expect(t.startPosition).toBeNull();
  });
});

describe("isSelfTwin", () => {
  it("is false when locations differ after transform", () => {
    const locToPos = buildLocationToPositionMap(edges);
    const orig = [startStep()];
    const tw = twinSequence(orig, { ...deps, locToPos });
    expect(isSelfTwin(orig, tw)).toBe(false);
  });

  it("is true when a step equals its own twin geometry", () => {
    // A symmetric step: blue@n red@n, mirror fixes n, colorswap keeps n|n.
    const sym = startStep({
      startPosition: "betaX", endPosition: "betaX",
      motions: {
        blue: { motionType: "static", rotationDirection: "noRotation",
          startLocation: "n", endLocation: "n", turns: 0,
          startOrientation: "in", endOrientation: "in", color: "blue" },
        red: { motionType: "static", rotationDirection: "noRotation",
          startLocation: "n", endLocation: "n", turns: 0,
          startOrientation: "in", endOrientation: "in", color: "red" },
      },
    });
    const locToPos = { "n|n": "betaX" };
    const tw = twinSequence([sym], { ...deps, locToPos });
    expect(isSelfTwin([sym], tw)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run tests/unit/scripts/twin-transform.test.ts`
Expected: FAIL — cannot resolve `../../../scripts/twin-transform.cjs` (module not created yet).

- [ ] **Step 3: Implement `scripts/twin-transform.cjs`**

Create `scripts/twin-transform.cjs`:

```js
/**
 * Twin Transform — pure geometry for the mirror-swap "twin" of a sequence.
 *
 * A card's twin = color-swap ∘ vertical-mirror, applied to the FULL
 * loop-executed steps (start position + beats). Both operations are involutions
 * on independent axes (color vs geometry) so the pair map is an involution:
 * twin(twin(x)) === x.
 *
 * This module is intentionally dependency-free. The caller (enumerate-deck.cjs)
 * injects the engine's vertical-mirror location map and rotation-flip function,
 * and a location->position table built from the CSV. Letter re-derivation and
 * orientation propagation are the caller's job (they need the CSV + the engine
 * orientation calculator), so they are NOT done here — this module only moves
 * hands and colors and derives positions from the resulting location pairs.
 *
 * Mirrors the scripts/apply-reversal-pattern.cjs helper pattern: plain
 * CommonJS, no top-level side effects, module.exports at the bottom.
 */

/**
 * Build a `${blueLoc}|${redLoc}` -> position lookup from the CSV edges. A
 * position IS the encoding of an ordered (blue, red) hand-location pair, so each
 * edge contributes two facts: its start pair -> startPos and end pair -> endPos.
 *
 * @param {Array<{blueStartLoc:string,redStartLoc:string,startPos:string,blueEndLoc:string,redEndLoc:string,endPos:string}>} edges
 * @returns {Record<string,string>}
 */
function buildLocationToPositionMap(edges) {
  const map = {};
  for (const e of edges) {
    map[`${e.blueStartLoc}|${e.redStartLoc}`] = e.startPos;
    map[`${e.blueEndLoc}|${e.redEndLoc}`] = e.endPos;
  }
  return map;
}

/** Mirror one motion's locations + rotation; preserve everything else. */
function mirrorMotion(motion, mirrorLocationMap, mirrorRotation) {
  return {
    ...motion,
    startLocation: mirrorLocationMap[motion.startLocation] ?? motion.startLocation,
    endLocation: mirrorLocationMap[motion.endLocation] ?? motion.endLocation,
    rotationDirection: mirrorRotation(motion.rotationDirection),
  };
}

/**
 * Produce the twin of one step: swap colors, mirror both hands, derive the
 * step's start/end positions from the transformed location pairs. Letter and
 * orientations are carried through unchanged for the caller to recompute.
 * Position is null when the transformed pair is absent from locToPos.
 */
function twinStep(step, { mirrorLocationMap, mirrorRotation, locToPos }) {
  // Color swap: blue takes old red's motion, red takes old blue's motion.
  const swappedBlueSrc = step.motions.red;
  const swappedRedSrc = step.motions.blue;

  const blue = {
    ...mirrorMotion(swappedBlueSrc, mirrorLocationMap, mirrorRotation),
    color: "blue",
  };
  const red = {
    ...mirrorMotion(swappedRedSrc, mirrorLocationMap, mirrorRotation),
    color: "red",
  };

  const startPosition =
    locToPos[`${blue.startLocation}|${red.startLocation}`] ?? null;
  const endPosition =
    locToPos[`${blue.endLocation}|${red.endLocation}`] ?? null;

  return {
    ...step,
    startPosition,
    endPosition,
    motions: { blue, red },
  };
}

/** Twin every step of a full sequence (start position + beats). */
function twinSequence(fullSteps, deps) {
  return fullSteps.map((s) => twinStep(s, deps));
}

/**
 * True when the twin is geometrically identical to the original (a card that is
 * its own mirror-swap). Compared on the position + per-hand location/motionType
 * across every step — orientation/letter are derived, not identity.
 */
function isSelfTwin(orig, twin) {
  if (orig.length !== twin.length) return false;
  for (let i = 0; i < orig.length; i++) {
    const a = orig[i];
    const b = twin[i];
    if (a.startPosition !== b.startPosition) return false;
    if (a.endPosition !== b.endPosition) return false;
    for (const color of ["blue", "red"]) {
      const am = a.motions[color];
      const bm = b.motions[color];
      if (am.startLocation !== bm.startLocation) return false;
      if (am.endLocation !== bm.endLocation) return false;
      if (am.motionType !== bm.motionType) return false;
    }
  }
  return true;
}

module.exports = {
  buildLocationToPositionMap,
  twinSequence,
  twinStep,
  isSelfTwin,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run tests/unit/scripts/twin-transform.test.ts`
Expected: PASS — all `describe` blocks green.

- [ ] **Step 5: Commit**

```bash
git add scripts/twin-transform.cjs tests/unit/scripts/twin-transform.test.ts
git commit -m "feat(deck): pure mirror-swap twin transform module + tests" -- scripts/twin-transform.cjs tests/unit/scripts/twin-transform.test.ts
```

---

# PHASE 2 — Enumerator Wiring

The script edits. Not unit-testable (Firestore + engine side effects), so each task is verified by running the script: a dry-run for parsing/messaging, then a tiny real seed + Firestore read-back for correctness.

### Task 2: `--twin` flag — parse, validate, log

**Files:**
- Modify: `scripts/enumerate-deck.cjs:43` (flag parse), `:16` (require helper), `:104-113` (log)

- [ ] **Step 1: Require the helper at the top**

In `scripts/enumerate-deck.cjs`, directly after the existing require at line 16:

```js
const { REVERSAL_PATTERNS, applyReversalPattern } = require("./apply-reversal-pattern.cjs");
```

add:

```js
const {
  buildLocationToPositionMap,
  twinSequence,
  isSelfTwin,
} = require("./twin-transform.cjs");
```

- [ ] **Step 2: Parse the flag**

After line 43 (`const reversalPattern = getArg("reversalPattern");`) add:

```js
const twin = hasFlag("twin");
```

- [ ] **Step 3: Log it**

In the config log block, after the existing `console.log` for Reversal (line 110: `console.log(`  Reversal: ${reversalPattern || 'continuous'}`);`) add:

```js
  console.log(`  Twin (mirror+swap): ${twin}`);
```

- [ ] **Step 4: Verify parse + log (dry-run, no seed)**

Run: `node scripts/enumerate-deck.cjs --loopType rotated --slice halved --seedLength 2 --level 1 --twin`
Expected: the header prints `Twin (mirror+swap): true`, the enumeration table prints as before, and the footer hint about `--out`/`--seed-firestore` prints. No errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(deck): add --twin flag parse, require, and logging" -- scripts/enumerate-deck.cjs
```

---

### Task 3: Build `locToPos` and emit twin docs in the seeding loop

**Files:**
- Modify: `scripts/enumerate-deck.cjs` — engine map requires + `locToPos` (near `:680`), twin emission inside the write loop (after `:1014`)

- [ ] **Step 1: Require the engine mirror maps + build `locToPos`**

Inside the `if (seedFirestore) {` block, immediately after the executor/orientation requires (currently lines 680-681):

```js
    const { loopExecutorSelector } = require("../packages/sequence-engine/dist/loop/execution/LOOPExecutorSelector.js");
    const { calculateEndOrientation } = require("../packages/sequence-engine/dist/core/orientation/OrientationCalculator.js");
```

add:

```js
    // Twin transform inputs: the engine's vertical-mirror location map and the
    // rotation-flip fn (reused, not hand-rolled), plus a location->position
    // table built from the same CSV the enumeration walks. The twin module is
    // pure and takes these as parameters.
    const {
      VERTICAL_MIRROR_LOCATION_MAP,
    } = require("../packages/sequence-engine/dist/loop/position-maps/strict-loop-position-maps.js");
    const {
      mirrorHandRotationDirection,
    } = require("../packages/sequence-engine/dist/loop/position-maps/circular-position-maps.js");
    const locToPos = twin ? buildLocationToPositionMap(edges) : null;
    const twinDeps = twin
      ? {
          mirrorLocationMap: VERTICAL_MIRROR_LOCATION_MAP,
          mirrorRotation: mirrorHandRotationDirection,
          locToPos,
        }
      : null;
    // Twin bookkeeping: family label -> Set of twin seq ids, plus guards.
    const twinIdsByFamily = new Map();
    const writtenSeqIds = new Set();
    let selfTwinSkipped = 0;
    let twinDupSkipped = 0;
    let twinLetterMisses = 0;
```

(`edges`, `twin`, `TYPES`, `TYPE_NAMES`, `lookupLetterFromMotions`, `propagateOrientations`, `engineStepToFirestore`, `gridMode`, `slice`, `level`, `loopType`, `reversalPattern`, `seedLength` are all already in scope here.)

- [ ] **Step 2: Track every written id (base + future twins)**

In the write loop, the base doc is added at lines 1012-1014:

```js
      batch.set(seqRef, seqData);
      batchCount++;
      totalWritten++;
```

Immediately after `totalWritten++;` add:

```js
      writtenSeqIds.add(seqId);
```

- [ ] **Step 3: Emit the twin doc**

Still in the write loop, directly after the family-tracking block (currently lines 1016-1018):

```js
      // Track which family this sequence belongs to
      const familyIdx = seedToFamilyIdx.get(seqId);
      if (familyIdx !== undefined) writtenByFamily.get(familyIdx).add(seqId);
```

add:

```js
      // ── Twin (mirror + color swap) ─────────────────────────────────────
      if (twin) {
        // Geometry from the pure module, applied to the FULL executed steps so
        // the twin matches the rendered card exactly (not the pre-loop seed).
        const twinSteps = twinSequence(fullSteps, twinDeps);

        // Re-propagate orientations: the start step is static (in/in); the rest
        // are recomputed from the swapped/mirrored motions.
        const ts0 = twinSteps[0];
        ts0.motions.blue.startOrientation = "in";
        ts0.motions.blue.endOrientation = "in";
        ts0.motions.red.startOrientation = "in";
        ts0.motions.red.endOrientation = "in";
        propagateOrientations(twinSteps);

        // Re-derive letters for the beat steps from the transformed motions.
        const twinBeatSteps = twinSteps.slice(1);
        let twinPositionMiss = false;
        for (const ts of twinBeatSteps) {
          if (ts.startPosition === null || ts.endPosition === null) {
            twinPositionMiss = true;
            break;
          }
          const L = lookupLetterFromMotions(ts);
          if (L) ts.letter = L;
          else twinLetterMisses++;
        }

        // Skip if any beat's mirrored hand pair was absent from the CSV
        // (physically invalid twin — should not occur for valid grid mirrors).
        if (twinPositionMiss) {
          // counted via guard below; treat like a dup-skip for reporting
          twinDupSkipped++;
        } else if (isSelfTwin(fullSteps, twinSteps)) {
          // Self-twin: a card equal to its own mirror-swap. Excluded by design.
          selfTwinSkipped++;
        } else {
          const twinStartPos = twinSteps[0].startPosition;
          const twinWord = twinBeatSteps.map((s) => s.letter).join("");
          const twinSeqId = `${twinStartPos}_${twinWord}`;

          if (writtenSeqIds.has(twinSeqId)) {
            // Cross-duplicate guard (expected count 0: twin starts are disjoint
            // from generated starts under canonical start positions).
            twinDupSkipped++;
          } else {
            // Build the twin start position doc in the same shape as the base.
            const tsp = twinSteps[0];
            const twinStartPosition = {
              isStartPosition: true,
              id: `start-${twinSeqId}`,
              gridPosition: tsp.startPosition,
              gridMode,
              motions: {
                blue: {
                  motionType: tsp.motions.blue.motionType,
                  rotationDirection: tsp.motions.blue.rotationDirection,
                  startLocation: tsp.motions.blue.startLocation,
                  endLocation: tsp.motions.blue.endLocation,
                  turns: tsp.motions.blue.turns ?? 0,
                  startOrientation: tsp.motions.blue.startOrientation ?? "in",
                  endOrientation: tsp.motions.blue.endOrientation ?? "in",
                  isVisible: true,
                  propType: "staff",
                  color: "blue",
                  gridMode,
                },
                red: {
                  motionType: tsp.motions.red.motionType,
                  rotationDirection: tsp.motions.red.rotationDirection,
                  startLocation: tsp.motions.red.startLocation,
                  endLocation: tsp.motions.red.endLocation,
                  turns: tsp.motions.red.turns ?? 0,
                  startOrientation: tsp.motions.red.startOrientation ?? "in",
                  endOrientation: tsp.motions.red.endOrientation ?? "in",
                  isVisible: true,
                  propType: "staff",
                  color: "red",
                  gridMode,
                },
              },
            };

            const twinFsSteps = twinBeatSteps.map((s, i) =>
              engineStepToFirestore(s, i)
            );

            const twinSeqData = {
              id: twinSeqId,
              name: twinWord,
              word: twinWord,
              gridMode,
              isCircular: true,
              loopType: loopType,
              orientationCycleCount: slice === "quartered" ? 4 : 2,
              reversalPattern: reversalPattern || "continuous",
              sequenceLength: twinFsSteps.length,
              level,
              isFavorite: false,
              tags: [],
              thumbnails: [],
              steps: twinFsSteps,
              startPosition: twinStartPosition,
              metadata: {
                seedWord: twinBeatSteps
                  .slice(0, seedLength)
                  .map((s) => s.letter)
                  .join(""),
                handPathFamily: twinBeatSteps
                  .slice(0, seedLength)
                  .map((s) => TYPE_NAMES[TYPES[s.letter] || 0] || "Unknown")
                  .join("+"),
              },
              author: "TKA Enumerator",
              notes: "",
            };

            const twinRef = db.doc(`decks/${deckId}/sequences/${twinSeqId}`);
            batch.set(twinRef, twinSeqData);
            batchCount++;
            totalWritten++;
            writtenSeqIds.add(twinSeqId);

            const fam = twinSeqData.metadata.handPathFamily;
            if (!twinIdsByFamily.has(fam)) twinIdsByFamily.set(fam, new Set());
            twinIdsByFamily.get(fam).add(twinSeqId);
          }
        }
      }
```

- [ ] **Step 4: Verify a twin doc is written and matches the reference (tiny real seed)**

Seed a small twin deck (2-beat halved rotated, L1) to Firestore:

Run: `node scripts/enumerate-deck.cjs --loopType rotated --slice halved --seedLength 2 --level 1 --twin --seed-firestore`
Expected: completes without throwing; "Done!" line shows roughly double the non-twin count for the same config; any `LOOP error` lines are pre-existing executor behavior, not twin errors.

Then confirm a base card and its twin both exist and the twin is the mirror-swap, using a node read-back:

Run:
```bash
node -e '
const admin=require("firebase-admin");
const sa=JSON.parse(require("fs").readFileSync("./serviceAccountKey.json","utf8"));
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(sa)});
const db=admin.firestore();
(async()=>{
  const deck="l1-halved-rotated-twin-4beat";
  const snap=await db.collection(`decks/${deck}/sequences`).limit(2).get();
  snap.forEach(d=>{const x=d.data();const s=x.startPosition.motions;
    console.log(d.id,"blue",s.blue.startLocation,"red",s.red.startLocation,"pos",x.startPosition.gridPosition);});
  process.exit(0);
})();
'
```
Expected: two docs print with start positions; at least one pair shows the e↔w mirror + color swap relationship (e.g. a base at `gamma13 blue=w red=s` and a twin at `gamma11 blue=s red=e`).

> Note: `deckId` does not yet contain `-twin` until Task 4. For this step the deck id is the non-twin id (`l1-halved-rotated-4beat`) with twin docs mixed in. Read that id here; switch to `-twin` after Task 4.

- [ ] **Step 5: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(deck): emit mirror-swap twin docs in the enumerator seeding loop" -- scripts/enumerate-deck.cjs
```

---

### Task 4: `-twin` in deck id/name + merge twin families into deck metadata

**Files:**
- Modify: `scripts/enumerate-deck.cjs:659` (deckId), `:1034-1052` (family merge + name/description)

- [ ] **Step 1: Add `-twin` to the deck id**

Replace line 659:

```js
    const deckId = `l${level}-${slice}-${loopType.replace(/_/g, "-")}-${totalBeats}beat`;
```

with:

```js
    const deckId = `l${level}-${slice}-${loopType.replace(/_/g, "-")}${twin ? "-twin" : ""}-${totalBeats}beat`;
```

- [ ] **Step 2: Merge twin families into `familyDocs`**

The base family docs are built at lines 1034-1037:

```js
    const familyDocs = sortedGroups.map(([family], idx) => {
      const ids = [...writtenByFamily.get(idx)];
      return { id: `family-${idx}`, label: family, typeCombo: family, sequenceIds: ids };
    }).filter(f => f.sequenceIds.length > 0);
```

Immediately after that statement add:

```js
    // Fold twin cards into family docs: same-label families merge; new labels
    // become additional family docs so the Decks UI surfaces every twin.
    if (twin) {
      let twinFamilyIdx = 0;
      for (const [label, idSet] of twinIdsByFamily) {
        const existing = familyDocs.find((f) => f.label === label);
        if (existing) {
          existing.sequenceIds.push(...idSet);
        } else {
          familyDocs.push({
            id: `family-twin-${twinFamilyIdx++}`,
            label,
            typeCombo: label,
            sequenceIds: [...idSet],
          });
        }
      }
    }
```

- [ ] **Step 3: Note twin construction in name + description**

Replace the `name`/`description` lines (1040-1041):

```js
      name: `Level ${level}: ${sliceLabel} ${loopLabel} LOOP`,
      description: `Complete enumeration of all L${level} ${slice} ${loopLabel} LOOP sequences. ${totalWritten} sequences across ${familyDocs.length} hand-path families.`,
```

with:

```js
      name: `Level ${level}: ${sliceLabel} ${loopLabel} LOOP${twin ? " · Twin" : ""}`,
      description: twin
        ? `${sliceLabel} ${loopLabel} LOOP, Twin edition: each card paired with its mirror-swap (vertical mirror + color swap), self-twins excluded. ${totalWritten} sequences across ${familyDocs.length} hand-path families.`
        : `Complete enumeration of all L${level} ${slice} ${loopLabel} LOOP sequences. ${totalWritten} sequences across ${familyDocs.length} hand-path families.`,
```

- [ ] **Step 4: Verify the deck id, name, and families (re-seed)**

Run: `node scripts/enumerate-deck.cjs --loopType rotated --slice halved --seedLength 2 --level 1 --twin --seed-firestore`
Expected: the "Seeding deck" line and "Done!" line reference `l1-halved-rotated-twin-4beat`.

Read back the deck doc:
```bash
node -e '
const admin=require("firebase-admin");
const sa=JSON.parse(require("fs").readFileSync("./serviceAccountKey.json","utf8"));
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(sa)});
const db=admin.firestore();
(async()=>{
  const d=await db.doc("decks/l1-halved-rotated-twin-4beat").get();
  const x=d.data();
  console.log("name:",x.name);
  console.log("total:",x.totalSequences,"families:",x.families.length);
  const sum=x.families.reduce((a,f)=>a+f.sequenceIds.length,0);
  console.log("sum of family ids:",sum,"==",x.totalSequences,"?",sum===x.totalSequences);
  process.exit(0);
})();
'
```
Expected: name ends with `· Twin`; `sum of family ids === totalSequences` is `true` (every written card, base + twin, lives in exactly one family).

- [ ] **Step 5: Commit**

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(deck): -twin deck id, name, and twin family merge into metadata" -- scripts/enumerate-deck.cjs
```

---

### Task 5: Dry-run reporting + final verification

**Files:**
- Modify: `scripts/enumerate-deck.cjs` — summary print near `:567` (non-seed path) + seed-time twin counts near `:1056`

- [ ] **Step 1: Note twin doubling in the non-seed summary**

After the TOTAL summary line (1567 region — line 567):

```js
  console.log(`  TOTAL: ${deduped.length} unique sequences in the Level ${level} ${slice} ${loopType} Deck`);
```

add:

```js
  if (twin) {
    console.log(
      `  TWIN: deck will seed up to ${deduped.length * 2} cards ` +
        `(${deduped.length} generated + ${deduped.length} mirror-swap twins; ` +
        `self-twins and any reversal-filtered cards are removed at seed time).`
    );
  }
```

- [ ] **Step 2: Report twin counts at the end of seeding**

After the existing post-seed filter message (lines 1056-1059):

```js
    console.log(`  Done! ${totalWritten} sequences written to decks/${deckId}/sequences/`);
    if (totalWritten < deduped.length) {
      console.log(`  Filtered out ${deduped.length - totalWritten} sequences with reversals (continuous deck)`);
    }
```

add:

```js
    if (twin) {
      console.log(
        `  Twin: ${twinIdsByFamily.size} twin family group(s); ` +
          `${selfTwinSkipped} self-twin(s) excluded; ` +
          `${twinDupSkipped} twin(s) skipped (duplicate or invalid mirror); ` +
          `${twinLetterMisses} twin beat(s) kept an un-re-derived letter.`
      );
    }
```

- [ ] **Step 3: Verify dry-run messaging**

Run: `node scripts/enumerate-deck.cjs --loopType rotated --slice halved --seedLength 2 --level 1 --twin`
Expected: prints the `TWIN: deck will seed up to <2N> cards ...` line; no Firestore write occurs.

- [ ] **Step 4: Full verification run (orientation + reference pair)**

Re-seed and confirm a derived ANTI card has propagated orientation (in→out somewhere) and the reference pair holds:
```bash
node scripts/enumerate-deck.cjs --loopType rotated --slice halved --seedLength 2 --level 1 --twin --seed-firestore
node -e '
const admin=require("firebase-admin");
const sa=JSON.parse(require("fs").readFileSync("./serviceAccountKey.json","utf8"));
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(sa)});
const db=admin.firestore();
(async()=>{
  const deck="l1-halved-rotated-twin-4beat";
  const snap=await db.collection(`decks/${deck}/sequences`).get();
  let antiFlip=false, total=0;
  snap.forEach(d=>{total++;const x=d.data();
    for(const st of x.steps){for(const c of ["blue","red"]){const m=st.motions[c];
      if(m.motionType==="anti" && m.startOrientation!==m.endOrientation) antiFlip=true;}}});
  console.log("total cards:",total,"| an anti beat flips orientation:",antiFlip);
  process.exit(0);
})();
'
```
Expected: `total cards` is the doubled count; `an anti beat flips orientation: true` (proves twin orientations were re-propagated, not copied).

- [ ] **Step 5: Full check + commit**

Run: `npm run check`
Expected: no new errors attributable to `scripts/` or `tests/unit/scripts/twin-transform.test.ts` (scripts are JS; the test is TS and must type-check clean).

```bash
git add scripts/enumerate-deck.cjs
git commit -m "feat(deck): twin dry-run estimate and seed-time twin count reporting" -- scripts/enumerate-deck.cjs
```

---

## Self-Review

**Spec coverage:**
- Generated half + derived half, deck = 2N → Task 3 (twin emission per card).
- Transform = colorSwap ∘ verticalMirror on FULL steps → Task 1 (`twinSequence` over `fullSteps`) + Task 3 (applied to `fullSteps`).
- Positions derived from transformed location pair, NOT `VERTICAL_MIRROR_POSITION_MAP` → Task 1 (`buildLocationToPositionMap` + `twinStep` lookup); asserted in test.
- Reuse engine maps, no hand-roll → Task 3 requires `VERTICAL_MIRROR_LOCATION_MAP` + `mirrorHandRotationDirection`, passed into the pure module.
- Letter re-derive + orientation re-propagate → Task 3 (`lookupLetterFromMotions`, `propagateOrientations`).
- Self-twins excluded → Task 1 (`isSelfTwin`) + Task 3 (skip + count).
- Cross-duplicate guard → Task 3 (`writtenSeqIds` Set).
- No new card fields (twin not stored as role/pairId) → twin docs reuse the base shape; `seqId` derived from start+word, no `twinRole`/`twinOf`.
- `-twin` deck id/name/description → Task 4.
- Family grouping kept, twins merged by label → Task 4.
- Dry-run reporting + verification → Task 5.

**Placeholder scan:** none — every code step is complete; verification uses real run commands with explicit expected output.

**Type/name consistency:** `buildLocationToPositionMap`, `twinSequence`, `twinStep`, `isSelfTwin` exported in Task 1 and consumed with the same names/signatures in Tasks 2-3. `twinDeps` shape `{ mirrorLocationMap, mirrorRotation, locToPos }` matches the module's destructure. `twinIdsByFamily`, `writtenSeqIds`, `selfTwinSkipped`, `twinDupSkipped`, `twinLetterMisses` declared in Task 3 Step 1 and used in Tasks 3-5. `deckId` (`-twin`) defined in Task 4 before the Task 4/5 read-backs reference it.

**Known caveat (carried from spec):** twins are emitted only on the Firestore seeding path (where full executed steps exist); the `--out` JSON path is seed-level/pre-execution and is intentionally unchanged. The non-seed dry-run prints an *estimate* (2N), with exact counts at seed time — consistent with how the script already reports reversal filtering only at seed time.
