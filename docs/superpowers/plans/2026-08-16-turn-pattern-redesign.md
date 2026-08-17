# Turn Pattern Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move turn patterns out of the settings bento into an advanced drill under Customize, and rewrite the pattern editor so it reads as a plain-English sentence derived from each lane's own mask.

**Architecture:** A new pure module turns a lane's active-step mask into English. `StripBinding` gains an OPTIONAL `sentence` field; when a binding supplies it, `PatternStripEditor` renders sentence mode (Length + sentence + full-height strip) instead of the stacked Length/Rhythm/Amount/Result axes. Only the Turns binding opts in, so Reversals and Duration keep today's editor untouched. The bento reverts to `TurnIntensityCard` and three Turns-specific surfaces are deleted.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest. Existing primitives: `FilterChipBase` (`mode="dropdown"`), `SegmentedControl`, `SettingsDrillPanel`, `PatternStepStrip`.

**Spec:** `docs/superpowers/specs/2026-08-16-turn-pattern-redesign-design.md`

---

## Deviations from the spec (decided while planning, flag to Austen)

**1. No `never` field, and the empty phrase is "no steps" rather than "never".**
The spec proposed `sentence = { verb: string; never: string }` with an all-base lane
reading `never`. Both go. `Left turns 1 never` is not a sentence, and a separate
`never` template would have needed a second sentence shape — one whose amount and
rhythm chips have nowhere to live, stranding the user in the state they most need to
leave. `describeMask` returning `"no steps"` keeps ONE shape in every state
(`Left turns 1 on no steps`) with both chips reachable. The field is therefore
`sentence?: { verb: string }`.

**2. `card-configurator.ts` needs no change, despite its row in the spec's scope
table.** Verified against the file: its `turn-intensity` push already emits exactly
`currentIntensity` / `allowedValues` / `onIntensityChange` / `cardIndex` with
`gridColumnSpan: 3` — the props `TurnIntensityCard` takes. The pattern work only ever
touched the render branch in `CardBasedSettingsContainer.svelte`, never the
configurator. Task 9 reverts the render branch; there is nothing to revert here. Do
not edit this file looking for the change.

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/shared/create/domain/rhythm/pattern-sentence.ts` | **new** — pure: `boolean[]` mask → English phrase. No Svelte, no DOM. |
| `src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts` | **new** — unit tests for the above. |
| `card-configurator.ts` | **no change** — see Deviation 2. |
| `src/lib/shared/create/domain/rhythm/rhythm-catalog.ts` | `plainLabel` on `RhythmDef`; DURATION labels say step, not beat. |
| `src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts` | optional `sentence` on `StripBinding`. |
| `src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte` | sentence mode; hides Rhythm/Amount axes when active; strip fills height. |
| `src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte` | lane-label spill fix; opt-in `fill` for growing cells. |
| `src/lib/features/create/generate/components/modals/customize/TurnPatternSection.svelte` | **new** — composes `PatternStripEditor` + `LayerReadout` + a clear action. |
| `src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte` | Turn Pattern drill row + detail; orientation labels → Left/Right. |
| `src/lib/features/create/generate/components/cards/CustomizeCard.svelte` | forwards the new turn-pattern props into the overlay. |
| `src/lib/shared/create/state/panel-coordination-state.svelte.ts` | `CustomizeOverlayProps` gains turn-pattern fields; ALL Turns-overlay members deleted. |
| `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte` | renders `TurnIntensityCard` again; threads turn-pattern props into `CustomizeCard`. |
| deleted | `cards/TurnsCard.svelte`, `cards/TurnsExpandedOverlay.svelte`, `modals/TurnsDrawer.svelte` |

**Ownership statement (per `.claude/rules/primitive-discovery.md`):**
*Extending* `PatternStripEditor` with a sentence presentation — the behaviour owner
for period/rhythm/amount stamping stays `rhythm-mask.ts`, unchanged.
*Composing* `TurnPatternSection.svelte` from `PatternStripEditor` + `LayerReadout` +
`FilterChipBase`. No new capability, no new primitive.

---

### Task 1: Commit the two pending regression fixes

Two edits are sitting uncommitted in the working tree from the previous round. Land
them before the refactor so they cannot be lost in it.

**Files:**
- Modify: `src/lib/features/create/generate/components/modals/GenerationSettingsDrawer.svelte` (already edited — an accent `--drawer-handle-color` override was deleted, restoring the neutral default from `src/lib/shared/foundation/ui/drawer/Drawer.css:355`)
- Modify: `src/lib/features/create/generate/components/cards/TurnsCard.svelte` (already edited — the colour ramp reads `currentIntensity` only)

- [ ] **Step 1: Confirm only those two files carry the pending edits**

```bash
git status --short src/lib/features/create/generate/components/modals/GenerationSettingsDrawer.svelte src/lib/features/create/generate/components/cards/TurnsCard.svelte
```

Expected: two ` M ` lines and nothing else. If either is clean, the fix was already
committed — skip this task entirely.

- [ ] **Step 2: Commit with an explicit pathspec**

The git index is shared across sessions, so the pathspec is mandatory
(`.claude/rules/commit-only-your-own-changes.md`). Never `git add -A`.

```bash
git commit -m "fix(create): restore the neutral drawer handle and the turns colour ramp" -- src/lib/features/create/generate/components/modals/GenerationSettingsDrawer.svelte src/lib/features/create/generate/components/cards/TurnsCard.svelte
```

The handle fix affects the Customize and LOOP drawers too; its screenshot is taken
in Task 10's sweep, not here.

---

### Task 2: The mask-to-English module

**Files:**
- Create: `src/lib/shared/create/domain/rhythm/pattern-sentence.ts`
- Test: `src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeMask } from "../pattern-sentence";

