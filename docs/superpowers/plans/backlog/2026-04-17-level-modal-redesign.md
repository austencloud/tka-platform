# Level Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Level info modal (which reads as a broken picker) with a row-layout explainer that teaches the level system and tells the user what unlocks the next level.

**Architecture:** Extract level metadata into a shared module consumed by the modal and the landing page. Extend `SequenceDifficultyCalculator` with an `analyzeDifficulty` method that returns both level and triggering feature. New `LevelInfoModal` component renders a header, a row of three level cards (current enlarged), and adaptive progression text. Existing `DIFFICULTY_LEVELS` (badge styling) stays untouched.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest, existing `BaseModal` / `ModalHeader` components.

**Spec:** `docs/superpowers/specs/2026-04-17-level-modal-redesign-design.md`

---

## Task 1: Shared level metadata module

**Files:**
- Create: `src/lib/shared/domain/curriculum/level-metadata.ts`

- [ ] **Step 1: Create the metadata file**

Create `src/lib/shared/domain/curriculum/level-metadata.ts`:

```ts
export type LevelNumber = 1 | 2 | 3;

export interface LevelMetadata {
  readonly name: string;
  readonly blurb: string;
  readonly image: string;
  readonly accent: string;
}

export const LEVEL_METADATA: Readonly<Record<LevelNumber, LevelMetadata>> = {
  1: {
    name: "Base Motions",
    blurb: "The grid, all 6 letter types, basic words. No turns.",
    image: "/images/level_images/level_1.png",
    accent: "#4CAF50",
  },
  2: {
    name: "Whole Turns",
    blurb: "Whole turns. Shifts get rotation, combos get harder.",
    image: "/images/level_images/level_2.png",
    accent: "#2196F3",
  },
  3: {
    name: "Half Turns, Floats",
    blurb: "Half turns, floats. The full vocabulary.",
    image: "/images/level_images/level_3.png",
    accent: "#9C27B0",
  },
} as const;
```

- [ ] **Step 2: Verify type-check passes**

Run: `npm run check`
Expected: no new errors from the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/domain/curriculum/level-metadata.ts
git commit -m "feat(curriculum): add shared LEVEL_METADATA module"
```

---

## Task 2: Extend calculator contract with `analyzeDifficulty`

**Files:**
- Modify: `src/lib/features/browse/sequences/display/services/contracts/ISequenceDifficultyCalculator.ts`

- [ ] **Step 1: Add types and method to the contract**

Replace the full contents of `ISequenceDifficultyCalculator.ts` with:

```ts
/**
 * Sequence Difficulty Calculator Contract
 *
 * Calculates the difficulty level of a sequence based on turn values and orientations.
 *
 * Level Logic:
 * - Level 1: Base Motions
 * - Level 2: Whole Turns
 * - Level 3: Half Turns, Floats
 */

import type { StepData } from "../../../../../create/shared/domain/models/StepData";

export type DifficultyTrigger = "none" | "turns" | "nonRadial";

export interface DifficultyAnalysis {
  readonly level: 1 | 2 | 3;
  readonly trigger: DifficultyTrigger;
}

export interface ISequenceDifficultyCalculator {
  /**
   * Calculate the difficulty level of a sequence based on its content
   * @param steps - Array of beat data containing motion information
   * @returns Numeric difficulty level (1 = beginner, 2 = intermediate, 3 = advanced)
   */
  calculateDifficultyLevel(steps: StepData[]): number;

  /**
   * Analyze the sequence and return both the level and the feature that triggered it.
   * Used by UI surfaces that explain *why* a sequence is at a given level.
   */
  analyzeDifficulty(steps: StepData[]): DifficultyAnalysis;

