# Create Tutorial Mobile Fixes

**Date:** 2026-03-11
**Status:** Approved (user-trusted)

## Problem

The Create Tutorial has several mobile UX issues:
1. Auto-launches without user consent after FirstRunWizard
2. Start position pictographs are too small on mobile (iPhone SE 375x667)
3. Beat picker pictographs are tiny on mobile
4. Play step lets users skip watching the animation via Continue button
5. Ready step (final) has a 2-column layout that collapses badly on mobile
6. **BLOCKING BUG:** "Start building" button on Ready step overlaps nav dots and triggers back-navigation instead of completing the tutorial

## Design Decisions

### 1. Opt-in Prompt

After FirstRunWizard completes, show a prompt card instead of auto-launching:
- "Want a quick tour?" with Accept/Skip buttons
- Accept → launches CreateTutorialWizard
- Skip → marks entry complete, goes to main app
- New phase in app-entry-state: `"tutorial-prompt"` between `"wizard-exiting"` and `"create-tutorial"`

### 2. Play Step Gating

Hide Continue button until the user has pressed Play at least once. Track a `hasPlayed` flag. After play is pressed and animation starts, show Continue button with fade-in.

### 3. Ready Step Mobile Redesign

On mobile (≤640px):
- Remove the workspace mockup entirely (user just built the sequence, doesn't need a thumbnail)
- Show 6 tools as an accordion list: colored badge + label visible, tap to expand description
- Only one accordion item open at a time
- "Start building" button pinned at bottom of the card, above the step dots

On desktop (>640px):
- Keep existing 2-column layout (it works fine there)

### 4. "Start Building" Bug Fix

The go-button inside ReadyStep is positioned where it overlaps with the wizard's fixed-position step-dots. On mobile, the ReadyStep content overflows and the button ends up behind/beneath the dots. Fix: ensure the tutorial step content respects the bottom padding for dots, and the go-button has proper z-index and position.

### 5. Mobile Sizing Improvements

- PickStartPositionStep: increase picker container height on mobile, reduce card padding
- AddBeatStep: increase picker container height on mobile
- All steps: on mobile ≤480px, reduce card border-radius and padding to maximize content area

## Files to Modify

| File | Change |
|------|--------|
| `app-entry-state.svelte.ts` | Add `"tutorial-prompt"` phase |
| `MainApplication.svelte` | Render TutorialPrompt in the new phase |
| New: `TutorialPrompt.svelte` | Opt-in card component |
| `PlaySequenceStep.svelte` | Gate Continue behind hasPlayed |
| `ReadyStep.svelte` | Mobile accordion, remove mockup on mobile, fix button |
| `PickStartPositionStep.svelte` | Mobile sizing tweaks |
| `AddBeatStep.svelte` | Mobile sizing tweaks |
| `CreateTutorialWizard.svelte` | Ensure step-container doesn't clip go-button |
