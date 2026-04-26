# Fuse Tour Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Fuse tour as an immersive 4-stop fullscreen wizard with smooth transitions, interactive shuffle/fuse stops, letter derivation, and an inline animation result.

**Architecture:** The tour completely owns the viewport when active (fixed overlay covers bottom nav). Each stop renders a distinct layout. Letter derivation uses existing `LetterDeriver.deriveLettersForSequence()`. The fuse result shows an inline `AnimatorCanvas` with the derived word.

**Tech Stack:** Svelte 5 runes, CSS transitions (slide-left), existing AnimatorCanvas + FusePanel + LetterDeriver

**Spec:** `docs/superpowers/specs/2026-03-26-fuse-tour-redesign-design.md`

---

### Task 1: Add Letter Derivation to SequenceFuser

The fuser currently leaves `letter: null` on all steps. After building the steps array, derive letters so the fused sequence has a word.

**Files:**
- Modify: `src/lib/features/fuse/services/implementations/SequenceFuser.ts`
- Reference: `src/lib/shared/navigation/services/implementations/LetterDeriver.ts`

- [ ] **Step 1: Check LetterDeriver availability in DI**

Search for `letterDeriver` in the DI containers to find the registration:
```bash
grep -r "letterDeriver" src/lib/shared/di/
```

- [ ] **Step 2: Add async letter derivation after fuse**

The `SequenceFuser.fuse()` method is synchronous. Rather than making it async, add a post-processing step. In `FuseLayout.handleFuse()`, after `fuseState.startFuse()`, derive letters on the fused sequence:

In `FuseLayout.svelte`, import the letter deriver and update `handleFuse`:

```typescript
import { container } from "$lib/shared/di";

async function handleFuse() {
  if (!leftBrowsingSeq || !rightBrowsingSeq) return;
  fuseState.selectLeft(leftBrowsingSeq);
  fuseState.selectRight(rightBrowsingSeq);
  fuseState.startFuse();

  // Derive letters on the fused sequence
  if (fuseState.fusedSequence) {
    try {
      const letterDeriver = container.items.letterDeriver;
      const withLetters = await letterDeriver.deriveLettersForSequence(fuseState.fusedSequence);
      fuseState.setFusedSequence(withLetters);
    } catch {
      // Letters are nice-to-have, don't block on failure
    }
  }
}
```

- [ ] **Step 3: Add `setFusedSequence` to fuse state**

In `fuse-state.svelte.ts`, add a setter:

```typescript
function setFusedSequence(seq: SequenceData) {
  fusedSequence = seq;
}
```

And expose it in the return object.

- [ ] **Step 4: Verify build**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/components/FuseLayout.svelte src/lib/features/fuse/state/fuse-state.svelte.ts
git commit -m "feat(fuse): derive letters on fused sequences via LetterDeriver"
```

---

### Task 2: Reduce Tour to 4 Stops + Add actionCompleted

**Files:**
- Modify: `src/lib/shared/onboarding/state/fuse-tour-state.svelte.ts`

- [ ] **Step 1: Update stops array**

Replace the 5-stop `STOPS` array with 4 stops:

```typescript
export type FuseTourStop =
  | "welcome"
  | "panels"
  | "shuffle"
  | "fuse";

const STOPS: FuseTourStop[] = [
  "welcome",
  "panels",
  "shuffle",
  "fuse",
];
```

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/onboarding/state/fuse-tour-state.svelte.ts
git commit -m "refactor(fuse): reduce tour to 4 stops"
```

---

### Task 3: Rewrite FuseTour Component

The tour component should render just the content for each stop — no overlay logic. The parent (FuseLayout) handles positioning.

**Files:**
- Rewrite: `src/lib/shared/onboarding/components/fuse-tour/FuseTour.svelte`

- [ ] **Step 1: Rewrite the component**

The component renders the tour card content (icon, title, description, dots, buttons) for the current stop. It does NOT render overlays or position itself — the parent does that.

Stop content:
- **welcome**: Fire icon, "Fuse", description, "Skip" | "Show me"
- **panels**: "Blue on the left, red on the right", description about sync
- **shuffle**: "Try shuffling", pulsing hint "Shuffle to continue" (no Next button when waiting)
- **fuse**: "Fuse them together", description. After fuse completes, shows the derived word and "Let's go" button

Props: `variant?: "fullscreen" | "banner"` — fullscreen centers everything vertically, banner is compact horizontal.

- [ ] **Step 2: Verify build**

