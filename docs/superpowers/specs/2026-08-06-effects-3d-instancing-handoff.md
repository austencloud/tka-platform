# 3D Effects Full Roster and Animal Motion — Handoff (2026-08-06)

## Mission

Give the 3D viewer the same canonical sixteen effects as the other effect
surfaces, render every one through bounded scene-level infrastructure, and make
Animal read as a creature attached to the physical prop tip. The governing
spec is [Full 3D Effect Roster Design](2026-08-06-effects-3d-full-roster-design.md).
The roster and native renderers are landed. The work is not finished: the
latest stationary Animal pose has not been observed in a live frame, the effort
selection correction is still uncommitted, Ghost needs its original visual
repro checked, and the completed batching architecture has not been profiled.

## Done — verified

### Canonical sixteen-effect picker and native roster

Commit `7b03f69194141d53a835b595526c3efb515fcb63` lands the canonical picker,
scene-effect coordinator, pooled renderers, and the formerly missing Ink, Silk,
Animal, and Pulse renderers. Motion remains a separate scene modifier.

Evidence from 2026-08-06, run after that commit landed:

- `pnpm vitest run --config tests/config/vitest.config.ts tests/unit/3d-effects`
  passed 12 files and 84 tests.
- `tests/unit/effects/full-roster-3d-panel-contract.test.ts` passed 3/3. It
  asserts direct use of the canonical registry, keeps Motion separate, and
  checks all four new effects are resolved and published.
- `tests/unit/effects/effect-orchestrator-mounts-layer.test.ts` passed 11/11.
- The HTTPS route probe returned HTTP 200 with `x-sveltekit-page: true`.

The original 16-cell test grid and pre-batching baseline landed in
`2c12f8fb34`. Before the scene-level rewrite it measured:

```text
2,547 draw calls | 4,180 geometries | 802 textures | 23,852 triangles | 1 FPS
```

That number explains why batching was required. It is not a current benchmark.

### Per-rig physical tip motion and Ghost's rig-local anchor

Commit `7b03f69194141d53a835b595526c3efb515fcb63` replaces shared prop-center
motion with each rig's physical tip positions and real delta-time velocity. It
also applies the same hand-anchor displacement to Ghost captures that the live
props receive.

Evidence from the current test run:

- `tests/unit/3d-effects/tip-position-bridge.test.ts` passed 15/15, including
  stationary-center rotation, isolated histories, and rig-local hand-anchor
  displacement.
- `tests/unit/effects/effect-orchestrator-mounts-layer.test.ts` passed 11/11,
  including physical tip publication, no process-wide motion history, and
  matching hand anchors for both Ghost renderers.

### Animal renderer and six-preset comparison page

Commit `7b03f69194141d53a835b595526c3efb515fcb63` contains the instanced Animal
anatomy, fixed-length sampled spine, six production presets, and the comparison
page at:

```text
https://localhost:5173/test/effect-grid?view=animal-presets
```

Austen observed all six presets live on 2026-08-06 and called them "cute as
hell." After the first revision, Austen confirmed the different sequence was
"one step closer." The comparison page now assigns Animal only to blue prop
tip `0-1`; its wildcard maps every other tip to `none`. It uses the existing
`gallery-practice-seq` A/B/D drill instead of the center-biased loop that hid
endpoint travel.

### Animal endpoint and stationary-body math

Commit `7b03f69194141d53a835b595526c3efb515fcb63` also contains the latest Animal
math:

- The visible head reads the exact live endpoint every frame even when path
  retention skips sub-2.8 cm samples.
- No-motion fallback points toward world-down `(0, -1, 0)`, not stage-left.
- A frame-rate-independent blend settles the fixed-length spine under its
  pinned head.
- Slither amplitude reaches zero when endpoint speed reaches zero.
- Motion releases the gravity blend faster than rest applies it.

Evidence from the current run:

- `tests/unit/3d-effects/animal-spine-3d.test.ts` passed 6/6. It covers a
  gravity-hung fixed-length spine, zero stationary wag, 30/60 FPS settling
  equivalence, rotation-minimizing frames, head pinning, and silhouette
  differences.
- `tests/unit/3d-effects/full-roster-renderers-3d.test.ts` passed 8/8. Its
  regression builds horizontal motion history, holds the endpoint still for
  two seconds, confirms the tail finishes below the head at full authored
  length, and measures less than 1 mm of movement on the next idle frame.

