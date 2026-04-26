# Grid Lesson: Point Tap Interaction

**Date:** 2026-03-17
**Status:** Draft
**Module:** learn → concepts → grid

## Problem

The grid lesson is the only concept lesson without an interactive element. Step 3 is a static summary with cards. A quiz was tried and removed because it felt silly — the grid lesson teaches simple spatial concepts that don't benefit from multiple-choice questions.

## Solution

Replace the static summary step (step 3) with a guided point tap interaction where the user builds the merged grid by tapping each point into existence, one at a time.

**Note:** The domain term "8-point grid" refers to the 4 diamond + 4 box outer points. The center point is always present. So this interaction has 9 tappable points total: 1 center + 4 hand + 4 outer.

## User Flow

The interaction replaces step 3. Steps 0-2 remain unchanged. Step numbering is 0-indexed in code; display text uses 1-indexed ("Step 4 of 5", "Step 5 of 5").

**Step 3 (code) / "Step 4 of 5" (display): Build the Grid**

1. Merged grid appears with all 9 points invisible (just the background circle/frame)
2. Header: "Build the Grid"
3. Instruction text: "Tap the center point"
4. Center point pulses gently to indicate it's tappable
5. User taps center point → pop animation + "Center" label appears briefly → point stays filled
6. Instruction updates: "Tap each hand point"
7. All 4 hand points begin pulsing simultaneously — user can tap them in any order
8. Each hand point: tap → pop + brief label → stays filled
9. After all 4 hand points tapped, instruction updates: "Tap each outer point"
10. All 4 outer points begin pulsing — user can tap them in any order
11. Each outer point: tap → pop + brief label → stays filled
12. After all 9 points tapped: brief celebration (grid glows, haptic success), then auto-transition to step 4 after **800ms**

**Step 4 (code) / "Step 5 of 5" (display): Completion**

After the tap interaction, show a minimal completion screen:
- "You've Got the Grid!" title
- "Next up: Hand Positions" teaser
- "Complete Lesson" button (receives focus automatically on transition)

This is a slimmed-down version of the current `GridSummaryStep` — drop the summary cards since the user just proved they know the points by tapping them.

## Point Display Labels

| Point ID | Display Label |
|----------|--------------|
| center | Center |
| hn | N |
| he | E |
| hs | S |
| hw | W |
| n | N |
| e | E |
| s | S |
| w | W |

Hand and outer points use the same cardinal labels. The label floats briefly beside the point on tap (~800ms) and is decorative, not persistent.

## Architecture

### State Changes

**`grid-experience-state.svelte.ts`:**
- `totalSteps` increases from 4 to 5 (steps 0-4)
- Add new state: `tapPhase: 'center' | 'hand' | 'outer' | 'complete'`
- Add tracking: `tappedPoints: string[]` (point IDs that have been tapped — stored as array for JSON serialization)
- Add actions: `tapPoint(pointId: string)` — validates the tap, adds to tappedPoints, advances tapPhase when current group is complete
- Step 3 = point tap interaction, Step 4 = completion screen
- Announcements for new steps:
  - Step 3 center: "Step 4 of 5: Build the Grid. Tap the center point."
  - Step 3 hand: "Tap each hand point."
  - Step 3 outer: "Tap each outer point."
  - Step 3 complete: "Grid complete!"
  - Step 4: "Step 5 of 5: Lesson complete."

**Persistence:** Don't persist mid-tap progress. The interaction takes under 15 seconds. If the user refreshes during step 3, restart the tap interaction from the beginning (tapPhase resets to 'center', tappedPoints resets to empty). Only persist the step number so refreshing on step 4 returns to step 4.

**Back navigation during tap step:** Pressing Back (or ArrowLeft) during step 3 goes back to step 2 (point types). Tap progress resets — returning to step 3 restarts the interaction. This is consistent with how other steps reset their phases on backward navigation.

**Arrow keys during tap step:** ArrowRight/ArrowDown do nothing during step 3 (no Next button to simulate). ArrowLeft/ArrowUp trigger back navigation as usual.

