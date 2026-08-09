# Ocean Composition Matrix — Design

**Status:** approved 2026-08-09
**Supersedes the placement half of:** `scripts/generate-ocean-placements.cjs` hardcoded scale buckets
**Related:** `docs/superpowers/specs/active/2026-08-09-fathom-ocean-world-boundary-design.md` (Gate 3, the terrain this composes onto)

## The problem

The reef's 300+ objects are placed by a generator that knows nothing about what
it is placing. Every model is normalized to 1-unit maximum extent at import, and
then re-scaled by a hardcoded per-bucket range:

```js
lerp(0.6, 2.5, rng())   // "meters -- prominent reef rocks"
lerp(1.5, 4.0, rng())   // "large reef formations"
lerp(3.0, 6.0, rng())   // "tall background kelp"
```

Real-world scale is discarded at import and re-invented by bucket. A table coral
and a boulder in the same bucket come out the same size. Nothing knows what a
thing sits on, which way its interesting face points, or whether it grows alone
or in colonies.

Two symptoms name the same root cause. `FloraInstances.svelte` decides whether a
mesh sways by measuring its bounding-box aspect ratio, with the comment that
*"the GLB names are opaque."* And 49 of the 172 unmapped objects in
`ocean-blender-placements.json` are anonymous `Mesh_0.001`–`Mesh_0.049`, because
nothing ever recorded which asset they came from.

There is no per-asset knowledge anywhere in the pipeline. That is the gap.

## The shape of the fix

An **index of facts** about each asset, a small set of **ecology rules** keyed by
silhouette class, and a **seeded generator** that reads both plus the terrain.

Scope is 48 static placeable assets (17 in `static/models/ocean/`, 20 in
`meshy/`, 4 in `structures/`, 5 in `polyhaven/`, 2 in `kelp/`). The 50 fish in
`pack/` are a separate pelagic family and are out of scope here. Eight root GLBs
are stage or pipeline artifacts, not scenery: `dais`, `stage`, `stage_meshy`,
`ocean-environment`, `ocean_flora_scene`, and the three `*_raw`.

The 300+ scene objects are *instances* of those 48. That is what makes a
researched index affordable: it is a 48-row table, not a 300-row one.

## Two data files, deliberately separate

They have different lifetimes. Facts get corrected when they are wrong. Rules
get tuned every time someone looks at a frame and wants the kelp thicker. One
file would mean every art tweak risks stepping on a measurement.

### `scripts/ocean-asset-facts.json`

One row per asset. Objective.

```jsonc
"meshy/table_coral": {
  "path": "meshy/table_coral.glb",
  "species": "Acropora hyacinthus (table coral)",
  "sizeMetres": { "min": 1.0, "max": 2.2, "axis": "width" },
  "upAxis": "y",
  "baseOffset": -0.04,
  "footprintRadius": 0.48,
  "facing": 45,
  "silhouette": "plate",
  "source": "meshy",
  "signature": { "vertices": 24770, "ratio": [1, 0.31, 0.98] }
}
```

`upAxis`, `baseOffset`, `footprintRadius` and `signature` are **measured** by a
script from the GLB. `species`, `sizeMetres`, `facing` and `silhouette` are
**authored** — the researched half, anchored to real marine biology rather than
art direction (table coral 1–2 m across, staghorn 0.5–1.5 m, brain coral
0.3–1 m, basalt pinnacle 6–12 m, giant kelp 10 m+).

`baseOffset` and `footprintRadius` are in normalized units, so they survive any
choice of metre size: multiply by the chosen size to get metres.

`facing` is degrees, 0 = +z, naming which way the asset's interesting face
points. Arches, fans and anything with a front need it; boulders do not and get 0.

### `scripts/ocean-ecology-rules.json`

One row per silhouette class — eight rows. Tunable.

```jsonc
"plate": {
  "substrate": ["rock", "reef"],
  "slopeRange": [0, 25],
  "depthBand": [2, 14],
  "habit": "solitary",
  "clumpSize": [1, 1],
  "companionSpacing": 1.4,
  "tiltJitter": 8,
  "yawPolicy": "face-camera-biased"
}
```

Silhouette classes: `plate`, `branching`, `mound`, `column`, `blade`, `boulder`,
`shell`, `swimmer`.