This proves the coordinates written to the instance buffers. It does not prove
the final silhouette looks right in motion.

## Believed done — unverified

### Latest Animal gravity pose

The gravity and zero-speed slither corrections are committed and test-proven,
but no post-change screenshot was captured. Chrome stayed alive on debug port
9222 while every Chrome DevTools MCP call returned `Transport closed`, including
after `scripts/launch-chrome-debug.ps1` reattached to the existing process.

The unresolved visual questions are:

- Does the tail settle down naturally during holds, or does the full vertical
  equilibrium read as a dangling ribbon?
- Is the settle rate slow enough to avoid a snap but fast enough to be visible
  during one held beat?
- Does the faster release preserve the traced gesture as motion resumes?
- Do dragon wings and caterpillar legs remain readable when the spine is
  vertical?

### Ghost displacement

The captured center now uses `resolveRigLocalPropCenter3D(propState.worldPosition,
handAnchor)`, and tests prove that offset. The original real-viewer repro was
not repeated after the change. Austen's repro was that Ghost phantoms lacked
the live prop's forward hand displacement, so old props appeared closer to the
performer and stabbed through the body.

### Current all-sixteen performance

The scene-level pools, shared atlases, fixed capacities, and coordinator are
landed. No current `window.__gridPerf` capture exists after all sixteen have
been active. The old 1 FPS baseline and the intermediate 398-call result are
superseded measurements.

## In flight

Branch: `main`. No worktree.

One effect-related file remains uncommitted:

```text
 M src/lib/shared/3d/components/controls/PerformerHubDetail.svelte
```

Its `currentEffort` derived value now handles All Performers mode by reading
every performer's `effectiveEffortId`. If all performers agree, that effort is
selected; mixed values produce `null`. The previous code always read the viewer
default, leaving Linear highlighted after every performer visibly changed to a
different effort.

This patch has no focused test, no screenshot, and no commit. Treat it as an
implementation candidate, not a completed fix.

The rest of the working tree is heavily dirty from unrelated concurrent Museum,
Autumn, camera, Ink, asset, and document work. Do not revert or stage any of it.
Re-read `git status` immediately before every commit.

## Loose ends (ranked)

### 1. Observe the latest Animal motion in the live comparison page

Start or reuse Chrome only through `scripts/launch-chrome-debug.ps1`. Open a
task-owned background tab through Chrome DevTools MCP at:

```text
https://localhost:5173/test/effect-grid?view=animal-presets
```

Watch at least one full loop. Inspect the stationary holds and the transition
back into travel. The required result is one creature per station, head pinned
to the blue right endpoint, tail settling toward world-down without lateral
wag, and no snap when movement resumes. Capture a WebP frame only after reading
the motion through a full loop.

### 2. Tune the production Animal renderer from that frame

If the pose is still wrong, change the renderer, not the comparison sequence.
The relevant controls are in:

- `src/lib/shared/3d/effects/animal/animal-spine-3d.ts`
  - `IDLE_SPEED_START = 0.08`
  - `IDLE_SPEED_END = 0.72`
  - `GRAVITY_SETTLE_RATE = 4.2`
  - `GRAVITY_RELEASE_RATE = 9`
  - stationary slither activity thresholds `0.02` and `0.34`
- `src/lib/shared/3d/effects/animal/animal-renderer-3d.ts`
  - live head position, retained path sampling, gravity blend state, and
    world-down fallback

Keep the exact endpoint pin, fixed authored body length, bounded history, and
instanced anatomy. Add or adjust a math regression before changing the settle
model.

### 3. Finish the All Performers effort-selection fix

Audit the uncommitted `PerformerHubDetail.svelte` diff. Verify these states:

1. All performers share Linear: Linear is selected.
2. Selecting another effort for All Performers updates the selected button.
3. Performers have mixed effort overrides: no single button is selected.
4. Single-performer scope still follows that performer's effective effort.

Add a focused state/contract test if the component's derived state can be
extracted without testing Svelte rendering. Commit only this file and its test.

### 4. Repeat the original Ghost repro

In the real 3D viewer, apply Ghost and use a pose where the hand-anchor offset
is visually obvious. Compare a fresh phantom with the live prop. The phantom
center must occupy the prior live prop center, including the forward rig-local
offset, rather than intersecting the performer.

### 5. Resolve the current batching-contract failure

The combined focused command currently reports 105 passed and 1 failed. The
failure is:

