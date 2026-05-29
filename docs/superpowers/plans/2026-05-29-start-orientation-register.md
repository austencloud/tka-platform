# Start-Orientation Register Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deck-wide **start-orientation register** (radial / nonradial / split) as a third axis on the existing `CardVariation` descriptor, re-seeded and re-propagated at the one render seam — multiplying the visible catalog ×3 with zero re-enumeration and zero new rendering work.

**Architecture:** One new optional field `startOriMode` on `CardVariation`. `applyVariationDescriptor` gains a re-seed step that runs FIRST: it clone-safely rewrites the start position's per-hand orientations to the register's pair, then calls `recalculateAllOrientations` to propagate the new seed through every step. Reversal and turns (if present) then re-propagate from that seed. A single deck-wide selector in `ConfigureStep`'s shared controls stamps the chosen register onto every card. rail/cross (interradial) stay deferred — no arrow assets exist.

**Tech Stack:** SvelteKit, Svelte 5 runes, TypeScript, Vitest 4 (`vitest --config tests/config/vitest.config.ts`).

---

## Verified facts this plan relies on (do not re-derive)

- `CardVariation` interface lives in `src/lib/features/choreo-card/domain/models/DeckRelease.ts` (NOT in `deck-variation.ts`).
- `applyVariationDescriptor` is at `src/lib/features/choreo-card/services/deck-variation.ts:212`. Current order: reversal (`transformSequence`) → turns (`applyPattern`). It aliases `let working = seq` and relies on those two helpers returning NEW objects.
- `recalculateAllOrientations(sequence)` — `src/lib/shared/create/services/orientation-propagation.ts:72`. Seeds each hand from `sequence.startPosition.motions[BLUE|RED].endOrientation`, propagates forward. **Returns the sequence UNCHANGED if `sequence.startPosition` is absent.** Fully immutable (uses `updateSequenceData` + new step objects).
- `propagateOrientationsForColor` (same file, `:23`) is immutable — `[...steps]`, new step/motion objects. Confirmed: re-seeding via a new `startPosition` + `recalculateAllOrientations` does NOT mutate the input sequence.
- `Orientation` is a const-enum-style object in `src/lib/shared/pictograph/shared/domain/enums/pictograph-enums.ts`: `IN: "in"`, `OUT: "out"`, `CLOCK: "clock"`, `COUNTER: "counter"`.
- `MotionColor` enum (`BLUE = "blue"`, `RED = "red"`) — used as `startPosition.motions[MotionColor.BLUE]`.
- `createMotionData(data: Partial<MotionData> = {})` — `src/lib/shared/pictograph/shared/domain/models/MotionData.ts:108`. `updateSequenceData(seq, patch)` — `SequenceData.ts:293`.
- `StartPositionData` (`startPosition?` on `SequenceData`, optional) extends `PictographData`; carries `.motions.blue` / `.motions.red` (`MotionData` with `startOrientation`/`endOrientation`).
- The render seam already routes every path through `resolveDeckSequences` → `applyVariationDescriptor`. **`resolveDeckSequences` reuses ONE base `SequenceData` across many cards (TnD).** Any mutation of that base poisons sibling cards + the content-hash render cache. Clone-safety is mandatory.
- Closure guarantee (MCP orientation-algebra, verified): every orientation op is a rotation on the 8-cycle; net transform is a pure translation that fixes a point iff identity → returns-home-from-`in` ⟹ returns-home-from-every-orientation, per hand. Register changes never break closure. No feasibility gate needed.

## Two corrections to the spec (baked into this plan)

1. **Register-only must propagate explicitly.** The spec's pipeline leans on reversal/turns to call `recalculateAllOrientations`. A plain nonradial/split deck (no reversal, no turn) has neither, so the re-seed step itself MUST call `recalculateAllOrientations`. (Task 2.)
2. **Clone-safety.** Re-seed builds a NEW `startPosition` with NEW motion objects via `createMotionData`; it never mutates `seq.startPosition`. (Task 2.)

Also: store `startOriMode` only (resolve the per-hand pair in the cook) — no parallel stored pair field, no `Catalog` metadata duplication. The pair is trivially derivable; a future raw-pair / rail / cross need is a non-breaking optional add.

---

## File Structure