**Skip link:** Update the condition from `step < 3` to `step < 4` since the summary is now at step 4.

### New Component

**`GridPointTapStep.svelte`** (in `grid-concept/`):
- Renders the merged 8-point grid SVG using existing `GRID` constants from `grid-merge-constants.ts`
- Each point is an SVG circle with tap handler
- Points have 3 visual states:
  - **Hidden:** invisible, no interaction
  - **Pulsing:** visible outline + pulse animation, tappable
  - **Filled:** solid fill with pop-in animation, no longer interactive
- Instruction text above the grid updates per phase
- Uses haptic feedback: `selection` on each tap, `success` when all 9 complete

### Point Positions

Reuse constants from `grid-merge-constants.ts`:
- Center: `(GRID.CENTER, GRID.CENTER)` — 1 point
- Hand points: `CARDINAL_HAND` array — 4 points (N, E, S, W at hand radius)
- Outer points: `CARDINAL_OUTER` array — 4 points (N, E, S, W at outer radius)

### Visual Design

- Grid background: same dark card background as the teaching steps
- Pulsing animation: subtle opacity oscillation (0.4 → 0.8) with a gentle scale pulse, accent color outline
- Pop animation: quick scale from 0 → 1.2 → 1.0 with opacity, ~300ms
- Label appearance: fade in above/beside the point, fade out after ~800ms (purely decorative, not persistent)
- Filled state: solid accent-colored fill matching the theme
- Completion glow: brief radial pulse outward from center, ~500ms, then 300ms pause before auto-advancing to step 4

### Tap Target Sizing

Each point's tap target must meet WCAG AAA (44x44px minimum). The SVG point radii from the constants are:
- Outer points: `GRID.POINT_RADIUS = 25` (50px diameter in SVG space)
- Hand points: `GRID.HAND_POINT_RADIUS = 8` (16px diameter — too small)
- Center point: `GRID.CENTER_POINT_RADIUS = 12` (24px diameter — too small)

For the tap interaction, use a uniform hit area of at least 44px diameter for all points regardless of their visual size. The visual can be smaller, but the tap target circle (transparent fill) should be larger.

### Accessibility

- `aria-live="polite"` announcement on each phase change (see announcement text above)
- Each tappable point has `role="button"` and `aria-label` (e.g., "Center point", "North hand point", "North outer point")
- Keyboard support: Tab through pulsing points, Enter/Space to tap
- Focus lands on "Complete Lesson" button after auto-transition to step 4
- Reduced motion: skip pulse animation, use instant opacity change instead

### Scroll View Mode

In scroll mode, the tap interaction does not render. The scroll view shows all content passively for review — step 3 shows the merged grid with all points visible (no interaction). This is consistent with how scroll mode works: it's a read-through, not an interactive replay.

### Integration with GridConceptExperience

In `GridConceptExperience.svelte`, step 3 renders `GridPointTapStep` instead of `GridSummaryStep`. Step 4 renders a simplified completion screen (can reuse `GridSummaryStep` with the cards removed, or inline a minimal completion view).

The `handleNextPhase()` in the state machine does NOT apply to step 3 — the tap interaction advances itself via `tapPoint()`. The Next button is hidden during the tap step. Once all points are tapped, the state auto-advances to step 4.

## Files to Create

| File | Purpose |
|------|---------|
| `grid-concept/GridPointTapStep.svelte` | The tap interaction component |

## Files to Modify

| File | Change |
|------|--------|
| `grid-concept/grid-experience-state.svelte.ts` | Add tap phase, tapped points tracking, totalSteps → 5 |
| `GridConceptExperience.svelte` | Render `GridPointTapStep` at step 3, shift summary to step 4, update skip link condition, disable arrow-right on step 3 |
| `GridSummaryStep.svelte` | Remove summary cards, keep completion button + "next up" text |

## What This Is NOT

- Not a quiz. No score, no pass/fail, no wrong answers.
- Not timed. User goes at their own pace.
- Not punishing. You can't tap the wrong point — only the active group pulses and is tappable.
- Not complex. 9 taps, 3 phases, done in under 15 seconds.
