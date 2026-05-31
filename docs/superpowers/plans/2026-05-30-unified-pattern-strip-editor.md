# Unified Pattern Strip Editor — Implementation Plan (Phase 1: Turns + Duration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Turn and Duration pattern drawers with one shared
`Period × Rhythm × Value → editable strip` engine, where chips stamp values and
auto-highlight by derivation (no lock-in).

**Architecture:** A pure rhythm engine (catalog + mask/match) in
`shared/create/domain/rhythm/`, feature-level strip→pattern converters, three new
reusable components (`RhythmGlyph`, `PatternBeatStrip`, `PatternStripEditor`), and
two drawers rebuilt as thin bindings. Turns reuse `turn-pattern-manager.applyPattern`;
Duration reuses `duration-pattern-manager.applyPattern`.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest. Reuses `SegmentedControl`
(`shared/3d/components/controls/SegmentedControl.svelte`) and `FilterChipBase`
(`shared/browse/components/filter-chips/FilterChipBase.svelte`).

**Scope:** Phase 1 only — Turns + Duration. Reversals (Phase 2) need the diamond
CSV edge graph in the create module and are a separate plan. Design doc:
`docs/superpowers/specs/2026-05-30-unified-pattern-strip-editor-design.md`.

**Test command:** `npx vitest run --config tests/config/vitest.config.ts <path>`

---

### Task 1: Rhythm catalog (shared, pure)

**Files:**
- Create: `src/lib/shared/create/domain/rhythm/rhythm-catalog.ts`
- Test: `src/lib/shared/create/domain/rhythm/__tests__/rhythm-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  PER_HAND_RHYTHMS,
  CONTINUOUS,
  DURATION_RHYTHMS,
} from "../rhythm-catalog";

describe("rhythm-catalog", () => {
  it("per-hand catalog ids match the reversal vocabulary", () => {
    expect(PER_HAND_RHYTHMS.map((r) => r.id)).toEqual([
      "book", "long-book", "alternating", "red-book", "blue-book",
    ]);
  });
  it("syms use only P/R/B/- symbols", () => {
    for (const r of [...PER_HAND_RHYTHMS, CONTINUOUS, ...DURATION_RHYTHMS]) {
      expect(r.sym).toMatch(/^[PRB-]+$/);
    }
  });
  it("alternating is the two-beat RB unit", () => {
    expect(PER_HAND_RHYTHMS.find((r) => r.id === "alternating")?.sym).toBe("RB");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-catalog.test.ts`
Expected: FAIL — cannot find module `../rhythm-catalog`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Shared rhythm catalog. A rhythm is a per-period symbol unit describing which
 * hand (or, single-lane, which beat) is ACTIVE on each beat. Tiled to a period.
 *
 * Symbols: P both · R red only · B blue only · - none.
 * Shared by the Turns and (Phase 2) Reversals drawers. ids intentionally match
 * the reversal pattern ids in choreo-card/domain/reversal-patterns.ts.
 */
export interface RhythmDef {
  readonly id: string;
  readonly label: string;
  /** One period unit; tiled across the pattern length. */
  readonly sym: string;
}

/** Per-hand catalog (Turns + Reversals). */
export const PER_HAND_RHYTHMS: readonly RhythmDef[] = [
  { id: "book", label: "Book", sym: "P" },
  { id: "long-book", label: "Long Book", sym: "P-" },
  { id: "alternating", label: "Alternating", sym: "RB" },
  { id: "red-book", label: "Red Book", sym: "R" },
  { id: "blue-book", label: "Blue Book", sym: "B" },
];

/** The "no rhythm" entry — all beats continuous / inactive. */
export const CONTINUOUS: RhythmDef = { id: "continuous", label: "Continuous", sym: "-" };

/** Single-lane accent catalog (Duration — which beats are held longer). */
export const DURATION_RHYTHMS: readonly RhythmDef[] = [
  { id: "every", label: "Every beat", sym: "P" },
  { id: "every-other", label: "Every other", sym: "P-" },
  { id: "downbeat", label: "Downbeat", sym: "P---" },
  { id: "last", label: "Last beat", sym: "---P" },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-catalog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/domain/rhythm/rhythm-catalog.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-catalog.test.ts
git commit -m "feat(rhythm): shared rhythm catalog (per-hand + duration)" -- src/lib/shared/create/domain/rhythm/rhythm-catalog.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-catalog.test.ts
```

---

### Task 2: Rhythm mask engine (mask, period, match, uniform)

**Files:**
- Create: `src/lib/shared/create/domain/rhythm/rhythm-mask.ts`
- Test: `src/lib/shared/create/domain/rhythm/__tests__/rhythm-mask.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  maskAt, activeAt, divisorsUpTo, uniformActive, allBase,
  tilePeriod, resizePeriod, perHandRhythmMatches, singleLaneRhythmMatches,
} from "../rhythm-mask";

