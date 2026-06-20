# Dodge Lab Tab — Design

**Date:** 2026-06-19
**Status:** Approved for planning
**Author:** Austen + Claude

## Goal

Promote the prop-dodge prototype (`/test/mm-dodge`) into a permanent **Dodge** tab
in the Lab module, sibling to the Collision Lab, sharing the
`StanceSimulator`/`StanceOptimizer` it already builds on. No behavior change — the
same live dodge (real-rig body model, swept volume, locomotion + arm IK,
reach-follow, manual scrubbing, numbered floor grid, clearance readout) becomes a
first-class lab tool instead of a throwaway test route.

## Why a sibling tab (not merged into Collision Lab)

Collision Lab is **static-pose**: its `PoseViewport` renders one fixed pose via
the shared `Scene3D`, driven by stance sliders, and labels poses for collision
safety. The dodge is **live-animated**: a per-frame `useTask` loop runs the
`MmLocomotionController` (clip playback + foot-lock), arm IK, and the reach-follow
each frame. Merging would put two unrelated render loops + two UIs + two camera
models in one component. They share *services*, not a viewport — so they are
sibling tabs.

## Architecture

A new tab `dodge` registered through the established two-point pattern:

1. **`tab-definitions.ts`** — add an entry to `LAB_TABS`:
   `{ id: "dodge", groupId: "physical", labelKey: "tab_lab_dodge",
      descKey: "tab_desc_lab_dodge", label: "Dodge", icon: <fa>, color, gradient,
      description: "Step a performer clear of a prop while the hands stay on it" }`.
2. **`LabModule.svelte`** — add `dodge: () => import("./tabs/dodge/DodgeTab.svelte")`
   to `tabComponents`.

The tab keeps its **own `<Canvas>`** (the live loop is orthogonal to Collision
Lab's static `Scene3D`). It is the test page's Canvas + panel, moved verbatim.

## Components

- **`src/lib/features/lab/tabs/dodge/DodgeTab.svelte`** (root) — the ported
  `routes/test/mm-dodge/+page.svelte`: the `<Canvas>` (camera, lights, ground,
  floor reference grid, rig, `DodgeDriver`), the control panel (Dodge toggle,
  Manual toggle + Step-X/Step-Z/Face sliders, body-clearance readout, solved-stance
  line, Copy Diagnostic), the async rig setup, and the `window.__dodge*` hooks.
- **`src/lib/features/lab/tabs/dodge/DodgeDriver.svelte`** — moved verbatim from
  `routes/test/mm-dodge/DodgeDriver.svelte` (the per-frame Threlte child:
  locomotion update, prop placement, reach-follow, arm IK, clearance report).
- **Unchanged, shared:** `stage/locomotion/dodge/*` (swept-volume-builder,
  dodge-orchestrator, dodge-types) and `collision-lab/services/*`
  (StanceSimulator, StanceOptimizer, pose-target-mapper, types) — framework-free,
  imported by the tab as they are today.

## Sequence input

Ship the current hardcoded preset (Letter A variation 3: blue/LH wheel s→w,
red/RH wall n→e, the impaling case) so the tab works immediately. A letter +
variation + per-hand plane **picker is a deferred follow-up**, not in this work.

## The `/test/mm-dodge` route

Keep the route as a **thin wrapper** that renders `<DodgeTab />`, so the existing
dev URL keeps working and there is one source of truth. (`+page.svelte` becomes a
3-line shell; the moved `DodgeDriver.svelte` is deleted from the route folder.)

## Data flow

Unchanged from the prototype: preset configs → swept volume → `solveDodge`
(real-rig body model) → solved stance; per frame the `DodgeDriver` places the
props, computes the reach-follow step + lean, drives the `MmLocomotionController`,
runs arm IK, and reports clearance to the panel. Manual mode overrides the solved
stance with the slider values.

## Error handling

Unchanged: soft-feasibility (never throws on an infeasible solve), rig-load
failure surfaces in the panel `status`, sub-cm collision-shell grazes read as
clear.

## Testing

- Existing dodge unit tests (`stage/locomotion/dodge/*.test.ts`,
  `collision-lab/services/*sweep.test.ts`) keep passing — services are untouched.
- `npm run check` clean.
- Runtime: the tab loads under the Lab sidebar (`navigationState.activeTab =
  "dodge"`) and renders the same scene the test route does; the test route still
  resolves (thin wrapper).

## Scope / YAGNI

In: the tab + registration + the route-to-wrapper move. Out (deferred): sequence
picker, real Staff3D/Prop3D props, wrist-grip polish, auto inside-gamma solve,
persisting dodge results like Collision Lab labels.

## Files

- Create: `src/lib/features/lab/tabs/dodge/DodgeTab.svelte`
- Create: `src/lib/features/lab/tabs/dodge/DodgeDriver.svelte` (moved)
- Modify: `src/lib/shared/navigation/config/tab-definitions.ts` (LAB_TABS entry)
- Modify: `src/lib/features/lab/LabModule.svelte` (tabComponents import)
- Modify: `src/routes/test/mm-dodge/+page.svelte` (→ thin `<DodgeTab/>` wrapper)
- Delete: `src/routes/test/mm-dodge/DodgeDriver.svelte` (moved into the tab)

## Open implementation checkpoints (verify, don't assume)

1. The exact `LAB_TABS` entry shape + whether `labelKey`/`descKey` need i18n
   strings registered, or `label`/`description` alone render (Collision Lab has
   both — match it; add i18n keys only if the sidebar requires them).
2. The dodge import paths inside the moved `DodgeDriver.svelte` are repo-absolute
   (`$lib/...`), so the move needs no import rewrites; the `DodgeTab.svelte`
   import of `./DodgeDriver.svelte` is the only relative one.
3. `LabModule` is `adminOnly` — the tab inherits that; confirm no extra gating.