  /**
   * Convert numeric level to difficulty string
   * @param level - Numeric level (1-3)
   * @returns Difficulty string ("beginner", "intermediate", "advanced")
   */
  levelToString(level: number): string;
}
```

- [ ] **Step 2: Verify type-check fails on implementation**

Run: `npm run check`
Expected: one error saying `SequenceDifficultyCalculator` does not implement `analyzeDifficulty`. This confirms the contract extension is picked up. Task 3 fixes it.

---

## Task 3: Implement `analyzeDifficulty` with tests (TDD)

**Files:**
- Create: `src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.test.ts`
- Modify: `src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SequenceDifficultyCalculator } from "./SequenceDifficultyCalculator";
import {
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

// Minimal StepData factory — only the fields the calculator reads.
function makeStep(
  blueTurns: number | "fl" | null,
  redTurns: number | "fl" | null,
  blueStartOri: Orientation = Orientation.IN,
  blueEndOri: Orientation = Orientation.IN,
  redStartOri: Orientation = Orientation.IN,
  redEndOri: Orientation = Orientation.IN,
): StepData {
  return {
    stepNumber: 1,
    duration: 1,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions: {
      [MotionColor.BLUE]: {
        turns: blueTurns,
        startOrientation: blueStartOri,
        endOrientation: blueEndOri,
      },
      [MotionColor.RED]: {
        turns: redTurns,
        startOrientation: redStartOri,
        endOrientation: redEndOri,
      },
    },
  } as unknown as StepData;
}

describe("SequenceDifficultyCalculator.analyzeDifficulty", () => {
  const calc = new SequenceDifficultyCalculator();

  it("returns level 1 / trigger 'none' for an empty sequence", () => {
    expect(calc.analyzeDifficulty([])).toEqual({ level: 1, trigger: "none" });
  });

  it("returns level 1 / trigger 'none' when there are no turns and only radial orientations", () => {
    const steps = [makeStep(0, 0)];
    expect(calc.analyzeDifficulty(steps)).toEqual({ level: 1, trigger: "none" });
  });

  it("returns level 2 / trigger 'turns' when a whole turn is present with radial orientations", () => {
    const steps = [makeStep(1, 0)];
    expect(calc.analyzeDifficulty(steps)).toEqual({ level: 2, trigger: "turns" });
  });

  it("returns level 3 / trigger 'nonRadial' when any orientation is CLOCK or COUNTER", () => {
    const steps = [makeStep(0, 0, Orientation.IN, Orientation.CLOCK)];
    expect(calc.analyzeDifficulty(steps)).toEqual({
      level: 3,
      trigger: "nonRadial",
    });
  });

  it("returns level 2 / trigger 'turns' for a float value", () => {
    const steps = [makeStep("fl", 0)];
    expect(calc.analyzeDifficulty(steps)).toEqual({ level: 2, trigger: "turns" });
  });

  it("prefers nonRadial over turns when both are present (L3 wins)", () => {
    const steps = [makeStep(1, 0, Orientation.IN, Orientation.CLOCK)];
    expect(calc.analyzeDifficulty(steps)).toEqual({
      level: 3,
      trigger: "nonRadial",
    });
  });
});

describe("SequenceDifficultyCalculator.calculateDifficultyLevel (unchanged behavior)", () => {
  const calc = new SequenceDifficultyCalculator();

  it("still returns a plain number", () => {
    expect(calc.calculateDifficultyLevel([])).toBe(1);
    expect(calc.calculateDifficultyLevel([makeStep(1, 0)])).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.test.ts`
Expected: FAIL — `calc.analyzeDifficulty is not a function` on the `analyzeDifficulty` tests. The `calculateDifficultyLevel` tests should PASS.

- [ ] **Step 3: Implement `analyzeDifficulty` and refactor existing method to delegate**

Replace the full contents of `SequenceDifficultyCalculator.ts` with:

```ts
/**
 * Sequence Difficulty Calculator Implementation
 *
 * Analyzes sequence beat data to determine difficulty level based on:
 * - Turn values (0, whole numbers, half values, floats)
 * - Orientation types (radial IN/OUT vs non-radial CLOCK/COUNTER)
 */

import type { StepData } from "../../../../../create/shared/domain/models/StepData";
import {
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type {
  DifficultyAnalysis,
  ISequenceDifficultyCalculator,
} from "../contracts/ISequenceDifficultyCalculator";

export class SequenceDifficultyCalculator implements ISequenceDifficultyCalculator {
  analyzeDifficulty(steps: StepData[]): DifficultyAnalysis {
    if (!steps || steps.length === 0) {
      return { level: 1, trigger: "none" };
    }

    let hasNonRadial = false;
    let hasTurns = false;

    for (const beat of steps) {
      if (!beat.motions) continue;

      const blueMotion = beat.motions[MotionColor.BLUE];
      const redMotion = beat.motions[MotionColor.RED];

      if (this.hasNonRadialOrientation(blueMotion, redMotion)) {
        hasNonRadial = true;
      }
      if (this.hasTurns(blueMotion, redMotion)) {
        hasTurns = true;
      }
    }

    if (hasNonRadial) return { level: 3, trigger: "nonRadial" };
    if (hasTurns) return { level: 2, trigger: "turns" };
    return { level: 1, trigger: "none" };
  }

  calculateDifficultyLevel(steps: StepData[]): number {
    return this.analyzeDifficulty(steps).level;
  }

  levelToString(level: number): string {
    switch (level) {
      case 1: return "beginner";
      case 2: return "intermediate";
      case 3: return "advanced";
      default: return "beginner";
    }
  }

  private hasNonRadialOrientation(
    blueMotion: unknown,
    redMotion: unknown,
  ): boolean {
    const blueObj = blueMotion as Record<string, unknown> | undefined;
    const redObj = redMotion as Record<string, unknown> | undefined;

    const orientationsToCheck = [
      blueObj?.startOrientation,
      blueObj?.endOrientation,
      redObj?.startOrientation,
      redObj?.endOrientation,
    ];

    return orientationsToCheck.some(
      (orientation) =>
        orientation === Orientation.CLOCK || orientation === Orientation.COUNTER,
    );
  }

  private hasTurns(blueMotion: unknown, redMotion: unknown): boolean {
    return this.motionHasTurns(blueMotion) || this.motionHasTurns(redMotion);
  }

  private motionHasTurns(motion: unknown): boolean {
    const motionObj = motion as Record<string, unknown> | undefined;

    if (motionObj?.turns === undefined || motionObj?.turns === null) {
      return false;
    }
    if (motionObj.turns === "fl") return true;
    if (typeof motionObj.turns === "number") return motionObj.turns > 0;
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Run type-check**

Run: `npm run check`
Expected: no errors related to `ISequenceDifficultyCalculator` or `SequenceDifficultyCalculator`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/browse/sequences/display/services/contracts/ISequenceDifficultyCalculator.ts src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.ts src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.test.ts
git commit -m "feat(difficulty): add analyzeDifficulty returning level + trigger"
```

---

## Task 4: Create `LevelProgressionRow` component

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/sequence-display/components/LevelProgressionRow.svelte`

- [ ] **Step 1: Write the component**

Create the file with:

```svelte
<script lang="ts">
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";

  let { currentLevel }: { currentLevel: LevelNumber } = $props();

  const levels: LevelNumber[] = [1, 2, 3];

  function badgeStyle(level: LevelNumber) {
    const style = DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE;
    return `background: ${style.cssBg}; border-color: ${style.border}; color: ${style.text};`;
  }
</script>

<div class="row">
  {#each levels as level (level)}
    {@const meta = LEVEL_METADATA[level]}
    {@const isCurrent = level === currentLevel}
    <div class="lcard" class:current={isCurrent} class:dim={!isCurrent}>
      <div class="lnum" style={badgeStyle(level)}>{level}</div>
      <img src={meta.image} alt="Level {level} example pictograph" />
      <div class="lname">{meta.name}</div>
    </div>
  {/each}
</div>

<style>
  .row {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 10px;
    padding: 22px 18px 16px;
  }

  .lcard {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s ease;
  }

  .lcard img {
    background: #fff;
    padding: 4px;
    border-radius: 6px;
    display: block;
  }

  .lcard .lname {
    margin-top: 8px;
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-align: center;
    line-height: 1.3;
  }

  .lnum {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-family: Cambria, serif;
    font-weight: bold;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #000;
    margin-bottom: 6px;
  }

  .lcard.dim { opacity: 0.55; }
  .lcard.dim img { width: 72px; height: 72px; }

  .lcard.current {
    background: color-mix(in srgb, var(--theme-accent, #2196f3) 12%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #2196f3) 30%, transparent);
    padding: 14px;
    transform: translateY(6px);
  }
  .lcard.current img { width: 140px; height: 140px; }
  .lcard.current .lnum { width: 28px; height: 28px; font-size: 15px; }
  .lcard.current .lname {
    color: var(--theme-text, #e8e8ea);
    font-size: 13px;
    font-weight: 600;
    margin-top: 10px;
  }

  @container (max-width: 480px) {
    .row {
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .lcard.current { transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .lcard { transition: none; }
  }
</style>
```

- [ ] **Step 2: Run type-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/LevelProgressionRow.svelte
git commit -m "feat(sequence-display): add LevelProgressionRow component"
```

---

## Task 5: Create `LevelInfoModal` component

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/sequence-display/components/LevelInfoModal.svelte`

- [ ] **Step 1: Write the component**

Create the file with:

```svelte
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";
  import type { DifficultyAnalysis } from "$lib/features/browse/sequences/display/services/contracts/ISequenceDifficultyCalculator";
  import LevelProgressionRow from "./LevelProgressionRow.svelte";

  interface Props {
    open: boolean;
    analysis: DifficultyAnalysis;
    onclose: () => void;
  }

  let { open, analysis, onclose }: Props = $props();

  const levelName = $derived(LEVEL_METADATA[analysis.level as LevelNumber]?.name ?? "");
  const iconColor = $derived(
    analysis.level === 3 ? "#b8860b" : analysis.level === 2 ? "#a8a8a8" : "#6366f1",
  );

  const progression = $derived.by(() => {
    const L2 = LEVEL_METADATA[2].accent;
    const L3 = LEVEL_METADATA[3].accent;
    switch (analysis.level) {
      case 1:
        return {
          lead: "This sequence uses only base motions.",
          parts: [
            { text: "Add ", emph: null },
            { text: "whole turns", emph: L2 },
            { text: " to reach Level 2. Add ", emph: null },
            { text: "half turns or floats", emph: L3 },
            { text: " to reach Level 3.", emph: null },
          ],
        };
      case 2:
        return {
          lead: "This sequence uses ",
          parts: [
            { text: "whole turns", emph: L2 },
            { text: " — that's Level 2. Add ", emph: null },
            { text: "half turns or floats", emph: L3 },
            { text: " to reach Level 3.", emph: null },
          ],
        };
      case 3:
      default:
        return {
          lead: "This sequence uses ",
          parts: [
            { text: "half turns or floats", emph: L3 },
            { text: " — that's Level 3, the full vocabulary.", emph: null },
          ],
        };
    }
  });
</script>

<BaseModal {open} {onclose} size="md">
  <ModalHeader
    title="Level {analysis.level}"
    subtitle={levelName}
    icon="fa-layer-group"
    {iconColor}
    onClose={onclose}
  />
  <div class="body">
    <LevelProgressionRow currentLevel={analysis.level as LevelNumber} />
    <p class="progression">
      {progression.lead}{#each progression.parts as part, i (i)}{#if part.emph}<strong style="color: {part.emph};">{part.text}</strong>{:else}{part.text}{/if}{/each}
    </p>
  </div>
</BaseModal>

<style>
  .body {
    container-type: inline-size;
    padding-bottom: 18px;
  }

  .progression {
    padding: 0 22px 4px;
    margin: 0;
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--theme-text, #c5c9d2);
  }
</style>
```

- [ ] **Step 2: Run type-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/LevelInfoModal.svelte
git commit -m "feat(sequence-display): add LevelInfoModal with progression text"
```

---

## Task 6: Wire `LevelInfoModal` into `SequenceDisplay`

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte`

- [ ] **Step 1: Replace calculator usage and inline modal**

In `SequenceDisplay.svelte`, make these edits:

**a) Add the `LevelInfoModal` import (below the existing `ModalHeader` import):**

```ts
import LevelInfoModal from "./LevelInfoModal.svelte";
```

**b) Replace the `difficultyLevel` / `currentLevelStyle` derived section with an analysis-based one.** Find this block (around lines 117–128):

```ts
// Difficulty level badge (mirrors ChoreoCard exactly)
const difficultyCalculator = new SequenceDifficultyCalculator();
const difficultyLevel = $derived.by(() => {
  if (!currentSequence?.steps?.length) return 1;
  return difficultyCalculator.calculateDifficultyLevel([...currentSequence.steps]);
});

// Level badge colors — single source of truth shared with the image compositor
const currentLevelStyle = $derived.by(() => {
  const style = DIFFICULTY_LEVELS[difficultyLevel] ?? DEFAULT_DIFFICULTY_STYLE;
  return { bg: style.cssBg, border: style.border, text: style.text };
});
```

Replace with:

```ts
// Difficulty analysis — returns both level and the feature that triggered it
const difficultyCalculator = new SequenceDifficultyCalculator();
const difficultyAnalysis = $derived.by(() => {
  if (!currentSequence?.steps?.length) {
    return { level: 1 as const, trigger: "none" as const };
  }
  return difficultyCalculator.analyzeDifficulty([...currentSequence.steps]);
});
const difficultyLevel = $derived(difficultyAnalysis.level);

// Level badge colors — single source of truth shared with the image compositor
const currentLevelStyle = $derived.by(() => {
  const style = DIFFICULTY_LEVELS[difficultyLevel] ?? DEFAULT_DIFFICULTY_STYLE;
  return { bg: style.cssBg, border: style.border, text: style.text };
});
```

**c) Remove the local `difficultyDescriptions` dict.** Find and delete this block (around lines 140–144):

```ts
const difficultyDescriptions: Record<number, string> = {
  1: "Base Motions",
  2: "Whole Turns",
  3: "Half Turns, Floats",
};
```

**d) Replace the inline difficulty modal (around lines 264–292).** Find:

```svelte
<!-- Difficulty Level Info Modal -->
<BaseModal
  open={showDifficultyInfo}
  onclose={() => (showDifficultyInfo = false)}
  size="sm"
>
  <ModalHeader
    title="Level {difficultyLevel}"
    subtitle={difficultyDescriptions[difficultyLevel] ?? ""}
    icon="fa-layer-group"
    iconColor={difficultyLevel === 3 ? "#b8860b" : difficultyLevel === 2 ? "#a8a8a8" : "#6366f1"}
    onClose={() => (showDifficultyInfo = false)}
  />
  <div class="info-modal-body">
    <p>Each level introduces new concepts.</p>
    <div class="level-list">
      {#each [1, 2, 3] as level}
        {@const style = DIFFICULTY_LEVELS[level] ?? DEFAULT_DIFFICULTY_STYLE}
        <div class="level-row" class:current={level === difficultyLevel}>
          <div
            class="level-dot"
            style="background: {style.cssBg}; border-color: {style.border}; color: {style.text};"
          >{level}</div>
          <span class="level-desc">{difficultyDescriptions[level]}</span>
        </div>
      {/each}
    </div>
  </div>
</BaseModal>
```

Replace with:

```svelte
<!-- Difficulty Level Info Modal -->
<LevelInfoModal
  open={showDifficultyInfo}
  analysis={difficultyAnalysis}
  onclose={() => (showDifficultyInfo = false)}
/>
```

**e) Remove now-unused CSS.** In the `<style>` block, delete these rule blocks:

```css
.info-modal-body { ... }
.info-modal-body p { ... }
.level-list { ... }
.level-row { ... }
.level-row.current { ... }
.level-dot { ... }
.level-desc { ... }
.level-row.current .level-desc { ... }
```

The `loop-components-display`, `components-label`, `components-strip` rules stay — the LOOP modal still uses them.

Also, the inline difficulty modal used `ModalHeader` — if no other usage remains in the file (it's still used by the LOOP modal) keep the import. Verify by searching: `ModalHeader` should appear at least once in the remaining markup.

- [ ] **Step 2: Run type-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test (tell the user to verify)**

Output to the user:
> "I cannot verify this visually without Chrome DevTools permission. Please open the Create tab at `localhost:5173/create/construct`, build a Level 1, Level 2, and Level 3 sequence, and tap the level badge in each case. Confirm: the modal shows the row of three pictographs with the current level enlarged, and the progression text below adapts per level."

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte
git commit -m "feat(sequence-display): wire LevelInfoModal, drop inline picker-style modal"
```

---

## Task 7: Migrate `GuidesSection` to consume `LEVEL_METADATA`

**Files:**
- Modify: `src/routes/landing/components/GuidesSection.svelte`

- [ ] **Step 1: Replace inline `guides` array with derived-from-metadata array**

In `GuidesSection.svelte`, replace the `<script>` block (lines 1–31) with:

```svelte
<script lang="ts">
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";

  const levels: LevelNumber[] = [1, 2, 3];

  const guides = levels.map((level) => ({
    level,
    title: LEVEL_METADATA[level].name,
    description: LEVEL_METADATA[level].blurb,
    image: LEVEL_METADATA[level].image,
    href: `/guides/level-${level}.pdf`,
    accent: LEVEL_METADATA[level].accent,
  }));
</script>
```

The template below references `guide.level`, `guide.title`, `guide.description`, `guide.image`, `guide.href`, and `guide.accent` — all preserved in the new shape. No template changes needed.

- [ ] **Step 2: Run type-check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/routes/landing/components/GuidesSection.svelte
git commit -m "refactor(landing): read level guide metadata from shared module"
```

---

## Task 8: Final verification checklist

- [ ] **Step 1: Full test suite**

Run: `npx vitest run src/lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator.test.ts`
Expected: all tests pass.

- [ ] **Step 2: Type-check + build**

Run: `npm run check && npm run build`
Expected: both succeed, no new warnings.

- [ ] **Step 3: Hand-off verification prompt**

Output to the user:
> "Implementation complete. Please verify in the browser:
> 1. Open `localhost:5173/create/construct`, build a Level 1 / Level 2 / Level 3 sequence, tap the badge in each case — confirm the new row-layout modal appears and the progression text adapts.
> 2. Open `localhost:5173/` — scroll to the Guides section. The three guide cards should look identical to before (no regression in the landing page).
> 3. Try a narrow viewport (~400px wide) on the modal — row should collapse to vertical stack.
> Let me know what you see."

---

## Self-review notes

- **Spec coverage:** Every spec requirement has a task. Header + row + progression text → Task 5. Row extraction → Task 4. Calculator extension → Tasks 2–3. Shared metadata → Task 1. `GuidesSection` migration → Task 7. Mobile collapse → container query in Task 4.
- **Type consistency:** `DifficultyAnalysis` defined in Task 2, consumed in Tasks 3/5/6. `LevelNumber` defined in Task 1, consumed in Tasks 4/5/7. `LEVEL_METADATA` shape consistent across all uses.
- **No orphan references:** `showDifficultyInfo` state variable in `SequenceDisplay.svelte` is reused by the new modal (Task 6); kept intact.
- **Non-breaking:** `calculateDifficultyLevel` signature preserved; all 15 existing call sites continue to work.