**Modify:**
- `src/lib/features/choreo-card/domain/models/DeckRelease.ts` — add `startOriMode?` to `CardVariation`.
- `src/lib/features/choreo-card/services/deck-variation.ts` — `StartOriMode` type, `resolveStartOrientation`, re-seed step in `applyVariationDescriptor`.
- `src/lib/features/choreo-card/services/deck-composer.ts` — `buildTnDCards` stamps `startOriMode` onto each card.
- `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts` — `startOriMode` deck-wide state + persistence.
- `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` — stamp register in `composeFullDeck` (LOOP), pass to `buildTnDCards` (TnD), wire selector prop.
- `src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte` — register selector in the SHARED controls (mode-independent).

**Test:**
- `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts` — extend with register tests.

**Inner-loop checking:** start `npm run check:watch` once in the background. One full `npm run check` per phase gate. Never `npm run build` in the loop.

**Git safety (multi-agent tree):** stage ONLY the files you edited, by explicit path; commit with an explicit pathspec (`git commit -m "..." -- <paths>`). Never `git add -A`/`.`/`-u`, never a bare `git commit`. Other sessions' WIP is in the tree — do not touch it.

---

# PHASE A — Descriptor + Cook

### Task 1: Add `startOriMode` to the descriptor + `resolveStartOrientation`

**Files:**
- Modify: `src/lib/features/choreo-card/domain/models/DeckRelease.ts` (the `CardVariation` interface)
- Modify: `src/lib/features/choreo-card/services/deck-variation.ts`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`

- [ ] **Step 1: Add the descriptor field**

In `DeckRelease.ts`, inside `interface CardVariation` (after the `turnLabel?` field), add:

```ts
  /** Start-orientation register, deck-wide. Absent / "radial" → canonical in|in. */
  startOriMode?: "radial" | "nonradial" | "split";
