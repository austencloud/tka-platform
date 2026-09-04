# Create Sequence Actions Interaction Model

**Status:** Approved, revised after live review
**Original date:** 2026-09-01
**Revision date:** 2026-09-03

## Outcome

Create has one visible entry point for sequence operations: the workspace
**Actions** button. It remains available at every width where Create shows
workspace controls, follows the existing labeled/compact responsive treatment,
and opens the designed Sequence Actions drawer.

The Create method header does not duplicate those actions. Its Shortcuts
control opens the keyboard reference, and an intentional Alt hold temporarily
reveals compact shortcut hints inside reserved header space. Those hints teach
keyboard use; they are not a second clickable action surface.

## Why the original header rail was rejected

The 2026-09-01 implementation exposed Mirror, Flip, Swap, Invert, Rotate Left,
Rotate Right, and More in the desktop header while hiding the workspace Actions
button. Live review showed three competing presentations of the same commands:
the plain header rail, the designed drawer, and Alt hints. Shortcut labels also
appeared in more than one presentation. The rail reduced visual quality without
making the system easier to understand, and More treated the primary drawer
like secondary overflow.

The original click count did establish a discoverability problem, but it did
not establish that individual transforms belonged in the header. The corrected
model makes the existing, visually intentional Actions entry point persistent
and measures its exposure directly.

## Capability ownership

- **Primary presentation:**
  `src/lib/features/create/shared/workspace-panel/shared/components/buttons/SequenceActionsButton.svelte`
  launches the designed Sequence Actions drawer.
- **Transform presentation:**
  `src/lib/shared/create/components/SequenceTransformActions.svelte` remains
  the canonical full action-tile surface.
- **Transform behavior:**
  `src/lib/features/create/shared/services/sequence-transform-action-dispatcher.ts`
  remains the shared owner for drawer and keyboard execution. It provides the
  busy guard, Undo snapshot, haptics, rotation direction, error propagation,
  and action-result analytics.
- **Keyboard reference:**
  `src/lib/features/create/shared/components/CreateShortcutHeader.svelte`
  owns the intentional Alt-hold hints and Shortcuts launcher.
- **Keyboard execution analytics:** the central `KeyboardShortcutManager`
  records matched shortcut execution. Individual registrations do not emit
  generic shortcut telemetry.

## Interaction contract

### Workspace Actions

- Show the full-size Actions button whenever the active Create state reports
  that sequence actions are available.
- Do not hide it at wide desktop breakpoints.
- Opening it uses source `workspace_button` and reveals the existing drawer.
- Keep all targeted-hand controls, transforms, First Step, Rewind, patterns,
  timing, extension, editing, and help inside the drawer.

### Header and Alt

- At rest, the header contains the creation-method breadcrumb and Shortcuts
  launcher. It contains no passive transform rail and no More action.
- An intentional Alt hold reveals shortcut hints in a reserved 44px header
  region, without moving the breadcrumb or Shortcuts launcher.
- Releasing Alt returns the reserved region to its empty state.
- An Alt chord executes its registered command and suppresses the transient
  hint reveal.
- Do not show this desktop keyboard affordance on coarse-pointer layouts.

## Analytics contract

Registered shortcut telemetry records only shortcuts that match and execute.
It never captures unmatched keys, arbitrary typing, input values, or
contenteditable text.

### Discovery funnel

- `sequence_action_surface_shown` with `source: workspace_button` records the
  first eligible Actions-button exposure per mounted workspace.
- `sequence_actions_opened` with `source: workspace_button` records the drawer
  open. Comparing these events provides the missing exposure-to-open rate.
- `keyboard_shortcut_hints_shown` records the Create header's intentional Alt
  hint reveal.
- `keyboard_shortcut_center_opened` records the explicit Shortcuts launcher.

### Execution events

- `keyboard_shortcut_executed`: shortcut ID, context, scope, key, modifiers,
  and whether it is a single-key binding.
- `keyboard_shortcut_failed`: the execution properties plus error name.
- `sequence_action_invoked`: action, source (`panel` or `keyboard` in the
  current UI; historical events may contain `header`), target hand, Create
  mode, step count, and start-position presence.
- `sequence_action_result`: invocation properties plus completed, busy,
  unavailable, or failed outcome and duration.

All events use the guarded PostHog capture owner, which is a no-op in local
development and swallows SDK failures.

## Verification contract

- Focused unit tests cover Alt intent, effective shortcut bindings, dispatcher
  execution, keyboard matching and suppression, and panel orchestration.
- `svelte-check` covers the Svelte and TypeScript integration.
- Visual inspection covers 375x667, 960x412, 820x1180, 1440x900, 1920x1080,
  2560x1440, and 3840x2160, plus 200 percent zoom behavior.
- Runtime interaction verifies that Actions stays visible on wide desktop,
  opens the designed drawer, Alt changes only the reserved header region,
  and the console remains clean.

## Decision record

- **2026-09-01:** keyboard actions must be tracked comprehensively at the
  central execution boundary.
- **2026-09-01:** a wide desktop header rail was approved for evaluation.
- **2026-09-03:** live review rejected the rail and More overflow because they
  created redundant, visually inconsistent representations. The persistent
  workspace Actions launcher and designed drawer became the approved action
  hierarchy. Alt remains a transient keyboard reference.
