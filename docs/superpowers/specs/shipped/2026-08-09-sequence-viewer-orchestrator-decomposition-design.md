# Sequence Viewer Orchestrator Decomposition

**Date:** 2026-08-09
**Status:** Approved and shipped

## Problem

`SequenceViewerOrchestrator.svelte` is the canonical state host for every
sequence viewer surface. Before this change it was 1,589 lines with 11 effects,
23 derived values, and 117 functions. Its rendered surface was only the child
snippet, an accessibility announcer, and the shared authentication modal. The
rest mixed the public context type, interactive service startup, playback
presentation, LAN synchronization, share metadata, navigation actions, and
context assembly.

That coupling is costly for agent-driven work. A change to share metadata or
video beat highlighting required loading the same file that owns animation
startup, 3D activation, export coordination, authentication replay, and
practice wiring.

## Four-perspective decision

- **Architect:** Extracted owners align with observable behaviors and preserve
  the orchestrator as the component-scoped composition root.
- **Change safety:** Service startup, playback presentation, LAN sync, editing,
  3D activation, prop visibility, sharing, destinations, and the public context
  contract can change independently.
- **Agent context:** Focused tasks can load one named owner instead of the full
  viewer lifecycle.
- **Skeptic:** This is not a line-count split. Each extracted area has its own
  state transitions, silent calculation risks, or public contract.

All four perspectives support decomposition.

## Existing capability owners

Searches used `playback controller`, `export coordinator`, `auth action queue`,
`library action`, `viewer context`, `share link`, and `LAN sync`. The existing
playback, export, authentication, image-composition, fullscreen, and library
controllers remain canonical. This change composes those owners and does not
reimplement their behavior.

## New boundaries

- `domain/viewer-orchestrator-context.ts` owns the public context contract and
  its view/export/playback source types. Consumers no longer import types from
  a Svelte component.
- `services/viewer-orchestrator-model.ts` owns pure calculations for edit/export
  modes, play duration, card layout equality, share metadata, browser handoff,
  and playback presentation.
- `state/viewer-interactive-services-state.svelte.ts` owns lazy animation and
  LAN service startup, sequence hydration, prewarming, autoplay readiness, and
  cleanup.
- `state/viewer-playback-presentation-state.svelte.ts` owns animation/video
  source selection and the currently presented beat, step, and letter.
- `state/viewer-lan-sync-state.svelte.ts` owns remote playback application and
  the local synchronization toggle lifecycle.
- `state/viewer-orchestrator-context-state.svelte.ts` assembles the stable
  public context from the focused owners.
- `state/viewer-edit-mode-state.svelte.ts` owns edit-mode transitions and the
  image, video, and art export entry points.
- `state/viewer-3d-activation-state.svelte.ts` owns route, URL, and responsive
  3D activation effects.
- `state/viewer-prop-visibility-state.svelte.ts` owns selected-prop state,
  hand-path overrides, prop visibility, and dark-mode actions.
- `services/viewer-destination-actions.ts` owns navigation to Compose, edit,
  and video-upload destinations.
- `services/viewer-share-actions.ts` owns native sharing, link copying, share
  analytics, and Android browser handoff.

`SequenceViewerOrchestrator.svelte` remains responsible for component setup,
context installation, lifecycle effects, host props, user-action composition,
and the small rendered auth/accessibility surface. It is 691 lines after the
extraction, down 898 lines (56.5%).

## Verification

- Pure model tests cover calculations whose wrong output could look plausible.
- A source contract test locks the ownership boundaries and bans moving the
  extracted implementations back into the component.
- The existing viewer, scan, autoplay, practice, visibility, fullscreen, and
  analytics suites run before and after the change.
- A production build proves the Svelte cross-file reactive boundary compiles.
- Markup and scoped CSS are compared before and after. This refactor is not
  intended to change pixels.
