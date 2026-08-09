# Sequence Viewer Shell Decomposition

**Date:** 2026-08-09
**Status:** Shipped
**Owner:** Shared sequence viewer

## Decision

Keep `SequenceViewerShell.svelte` as the one canonical viewer chrome component.
Move its component-scoped layout state, share state, instrumented interaction
handlers, and analytics payload construction into named owners beside it.

The host prop contract, rendered markup, scoped CSS, and all child component
ownership remain unchanged.

## Evidence

The shell started at 1,826 lines with a 1,088-line script. That script mixed:

- responsive device subscriptions and export-width decisions;
- viewer mode transitions and progressive card-to-split promotion;
- share menu feedback, link copying, inbox sending, and Sticker Lab handoff;
- scan analytics for playback, practice, export, art, management, and settings;
- export, delete, video upload, and practice event adapters;
- presentation composition for the canonical header, rail, panes, exports,
  practice workstation, and dialogs.

The monolith four-perspective check converged 4/4:

- **Architecture:** the shell remains the canonical chrome boundary while
  component-local coordination receives explicit owners.
- **Change safety:** analytics, sharing, and responsive behavior can change
  without editing unrelated markup or CSS.
- **Agent context:** future tasks can load one interaction or layout owner
  instead of the complete shell.
- **Skeptic:** this separates independently changing behavior rather than
  moving markup to chase a lower line count.

## Capability Ownership

Searches for `captureScanAction`, `handlePracticeSetConfig`, and viewer action
gating found the existing owners that this refactor must compose:

- `SequenceViewerOrchestrator.svelte` owns viewer and playback behavior.
- `playback-controller.svelte.ts` owns playback and practice execution.
- `scan-analytics.ts` owns event capture and session attribution.
- `viewer-actions.ts` owns header action eligibility.
- `SequenceViewerShell.svelte` owns all shared chrome and its host prop seam.

No capability is reimplemented. The extracted handlers adapt shell events to
those owners and preserve their current order of operations.

## Target Structure

- `state/viewer-shell-layout-state.svelte.ts` owns responsive subscriptions,
  export layout decisions, mode selection, and initial-view promotion.
- `state/viewer-shell-share-state.svelte.ts` owns share menu feedback and share
  action routing.
- `state/viewer-shell-interaction-state.svelte.ts` owns instrumented shell
  actions, export state, practice events, and delete state.
- `services/viewer-shell-model.ts` owns pure width, share-menu, and analytics
  payload calculations.
- `SequenceViewerShell.svelte` remains the composition root and sole markup/CSS
  owner.

## Behavior Locks

- all hosts continue to render the same shell;
- the 768px host breakpoint and export-narrow fallback remain unchanged;
- saved rail width still raises the export sidebar threshold only from 72 to
  300 pixels;
- scan view, playback, practice, export, and setting events keep their current
  payload fields and ordering;
- copy-link feedback resets after 1.8 seconds and leaves the share menu open;
- card-first scan entry promotes only after card readiness and two painted
  frames;
- stale art exports are recorded as canceled during scan-session cleanup;
- delete confirmation closes and clears its busy state even when deletion
  fails.

## Verification

Focused tests cover the shell anti-drift contract, scan analytics runtime,
responsive threshold math, share action labels, analytics payloads, action
gating, practice, autoplay, visibility, and pane lifetime. The final related
suite passed 134 tests across 19 files.

The production SvelteKit build completed through the Cloudflare adapter with a
command-scoped placeholder for the required public Google Maps key. The shell
fell from 1,826 lines with a 1,088-line script to 997 lines with a 255-line
script. The remaining file is the canonical presentation and composition owner.

The refactor does not move or edit markup or CSS. Visual output is expected to
remain byte-for-byte equivalent at the template and style boundaries, so a new
screenshot baseline is not required unless implementation changes those
boundaries.