describe("describeMask", () => {
  it("says every step when every step is active", () => {
    expect(describeMask([true])).toBe("every step");
    expect(describeMask([true, true])).toBe("every step");
    expect(describeMask([true, true, true, true])).toBe("every step");
  });

  it("says no steps when nothing is active", () => {
    expect(describeMask([false])).toBe("no steps");
    expect(describeMask([false, false, false])).toBe("no steps");
  });

  it("names a period of two in plain words", () => {
    expect(describeMask([true, false])).toBe("every other step");
  });

  it("says where an offset period of two starts", () => {
    expect(describeMask([false, true])).toBe(
      "every other step, starting on step 2"
    );
  });

  it("counts longer periods with an ordinal", () => {
    expect(describeMask([true, false, false, false])).toBe("every 4th step");
    expect(describeMask([true, false, false])).toBe("every 3rd step");
  });

  it("says where a longer offset period starts", () => {
    expect(describeMask([false, false, true, false])).toBe(
      "every 4th step, starting on step 3"
    );
  });

  it("lists the steps when the rhythm is irregular", () => {
    expect(describeMask([true, false, true, false, false, true])).toBe(
      "steps 1, 3 and 6"
    );
    expect(describeMask([true, true, false])).toBe("steps 1 and 2");
  });

  it("treats an empty mask as no steps", () => {
    expect(describeMask([])).toBe("no steps");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts
```

Expected: FAIL — `Failed to resolve import "../pattern-sentence"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/shared/create/domain/rhythm/pattern-sentence.ts`:

```ts
/**
 * Turns one hand's pattern into a sentence a first-time reader can follow.
 *
 * The old editor named figures ("Book", "Long Book", "Solo 1") borrowed from the
 * reversal-pattern vocabulary. Those are real TKA names, but nothing on screen
 * taught them, so a newcomer had no way in. Reading the phrase off the hand's own
 * steps instead means the control always says what it actually does, and a figure
 * with no name at all — anything hand-edited — still reads as a sentence.
 */

/** "3rd", "4th", "8th" — the ordinal for a repeat length. */
function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "1", "1 and 2", "1, 3 and 6". */
function joinSteps(steps: readonly number[]): string {
  if (steps.length === 1) return String(steps[0]);
  const head = steps.slice(0, -1).join(", ");
  return `${head} and ${steps[steps.length - 1]}`;
}

/**
 * `mask[i]` is true when step i does something (turns, reverses, holds).
 * The result slots into "<Hand> turns 1 on ___".
 */
export function describeMask(mask: readonly boolean[]): string {
  const active: number[] = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) active.push(i);

  if (active.length === 0) return "no steps";
  if (active.length === mask.length) return "every step";

  // A single active step in the period is a regular beat, however long the
  // period is: [✓ · · ·] is "every 4th step" and [· · ✓ ·] is the same beat
  // started later. Saying where it starts matters — two hands on the same
  // period but different offsets are trading off, not doubling up.
  if (active.length === 1) {
    const start = active[0]!;
    // "every 2nd step" is technically right and nobody says it.
    const every = mask.length === 2 ? "every other step" : `every ${ordinal(mask.length)} step`;
    return start === 0 ? every : `${every}, starting on step ${start + 1}`;
  }

  return `steps ${joinSteps(active.map((i) => i + 1))}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/domain/rhythm/pattern-sentence.ts src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts
git commit -m "feat(create): read a turn pattern's rhythm back as a sentence" -- src/lib/shared/create/domain/rhythm/pattern-sentence.ts src/lib/shared/create/domain/rhythm/__tests__/pattern-sentence.test.ts
```

---

### Task 3: Plain rhythm labels, and step not beat

**Files:**
- Modify: `src/lib/shared/create/domain/rhythm/rhythm-catalog.ts`

- [ ] **Step 1: Add `plainLabel` to the interface**

In `rhythm-catalog.ts`, inside `export interface RhythmDef`, add after `label`:

```ts
  /**
   * How the shortcut reads to someone who has never met the canonical name.
   * "Book" is real TKA vocabulary from the reversal patterns, and it teaches a
   * newcomer nothing about turns, so the sentence editor offers this instead
   * while `label` stays available where the canon is the point.
   */
  readonly plainLabel: string;
```

- [ ] **Step 2: Fill it in for every entry**

Replace the whole `PER_HAND_RHYTHMS` const with:

```ts
/** Per-hand catalog (Turns + Reversals). */
export const PER_HAND_RHYTHMS: readonly RhythmDef[] = [
  { id: "book", label: "Book", plainLabel: "Every step", sym: "P" },
  { id: "long-book", label: "Long Book", plainLabel: "Every other", sym: "P-" },
  { id: "alternating", label: "Alternating", plainLabel: "Trade off", sym: "RB" },
  { id: "red-book", label: "Red Book", plainLabel: "Right only", sym: "R" },
  { id: "blue-book", label: "Blue Book", plainLabel: "Left only", sym: "B" },
  // Solo family (canonical: choreo-card/domain/reversal-patterns.ts → solo-1).
  // One hand per step across an 8-step cycle; never both, never neither.
  { id: "solo-1", label: "Solo 1", plainLabel: "One at a time", sym: "RBBRBRRB", period: 8 },
];
```

Replace `CONTINUOUS` with:

```ts
/** The "no rhythm" entry — all steps continuous / inactive. */
export const CONTINUOUS: RhythmDef = {
  id: "continuous",
  label: "Continuous",
  plainLabel: "Continuous",
  sym: "-",
};
```

Replace `DURATION_RHYTHMS` with (this is the beat → step fix required by
`.claude/rules/tka-domain.md`; the app says step):

```ts
/** Single-lane accent catalog (Duration — which steps are held longer). */
export const DURATION_RHYTHMS: readonly RhythmDef[] = [
  { id: "every", label: "Every step", plainLabel: "Every step", sym: "P" },
  { id: "every-other", label: "Every other", plainLabel: "Every other", sym: "P-" },
  { id: "downbeat", label: "First step", plainLabel: "First step", sym: "P---" },
  { id: "last", label: "Last step", plainLabel: "Last step", sym: "---P" },
];
```

Finally, in the module docblock at the top of the file, change
`describing which hand (or, single-lane, which beat) is ACTIVE on each beat` to
`describing which hand (or, single-lane, which step) is ACTIVE on each step`, and
`Tiled to a period.` stays as is.

- [ ] **Step 3: Verify the types still compile**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "rhythm-catalog" || echo "no rhythm-catalog errors"
```

Expected: `no rhythm-catalog errors`. `plainLabel` is required, so any other file
constructing a `RhythmDef` literal would surface here; none do (the catalog is the
only producer).

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/create/domain/rhythm/rhythm-catalog.ts
git commit -m "feat(create): give each rhythm a plain name, and say step not beat" -- src/lib/shared/create/domain/rhythm/rhythm-catalog.ts
```

---

### Task 4: Fix the lane-label spill

`.pbs-label` is `width: 44px; flex: 0 0 44px` with bold 14px text and no overflow
handling, so "Right" and "Blue" run out of the box into the first cell. `.amt-lane`
in the editor carries the identical declaration. This is a defect fix and lands on
all three consumers.

**Files:**
- Modify: `src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte:119`
- Modify: `src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte:262-267`

- [ ] **Step 1: Widen and clamp the strip's lane label**

In `PatternStepStrip.svelte`, replace:

```css
  .pbs-label { width: 44px; flex: 0 0 44px; font-size: 14px; font-weight: 800; }
```

with:

```css
  /* Sized to the longest label ("Right") rather than to a round number of
     pixels. At 44px the bold text ran past its own box and collided with the
     first cell; ch tracks the font, and the clamp is the backstop for a lane
     name longer than the two this ships with. */
  .pbs-label {
    width: 5ch; flex: 0 0 5ch; min-width: 0;
    font-size: 14px; font-weight: 800;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
```

- [ ] **Step 2: Apply the same fix to the editor's amount label**

In `PatternStripEditor.svelte`, replace:

```css
  .amt-lane {
    width: 44px;
    flex: 0 0 44px;
    font-size: 13px;
    font-weight: 800;
  }
```

with:

```css
  /* Same fix as PatternStepStrip's .pbs-label: 44px was narrower than the bold
     text it held, so the name spilled onto the control beside it. */
  .amt-lane {
    width: 5ch;
    flex: 0 0 5ch;
    min-width: 0;
    font-size: 13px;
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
```

- [ ] **Step 3: Verify nothing else referenced the 44px basis**

```bash
grep -n "pbs-label\|amt-lane" -r src/lib | grep -v "PatternStepStrip.svelte\|PatternStripEditor.svelte"
```

Expected: matches only inside `PatternStripEditor.svelte`'s short-container
`@container` blocks (`.pbs-label { width: 2rem; flex-basis: 2rem }` and
`.amt-lane { width: 2rem; flex-basis: 2rem }`), which deliberately override the
base size on foldables. Leave those alone — they already ellipsis via the base rule.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte
git commit -m "fix(create): keep pattern lane labels inside their boxes" -- src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte
```

---

### Task 5: Let the strip grow into the height it is given

Sentence mode puts the strip in a full-height drill pane. `.pbs-cell` is a fixed
`height: 56px`, so without this the pane would strand its lower half — the exact
emptiness this redesign exists to remove. Opt-in, so the three existing consumers
are unaffected.

**Files:**
- Modify: `src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte`

- [ ] **Step 1: Add the `fill` prop**

In the `Props` interface, after `onEdit`, add:

```ts
    /** Grow the cells into the height the parent gives, instead of a fixed 56px
     *  row. For a full-height pane, where a fixed row would strand the space
     *  below it. */
    fill?: boolean;
```

and in the destructuring, change:

```ts
  let { lanes, cellKind, valueList = [], base, format, onEdit }: Props = $props();
```

to:

```ts
  let { lanes, cellKind, valueList = [], base, format, onEdit, fill = false }: Props = $props();
```

- [ ] **Step 2: Apply the class**

Change the root element from:

```svelte
<div class="pbs">
```

to:

```svelte
<div class="pbs" class:fill>
```

- [ ] **Step 3: Add the styles**

Append inside the `<style>` block, immediately after the `.pbs-cell` rule:

```css
  /* Fill mode: the lanes share the height instead of sitting at a fixed 56px.
     The min-height keeps a cell legible when the pane is short, at which point
     the parent scrolls rather than crushing it. */
  .pbs.fill { flex: 1; min-height: 0; }
  .pbs.fill .pbs-lane { flex: 1; min-height: 0; }
  .pbs.fill .pbs-cell { height: 100%; min-height: 56px; }
```

- [ ] **Step 4: Verify no consumer regressed**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "PatternStepStrip" || echo "no PatternStepStrip errors"
```

Expected: `no PatternStepStrip errors`. `fill` defaults to false, so
`PatternStripEditor`'s existing call site is unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte
git commit -m "feat(create): let the pattern strip fill a full-height pane" -- src/lib/shared/create/components/pattern-strip/PatternStepStrip.svelte
```

---

### Task 6: Sentence mode in the editor

**Files:**
- Modify: `src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts`
- Modify: `src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte`

- [ ] **Step 1: Add the optional `sentence` field**

In `pattern-strip-types.ts`, add to `StripBinding`, after `activeValue`:

```ts
  /**
   * Opts this binding into the sentence presentation: one line of English per
   * lane ("Left turns 1 on every other step") with the strip as the visible
   * result underneath, in place of the stacked Length / Rhythm / Amount axes.
   *
   * Optional on purpose. A binding without it renders exactly the editor that
   * shipped before, which is how Reversals and Duration stay untouched while
   * only Turns moves.
   */
  sentence?: {
    /** The verb after the hand: "turns", "reverses", "holds". */
    verb: string;
  };
```

- [ ] **Step 2: Wire the sentence into the editor's script**

In `PatternStripEditor.svelte`, add to the imports:

```ts
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
```

(already imported — confirm it is there, do not duplicate the line), and add:

```ts
  import { describeMask } from "$lib/shared/create/domain/rhythm/pattern-sentence";
```

Then after the `const reps = $derived(...)` line, add:

```ts
  // Sentence mode is a whole-editor presentation, so it stays out of the way of
  // the single-axis drill-downs, which already give one axis the whole screen.
  const sentenceMode = $derived(!!binding.sentence && visibleAxis === "all");

  /** Which slot's popover is open, as "amount-0" / "rhythm-1". */
  let openSlot = $state<string | null>(null);

  function laneMask(li: number): boolean[] {
    return (value[li] ?? []).map((v) => v !== binding.base);
  }

  /** What the amount chip reads. A hand-edited lane has no single amount. */
  function amountLabel(li: number): string {
    const a = laneAmount(li);
    if (a === null) return "mixed";
    return binding.format(a);
  }

  function toggleSlot(id: string) {
    openSlot = openSlot === id ? null : id;
  }
```

- [ ] **Step 3: Render the sentence, and hide the axes it replaces**

In the markup, change the class list on the root from:

```svelte
<div
  class="pse"
  class:fit-available-height={fitAvailableHeight}
  class:single-lane={binding.lanes === 1}
  class:solo-axis={visibleAxis !== "all"}
>
```

to:

```svelte
<div
  class="pse"
  class:fit-available-height={fitAvailableHeight}
  class:single-lane={binding.lanes === 1}
  class:solo-axis={visibleAxis !== "all"}
  class:sentence-mode={sentenceMode}
>
  {#if sentenceMode && binding.sentence}
    <div class="sentences">
      {#each binding.laneLabels as label, li}
        <p class="sentence">
          <span class="subject {binding.laneColors[li]}">{label}</span>
          <span class="prose">{binding.sentence.verb}</span>
          {#if binding.amountList}
            <FilterChipBase
              label={amountLabel(li)}
              mode="dropdown"
              size="sm"
              expanded={openSlot === `amount-${li}`}
              ariaLabel="{label} amount: {amountLabel(li)}"
              onclick={() => toggleSlot(`amount-${li}`)}
            >
              {#snippet children()}
                {#each binding.amountList ?? [] as a}
                  <button
                    class="popover-option"
                    type="button"
                    role="option"
                    aria-selected={String(laneAmount(li)) === String(a)}
                    class:selected={String(laneAmount(li)) === String(a)}
                    onclick={() => {
                      applyAmount(li, a);
                      openSlot = null;
                    }}>{binding.format(a)}</button
                  >
                {/each}
              {/snippet}
            </FilterChipBase>
          {/if}
          <span class="prose">on</span>
          <FilterChipBase
            label={describeMask(laneMask(li))}
            mode="dropdown"
            size="sm"
            expanded={openSlot === `rhythm-${li}`}
            ariaLabel="{label} rhythm: {describeMask(laneMask(li))}"
            onclick={() => toggleSlot(`rhythm-${li}`)}
          >
            {#snippet children()}
              {#each binding.rhythms as r}
                <button
                  class="popover-option"
                  type="button"
                  role="option"
                  aria-selected={rhythmActive(r)}
                  class:selected={rhythmActive(r)}
                  disabled={rhythmDisabled(r)}
                  onclick={() => {
                    applyRhythm(r);
                    openSlot = null;
                  }}>{r.plainLabel}</button
                >
              {/each}
            {/snippet}
          </FilterChipBase>
        </p>
      {/each}
    </div>
  {/if}
```

Then guard the two axes the sentence replaces. Change:

```svelte
  {#if visibleAxis === "all" || visibleAxis === "rhythm"}
```

to:

```svelte
  {#if !sentenceMode && (visibleAxis === "all" || visibleAxis === "rhythm")}
```

and change:

```svelte
  {#if binding.amountList && (visibleAxis === "all" || visibleAxis === "amount")}
```

to:

```svelte
  {#if binding.amountList && !sentenceMode && (visibleAxis === "all" || visibleAxis === "amount")}
```

Finally, pass `fill` to the strip in the Result axis. Change:

```svelte
      <PatternStepStrip
        lanes={stripLanes}
        cellKind={binding.cellKind ?? "number"}
        valueList={binding.valueList}
        base={binding.base}
        format={binding.format}
        onEdit={editCell}
      />
```

to:

```svelte
      <PatternStepStrip
        lanes={stripLanes}
        cellKind={binding.cellKind ?? "number"}
        valueList={binding.valueList}
        base={binding.base}
        format={binding.format}
        onEdit={editCell}
        fill={sentenceMode}
      />
```

- [ ] **Step 4: Style the sentence**

Append to `PatternStripEditor.svelte`'s `<style>` block, before the first
`@container` rule:

```css
  /* ─── Sentence mode ─── */

  /* The pane is full height and the sentence is short, so the strip takes the
     remainder rather than leaving it empty under a stack of controls. */
  .pse.sentence-mode {
    height: 100%;
    gap: 18px;
    margin: 0;
  }

  .pse.sentence-mode .result {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-top: 0;
  }

  .sentences {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Chips sit inline with the words, so the line has to wrap like prose and
     still keep its baseline when a chip is taller than the text. */
  .sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 15px;
    line-height: 1.4;
  }

  /* The colour says which prop; the word says which hand. Both are load-bearing
     for someone meeting this for the first time — the tint alone does not teach
     that blue is the left hand. */
  .subject {
    font-weight: 800;
    letter-spacing: 0.01em;
  }
  .subject.blue {
    color: var(--theme-blue, #6f9bff);
  }
  .subject.red {
    color: var(--theme-red, #ff7a8a);
  }
  .subject.accent {
    color: var(--theme-accent, #2dd4bf);
  }

  .prose {
    color: var(--theme-text-dim);
  }

  /* Matches the browse filter chips' own popover options, which is where this
     chip presentation comes from. */
  .popover-option {
    display: block;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 0 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text, white);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }
  .popover-option:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
  }
  .popover-option.selected {
    background: var(--theme-accent);
    color: #fff;
  }
  .popover-option:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
```

- [ ] **Step 5: Verify it compiles and the existing suites still pass**

```bash
npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create/domain/__tests__/loop-period-strip.test.ts src/lib/shared/create/domain/__tests__/layer-prediction.test.ts src/lib/shared/create/domain/__tests__/turn-pattern-level.test.ts
```

Expected: PASS, all suites. These cover the period arithmetic and layer prediction
sentence mode leaves untouched.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte
git commit -m "feat(create): let a pattern binding present itself as a sentence" -- src/lib/shared/create/components/pattern-strip/pattern-strip-types.ts src/lib/shared/create/components/pattern-strip/PatternStripEditor.svelte
```

---

### Task 7: The Turn Pattern section

Composes the sentence editor, the layer readout, and the clear action into the body
of a Customize drill row.

**Files:**
- Create: `src/lib/features/create/generate/components/modals/customize/TurnPatternSection.svelte`

- [ ] **Step 1: Write the component**

```svelte
<!--
  TurnPatternSection.svelte

  The turn-pattern editor, as one screen of the Customize drill.

  A pattern REPLACES turn intensity rather than sitting beside it — the builder
  reads `options.turnPattern ? patternSource(...) : allocationSource(...)`, so the
  two can never both be in force. That is why this lives under Customize as an
  override you go looking for, and why turn intensity keeps its card in the
  settings grid untouched.
-->
<script lang="ts">
  import PatternStripEditor from "$lib/shared/create/components/pattern-strip/PatternStripEditor.svelte";
  import LayerReadout from "../../cards/LayerReadout.svelte";
  import { PER_HAND_RHYTHMS } from "$lib/shared/create/domain/rhythm/rhythm-catalog";
  import type {
    StripBinding,
    StripValue,
  } from "$lib/shared/create/components/pattern-strip/pattern-strip-types";
  import { getTurnPool } from "@tka/sequence-engine/generation";
  import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
  import { predictLayerSignature } from "$lib/shared/create/domain/layer-prediction";

  let {
    turnPattern,
    level,
    turnIntensity,
    blueStartOrientation,
    redStartOrientation,
    sequenceLength,
    loopPeriod,
    onTurnPatternChange,
  }: {
    turnPattern: { blue: TurnValue[]; red: TurnValue[] } | null;
    level: number;
    turnIntensity: number;
    blueStartOrientation: string;
    redStartOrientation: string;
    sequenceLength: number;
    loopPeriod?: number;
    onTurnPatternChange: (
      lanes: { blue: TurnValue[]; red: TurnValue[] } | null
    ) => void;
  } = $props();

  // Local copy: the overlay's props are a snapshot taken when it opened, so every
  // edit is reported upward as it happens rather than on a save press.
  let lanes = $state<StripValue[][]>(
    turnPattern ? [[...turnPattern.blue], [...turnPattern.red]] : [[1, 0], [0, 1]]
  );

  // The strip may only offer values this level actually has. getTurnPool owns
  // that answer, so a half turn cannot be drawn into a level 2 sequence just
  // because it sits under the intensity ceiling.
  const turnValues = $derived(
    getTurnPool(level, turnIntensity, { allowFloat: level >= 3 }) as StripValue[]
  );

  const binding = $derived<StripBinding>({
    lanes: 2,
    rhythms: PER_HAND_RHYTHMS,
    valueList: turnValues,
    amountList: turnValues.filter(
      (v): v is number => typeof v === "number" && v > 0
    ),
    base: 0,
    format: (v) => (v === "fl" ? "fl" : String(v)),
    laneColors: ["blue", "red"],
    // Blue is the left hand and red the right. The colour identifies the prop;
    // the word teaches which hand it is, which the tint alone cannot do. Matches
    // the APPLY TO / HandSelector convention used across the Actions panel.
    laneLabels: ["Left", "Right"],
    sentence: { verb: "turns" },
  });

  // Periods offered by the editor are divisors of whatever length it is given, so
  // handing it the LOOP's seed block IS the whole LOOP restriction: turns repeat
  // in lockstep with the shape rather than drifting across it.
  const stripLength = $derived(loopPeriod ?? sequenceLength);

  // StripValue also admits booleans, for strips whose cells are toggles. This
  // strip's cells are turn values, so anything else is dropped rather than cast,
  // which would hand the engine a boolean where it expects a turn.
  function toTurnLane(lane: StripValue[]): TurnValue[] {
    return lane.filter(
      (v): v is TurnValue => typeof v === "number" || v === "fl"
    );
  }

  const prediction = $derived(
    predictLayerSignature({
      blueStartOrientation,
      redStartOrientation,
      lanes: { blue: toTurnLane(lanes[0] ?? []), red: toTurnLane(lanes[1] ?? []) },
      length: sequenceLength,
    })
  );

  // Below level 3 there are no half turns and only radial starts, so every step
  // reads as layer 1 and the signature says nothing worth showing.
  const showReadout = $derived(level >= 3);

  function handleStripChange(next: StripValue[][]) {
    lanes = next;
    onTurnPatternChange({
      blue: toTurnLane(next[0] ?? []),
      red: toTurnLane(next[1] ?? []),
    });
  }

  // null, not undefined: updateConfig strips undefined by design, so null is the
  // sentinel that actually clears the field and hands the turns back to intensity.
  function clearPattern() {
    onTurnPatternChange(null);
  }
</script>

<div class="turn-pattern-section">
  <p class="intro">
    Set exactly how much each hand turns. The generator only picks letters that
    can carry the figure.
  </p>

  <PatternStripEditor
    {binding}
    sequenceLength={stripLength}
    value={lanes}
    onChange={handleStripChange}
  />

  <div class="footer">
    {#if showReadout}
      <LayerReadout
        signature={prediction.signature}
        uncertain={prediction.uncertain}
      />
    {/if}
    <button class="clear-button" onclick={clearPattern}>
      Use random turns instead
    </button>
  </div>
</div>

<style>
  .turn-pattern-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    min-height: 0;
  }

  .intro {
    flex: 0 0 auto;
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    line-height: 1.45;
    color: var(--theme-text-dim);
  }

  /* The editor owns the middle and grows; this row is pinned under it. */
  .turn-pattern-section :global(.pse) {
    flex: 1;
    min-height: 0;
  }

  .footer {
    flex: 0 0 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  /* A real button, not a text link — it is a standalone action, and the one way
     back to letting the generator roll its own turns. */
  .clear-button {
    min-height: var(--min-touch-target, 44px);
    padding: 0 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    border-radius: 8px;
    color: var(--theme-text, white);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .clear-button:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.15));
  }

  .clear-button:focus-visible {
    outline: 2px solid var(--customize-accent);
    outline-offset: 2px;
  }
</style>
```

- [ ] **Step 2: Verify it type-checks in isolation**

```bash
npx svelte-check --threshold error --output human 2>&1 | grep -i "TurnPatternSection" || echo "no TurnPatternSection errors"
```

Expected: `no TurnPatternSection errors`. (It is not rendered yet — Task 8 mounts it.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/generate/components/modals/customize/TurnPatternSection.svelte
git commit -m "feat(create): add the turn-pattern section for the customize drill" -- src/lib/features/create/generate/components/modals/customize/TurnPatternSection.svelte
```

---

### Task 8: Mount it as a Customize drill row

**Files:**
- Modify: `src/lib/shared/create/state/panel-coordination-state.svelte.ts` (`CustomizeOverlayProps`)
- Modify: `src/lib/features/create/generate/components/cards/CustomizeCard.svelte`
- Modify: `src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte`
- Modify: `src/lib/features/create/generate/components/modals/CustomizeDrawer.svelte`

- [ ] **Step 1: Extend `CustomizeOverlayProps`**

In `panel-coordination-state.svelte.ts`, add to `CustomizeOverlayProps` immediately
before `onConstraintPresetChange`:

```ts
  /** Absent means the generator rolls its own turns under the intensity ceiling. */
  turnPattern: { blue: (number | "fl")[]; red: (number | "fl")[] } | null;
  /** The ceiling from the bento's Turn Intensity card, which caps the strip's values. */
  turnIntensity: number;
  sequenceLength: number;
  /** A LOOP's seed block, when one is active. Restricts the periods offered. */
  loopPeriod?: number;
```

and immediately after `onStartEndChange`:

```ts
  onTurnPatternChange: (
    lanes: { blue: (number | "fl")[]; red: (number | "fl")[] } | null
  ) => void;
```

- [ ] **Step 2: Forward them from the card**

In `CustomizeCard.svelte`, add to the `$props<{...}>()` type, after `isFreeformMode`:

```ts
    turnPattern?: { blue: (number | "fl")[]; red: (number | "fl")[] } | null;
    turnIntensity?: number;
    sequenceLength?: number;
    loopPeriod?: number;
    onTurnPatternChange?: (
      lanes: { blue: (number | "fl")[]; red: (number | "fl")[] } | null
    ) => void;
```

add matching entries to the destructuring with defaults:

```ts
    turnPattern = null,
    turnIntensity = 1,
    sequenceLength = 8,
    loopPeriod = undefined,
    onTurnPatternChange = () => {},
```

and add to the `openCustomizeOverlay` call, after `isFreeformMode,`:

```ts
      turnPattern,
      turnIntensity,
      sequenceLength,
      loopPeriod,
```

and after `onStartEndChange: onStartEndChange ?? null,`:

```ts
      onTurnPatternChange,
```

- [ ] **Step 3: Pass them through the drawer**

In `CustomizeDrawer.svelte`, find the `<CustomizeExpandedOverlay ... />` element and
add these attributes alongside the existing `overlayProps.*` forwards:

```svelte
        turnPattern={overlayProps.turnPattern}
        turnIntensity={overlayProps.turnIntensity}
        sequenceLength={overlayProps.sequenceLength}
        loopPeriod={overlayProps.loopPeriod}
        onTurnPatternChange={overlayProps.onTurnPatternChange}
```

- [ ] **Step 4: Add the row and its detail**

In `CustomizeExpandedOverlay.svelte`, add the import:

```ts
  import TurnPatternSection from "../modals/customize/TurnPatternSection.svelte";
```

add to the `$props<{...}>()` type after `isFreeformMode?: boolean;`:

```ts
    turnPattern?: { blue: (number | "fl")[]; red: (number | "fl")[] } | null;
    turnIntensity?: number;
    sequenceLength?: number;
    loopPeriod?: number;
    onTurnPatternChange?: (
      lanes: { blue: (number | "fl")[]; red: (number | "fl")[] } | null
    ) => void;
```

and to the destructuring, after `isFreeformMode = true,`:

```ts
    turnPattern = null,
    turnIntensity = 1,
    sequenceLength = 8,
    loopPeriod = undefined,
    onTurnPatternChange = () => {},
```

Add the row value, next to `startPosDisplay` / `endPosDisplay`:

```ts
  // What the engine will actually do. A pattern REPLACES the intensity ceiling
  // rather than combining with it, so the row reports whichever one is in force.
  const turnPatternDisplay = $derived.by(() => {
    if (!turnPattern) return `Random, ≤${turnIntensity}`;
    const lane = (values: readonly (number | "fl")[]) =>
      values.length ? values.map(String).join("·") : "0";
    return `Left ${lane(turnPattern.blue)} · Right ${lane(turnPattern.red)}`;
  });
```

Add the row to `drillItems`, after the `endPos` entry:

```ts
    { id: "turnPattern", label: "Turn Pattern", value: turnPatternDisplay },
```

and add the detail branch inside the `detail` snippet, after the `endPos` branch:

```svelte
        {:else if id === "turnPattern"}
          <div class="drill-fill">
            <TurnPatternSection
              {turnPattern}
              {level}
              {turnIntensity}
              blueStartOrientation={localBlueOri}
              redStartOrientation={localRedOri}
              {sequenceLength}
              {loopPeriod}
              {onTurnPatternChange}
            />
          </div>
```

Add the wrapper style, next to `.spread` and `.grid-fill`:

```css
  /* The section owns its own vertical rhythm and grows its strip into whatever
     height is left, so the wrapper only has to hand it the full column. */
  .drill-fill {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
```

- [ ] **Step 5: Verify it compiles**

```bash
npx svelte-check --threshold error --output human 2>&1 | grep -iE "CustomizeExpandedOverlay|CustomizeCard|CustomizeDrawer|TurnPatternSection" || echo "customize chain clean"
```

Expected: `customize chain clean`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/shared/create/state/panel-coordination-state.svelte.ts src/lib/features/create/generate/components/cards/CustomizeCard.svelte src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte src/lib/features/create/generate/components/modals/CustomizeDrawer.svelte
git commit -m "feat(create): put turn patterns under customize as an advanced drill" -- src/lib/shared/create/state/panel-coordination-state.svelte.ts src/lib/features/create/generate/components/cards/CustomizeCard.svelte src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte src/lib/features/create/generate/components/modals/CustomizeDrawer.svelte
```

---

### Task 9: Revert the bento and delete the Turns surfaces

**Files:**
- Modify: `src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte`
- Modify: `src/lib/features/create/generate/components/GeneratePanel.svelte`
- Modify: `src/lib/shared/create/state/panel-coordination-state.svelte.ts`
- Delete: `src/lib/features/create/generate/components/cards/TurnsCard.svelte`
- Delete: `src/lib/features/create/generate/components/cards/TurnsExpandedOverlay.svelte`
- Delete: `src/lib/features/create/generate/components/modals/TurnsDrawer.svelte`

- [ ] **Step 1: Put `TurnIntensityCard` back in the grid**

In `CardBasedSettingsContainer.svelte`, change the import at line 57 from:

```ts
  import TurnsCard from "./cards/TurnsCard.svelte";
```

to:

```ts
  import TurnIntensityCard from "./cards/TurnIntensityCard.svelte";
```

and replace the whole `turn-intensity` branch (currently lines 680-694) with the
form it had before the pattern work, verbatim:

```svelte
          {:else if card.id === "turn-intensity"}
            <!-- TurnIntensityCard declares shadowColor but no color prop. -->
            <TurnIntensityCard
              {...card.props as ComponentProps<typeof TurnIntensityCard>}
              shadowColor={cardColors.turnIntensity.shadowColor}
            />
```

- [ ] **Step 2: Thread the turn-pattern props into `CustomizeCard` instead**

In the same file, replace the `customize` branch:

```svelte
          {:else if card.id === "customize"}
            <CustomizeCard
              {...card.props as ComponentProps<typeof CustomizeCard>}
              color={cardColors.customize.color}
              shadowColor={cardColors.customize.shadowColor}
            />
```

with:

```svelte
          {:else if card.id === "customize"}
            <CustomizeCard
              {...card.props as ComponentProps<typeof CustomizeCard>}
              color={cardColors.customize.color}
              shadowColor={cardColors.customize.shadowColor}
              turnPattern={config.turnPattern}
              turnIntensity={config.turnIntensity}
              sequenceLength={config.length}
              loopPeriod={loopSeedLength}
              onTurnPatternChange={handleTurnPatternChange}
            />
```

`handleTurnPatternChange` (line 427) and `loopSeedLength` (line 137) already exist in
this file and keep their current definitions.

- [ ] **Step 3: Remove the Turns drawer from the panel**

In `GeneratePanel.svelte`, delete the `TurnsDrawer` import line and the whole
element:

```svelte
<TurnsDrawer
  isOpen={panelState.isTurnsOverlayOpen}
  overlayProps={panelState.turnsOverlayProps}
  onClose={() => panelState.closeTurnsOverlay()}
/>
```

- [ ] **Step 4: Strip the Turns overlay from panel state**

In `panel-coordination-state.svelte.ts`, delete:

- the entire `export interface TurnsOverlayProps { ... }` block and its docblock (around lines 185-208)
- the four interface members: `get isTurnsOverlayOpen()`, `get turnsOverlayProps()`, `openTurnsOverlay(...)`, `closeTurnsOverlay()` (around lines 359-364) and their `// Turns Overlay State` comment
- the two backing state lines `let isTurnsOverlayOpen = $state(false);` and `let turnsOverlayProps = $state<TurnsOverlayProps | null>(null);` and their comment (around lines 502-504)
- the `isTurnsOverlayOpen = false;` line inside `closeAllPanels()` (around line 549)
- the four implementation members under `// Turns Overlay Getters` (around lines 931-947)
- the `isTurnsOverlayOpen ||` term in the `isAnyPanelOpen` expression (around line 1008)

- [ ] **Step 5: Delete the three files**

```bash
git rm src/lib/features/create/generate/components/cards/TurnsCard.svelte src/lib/features/create/generate/components/cards/TurnsExpandedOverlay.svelte src/lib/features/create/generate/components/modals/TurnsDrawer.svelte
```

- [ ] **Step 6: Prove nothing still references them**

```bash
grep -rn "TurnsCard\|TurnsExpandedOverlay\|TurnsDrawer\|TurnsOverlayProps\|isTurnsOverlayOpen\|openTurnsOverlay\|closeTurnsOverlay\|turnsOverlayProps" src tests || echo "no dangling turns references"
```

Expected: `no dangling turns references`.

- [ ] **Step 7: Verify the card layout test still passes**

```bash
npx vitest run --config tests/config/vitest.config.ts src/lib/features/create/generate/components/cards/__tests__ src/lib/shared/create/domain/__tests__
```

Expected: PASS. `card-configurator-level-layout` asserts the bento's card list and
is the guard on this revert being faithful.

- [ ] **Step 8: Commit**

```bash
git commit -m "refactor(create): give the bento its turn intensity card back" -- src/lib/features/create/generate/components/CardBasedSettingsContainer.svelte src/lib/features/create/generate/components/GeneratePanel.svelte src/lib/shared/create/state/panel-coordination-state.svelte.ts src/lib/features/create/generate/components/cards/TurnsCard.svelte src/lib/features/create/generate/components/cards/TurnsExpandedOverlay.svelte src/lib/features/create/generate/components/modals/TurnsDrawer.svelte
```

---

### Task 10: Left and Right on the orientation rows

The two labels above the orientation controls read "Blue" and "Red" on controls that
are already blue and red — the tautology Austen called out. Left and Right keep the
same tint and teach which hand.

**Files:**
- Modify: `src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte:375-394`

- [ ] **Step 1: Change the words, keep the tints**

Replace:

```svelte
              <div class="ori-row">
                <span class="ori-color-label ori-blue">Blue</span>
```

with:

```svelte
              <div class="ori-row">
                <span class="ori-color-label ori-blue">Left</span>
```

and replace:

```svelte
              <div class="ori-row">
                <span class="ori-color-label ori-red">Red</span>
```

with:

```svelte
              <div class="ori-row">
                <span class="ori-color-label ori-red">Right</span>
```

The `.ori-blue` / `.ori-red` classes and `PropOrientationControl`'s
`ariaLabel="Blue start orientation"` stay exactly as they are — the control still
declares its prop identity explicitly, which is what
`.claude/rules/chip-primitives.md` requires. Only the visible tautology goes.

- [ ] **Step 2: Add the comment explaining the choice**

Above the `.ori-color-label` rule in the same file's `<style>`, replace the existing
comment block for `.ori-blue` with:

```css
  /* Left and Right, not Blue and Red: the tint already says which prop, so the
     word would be restating the colour. Naming the hand instead is the part a
     first-time reader cannot get from looking. Blue is the left hand, red the
     right — the same convention the Actions panel's APPLY TO row uses. */
```

- [ ] **Step 3: Verify**

```bash
grep -n "ori-color-label" -A 1 src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte
```

Expected: two matches reading `Left` and `Right`.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(create): name the hand, not the colour, above the orientation rows" -- src/lib/features/create/generate/components/cards/CustomizeExpandedOverlay.svelte
```

---

### Task 11: Full verification

No "done" claim before this task's evidence exists
(`.claude/rules/verification-protocol.md`).

- [ ] **Step 1: Full typecheck**

Only ONE `svelte-check` may run machine-wide (`.claude/rules/resource-budget.md`).
Confirm first:

```bash
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'svelte-check' } | Select-Object ProcessId"
```

If that prints a PID, wait for it. Otherwise:

```bash
npm run check > /tmp/check.log 2>&1; grep -ciE "^Error|error " /tmp/check.log; tail -5 /tmp/check.log
```

Expected: `svelte-check found 0 errors and 0 warnings`. Capture once, grep the log —
do not re-run `check` to look for a second thing.

- [ ] **Step 2: Full unit suite**

```bash
npx vitest run --config tests/config/vitest.config.ts src/lib/shared/create src/lib/features/create
```

Expected: PASS, including the new `pattern-sentence` suite (8 tests).

- [ ] **Step 3: Ask Austen to confirm the dev server is up**

:5173 is his, started from his Agent Hub button
(`.claude/rules/never-start-the-dev-server.md`). Never start, restart, or kill it.
Check whether it is already serving — note `--host ::` means IPv6, so an IPv4 curl
lies:

```bash
curl -sk -o /dev/null -w "%{http_code}\n" -g 'https://[::1]:5173/'
```

Expected: `200`. If not, report it and ask him to restart from Agent Hub. Do not
start one.

- [ ] **Step 4: Launch the shared debug browser**

```bash
pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank
```

Open a task-owned page with `new_page(..., background: true)`, keep its page ID, and
pass that `pageId` to every page-scoped call. Never pass
`--force-device-scale-factor`.

- [ ] **Step 5: Measure before judging**

Navigate to `https://localhost:5173/` (the composer's Generate panel), open
Customize, drill into Turn Pattern. Then, at each viewport, `evaluate_script`
returning JSON:

```js
() => {
  const q = (s) => document.querySelector(s);
  const box = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
  const labels = [...document.querySelectorAll(".pbs-label")].map((el) => ({
    text: el.textContent.trim(),
    boxW: Math.round(el.getBoundingClientRect().width),
    textW: Math.round(el.scrollWidth),
  }));
  return {
    section: box(q(".turn-pattern-section")),
    strip: box(q(".pbs")),
    cell: box(q(".pbs-cell")),
    chips: [...document.querySelectorAll(".sentence .filter-chip")].map((el) => Math.round(el.getBoundingClientRect().width)),
    labels,
    bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}
```

Pass conditions, at every viewport:
- every entry in `chips` is under 240 — a chip holding "every other step, starting on step 2" is the widest case; anything approaching the pane width is the 1765px-button failure
- every `labels[i].textW <= labels[i].boxW` — proves the spill is fixed
- `strip.h` is at least 55% of `section.h` — proves the strip took the height instead of stranding it
- `bodyOverflowX` is `false`

- [ ] **Step 6: Screenshot all seven viewports**

`emulate` with `<width>x<height>x1` per `.claude/rules/visual-verification-mandatory.md`,
then `take_screenshot` with `format: "webp", quality: 70`:

1920×1080 · 2560×1440 · 3840×2160 · 1440×900 · 820×1180 · 960×412 · 375×667

Shoot both states at each: the Customize root list (confirming the Turn Pattern row
and its `Random, ≤2` value), and the Turn Pattern detail.

Read every frame against the checklist in the rule: no absurdly wide control, no
dead space, no orphan rows, nothing floating on the background, no dead-end at 4K,
no horizontal overflow at 375, small glyphs legible.

- [ ] **Step 7: Screenshot the drawer handle regression fix from Task 1**

The handle change has no frame yet. At 1920×1080, open the Customize drawer and
confirm the grab handle is a visible neutral bar rather than a near-invisible tinted
sliver. One `take_screenshot` at `format: "webp", quality: 70`.

- [ ] **Step 8: Confirm the bento is untouched**

At 1920×1080 with the drawer closed, screenshot the settings grid. The Turn Intensity
card must look exactly as it did before this work: its own colour ramp, its stepper,
the words "TURN INTENSITY". This is the promise the whole redesign rests on.

- [ ] **Step 9: Clear emulation and close the task-owned page only**

Never close or resize the shared browser window.

- [ ] **Step 10: Report with evidence**

Post the measured JSON and the frames. If anything failed, fix, reload, and re-shoot
before claiming done.

---

## Deferred (already tracked, do not silently absorb into this plan)

- **Task #1 in the task list** — convert the Reversal strip to sentence mode, and
  decide whether its chips show `plainLabel` or the canonical TKA name.
- **Task #2 in the task list** — convert the Duration strip to sentence mode
  (single-lane, accent lane, no hands).

Both are unblocked by this plan: `StripBinding.sentence` is optional, so each is a
one-binding change plus its own verification sweep.

The spec asked the `pattern-sentence` tests to cover a single-lane binding and an
amount-less binary binding. Those are properties of the BINDING, not of the mask —
`describeMask` takes a `boolean[]` and never sees a lane count or an amount, so there
is nothing extra to assert about it. What those two cases actually exercise is the
sentence MARKUP, and the two bindings that would exercise it are exactly the deferred
ones. Task 6 handles both structurally and unverified: the amount chip is behind
`{#if binding.amountList}` so a binary binding renders `Left reverses on every other
step`, and the lane loop is driven by `binding.laneLabels` so a single-lane binding
emits one sentence. Each deferred task must confirm its own case on screen — neither
is proven by this plan's sweep, because neither renders in it.
