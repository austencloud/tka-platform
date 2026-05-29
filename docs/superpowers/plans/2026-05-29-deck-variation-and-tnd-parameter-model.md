# Deck Variation + TnD Parameter Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Released-deck cards carry a tiny per-card *variation descriptor* (book reversal + structured turns) that is re-applied deterministically at one render seam, serving BOTH LOOP decks (random per-card recipes) and TnD decks (deterministic turn-grid cartesian product), replacing 58 materialized Firestore decks.

**Architecture:** One `CardVariation` descriptor on `DeckReleaseCard`. A pure engine split — `rollVariation` (compose time, no sequence loaded) + `applyVariationDescriptor` (deterministic cook). A single pure `resolveDeckSequences` helper invoked by the one seam (`DeckReleaserTab.loadSelectedSequences`) that every render path funnels through. The existing rasterizer cache key already folds `hashSequenceContent(seq)`, so transformed variants self-discriminate — no cache change needed.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Firestore, Vitest 4 (`vitest --config tests/config/vitest.config.ts`).

---

## File Structure

**Create:**
- `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts` — unit tests for `rollVariation`, `applyVariationDescriptor`, `resolveDeckSequences`, `applyVariation` wrapper parity.
- `src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts` — unit tests for `getTnDFamilyOptions` (base-only), `getTnDTurnPatternOptions` (TURN_VALUES²), `buildTnDCards` (cartesian).
- `src/lib/shared/foundation/services/__tests__/content-hasher-variant.test.ts` — regression test that variant content hashes differ.
- `scripts/teardown-tnd-materialized-decks.cjs` — gated destructive deletion script (Phase 5).

**Modify:**
- `src/lib/features/choreo-card/domain/models/DeckRelease.ts` — add `CardVariation` + `variation?` field.
- `src/lib/features/choreo-card/services/deck-variation.ts` — add `rollVariation`, `applyVariationDescriptor`, `resolveDeckSequences`, `ResolvedDeckSequence`, `AppliedDescriptorResult`; refactor `applyVariation` to compose them.
- `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts` — `variationConfig` + `brokenLoopCount` state + persistence.
- `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` — `composeFullDeck` LOOP variation roll; `loadSelectedSequences` seam rewrite; wire variation + TnD props.
- `src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte` — LOOP variation control group; TnD family-button dynamic count.
- `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte` — broken-loop summary badge.
- `src/lib/features/choreo-card/services/deck-composer.ts` — `getTnDFamilyOptions` base-only; `getTnDTurnPatternOptions` from `TURN_VALUES²`; `buildTnDCards` cartesian.
- `src/lib/features/choreo-card/services/tnd-family-aggregator.ts` — source base + apply ratio patterns (Phase 4).

**Inner-loop checking:** Start `npm run check:watch` in a background terminal at session start (per `.claude/rules/fast-iteration-loop.md`). Reserve one full `npm run check` for the commit gate of each phase. Never run `npm run build` in the loop.

---

# PHASE 1 — Shared Foundation

The descriptor, the engine split, the pure seam helper, and the cache regression test. Nothing user-visible yet; existing behavior unchanged.

### Task 1: Add the `CardVariation` descriptor to the card model

**Files:**
- Modify: `src/lib/features/choreo-card/domain/models/DeckRelease.ts:9-16`

This is a pure type addition — no unit test (verified by typecheck).

- [ ] **Step 1: Add the interface + optional field**

In `DeckRelease.ts`, directly above `export interface DeckReleaseCard`, add:

```ts
/**
 * A frozen, deterministic variation recipe applied to a card's base sequence at
 * render time. Absent → the card renders its base sequence unchanged (every deck
 * released before this feature). LOOP cards roll one randomly; TnD cards set
 * `turnPattern` deterministically. There is NO parallel `card.turnPattern` field —
 * both producers write here.
 */
export interface CardVariation {
  /** Book reversal id, e.g. "long-book". LOOP only. */
  reversalPatternId?: string;
  /** Raw tiled reversal symbol string (P/R/B/-), re-resolved at apply. LOOP only. */
  reversalSequence?: string;
  /** Turn pattern: tiled per-beat "1|1-0|0" (LOOP) OR a single uniform unit "1|2" (TnD). */
  turnPattern?: string;
  /** Display label for the applied turn pattern, e.g. "Pulse 1" or "1|2". */
  turnLabel?: string;
}
```

Then add the field to `DeckReleaseCard` (after `footer: CardFooter;`):

```ts
  /** Optional frozen variation recipe; absent → renders base. */
  variation?: CardVariation;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "DeckRelease.ts" | head` (or rely on `check:watch`).
Expected: no errors referencing `DeckRelease.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/domain/models/DeckRelease.ts
git commit -m "feat(deck): add CardVariation descriptor to DeckReleaseCard"
```

---

### Task 2: `rollVariation` — pure pick at compose time

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-variation.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`

`pickReversal` and `pickTurnPattern` already exist in `deck-variation.ts` and need only `stepCount`. `rollVariation` composes them into a `CardVariation`, preserving the exact rng call order of the current `applyVariation` (reversal roll → pickReversal → turn roll → pickTurnPattern) so seeded tests are deterministic.

- [ ] **Step 1: Write the failing test**

Create `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  rollVariation,
  type Rng,
} from "../deck-variation";
import type { VariationConfig } from "../deck-variation";

/** Deterministic rng that yields the given values in order, then 0. */
function seededRng(values: number[]): Rng {
  let i = 0;
  return () => values[i++] ?? 0;
}

const TURNS_ONLY: VariationConfig = {
  reversalFrequency: 0,
  enabledReversals: [],
  turnFrequency: 1,
  enabledTurnPatterns: ["hold-1"],
};