Run: `npm run check`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/onboarding/components/fuse-tour/FuseTour.svelte
git commit -m "feat(fuse): rewrite FuseTour as content-only component with banner/fullscreen variants"
```

---

### Task 4: Rewrite FuseLayout Tour Mode

The main change — when tour is active, FuseLayout renders a fixed overlay that covers everything including bottom nav. Each stop has its own layout.

**Files:**
- Modify: `src/lib/features/fuse/components/FuseLayout.svelte`

- [ ] **Step 1: Add fixed overlay wrapper for tour mode**

When `fuseTourState.isActive`, render a `position: fixed; inset: 0; z-index: 1000` overlay that covers the entire viewport including bottom nav:

```svelte
{#if fuseTourState.isActive}
  <div class="tour-overlay">
    <!-- Stop-specific content rendered here -->
  </div>
{/if}
```

```css
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: linear-gradient(165deg, #1a1a2e 0%, #0f0f23 40%, #1a1025 100%);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 2: Implement welcome stop**

Fullscreen centered FuseTour with `variant="fullscreen"`. Stars background via CSS pseudo-elements or small divs. Fade-in on mount.

- [ ] **Step 3: Implement panels stop**

FuseTour with `variant="banner"` at the top. Both FusePanel components below in the grid. Dots + Skip + Next at the bottom.

- [ ] **Step 4: Implement shuffle stop**

Same as panels stop but FuseTour banner says "Try shuffling" with the pulsing hint. Shuffle buttons on both panels get a glow class. No Next button — user must shuffle.

Wire up the shuffle event: when user shuffles during this stop, `fuseTourState.completeAction()` is called, 1.5s delay, then auto-advance.

- [ ] **Step 5: Implement fuse stop**

Banner at top. Both panels visible but dimmed (opacity 0.6). Fuse button centered and pulsing below panels. Tapping Fuse:
1. Calls `handleFuse()` (which does the actual fuse + letter derivation)
2. Plays the assembly merge animation
3. Replaces the panels with an inline result view: `AnimatorCanvas` showing the fused sequence + the derived word displayed above it
4. "Let's go" button below

- [ ] **Step 6: Add slide transitions**

Each stop gets CSS transition classes:
```css
.tour-stop {
  transition: opacity 300ms ease, transform 300ms ease;
}
.tour-stop.entering { opacity: 0; transform: translateX(60px); }
.tour-stop.active { opacity: 1; transform: translateX(0); }
.tour-stop.exiting { opacity: 0; transform: translateX(-60px); }
```

Use a `tourTransitionState` to manage entering/active/exiting per stop change.

- [ ] **Step 7: Verify build**

Run: `npm run check`

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/fuse/components/FuseLayout.svelte
git commit -m "feat(fuse): immersive tour with fixed overlay, per-stop layouts, slide transitions"
```

---

### Task 5: Wire Shuffle Glow + Tour Interaction in FusePanel

During the shuffle tour stop, the shuffle buttons need to glow and trigger tour advancement.

**Files:**
- Modify: `src/lib/features/fuse/components/FusePanel.svelte`

- [ ] **Step 1: Add `tourShuffleGlow` prop**

```typescript
let {
  // ... existing props
  tourShuffleGlow = false,
}: {
  // ... existing types
  tourShuffleGlow?: boolean;
} = $props();
```

- [ ] **Step 2: Apply glow class to shuffle button**

```svelte
<button
  class="shuffle-btn"
  class:glow={tourShuffleGlow}
  ...
>
```

```css
.shuffle-btn.glow {
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 40%, transparent);
  animation: shuffleGlow 1.5s ease-in-out infinite;
}
@keyframes shuffleGlow {
  0%,100% { box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 30%, transparent); }
  50% { box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 50%, transparent); }
}
```

- [ ] **Step 3: Update shuffle onclick for tour**

The existing shuffle onclick already calls `fuseTourState.completeAction()` and auto-advances. Verify this still works with the new 4-stop flow (the shuffle stop is now index 2, stop id "shuffle").

- [ ] **Step 4: Verify build**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/components/FusePanel.svelte
git commit -m "feat(fuse): add shuffle button glow for tour stop"
```

---

### Task 6: Inline Fuse Result in Tour

After the user taps Fuse in the tour, show the result inline: animation canvas with both props + derived word.

**Files:**
- Modify: `src/lib/features/fuse/components/FuseLayout.svelte`
- Reference: `src/lib/features/fuse/components/FuseAnimationPreview.svelte`

- [ ] **Step 1: Add a `tourFuseCompleted` state**

In FuseLayout, track whether the fuse has been completed during the tour:

```typescript
let tourFuseCompleted = $state(false);
let tourFusedWord = $state("");
```

- [ ] **Step 2: Update the fuse stop rendering**

When `tourFuseCompleted` is true, replace the panels + fuse button with:
- The derived word displayed prominently (e.g., "ABBD")
- An `AnimatorCanvas` (or `FuseAnimationPreview`) showing the fused sequence with both props
- "Let's go" button

Use the existing `FuseAnimationPreview` component but without the `propColor` filter (show both props) and without the back button.

- [ ] **Step 3: Wire the tour fuse action**

```typescript
async function handleTourFuse() {
  await handleFuse(); // existing fuse + letter derivation
  tourFuseCompleted = true;
  tourFusedWord = fuseState.fusedSequence?.word ??
    fuseState.fusedSequence?.steps?.map(s => s.letter).filter(Boolean).join("") ?? "";
}
```

- [ ] **Step 4: Verify build**

Run: `npm run check`

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/fuse/components/FuseLayout.svelte
git commit -m "feat(fuse): inline fuse result in tour with animation + derived word"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full type check**

Run: `npm run check`

- [ ] **Step 2: Full build**

Run: `npm run build`

- [ ] **Step 3: Manual verification**

Clear `tka-fuse-tour-completed` from localStorage. Open Fuse tab. Walk through:

1. Welcome screen — fullscreen, no bottom nav visible
2. "Show me" → slide transition to both panels with banner
3. "Next" → shuffle stop, shuffle buttons glow
4. Tap a shuffle button → see new sequence, 1.5s delay, auto-advance
5. Fuse stop — panels dimmed, fuse button pulsing
6. Tap Fuse → assembly animation → inline result with animation + word
7. "Let's go" → normal Fuse layout
8. Help button (?) → replays tour from start
