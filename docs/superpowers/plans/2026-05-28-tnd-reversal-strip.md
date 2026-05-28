# TnD By-Family Reversal Strip + Live Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the TnD By-Family reversal chip row with an interactive 4-step per-step reversal timeline strip under the six family hero cards; unseeded clean patterns seed live by transforming base sequences and writing variant catalogs to Firestore.

**Architecture:** A pure domain module ports the proven CJS reversal transform and adds pattern resolution. A CSV-backed letter lookup + the existing client orientation propagator recompute letters/orientations after the motion flip. A seed service orchestrates load → transform → recompute → validate → Firestore write, mirroring `scripts/seed-reversal-decks.cjs` but client-side. The strip component drives a single-active reversal filter through `catalog-browse-state`.

**Tech Stack:** Svelte 5 runes, TypeScript, Firebase Firestore (client SDK), Vitest. Spec: `docs/superpowers/specs/2026-05-28-tnd-reversal-strip-design.md`.

---

## File Structure

**New:**
- `src/lib/features/choreo-card/domain/reversal-transform.ts` — pure transform + `resolvePattern`
- `src/lib/features/choreo-card/services/pictograph-letter-lookup.ts` — CSV fetch/parse + step→letter match
- `src/lib/features/choreo-card/services/reversal-seed-service.ts` — seed orchestration
- `src/lib/features/choreo-card/components/TnDReversalStrip.svelte` — the strip
- `tests/unit/reversal-transform.test.ts`
- `tests/unit/pictograph-letter-lookup.test.ts`

**Modified:**
- `src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts` — `setReversalPattern(id)`
- `src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte` — remove reversal chip row
- `src/lib/features/choreo-card/components/TnDFamilyGrid.svelte` — host strip, relax hero min-height, pass `familyCounts`
- `src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte` — forward strip props/callbacks
- `src/lib/features/choreo-card/components/CatalogBrowser.svelte` — own active-pattern state + seed empty-state

**Reused (not modified):**
- `src/lib/features/choreo-card/domain/reversal-patterns.ts` (`SIMPLE_PATTERNS`, defs)
- `src/lib/features/choreo-card/services/catalog-loader.ts` (`loadCatalogSequences`, `loadCatalogs`)
- `src/lib/shared/create/services/orientation-propagation.ts` (`propagateOrientationsForColor`)
- `src/lib/shared/pictograph/prop/services/implementations/OrientationCalculator.ts`
- `src/lib/shared/library/data/firestore-paths.ts` (`getSystemCatalogPath`, `getSystemCatalogSequencesPath`)
- `static/data/pictographs/DiamondPictographDataframe.csv` (served at `/data/pictographs/DiamondPictographDataframe.csv`)

---

## Task 1: Reversal transform domain module

**Files:**
- Create: `src/lib/features/choreo-card/domain/reversal-transform.ts`
- Test: `tests/unit/reversal-transform.test.ts`

This is the TS port of `scripts/apply-reversal-pattern.cjs` plus `resolvePattern`. It operates on plain motion-type strings and on the 4-cell blue/red boolean arrays the strip produces. It does NOT touch Firestore or StepData — pure functions only.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/reversal-transform.test.ts
import { describe, it, expect } from "vitest";
import {
  applyReversalToMotion,
  getReversalFlagsForBeat,
  resolvePattern,
  type ResolvedReversalPattern,
} from "$lib/features/choreo-card/domain/reversal-transform";

describe("applyReversalToMotion", () => {
  it("flips pro↔anti when reversed", () => {
    expect(applyReversalToMotion("pro", true)).toBe("anti");
    expect(applyReversalToMotion("anti", true)).toBe("pro");
  });
  it("leaves pro/anti unchanged when not reversed", () => {
    expect(applyReversalToMotion("pro", false)).toBe("pro");
    expect(applyReversalToMotion("anti", false)).toBe("anti");
  });
  it("leaves static and dash unchanged even when reversed", () => {
    expect(applyReversalToMotion("static", true)).toBe("static");
    expect(applyReversalToMotion("dash", true)).toBe("dash");
  });
});

describe("getReversalFlagsForBeat", () => {
  it("maps P/R/B/- symbols", () => {
    expect(getReversalFlagsForBeat("PPPP", 0)).toEqual({ blueReversal: true, redReversal: true });
    expect(getReversalFlagsForBeat("RRRR", 0)).toEqual({ blueReversal: false, redReversal: true });
    expect(getReversalFlagsForBeat("BBBB", 0)).toEqual({ blueReversal: true, redReversal: false });
    expect(getReversalFlagsForBeat("----", 0)).toEqual({ blueReversal: false, redReversal: false });
  });
  it("wraps via modulo", () => {
    expect(getReversalFlagsForBeat("P-", 4)).toEqual(getReversalFlagsForBeat("P-", 0));
  });
  it("throws on unknown symbol", () => {
    expect(() => getReversalFlagsForBeat("X", 0)).toThrow();
  });
});

