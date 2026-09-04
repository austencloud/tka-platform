# Create Sequence Actions Handoff for Fable 5.1

**Date:** 2026-09-03
**Status:** Integrated into local `main`; no implementation work in flight
**Audience:** Fable 5.1 cold start

## Mission

Preserve and evaluate the approved Create sequence-action hierarchy:

1. The persistent workspace **Actions** launcher is the single visible entry
   point.
2. The existing designed Sequence Actions drawer is the primary clickable
   action surface.
3. Holding Alt is a transient keyboard reference, not another action surface.
4. Keyboard and sequence-action telemetry stay centralized and complete enough
   to measure exposure, opening, execution, outcomes, and failures without
   recording arbitrary typing.

The governing decision is
[Create Sequence Actions Interaction Model](./2026-09-01-create-header-sequence-actions-design.md).

## Done — verified

### 1. One visible action hierarchy

**Commit:** `6cabd93fe552a483fa0588a4881a2104145b7aab`
(`fix(create): unify sequence action discovery`)

**Local-main integration:** `501bf8c47e39071283472c28073d2473105d4492`

- Removed `CreateSequenceActionRail.svelte`, including Mirror, Flip, Swap,
  Invert, Rotate Left, Rotate Right, and More from the passive desktop header.
- Removed the header-specific transform handlers and responsive container branch
  from
  [CreateModule.svelte](../../../src/lib/features/create/shared/components/CreateModule.svelte).
- Restored the workspace Actions launcher at wide desktop widths by removing
  the CSS that hid it in
  [ButtonPanel.svelte](../../../src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte).
- Kept the header's reserved Alt-hint region and Shortcuts launcher in
  [CreateShortcutHeader.svelte](../../../src/lib/features/create/shared/components/CreateShortcutHeader.svelte).
- Revised the design record after live review so the rejected header-rail
  contract is no longer presented as current.

**Evidence:**

- Chrome DevTools verified `https://localhost:5173/create/construct` at
  375x667 touch, 820x1180 touch, 960x412 touch landscape, 1440x900,
  1920x1080, 2560x1440, 3840x2160, and a 960x540 CSS viewport at 2x device
  scale for the 200 percent case.
- The Actions launcher was in the viewport at every size. Observed geometry was
  44x44 at 375 and constrained desktop, 48x48 at touch landscape and the 200
  percent case, and 113x44 when the responsive label fit.
- No viewport reported horizontal overflow.
- At desktop widths, the only visible header buttons were Back to Create and
  Open Create keyboard shortcuts. No passive transform or More button remained.
- Clicking Actions opened the existing `Sequence Actions` modal with Apply To,
  Transform, Patterns, and Edit sections.
- The live page reported no console warnings or errors after the interaction and
  viewport sweep.

### 2. Alt is a stable transient guide

**Commit:** `6cabd93fe552a483fa0588a4881a2104145b7aab`

- Alt reveals the registered effective bindings for rotate, Mirror, Flip, Swap,
  Invert, First Step, Rewind, and prop presets.
- It does not replace or restyle a passive action rail because no such rail now
  exists.
- Coarse-pointer layouts do not show the desktop-only header affordance.

**Evidence:**

- At 1920x1080, the header stayed at `x=64, y=0, w=1846, h=52.67` before and
  during Alt.
- The Shortcuts launcher stayed at `x=1752.67, y=4, w=141.33, h=44` before and
  during Alt.
- The hint region became visible inside the reserved 44px slot without overflow
  or workspace movement.
- `create-alt-shortcut-hints.test.ts` and `alt-hold-intent.test.ts` contributed
  7 passing focused assertions.

### 3. Shared action execution and complete keyboard telemetry remain intact

**Commit:** `a50a7b01b90a0e12d31121a218158226aa9b0db2`
(`feat(create): expose tracked sequence actions`)

- Drawer and keyboard transforms delegate to
  [sequence-transform-action-dispatcher.ts](../../../src/lib/features/create/shared/services/sequence-transform-action-dispatcher.ts).
- The dispatcher owns Undo snapshots, the busy guard, haptics, rotation
  direction, errors, and `sequence_action_invoked` / `sequence_action_result`.
- The central keyboard manager emits `keyboard_shortcut_executed` only after a
  registered shortcut matches and runs, plus `keyboard_shortcut_failed` on a
  rejected action.
- Suppressed shortcuts, unmatched keys, and editing inside form or
  contenteditable targets are not captured.
- Drawer-open sources are recorded by panel coordination state.

**Evidence:**

- The post-merge focused test run passed 25/25 assertions across Alt intent,
  effective binding presentation, the transform dispatcher, the sequence-action
  orchestrator, and the keyboard shortcut manager.
- `svelte-check --tsconfig ./tsconfig.json` reported 0 errors and 0 warnings
  after merging the current `main` into the task branch.