```text
tests/unit/effects/scene-effects-batching-contract.test.ts
initializes the scene coordinator with Threlte's direct Scene value
Expected: manager.initialize(scene)
Received code: manager.initialize(parent ?? scene)
```

`SceneEffectsCoordinator3D.svelte` now supports an optional explicit parent.
Determine whether the new parent behavior is intentional. If so, update the
contract to accept `parent ?? scene` while retaining the `scene.current`
prohibition. If not, fix the coordinator. Do not call the focused suite green
until this is resolved.

### 6. Re-profile all sixteen effects

Use `/test/effect-grid` and its `window.__gridPerf` probe after every cell has
emitted. Record calls, triangles, geometries, textures, and FPS at 1920x1080 and
3840x2160. The target architecture is one scene-level renderer per effect type
with stable geometry and texture counts. A low call count with missing particles
does not count as success.

### 7. Complete a real-viewer parity sweep

Confirm the real 3D picker shows the same sixteen effects in the canonical
order, Motion remains separate, and each newly exposed effect produces a
visible result. Check at least Ink, Silk, Animal, and Pulse in a normal sequence
viewer, not only the test page.

## Decisions already made

- **2026-08-06, Austen:** the 3D picker must expose the same sixteen effects as
  the other effect surface. "Full send" authorized the full native roster.
- **2026-08-06, Austen:** Animal receives the production pass. "FULL SEND ON
  ANIMAL!"
- **2026-08-06, Austen:** all Animal presets belong side by side on a test page
  for direct comparison.
- **2026-08-06, Austen:** the Animal must trace the physical prop endpoint. A
  body attached near the prop or stuck at the middle is wrong.
- **2026-08-06, Austen:** the previous center-biased sequence was a bad review
  input. The comparison page now uses the existing mixed A/B/D drill.
- **2026-08-06, Austen:** a stationary Animal needs a gravity-aware tail. The
  tail must know which direction to settle instead of jerking sideways.
- **2026-08-06, Austen:** changing the All Performers effort must change the
  selected effort button.
- **2026-08-06, Austen:** Ghost phantoms need the same forward displacement as
  the live props.
- **2026-08-06, Austen:** all sixteen effects must remain efficient when active
  together. Missing output is not a performance win.
- Work stays on `main`; no branch or worktree was requested.

## Gotchas

### A parallel commit captured the completed roster during this handoff audit

At 17:05:47 CDT on 2026-08-06, another live session committed the full roster,
Animal gravity work, comparison page, and tests as
`7b03f69194141d53a835b595526c3efb515fcb63`. Those files are committed even
though they were untracked earlier in the session. Confirm HEAD and file status
instead of trusting old terminal output.

### Chrome DevTools transport was dead, not Chrome

`scripts/launch-chrome-debug.ps1` reported Chrome 151 running on port 9222 and
returned its browser WebSocket URL. Chrome DevTools MCP still returned
`Transport closed`. A fresh Codex session should reconnect the MCP transport.
Do not use raw CDP scripts or another browser runtime; current `AGENTS.md`
requires Chrome DevTools MCP and the shared launcher.

### HTTPS only

Port 5173 is Austen's shared server. Use `https://localhost:5173`, never HTTP.
Do not restart, stop, or kill it.

### Animal is a hybrid path follower, not a free rope simulation

Movement samples a bounded tip history at fixed arc length. Gravity is a
downstream equilibrium blend applied only as speed falls. This preserves the
drawn gesture while moving and prevents arbitrary tail direction at rest.
Replacing it with an unconstrained rope would throw away the endpoint-tracing
requirement.

### The comparison page intentionally isolates one tip

The earlier mirrored V silhouette was two complete creatures attached to
co-located endpoints. `AnimalPresetStation.svelte` maps wildcard tips to `none`
and assigns Animal only to `0-1`. Do not restore the wildcard Animal mapping.

### One focused contract is red

The current combined run is 105 passed and 1 failed because the batching
contract expects the pre-parent coordinator string. The 12-file 3D-effects
directory remains 84/84 green. Preserve that distinction in status reports.

### Shared checkout and index

Other sessions are actively changing and committing this checkout. Commit with
explicit pathspecs only. Never stage broadly, never revert unrelated files, and
check HEAD again immediately before pushing.

### Expert routing

`.claude/rules/expert-routing.md` has no expert owner for 3D effects. No expert
agent canon file was updated.
