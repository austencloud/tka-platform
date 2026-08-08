# Winter Hero Environment Implementation Plan

> Status: Pass two was implemented and reviewed on 2026-08-08. Further Winter
> environment work is governed by
> [Winter Environment Pass Three](./2026-08-08-winter-environment-pass-three.md).
> This document remains as the record of the pass-two intent and asset work.

## Goal

Complete fidelity pass two for Moonlit Winter Hollow. The revision must keep the
successful wide composition while replacing every close-up failure recorded in
the approved design spec.

## Ownership decisions

- Reuse `MoonBillboard.svelte` and `Starfield.svelte` for Winter sky imagery.
- Reuse Autumn's Poly Haven rock files and detailed fallen-log source inside the
  Winter Blender build.
- Extract the shared organic pond outline into one pure function. Autumn water
  and Winter ice keep separate material components.
- Keep `WinterScene.svelte` as the orchestrator for authored geometry and
  runtime effects.
- Create no new shared loader, reflection system, particle system, or primitive
  prop builder.

## Build sequence

### 1. Lock the asset set

1. Add mature fir and pine source downloads to the reproducible fetch script.
2. Inspect source dimensions and triangle counts before importing.
3. Reuse `boulder_01.glb`, `rock_07.glb`, and `stone_01.glb` from the Autumn
   production path.
4. Reuse Autumn's detailed fallen log and add a CC0 dead trunk only if the
   second required silhouette is still missing.
5. Record source family, license, source dimensions, and intended LOD role in
   the build output.

### 2. Recompose the Blender ecology

1. Replace the single sapling-only tree table with mature, mid-age, and sapling
   placement tables.
2. Limit sapling geometry to eight metres and use optimized mature meshes for
   the eight to ten hero crowns.
3. Remove procedural boulder and cylinder-log functions from the build path.
4. Import the production rock and deadwood sources, then place them as grounded
   vignettes with slope alignment and burial.
5. Reposition or remove the stump until its root mass, snow contact, and nearby
   debris read as one unit.
6. Expand and reshape the pond basin. Clear its hero-camera sightline.
7. Remove the Blender moon and both ridge rings.
8. Add assertions for age classes, crown width, burial, obstruction distance,
   required source families, and forbidden placeholder names.

### 3. Replace the pond surface and sky wiring

1. Extract the organic pond outline into a pure shared module with focused math
   tests.
2. Keep Autumn's animated water material unchanged in appearance.
3. Replace Winter's `Reflector` with layered physical ice using roughness,
   normal, crack, and cloudy-depth textures.
4. Add shared `MoonConfig` and `StarfieldConfig` values to Winter defaults.
5. Render `MoonBillboard` and `Starfield` from `WinterScene.svelte` while
   preserving directional moonlight.

### 4. Export and optimize

1. Save the revised `.blend` and render every Blender QA camera.
2. Export only runtime-owned static geometry.
3. Optimize textures, instances, mesh data, and LOD tiers.
4. Run the GLB verifier and compare production size and extension coverage with
   pass one.
5. Adjust only assets that fail a measured silhouette, texture, or budget gate.

### 5. Verify behavior and appearance

1. Run focused tests for pond outline math, layout clearance, quality capping,
   age-class counts, and persisted Winter defaults.
2. Run the project check according to the repository resource rules.
3. Inspect the hero and reverse shots, then all required asset closeups.
4. Verify orbit and walking views in the browser.
5. Capture the seven required responsive viewports and inspect the console.
6. Iterate until the approved spec passes without hiding defects behind the
   hero camera.

## Main risks

### Mature conifer cost

Full source trees are too heavy for direct WebGL delivery. Keep only a small
hero set, simplify evaluated duplicates by role, preserve alpha cards, and use
linked meshes. Saplings fill depth at lower cost.

### Foliage damage during simplification

Triangle reduction can destroy needle-card silhouettes and alpha edges. Compare
each LOD at the closest shipping distance before accepting it.

### Prop and terrain intersections

Burial is intentional, but excessive burial erases roots and broken ends. The
builder records each prop's burial fraction and rejects values outside its
family range.

### Pond readability

The pond can disappear behind trees or become a black shape under night
lighting. QA cameras measure visibility from the hero view and include a direct
grazing-angle inspection.

### Shared pond outline change

Autumn must retain its current silhouette. A pure-function test locks its seed,
radii, and point output before Winter adopts the shared owner.

## Completion proof

- Binding design spec and this plan are formatted and checked.
- Blender assertions pass and all close-up QA renders are inspected.
- Production GLB passes its extension, source-family, placeholder, and size
  checks.
- Focused tests pass under `tests/config/vitest.config.ts`.
- Project check reports no new errors or warnings.
- Browser console is clean.
- Hero, reverse, walking, close-up, and seven-viewport evidence all meet the
  approved spec.
