# Olive Cloudbreak Gate 5 Integration Plan

**Gate:** 5, integrated environment  
**Revision:** Olive Cloudbreak r1  
**Status:** Awaiting implementation approval  
**Date:** 2026-08-10

## Outcome

Gate 5 will prove that the approved Olive Cloudbreak production slice behaves
correctly inside the real 3D viewer and background-selection flow. It will not
invent a doorway, arrival path, or departure route. Celestial is an environment
choice and a fixed performance location, so its connections are the transitions
customers make when selecting another environment.

The canonical Theme Showroom order places Autumn immediately before Celestial
and Void immediately after it. Those are the two adjacent environments for the
connectivity check.

## Existing owners to preserve

- `Viewer3DCanvas.svelte` remains the production host and owns scene readiness,
  performance monitoring, and the shared audio-player mount.
- `Viewer3DScene.svelte` continues to derive the selected background from the
  seeded preview or `settingsService`, calculate performer-aware stage bounds,
  and mount `Environment3D`.
- `Environment3D.svelte` remains the only environment-transition owner. Gate 5
  will exercise its cover, clean gap, readiness wait, and reveal phases rather
  than introduce a second transition system.
- `settings-state.svelte.ts` remains the selection, undo, local persistence,
  and account-persistence owner.
- `SceneAudioPlayer.svelte` and the existing scene-audio registry remain the
  audio-boundary owners.
- `ThemeShowroom.svelte` and `theme-showroom-data.ts` remain the preview,
  selection, and canonical environment-order owners.

## Implementation scope

1. Add a focused Gate 5 review surface that composes the production viewer and
   existing setting/transition owners. It may expose review controls, but it
   must not copy transition, audio, performer, or persistence behavior.
2. Prove the adjacent route `Autumn -> Celestial -> Void`, then backtrack through
   `Celestial -> Autumn -> Celestial`. The scene must fully tear down, remount,
   report ready, and restore the approved Cloudbreak composition on every return.
3. Prove the audio route `Celestial -> Ocean -> Celestial`. Celestial must expose
   only its registered track, Ocean must expose its own registry, non-audio
   neighbors must remove the player, and volume, mute, and play state must follow
   the shared audio-state contract without duplicate players or leaked playback.
4. Prove performer integration at solo, four-performer, and maximum eight-performer
   loads. Every performer must remain on the dry stage, visible, correctly lit,
   and protected during the transition veil. The expanded stage must not invade
   the lagoon or break the foreground composition.
5. Prove selection persistence through an actual reload, scene undo/backtracking,
   and the existing account-sync contract. Celestial must return as the selected
   environment without a fallback flash or stale prior scene.
6. Measure steady-state and transition frame time, draw calls, triangles,
   textures, GPU memory where the renderer exposes it, scene-ready duration, and
   repeated-entry stability. Capture console errors, warnings, and WebGL issues.
7. Repeat the visual integration sweep at the project-standard desktop, 4K,
   tablet, landscape-phone, and portrait-phone viewports.

## Gate-contract interpretation

The Gate 5 `museum-connectivity` check is satisfied by the two canonical
environment neighbors in the Theme Showroom, not by physical rooms. The contract's
collision clause is not applicable because this background has no locomotion or
player collider. Its equivalent spatial safety proof is performer-to-stage,
performer-to-lagoon, camera, and pointer-interaction clearance at the maximum
supported performer count. This interpretation requires Austen's approval with
this plan before it is recorded as an exemption in the gate manifest.

## Expected files and systems

- A Gate 5 review route under `src/routes/test/` that mounts the production
  viewer path.
- Focused integration tests beside the existing environment-transition, theme
  showroom, scene-audio, and settings-persistence tests.
- Production owners listed above only if the integration pass exposes a real
  defect. No speculative refactor is included.
- New Cloudbreak-r1 Gate 5 evidence and reports under
  `docs/superpowers/specs/seraphic-vault/`.
- `scene-gates.json` updates only after the required evidence and checks pass.

The rejected feather-sanctuary Gate 5 assets remain archived. They cannot be
renamed or reused as Olive Cloudbreak evidence.

## Required evidence

- `integrated-walk`: a review capture of the production viewer with solo and
  maximum performer layouts.
- `transition-captures`: the adjacent route, backtracking route, and audio route.
- `audio-review`: observed player, track, playback, mute, and volume state at
  each boundary.
- `performance-report`: frame-time distribution, renderer statistics,
  readiness timing, repeated-entry stability, viewport sweep, and console audit.

## Pass conditions

- `museum-connectivity`: Autumn, Celestial, and Void transition cleanly in the
  canonical order without staging a fictional arrival or exit.
- `backtracking`: repeated departure and re-entry restore one complete
  Cloudbreak scene with no duplicates, stale fog, stale lights, or lost input.
- `state-persistence`: Celestial survives reload and the existing local/account
  selection contract.
- `runtime-console`: no scene-owned errors, warnings, shader failures, or WebGL
  issues.
- `performance`: no material regression from Gate 4, no worsening across
  repeated transitions, and the established responsive frame budget is met.

Gate 5 becomes `ready-for-review` only after every required artifact and check is
present. It becomes `approved` only after Austen reviews the live result and
explicitly passes it.