describe("rhythm-mask", () => {
  it("maskAt decodes P/R/B/- and tiles", () => {
    expect(maskAt("RB", 0)).toEqual({ blue: false, red: true });
    expect(maskAt("RB", 1)).toEqual({ blue: true, red: false });
    expect(maskAt("P", 5)).toEqual({ blue: true, red: true });
    expect(maskAt("P-", 1)).toEqual({ blue: false, red: false });
  });
  it("activeAt is true for any non-dash", () => {
    expect(activeAt("P---", 0)).toBe(true);
    expect(activeAt("P---", 2)).toBe(false);
  });
  it("divisorsUpTo returns divisors capped at 8", () => {
    expect(divisorsUpTo(8)).toEqual([1, 2, 4, 8]);
    expect(divisorsUpTo(6)).toEqual([1, 2, 3, 6]);
    expect(divisorsUpTo(16)).toEqual([1, 2, 4, 8]); // cap 8
  });
  it("uniformActive returns the shared non-base value or null", () => {
    expect(uniformActive([0, 1, 0, 1], 0)).toBe(1);
    expect(uniformActive([0, 1, 0, 2], 0)).toBeNull();
    expect(uniformActive([0, 0], 0)).toBeNull();
  });
  it("allBase detects an all-default array", () => {
    expect(allBase([0, 0], 0)).toBe(true);
    expect(allBase([0, 1], 0)).toBe(false);
  });
  it("tilePeriod and resizePeriod tile by modulo", () => {
    expect(tilePeriod([1, 0], 4)).toEqual([1, 0, 1, 0]);
    expect(resizePeriod([1, 0], 3, 0)).toEqual([1, 0, 1]);
    expect(resizePeriod([1], 2, 0)).toEqual([1, 1]);
  });
  it("perHandRhythmMatches recognises an Alternating strip", () => {
    // blue [0,1], red [1,0] == sym "RB" (beat0 red, beat1 blue)
    expect(perHandRhythmMatches("RB", [0, 1], [1, 0], 0)).toBe(true);
    expect(perHandRhythmMatches("P", [0, 1], [1, 0], 0)).toBe(false);
  });
  it("perHandRhythmMatches is false for an all-zero strip", () => {
    expect(perHandRhythmMatches("P", [0, 0], [0, 0], 0)).toBe(false);
  });
  it("singleLaneRhythmMatches recognises a downbeat hold", () => {
    expect(singleLaneRhythmMatches("P---", [2, 1, 1, 1], 1)).toBe(true);
    expect(singleLaneRhythmMatches("P", [2, 1, 1, 1], 1)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-mask.test.ts`
Expected: FAIL — cannot find module `../rhythm-mask`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Pure rhythm-mask engine. Decodes a rhythm symbol unit, tiles it to a period,
 * and answers the derived-highlight match questions. No framework deps.
 */
import type { RhythmDef } from "./rhythm-catalog";

export interface HandMask {
  readonly blue: boolean;
  readonly red: boolean;
}

/** Decode the i-th beat of a tiled per-hand symbol unit. */
export function maskAt(sym: string, i: number): HandMask {
  const s = sym[i % sym.length];
  return { blue: s === "P" || s === "B", red: s === "P" || s === "R" };
}

/** Single-lane: is beat i active (any non-dash symbol)? */
export function activeAt(sym: string, i: number): boolean {
  return sym[i % sym.length] !== "-";
}

/** Divisors of n, ascending, capped at `cap` (valid pattern periods). */
export function divisorsUpTo(n: number, cap = 8): number[] {
  const out: number[] = [];
  for (let p = 1; p <= Math.min(n, cap); p++) if (n % p === 0) out.push(p);
  return out;
}

/** The single value shared by all non-base entries, else null. */
export function uniformActive<T>(arr: readonly T[], base: T): T | null {
  let v: T | null = null;
  for (const x of arr) {
    if (x === base) continue;
    if (v === null) v = x;
    else if (x !== v) return null;
  }
  return v;
}

/** True when every entry equals base. */
export function allBase<T>(arr: readonly T[], base: T): boolean {
  return arr.every((x) => x === base);
}

/** Tile an array to a target length by modulo. */
export function tilePeriod<T>(arr: readonly T[], targetLen: number): T[] {
  return Array.from({ length: targetLen }, (_, i) => arr[i % arr.length]!);
}

/** Resize to a new period, tiling existing values, filling gaps. */
export function resizePeriod<T>(arr: readonly T[], newPeriod: number, fill: T): T[] {
  return Array.from({ length: newPeriod }, (_, i) => arr[i % arr.length] ?? fill);
}

/** Does the per-hand strip exactly match the rhythm (and have ≥1 active beat)? */
export function perHandRhythmMatches<T>(
  sym: string,
  blue: readonly T[],
  red: readonly T[],
  base: T,
): boolean {
  const period = blue.length;
  let any = false;
  for (let i = 0; i < period; i++) {
    const m = maskAt(sym, i);
    if ((blue[i] !== base) !== m.blue) return false;
    if ((red[i] !== base) !== m.red) return false;
    if (m.blue || m.red) any = true;
  }
  return any;
}

/** Single-lane match (≥1 active beat). */
export function singleLaneRhythmMatches<T>(
  sym: string,
  values: readonly T[],
  base: T,
): boolean {
  const period = values.length;
  let any = false;
  for (let i = 0; i < period; i++) {
    const isActive = values[i] !== base;
    if (isActive !== activeAt(sym, i)) return false;
    if (activeAt(sym, i)) any = true;
  }
  return any;
}

/** Stamp a per-hand rhythm into fresh strip arrays using per-hand amounts. */
export function stampPerHand<T>(
  rhythm: RhythmDef,
  period: number,
  blueAmount: T,
  redAmount: T,
  base: T,
): { blue: T[]; red: T[] } {
  const blue: T[] = [];
  const red: T[] = [];
  for (let i = 0; i < period; i++) {
    const m = maskAt(rhythm.sym, i);
    blue.push(m.blue ? blueAmount : base);
    red.push(m.red ? redAmount : base);
  }
  return { blue, red };
}

/** Stamp a single-lane rhythm into a fresh array using one amount. */
export function stampSingle<T>(
  rhythm: RhythmDef,
  period: number,
  amount: T,
  base: T,
): T[] {
  return Array.from({ length: period }, (_, i) =>
    activeAt(rhythm.sym, i) ? amount : base,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-mask.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/domain/rhythm/rhythm-mask.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-mask.test.ts
git commit -m "feat(rhythm): mask/period/match engine with derived-highlight predicates" -- src/lib/shared/create/domain/rhythm/rhythm-mask.ts src/lib/shared/create/domain/rhythm/__tests__/rhythm-mask.test.ts
```

---

### Task 3: Strip → pattern converters (feature-level)

**Files:**
- Create: `src/lib/features/create/shared/domain/pattern-strip-apply.ts`
- Test: `src/lib/features/create/shared/domain/__tests__/pattern-strip-apply.test.ts`

**Context:** `TurnPattern` shape — `src/lib/shared/create/domain/TurnPatternData.ts`
(`{ id, name, userId, createdAt, stepCount, entries: {stepIndex, blue, red}[] }`,
`TurnValue = number | "fl"`). `DurationPattern` shape —
`src/lib/features/create/shared/domain/models/duration-pattern-data.ts`
(`entries: {stepIndex, duration}[]`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { stripToTurnPattern, stripToDurationPattern } from "../pattern-strip-apply";

describe("pattern-strip-apply", () => {
  it("tiles a 2-beat turn strip across an 8-beat sequence", () => {
    const p = stripToTurnPattern([1, 0], [0, 1], 8);
    expect(p.stepCount).toBe(8);
    expect(p.entries).toHaveLength(8);
    expect(p.entries[0]).toEqual({ stepIndex: 0, blue: 1, red: 0 });
    expect(p.entries[1]).toEqual({ stepIndex: 1, blue: 0, red: 1 });
    expect(p.entries[2]).toEqual({ stepIndex: 2, blue: 1, red: 0 });
  });
  it("preserves float turn values", () => {
    const p = stripToTurnPattern(["fl"], [0], 2);
    expect(p.entries[0]!.blue).toBe("fl");
    expect(p.entries[1]!.blue).toBe("fl");
  });
  it("tiles a duration strip", () => {
    const p = stripToDurationPattern([2, 1], 4);
    expect(p.entries.map((e) => e.duration)).toEqual([2, 1, 2, 1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/create/shared/domain/__tests__/pattern-strip-apply.test.ts`
Expected: FAIL — cannot find module `../pattern-strip-apply`.

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Convert an in-memory editor strip (period-length arrays) into the existing
 * Firebase pattern shapes, tiled to the sequence length, so the proven
 * apply managers can consume them unchanged.
 */
import type {
  TurnPattern,
  TurnPatternEntry,
  TurnValue,
} from "$lib/shared/create/domain/TurnPatternData";
import type {
  DurationPattern,
  DurationPatternEntry,
} from "../domain/models/duration-pattern-data";
import { tilePeriod } from "$lib/shared/create/domain/rhythm/rhythm-mask";

export function stripToTurnPattern(
  blue: readonly TurnValue[],
  red: readonly TurnValue[],
  seqLen: number,
): TurnPattern {
  const tb = tilePeriod(blue, seqLen);
  const tr = tilePeriod(red, seqLen);
  const entries: TurnPatternEntry[] = [];
  for (let i = 0; i < seqLen; i++) {
    entries.push({ stepIndex: i, blue: tb[i]!, red: tr[i]! });
  }
  return {
    id: "strip",
    name: "strip",
    userId: "",
    createdAt: null as unknown as TurnPattern["createdAt"],
    stepCount: seqLen,
    entries,
  };
}

export function stripToDurationPattern(
  values: readonly number[],
  seqLen: number,
): DurationPattern {
  const tv = tilePeriod(values, seqLen);
  const entries: DurationPatternEntry[] = [];
  for (let i = 0; i < seqLen; i++) {
    entries.push({ stepIndex: i, duration: tv[i]! });
  }
  return {
    id: "strip",
    name: "strip",
    userId: "",
    createdAt: null,
    stepCount: seqLen,
    entries,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/features/create/shared/domain/__tests__/pattern-strip-apply.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/domain/pattern-strip-apply.ts src/lib/features/create/shared/domain/__tests__/pattern-strip-apply.test.ts
git commit -m "feat(create): strip-to-pattern converters (turn + duration, tiled)" -- src/lib/features/create/shared/domain/pattern-strip-apply.ts src/lib/features/create/shared/domain/__tests__/pattern-strip-apply.test.ts
```

---

### Task 4: RhythmGlyph component

**Files:**
- Create: `src/lib/shared/create/components/pattern-strip/RhythmGlyph.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!--
  RhythmGlyph.svelte
  Inline twin-dot (2-lane) or single-dot (1-lane) preview of a rhythm mask over
  `sampleBeats` beats. Used as the leading glyph inside rhythm chips.
-->
<script lang="ts">
  import { maskAt, activeAt } from "$lib/shared/create/domain/rhythm/rhythm-mask";

  interface Props {
    sym: string;
    lanes?: 1 | 2;
    sampleBeats?: number;
  }
  let { sym, lanes = 2, sampleBeats = 4 }: Props = $props();

  const beats = $derived(Array.from({ length: sampleBeats }, (_, i) => i));
</script>

<span class="glyph" aria-hidden="true">
  {#if lanes === 2}
    <span class="row">
      {#each beats as i}<span class="dot" class:blue={maskAt(sym, i).blue}></span>{/each}
    </span>
    <span class="row">
      {#each beats as i}<span class="dot" class:red={maskAt(sym, i).red}></span>{/each}
    </span>
  {:else}
    <span class="row">
      {#each beats as i}<span class="dot" class:hold={activeAt(sym, i)}></span>{/each}
    </span>
  {/if}
</span>

<style>
  .glyph { display: inline-flex; flex-direction: column; gap: 2px; }
  .row { display: flex; gap: 2px; }
  .dot {
    width: 7px; height: 7px; border-radius: 2px;
    background: color-mix(in srgb, var(--theme-text) 16%, transparent);
  }
  .dot.blue { background: var(--theme-blue, #6f9bff); }
  .dot.red { background: var(--theme-red, #ff7a8a); }
  .dot.hold { background: var(--theme-accent, #2dd4bf); }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `RhythmGlyph.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/create/components/pattern-strip/RhythmGlyph.svelte
git commit -m "feat(pattern-strip): RhythmGlyph mask preview" -- src/lib/shared/create/components/pattern-strip/RhythmGlyph.svelte
```

---

### Task 5: PatternBeatStrip component (editable per-beat strip)

**Files:**
- Create: `src/lib/shared/create/components/pattern-strip/PatternBeatStrip.svelte`

**Context:** Cell editing — left third decrements, right third increments
(cycling `valueList`), center third opens an exact-value popover. Toggle kind
(reversals, Phase 2) flips boolean. Touch target ≥ 44px. Reuses no checkbox
inputs (project rule `no-checkboxes`).

- [ ] **Step 1: Write the component**

```svelte
<!--
  PatternBeatStrip.svelte
  The editable per-beat strip. One or two lanes. Number cells cycle a value list
  (left −, right +, center = popover); toggle cells flip on/off. Source of truth
  is owned by the parent; this emits edits.
-->
<script lang="ts" generics="T extends number | string | boolean">
  interface Lane {
    label: string;
    color: "blue" | "red" | "hold";
    values: T[];
  }
  interface Props {
    lanes: Lane[];
    cellKind: "number" | "toggle";
    /** Cycle list for number cells (left/right zones). */
    valueList?: T[];
    /** Base/default value rendered "muted". */
    base: T;
    format: (v: T) => string;
    onEdit: (laneIndex: number, beatIndex: number, value: T) => void;
  }
  let { lanes, cellKind, valueList = [], base, format, onEdit }: Props = $props();

  let popover = $state<{ lane: number; beat: number; x: number; y: number } | null>(null);

  function zone(e: MouseEvent, el: HTMLElement): -1 | 0 | 1 {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    return x <= 0.33 ? -1 : x >= 0.67 ? 1 : 0;
  }
  function step(current: T, dir: -1 | 1): T {
    let idx = valueList.findIndex((v) => String(v) === String(current));
    if (idx < 0) idx = 0;
    return valueList[Math.min(valueList.length - 1, Math.max(0, idx + dir))]!;
  }
  function onNumberClick(e: MouseEvent, li: number, bi: number, v: T, el: HTMLElement) {
    const z = zone(e, el);
    if (z === 0) {
      const r = el.getBoundingClientRect();
      popover = { lane: li, beat: bi, x: r.left, y: r.bottom + 8 };
    } else {
      onEdit(li, bi, step(v, z));
      popover = null;
    }
  }
  function pick(v: T) {
    if (popover) onEdit(popover.lane, popover.beat, v);
    popover = null;
  }
</script>

<svelte:window onclick={(e) => { if (!(e.target as HTMLElement)?.closest?.(".pbs-cell,.pbs-pop")) popover = null; }} />

<div class="pbs">
  {#each lanes as lane, li}
    <div class="pbs-lane">
      <span class="pbs-label {lane.color}">{lane.label}</span>
      <div class="pbs-beats">
        {#each lane.values as v, bi}
          {#if cellKind === "number"}
            <button
              class="pbs-cell num {lane.color}"
              class:muted={v === base}
              onclick={(e) => onNumberClick(e, li, bi, v, e.currentTarget)}
            >
              <span class="z minus"><i class="fa-solid fa-minus"></i></span>
              <span class="z plus"><i class="fa-solid fa-plus"></i></span>
              <span class="v">{format(v)}</span>
            </button>
          {:else}
            <button
              class="pbs-cell toggle {lane.color}"
              class:on={v !== base}
              role="switch"
              aria-checked={v !== base}
              aria-label="{lane.label} beat {bi + 1}"
              onclick={() => onEdit(li, bi, (v === base ? lane.values.find(() => true) : base) as T)}
            >
              <i class="fa-solid fa-rotate"></i>
            </button>
          {/if}
        {/each}
      </div>
    </div>
  {/each}
</div>

{#if popover}
  {@const lane = lanes[popover.lane]!}
  <div class="pbs-pop" style="left:{popover.x}px; top:{popover.y}px">
    {#each valueList as v}
      <button class:sel={String(v) === String(lane.values[popover.beat])} onclick={() => pick(v)}>{format(v)}</button>
    {/each}
  </div>
{/if}

<style>
  .pbs { display: flex; flex-direction: column; gap: 12px; }
  .pbs-lane { display: flex; align-items: center; gap: 14px; }
  .pbs-label { width: 50px; flex: 0 0 50px; font-size: 13px; font-weight: 800; }
  .pbs-label.blue { color: var(--theme-blue, #6f9bff); }
  .pbs-label.red { color: var(--theme-red, #ff7a8a); }
  .pbs-label.hold { color: var(--theme-accent, #2dd4bf); }
  .pbs-beats { display: flex; gap: 8px; flex: 1; min-width: 0; }
  .pbs-cell {
    position: relative; flex: 1; min-width: 0; height: 56px; border-radius: 13px;
    border: 1px solid var(--theme-stroke); background: var(--theme-card-bg);
    color: var(--theme-text); cursor: pointer; overflow: hidden;
    display: flex; align-items: center; justify-content: center; user-select: none;
  }
  .pbs-cell .v { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; z-index: 2; pointer-events: none; }
  .pbs-cell.muted .v { color: var(--theme-text-dim); }
  .pbs-cell.num.blue:not(.muted) { background: color-mix(in srgb, var(--theme-blue, #6f9bff) 30%, var(--theme-card-bg)); }
  .pbs-cell.num.red:not(.muted) { background: color-mix(in srgb, var(--theme-red, #ff7a8a) 30%, var(--theme-card-bg)); }
  .pbs-cell.num.hold:not(.muted) { background: color-mix(in srgb, var(--theme-accent, #2dd4bf) 28%, var(--theme-card-bg)); }
  .pbs-cell.num:not(.muted) .v { color: #fff; }
  .pbs-cell .z {
    position: absolute; top: 0; bottom: 0; width: 50%; display: flex; align-items: center;
    opacity: 0; transition: opacity .12s; z-index: 1; color: var(--theme-text);
  }
  .pbs-cell .z.minus { left: 0; justify-content: flex-start; padding-left: 9px; }
  .pbs-cell .z.plus { right: 0; justify-content: flex-end; padding-right: 9px; }
  .pbs-cell:hover .z { opacity: .8; }
  .pbs-cell.toggle.on { background: color-mix(in srgb, var(--theme-blue, #6f9bff) 30%, var(--theme-card-bg)); color: #fff; }
  .pbs-cell.toggle.on.red { background: color-mix(in srgb, var(--theme-red, #ff7a8a) 30%, var(--theme-card-bg)); }
  .pbs-cell.toggle:not(.on) i { opacity: .32; }
  .pbs-pop {
    position: fixed; z-index: 50; display: grid; grid-template-columns: repeat(4, 54px); gap: 7px;
    background: var(--theme-panel-bg); border: 1px solid var(--theme-stroke); border-radius: 14px; padding: 10px;
    box-shadow: 0 18px 44px -16px rgba(0,0,0,.7);
  }
  .pbs-pop button {
    height: 46px; border-radius: 10px; border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg); color: var(--theme-text); font-weight: 700; font-size: 15px;
    cursor: pointer; font-variant-numeric: tabular-nums;
  }
  .pbs-pop button.sel { background: var(--theme-accent); color: #fff; border-color: transparent; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `PatternBeatStrip.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/create/components/pattern-strip/PatternBeatStrip.svelte
git commit -m "feat(pattern-strip): editable PatternBeatStrip (number + toggle cells)" -- src/lib/shared/create/components/pattern-strip/PatternBeatStrip.svelte
```

---

### Task 6: PatternStripEditor (Length × Rhythm × Amount composition)

**Files:**
- Create: `src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts`
- Create: `src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte`

**Context:** Owns the strip state (`blue`/`red` arrays, `period`). Renders
`SegmentedControl` (Length, Amount per lane) + `FilterChipBase` rhythm chips
(active driven by derived match) + `PatternBeatStrip`. Emits the realized strip
upward via `onChange`. `SegmentedControl` props: `options:{value,label}[]`,
`value`, `onchange(value)`, `color:"blue"|"red"|"accent"`, `size`.
`FilterChipBase`: `label`, `iconSnippet`, `active`, `mode="toggle"`, `size`,
`onclick`.

- [ ] **Step 1: Write the binding types**

```ts
// pattern-strip-types.ts
import type { RhythmDef } from "$lib/shared/create/domain/rhythm/rhythm-catalog";

export type StripValue = number | "fl";

/** Configures the editor for one drawer (turns/duration). 2-lane turns shown;
 *  duration uses lanes=1. */
export interface StripBinding {
  lanes: 1 | 2;
  rhythms: readonly RhythmDef[];
  /** Cell cycle list (e.g. turns [0,0.5,1,1.5,2,2.5,3,"fl"]; duration [1,1.25,1.5,2,4]). */
  valueList: StripValue[];
  /** Amount segmented options (active-beat magnitudes). */
  amountList: number[];
  /** Base/default value (0 turns, 1 duration). */
  base: StripValue;
  format: (v: StripValue) => string;
  /** Lane colours for SegmentedControl + strip. */
  laneColors: ("blue" | "red" | "accent")[];
  laneLabels: string[];
}
```

- [ ] **Step 2: Write the editor component**

```svelte
<!--
  PatternStripEditor.svelte
  Length × Rhythm × Amount over a PatternBeatStrip. Strip is the source of truth;
  chips stamp + auto-highlight by derivation.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import RhythmGlyph from "./RhythmGlyph.svelte";
  import PatternBeatStrip from "./PatternBeatStrip.svelte";
  import type { StripBinding, StripValue } from "./pattern-strip-types";
  import {
    divisorsUpTo, uniformActive, perHandRhythmMatches, singleLaneRhythmMatches,
    stampPerHand, stampSingle, resizePeriod,
  } from "$lib/shared/create/domain/rhythm/rhythm-mask";

  interface Props {
    binding: StripBinding;
    sequenceLength: number;
    /** Period-length lanes. lanes[0]=blue (or hold), lanes[1]=red. */
    value: StripValue[][];
    onChange: (lanes: StripValue[][]) => void;
  }
  let { binding, sequenceLength, value, onChange }: Props = $props();

  const periods = $derived(divisorsUpTo(sequenceLength));
  const period = $derived(value[0]?.length ?? 1);
  const reps = $derived(sequenceLength / period);

  function setPeriod(p: number) {
    onChange(value.map((lane) => resizePeriod(lane, p, binding.base)));
  }
  function laneAmount(li: number): StripValue | null {
    return uniformActive(value[li] ?? [], binding.base);
  }
  function applyAmount(li: number, a: number) {
    const lane = [...(value[li] ?? [])];
    const active = lane.map((v, i) => (v !== binding.base ? i : -1)).filter((i) => i >= 0);
    if (active.length === 0) lane.fill(a);
    else for (const i of active) lane[i] = a;
    const next = value.map((l, idx) => (idx === li ? lane : l));
    onChange(next);
  }
  function rhythmActive(sym: string): boolean {
    if (binding.lanes === 2)
      return perHandRhythmMatches(sym, value[0] ?? [], value[1] ?? [], binding.base);
    return singleLaneRhythmMatches(sym, value[0] ?? [], binding.base);
  }
  function applyRhythm(sym: string, rhythm: { id: string; label: string; sym: string }) {
    if (binding.lanes === 2) {
      const bAmt = uniformActive(value[0] ?? [], binding.base) ?? (binding.amountList[0] as StripValue);
      const rAmt = uniformActive(value[1] ?? [], binding.base) ?? (binding.amountList[0] as StripValue);
      const { blue, red } = stampPerHand(rhythm, period, bAmt, rAmt, binding.base);
      onChange([blue, red]);
    } else {
      const amt = uniformActive(value[0] ?? [], binding.base) ?? (binding.amountList[0] as StripValue);
      onChange([stampSingle(rhythm, period, amt, binding.base)]);
    }
  }
  function editCell(li: number, bi: number, v: StripValue) {
    const lane = [...(value[li] ?? [])];
    lane[bi] = v;
    onChange(value.map((l, idx) => (idx === li ? lane : l)));
  }

  const stripLanes = $derived(
    binding.laneLabels.map((label, i) => ({
      label,
      color: (binding.laneColors[i] === "accent" ? "hold" : binding.laneColors[i]) as "blue" | "red" | "hold",
      values: value[i] ?? [],
    })),
  );
</script>

<div class="pse">
  <div class="axis">
    <div class="axis-lbl">Length <span class="hint">— pattern period</span></div>
    <div class="seg-row">
      <SegmentedControl
        size="sm" color="accent"
        options={periods.map((p) => ({ value: p, label: String(p) }))}
        value={period}
        onchange={setPeriod}
      />
      <span class="reps">repeats <b>×{reps}</b> across {sequenceLength} beats</span>
    </div>
  </div>

  <div class="axis">
    <div class="axis-lbl">Rhythm <span class="hint">— which beats are active</span></div>
    <div class="chips">
      {#each binding.rhythms as r}
        <FilterChipBase
          label={r.label} mode="toggle" size="sm" active={rhythmActive(r.sym)}
          onclick={() => applyRhythm(r.sym, r)}
        >
          {#snippet iconSnippet()}<RhythmGlyph sym={r.sym} lanes={binding.lanes} />{/snippet}
        </FilterChipBase>
      {/each}
    </div>
  </div>

  <div class="axis">
    <div class="axis-lbl">Amount <span class="hint">— value on active beats</span></div>
    <div class="amt-grid">
      {#each binding.laneLabels as label, li}
        <div class="amt-row">
          <span class="amt-lane {binding.laneColors[li]}">{label}</span>
          <SegmentedControl
            size="sm" color={binding.laneColors[li]}
            options={binding.amountList.map((a) => ({ value: a, label: binding.format(a) }))}
            value={(laneAmount(li) ?? -1) as number}
            onchange={(a) => applyAmount(li, a)}
          />
        </div>
      {/each}
    </div>
  </div>

  <div class="axis result">
    <div class="axis-lbl">Result <span class="hint">— edit freely; chips light when matched</span></div>
    <PatternBeatStrip
      lanes={stripLanes}
      cellKind="number"
      valueList={binding.valueList}
      base={binding.base}
      format={binding.format}
      onEdit={editCell}
    />
  </div>
</div>

<style>
  .pse { display: flex; flex-direction: column; gap: 18px; }
  .axis-lbl { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--theme-text-dim); margin: 0 0 10px; }
  .axis-lbl .hint { font-weight: 500; letter-spacing: 0; text-transform: none; }
  .seg-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
  .reps { font-size: 12.5px; color: var(--theme-text-dim); } .reps b { color: var(--theme-text); font-variant-numeric: tabular-nums; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .amt-grid { display: flex; flex-direction: column; gap: 9px; }
  .amt-row { display: flex; align-items: center; gap: 13px; }
  .amt-lane { width: 42px; flex: 0 0 42px; font-size: 13px; font-weight: 800; }
  .amt-lane.blue { color: var(--theme-blue, #6f9bff); } .amt-lane.red { color: var(--theme-red, #ff7a8a); } .amt-lane.accent { color: var(--theme-accent, #2dd4bf); }
  .result { margin-top: 4px; }
</style>
```

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: no new errors referencing `PatternStripEditor.svelte` / `pattern-strip-types.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte
git commit -m "feat(pattern-strip): PatternStripEditor (length x rhythm x amount)" -- src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte
```

---

### Task 7: Rebuild TurnPatternDrawer as a binding

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/TurnPatternDrawer.svelte`

**Context:** Keep the existing `Drawer` wrapper + props
(`isOpen`, `sequence`, `toolPanelWidth`, `onClose`, `onApply`). Read the current
file's `<Drawer>` usage and the `onApply` result shape before editing. Apply uses
`turnPatternManager.applyPattern(stripToTurnPattern(...), sequence, "both")`.
Initial strip = Alternating × 1 at period min(4, seqLen-divisor).

- [ ] **Step 1: Replace the script + body (keep Drawer wrapper)**

```svelte
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import { layoutState } from "$lib/shared/layout/layout-state.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import type { StripBinding, StripValue } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampPerHand } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToTurnPattern } from "../../domain/pattern-strip-apply";
  import * as turnPatternManager from "$lib/shared/create/services/turn-pattern-manager";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    toolPanelWidth?: number;
    onClose: () => void;
    onApply: (result: { sequence: SequenceData; warnings?: readonly string[] }) => void;
  }
  let { isOpen = $bindable(), sequence, toolPanelWidth = 0, onClose, onApply }: Props = $props();

  const TURN_VALUES: StripValue[] = [0, 0.5, 1, 1.5, 2, 2.5, 3, "fl"];
  const fmtTurn = (v: StripValue) => (v === "fl" ? "fl" : String(v));
  const binding: StripBinding = {
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: TURN_VALUES,
    amountList: [0.5, 1, 1.5, 2, 2.5, 3],
    base: 0,
    format: fmtTurn,
    laneColors: ["blue", "red"],
    laneLabels: ["Blue", "Red"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1);
  // strip state — initialised to Alternating x1 at the initial period
  let strip = $state<StripValue[][]>([[0, 1], [1, 0]]);
  $effect(() => {
    const alt = stampPerHand(PER_HAND_RHYTHMS[2], initPeriod, 1, 1, 0); // alternating
    strip = [alt.blue, alt.red];
  });

  const drawerStyle = $derived(toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : "");

  function applyStrip() {
    if (!sequence) return;
    const pattern = stripToTurnPattern(strip[0]!, strip[1]!, sequence.steps.length);
    const result = turnPatternManager.applyPattern(pattern, sequence, "both");
    if (result.success && result.sequence) onApply({ sequence: result.sequence, warnings: result.warnings });
  }
</script>

<div style={drawerStyle}>
  <Drawer bind:isOpen placement="right" onclose={onClose} showHandle={false} respectLayoutMode={true}
    class="turn-pattern-drawer" backdropClass="turn-pattern-backdrop">
    <div class="tp-content">
      <DrawerHeader title="Turn Patterns" onClose={onClose} />
      <div class="tp-body">
        <PatternStripEditor {binding} sequenceLength={seqLen} value={strip} onChange={(v) => (strip = v)} />
        <button class="apply-btn" onclick={applyStrip} disabled={!sequence}>Apply to sequence</button>
      </div>
    </div>
  </Drawer>
</div>

<style>
  :global(.turn-pattern-drawer[data-placement="right"].side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important; max-width: 100% !important;
  }
  :global(.turn-pattern-backdrop) { background: transparent !important; backdrop-filter: none !important; pointer-events: none !important; }
  .tp-content { display: flex; flex-direction: column; height: 100%; background: var(--theme-panel-bg); color: var(--theme-text); }
  .tp-body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 20px; }
  .apply-btn {
    margin-top: auto; padding: 14px; border: none; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer;
    background: linear-gradient(135deg, var(--theme-blue, #6f9bff), #4b7bff); color: #fff;
  }
  .apply-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Verify DrawerHeader props**

Run: `grep -nE "interface Props|title|onClose|onclose" src/lib/shared/foundation/ui/DrawerHeader.svelte`
Expected: confirm `title` + close-callback prop names; adjust the `<DrawerHeader>` call if they differ.

- [ ] **Step 3: Typecheck**

Run: `npm run check:fast`
Expected: no new errors in `TurnPatternDrawer.svelte`.

- [ ] **Step 4: Runtime verify (Chrome DevTools MCP, ask Austen first)**

Open Create → a sequence → Turn Patterns drawer. Confirm: chips light for Alternating, set Blue 0.5 lights the Blue 0.5 chip, Apply changes the sequence turns. Capture a screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/TurnPatternDrawer.svelte
git commit -m "feat(create): rebuild TurnPatternDrawer on PatternStripEditor" -- src/lib/features/create/shared/components/sequence-actions/TurnPatternDrawer.svelte
```

---

### Task 8: Rebuild DurationPatternDrawer as a binding

**Files:**
- Modify: `src/lib/features/create/shared/components/sequence-actions/DurationPatternDrawer.svelte`

**Context:** Drop the save/apply tabs, the accent/meter/feel/world category
browser, the grouped desktop display, the preview/confirm flow, and the
`PatternItemCard`/`DurationPreviewGrid` usage. Single-lane binding. Apply uses
`durationPatternManager.applyPattern(stripToDurationPattern(...), sequence)`.

- [ ] **Step 1: Replace the script + body**

```svelte
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import DrawerHeader from "$lib/shared/foundation/ui/DrawerHeader.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import type { StripBinding, StripValue } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { DURATION_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import { stampSingle } from "$lib/shared/create/domain/rhythm/rhythm-mask";
  import { stripToDurationPattern } from "../../domain/pattern-strip-apply";
  import * as durationPatternManager from "$lib/features/create/shared/services/duration-pattern-manager";

  interface Props {
    isOpen: boolean;
    sequence: SequenceData | null;
    toolPanelWidth?: number;
    onClose: () => void;
    onApply: (result: { sequence: SequenceData; warnings?: readonly string[] }) => void;
  }
  let { isOpen = $bindable(), sequence, toolPanelWidth = 0, onClose, onApply }: Props = $props();

  const DUR_VALUES: StripValue[] = [1, 1.25, 1.5, 2, 4];
  const fmtDur = (v: StripValue) => (v === 1 ? "1×" : `${v}×`);
  const binding: StripBinding = {
    lanes: 1,
    rhythms: DURATION_RHYTHMS,
    valueList: DUR_VALUES,
    amountList: [1.25, 1.5, 2, 4],
    base: 1,
    format: fmtDur,
    laneColors: ["accent"],
    laneLabels: ["Hold"],
  };

  const seqLen = $derived(sequence?.steps.length ?? 8);
  const initPeriod = $derived(seqLen % 4 === 0 ? 4 : seqLen % 2 === 0 ? 2 : 1);
  let strip = $state<StripValue[][]>([[2, 1, 1, 1]]);
  $effect(() => { strip = [stampSingle(DURATION_RHYTHMS[2], initPeriod, 2, 1)]; }); // downbeat x2

  const drawerStyle = $derived(toolPanelWidth > 0 ? `--measured-panel-width: ${toolPanelWidth}px` : "");

  function applyStrip() {
    if (!sequence) return;
    const pattern = stripToDurationPattern(strip[0]! as number[], sequence.steps.length);
    const result = durationPatternManager.applyPattern(pattern, sequence);
    if (result.success && result.sequence) onApply({ sequence: result.sequence, warnings: result.warnings });
  }
</script>

<div style={drawerStyle}>
  <Drawer bind:isOpen placement="right" onclose={onClose} showHandle={false} respectLayoutMode={true}
    class="duration-pattern-drawer" backdropClass="duration-pattern-backdrop">
    <div class="dp-content">
      <DrawerHeader title="Duration Patterns" onClose={onClose} />
      <div class="dp-body">
        <PatternStripEditor {binding} sequenceLength={seqLen} value={strip} onChange={(v) => (strip = v)} />
        <button class="apply-btn" onclick={applyStrip} disabled={!sequence}>Apply to sequence</button>
      </div>
    </div>
  </Drawer>
</div>

<style>
  :global(.duration-pattern-drawer[data-placement="right"].side-by-side-layout) {
    width: var(--measured-panel-width, clamp(360px, 44.44vw, 900px)) !important; max-width: 100% !important;
  }
  :global(.duration-pattern-backdrop) { background: transparent !important; backdrop-filter: none !important; pointer-events: none !important; }
  .dp-content { display: flex; flex-direction: column; height: 100%; background: var(--theme-panel-bg); color: var(--theme-text); }
  .dp-body { flex: 1; overflow-y: auto; padding: 18px; display: flex; flex-direction: column; gap: 20px; }
  .apply-btn {
    margin-top: auto; padding: 14px; border: none; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer;
    background: linear-gradient(135deg, var(--theme-accent, #2dd4bf), #0e8f80); color: #fff;
  }
  .apply-btn:disabled { opacity: .5; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `npm run check:fast`
Expected: no new errors in `DurationPatternDrawer.svelte`.

- [ ] **Step 3: Runtime verify (ask Austen first)**

Open Duration drawer. Confirm Downbeat lights, Hold 2× lights, Apply widens the downbeat steps. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/create/shared/components/sequence-actions/DurationPatternDrawer.svelte
git commit -m "feat(create): rebuild DurationPatternDrawer on PatternStripEditor; drop category browser" -- src/lib/features/create/shared/components/sequence-actions/DurationPatternDrawer.svelte
```

---

### Task 9: Remove dead pattern-browser code + full gate

**Files:**
- Delete (if now unreferenced): `src/lib/features/create/shared/domain/templates/turn-pattern-templates.ts`
- Delete (if now unreferenced): `src/lib/features/create/shared/domain/templates/duration-templates.ts`
- Delete (if now unreferenced): `src/lib/features/create/shared/components/sequence-actions/DurationPreviewGrid.svelte`

- [ ] **Step 1: Confirm each file is unreferenced**

Run: `grep -rln "turn-pattern-templates\|duration-templates\|DurationPreviewGrid" src/ | grep -v "templates/turn-pattern-templates.ts\|templates/duration-templates.ts\|DurationPreviewGrid.svelte"`
Expected: no output (no remaining importers). If any file still imports them, STOP and update that importer first — do not delete a referenced file.

- [ ] **Step 2: Delete the dead files (only those with zero importers)**

```bash
git rm src/lib/features/create/shared/domain/templates/turn-pattern-templates.ts \
       src/lib/features/create/shared/domain/templates/duration-templates.ts \
       src/lib/features/create/shared/components/sequence-actions/DurationPreviewGrid.svelte
```

- [ ] **Step 3: Full typecheck gate**

Run: `npm run check > /tmp/check.log 2>&1; grep -niE "error" /tmp/check.log | head -40`
Expected: no errors. Fix any surfaced before continuing.

- [ ] **Step 4: Full test gate**

Run: `npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm src/lib/features/create/shared/domain/__tests__`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(create): remove 8/16 turn templates + duration category browser (superseded)" -- src/lib/features/create/shared/domain/templates/turn-pattern-templates.ts src/lib/features/create/shared/domain/templates/duration-templates.ts src/lib/features/create/shared/components/sequence-actions/DurationPreviewGrid.svelte
```

---

## Self-review notes

- **Spec coverage:** unified primitive (Tasks 1–6); turns binding (7); duration
  binding + de-bloat (8); derived highlight (`rhythmActive`/`laneAmount` in Task
  6); period/tiling (Tasks 2, 3, 6); reuse of `SegmentedControl`/`FilterChipBase`
  (Task 6); AAA/44px + no-checkbox (Tasks 5, 6). Reversals + the choreo-card
  rhythm-source consolidation are **Phase 2** (separate plan) — both explicitly
  deferred in the spec's phasing and non-goals.
- **Saved patterns:** spec marks them secondary; deferred from this plan to keep
  Phase 1 focused on the compositional editor. Add as a follow-up if desired.
- **Type consistency:** `StripValue`, `StripBinding`, `stripToTurnPattern`,
  `stampPerHand`/`stampSingle`, `perHandRhythmMatches`/`singleLaneRhythmMatches`
  used identically across Tasks 2–8.
- **Verify-before-delete:** Task 9 Step 1 gates deletion on a zero-importer grep
  (project rule `verify-before-deleting`).
