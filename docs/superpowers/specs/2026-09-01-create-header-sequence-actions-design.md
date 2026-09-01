# Create Header Sequence Actions

**Status:** Approved
**Date:** 2026-09-01

## Outcome

Wide Create workspaces expose the six immediate geometric transforms in the
existing method header: Mirror, Flip, Swap, Invert, Rotate Left, and Rotate
Right. The complete Sequence Actions drawer remains the owner of targeted-hand
transforms, First Step, Rewind, patterns, timing, extension, editing, and help.

The header rail is progressive disclosure in both directions: common,
reversible actions become visible when the workspace can fit them, while the
specialized workflows stay in More Actions. Narrow and coarse-pointer layouts
keep the existing workspace Actions trigger.

## Evidence

A production PostHog query on 2026-09-01 found five sessions that clicked the
visible Actions trigger among 263 Create sessions, or five among 128 sessions
that produced a create/save/autosave/export/share event. At least two of those
five sessions immediately tried several transforms. This is directional rather
than causal because restored-open panels and keyboard shortcuts were not
explicitly instrumented.

The existing attract intention also records the discoverability problem in
`src/lib/shared/attract/intentions/sequence-actions.ts`: users could not see the
Sequence Actions surface and may not have known it existed.

## Capability ownership

- **Transform behavior:** reuse
  `src/lib/shared/create/services/sequence-transformer.ts` through the active
  Create sequence state.
- **Create action orchestration:** extend
  `src/lib/features/create/shared/services/sequence-actions-orchestrator.ts`
  with one shared transform dispatcher for drawer, header, and keyboard.
- **Action presentation:** compose `PanelButton` in a small Create-specific
  header rail. The canonical full action-tile presentation remains
  `src/lib/shared/create/components/SequenceTransformActions.svelte`.
- **Keyboard execution analytics:** extend the central
  `KeyboardShortcutManager` execution boundary. No individual registration
  should need to remember generic keyboard telemetry.
- **Motion:** use the canonical `Crossfade` owner inside a reserved 44px header
  slot. Alt hints and normal commands replace each other without reflow.

## Interaction contract

### Wide, fine-pointer workspaces

- Show Mirror, Flip, Swap, Invert, Rotate Left, Rotate Right, and More Actions.
- Every quick transform applies to both hands. A hidden hand selection from the
  drawer must never change a header command's meaning.
- More Actions opens the existing drawer.
- Hide the lower workspace Actions trigger at the same container threshold to
  avoid duplicate launchers.
- Holding Alt replaces the rail in its reserved slot with the existing shortcut
  hints. Releasing Alt restores the rail.

### Narrow or coarse-pointer workspaces

- Do not show the header rail.
- Keep the existing workspace Actions trigger and full drawer behavior.
- Preserve every capability; the responsive treatment only changes placement.

### Availability and safety

- Reserve the header slot before a sequence is available so sequence creation
  does not move the method breadcrumb or Shortcuts button.
- Reveal commands only when Create reports a start position or sequence steps.
- The shared dispatcher owns the busy guard, Undo snapshot, haptics, rotation
  direction state, error propagation, and analytics for every source.

## Analytics contract

Registered shortcut telemetry records only shortcuts that actually match and
execute. It must never capture unmatched keys, arbitrary typing, input values,
or contenteditable text.

### `keyboard_shortcut_executed`

- `shortcut_id`
- `context`
- `scope`
- `key`
- `modifiers`
- `is_single_key`

### `keyboard_shortcut_failed`

- all execution properties above
- `error_name`

### Discovery events

- `keyboard_shortcut_hints_shown` records the Create header's intentional Alt
  hint reveal.
- `keyboard_shortcut_center_opened` records the explicit Shortcuts launcher.

### `sequence_action_invoked`

- `action`
- `source`: `header`, `panel`, or `keyboard`
- `target_hand`
- `create_mode`
- `step_count`
- `has_start_position`

### `sequence_action_result`

- invocation properties above
- `outcome`: `completed`, `busy`, `unavailable`, or `failed`
- `duration_ms`

### Surface events

- `sequence_action_surface_shown` identifies the responsive header exposure.
- `sequence_actions_opened` identifies every full-drawer open and its source.

## Risks and mitigations

- **Header crowding:** the rail appears only when the named Create workspace
  container is at least the verified wide threshold. Buttons size to content
  and never stretch.
- **Accidental transforms:** all targets remain at least 44px, unavailable
  actions are non-interactive, Undo snapshots are shared across every source,
  and immediate Undo can be analyzed against the explicit source event.
- **Behavior drift:** drawer, header, and sequence-transform keyboard shortcuts
  delegate to one dispatcher rather than calling sequence state independently.
- **Invisible target state:** header and keyboard commands explicitly target
  both hands. Single-hand targeting remains visible inside the drawer.
- **Analytics affecting product behavior:** all events route through the
  existing guarded PostHog capture owner, which is a no-op in development and
  swallows SDK failures.

## Verification

- Focused unit tests prove shortcut telemetry fires only for an executed match,
  failure telemetry is emitted on rejection, and suppressed/unmatched/input
  events remain untracked.
- Dispatcher tests prove action-to-Undo mapping, source/target properties,
  rotation direction, busy rejection, and failure telemetry.
- Typecheck the cross-file context/global-ref changes once before commit.
- Inspect the Create workspace at 375x667, 960x412, 820x1180, 1440x900,
  1920x1080, 2560x1440, and 3840x2160, plus 200 percent zoom behavior.
- Exercise sequence unavailable/available, Alt press/release, More Actions,
  header execution, keyboard execution, Undo, reduced motion, 44px targets,
  overflow, and console errors.