- `ButtonPanel.svelte.test.ts` passed 4/4 browser-component geometry assertions.
  Vitest also printed a dependency-scan optimization warning, but the component
  test completed successfully with exit code 0.

### 4. The Actions funnel now has a denominator

**Commit:** `6cabd93fe552a483fa0588a4881a2104145b7aab`

- `ButtonPanel.svelte` emits `sequence_action_surface_shown` with
  `source: workspace_button` once per mounted workspace when Actions becomes
  both eligible and visible.
- Opening the drawer from that button emits `sequence_actions_opened` with the
  same source.
- This makes exposure-to-open conversion measurable instead of comparing opens
  to all Create sessions.

## Believed done — unverified

- Production PostHog receipt is not verified locally. The guarded capture owner
  intentionally becomes a no-op when the local environment has no PostHog key.
- Real-user preference and conversion are not established by implementation
  proof. The hierarchy is visually and mechanically verified, but it needs
  production behavior data after deployment.
- The one-impression-per-mounted-workspace boundary is the intended product
  denominator. It has not yet been compared with a unique-session denominator
  in a production dashboard.

## In flight

None. The code and revised decision record are integrated into local `main`.

## Loose ends, ranked

1. **P0 — Verify production receipt after deployment.** Confirm that
   `sequence_action_surface_shown`, `sequence_actions_opened`,
   `sequence_action_invoked`, `sequence_action_result`,
   `keyboard_shortcut_executed`, and `keyboard_shortcut_failed` arrive with the
   documented properties.
2. **P1 — Build the discovery funnel.** Compare unique users and mounted
   exposures for `workspace_button` shown → opened, then opened → first
   successful transform. Segment by Create mode and viewport class.
3. **P1 — Check shortcut adoption.** Compare action execution by `panel` and
   `keyboard`, and correlate `keyboard_shortcut_hints_shown` or
   `keyboard_shortcut_center_opened` with later keyboard execution.
4. **P2 — Watch for accidental execution.** Use immediate Undo after a
   completed action, broken down by source and action, as a directional signal.
5. **P2 — If discovery remains weak, improve the existing Actions launcher or
   drawer invitation.** Do not reintroduce a parallel header rail without new
   evidence that justifies the redundancy.

## Decisions already made

- The designed Sequence Actions drawer is the primary action surface.
- The workspace Actions launcher remains present on wide desktop. Its label may
  collapse to the existing icon-only responsive state when space is constrained.
- The Create header is for method identity and keyboard reference, not a second
  transform toolbar.
- Alt is transient help. It may reveal shortcut labels, but it does not create
  another clickable representation of the commands.
- The header More button and `CreateSequenceActionRail` are intentionally gone.
- Drawer and keyboard commands share one dispatcher. A new source must extend
  that owner instead of calling sequence state directly.
- Generic keyboard analytics belong at the central match-and-execute boundary.
  Arbitrary keydowns and text input must never be tracked.
- The analytics source union still accepts historical `header` events for data
  compatibility. No current UI invokes sequence actions from the header.

## Gotchas

- Do not recreate `CreateSequenceActionRail.svelte`; its deletion is deliberate.
- `sequence_action_surface_shown` is guarded by `showSequenceActions`, the
  ButtonPanel `visible` prop, and a once-per-mount flag. Moving the event earlier
  would count unavailable or hidden launchers.
- `sequence_actions_opened` also has legitimate non-button sources such as
  `restore`, `step_edit`, and `workflow`; filter to `workspace_button` for the
  direct launcher funnel.
- Alt-hold intent has a deliberate delay and cancels when the user begins an
  Alt chord. A synthetic press-and-release can be too fast to reveal the guide.
- Local PostHog silence is expected when no key is configured. Verify event
  payloads through tests and production receipt, not by weakening the guard.
- Create's first cold development load can take tens of seconds while Vite
  optimizes dependencies. A transient `504 Outdated Optimize Dep` during that
  first optimization cycle is development infrastructure noise, not an action
  hierarchy failure.
- The primary checkout contained unrelated edits to
  `scripts/audit-frame-budget.mjs` and an untracked Flow Fest site-marker JSON
  when this handoff was created. They were not touched by this work.

## Verification commands used

```text
pnpm exec vitest run --config tests/config/vitest.config.ts \
  src/lib/features/create/shared/components/create-alt-shortcut-hints.test.ts \
  src/lib/features/create/shared/components/alt-hold-intent.test.ts \
  tests/unit/features/create/sequence-transform-action-dispatcher.test.ts \
  tests/unit/create/sequence-actions-orchestrator.test.ts \
  src/lib/shared/keyboard/services/keyboard-shortcut-manager.test.ts

node scripts/svelte-kit-sync-if-needed.mjs
pnpm exec svelte-check --tsconfig ./tsconfig.json

pnpm exec vitest run --config tests/config/vitest.components.config.ts \
  src/lib/features/create/shared/workspace-panel/shared/components/ButtonPanel.svelte.test.ts
```