`yawPolicy` is `free`, `face-camera-biased` (rotate the `facing` direction toward
the default hero camera, with jitter), or `face-current` (align to the scene's
nominal current, for blades).

Zones stay in `scripts/ocean-zone-layout.json`, untouched. They keep owning
staging and sightlines — this is a theatre with a proscenium arch and a dais, and
a reef that composed itself would put a pinnacle in front of the stage. The rules
own what is plausible *within* a zone; the zone owns where the audience looks.

## Three scripts

### 1. Measure — `scripts/measure-ocean-assets.cjs`

Reads all 48 GLBs and writes the mechanical fields into `ocean-asset-facts.json`.

The GLB JSON-chunk parser and node-transform walk already exist inline in
`scripts/measure-ocean-models.cjs`. They get extracted to
`scripts/ocean-glb-metrics.cjs` and both scripts consume that — one owner for
"what are this GLB's bounds," per `never-hand-roll.md`.

It **never overwrites authored fields**. A new asset appears as a row with the
authored fields blank, which is the signal that a row needs a human.

The `signature` field (vertex count plus rounded bbox ratios) is what resolves
the 49 anonymous `Mesh_0.0xx` objects: match each one against the 48 known
assets. Whatever does not match is genuinely orphaned geometry and gets dropped
rather than carried forward as a mystery.

### 2. Terrain sampling — `scripts/ocean-terrain-heightmap.json` + `scripts/ocean-terrain-sampler.cjs`

The generator needs elevation, slope and substrate at any `(x, z)`. Those come
from `ocean_terrain_profile.py`, which is Python and already the single owner of
the world's shape.

Rather than port `ocean_floor_height` to JS — two implementations that would
drift the first time the shelf is retuned — the Python module **exports a baked
heightmap** and the JS sampler bilinearly interpolates it. Python stays the only
place the height function is written.

Grid: 256×256 over the ±110 m world square, ~0.86 m spacing. Slope is derived
from the sampled gradient. Substrate is derived, not painted:

| Condition | Substrate |
|---|---|
| slope > 35° | `rock` |
| inside the clearing radius (8 m) | `sand` |
| shelf relief above local mean | `reef` |
| otherwise | `sand` |

A staleness guard: the exporter records the terrain profile constants it was
built from, and the sampler fails loudly if they no longer match. A silently
stale heightmap would float or bury every object in the scene.

### 3. Generate — rewrite `scripts/generate-ocean-placements.cjs`

Per zone, per admitted asset:

1. Rejection-sample candidate points inside the zone ellipse.
2. Keep points whose sampled substrate, slope and depth satisfy the asset's rules.
3. Pick a size from `sizeMetres`; scale factor is `chosenMetres / 1.0`, since
   geometry is normalized to unit extent at import. The `lerp` buckets are deleted.
4. Sit it on the terrain using `baseOffset × size`.
5. Tilt to the substrate normal, jittered by `tiltJitter`.
6. Yaw per `yawPolicy`.
7. Clumping species place a seed, then scatter siblings within `clumpSize`.
8. Reject anything violating `companionSpacing`, the stage exclusion radius, or
   the outer boundary.

Seeded per zone exactly as now: same seed, same reef.

## The downstream change

`FloraInstances.svelte` currently infers "is this a plant" from bounding-box
aspect ratio because the GLB names are opaque. Once placements carry the asset
id, sway is a fact lookup — `silhouette: "blade"` sways, `"boulder"` does not.
The aspect heuristic is deleted, and kelp that reads as bulky stops being frozen.

## How this is proven

Not by a green typecheck. Regenerate the scene from the index and compare frames
against the current reef at the `hero`, `reef` and `world` presets on
`/test/ocean-scene`. If real biological scale does not already read better than
the lerp buckets, the premise is wrong and we have spent a day rather than a week.

Unit tests cover the mechanical parts, which are the parts that can be wrong
silently: the sampler against known points of the Python height function, the
signature matcher against a known asset, and the generator's constraint rejection.

## Deliberately not doing

- **Fish.** `pack/` is 50 pelagic assets with their own motion problem. Separate.
- **Retiring zones.** Terrain-driven emergent composition is more realistic and
  wrong for a staged scene.
- **Re-authoring the `.blend`.** This generates placements; the Blender scene is
  rebuilt from them by the existing `reground-ocean-placements.py` path.
