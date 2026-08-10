# Sequence Actions Panel Decomposition

**Date:** 2026-08-09
**Status:** Approved and shipped
**Owner:** Create shared sequence actions

## Decision

Keep `SequenceActionsPanel.svelte` as the canonical composition and presentation
surface used by Construct, Assemble, Generate, and Spell. Move its inline
navigation lifecycle into a reactive state owner and its ordered sequence
operations into a strictly typed orchestrator.

The rendered action surfaces, public review props, responsive CSS, and existing
domain services remain in place.

## Evidence

The panel started at 1,439 scanner lines with 6 effects, 23 derived values, and
77 functions. Its 883-line script mixed:

- viewport and drawer presentation;
- persisted drill-down restoration;
- Direction, Duration, Extend, and help navigation;
- transform busy guards, undo ordering, haptics, and grid animation direction;
- pattern application and Duration preview lifecycle;
- extension analysis, bridge insertion, LOOP application, and orientation
  repeats;
- Construct transfer, first-step shifting, and admin JSON export.

The four-perspective monolith check converged 4/4:

- **Architecture:** panel navigation and action orchestration have independent
  lifecycles and dependencies.
- **Change safety:** undo ordering, busy guards, and preview cleanup can now be
  tested without rendering the full drawer.
- **Agent context:** operation changes no longer require loading responsive
  markup and CSS.
- **Skeptic:** the component remains the single UI owner. No thin markup or CSS
  wrappers were extracted to chase a lower line count.

## Capability ownership

The decomposition composes the existing canonical owners:

- active sequence state owns transforms and sequence mutation;
- `CreateModuleState` owns undo snapshots;
- `ExtensionFlowCoordinator` owns extension mechanics;
- `sequence-transfer-handler.ts` owns transfer checks and persistence ordering;
- `first-step-analyzer.ts` owns shift-start decisions and messages;
- `sequence-json-exporter.ts` owns clipboard serialization;
- `sub-drawer-state-persister.ts` owns session persistence;
- panel coordination state owns Duration preview and shift-start modes.

The previously tracked `sequence-actions-orchestrator.ts` and
`sequence-actions-subdrawer-state.svelte.ts` had no consumers. The former was
rewritten and activated; the obsolete drawer model was replaced instead of
preserving a second, stale navigation system.

## New boundaries

- `sequence-actions-panel-state.svelte.ts` owns inline navigation, persisted
  restoration decisions, transient Extend data, help state, dialog state, and
  transform/extension guards.
- `sequence-actions-orchestrator.ts` owns undo-before-action ordering, transform
  dispatch, extension workflows, pattern application, first-step execution,
  haptics, and failure cleanup while delegating domain mechanics.
- `SequenceActionsPanel.svelte` remains the sole markup/CSS owner and adapts
  orchestrator results to toasts, navigation, and panel coordination.

## Behavior locks

- undo snapshots occur before every sequence mutation;
- async transforms and extensions reject duplicate invocation while busy;
- restored Duration enters the same preview lifecycle as a direct entry;
- Back discards Duration preview, while Apply commits it before returning root;
- Extend is never session-persisted and an explicit restored Extend request is
  re-analyzed against the current sequence;
- Direction Back moves exactly one nesting level;
- sequence transfer saves Construct state before switching tabs;
- shift-start always exits coordination mode after success or failure;
- all responsive-review props remain unchanged.

## Verification

The final release gates passed:

- 25 focused state, orchestration, ownership, panel-height, help-flow, and
  Duration-preview tests passed across 6 files;
- the canonical Svelte checker, focused production lint, Prettier check, and
  `build:fast` completed successfully (5,397 SSR modules and 9,675 client
  modules transformed);
- the monolith score fell from 1,875 to 1,575, scanner lines fell from 1,439 to
  1,166, and function count fell from 77 to 66;
- the responsive review route passed at 375x667, 412x960, 960x412, 750x832,
  820x1180, 1440x900, 1920x1080, 2560x1440, and 3840x2160 with no overflow or
  undersized visible buttons;
- live interaction checks confirmed that Duration Apply returns to the actions
  root and Direction Result Back returns exactly one level to Reversals.

The isolated review console contained no application errors. Its only messages
were the expected missing PostHog key warning and the development tooling CSP
issue.
