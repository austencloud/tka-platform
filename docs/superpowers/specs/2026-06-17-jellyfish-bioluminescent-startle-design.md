# Jellyfish Bioluminescent Startle — Click Effect Design

**Date:** 2026-06-17
**Scope:** Ocean 3D scene jellyfish only. Self-contained in
`src/lib/shared/3d/environments/scenes/ocean/runtime/fauna/jellyfish/`.

## Goal

Clicking a jellyfish bell triggers a lifelike defensive reaction:

```
click → bell FLASH (bioluminescent emissive ramp)
      → sharp pulse-jet contraction (bell snaps in)
      → dart away from the cursor
      → ease back to drift (~1.5s)
```

## Why not Threlte `interactivity()`

`maxJellyfish` is up to 20 (high quality). `interactivity()` raycasts every
interactive mesh on every `pointermove` (≈20 jellies × ~4 meshes each, all
deforming verlet geometry). That is a per-frame cost we do not need for a
discrete click. Instead: one click-only raycast per `pointerdown`, mirroring the
existing `fish-scatter.ts` raycaster pattern. No `interactivity()`, no continuous
hover work.

## Components

No changes to `OceanInteraction`, `FaunaSystem`, or `OceanScene`. The jellyfish
folder owns the whole interaction.

### 1. `jellyfish-shaders.ts` — `flash` uniform

Add `uniform float flash` to `bulbFrag` and `gelFrag` (the bell + faint outer
shell). Both shaders already compute a fresnel bioluminescent glow term; `flash`
amplifies that emission and lifts alpha so the bell lights from within, then
fades. Extends the existing shaders, no new material.

### 2. `jellyfish-geometry.ts` (`Medusae`)

- Keep refs to the new `flash` uniforms (push into a `flashUniforms` list like
  `timeUniforms`).
- Add `startleEnergy = 0` and `triggerStartle()` → sets `startleEnergy = 1`.
- `update(delta)`:
  - Decay `startleEnergy` with an ease-out toward 0 over ~1.5s.
  - Write `flash.value` from an ease curve of `startleEnergy`.
  - In `updateRibs`, add an extra contraction term proportional to
    `startleEnergy` (bell radius pulls in sharply, relaxes as energy decays) =
    the pulse-jet.

### 3. `JellyfishSwarm.svelte`

- `pointerdown` window listener (added/removed in an `$effect`, same lifecycle
  shape as `OceanInteraction`).
- On pointerdown: compute NDC from canvas rect → `Raycaster.setFromCamera` with
  the camera from `useThrelte` → for each instance recompute its bell geometry
  `boundingSphere` (geometry deforms each frame, cached sphere goes stale) →
  raycast the bell meshes → nearest hit selects its instance.
- On hit: `inst.medusae.triggerStartle()` and set
  `inst.dartVel = (jellyPos − rayPointNearJelly).normalize() × DART_SPEED`
  (direction away from the click).
- `useTask`: integrate `inst.dartOffset += dartVel · dt`, decay `dartVel` and
  `dartOffset` over ~1.5s, and add `dartOffset` into the `medusae.item.position`
  it already sets each frame.

### Decay sync

Flash, contraction, and dart all ride the same ~1.5s ease-out so the three read
as one event.

## Tunables (initial values, adjust in verification)

- Startle duration ≈ 1.5s
- `DART_SPEED` ≈ a few bell-widths over the decay (small world units)
- Flash peak: bell emission ~2–3× baseline fresnel glow
- Contraction depth: bell radius pulled in ~20–30% at peak energy

## Out of scope (v1)

- Click sound — no asset yet; `ocean-audio` could host an oscillator blip later.
- Neighbor-cascade glow (real jelly behavior) — adds verlet/timing coupling.

## Verification

Dev server on :5173 at high quality (jellies present), Chrome DevTools MCP click
on a bell, observe flash + contraction + dart. Requires interaction permission
or user drives it.
