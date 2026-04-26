# Fuse Tour Redesign — Immersive Wizard with Interactive Stops

**Date:** 2026-03-26
**Status:** Draft

---

## Problem

The current Fuse tour has several UX issues:

1. **Not immersive** — bottom navigation, action bars, and other UI remain visible during the tour, making it unclear what the user should focus on.
2. **No visual connection** — when explaining a panel, the tour card and the panel it describes have no visual link (no arrow, no pointer).
3. **No transitions** — stops pop in without animation, feeling jarring.
4. **Shuffle auto-advances too fast** — user can't see the result of their shuffle before advancing.
5. **Fuse result is anticlimactic** — just a checkmark. No animation, no sequence preview, no payoff.
6. **Letters not derived** — the fused sequence has `letter: null` on every step. Blue + red motion data should produce deterministic letters via existing services.

## Goal

A 4-stop fullscreen wizard that completely owns the viewport, uses smooth transitions, includes interactive stops where the user performs real actions, and culminates in seeing their fused sequence animate with derived letters.

---

## Tour Flow

### Stop 1: Welcome

**Layout:** Fullscreen centered card. Nothing else visible — no panels, no bottom nav, no action bar.

**Content:**
- Fire icon (80px, orange accent)
- Title: "Fuse"
- Description: "Pick a blue prop path and a red prop path, then merge them into one complete sequence."
- Progress dots (4 total, first active)
- Buttons: "Skip" | "Show me"

**Transitions:**
- Fades in on mount (400ms ease)
- "Show me" → slide-left transition (300ms) to Stop 2
- "Skip" → fade out, show normal Fuse layout

### Stop 2: Both Panels

**Layout:** Tour text as a compact banner at the top. Both panels visible below, live and animated. Dots + Next at the bottom.

**Banner content:**
- "Blue on the left, red on the right"
- "Both step in sync. The grid shows notation, the animation shows motion."

**Panels:** Real `FusePanel` components, fully functional, with ChoreoCards stepping and animations playing. The shuffle buttons are visible but not highlighted yet.

**Bottom bar:** Progress dots (second active) + "Skip" + "Next"

**Transitions:**
- Slides in from right (300ms ease)
- "Next" → slide-left to Stop 3

### Stop 3: Shuffle (Interactive)

**Layout:** Same as Stop 2 — banner at top, both panels below. But now the shuffle buttons are highlighted with a glow effect and the banner encourages the user to tap one.

**Banner content:**
- "Try shuffling"
- "Tap a Shuffle button to see a different prop path."
- Pulsing hint: "👆 Shuffle to continue" (replaces the Next button)

**Shuffle buttons:** Both glow with their accent color (blue/red). On hover, glow intensifies.

**Interaction:**
1. User taps either shuffle button
2. The sequence changes (visible in both ChoreoCard and animation)
3. Hint text changes to "✓ Nice!" in green
4. **1.5 second delay** so the user sees the new sequence
5. Auto-advances to Stop 4 with slide-left transition

**No Next button** on this stop — the action IS the advancement. Skip button remains.

### Stop 4: Fuse (Interactive + Result)

**Layout:** Banner at top. Both panels visible but slightly dimmed (opacity 0.6). Fuse button prominent and pulsing at the bottom center.

**Banner content:**
- "Fuse them together"
- "When you like both sides, tap Fuse."

**Fuse button:** Large, orange gradient, pulsing glow animation. Same style as the normal Fuse button but bigger (56px height).

**Interaction:**
1. User taps Fuse
2. **Assembly merge animation** plays (the existing FLIP effect — both panels slide toward center and merge, 600ms + 150ms fade)
3. Panels are replaced by the **result view**: an inline animation player showing the fused sequence with both props and derived letters
4. Banner text changes to the derived word (e.g., "ABBD") and "Your fused sequence"
5. Below the animation player: "Let's go" button
6. User taps "Let's go" → tour ends, normal Fuse layout appears (with the fused result still available)