describe("rollVariation", () => {
  it("returns null when nothing rolls", () => {
    const cfg: VariationConfig = {
      reversalFrequency: 0, enabledReversals: [],
      turnFrequency: 0, enabledTurnPatterns: [],
    };
    expect(rollVariation(4, cfg, seededRng([0.9, 0.9]))).toBeNull();
  });

  it("rolls a turn pattern when the turn gate passes", () => {
    // rng #1 = turn gate (0.0 < 1 → pass); rng #2 = pickTurnPattern index (→ 0)
    const v = rollVariation(4, TURNS_ONLY, seededRng([0.0, 0.0]));
    expect(v).not.toBeNull();
    expect(v!.turnPattern).toBe("1|1"); // hold-1
    expect(v!.turnLabel).toBe("Hold 1");
    expect(v!.reversalSequence).toBeUndefined();
  });

  it("skips a turn pattern whose period does not tile the step count", () => {
    const cfg: VariationConfig = {
      reversalFrequency: 0, enabledReversals: [],
      turnFrequency: 1, enabledTurnPatterns: ["wave-21"], // period 4
    };
    // stepCount 2 not divisible by 4 → no candidate → null
    expect(rollVariation(2, cfg, seededRng([0.0, 0.0]))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: FAIL — `rollVariation` not exported.

- [ ] **Step 3: Implement `rollVariation`**

In `deck-variation.ts`, add the `CardVariation` import to the existing model import line, and add the function after `pickTurnPattern` (around line 167):

```ts
import type {
  SequenceData,
} from "$lib/shared/foundation/domain/models/SequenceData";
import type { CardVariation } from "../domain/models/DeckRelease";
```

(Add `CardVariation` import near the other `../domain/...` imports.)

```ts
/**
 * Roll a frozen variation recipe for one card. Pure given `rng`. Needs only
 * `stepCount` — sequences are not loaded at compose time. Preserves the rng call
 * order reversal-gate → pickReversal → turn-gate → pickTurnPattern.
 */
export function rollVariation(
  stepCount: number,
  config: VariationConfig,
  rng: Rng = Math.random,
): CardVariation | null {
  const v: CardVariation = {};

  if (config.enabledReversals.length > 0 && rng() < config.reversalFrequency) {
    const resolved = pickReversal(stepCount, config.enabledReversals, rng);
    if (resolved) {
      v.reversalPatternId = resolved.id;
      v.reversalSequence = resolved.sequence;
    }
  }

  if (config.enabledTurnPatterns.length > 0 && rng() < config.turnFrequency) {
    const preset = pickTurnPattern(stepCount, config.enabledTurnPatterns, rng);
    if (preset) {
      v.turnPattern = preset.pattern;
      v.turnLabel = preset.label;
    }
  }

  return v.reversalSequence != null || v.turnPattern != null ? v : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
git commit -m "feat(deck): rollVariation pure-pick recipe at compose time"
```

---

### Task 3: `applyVariationDescriptor` — deterministic cook (must work turn-only)

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-variation.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`

Runs at the seam for BOTH modes. Reversal (if present) reconstructs a minimal `ResolvedReversalPattern` and calls `transformSequence` (which reads only `.sequence` + `.id`). Turn (if present) tiles `parseTurnUnit` to a `TurnPattern` and calls `applyPattern`. **Turn-only with no reversal is the entire TnD path** — it must produce a valid sequence.

- [ ] **Step 1: Write the failing test**

Append to `deck-variation.test.ts`. This uses a tiny hand-built 2-step sequence (no Firestore). `edges` is `[]` — reversal letter re-derivation tolerates an empty edge list (it simply leaves the letter unchanged when no match), and the turn-only path never touches edges.

```ts
import {
  applyVariationDescriptor,
} from "../deck-variation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

function twoStepSeq(): SequenceData {
  const motion = () =>
    createMotionData({
      motionType: "pro",
      rotationDirection: "cw",
      startLocation: "n",
      endLocation: "e",
      turns: 0,
      startOrientation: "in",
      endOrientation: "in",
    });
  return createSequenceData({
    id: "TEST",
    word: "AB",
    steps: [
      { stepNumber: 1, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
        startPosition: "alpha", endPosition: "beta",
        motions: { blue: motion(), red: motion() } },
      { stepNumber: 2, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
        startPosition: "beta", endPosition: "alpha",
        motions: { blue: motion(), red: motion() } },
    ],
  });
}

describe("applyVariationDescriptor", () => {
  it("turn-only: applies turns and returns a new sequence (TnD path)", () => {
    const seq = twoStepSeq();
    const { sequence } = applyVariationDescriptor(seq, { turnPattern: "1|1" }, []);
    expect(sequence).not.toBe(seq); // new object
    expect(sequence.steps[0]!.motions!.blue!.turns).toBe(1);
    expect(sequence.steps[0]!.motions!.red!.turns).toBe(1);
  });

  it("turn-only: tiles a single uniform unit across all beats", () => {
    const { sequence } = applyVariationDescriptor(twoStepSeq(), { turnPattern: "1|2" }, []);
    expect(sequence.steps[0]!.motions!.blue!.turns).toBe(1);
    expect(sequence.steps[0]!.motions!.red!.turns).toBe(2);
    expect(sequence.steps[1]!.motions!.blue!.turns).toBe(1);
    expect(sequence.steps[1]!.motions!.red!.turns).toBe(2);
  });

  it("no-op descriptor returns the base sequence content unchanged", () => {
    const seq = twoStepSeq();
    const { sequence } = applyVariationDescriptor(seq, {}, []);
    expect(sequence.steps[0]!.motions!.blue!.turns).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: FAIL — `applyVariationDescriptor` not exported.

- [ ] **Step 3: Implement `applyVariationDescriptor`**

In `deck-variation.ts`, add after `rollVariation`:

```ts
export interface AppliedDescriptorResult {
  sequence: SequenceData;
  /** false when an applied turn pattern breaks per-hand loop closure. */
  turnLoopClosed: boolean;
}

/**
 * Deterministically apply a frozen descriptor to a base sequence. Pure. Reversal
 * (if present) via `transformSequence`; turns (if present) via `applyPattern`.
 * Turn-only (no reversal) is valid and is the TnD render path.
 */
export function applyVariationDescriptor(
  seq: SequenceData,
  variation: CardVariation,
  edges: CsvEdge[],
): AppliedDescriptorResult {
  let working = seq;

  if (variation.reversalSequence) {
    const resolved: ResolvedReversalPattern = {
      id: variation.reversalPatternId ?? variation.reversalSequence,
      label: variation.reversalPatternId ?? "Custom",
      sequence: variation.reversalSequence,
      isNamed: false,
      isCleanLoop: true,
    };
    working = transformSequence(working, resolved, edges);
  }

  let turnLoopClosed = true;
  if (variation.turnPattern) {
    const unit = parseTurnUnit(variation.turnPattern);
    if (unit.length > 0) {
      const stepCount = working.steps.length;
      const base = loopCloses(working);
      const entries: TurnPatternEntry[] = [];
      for (let i = 0; i < stepCount; i++) {
        const u = unit[i % unit.length]!;
        entries.push({ stepIndex: i, blue: u.blue, red: u.red });
      }
      const pattern: TurnPattern = {
        id: "variation",
        name: "variation",
        userId: "",
        createdAt: null as unknown as TurnPattern["createdAt"],
        stepCount,
        entries,
      };
      const res = applyPattern(pattern, working, "both");
      if (res.success && res.sequence) {
        working = res.sequence;
        const closed = loopCloses(working);
        turnLoopClosed = (closed.blue || !base.blue) && (closed.red || !base.red);
      }
    }
  }

  return { sequence: working, turnLoopClosed };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
git commit -m "feat(deck): applyVariationDescriptor deterministic cook (turn-only valid)"
```

---

### Task 4: Refactor `applyVariation` to compose roll + apply (test page untouched)

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-variation.ts:186-256`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`

The test route `/test/deck-variation` calls `applyVariation` and reads the `AppliedVariation` shape. Rewriting it as `roll → apply` must preserve that shape exactly.

- [ ] **Step 1: Write the failing test**

Append to `deck-variation.test.ts`:

```ts
import { applyVariation, DEFAULT_VARIATION_CONFIG } from "../deck-variation";

describe("applyVariation (compose wrapper)", () => {
  it("preserves the AppliedVariation shape with all keys", () => {
    const seq = twoStepSeq();
    const cfg = { ...DEFAULT_VARIATION_CONFIG, reversalFrequency: 0, turnFrequency: 0 };
    const result = applyVariation(seq, cfg, [], () => 0.99);
    expect(result.sequence).toBe(seq); // no variation rolled → base returned
    expect(result.variation).toEqual({
      reversalPatternId: null,
      reversalLabel: null,
      reversalSequence: null,
      turnPattern: null,
      turnLabel: null,
      turnLoopClosed: true,
      warnings: [],
    });
  });

  it("maps a rolled turn into AppliedVariation fields", () => {
    const cfg = {
      reversalFrequency: 0, enabledReversals: [],
      turnFrequency: 1, enabledTurnPatterns: ["hold-1"],
    };
    const result = applyVariation(twoStepSeq(), cfg, [], seededRng([0.0, 0.0]));
    expect(result.variation.turnPattern).toBe("1|1");
    expect(result.variation.turnLabel).toBe("Hold 1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: FAIL — old `applyVariation` returns a different/partial shape OR mismatched object identity.

- [ ] **Step 3: Replace the `applyVariation` body**

Replace the entire existing `applyVariation` function (lines ~186-256) with:

```ts
/**
 * Roll + apply in one shot. Thin wrapper over rollVariation + applyVariationDescriptor.
 * Used by the test route; the releaser rolls and applies separately (compose vs seam).
 */
export function applyVariation(
  seq: SequenceData,
  config: VariationConfig,
  edges: CsvEdge[],
  rng: Rng = Math.random,
): VariantResult {
  const variation = rollVariation(seq.steps.length, config, rng);
  if (!variation) {
    return {
      sequence: seq,
      variation: {
        reversalPatternId: null,
        reversalLabel: null,
        reversalSequence: null,
        turnPattern: null,
        turnLabel: null,
        turnLoopClosed: true,
        warnings: [],
      },
    };
  }

  const { sequence, turnLoopClosed } = applyVariationDescriptor(seq, variation, edges);
  const reversalLabel = variation.reversalPatternId
    ? BOOK_PATTERNS.find((p) => p.id === variation.reversalPatternId)?.label ??
      variation.reversalPatternId
    : null;

  return {
    sequence,
    variation: {
      reversalPatternId: variation.reversalPatternId ?? null,
      reversalLabel,
      reversalSequence: variation.reversalSequence ?? null,
      turnPattern: variation.turnPattern ?? null,
      turnLabel: variation.turnLabel ?? null,
      turnLoopClosed,
      warnings: [],
    },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Verify the test route still type-checks**

Run: confirm `check:watch` shows no new errors in `src/routes/test/deck-variation/+page.svelte`.
Expected: clean (the `AppliedVariation` shape is unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
git commit -m "refactor(deck): applyVariation composes roll+apply, shape preserved"
```

---

### Task 5: `resolveDeckSequences` — the pure, positional seam helper

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-variation.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`

This is the extracted core of the seam. **Positional** (iterates `cards` in order), keyed `${sourceCatalogId}::${sequenceId}`. The TnD-collapse regression: N cards sharing 1 base id must yield N distinct outputs — the old `seqMap.get(id)` id-map collapsed them.

- [ ] **Step 1: Write the failing test**

Append to `deck-variation.test.ts`:

```ts
import { resolveDeckSequences } from "../deck-variation";

describe("resolveDeckSequences (positional seam)", () => {
  it("expands many cards over one base id into distinct variants (TnD collapse fix)", () => {
    const base = twoStepSeq(); // id "TEST"
    const map = new Map([["cat::TEST", base]]);
    const cards = [
      { sequenceId: "TEST", sourceCatalogId: "cat", variation: { turnPattern: "0|0" } },
      { sequenceId: "TEST", sourceCatalogId: "cat", variation: { turnPattern: "1|1" } },
      { sequenceId: "TEST", sourceCatalogId: "cat", variation: { turnPattern: "2|2" } },
    ];
    const out = resolveDeckSequences(cards, map, []);
    expect(out).toHaveLength(3); // NOT collapsed to 1
    expect(out[0]!.sequence.steps[0]!.motions!.blue!.turns).toBe(0);
    expect(out[1]!.sequence.steps[0]!.motions!.blue!.turns).toBe(1);
    expect(out[2]!.sequence.steps[0]!.motions!.blue!.turns).toBe(2);
  });

  it("returns base untouched when a card has no variation", () => {
    const base = twoStepSeq();
    const map = new Map([["cat::TEST", base]]);
    const out = resolveDeckSequences([{ sequenceId: "TEST", sourceCatalogId: "cat" }], map, []);
    expect(out[0]!.sequence).toBe(base);
    expect(out[0]!.turnLoopClosed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: FAIL — `resolveDeckSequences` not exported.

- [ ] **Step 3: Implement `resolveDeckSequences`**

In `deck-variation.ts`, add after `applyVariationDescriptor`:

```ts
export interface ResolvedDeckSequence {
  sequence: SequenceData;
  turnLoopClosed: boolean;
}

/** Card fields the seam needs — a structural subset of DeckReleaseCard. */
interface ResolvableCard {
  sequenceId: string;
  sourceCatalogId: string;
  variation?: CardVariation;
}

/**
 * Resolve every card POSITIONALLY (by index) against a preloaded base map keyed
 * `${sourceCatalogId}::${sequenceId}`. Cards sharing a base id each get their own
 * variant — never collapsed. Cards whose base is missing are skipped.
 */
export function resolveDeckSequences(
  cards: ResolvableCard[],
  baseByKey: Map<string, SequenceData>,
  edges: CsvEdge[],
): ResolvedDeckSequence[] {
  const out: ResolvedDeckSequence[] = [];
  for (const card of cards) {
    const base = baseByKey.get(`${card.sourceCatalogId}::${card.sequenceId}`);
    if (!base) continue;
    if (!card.variation) {
      out.push({ sequence: base, turnLoopClosed: true });
      continue;
    }
    out.push(applyVariationDescriptor(base, card.variation, edges));
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: PASS (10 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
git commit -m "feat(deck): resolveDeckSequences positional seam helper (TnD collapse fix)"
```

---

### Task 6: Cache-key regression test (no code change — verify content hash discriminates variants)

**Files:**
- Test: `src/lib/shared/foundation/services/__tests__/content-hasher-variant.test.ts`

`PrintPreviewPages.buildCacheKey` (`:230`) already folds `hashSequenceContent(seq)`, which hashes every step's motions + reversal flags (`content-hasher.ts:84-116`). A turn-varied sequence (same id, mutated motions) therefore gets a distinct key automatically. This test locks that guarantee so a future hash change can't silently reintroduce collisions.

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/foundation/services/__tests__/content-hasher-variant.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashSequenceContent } from "../content-hasher";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { createSequenceData } from "../domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

function seq() {
  const m = () => createMotionData({
    motionType: "pro", rotationDirection: "cw",
    startLocation: "n", endLocation: "e", turns: 0,
    startOrientation: "in", endOrientation: "in",
  });
  return createSequenceData({
    id: "BASE", word: "AB",
    steps: [
      { stepNumber: 1, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
        startPosition: "alpha", endPosition: "beta", motions: { blue: m(), red: m() } },
      { stepNumber: 2, duration: 1, blueReversal: false, redReversal: false, isBlank: false,
        startPosition: "beta", endPosition: "alpha", motions: { blue: m(), red: m() } },
    ],
  });
}

describe("hashSequenceContent discriminates turn variants of the same base id", () => {
  it("base vs +1-turn variant produce different hashes", () => {
    const base = seq();
    const varied = applyVariationDescriptor(base, { turnPattern: "1|1" }, []).sequence;
    expect(varied.id).toBe(base.id); // same id
    expect(hashSequenceContent(varied)).not.toBe(hashSequenceContent(base));
  });

  it("two different turn patterns over the same base differ", () => {
    const base = seq();
    const a = applyVariationDescriptor(base, { turnPattern: "1|1" }, []).sequence;
    const b = applyVariationDescriptor(base, { turnPattern: "2|2" }, []).sequence;
    expect(hashSequenceContent(a)).not.toBe(hashSequenceContent(b));
  });
});
```

- [ ] **Step 2: Run to verify it passes immediately (guarantee already holds)**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/shared/foundation/services/__tests__/content-hasher-variant.test.ts`
Expected: PASS (2 tests). If it FAILS, the cache would collide variants — STOP and add the descriptor to `buildCacheKey` before proceeding (it does not currently need it).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/foundation/services/__tests__/content-hasher-variant.test.ts
git commit -m "test(deck): lock content-hash discriminates turn variants (cache key)"
```

---

### Task 7: Rewrite the seam `loadSelectedSequences` (positional + per-card apply + dedup load)

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte:192-218`

Component-level (Firestore + Svelte) — verified at runtime via the releaser, not a unit test (the pure core is covered by Task 5). Rewrites the seam to: load distinct base ids once, load edges only if needed, resolve positionally via `resolveDeckSequences`, and record the broken-loop count.

- [ ] **Step 1: Add imports**

At the top of the `<script>` in `DeckReleaserTab.svelte`, add to the existing `deck-composer`/service imports:

```ts
  import { resolveDeckSequences } from "../../services/deck-variation";
  import { loadDiamondEdges } from "../../services/pictograph-letter-lookup";
```

- [ ] **Step 2: Replace `loadSelectedSequences`**

Replace the existing function body (`:192-218`) with:

```ts
  async function loadSelectedSequences(generation: number) {
    rs.isLoadingSequences = true;
    try {
      // Load each base sequence once (TnD packs many cards over few base ids).
      const byCatalog = new Map<string, string[]>();
      const seen = new Set<string>();
      for (const card of rs.cards) {
        const key = `${card.sourceCatalogId}::${card.sequenceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const ids = byCatalog.get(card.sourceCatalogId) ?? [];
        ids.push(card.sequenceId);
        byCatalog.set(card.sourceCatalogId, ids);
      }

      const baseByKey = new Map<string, SequenceData>();
      for (const [catalogId, seqIds] of byCatalog) {
        const loaded = await loadSequencesByIds(catalogId, seqIds);
        for (const s of loaded) baseByKey.set(`${catalogId}::${s.id}`, s);
      }
      if (generation !== rs.drawGeneration) return;

      const needsVariation = rs.cards.some((c) => c.variation);
      const edges = needsVariation ? await loadDiamondEdges() : [];
      if (generation !== rs.drawGeneration) return;

      const resolved = resolveDeckSequences(rs.cards, baseByKey, edges);
      rs.sequences = resolved.map((r) => r.sequence);
      rs.brokenLoopCount = resolved.filter((r) => !r.turnLoopClosed).length;
    } catch (err) {
      console.warn("Failed to load sequences:", err);
    } finally {
      rs.isLoadingSequences = false;
    }
  }
```

- [ ] **Step 3: Update `handleSwapCard` to re-apply variation**

In `handleSwapCard` (`:220-241`), replace the per-swap reload block so the swapped card's variation is applied. Replace the `try { const loaded = ... }` block with:

```ts
    try {
      const loaded = await loadSequencesByIds(newCard.sourceCatalogId, [newCard.sequenceId]);
      if (loaded.length > 0) {
        const base = loaded[0]!;
        let resolvedSeq = base;
        if (newCard.variation) {
          const edges = await loadDiamondEdges();
          resolvedSeq = applyVariationDescriptor(base, newCard.variation, edges).sequence;
        }
        rs.sequences = rs.sequences.map((s, i) => (i === index ? resolvedSeq : s));
      }
    } catch (err) {
      console.warn("Failed to load swapped sequence:", err);
    }
```

And add `applyVariationDescriptor` to the deck-variation import in Step 1:

```ts
  import { resolveDeckSequences, applyVariationDescriptor } from "../../services/deck-variation";
```

- [ ] **Step 4: Verify at runtime**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` then open the deck releaser tab; draw a LOOP deck (no variation config yet → all base, behaves as before). Confirm cards render and counts match.
Expected: HTTP 200; deck renders unchanged from pre-refactor (variation config still default-empty until Phase 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "refactor(deck): seam loads bases once, resolves positionally with variation"
```

---

### Task 8: Audit other released-deck render paths

**Files:**
- Read-only grep; modify only if a consumer is found.

- [ ] **Step 1: Grep for DeckRelease consumers outside the releaser**

Run (Grep tool): pattern `DeckRelease\b|release\.sequences|getAllReleases` across `src/`.
Expected: enumerate every file that renders a released deck's `sequences`.

- [ ] **Step 2: Route any external render path through `resolveDeckSequences`**

For each consumer that loads `release.sequences` and renders them (e.g. a public gallery or QR-scan view), apply the same load-base-once + `resolveDeckSequences` pattern. If the ONLY consumer is `DeckReleaserTab`, record that finding and skip.

- [ ] **Step 3: Commit (only if a consumer was changed)**

```bash
git add -A
git commit -m "fix(deck): apply card variation on <consumer> render path"
```

---

# PHASE 2 — LOOP Variation UI

Wire the roll into compose, add the ConfigureStep controls, surface the broken-loop summary.

### Task 9: `variationConfig` + `brokenLoopCount` state with session persistence

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts`

- [ ] **Step 1: Import the config type + default**

Add to the imports at the top:

```ts
import { DEFAULT_VARIATION_CONFIG, type VariationConfig } from "../../services/deck-variation";
```

- [ ] **Step 2: Add the state fields**

Inside `class DeckReleaserState`, after `redPropOverride` (`:48`), add:

```ts
  variationConfig = $state<VariationConfig>({ ...DEFAULT_VARIATION_CONFIG });
  brokenLoopCount = $state(0);
```

- [ ] **Step 3: Persist `variationConfig` in the session**

Add `variationConfig` to `PersistedSession` (after `description: string;`):

```ts
  variationConfig?: VariationConfig;
```

In `persist()`, add to the `saveSession({...})` object:

```ts
      variationConfig: this.variationConfig,
```

In the constructor restore block (`if (saved) {...}`), add:

```ts
      if (saved.variationConfig) this.variationConfig = saved.variationConfig;
```

- [ ] **Step 4: Reset on new deck**

In `reset()`, add before `this.step = "configure";`:

```ts
    this.brokenLoopCount = 0;
```

(Leave `variationConfig` intact across resets — it's a user preference, not deck state.)

- [ ] **Step 5: Verify compile + commit**

Confirm `check:watch` is clean for the file.

```bash
git add src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts
git commit -m "feat(deck): variationConfig + brokenLoopCount releaser state"
```

---

### Task 10: Roll variation in `composeFullDeck` (LOOP branch)

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte:169-175`

- [ ] **Step 1: Import `rollVariation`**

Extend the deck-variation import:

```ts
  import { resolveDeckSequences, applyVariationDescriptor, rollVariation } from "../../services/deck-variation";
```

- [ ] **Step 2: Attach a rolled recipe per LOOP card**

Replace `composeFullDeck` (`:169-175`) with:

```ts
  function composeFullDeck() {
    if (rs.deckMode === 'tnd') {
      const tndCards = buildTnDCards(rs.tndFamilies, rs.selectedTnDFamilies, rs.selectedTnDTurnPatterns);
      return tndCards.map((c, i) => ({ ...c, position: i + 1 }));
    }
    const cards = composeDeck(pool, rs.weights, rs.totalCards, { center: rs.notes });
    return cards.map((c) => {
      const variation = rollVariation(c.stepCount, rs.variationConfig, Math.random);
      return variation ? { ...c, variation } : c;
    });
  }
```

- [ ] **Step 3: Verify at runtime**

Open the releaser, draw a LOOP deck (config still default until Task 12 UI). Default config has frequencies 0.4/0.5 with enabled patterns, so some cards should now render with turns/reversals (varied words). Confirm via the rendered cards differing from a zero-variation draw.
Expected: a fraction of cards show varied content; no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck): roll per-card LOOP variation at compose"
```

---

### Task 11: ConfigureStep LOOP variation control group

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte`

Adds a "Variation" group below "Step Count Mix" in the LOOP branch. Buttons + selected-state (NO checkboxes, per `.claude/rules/no-checkboxes.md`). Reuses existing `.preset-btn`, `.source-btn`, `.weight-slider` styles.

- [ ] **Step 1: Add props + imports**

In the `<script>`, import the pattern catalogs + config type:

```ts
  import {
    BOOK_PATTERNS,
    TURN_PATTERNS,
    type VariationConfig,
  } from "../../services/deck-variation";
```

Add to the `Props` interface:

```ts
    variationConfig: VariationConfig;
    onVariationConfigChange: (config: VariationConfig) => void;
```

Add to the destructured `let {...}` props:

```ts
    variationConfig,
    onVariationConfigChange,
```

- [ ] **Step 2: Add derived offered patterns + helpers**

After the `PRESETS` const (`:61`), add:

```ts
  // Reversals offered to LOOP decks: book family minus red-/blue-book.
  const OFFERED_REVERSALS = BOOK_PATTERNS.filter((p) =>
    ["book", "long-book", "alternating"].includes(p.id),
  );

  const VARIATION_PRESETS = [
    { id: "clean", label: "Clean", icon: "fa-feather", rf: 0, tf: 0 },
    { id: "sprinkle", label: "Sprinkle", icon: "fa-wand-magic-sparkles", rf: 0.3, tf: 0.4 },
    { id: "spicy", label: "Spicy", icon: "fa-pepper-hot", rf: 0.6, tf: 0.7 },
  ] as const;

  function toggleReversal(id: string) {
    const next = new Set(variationConfig.enabledReversals);
    if (next.has(id)) next.delete(id); else next.add(id);
    onVariationConfigChange({ ...variationConfig, enabledReversals: [...next] });
  }

  function toggleTurn(id: string) {
    const next = new Set(variationConfig.enabledTurnPatterns);
    if (next.has(id)) next.delete(id); else next.add(id);
    onVariationConfigChange({ ...variationConfig, enabledTurnPatterns: [...next] });
  }

  function setReversalFreq(v: number) {
    onVariationConfigChange({ ...variationConfig, reversalFrequency: v / 100 });
  }
  function setTurnFreq(v: number) {
    onVariationConfigChange({ ...variationConfig, turnFrequency: v / 100 });
  }
  function applyVariationPreset(rf: number, tf: number) {
    onVariationConfigChange({ ...variationConfig, reversalFrequency: rf, turnFrequency: tf });
  }
```

- [ ] **Step 3: Add the markup**

Inside the `{#if deckMode === "loop"}` block, immediately after the "Step Count Mix" `control-group` (after its closing `</div>` at `:201`), add:

```svelte
      <div class="control-group">
        <span class="control-label">Variation</span>
        <div class="preset-row">
          {#each VARIATION_PRESETS as p (p.id)}
            <button type="button" class="preset-btn" onclick={() => applyVariationPreset(p.rf, p.tf)}>
              <i class="fas {p.icon}" aria-hidden="true"></i>
              {p.label}
            </button>
          {/each}
        </div>

        <div class="weight-row variation-freq">
          <span class="step-label">Reversals</span>
          <input
            type="range" min="0" max="100"
            value={Math.round(variationConfig.reversalFrequency * 100)}
            class="weight-slider"
            oninput={(e) => setReversalFreq(parseInt((e.target as HTMLInputElement).value))}
          />
          <span class="weight-pct">{Math.round(variationConfig.reversalFrequency * 100)}%</span>
        </div>
        <div class="toggle-row">
          {#each OFFERED_REVERSALS as r (r.id)}
            <button
              type="button"
              class="toggle-chip"
              class:selected={variationConfig.enabledReversals.includes(r.id)}
              aria-pressed={variationConfig.enabledReversals.includes(r.id)}
              onclick={() => toggleReversal(r.id)}
            >{r.label}</button>
          {/each}
        </div>

        <div class="weight-row variation-freq">
          <span class="step-label">Turns</span>
          <input
            type="range" min="0" max="100"
            value={Math.round(variationConfig.turnFrequency * 100)}
            class="weight-slider"
            oninput={(e) => setTurnFreq(parseInt((e.target as HTMLInputElement).value))}
          />
          <span class="weight-pct">{Math.round(variationConfig.turnFrequency * 100)}%</span>
        </div>
        <div class="toggle-row">
          {#each TURN_PATTERNS as t (t.id)}
            <button
              type="button"
              class="toggle-chip"
              class:selected={variationConfig.enabledTurnPatterns.includes(t.id)}
              aria-pressed={variationConfig.enabledTurnPatterns.includes(t.id)}
              title={t.pattern}
              onclick={() => toggleTurn(t.id)}
            >{t.label}</button>
          {/each}
        </div>
      </div>
```

- [ ] **Step 4: Add styles**

In the `<style>` block, add (after `.pool-size`):

```css
  .variation-freq {
    grid-template-columns: 80px 1fr 48px;
  }

  .toggle-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toggle-chip {
    min-height: 36px;
    padding: 6px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .toggle-chip:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--theme-text, #fff);
  }

  .toggle-chip.selected {
    background: rgba(139, 92, 246, 0.18);
    border-color: var(--theme-accent, #8b5cf6);
    color: var(--theme-text, #fff);
  }
```

- [ ] **Step 5: Verify at runtime (after Task 12 wires props)** — placeholder note

This task compiles but the controls do nothing until Task 12 passes the props through. Verification happens at the end of Task 12.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte
git commit -m "feat(deck): LOOP variation controls (freq sliders + pattern chips + presets)"
```

---

### Task 12: Wire variation props through DeckReleaserTab

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte:318-340`

- [ ] **Step 1: Pass props to `<ConfigureStep>`**

In the `<ConfigureStep ... />` invocation, add:

```svelte
        variationConfig={rs.variationConfig}
        onVariationConfigChange={(c) => { rs.variationConfig = c; }}
```

- [ ] **Step 2: Verify end-to-end at runtime**

Open the releaser → LOOP mode. Set Turns to 100%, enable only "Hold 1". Draw 52. Confirm:
- Every card shows 1-turn motions (visibly varied vs base).
- Set Reversals to 100%, enable "Long Book", redraw → cards show flipped spins + re-derived words.
- "Clean" preset → redraw → all base.
Expected: controls drive the draw; no console errors. Capture a screenshot or runtime confirmation per `.claude/rules/verification-protocol.md`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck): wire LOOP variation config into ConfigureStep"
```

---

### Task 13: Broken-loop summary badge in Review

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte`
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte:342-366`

Surface, don't block (spec §10). A summary count in the review header; redraw to clear.

- [ ] **Step 1: Add a prop to ReviewStep**

In `ReviewStep.svelte` `Props`, add:

```ts
    brokenLoopCount?: number;
```

In the destructured props:

```ts
    brokenLoopCount = 0,
```

- [ ] **Step 2: Render the badge**

In the `.deck-meta` block (after the `meta-steps` span, `:240`), add:

```svelte
        {#if brokenLoopCount > 0}
          <span class="meta-sep" aria-hidden="true">·</span>
          <span class="meta-broken" title="These cards' turns don't return the prop to its start orientation. Redraw to reroll.">
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            {brokenLoopCount} break loop
          </span>
        {/if}
```

- [ ] **Step 3: Add the style**

In `ReviewStep.svelte` `<style>`, after `.meta-steps`:

```css
  .meta-broken {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    color: #fbbf24;
  }
```

- [ ] **Step 4: Pass it from the tab**

In `DeckReleaserTab.svelte` `<ReviewStep ... />`, add:

```svelte
        brokenLoopCount={rs.brokenLoopCount}
```

- [ ] **Step 5: Verify at runtime**

Enable a turn pattern likely to break closure on some step counts (e.g. "Trade 1" on odd-tiling cards), draw, observe the header count. Redraw → recomputes.
Expected: badge shows when `brokenLoopCount > 0`, hidden at 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ReviewStep.svelte src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck): broken-loop summary badge in review header"
```

---

# PHASE 3 — TnD Parameter Model

Replace materialized TnD decks with a render-time cartesian product sourced from the zero-turn base catalog. Fixes the live count bug by construction.

### Task 14: `getTnDFamilyOptions` reads only the zero-turn base catalog

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts:235-266`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`

The base catalog id is `l1-vtg-motions` (collection "TnD", `turnPattern` "uniform-0t", 6 families). Drop the cross-deck merge + dedup hack.

- [ ] **Step 1: Write the failing test**

Create `src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getTnDFamilyOptions } from "../deck-composer";
import type { Catalog } from "../../domain/models/Catalog";

function baseCatalog(): Catalog {
  return {
    id: "l1-vtg-motions",
    name: "VTG Motions (1:1)",
    canonicalName: "vtg", description: "",
    families: [
      { id: "tog-same", label: "Tog-Same", typeCombo: "", sequenceIds: ["AA", "BB", "CC"] },
      { id: "split-same", label: "Split-Same", typeCombo: "", sequenceIds: ["DD", "EE"] },
      { id: "unknown", label: "Unknown", typeCombo: "", sequenceIds: ["ZZ"] },
    ],
    totalSequences: 6, gridMode: "diamond" as Catalog["gridMode"], level: 1,
    collection: "TnD", loopType: "", sliceType: "quartered",
    stepCount: 4, turnPattern: "uniform-0t", reversalPattern: "",
  };
}

describe("getTnDFamilyOptions (base-only)", () => {
  it("reads families from l1-vtg-motions, skips 'unknown', counts base seqs", () => {
    const opts = getTnDFamilyOptions([baseCatalog()]);
    expect(opts.map((o) => o.familyId).sort()).toEqual(["split-same", "tog-same"]);
    const tog = opts.find((o) => o.familyId === "tog-same")!;
    expect(tog.sequenceCount).toBe(3);
    expect(tog.entries).toHaveLength(3);
    expect(tog.entries[0]).toMatchObject({ sequenceId: "AA", sourceCatalogId: "l1-vtg-motions" });
  });

  it("returns empty when the base catalog is absent", () => {
    expect(getTnDFamilyOptions([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: FAIL — old `getTnDFamilyOptions` merges across all TnD catalogs.

- [ ] **Step 3: Replace `getTnDFamilyOptions`**

Add a constant near the top of `deck-composer.ts` (after imports):

```ts
/** Canonical zero-turn TnD base catalog; all turn-grid cells derive from it. */
export const TND_BASE_CATALOG_ID = "l1-vtg-motions";
```

Replace `getTnDFamilyOptions` (`:235-266`) with:

```ts
export function getTnDFamilyOptions(catalogs: Catalog[]): TnDFamilyOption[] {
  const base = catalogs.find((c) => c.id === TND_BASE_CATALOG_ID);
  if (!base) return [];
  return base.families
    .filter((f) => f.id && f.id !== "unknown")
    .map((family) => ({
      familyId: family.id,
      label: family.label,
      sequenceCount: family.sequenceIds.length,
      entries: family.sequenceIds.map((id) => ({
        sequenceId: id,
        sourceCatalogId: base.id,
        turnRatio: "1:1",
        turnPattern: "0|0",
      })),
    }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts
git commit -m "feat(tnd): getTnDFamilyOptions reads only zero-turn base catalog"
```

---

### Task 15: `getTnDTurnPatternOptions` from `TURN_VALUES²`

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts:281-313`
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte:89` (call site)
- Test: `src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`

Derive all 49 cells directly; every cell always offerable. Count per cell = base seqs in selected families (live). Emit canonical `"b|r"` pattern strings (the matrix's `parseTurnPattern` handles them).

- [ ] **Step 1: Write the failing test**

Append to `deck-composer-tnd.test.ts`:

```ts
import { getTnDTurnPatternOptions } from "../deck-composer";

describe("getTnDTurnPatternOptions (TURN_VALUES²)", () => {
  it("produces all 49 cells with canonical b|r patterns", () => {
    const opts = getTnDTurnPatternOptions(10);
    expect(opts).toHaveLength(49);
    expect(opts.map((o) => o.turnPattern)).toContain("0|0");
    expect(opts.map((o) => o.turnPattern)).toContain("3|3");
    expect(opts.map((o) => o.turnPattern)).toContain("0.5|1");
    expect(opts.every((o) => o.sequenceCount === 10)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: FAIL — current signature reads `catalogs`, not a count, and derives from deck totals.

- [ ] **Step 3: Replace `getTnDTurnPatternOptions` + drop the now-unused helpers**

Add the import at the top of `deck-composer.ts`:

```ts
import { TURN_VALUES } from "../domain/turn-pattern-parser";
```

Replace `getTnDTurnPatternOptions` and its `formatTurnPatternLabel`/`parseTurnPatternSort` helpers (`:281-313`) with:

```ts
function formatTurn(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/**
 * The full 7×7 turn grid. `selectedFamilyBaseSeqs` is the count of base sequences
 * across currently-selected families; each cell contributes that many cards
 * (cartesian), so the per-cell count reflects the live family selection.
 */
export function getTnDTurnPatternOptions(selectedFamilyBaseSeqs: number): TnDTurnPatternOption[] {
  const opts: TnDTurnPatternOption[] = [];
  for (const blue of TURN_VALUES) {
    for (const red of TURN_VALUES) {
      const tp = `${formatTurn(blue)}|${formatTurn(red)}`;
      opts.push({ turnPattern: tp, label: tp, sequenceCount: selectedFamilyBaseSeqs });
    }
  }
  return opts;
}
```

- [ ] **Step 4: Update the call site in DeckReleaserTab**

The `onMount` currently calls `getTnDTurnPatternOptions(catalogs)` (`:89`). Replace the assignment with a `$derived` so the cell count tracks family selection. Remove `rs.tndTurnPatterns = getTnDTurnPatternOptions(catalogs);` from `onMount`, and add near the other deriveds (after `tndCardCount`, `:159`):

```ts
  const selectedFamilyBaseSeqs = $derived(
    rs.tndFamilies
      .filter((f) => rs.selectedTnDFamilies.has(f.familyId))
      .reduce((sum, f) => sum + f.sequenceCount, 0),
  );
  $effect(() => {
    rs.tndTurnPatterns = getTnDTurnPatternOptions(selectedFamilyBaseSeqs);
  });
```

- [ ] **Step 5: Run unit tests + verify compile**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: PASS. Confirm `check:watch` clean (no remaining `formatTurnPatternLabel` references).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts
git commit -m "feat(tnd): turn-pattern options from TURN_VALUES grid, live per-cell count"
```

---

### Task 16: `buildTnDCards` cartesian product emitting `variation.turnPattern`

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts:315-336`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`

Count = selectedFamilyBaseSeqs × selectedPatterns. Each card carries `variation.turnPattern` deterministically (no roll, no reversal).

- [ ] **Step 1: Write the failing test**

Append to `deck-composer-tnd.test.ts`:

```ts
import { buildTnDCards } from "../deck-composer";

describe("buildTnDCards (cartesian)", () => {
  it("emits family × pattern × baseSeq cards, each with variation.turnPattern", () => {
    const families = getTnDFamilyOptions([baseCatalog()]); // tog-same:3, split-same:2
    const selected = new Set(["tog-same"]);
    const patterns = new Set(["0|0", "1|1"]);
    const cards = buildTnDCards(families, selected, patterns);
    expect(cards).toHaveLength(3 * 2); // 3 base × 2 patterns
    expect(cards.every((c) => c.variation?.turnPattern != null)).toBe(true);
    expect(cards.filter((c) => c.variation!.turnPattern === "1|1")).toHaveLength(3);
    expect(cards[0]!.sourceCatalogId).toBe("l1-vtg-motions");
  });

  it("returns no cards when no pattern is selected", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    expect(buildTnDCards(families, new Set(["tog-same"]), new Set())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: FAIL — old `buildTnDCards` filters `entry.turnPattern` against the materialized per-entry pattern and emits no `variation`.

- [ ] **Step 3: Replace `buildTnDCards`**

Replace `buildTnDCards` (`:315-336`) with:

```ts
export function buildTnDCards(
  tndFamilies: TnDFamilyOption[],
  selectedFamilies: Set<string>,
  selectedTurnPatterns?: Set<string>,
): DeckReleaseCard[] {
  const patterns = selectedTurnPatterns ? [...selectedTurnPatterns] : [];
  if (patterns.length === 0) return [];
  const cards: DeckReleaseCard[] = [];
  for (const fam of tndFamilies) {
    if (!selectedFamilies.has(fam.familyId)) continue;
    for (const pattern of patterns) {
      for (const entry of fam.entries) {
        cards.push({
          sequenceId: entry.sequenceId,
          sourceCatalogId: entry.sourceCatalogId,
          stepCount: 4,
          word: entry.sequenceId,
          position: 0,
          variation: { turnPattern: pattern, turnLabel: pattern },
          footer: tndFooter(fam.familyId, entry.turnRatio),
        });
      }
    }
  }
  return cards;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: PASS (5 TnD tests total).

- [ ] **Step 5: Verify end-to-end at runtime**

Open the releaser → TnD mode. Select tog-same + the "Matched" preset (7 cells: 0|0…3|3). Confirm the draw count = base seqs × 7, and cards render with increasing turns down the matched diagonal. Crucially: cards sharing a base id now render distinctly (no collapse).
Expected: count exact; distinct renders per turn cell; no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts
git commit -m "feat(tnd): buildTnDCards cartesian product with deterministic variation.turnPattern"
```

---

### Task 17: TnD family-button dynamic count

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte:236`

The family button currently shows `fam.sequenceCount` (static base count). Show the live contribution: `baseSeqs × selectedPatterns`.

- [ ] **Step 1: Add a prop for the selected pattern count**

In `ConfigureStep.svelte` `Props`, add:

```ts
    selectedTurnPatternCount: number;
```

Destructure it:

```ts
    selectedTurnPatternCount,
```

- [ ] **Step 2: Use it in the family-button count**

Replace the `tnd-family-count` span (`:236`) with:

```svelte
              <span class="tnd-family-count">{fam.sequenceCount * selectedTurnPatternCount} cards</span>
```

- [ ] **Step 3: Pass it from the tab**

In `DeckReleaserTab.svelte` `<ConfigureStep ... />`, add:

```svelte
        selectedTurnPatternCount={rs.selectedTnDTurnPatterns.size}
```

- [ ] **Step 4: Verify at runtime**

TnD mode: select 3 turn cells → each family button shows `baseSeqs × 3`. Change selection → counts update live. Draw count (button) matches sum over selected families.
Expected: dynamic counts; consistent with draw total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(tnd): family-button shows live baseSeqs × selectedPatterns count"
```

---

# PHASE 4 — Browser Surface Unify

Point the catalog-browser family aggregator at the base catalog + render-time turn application, decoupling it from materialized decks.

### Task 18: `tnd-family-aggregator` sources base + applies ratio patterns

**Files:**
- Modify: `src/lib/features/choreo-card/services/tnd-family-aggregator.ts`

- [ ] **Step 1: Rewrite `aggregateFamilySequences`**

Replace the file body with:

```ts
import type { Catalog } from "../domain/models/Catalog";
import { loadSequencesByIds } from "./catalog-loader";
import { loadDiamondEdges } from "./pictograph-letter-lookup";
import { applyVariationDescriptor } from "./deck-variation";
import { TND_BASE_CATALOG_ID } from "./deck-composer";
import type { FamilyRatioGroup } from "./types";
import { TND_RATIO_TURNS_MAP } from "../domain/tnd-element";

/**
 * All symmetric ratio variants of one family, derived from the zero-turn base
 * catalog at render time (no materialized decks). Each ratio applies a uniform
 * `turns|turns` pattern to every base sequence.
 */
export async function aggregateFamilySequences(
  familyId: string,
  catalogs: Catalog[],
): Promise<FamilyRatioGroup[]> {
  const base = catalogs.find((c) => c.id === TND_BASE_CATALOG_ID);
  if (!base) return [];
  const family = base.families.find((f) => f.id === familyId);
  if (!family || family.sequenceIds.length === 0) return [];

  const baseSeqs = await loadSequencesByIds(base.id, family.sequenceIds as string[]);
  const edges = await loadDiamondEdges();

  const groups: FamilyRatioGroup[] = [];
  for (const [ratio, turns] of Object.entries(TND_RATIO_TURNS_MAP)) {
    const pattern = `${turns}|${turns}`;
    const sequences = baseSeqs.map(
      (s) => applyVariationDescriptor(s, { turnPattern: pattern }, edges).sequence,
    );
    groups.push({ ratio, turns, sequences });
  }
  return groups.sort((a, b) => a.turns - b.turns);
}
```

- [ ] **Step 2: Verify at runtime**

Open the catalog browser TnD family drill-down. Confirm all 7 symmetric ratios (0–3 turns) render from the base, matching the prior materialized-deck output visually.
Expected: 7 ratio groups, ascending turns; renders match.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/services/tnd-family-aggregator.ts
git commit -m "feat(tnd): family aggregator derives ratios from base at render time"
```

---

### Task 19: Full-project gate

**Files:** none (verification only).

- [ ] **Step 1: One full typecheck**

Run: `npm run check > /tmp/check-deckvar.log 2>&1; grep -niE "error" /tmp/check-deckvar.log | grep -iE "deck-variation|deck-composer|deck-releaser|tnd-family-aggregator|ConfigureStep|ReviewStep|content-hasher" | head`
Expected: no errors in the files this plan touched. Fix any that appear, re-run once.

- [ ] **Step 2: Full unit suite for touched modules**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts src/lib/shared/foundation/services/__tests__/content-hasher-variant.test.ts`
Expected: all PASS.

- [ ] **Step 3: Commit (only if fixes were needed)**

```bash
git add -A
git commit -m "fix(deck): resolve typecheck findings for variation integration"
```

---

# PHASE 5 — Teardown (DESTRUCTIVE — explicit confirmation required)

**STOP GATE:** This phase deletes ~58 TnD decks (6 symmetric + 10 named-pattern reversal + 42 asymmetric) and their ~900 sequence documents from production Firestore, plus two seed scripts. Phases 1–4 leave these orphaned-but-harmless. **Do NOT run any deletion until Austen explicitly confirms in the current conversation.** Per `.claude/rules` and global git/destructive safety: dry-run and list first, get sign-off, then delete.

### Task 20: Dry-run inventory of teardown targets

**Files:**
- Create: `scripts/teardown-tnd-materialized-decks.cjs`

- [ ] **Step 1: Write the inventory script (dry-run default)**

Create `scripts/teardown-tnd-materialized-decks.cjs`. Mirror the firebase-admin initialization used by `scripts/seed-vtg-turn-decks.cjs` (same service-account/env setup — read that script's top for the exact init and the `decks` collection path). The script must default to a DRY RUN that only lists, and require `--apply` to delete:

```js
// Usage:
//   node scripts/teardown-tnd-materialized-decks.cjs           # dry run: list only
//   node scripts/teardown-tnd-materialized-decks.cjs --apply   # delete (after sign-off)
//
// Deletes TnD decks that became redundant once turns are applied at render time:
//   - asymmetric === true            (42 blue|red enumerations)
//   - symmetric turn variants        (turnPattern uniform with turns > 0)
//   - named-pattern reversal variants (reversalPattern set, on a vtg base id)
// PRESERVES: l1-vtg-motions (the zero-turn base — canonical source of truth).

const admin = require("firebase-admin");
// ... init exactly as scripts/seed-vtg-turn-decks.cjs does ...
const db = admin.firestore();

const BASE_ID = "l1-vtg-motions";
const APPLY = process.argv.includes("--apply");

async function main() {
  const snap = await db.collection("decks").get();
  const targets = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (doc.id === BASE_ID) return;
    if (d.collection !== "TnD") return;
    const isAsymmetric = d.asymmetric === true;
    const isSymmetricTurn =
      typeof d.turnPattern === "string" &&
      /^uniform[- ](\d+(?:\.\d+)?)t$/i.test(d.turnPattern) &&
      !/uniform[- ]0t/i.test(d.turnPattern);
    const isNamedReversal = !!d.reversalPattern && d.reversalPattern !== "";
    if (isAsymmetric || isSymmetricTurn || isNamedReversal) {
      targets.push(doc.id);
    }
  });

  console.log(`Found ${targets.length} teardown targets (BASE ${BASE_ID} preserved):`);
  for (const id of targets.sort()) console.log("  " + id);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --apply after sign-off.");
    return;
  }

  for (const id of targets) {
    const seqs = await db.collection("decks").doc(id).collection("sequences").get();
    const batchLimit = 450;
    let batch = db.batch();
    let n = 0;
    for (const s of seqs.docs) {
      batch.delete(s.ref);
      if (++n % batchLimit === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    await db.collection("decks").doc(id).delete();
    console.log(`Deleted ${id} (+${seqs.size} sequences)`);
  }
  console.log(`\nDeleted ${targets.length} decks.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run the DRY RUN and present the list to Austen**

Run: `node scripts/teardown-tnd-materialized-decks.cjs`
Expected: prints ~58 ids, `l1-vtg-motions` NOT among them. **Present this list to Austen and STOP. Do not proceed without explicit "yes, delete these" in the conversation.**

- [ ] **Step 3: Commit the script (not the deletion)**

```bash
git add scripts/teardown-tnd-materialized-decks.cjs
git commit -m "chore(tnd): add gated teardown inventory script (dry-run default)"
```

---

### Task 21: Execute teardown (ONLY after explicit confirmation)

**Files:**
- Delete: `scripts/seed-vtg-asymmetric-decks.cjs`, `scripts/seed-vtg-turn-decks.cjs`

- [ ] **Step 1: Confirm the gate**

Verify Austen has explicitly approved the exact dry-run list from Task 20 Step 2 in the current conversation. If not, STOP.

- [ ] **Step 2: Run the deletion**

Run: `node scripts/teardown-tnd-materialized-decks.cjs --apply`
Expected: deletes each listed deck + its sequences; `l1-vtg-motions` untouched.

- [ ] **Step 3: Verify the base survived + targets gone**

Run: `node scripts/teardown-tnd-materialized-decks.cjs` (dry run again)
Expected: `Found 0 teardown targets` and base preserved.

- [ ] **Step 4: Remove the obsolete seed scripts**

```bash
git rm scripts/seed-vtg-asymmetric-decks.cjs scripts/seed-vtg-turn-decks.cjs
```

- [ ] **Step 5: Verify nothing references the deleted scripts/decks**

Grep `seed-vtg-asymmetric-decks|seed-vtg-turn-decks` and `asymmetric` across `src/` + `scripts/` + `package.json`. Confirm no live consumer breaks (the `Catalog.asymmetric` field stays in the model, harmlessly unused).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(tnd): teardown materialized turn/asymmetric decks; remove seed scripts"
```

---

## Self-Review

**Spec coverage:**
- §1 shared descriptor → Task 1. ✓
- §2 engine split (`rollVariation` / `applyVariationDescriptor` / wrapper) → Tasks 2, 3, 4. ✓ (turn-only path tested in Task 3.)
- §3 seam rewrite (positional + per-card apply + dedup load) → Tasks 5 (pure helper) + 7 (component). ✓
- §4 cache key folds descriptor → Task 6 (already satisfied by `hashSequenceContent`; regression test locks it). ✓
- §5 compose split → Task 10 (LOOP roll) + Task 16 (TnD cartesian). ✓
- §6 TnD composer (base-only families, TURN_VALUES² options, cartesian) → Tasks 14, 15, 16. ✓
- §7 counts on buttons → Task 15 (draw/cell) + Task 17 (family). ✓
- §8 browser aggregator unify → Task 18. ✓
- §9 LOOP variation UI → Tasks 11, 12. ✓
- §10 closure flag → Task 13. ✓
- §"Other render paths" → Task 8. ✓
- §Sequencing phases 1–5 → mapped 1:1. ✓ Teardown gated → Tasks 20–21. ✓

**Type consistency:**
- `CardVariation` (Task 1) used identically in `rollVariation` (2), `applyVariationDescriptor` (3), `resolveDeckSequences` (5), `buildTnDCards` (16), seam (7), aggregator (18). ✓
- `ResolvedDeckSequence { sequence, turnLoopClosed }` (Task 5) consumed in seam (7) → `rs.brokenLoopCount`. ✓
- `getTnDTurnPatternOptions(selectedFamilyBaseSeqs: number)` signature changed (15) and the only call site updated in the same task. ✓
- `TND_BASE_CATALOG_ID` defined in Task 14, reused in Task 18. ✓
- `applyVariationDescriptor` return `{ sequence, turnLoopClosed }` used consistently (seam, swap, aggregator take `.sequence`). ✓

**Placeholder scan:** Every code step shows complete code; commands have expected output. Task 11 Step 5 is an explicit "verified in Task 12" note (the controls are inert until props are wired) — not a placeholder, a sequencing fact. ✓

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-29-deck-variation-and-tnd-parameter-model.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