describe("resolvePattern", () => {
  const F = false, T = true;

  it("all-false → continuous, named, clean", () => {
    const r = resolvePattern([F, F, F, F], [F, F, F, F]);
    expect(r.sequence).toBe("----");
    expect(r.id).toBe("continuous");
    expect(r.label).toBe("Continuous");
    expect(r.isNamed).toBe(true);
    expect(r.isCleanLoop).toBe(true);
  });

  it("both all-true → book (PPPP)", () => {
    const r = resolvePattern([T, T, T, T], [T, T, T, T]);
    expect(r.sequence).toBe("PPPP");
    expect(r.id).toBe("book");
    expect(r.isNamed).toBe(true);
  });

  it("red all-true, blue none → red-book (RRRR)", () => {
    const r = resolvePattern([F, F, F, F], [T, T, T, T]);
    expect(r.sequence).toBe("RRRR");
    expect(r.id).toBe("red-book");
  });

  it("alternating red@0,2 blue@1,3 → RBRB", () => {
    const r = resolvePattern([F, T, F, T], [T, F, T, F]);
    expect(r.sequence).toBe("RBRB");
    expect(r.id).toBe("alternating");
    expect(r.isNamed).toBe(true);
  });

  it("custom even-count pattern → string id, not named, clean", () => {
    // blue@0,1 (count 2, even), red none → "BB--"
    const r = resolvePattern([T, T, F, F], [F, F, F, F]);
    expect(r.sequence).toBe("BB--");
    expect(r.id).toBe("BB--");
    expect(r.label).toBe("Custom");
    expect(r.isNamed).toBe(false);
    expect(r.isCleanLoop).toBe(true);
  });

  it("odd reversal count on a hand → not clean loop", () => {
    // blue@0 only (count 1, odd) → "B---"
    const r = resolvePattern([T, F, F, F], [F, F, F, F]);
    expect(r.sequence).toBe("B---");
    expect(r.isCleanLoop).toBe(false);
  });

  it("pair symbol emitted when both reverse same step", () => {
    const r = resolvePattern([T, F, F, F], [T, F, F, F]); // both@0
    expect(r.sequence[0]).toBe("P");
    expect(r.isCleanLoop).toBe(false); // each hand count 1 = odd
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/reversal-transform.test.ts`
Expected: FAIL — cannot resolve module `reversal-transform`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/choreo-card/domain/reversal-transform.ts
import { SIMPLE_PATTERNS } from "./reversal-patterns";

export type ReversalMotion = "pro" | "anti" | "static" | "dash";

/** Flip pro↔anti when reversed. Static/dash have no rotation to invert. */
export function applyReversalToMotion(motionType: string, isReversed: boolean): string {
  if (!isReversed) return motionType;
  switch (motionType) {
    case "pro": return "anti";
    case "anti": return "pro";
    default: return motionType; // static, dash, anything else
  }
}

export interface ReversalFlags {
  blueReversal: boolean;
  redReversal: boolean;
}

/** Read pattern[beat % length] → which hands reverse. Symbols: P/R/B/-. */
export function getReversalFlagsForBeat(patternSequence: string, beatIndex: number): ReversalFlags {
  const symbol = patternSequence[beatIndex % patternSequence.length];
  switch (symbol) {
    case "P": return { blueReversal: true, redReversal: true };
    case "R": return { blueReversal: false, redReversal: true };
    case "B": return { blueReversal: true, redReversal: false };
    case "-": return { blueReversal: false, redReversal: false };
    default:
      throw new Error(`Unknown reversal symbol "${symbol}" in "${patternSequence}". Valid: P R B -.`);
  }
}

export interface ResolvedReversalPattern {
  /** Named preset id ("book") or the 4-char string for customs ("BB--"). */
  id: string;
  /** "Book" | "Custom" | preset label. */
  label: string;
  /** 4-char P/B/R/- string. */
  sequence: string;
  isNamed: boolean;
  /** Even reversal count per hand → returns to start direction at the loop boundary. */
  isCleanLoop: boolean;
}

/** Build the per-step symbol string from blue/red toggle arrays. */
function toSequenceString(blue: boolean[], red: boolean[]): string {
  let out = "";
  for (let i = 0; i < blue.length; i++) {
    const b = blue[i];
    const r = red[i];
    if (b && r) out += "P";
    else if (r) out += "R";
    else if (b) out += "B";
    else out += "-";
  }
  return out;
}

/** True when `candidate` equals `pattern` tiled to candidate.length. */
function tilesTo(patternSequence: string, candidate: string): boolean {
  for (let i = 0; i < candidate.length; i++) {
    if (patternSequence[i % patternSequence.length] !== candidate[i]) return false;
  }
  return true;
}

export function resolvePattern(blue: boolean[], red: boolean[]): ResolvedReversalPattern {
  const sequence = toSequenceString(blue, red);

  const blueCount = blue.filter(Boolean).length;
  const redCount = red.filter(Boolean).length;
  const isCleanLoop = blueCount % 2 === 0 && redCount % 2 === 0;

  const named = SIMPLE_PATTERNS.find((p) => tilesTo(p.sequence, sequence));
  if (named) {
    return { id: named.id, label: named.label, sequence, isNamed: true, isCleanLoop };
  }
  return { id: sequence, label: "Custom", sequence, isNamed: false, isCleanLoop };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/reversal-transform.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/domain/reversal-transform.ts tests/unit/reversal-transform.test.ts
git commit -m "feat(choreo-card): reversal transform domain + pattern resolution"
```

---

## Task 2: CSV-backed letter lookup

**Files:**
- Create: `src/lib/features/choreo-card/services/pictograph-letter-lookup.ts`
- Test: `tests/unit/pictograph-letter-lookup.test.ts`

Ports the CSV edge match from `seed-reversal-decks.cjs` (`lookupLetterForStep`) to the browser. Fetches `/data/pictographs/DiamondPictographDataframe.csv`, parses rows, and matches a step's `(startPosition, endPosition, blue/red motionType + start/end locations)` to a letter. Parsing is pure and unit-tested; the fetch is a thin async wrapper.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/pictograph-letter-lookup.test.ts
import { describe, it, expect } from "vitest";
import {
  parseCsvEdges,
  lookupLetter,
  type CsvEdge,
} from "$lib/features/choreo-card/services/pictograph-letter-lookup";

const CSV = [
  "letter,startPosition,endPosition,blueMotionType,blueStartLocation,blueEndLocation,redMotionType,redStartLocation,redEndLocation",
  "A,alpha1,alpha2,pro,s,w,pro,n,e",
  "B,alpha1,alpha2,anti,s,w,anti,n,e",
].join("\n");

describe("parseCsvEdges", () => {
  it("parses header + rows into objects", () => {
    const edges = parseCsvEdges(CSV);
    expect(edges).toHaveLength(2);
    expect(edges[0].letter).toBe("A");
    expect(edges[1].blueMotionType).toBe("anti");
  });
});

describe("lookupLetter", () => {
  const edges = parseCsvEdges(CSV);
  it("matches a step on positions + motion types + locations", () => {
    const letter = lookupLetter(edges, {
      startPosition: "alpha1",
      endPosition: "alpha2",
      blue: { motionType: "anti", startLocation: "s", endLocation: "w" },
      red: { motionType: "anti", startLocation: "n", endLocation: "e" },
    });
    expect(letter).toBe("B");
  });
  it("returns null when no edge matches", () => {
    const letter = lookupLetter(edges, {
      startPosition: "beta1",
      endPosition: "beta2",
      blue: { motionType: "pro", startLocation: "s", endLocation: "w" },
      red: { motionType: "pro", startLocation: "n", endLocation: "e" },
    });
    expect(letter).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pictograph-letter-lookup.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/features/choreo-card/services/pictograph-letter-lookup.ts

export interface CsvEdge {
  letter: string;
  startPosition: string;
  endPosition: string;
  blueMotionType: string;
  blueStartLocation: string;
  blueEndLocation: string;
  redMotionType: string;
  redStartLocation: string;
  redEndLocation: string;
  [key: string]: string;
}

export interface StepMotionQuery {
  startPosition: string;
  endPosition: string;
  blue: { motionType: string; startLocation: string; endLocation: string };
  red: { motionType: string; startLocation: string; endLocation: string };
}

/** Parse the pictograph dataframe CSV text into edge rows. */
export function parseCsvEdges(csvText: string): CsvEdge[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const edge: Record<string, string> = {};
    headers.forEach((h, i) => (edge[h] = cols[i] ?? ""));
    return edge as CsvEdge;
  });
}

/** Find the letter for a transformed step by exact edge match. Null when none. */
export function lookupLetter(edges: CsvEdge[], q: StepMotionQuery): string | null {
  const match = edges.find(
    (e) =>
      e.startPosition === q.startPosition &&
      e.endPosition === q.endPosition &&
      e.blueMotionType === q.blue.motionType &&
      e.blueStartLocation === q.blue.startLocation &&
      e.blueEndLocation === q.blue.endLocation &&
      e.redMotionType === q.red.motionType &&
      e.redStartLocation === q.red.startLocation &&
      e.redEndLocation === q.red.endLocation,
  );
  return match ? match.letter : null;
}

let cachedDiamondEdges: CsvEdge[] | null = null;

/** Fetch + cache the diamond pictograph dataframe (served from /static). */
export async function loadDiamondEdges(): Promise<CsvEdge[]> {
  if (cachedDiamondEdges) return cachedDiamondEdges;
  const res = await fetch("/data/pictographs/DiamondPictographDataframe.csv");
  if (!res.ok) throw new Error(`Failed to load pictograph CSV: ${res.status}`);
  cachedDiamondEdges = parseCsvEdges(await res.text());
  return cachedDiamondEdges;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pictograph-letter-lookup.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the CSV header matches the lookup keys**

The lookup assumes columns `startPosition,endPosition,blueMotionType,blueStartLocation,blueEndLocation,redMotionType,redStartLocation,redEndLocation,letter`. Confirm the real header before trusting seeds.

Run: `node -e "const fs=require('fs');console.log(fs.readFileSync('static/data/pictographs/DiamondPictographDataframe.csv','utf8').split('\n')[0])"`
Expected: a header line containing those column names. If column names differ (e.g. `start_pos`), update the `CsvEdge` interface and `lookupLetter` keys to match, and re-run Step 4.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/services/pictograph-letter-lookup.ts tests/unit/pictograph-letter-lookup.test.ts
git commit -m "feat(choreo-card): CSV-backed pictograph letter lookup"
```

---

## Task 3: Reversal seed service

**Files:**
- Create: `src/lib/features/choreo-card/services/reversal-seed-service.ts`

Orchestrates live seeding for one pattern. Mirrors `scripts/seed-reversal-decks.cjs` but client-side: load base sequences, clone, apply reversal (flip motionType AND rotationDirection + set flags), re-derive letters, recompute orientations, then write a materialized variant catalog per base catalog. Preserves each base catalog's family→seqId mapping (reversal flips prop spin, not hand path / TnD family).

No unit test for the orchestration (it does Firestore IO); the pure pieces it calls (Task 1, Task 2) are already covered. Correctness is verified in Task 6's manual browser check (re-derive a known seeded pattern and compare).

- [ ] **Step 1: Read the orientation propagator + a base sequence shape to confirm field names**

Run: `npx vitest run tests/unit/reversal-transform.test.ts tests/unit/pictograph-letter-lookup.test.ts`
Expected: PASS (sanity that deps compile).

Read `src/lib/shared/create/services/orientation-propagation.ts` (full) to confirm `propagateOrientationsForColor(steps, color, initialOrientation, orientationCalculator)` and whether a whole-sequence helper exists. Read `src/lib/shared/pictograph/prop/services/implementations/OrientationCalculator.ts` to confirm the constructor (`new OrientationCalculator()`) and that `calculateEndOrientation(motionData, color)` is the public method. Read one base sequence doc shape via the loader's `SequenceData`/`StepData` types (`src/lib/shared/foundation/domain/models/StepData.ts`) to confirm `step.motions.blue.{motionType,rotationDirection,startLocation,endLocation,startOrientation,endOrientation}` and `step.letter`, `step.startPosition`/`step.endPosition` (or grid-position equivalents).

- [ ] **Step 2: Write the implementation**

```ts
// src/lib/features/choreo-card/services/reversal-seed-service.ts
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { doc, writeBatch } from "firebase/firestore";
import {
  getSystemCatalogPath,
  getSystemCatalogSequencesPath,
} from "$lib/shared/library/data/firestore-paths";
import { loadCatalogSequences } from "./catalog-loader";
import { loadDiamondEdges, lookupLetter } from "./pictograph-letter-lookup";
import {
  getReversalFlagsForBeat,
  applyReversalToMotion,
  type ResolvedReversalPattern,
} from "../domain/reversal-transform";
import { propagateOrientationsForColor } from "$lib/shared/create/services/orientation-propagation";
import { OrientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Catalog } from "../domain/models/Catalog";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { CsvEdge } from "./pictograph-letter-lookup";

const orientationCalculator = new OrientationCalculator();

/** Flip one hand's motion (type + spin direction) and set the reversal flag. */
function flipMotion(motion: any, reversed: boolean) {
  if (!motion || !reversed) return;
  motion.motionType = applyReversalToMotion(motion.motionType, true);
  if (motion.rotationDirection === "cw") motion.rotationDirection = "ccw";
  else if (motion.rotationDirection === "ccw") motion.rotationDirection = "cw";
}

/** Transform one sequence in place: flip motions, re-derive letters, recompute orientations. */
function transformSequence(seq: SequenceData, sequenceString: string, edges: CsvEdge[]): SequenceData {
  const clone: SequenceData = JSON.parse(JSON.stringify(seq));
  const steps = (clone.steps ?? []) as StepData[];

  steps.forEach((step, beatIndex) => {
    const { blueReversal, redReversal } = getReversalFlagsForBeat(sequenceString, beatIndex);
    const m = step.motions ?? {};
    flipMotion(m.blue, blueReversal);
    flipMotion(m.red, redReversal);
    (step as any).blueReversal = blueReversal;
    (step as any).redReversal = redReversal;

    if (m.blue && m.red) {
      const letter = lookupLetter(edges, {
        startPosition: String((step as any).startPosition ?? ""),
        endPosition: String((step as any).endPosition ?? ""),
        blue: { motionType: m.blue.motionType, startLocation: m.blue.startLocation, endLocation: m.blue.endLocation },
        red: { motionType: m.red.motionType, startLocation: m.red.startLocation, endLocation: m.red.endLocation },
      });
      if (letter) (step as any).letter = letter;
    }
  });

  // Recompute orientations per color, seeded from the sequence's start-position orientation.
  const blueInit = clone.startPosition?.motions?.blue?.endOrientation ?? "in";
  const redInit = clone.startPosition?.motions?.red?.endOrientation ?? "in";
  let propagated = propagateOrientationsForColor(steps, MotionColor.BLUE, blueInit as any, orientationCalculator);
  propagated = propagateOrientationsForColor(propagated, MotionColor.RED, redInit as any, orientationCalculator);
  clone.steps = propagated;

  // Recompute word from the new per-step letters.
  (clone as any).word = propagated.map((s) => (s as any).letter ?? "").join("");
  (clone as any).name = (clone as any).word;
  return clone;
}

export interface SeedProgress {
  written: number;
  total: number;
}

/**
 * Seed all base catalogs with the given reversal pattern, writing a materialized
 * variant catalog per base. Returns the ids of the catalogs written.
 *
 * @param baseCatalogs the symmetric materialized base catalogs (asymmetric !== true)
 * @param pattern resolved pattern (must be a clean loop; caller gates on isCleanLoop)
 */
export async function seedReversalPattern(
  baseCatalogs: Catalog[],
  pattern: ResolvedReversalPattern,
  onProgress?: (p: SeedProgress) => void,
): Promise<string[]> {
  if (!pattern.isCleanLoop) {
    throw new Error(`Refusing to seed non-clean-loop pattern "${pattern.id}".`);
  }
  if (pattern.id === "continuous") return []; // base catalogs already are continuous

  const db = await getFirestoreInstance();
  const edges = await loadDiamondEdges();
  const writtenIds: string[] = [];
  const total = baseCatalogs.length;

  for (let c = 0; c < baseCatalogs.length; c++) {
    const base = baseCatalogs[c];
    const newId = `${base.id}-${pattern.id}`;
    const baseSeqs = await loadCatalogSequences(base.id);

    // Map base seqId → transformed sequence (id preserved, so family mapping carries over).
    const transformed = baseSeqs.map((s) => transformSequence(s, pattern.sequence, edges));

    const batch = writeBatch(db);
    batch.set(doc(db, getSystemCatalogPath(newId)), {
      ...base,
      id: newId,
      name: `${base.name} (${pattern.sequence})`,
      reversalPattern: pattern.id,
      asymmetric: false,
    });
    for (const seq of transformed) {
      batch.set(doc(db, `${getSystemCatalogSequencesPath(newId)}/${seq.id}`), seq as any);
    }
    await batch.commit();

    writtenIds.push(newId);
    onProgress?.({ written: c + 1, total });
  }

  return writtenIds;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -3`
Expected: 0 errors. Fix any type mismatches surfaced (e.g. `MotionColor` enum member names, `Orientation` type for `blueInit`) by matching the confirmed signatures from Step 1.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/services/reversal-seed-service.ts
git commit -m "feat(choreo-card): client-side reversal seed service"
```

---

## Task 4: Single-active reversal filter + remove chip row

**Files:**
- Modify: `src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts`
- Modify: `src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte`

- [ ] **Step 1: Add `setReversalPattern` to the state**

In `catalog-browse-state.svelte.ts`, inside the returned object (after `toggleFilter`), add:

```ts
    setReversalPattern(id: string | null) {
      filters = { ...filters, reversalPatterns: id ? [id] : [] };
    },
```

- [ ] **Step 2: Remove the reversal chip row from the filter bar**

In `CatalogBrowseFilterBar.svelte`, delete the entire block that renders the TnD reversal chips (the `{#if expanded && catalogState.collection === 'TnD' && catalogState.availableFilters.reversalPatterns.length > 1}` … `{/if}` group, including its `FilterChipRow` and the nested clear button). Also remove the now-unused `REVERSAL_LABELS` map and `reversalLabel` function if nothing else references them.

Verify nothing else references `reversalLabel`:

Run: `npx vitest run --reporter=dot 2>/dev/null; grep -rn "reversalLabel" src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte`
Expected: no matches after deletion.

- [ ] **Step 3: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -3`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/state/catalog-browse-state.svelte.ts src/lib/features/choreo-card/components/CatalogBrowseFilterBar.svelte
git commit -m "feat(choreo-card): single-active reversal filter, drop chip row"
```

---

## Task 5: TnDReversalStrip component

**Files:**
- Create: `src/lib/features/choreo-card/components/TnDReversalStrip.svelte`

A 4-step port of `reversal-pattern-playground.html`. Two rows (Blue/Red) × 4 toggle cells, a preset quick-row, a pattern string, and a validity badge. No checkboxes — cells are `<button role="switch">`. Emits the resolved pattern via `onPatternChange`.

- [ ] **Step 1: Write the component**

```svelte
<script lang="ts">
  import { SIMPLE_PATTERNS } from "../domain/reversal-patterns";
  import { resolvePattern, type ResolvedReversalPattern } from "../domain/reversal-transform";

  interface Props {
    activePatternId: string | null;
    onPatternChange: (resolved: ResolvedReversalPattern) => void;
  }
  const { activePatternId, onPatternChange }: Props = $props();

  const STEPS = 4;
  let blue = $state<boolean[]>([false, false, false, false]);
  let red = $state<boolean[]>([false, false, false, false]);

  const resolved = $derived(resolvePattern(blue, red));

  // Cumulative spin parity for a hand up to (and including) a step.
  // true = clockwise (base), flips each reversal.
  function spinCW(hand: boolean[], step: number): boolean {
    let cw = true;
    for (let i = 0; i <= step; i++) if (hand[i]) cw = !cw;
    return cw;
  }

  function tile(sequence: string): { blue: boolean[]; red: boolean[] } {
    const b: boolean[] = [], r: boolean[] = [];
    for (let i = 0; i < STEPS; i++) {
      const sym = sequence[i % sequence.length];
      b.push(sym === "P" || sym === "B");
      r.push(sym === "P" || sym === "R");
    }
    return { blue: b, red: r };
  }

  function applyPreset(sequence: string) {
    const t = tile(sequence);
    blue = t.blue;
    red = t.red;
    emit();
  }

  function toggle(hand: "blue" | "red", step: number) {
    if (hand === "blue") blue[step] = !blue[step];
    else red[step] = !red[step];
    emit();
  }

  function emit() {
    onPatternChange(resolvePattern(blue, red));
  }

  // Per-character class for the pattern string.
  function charClass(ch: string): string {
    if (ch === "P") return "pair";
    if (ch === "B") return "blue-only";
    if (ch === "R") return "red-only";
    return "none";
  }
</script>

<div class="reversal-strip">
  <div class="preset-row" role="group" aria-label="Reversal presets">
    {#each SIMPLE_PATTERNS as p (p.id)}
      <button
        type="button"
        class="preset-chip"
        class:active={resolved.id === p.id}
        onclick={() => applyPreset(p.sequence)}
      >{p.label}</button>
    {/each}
  </div>

  <div class="timeline">
    {#each [{ key: "blue", arr: blue, label: "Blue" }, { key: "red", arr: red, label: "Red" }] as row (row.key)}
      <div class="row">
        <span class="row-label {row.key}">{row.label}</span>
        {#each row.arr as active, step (step)}
          <button
            type="button"
            role="switch"
            aria-pressed={active}
            aria-label="{row.label} reversal at step {step + 1}"
            class="cell {row.key}"
            class:active
            onclick={() => toggle(row.key as "blue" | "red", step)}
          >
            <span class="arrow" class:ccw={!spinCW(row.arr, step)}>↻</span>
            {#if active}<span class="rev">REV</span>{/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <div class="footer">
    <span class="pattern-string">
      {#each resolved.sequence.split("") as ch}
        <span class="pat {charClass(ch)}">{ch === "-" ? "—" : ch}</span>
      {/each}
    </span>
    <span class="badge" class:clean={resolved.isCleanLoop} class:broken={!resolved.isCleanLoop}>
      {resolved.isCleanLoop ? "Clean loop" : "Boundary discontinuity"}
    </span>
    <span class="label">{resolved.label}</span>
  </div>
</div>

<style>
  .reversal-strip {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: 18px 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
  }

  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
  }

  .preset-chip {
    padding: 6px 12px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font: inherit;
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .preset-chip:hover { color: var(--theme-text, #fff); }
  .preset-chip.active {
    color: var(--theme-text, #fff);
    border-color: var(--tnd-accent-border, rgba(183, 99, 205, 0.5));
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.15));
  }

  .timeline { display: flex; flex-direction: column; gap: 6px; }

  .row { display: flex; align-items: center; gap: 6px; }

  .row-label {
    width: 42px;
    text-align: right;
    font-size: 12px;
    font-weight: 600;
    padding-right: 6px;
  }
  .row-label.blue { color: var(--prop-blue, #3498db); }
  .row-label.red { color: var(--prop-red, #e74c3c); }

  .cell {
    width: 56px;
    height: 52px;
    border-radius: 8px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .cell:hover { border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)); }
  .cell.blue.active { background: rgba(52, 152, 219, 0.22); border-color: rgba(52, 152, 219, 0.6); color: #fff; }
  .cell.red.active { background: rgba(231, 76, 60, 0.22); border-color: rgba(231, 76, 60, 0.6); color: #fff; }
  .cell:focus-visible { outline: 2px solid var(--theme-accent, #6c8ee8); outline-offset: 2px; }

  .arrow { font-size: 20px; transition: transform 0.2s ease; display: inline-block; }
  .arrow.ccw { transform: scaleX(-1); }
  .rev { font-size: 8px; letter-spacing: 0.05em; font-weight: 600; }

  .footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center; }

  .pattern-string {
    font-family: var(--font-mono, monospace);
    font-size: 16px;
    letter-spacing: 5px;
    display: inline-flex;
  }
  .pat { min-width: 16px; text-align: center; }
  .pat.pair { color: #c084fc; }
  .pat.blue-only { color: var(--prop-blue, #3498db); }
  .pat.red-only { color: var(--prop-red, #e74c3c); }
  .pat.none { color: var(--theme-text-muted, rgba(255, 255, 255, 0.3)); }

  .badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 12px; }
  .badge.clean { color: #4ade80; background: rgba(74, 222, 128, 0.15); }
  .badge.broken { color: #facc15; background: rgba(250, 204, 21, 0.15); }

  .label { font-size: 12px; color: var(--theme-text-muted, rgba(255, 255, 255, 0.5)); }

  @media (prefers-reduced-motion: reduce) {
    .preset-chip, .cell, .arrow { transition: none; }
  }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -3`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/TnDReversalStrip.svelte
git commit -m "feat(choreo-card): interactive 4-step reversal strip"
```

---

## Task 6: Host strip in family view + seed empty-state + layout

**Files:**
- Modify: `src/lib/features/choreo-card/components/TnDFamilyGrid.svelte`
- Modify: `src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte`
- Modify: `src/lib/features/choreo-card/components/CatalogBrowser.svelte`

The strip + seed empty-state live in `CatalogBrowser` (it owns `browseState` and can call `seedReversalPattern`). `TnDFamilyGrid` renders the strip beneath the cards and relaxes the hero min-height. `CatalogBrowseGrid` forwards the new props.

- [ ] **Step 1: Relax hero stage + host strip in `TnDFamilyGrid.svelte`**

Add to `Props`:

```ts
  interface Props {
    catalogs: Catalog[];
    onSelectFamily: (familyId: string) => void;
    activePatternId: string | null;
    onPatternChange: (resolved: import("../domain/reversal-transform").ResolvedReversalPattern) => void;
    seedPanel?: import("svelte").Snippet;
  }
  const { catalogs, onSelectFamily, activePatternId, onPatternChange, seedPanel }: Props = $props();
```

Import the strip at the top of the script:

```ts
  import TnDReversalStrip from "./TnDReversalStrip.svelte";
```

Replace the markup body with the cards + strip + optional seed panel:

```svelte
<div class="family-stage">
  <div class="family-grid">
    {#each familyStats as { theme, ratioCount, sequenceCount } (theme.familyId)}
      <TnDFamilyCard
        {theme}
        {ratioCount}
        {sequenceCount}
        onSelect={() => onSelectFamily(theme.familyId)}
      />
    {/each}
  </div>

  <TnDReversalStrip {activePatternId} {onPatternChange} />

  {#if seedPanel}{@render seedPanel()}{/if}
</div>
```

Change `.family-stage` `min-height` from `calc(100vh - 200px)` to `auto`, keep it a centered flex column with a gap so cards + strip read together:

```css
  .family-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    min-height: auto;
    padding: 40px 24px;
    box-sizing: border-box;
  }
```

- [ ] **Step 2: Forward props through `CatalogBrowseGrid.svelte`**

Add to its `Props`:

```ts
    activePatternId?: string | null;
    onPatternChange?: (resolved: import("../domain/reversal-transform").ResolvedReversalPattern) => void;
    seedPanel?: import("svelte").Snippet;
```

Destructure them (with defaults `activePatternId = null`, `onPatternChange`, `seedPanel`), and pass to the family-grid branch:

```svelte
{:else if collection === 'TnD' && tndViewMode === 'family'}
  <TnDFamilyGrid
    catalogs={allTnDCatalogs}
    onSelectFamily={(id) => onSelectFamily?.(id)}
    {activePatternId}
    onPatternChange={(r) => onPatternChange?.(r)}
    {seedPanel}
  />
```

- [ ] **Step 3: Own active-pattern state + seed flow in `CatalogBrowser.svelte`**

Add imports:

```ts
  import { seedReversalPattern, type SeedProgress } from "../services/reversal-seed-service";
  import type { ResolvedReversalPattern } from "../domain/reversal-transform";
```

Add state near the other `$state` declarations:

```ts
  let activeReversal = $state<ResolvedReversalPattern | null>(null);
  let isSeeding = $state(false);
  let seedProgress = $state<SeedProgress>({ written: 0, total: 0 });
  let seedError = $state("");

  const tndMaterializedCatalogs = $derived(
    tndCatalogs.filter((c) => c.asymmetric !== true),
  );
  // True when a clean pattern is active but no catalogs carry it yet.
  const needsSeed = $derived(
    activeReversal?.isCleanLoop === true &&
      activeReversal.id !== "continuous" &&
      browseState.filteredCatalogs.length === 0,
  );

  function handlePatternChange(resolved: ResolvedReversalPattern) {
    activeReversal = resolved;
    seedError = "";
    if (!resolved.isCleanLoop) {
      // Broken-loop pattern can't produce valid sequences — don't apply it.
      return;
    }
    browseState.setReversalPattern(resolved.id === "continuous" ? null : resolved.id);
  }

  async function runSeed() {
    if (!activeReversal || isSeeding) return;
    isSeeding = true;
    seedError = "";
    try {
      await seedReversalPattern(tndMaterializedCatalogs, activeReversal, (p) => { seedProgress = p; });
      const { loadCatalogs } = await import("../services/catalog-loader");
      await loadCatalogs(); // refresh cache; parent reloads catalogs prop
      toast.success("Pattern seeded.");
    } catch (err) {
      seedError = `Seed failed: ${err instanceof Error ? err.message : err}`;
      toast.error("Seeding failed. See the panel for details.");
    } finally {
      isSeeding = false;
      seedProgress = { written: 0, total: 0 };
    }
  }
```

Wire the family-grid props on the existing `<CatalogBrowseGrid …>` in the `{:else}` browse branch — add:

```svelte
      activePatternId={activeReversal?.id ?? null}
      onPatternChange={handlePatternChange}
      {seedPanel}
```

Define the seed panel snippet near the other `{#snippet}` blocks:

```svelte
{#snippet seedPanel()}
  {#if needsSeed && activeReversal}
    <div class="seed-panel">
      <p class="seed-text">
        Pattern <strong>{activeReversal.sequence}</strong> isn't seeded yet.
      </p>
      {#if isSeeding}
        <p class="seed-progress">Seeding… {seedProgress.written}/{seedProgress.total} catalogs</p>
      {:else}
        <button class="seed-btn" type="button" onclick={runSeed}>Seed it</button>
      {/if}
      {#if seedError}<p class="seed-error">{seedError}</p>{/if}
    </div>
  {/if}
{/snippet}
```

Add styles to the component `<style>`:

```css
  .seed-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border: 1px dashed var(--tnd-accent-border, rgba(183, 99, 205, 0.35));
    border-radius: 12px;
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.08));
  }
  .seed-text { margin: 0; font-size: 13px; color: var(--theme-text, #fff); }
  .seed-progress { margin: 0; font-size: 12px; color: var(--theme-text-muted, rgba(255, 255, 255, 0.6)); }
  .seed-btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 1px solid var(--tnd-accent-border, rgba(183, 99, 205, 0.5));
    background: var(--tnd-accent-bg, rgba(183, 99, 205, 0.15));
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .seed-error { margin: 0; font-size: 12px; color: #f87171; }
```

(`toast` is already imported at the top of `CatalogBrowser.svelte`.)

- [ ] **Step 4: Typecheck**

Run: `npx svelte-check --threshold error 2>&1 | tail -3`
Expected: 0 errors.

- [ ] **Step 5: Manual browser verification (golden path + correctness)**

Ask the user to load `localhost:5173/choreo_card/catalogs`, TnD → By Family, and confirm:
1. The chip row is gone from the top filter bar; the strip sits under the six cards.
2. Clicking each preset (Continuous/Book/Red Book/Blue Book/Long Book/Alternating) updates family counts to match what the old chips produced.
3. Toggling a custom even-count pattern with no data shows the "Seed it" panel; clicking it seeds, cards repopulate, drilldown renders the transformed sequences.
4. Toggling an odd-count pattern flags the badge ("Boundary discontinuity") and does not change the cards.

**Correctness check before trusting custom seeds:** with `book` already seeded, re-derive it — clear the cache key `catalogLoader.cachedCatalogs`, select Book, confirm the family counts/letters match the pre-existing book catalog. (Letter parity between the client CSV lookup and the CJS enumerator's CSV.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/TnDFamilyGrid.svelte src/lib/features/choreo-card/components/CatalogBrowseGrid.svelte src/lib/features/choreo-card/components/CatalogBrowser.svelte
git commit -m "feat(choreo-card): host reversal strip + live-seed empty state in By-Family"
```

---

## Self-Review Notes

- **Spec coverage:** §1 layout → Task 6 Step 1. §2 strip → Task 5. §3 filter wiring → Task 4 + Task 6 Step 3. §4 seed → Task 3 (+ Task 2 letter, Task 1 transform). §5 empty state → Task 6 Step 3. All covered.
- **Risk 1 (security rules):** the seed write uses the client SDK against `decks/{id}` + subcollection. If rules reject the write, Task 6 Step 5 surfaces it as `seedError`. Mitigation if blocked: gate the seed behind the same auth/role the deck-releaser uses (the releaser already writes catalogs from the client). Confirm during Step 5.
- **Risk 2 (letter parity):** Task 6 Step 5's "re-derive book" check verifies the client CSV match equals the seeded data before trusting custom seeds. Task 2 Step 5 verifies the CSV header column names.
- **Risk 3 (orientation):** orientations are recomputed post-flip via `propagateOrientationsForColor` in Task 3, seeded from the start-position orientation.
- **Type consistency:** `ResolvedReversalPattern` (Task 1) is the single type threaded through Tasks 3, 5, 6. `seedReversalPattern(baseCatalogs, pattern, onProgress)` signature is consistent between Task 3 and its caller in Task 6.
- **Open verification deferred to execution:** exact `MotionColor` enum member names, `OrientationCalculator` constructor, and `StepData` field names (`startPosition`/`endPosition` vs grid-position) are confirmed in Task 3 Step 1 before writing the service.
