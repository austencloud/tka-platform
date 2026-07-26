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

- [x] Tab from inside each of the 5 overlays cannot reach `<MainInterface />` behind it (keyboard test / axe). All 5 route through the shared `FocusTrap` class (`focus-trap.ts`), which sets `inert` on background siblings while active — a browser-enforced guarantee (`inert` elements cannot receive focus, by spec), not a Tab-key simulation. Verified end-to-end for CreateTutorialWizard via component test (`CreateTutorialWizard.svelte.test.ts`: "keeps Tab from reaching a background sibling while open" — 6/6 passing). The other 4 (AccountSetupWizard, TutorialPrompt, TabIntro, StepEditorTour) use the identical `activate()`/`deactivate()` `$effect` wiring, verified by code review + Svelte-compiler syntax check (12/12 files clean), not individually browser-tested — TabIntro currently has zero live mount points in the app (see finding note below), so there's no route to drive a real keyboard test against it yet.
- [x] CreateTutorialWizard + AccountSetupWizard announce as modal dialogs with a name (screen-reader or axe check). CreateTutorialWizard verified via component test (`role="dialog"`, `aria-modal="true"`, `toHaveAccessibleName` resolves through `aria-labelledby`). AccountSetupWizard uses the identical pattern (`aria-labelledby="account-setup-title"` → the step's `<h1 id="account-setup-title">`), verified by code review + compile check, not independently component-tested.
- [x] Advancing a step in each tour is announced (SR test or `aria-live` present + populated). `aria-live="polite"` added to the stable wrapper in all three (CreateTutorialWizard `.step-container`, GeneratePanelTour `.tour-info`, StepEditorTour `.tour-copy`) — present and populated per compile check + code review. No screen-reader tooling available in this environment to verify the actual announcement audibly; flagging rather than faking it.
- [x] StepEditorTour has `aria-modal` and a per-stop accessible name. `aria-modal="true"` + `aria-labelledby="step-editor-tour-title"` pointing at the `<h3>` whose text reactively follows `currentStopInfo.title` — the accessible name updates per stop by construction (no per-stop id needed; the AT re-reads the referenced element's live content). Verified by code review + compile check.
- [x] Back/Skip and TabIntro dots meet the touch-target floor (computed size ≥ token). CreateTutorialWizard Back/Skip verified via component test (`getComputedStyle(...).minHeight >= 44px`, the live `--min-touch-target` value). TabIntro dots (24×24px hit area via `::before`, visual dot stays 8px) verified by CSS review only — TabIntro has no live mount point to computed-style-test against yet.
- [~] TabIntro motion is suppressed under `prefers-reduced-motion` (emulate in DevTools). Implemented (reactive `matchMedia` state gating all 3 `transition:` directives, matching `SequenceViewerShell.svelte`/`FeedbackTextarea.svelte`), verified by code review + compile check. NOT verified with live DevTools emulation — TabIntro isn't mounted anywhere in the app today (grepped: zero call sites outside its own README), so there is no live surface to emulate against, and interactive DevTools use requires explicit conversational permission per `CLAUDE.md` which wasn't sought/granted this turn.
- [~] A 2-page TabIntro config with differing bullet counts does not shift neighbors (manual self-check per no-layout-shift). Implemented via a double-nested ghost-sizer grid-stack (every page's body rendered invisibly in one grid cell so the wrap reserves the tallest page's height permanently, not just during the transition). Self-check reasoning documented inline; not visually verified live for the same no-mount-point reason as above.
- [x] `npm run check` clean — NOT run this turn; explicitly forbidden by this task's hard rules ("Do NOT run `npm run check`/`npm run build`/dev servers"). Substituted: a standalone Svelte-compiler syntax check on all 12 touched `.svelte` files (0 errors) plus the component test suite (6/6 passing). `vitest-browser-svelte` component test added: `CreateTutorialWizard.svelte.test.ts`, locking the focus-trap + dialog-role regression (`component-test-discipline.md` — test-on-fix). **Closed 2026-07-25:** `npm run check` run machine-wide → `svelte-check found 0 errors and 4 warnings in 3 files`; all 4 are pre-existing unused-CSS-selector warnings in unrelated landing files. Gate satisfied.

## Verification

axe / keyboard walkthrough on each overlay; DevTools reduced-motion emulation; the no-layout-shift self-check. A component test on at least the focus-trap regression is warranted here (interactive shared primitives, per `component-test-discipline.md`).

## Out of scope

Non-onboarding overlays. The layout-stability work elsewhere in the app.
