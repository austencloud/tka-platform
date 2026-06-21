# LOOP Info Modal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic LOOP info modal with a Level-indicator-style display showing all 6 components as cards (active highlighted, inactive dimmed) and a structural explanation grounded in the actual sequence data.

**Architecture:** Three new files — a copy-generation service, a component card row, and a modal shell — plus one modification to SequenceDisplay.svelte to swap the inline modal for the new component. Data flows from existing `loopDisplay` and `currentSequence` reactive state, through the new `generateLoopStructuralCopy` service, into the modal template.

**Tech Stack:** Svelte 5 (`$props`, `$derived`), existing `BaseModal`/`ModalHeader` primitives, existing `LOOP_COMPONENTS` constant, existing `explainLOOP` service.

---

### Task 1: Create `loop-structural-copy.ts` — the copy generation service

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/sequence-display/services/loop-structural-copy.ts`

- [ ] **Step 1: Create the service file with all copy templates**

```ts
// src/lib/features/create/shared/workspace-panel/sequence-display/services/loop-structural-copy.ts

import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { explainLOOP } from "$lib/features/choreo-card/services/loop-explainer";

export interface StructuralCopyPart {
  text: string;
  bold: boolean;
}

export interface StructuralCopy {
  lead: string;
  parts: StructuralCopyPart[];
}

const COMPONENT_VERB: Record<string, string> = {
  rotated: "rotates positions on the grid",
  mirrored: "mirrors east and west",
  flipped: "flips north and south",
  swapped: "swaps blue and red",
  inverted: "swaps pro and anti",
  rewound: "plays the beats in reverse order",
};

function cycleText(cycleCount: number): string {
  if (cycleCount === 1) return "One pass and you're back where you started.";
  return `Play it ${cycleCount} times and you're back where you started.`;
}

function structureText(beatCount: number, word: string, period: number): string {
  const half = beatCount / 2;
  if (period === 4) {
    return `${beatCount} beats. ${word} repeats four times. `;
  }
  return `${beatCount} beats. ${word} repeats twice — beats 1–${half} and ${half + 1}–${beatCount} use the same letters. `;
}

