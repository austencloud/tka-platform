# Onboarding Accessibility + Component Polish — Remediation Spec

**Date:** 2026-07-18
**Status:** Ready for Fable
**Severity:** P1 + P2/P3
**Source:** 2026-07-18-onboarding-adversarial-audit.md (dimensions: accessibility, layout-stability)
**Design surface:** Fable chooses the primitive per overlay (`FocusTrap` vs `BaseModal`). The rest maps to specific WCAG 2.2 success criteria.

## Context

Onboarding accessibility is split. One surface (GeneratePanelTour, via
`BaseModal`'s native `<dialog>`) gets focus containment, Escape, and focus
restoration for free — solid. The other five hand-rolled overlays
(CreateTutorialWizard, AccountSetupWizard, TutorialPrompt, TabIntro,
StepEditorTour) reuse neither of the codebase's two working primitives, so the
live app stays reachable behind the modal and screen-reader users are not told
the overlay exists or that steps advance. Two in-repo primitives already solve
this; the fix is routing, not invention (`never-hand-roll.md`).

## Findings covered

| id | sev | file:line | defect | WCAG |
|---|---|---|---|---|
| overlays-no-focus-trap | **P1** | `src/lib/shared/application/components/MainApplication.svelte:506` | `<MainInterface />` stays mounted and tabbable behind 5 overlays; none use `FocusTrap`/`BaseModal`. | 2.4.3, 2.1.2 |
| wizards-no-dialog-semantics | P1 | `src/lib/shared/onboarding/components/create-tutorial/CreateTutorialWizard.svelte:143` | CreateTutorialWizard + AccountSetupWizard have no `role`, `aria-modal`, `aria-labelledby`, or focus-on-mount (sibling `TutorialPrompt.svelte:62-66` does all three). | 4.1.2 |
| steps-no-arialive | P1 | `CreateTutorialWizard.svelte:168` (+ GeneratePanelTour, StepEditorTour) | Step content swaps with no `aria-live` and no focus move; SR users hear nothing on advance. | 4.1.3 |
| stepeditor-missing-ariamodal | P2 | `src/lib/shared/onboarding/components/step-editor-tour/StepEditorTour.svelte:85` | Declares `role=dialog` but omits `aria-modal` and a per-stop `aria-labelledby`; the accessible name never updates as stops change. | 4.1.2 |
| touch-target-back-skip | P2 | `CreateTutorialWizard.svelte:244` | Back/Skip controls ~30-36px vs the codebase 48px floor. | 2.5.8 |
| tabintro-dots-hit-area | P2 | `src/lib/shared/onboarding/components/TabIntro.svelte:219` | Pagination dots 8×8px with no hit-area padding. | 2.5.8 |
| tabintro-reduced-motion | P3 | `TabIntro.svelte:160` | CSS media block cannot cancel Svelte `transition:` directives; motion plays for reduced-motion users (two sibling components check `matchMedia` in JS). | 2.3.3 |
| tabintro-reserved-space | P3 | `TabIntro.svelte:186` | Multi-page pagination reserves no space for variable-length bullets — latent reflow the moment a 2-page config with different point counts ships. | (no-layout-shift rule) |
| createtutorial-crossfade | P3 | `CreateTutorialWizard.svelte:70` | Hand-rolls a timeout-driven fade + duplicated reduced-motion check. **PLAUSIBLE, not confirmed** — `Crossfade mode="swap"` is close but not identical. | (crossfade-primitive rule) |

## Requirements

1. All five hand-rolled onboarding overlays trap focus and make the live app inert while open, and restore focus on close. Route through `FocusTrap` or `BaseModal` (match GeneratePanelTour).
2. CreateTutorialWizard and AccountSetupWizard expose dialog semantics: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the title, and focus moves into the overlay on mount (copy `TutorialPrompt.svelte:62-66`).
3. Multi-step tours announce step changes: wrap step content in `aria-live="polite"` or move focus to the new step's heading on advance. Applies to CreateTutorialWizard, GeneratePanelTour, StepEditorTour.
4. StepEditorTour adds `aria-modal` and updates `aria-labelledby` to the current stop title.
5. Interactive controls meet the 48px design-system touch floor (`var(--min-touch-target)`): CreateTutorialWizard Back/Skip; TabIntro dots get ≥24px hit area via padding or a transparent pseudo-element.
6. TabIntro honors `prefers-reduced-motion` by computing it in script (`matchMedia`) and gating the `transition:` params — matching the two sibling components that already do this.
7. TabIntro multi-page content reserves the tallest page's height (or routes through `<Crossfade fill>`) so a future 2-page intro cannot shove neighbors (`no-layout-shift.md`).
8. CreateTutorialWizard crossfade: either adopt `<Crossfade mode="swap">` or add a carve-out comment justifying the hand-roll (`crossfade-primitive.md` keep-separate). This one is P3 and PLAUSIBLE — Fable decides; do not force a migration that changes the feel.

## Open questions for Fable

- **FocusTrap vs BaseModal per overlay.** BaseModal (native `<dialog>`) gives the most for free but changes stacking/scroll behavior; FocusTrap is lighter and keeps current layout. Choose per overlay — some (AccountSetupWizard) may want the full dialog; the coach-mark-style tours (StepEditorTour) may need FocusTrap only since they anchor to page elements.
- **aria-live vs focus-move** for step announcements — pick one convention and apply it consistently across the three tours.

## Acceptance criteria

- [ ] Tab from inside each of the 5 overlays cannot reach `<MainInterface />` behind it (keyboard test / axe).
- [ ] CreateTutorialWizard + AccountSetupWizard announce as modal dialogs with a name (screen-reader or axe check).
- [ ] Advancing a step in each tour is announced (SR test or `aria-live` present + populated).
- [ ] StepEditorTour has `aria-modal` and a per-stop accessible name.
- [ ] Back/Skip and TabIntro dots meet the touch-target floor (computed size ≥ token).
- [ ] TabIntro motion is suppressed under `prefers-reduced-motion` (emulate in DevTools).
- [ ] A 2-page TabIntro config with differing bullet counts does not shift neighbors (manual self-check per no-layout-shift).
- [ ] `npm run check` clean; consider a `vitest-browser-svelte` component test locking the focus-trap + dialog-role regressions (`component-test-discipline.md` — test-on-fix).

## Verification

axe / keyboard walkthrough on each overlay; DevTools reduced-motion emulation; the no-layout-shift self-check. A component test on at least the focus-trap regression is warranted here (interactive shared primitives, per `component-test-discipline.md`).

## Out of scope

Non-onboarding overlays. The layout-stability work elsewhere in the app.