---

## Letter Derivation

**Current state:** `SequenceFuser.fuse()` builds `StepData` with `letter: null` and `stepPairings` with `letter: null`.

**Required:** After building the steps array, derive the letter for each step from the blue and red motion data. The letter is determined by the combination of:
- Blue start/end location
- Red start/end location
- The resulting grid position pair

**Implementation:** Use the existing `LetterDeterminer` service (or equivalent) that the Constructor uses when adding beats. For each step:

```typescript
const letter = letterDeterminer.determine(
  blueStep.startLocation, blueStep.endLocation,
  redStep.startLocation, redStep.endLocation
);
```

Then set `step.letter = letter` and derive the word by concatenating all letters.

The `stepPairings` should also get their `startPosition` and `endPosition` populated from the motion data locations, since these are derivable.

**Files to check:**
- `LetterDeterminer` or `PositionDeterminer` in the create/construct services
- How the Constructor derives letters when a beat is added
- `GridPosition` derivation from blue/red locations

---

## Transitions Between Stops

All transitions use **slide-left** (outgoing slides left, incoming slides in from right):

```css
/* Outgoing */
.slide.exit { opacity: 0; transform: translateX(-60px); }

/* Incoming */
.slide { opacity: 0; transform: translateX(60px); }
.slide.active { opacity: 1; transform: translateX(0); }

/* Shared */
.slide { transition: opacity 300ms ease, transform 300ms ease; }
```

The fuse result (Stop 4 → result) uses a **different transition**: the assembly merge animation (existing FLIP effect), then a fade-in of the result content.

---

## Bottom Navigation

**Hidden during the entire tour.** The tour owns the full viewport.

Implementation: when `fuseTourState.isActive`, the module-level layout (or the Fuse tab root) adds a class that hides the bottom nav bar. On tour end, the class is removed.

This may need to be handled at the `ModuleRenderer` or `MainApplication` level, or the Fuse tab can use a portal/overlay approach that sits above the nav.

---

## Architecture

### Files Changed

| File | Change |
|------|--------|
| `fuse-tour-state.svelte.ts` | Reduce to 4 stops. Add `actionCompleted`, `completeAction()`, `goBack()`. |
| `FuseTour.svelte` | Complete rewrite — no longer renders tour cards. Now a thin component that emits stop info. |
| `FuseLayout.svelte` | When tour active, renders a completely different DOM per stop. Normal layout is `{:else}` branch. |
| `SequenceFuser.ts` | Derive letters after building steps array. |
| `FuseTab.svelte` | Hide bottom nav during tour (class on parent or overlay approach). |

### Files NOT Changed

- `FusePanel.svelte` — used as-is inside the tour's panel stops
- `FuseSequenceBrowser.svelte` — used as-is
- `FuseAnimationPreview.svelte` — used as-is
- `AnimatorCanvas.svelte` — used as-is for the result animation
- `FuseAssemblyAnimator.ts` — used as-is for the merge effect

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User navigates away mid-tour | Tour state persists — if they come back before completing, tour resumes. If they completed or skipped, it doesn't show again. |
| Sequences fail to load during tour | Show error state in the panel, Skip button still works. |
| User shuffles multiple times on Stop 3 | Each shuffle resets the 1.5s timer. Only advances after 1.5s of inactivity post-shuffle. |
| Fuse fails (missing solo prop data) | Show inline error in the banner. Don't advance to result. |
| User taps "Let's go" after fuse result | Tour ends, normal layout appears. The fused sequence is available via `fuseState.fusedSequence` if we want to show it. |
| prefers-reduced-motion | All transitions become instant. Glow animations disabled. Assembly merge resolves immediately. |

---

## What This Does NOT Change

- The normal (non-tour) Fuse layout and its controls
- The shuffle-to-discover UX
- The shared beat clock mechanism
- The BPM / beat length controls
- The help button for replaying the tour