```

- [ ] **Step 2: Write the failing test for `resolveStartOrientation`**

Append to `deck-variation.test.ts`:

```ts
import { resolveStartOrientation, type StartOriMode } from "../deck-variation";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("resolveStartOrientation", () => {
  it("maps each register to its per-hand orientation pair", () => {
    expect(resolveStartOrientation("radial")).toEqual({ blue: Orientation.IN, red: Orientation.IN });
    expect(resolveStartOrientation("nonradial")).toEqual({ blue: Orientation.COUNTER, red: Orientation.COUNTER });
    expect(resolveStartOrientation("split")).toEqual({ blue: Orientation.IN, red: Orientation.COUNTER });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: FAIL — `resolveStartOrientation` / `StartOriMode` not exported.

- [ ] **Step 4: Implement the type + resolver**

In `deck-variation.ts`, add the `Orientation` import to the existing pictograph imports near the top (group with the other `$lib/shared/pictograph` imports):

```ts
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
```

Then add, directly above `applyVariationDescriptor` (`:207`, above its doc comment):

```ts
export type StartOriMode = "radial" | "nonradial" | "split";

/** Resolve a register to its per-hand start-orientation pair (rendering seed). */
export function resolveStartOrientation(mode: StartOriMode): { blue: Orientation; red: Orientation } {
  switch (mode) {
    case "nonradial":
      return { blue: Orientation.COUNTER, red: Orientation.COUNTER };
    case "split":
      return { blue: Orientation.IN, red: Orientation.COUNTER };
    case "radial":
    default:
      return { blue: Orientation.IN, red: Orientation.IN };
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: PASS (existing 10 + new = 11).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/domain/models/DeckRelease.ts src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
git commit -m "feat(deck): startOriMode register field + resolveStartOrientation" -- src/lib/features/choreo-card/domain/models/DeckRelease.ts src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
```

---

### Task 2: Re-seed + propagate step in `applyVariationDescriptor` (clone-safe, runs first)

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-variation.ts:212-259`
- Test: `src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`

The re-seed builds a NEW `startPosition` (never mutates the input), then calls `recalculateAllOrientations` so register-only decks (no reversal, no turn) propagate. It runs BEFORE reversal and turns so both re-propagate from the new seed.

- [ ] **Step 1: Write the failing tests**

Append to `deck-variation.test.ts`. These extend the existing `twoStepSeq()` helper (already in this file) with a start position carrying canonical `in` orientations, then assert a register re-seeds + propagates and does NOT mutate the base.

```ts
import { Orientation as Ori } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** twoStepSeq() plus a start position (required for orientation propagation). */
function seqWithStart() {
  const base = twoStepSeq();
  const startMotion = () =>
    createMotionData({
      motionType: "static", rotationDirection: "cw",
      startLocation: "n", endLocation: "n", turns: 0,
      startOrientation: Ori.IN, endOrientation: Ori.IN,
    });
  return {
    ...base,
    startPosition: {
      isStartPosition: true as const,
      id: "SP",
      startPos: "alpha", endPos: "alpha",
      letter: null, gridMode: "diamond",
      motions: { blue: startMotion(), red: startMotion() },
    } as unknown as NonNullable<SequenceData["startPosition"]>,
  } as SequenceData;
}

describe("applyVariationDescriptor — startOriMode", () => {
  it("register-only (no turn/reversal) re-seeds AND propagates to every step", () => {
    const seq = seqWithStart();
    const { sequence } = applyVariationDescriptor(seq, { startOriMode: "nonradial" }, []);
    // start position re-seeded
    expect(sequence.startPosition!.motions.blue!.endOrientation).toBe(Ori.COUNTER);
    expect(sequence.startPosition!.motions.red!.endOrientation).toBe(Ori.COUNTER);
    // step 1 propagated from the new seed (NOT canonical "in")
    expect(sequence.steps[0]!.motions!.blue!.startOrientation).toBe(Ori.COUNTER);
  });

  it("does NOT mutate the input base sequence (shared across cards)", () => {
    const seq = seqWithStart();
    applyVariationDescriptor(seq, { startOriMode: "nonradial" }, []);
    expect(seq.startPosition!.motions.blue!.endOrientation).toBe(Ori.IN); // untouched
    expect(seq.steps[0]!.motions!.blue!.startOrientation).toBe(Ori.IN);   // untouched
  });

  it("radial / absent register is a no-op passthrough", () => {
    const seq = seqWithStart();
    const a = applyVariationDescriptor(seq, { startOriMode: "radial" }, []);
    expect(a.sequence.steps[0]!.motions!.blue!.startOrientation).toBe(Ori.IN);
    const b = applyVariationDescriptor(seq, {}, []);
    expect(b.sequence).toBe(seq); // no descriptor at all → same object
  });

  it("split re-seeds blue radial, red nonradial", () => {
    const { sequence } = applyVariationDescriptor(seqWithStart(), { startOriMode: "split" }, []);
    expect(sequence.startPosition!.motions.blue!.endOrientation).toBe(Ori.IN);
    expect(sequence.startPosition!.motions.red!.endOrientation).toBe(Ori.COUNTER);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: FAIL — `applyVariationDescriptor` ignores `startOriMode`; the propagation + no-mutation assertions fail.

- [ ] **Step 3: Add imports + the re-seed helper**

In `deck-variation.ts`, add to the imports (group with the `$lib/shared/create` / pictograph imports):

```ts
import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
```

(If `createMotionData` is already imported in this file, do not duplicate it.)

Add this helper directly below `resolveStartOrientation` (from Task 1):

```ts
/**
 * Clone-safely re-seed a sequence's start-position orientations to `mode`'s pair,
 * then propagate forward. Returns the input UNCHANGED when mode is radial/undefined
 * or the sequence has no start position. NEVER mutates `seq` (it is shared across
 * cards at the render seam).
 */
function applyStartOriMode(seq: SequenceData, mode: StartOriMode | undefined): SequenceData {
  if (!mode || mode === "radial") return seq;
  const sp = seq.startPosition;
  if (!sp) return seq; // nothing to seed from → propagation would no-op anyway
  const pair = resolveStartOrientation(mode);
  const reseed = (m: typeof sp.motions.blue, o: Orientation) =>
    m ? createMotionData({ ...m, startOrientation: o, endOrientation: o }) : m;
  const newStart = {
    ...sp,
    motions: {
      ...sp.motions,
      [MotionColor.BLUE]: reseed(sp.motions[MotionColor.BLUE], pair.blue),
      [MotionColor.RED]: reseed(sp.motions[MotionColor.RED], pair.red),
    },
  };
  const seeded = updateSequenceData(seq, { startPosition: newStart });
  return recalculateAllOrientations(seeded);
}
```

Add the `updateSequenceData` import if not already present:

```ts
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
```

- [ ] **Step 4: Run the re-seed FIRST in `applyVariationDescriptor`**

In `applyVariationDescriptor`, replace the opening line `let working = seq;` (`:217`) with:

```ts
  let working = applyStartOriMode(seq, variation.startOriMode);
```

Leave the reversal and turns blocks exactly as they are — they will now re-propagate from the re-seeded start position. (Note: the existing `return { sequence: working, turnLoopClosed }` still holds; for register-only, `working` is the re-seeded+propagated sequence and `turnLoopClosed` stays `true`.)

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts`
Expected: PASS (all register tests + the prior suite).

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
git commit -m "feat(deck): re-seed start orientation first in applyVariationDescriptor (clone-safe, propagates)" -- src/lib/features/choreo-card/services/deck-variation.ts src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts
```

---

# PHASE B — Wire register into compose (deck-wide)

### Task 3: `startOriMode` deck-wide state + persistence

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts`

- [ ] **Step 1: Import the type**

Add to the existing `deck-variation` import line (which already imports `DEFAULT_VARIATION_CONFIG, type VariationConfig`):

```ts
import { DEFAULT_VARIATION_CONFIG, type VariationConfig, type StartOriMode } from "../../services/deck-variation";
```

- [ ] **Step 2: Add the state field**

Immediately after the existing `variationConfig = $state<VariationConfig>({ ...DEFAULT_VARIATION_CONFIG });` line, add:

```ts
  startOriMode = $state<StartOriMode>("radial");
```

- [ ] **Step 3: Persist it**

In `interface PersistedSession`, after `variationConfig?: VariationConfig;`, add:

```ts
  startOriMode?: StartOriMode;
```

In `persist()`'s `saveSession({...})` object, after `variationConfig: this.variationConfig,`, add:

```ts
      startOriMode: this.startOriMode,
```

In the constructor restore block (`if (saved) {...}`), after `if (saved.variationConfig) this.variationConfig = saved.variationConfig;`, add:

```ts
      if (saved.startOriMode) this.startOriMode = saved.startOriMode;
```

(Leave `startOriMode` intact across `reset()` — it's a user preference, like `variationConfig`.)

- [ ] **Step 4: Verify compile + commit**

Confirm `check:watch` clean for the file.

```bash
git add src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts
git commit -m "feat(deck): deck-wide startOriMode releaser state + persistence" -- src/lib/features/choreo-card/components/deck-releaser/deck-releaser-state.svelte.ts
```

---

### Task 4: Stamp register onto every card (LOOP compose + TnD cartesian)

**Files:**
- Modify: `src/lib/features/choreo-card/services/deck-composer.ts` (`buildTnDCards`)
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte` (`composeFullDeck`)
- Test: `src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`

Register is deck-wide and single-valued — it is NOT a cartesian multiplier (the TnD count is unchanged). Every card gets the same `startOriMode`.

- [ ] **Step 1: Write the failing test for `buildTnDCards`**

Append to `deck-composer-tnd.test.ts`:

```ts
describe("buildTnDCards — startOriMode", () => {
  it("stamps the deck-wide register onto every card's variation", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    const cards = buildTnDCards(families, new Set(["tog-same"]), new Set(["1|1"]), "nonradial");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.variation?.startOriMode === "nonradial")).toBe(true);
    expect(cards.every((c) => c.variation?.turnPattern === "1|1")).toBe(true);
  });

  it("omits startOriMode when register is radial (default)", () => {
    const families = getTnDFamilyOptions([baseCatalog()]);
    const cards = buildTnDCards(families, new Set(["tog-same"]), new Set(["1|1"]), "radial");
    expect(cards.every((c) => c.variation?.startOriMode === undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: FAIL — `buildTnDCards` has no 4th param and emits no `startOriMode`.

- [ ] **Step 3: Add the param to `buildTnDCards`**

In `deck-composer.ts`, add the import for the type at the top (group with other imports):

```ts
import type { StartOriMode } from "./deck-variation";
```

Change the `buildTnDCards` signature and the emitted `variation` object. Replace the function (current cartesian version) with:

```ts
export function buildTnDCards(
  tndFamilies: TnDFamilyOption[],
  selectedFamilies: Set<string>,
  selectedTurnPatterns?: Set<string>,
  startOriMode: StartOriMode = "radial",
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
          variation: {
            turnPattern: pattern,
            turnLabel: pattern,
            ...(startOriMode !== "radial" ? { startOriMode } : {}),
          },
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
Expected: PASS (5 prior TnD + 2 new). The existing `tndCardCount` test still passes (count unchanged by register).

- [ ] **Step 5: Stamp register in `composeFullDeck` (both branches)**

In `DeckReleaserTab.svelte`, replace `composeFullDeck` with (the LOOP branch merges register into each card's variation alongside any rolled reversal/turn; the TnD branch passes `rs.startOriMode` through):

```ts
  function composeFullDeck() {
    if (rs.deckMode === 'tnd') {
      const tndCards = buildTnDCards(rs.tndFamilies, rs.selectedTnDFamilies, rs.selectedTnDTurnPatterns, rs.startOriMode);
      return tndCards.map((c, i) => ({ ...c, position: i + 1 }));
    }
    const cards = composeDeck(pool, rs.weights, rs.totalCards, { center: rs.notes });
    return cards.map((c) => {
      const rolled = rollVariation(c.stepCount, rs.variationConfig, Math.random);
      const variation = {
        ...(rolled ?? {}),
        ...(rs.startOriMode !== "radial" ? { startOriMode: rs.startOriMode } : {}),
      };
      return Object.keys(variation).length > 0 ? { ...c, variation } : c;
    });
  }
```

- [ ] **Step 6: Verify compile + commit**

Confirm `check:watch` clean.

```bash
git add src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck): stamp deck-wide startOriMode onto LOOP + TnD cards" -- src/lib/features/choreo-card/services/deck-composer.ts src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
```

---

# PHASE C — Register selector (shared controls)

### Task 5: Register selector in `ConfigureStep` shared controls

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte`

The selector is mode-independent → it lives in the shared `.controls` block (after "Edition Notes", before the `{#if deckMode === "loop"}`). Button + selected-state, single-select (NO checkboxes, NO dropdown — `.claude/rules/no-checkboxes.md`). Reuses the existing `.mode-row` / `.mode-btn` styles already in this file.

- [ ] **Step 1: Add the type import + props**

In the `<script>`, extend the `deck-variation` import:

```ts
  import {
    BOOK_PATTERNS,
    TURN_PATTERNS,
    type VariationConfig,
    type StartOriMode,
  } from "../../services/deck-variation";
```

Add to the `Props` interface (after `onVariationConfigChange`):

```ts
    startOriMode: StartOriMode;
    onStartOriModeChange: (mode: StartOriMode) => void;
```

Add to the destructured props (after `onVariationConfigChange,`):

```ts
    startOriMode,
    onStartOriModeChange,
```

- [ ] **Step 2: Add the register options constant**

After the `VARIATION_PRESETS` constant, add:

```ts
  const ORI_REGISTERS: { id: StartOriMode; label: string; icon: string }[] = [
    { id: "radial", label: "Radial", icon: "fa-arrows-up-down" },
    { id: "nonradial", label: "Nonradial", icon: "fa-arrows-left-right" },
    { id: "split", label: "Split", icon: "fa-arrows-turn-right" },
  ];
```

- [ ] **Step 3: Add the markup (shared controls)**

Immediately after the "Edition Notes" `control-group` (the one containing `id="edition-notes"`) and BEFORE the `{#if deckMode === "loop"}` line, add:

```svelte
    <div class="control-group">
      <span class="control-label">Start Orientation</span>
      <div class="mode-row">
        {#each ORI_REGISTERS as r (r.id)}
          <button
            type="button"
            class="mode-btn"
            class:selected={startOriMode === r.id}
            aria-pressed={startOriMode === r.id}
            onclick={() => onStartOriModeChange(r.id)}
          >
            <i class="fas {r.icon}" aria-hidden="true"></i>
            {r.label}
          </button>
        {/each}
      </div>
    </div>
```

- [ ] **Step 4: Verify compile + commit**

This compiles but is inert until Task 6 wires the prop. Confirm `check:watch` shows no error in `ConfigureStep.svelte`.

```bash
git add src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte
git commit -m "feat(deck): start-orientation register selector in shared controls" -- src/lib/features/choreo-card/components/deck-releaser/ConfigureStep.svelte
```

---

### Task 6: Wire the selector prop through `DeckReleaserTab`

**Files:**
- Modify: `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`

- [ ] **Step 1: Pass the props to `<ConfigureStep>`**

In the `<ConfigureStep ... />` invocation (after `onVariationConfigChange={...}`), add:

```svelte
        startOriMode={rs.startOriMode}
        onStartOriModeChange={(m) => { rs.startOriMode = m; }}
```

- [ ] **Step 2: Verify end-to-end at runtime**

Open the releaser at `localhost:5173`. In LOOP mode set Start Orientation = Nonradial, all variation frequencies 0 (Clean preset), draw. Then radial, draw. Compare: nonradial cards render props tangent vs radial along-radius. Switch to TnD mode, pick a family + a turn cell, set Nonradial, draw — confirm cards render nonradial and counts are unchanged from radial (register is not a multiplier).
Expected: register visibly changes start orientation in both modes; no console errors. Capture a screenshot or runtime confirmation per `.claude/rules/verification-protocol.md`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
git commit -m "feat(deck): wire start-orientation register into ConfigureStep" -- src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte
```

---

# PHASE D — Verify end-to-end

### Task 7: Phase gate + real-sequence propagation check

**Files:** none (verification only).

- [ ] **Step 1: Confirm base sequences carry `startPosition`**

`recalculateAllOrientations` no-ops without `startPosition`. Verify a real base sequence has one (so the register isn't a silent no-op in production). Run this one-off node check (read-only Firestore):

```bash
node -e '
const admin=require("firebase-admin");const path=require("path");
const sa=require(path.join(process.cwd(),"serviceAccountKey.json"));
if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(sa)});
const db=admin.firestore();
(async()=>{
  const seqs=await db.collection("decks").doc("l1-vtg-motions").collection("sequences").limit(1).get();
  const d=seqs.docs[0]?.data();
  console.log("has startPosition:", !!d?.startPosition, "| blue ori:", d?.startPosition?.motions?.blue?.endOrientation);
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
'
```
Expected: `has startPosition: true | blue ori: in`. If false, STOP — the loader must hydrate `startPosition` before the register can apply (flag to Austen; out of this plan's scope).

- [ ] **Step 2: One full typecheck**

Run: `npm run check > /tmp/check-startori.log 2>&1; grep -niE "error" /tmp/check-startori.log | grep -iE "deck-variation|deck-composer|deck-releaser|ConfigureStep" | head`
Expected: no errors in touched files. Fix any, re-run once.

- [ ] **Step 3: Full unit suite for touched modules**

Run: `npx vitest --config tests/config/vitest.config.ts run src/lib/features/choreo-card/services/__tests__/deck-variation.test.ts src/lib/features/choreo-card/services/__tests__/deck-composer-tnd.test.ts`
Expected: all PASS.

- [ ] **Step 4: Browser confirmation (per Task 6 Step 2)**

If not already done, capture the radial-vs-nonradial render difference in both modes. This is the AAA proof the axis ships correctly.

---

## Deferred (out of scope, do NOT build)

rail / cross (interradial registers). They need animation wiring (`angle-calculator.ts`) + `from_interradial` arrow SVGs + a three-way classifier in `arrow-path-resolver.ts`. No arrow assets exist. When instrumented, they add as two more `StartOriMode` values + `resolveStartOrientation` cases + selector entries — same mechanism, no new pipeline.

---

## Self-Review

**Spec coverage:**
- §Storage (derive at read) → Task 2 (re-seed at the seam; no re-enumeration). ✓
- §Descriptor schema → Task 1 (`startOriMode` only; pair resolved in cook — deliberate simplification of the spec's stored-pair, noted). ✓
- §Pipeline ordering (re-seed before reversal/turns) → Task 2 Step 4. ✓ Plus the spec-missing explicit `recalculateAllOrientations` for register-only (Task 2 Step 3) and clone-safety (Task 2 helper). ✓
- §Browse/picker UI → Tasks 5, 6 (button+toggle, no checkbox, shared controls). ✓
- §Render coverage (3 registers zero rendering work) → Task 7 Step 4 verifies. ✓
- §Scope items 1-4 → Tasks 1, 2, 5/6, 7. ✓
- §Deferred (rail/cross) → explicit Deferred section. ✓

**Placeholder scan:** every code step shows complete code; commands have expected output; no TBD/TODO. ✓

**Type consistency:** `StartOriMode = "radial"|"nonradial"|"split"` defined Task 1, imported identically in Tasks 3, 4, 5. `resolveStartOrientation` returns `{blue, red}` consumed only inside `applyStartOriMode` (Task 2). `buildTnDCards` 4th param `startOriMode: StartOriMode = "radial"` (Task 4) matches the call site `rs.startOriMode` (Task 4 Step 5). `startOriMode` descriptor field (Task 1) read in `applyVariationDescriptor` via `variation.startOriMode` (Task 2). `rs.startOriMode` state (Task 3) flows to selector (Task 6) and compose (Task 4). Consistent. ✓
