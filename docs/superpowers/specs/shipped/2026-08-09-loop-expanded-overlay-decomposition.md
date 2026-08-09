---
status: shipped
value: 4
effort: L
remaining: "Shipped 2026-08-09"
depends_on: ""
plan_path: ""
tags: [create, loop, architecture, responsive]
last_triaged: 2026-08-09
---

# LOOP Expanded Overlay Decomposition

**Date:** 2026-08-09
**Status:** Shipped
**Type:** Structural refactor with behavioral test seams

## Problem

`LOOPExpandedOverlay.svelte` is the highest-scoring live, hand-written
monolith in the current scan. It combines about 2,000 lines of selection
workflow, LOOP validation, guest gating, rhythm configuration, responsive
presentation, focus choreography, animation, and component-scoped styling.

The file serves several production hosts. A change to one rhythm control or
phone detail panel currently requires loading the entire workflow and its
desktop, combo, summary, and animation paths.

## Outcome

Keep `LOOPExpandedOverlay.svelte` as the local workflow owner. It retains the
component contract, reactive state, live Single behavior, transactional Combo
behavior, focus restoration, drawer animation, and host callbacks.

Extract the independently testable calculations and UI sections so a future
task can load the relevant owner without reading the whole overlay.

## Capability Ownership

Discovery searched for `Reflection axis`, `Rotation period`, `Build the
sequence`, `reflectionAxis`, and `onToggleComponent`.

- `SegmentedControl.svelte` remains the owner of radio-style option selection
  and keyboard behavior.
- `LOOPComponentGrid.svelte` remains the owner of LOOP component selection and
  expanded-card placement.
- `LoopBlockTimeline.svelte` remains the owner of the block preview.
- Existing LOOP type, rhythm gate, guest gate, and block-signature modules
  remain the algorithm owners.

The extracted components compose those owners. They do not add another control
or validation implementation.

## Scope

### Pure overlay model

Create a feature-local pure module that derives:

- normalized reflection selections;
- compatible and locked component sets;
- configurable component state;
- buildable spec, rhythm gate, and guest lock;
- explanation, word-math, captions, and Apply label; and
- selected detail identity.

This module delegates all LOOP algorithms to their current canonical services.
Unit tests cover the silent state and gating transitions.

### Rhythm configurator

Extract the rotation, inversion, and reflection controls into one focused
component. It composes `SegmentedControl` and owns the diagrams, captions, and
scoped styles for those settings.

### Focused detail panel

Extract the narrow-screen detail panel, including its identity header, Back
control, rhythm configurator, and gate status. The overlay continues to own
focus movement because focus crosses the picker/detail boundary.

### Selection summary

Extract the combo outcome area, block timeline, status messages, word math,
and Apply action. The overlay passes the already-derived model and the confirm
callback.

### Overlay chrome

Extract the title, close action, and optional LOOP-off action as one visual
section with its own scoped styles.

## Constraints

- Single selections with settings continue writing through live.
- Single selections without settings still apply and close immediately.
- Combo changes remain local until Apply.
- Guest and rhythm gates preserve their current ordering and messages.
- Reflection compatibility still normalizes `FLIPPED` to `MIRRORED`.
- Phone focus returns to the exact component that opened the detail panel.
- Existing drawer height and component-reveal animations remain owned by the
  overlay.
- No new global state, context, service singleton, control primitive, or LOOP
  algorithm is introduced.
- Layout and copy remain unchanged.

## Verification

1. Pure unit coverage for selection compatibility, gates, captions, and Apply
   labels.
2. Existing browser component tests for live Single, focused phone settings,
   invalid rhythm recovery, immediate close, and transactional Combo.
3. Project Svelte diagnostics with zero new findings.
4. Production build.
5. Chrome DevTools verification at 1920x1080, 2560x1440, 3840x2160,
   1440x900, 820x1180, 960x412, and 375x667.
6. Final monolith scan and four-perspective review.

## Integration

Implement as a separate commit in the already-authorized isolated worktree.
Merge only after the primary checkout's overlapping museum edits land, then
remove the completed worktree and branch.

## Completed Verification

- Pure overlay model: 5 tests passed.
- Browser component contract: 5 tests passed in Chromium.
- Targeted Svelte diagnostics: 0 errors and 0 warnings.
- Production client and server bundle: passed with the local Maps key supplied
  as a non-secret verification placeholder.
- Chrome DevTools viewport sweep: 1920x1080, 2560x1440, 3840x2160,
  1440x900, 820x1180 bottom drawer, 960x412 right drawer, and 375x667.
- Root overlay reduced from 1,891 to 1,047 lines. Its remaining responsibility
  is the cross-boundary interaction and responsive-layout orchestration.