function singleComponentCopy(
  component: LOOPComponent,
  beatCount: number,
  word: string,
  period: number,
  cc: number,
): StructuralCopy {
  const structure = structureText(beatCount, word, period);

  if (period === 4) {
    return quarteredSingleCopy(component, structure, cc);
  }

  switch (component) {
    case "rotated":
      return {
        lead: structure,
        parts: [
          { text: "The positions rotate", bold: true },
          { text: ": where the first half places your hands, the second half continues around the grid. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "mirrored":
      return {
        lead: structure,
        parts: [
          { text: "Same letters, but every position ", bold: false },
          { text: "flips left-to-right", bold: true },
          { text: ". The second half is the mirror image of the first. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "flipped":
      return {
        lead: structure,
        parts: [
          { text: "Same letters, but every position ", bold: false },
          { text: "flips top-to-bottom", bold: true },
          { text: ". The second half inverts the vertical axis. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "swapped":
      return {
        lead: structure,
        parts: [
          { text: "Same positions, same motions, but ", bold: false },
          { text: "blue and red trade roles", bold: true },
          { text: ". What one hand did in the first half, the other does in the second. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "inverted":
      return {
        lead: structure,
        parts: [
          { text: "Same positions, but ", bold: false },
          { text: "pro motions become anti and vice versa", bold: true },
          { text: ". The rotation direction reverses while the path stays the same. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "rewound":
      return {
        lead: structure,
        parts: [
          { text: "The second half ", bold: false },
          { text: "plays the first in reverse", bold: true },
          { text: ". A temporal mirror that loops back to start.", bold: false },
        ],
      };
    default:
      return {
        lead: structure,
        parts: [{ text: cycleText(cc), bold: false }],
      };
  }
}

function quarteredSingleCopy(
  component: LOOPComponent,
  structure: string,
  cc: number,
): StructuralCopy {
  switch (component) {
    case "rotated":
      return {
        lead: structure,
        parts: [
          { text: "Each pass ", bold: false },
          { text: "rotates positions 90° further", bold: true },
          { text: " around the grid. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "mirrored":
      return {
        lead: structure,
        parts: [
          { text: "Positions ", bold: false },
          { text: "mirror every two passes", bold: true },
          { text: "; orientations take all four to complete their cycle. ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    case "swapped":
      return {
        lead: structure,
        parts: [
          { text: "Blue and red ", bold: false },
          { text: "exchange roles every other pass", bold: true },
          { text: ". ", bold: false },
          { text: cycleText(cc), bold: false },
        ],
      };
    default:
      return {
        lead: structure,
        parts: [
          { text: cycleText(cc), bold: false },
        ],
      };
  }
}

function multiComponentCopy(
  components: LOOPComponent[],
  beatCount: number,
  word: string,
  period: number,
  cc: number,
): StructuralCopy {
  const structure = structureText(beatCount, word, period);
  const verbs = components
    .map((c) => COMPONENT_VERB[c])
    .filter(Boolean);

  const verbText = verbs.join(" and ");
  const subject = period === 4 ? "Each pass " : "The second half ";

  return {
    lead: structure,
    parts: [
      { text: subject, bold: false },
      { text: verbText, bold: true },
      { text: ". ", bold: false },
      { text: cycleText(cc), bold: false },
    ],
  };
}

export function generateLoopStructuralCopy(
  sequence: SequenceData,
  activeComponents: Set<LOOPComponent>,
  period: number,
): StructuralCopy {
  const beatCount = sequence.steps?.length ?? 0;
  const word = sequence.word || `${beatCount}-beat sequence`;
  const cc = sequence.orientationCycleCount ?? period;
  const components = [...activeComponents];

  if (beatCount === 0 || components.length === 0) {
    return {
      lead: "This sequence loops ",
      parts: [{ text: "back to its starting position.", bold: false }],
    };
  }

  // Try modular explanation first (multi-seed patterns)
  const modular = explainLOOP(sequence, activeComponents);
  if (modular.type === "modular" && modular.seeds.length > 1) {
    return {
      lead: `${beatCount} beats. `,
      parts: [{ text: modular.summary, bold: false }],
    };
  }

  if (components.length === 1) {
    return singleComponentCopy(components[0]!, beatCount, word, period, cc);
  }

  return multiComponentCopy(components, beatCount, word, period, cc);
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit src/lib/features/create/shared/workspace-panel/sequence-display/services/loop-structural-copy.ts 2>&1 | head -20`

If TypeScript errors, fix them. The most likely issue is import path resolution — adjust if needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/services/loop-structural-copy.ts
git commit -m "feat(loop-modal): add structural copy generation service"
```

---

### Task 2: Create `LOOPComponentRow.svelte` — the 6-card grid

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPComponentRow.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPComponentRow.svelte -->
<script lang="ts">
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { LOOP_COMPONENTS } from "$lib/features/create/generate/shared/domain/constants/loop-constants";

  let { activeComponents }: { activeComponents: Set<LOOPComponent> } = $props();
</script>

<div class="grid">
  {#each LOOP_COMPONENTS as info (info.component)}
    {@const isActive = activeComponents.has(info.component)}
    <div class="card" class:current={isActive} class:dim={!isActive} style:--comp-color={info.color}>
      <div class="icon-badge">
        <i class="fas fa-{info.icon}" aria-hidden="true"></i>
      </div>
      <div class="label">{info.label}</div>
      {#if isActive}
        <div class="desc">{info.description}</div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(6px, 1.5vw, 16px);
    padding: clamp(12px, 2vw, 24px) clamp(8px, 2vw, 24px);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: clamp(6px, 1vw, 12px);
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s ease;
    text-align: center;
  }

  .icon-badge {
    width: clamp(28px, 3vw, 36px);
    height: clamp(28px, 3vw, 36px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: clamp(3px, 0.5vw, 6px);
    font-size: clamp(13px, 1vw, 16px);
  }

  .label {
    font-size: clamp(10px, 0.5vw + 0.4rem, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    line-height: 1.25;
    font-weight: 600;
  }

  .desc {
    font-size: clamp(9px, 0.4vw + 0.35rem, 11px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    line-height: 1.3;
    margin-top: clamp(2px, 0.3vw, 4px);
  }

  /* Dimmed: inactive components */
  .card.dim {
    opacity: 0.5;
  }
  .card.dim .icon-badge {
    filter: grayscale(1) brightness(0.85);
    background: rgba(255, 255, 255, 0.06);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }
  .card.dim .label {
    filter: grayscale(1) brightness(0.85);
  }

  /* Active: highlighted component */
  .card.current {
    background: color-mix(in srgb, var(--comp-color, #2196f3) 14%, transparent);
    border-color: color-mix(in srgb, var(--comp-color, #2196f3) 35%, transparent);
  }
  .card.current .icon-badge {
    background: color-mix(in srgb, var(--comp-color, #2196f3) 25%, transparent);
    color: var(--comp-color, #2196f3);
  }
  .card.current .label {
    color: var(--theme-text, #e8e8ea);
  }
  .card.current .desc {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  @media (prefers-reduced-motion: reduce) {
    .card { transition: none; }
  }
</style>
```

- [ ] **Step 2: Verify file compiles**

Run: `npm run check 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPComponentRow.svelte
git commit -m "feat(loop-modal): add LOOPComponentRow — 6-card grid with active/dim states"
```

---

### Task 3: Create `LOOPInfoModal.svelte` — the modal shell

**Files:**
- Create: `src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPInfoModal.svelte`

- [ ] **Step 1: Create the modal component**

```svelte
<!-- src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPInfoModal.svelte -->
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import type { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import LOOPComponentRow from "./LOOPComponentRow.svelte";
  import { generateLoopStructuralCopy } from "../services/loop-structural-copy";

  interface Props {
    open: boolean;
    activeComponents: Set<LOOPComponent>;
    loopDisplayName: string;
    sequence: SequenceData | null;
    period: number;
    onclose: () => void;
  }

  let { open, activeComponents, loopDisplayName, sequence, period, onclose }: Props = $props();

  const structuralCopy = $derived.by(() => {
    if (!sequence || activeComponents.size === 0) return null;
    return generateLoopStructuralCopy(sequence, activeComponents, period);
  });
</script>

<BaseModal {open} {onclose} size="lg" class="loop-info-modal">
  <ModalHeader
    title="{loopDisplayName} LOOP"
    subtitle="Transformation pattern"
    icon="fa-infinity"
    iconColor="#36c3ff"
    onClose={onclose}
  />
  <div class="body">
    <LOOPComponentRow {activeComponents} />
    {#if structuralCopy}
      <p class="explanation">
        {structuralCopy.lead}{#each structuralCopy.parts as part}{#if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}
      </p>
    {/if}
  </div>
</BaseModal>

<style>
  .body {
    padding: clamp(8px, 2vw, 16px) clamp(16px, 3vw, 32px) clamp(16px, 3vw, 32px);
  }

  .explanation {
    margin: clamp(12px, 2vw, 20px) 0 0;
    padding: 0 clamp(8px, 2vw, 24px);
    font-size: clamp(13px, 0.9vw + 0.5rem, 16px);
    line-height: 1.6;
    color: var(--theme-text, #c5c9d2);
    text-align: center;
  }
</style>
```

- [ ] **Step 2: Verify file compiles**

Run: `npm run check 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/LOOPInfoModal.svelte
git commit -m "feat(loop-modal): add LOOPInfoModal with component row + structural explanation"
```

---

### Task 4: Integrate into `SequenceDisplay.svelte`

**Files:**
- Modify: `src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte`

- [ ] **Step 1: Add the import**

At the top of the `<script>` block, after the `LevelInfoModal` import (line 14), add:

```ts
import LOOPInfoModal from "./LOOPInfoModal.svelte";
```

- [ ] **Step 2: Replace the inline LOOP modal**

Replace the block from `<!-- LOOP Info Modal -->` through its closing `</BaseModal>` (lines 285-315) with:

```svelte
<!-- LOOP Info Modal -->
<LOOPInfoModal
  open={showLoopInfo}
  {activeComponents}
  loopDisplayName={loopDisplayName}
  sequence={currentSequence}
  period={loopPeriod}
  onclose={() => (showLoopInfo = false)}
/>
```

- [ ] **Step 3: Remove unused imports and styles**

Remove the `LOOPIconStrip` import from line 11 ONLY IF it is no longer used elsewhere in this file. Check: `LOOPIconStrip` is still used on line 238 (the badge button), so keep the import.

Remove these CSS rules from the `<style>` block since they belonged to the old inline modal and are now handled by `LOOPInfoModal`:
- `.info-modal-body` (lines 484-489)
- `.info-modal-body p` (lines 491-493)
- `.loop-components-display` (lines 496-504)
- `.components-label` (lines 506-512)
- `.components-strip` (lines 514-518)

- [ ] **Step 4: Verify everything compiles**

Run: `npm run check 2>&1 | head -30`

Expected: no errors.

- [ ] **Step 5: Verify build succeeds**

Run: `npm run build 2>&1 | tail -5`

Expected: build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/create/shared/workspace-panel/sequence-display/components/SequenceDisplay.svelte
git commit -m "feat(loop-modal): swap inline LOOP modal for LOOPInfoModal component"
```
