# Ocean Flora Hi-Fidelity Variant — Design

**Date:** 2026-05-29
**Status:** Draft (approved in brainstorming, pending spec review)
**Goal:** Serve crisp 1024-texture flora to discrete-desktop GPUs while phones/integrated GPUs keep the lightweight 512 build. Add a right-rail dev switch to flip tiers live, which doubles as the visual test harness.

## Problem

Every texture in `ocean_flora_scene.glb` is capped at **512×512** (set by `--texture-size 512` in `optimize-ocean-glb.mjs` to survive the ~1GB raw pass). That cap — not the ETC1S codec — is the softness visible on a desktop GPU. Codec routing is already correct (ETC1S baseColor/emissive, UASTC normal/MR/occlusion). The scene also renders identical static content at all quality tiers (`ocean-quality.ts` comment: "static content renders the same at all tiers"), so there is no mechanism to give capable GPUs more.

Measured ground truth (`gltf-transform inspect`, 2026-05-29):
- 103 KTX2 textures, all 512×512. baseColor = ETC1S (~80KB file, 174.76KB gpuSize each). normal/MR = UASTC (~300KB file, 349.55KB gpuSize each).
- Geometry: 53.9M render verts (per-frame vertex-shader cost from GPU-instancing), only 2.0M upload verts (VRAM geometry is fine). `EXT_meshopt_compression` + `EXT_mesh_gpu_instancing` present.

## Goal

A second flora build with **baseColor at 1024**, everything else unchanged, loaded only on the `ultra` tier (discrete desktop GPUs). The current 36MB build is untouched and remains the mobile/integrated build. A right-rail dev control flips the active tier at runtime so quality can be verified on one machine.

## Decisions (locked in brainstorming)

- **Bump scope:** baseColor only → 1024. normal / metallicRoughness / occlusion stay 512.
- **Tier mapping:** `ultra` loads hi; `medium` + `low` load base.
- **Geometry:** identical decimation for both builds. Only texture size differs.

## Design

### §1 — Pipeline (`scripts/optimize-ocean-glb.mjs`)

`gltf-transform optimize --texture-size` is global (applies to every slot), so "baseColor 1024 / others 512" needs **per-slot sizing**:

1. Pass 1 (`optimize`) resizes to **1024** (all slots), geometry left uncompressed (unchanged otherwise).
2. Pass 2 (sharp PNG-normalize, core API) gains a **slot-scoped resize**: baseColor/emissive stay 1024; normal / metallicRoughness / occlusion are downsized to 512 before KTX2 encode. Implemented via two `textureCompress` calls (or one normalize + a slot-scoped `resize`), keyed on the same slot patterns the UASTC/ETC1S passes already use.
3. Passes 3–5 (UASTC, ETC1S, meshopt) unchanged.

**Output controlled by a profile arg:**
- default (no arg): `ocean_flora_scene.glb`, all slots 512 — **byte-identical to today**, zero regression.
- `--profile hi`: `ocean_flora_scene_hi.glb`, baseColor 1024 / others 512.

The 512 path keeps the existing `--texture-size 512` behavior (do not route it through the 1024-then-downsize path), guaranteeing the current build is unchanged.

Regen cost: ~10 min from the 1GB raw (`ocean_scene_raw.glb`, present locally, gitignored). Output ~60MB (baseColor 1024 ETC1S compresses well).

### §2 — Tier config (`ocean-quality.ts`)

Add one field to `OceanQualityConfig`: `floraVariant: "hi" | "base"`.
- `ultra` preset → `"hi"`
- `medium`, `low` presets → `"base"`

No change to `detectOceanQuality` — it already resolves discrete-desktop GPUs to `ultra`. Pure data add.

### §3 — Loader + fallback (`FloraInstances.svelte`)

Currently hardcodes `/models/ocean/ocean_flora_scene.glb`. Change:
- Map `quality.floraVariant` → URL: `"hi"` → `…_hi.glb`, `"base"` → current path. The load `$effect` must **read `quality.floraVariant`** so a runtime tier change re-triggers it (dispose old scene → load new GLB).
- **Fallback:** if the hi URL fails to load (404 — not generated yet, or deploy lag), the error handler retries the base URL once before reporting failure. An `ultra` user never gets an empty scene.

`OceanScene.svelte` scene-feature progress (flora weighted 0.6) needs no change — the bigger file just reports a longer byte fraction.

### §4 — Dev tier override (right-rail Dev Tools)

The viewer's `OceanScene` auto-detects tier with no override; the scene-lab `<select>` is a separate tab and does not reach the viewer.

- **New rune store** `ocean-quality-override.svelte.ts` (beside `ocean-quality.ts`): `tierOverride: OceanQualityTier | "auto"`, default `"auto"`. Isolated `*.svelte.ts` state module — no DI, no viewer-context bloat.
- **`OceanScene.svelte`:** `qualityTier = override !== "auto" ? override : detectOceanQuality(renderer.current)`. One-line change.
- **`DevToolsPopover.svelte`:** add a **pill button group** — `Auto · Ultra · Medium · Low` — that writes the store. Button group, not a dropdown or checkbox (design-system compliant). Already admin-gated via `RightRail.svelte` (`authState.isAdmin`).

Override is in-memory (resets to `auto` on reload). Persisting to localStorage is deferred (YAGNI).

### Data flow

```
DevToolsPopover (pill click)
   → ocean-quality-override store (tierOverride)
       → OceanScene qualityTier $derived (override ?? detect)
           → getOceanQualityConfig(tier).floraVariant
               → FloraInstances URL ($effect) → dispose old + load hi|base GLB
```

## Verification

The dev switch IS the test harness — flip tiers on one machine and watch flora swap live:
- **Pipeline proof (no browser):** `gltf-transform inspect ocean_flora_scene_hi.glb` shows baseColor = 1024 KTX2/ETC1S, normal/MR = 512, `EXT_meshopt_compression` present.
- **No-regression proof:** re-inspect `ocean_flora_scene.glb` → all textures still 512 (or confirm byte-identical).
- **Type proof:** `npm run check` green after config/loader/store/popover edits.
- **Runtime swap proof:** in the viewer (admin), Dev Tools → Ultra loads `_hi.glb`, Low loads base; flora disposes and reloads on each flip. (Author-verified visually — Claude flags it cannot verify sharpness, user confirms on localhost.)

## Files

- Edit: `scripts/optimize-ocean-glb.mjs` — profile arg + per-slot resize
- Edit: `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality.ts` — `floraVariant` field
- Create: `src/lib/shared/3d/environments/scenes/ocean/quality/ocean-quality-override.svelte.ts` — tier override rune
- Edit: `src/lib/shared/3d/environments/scenes/ocean/OceanScene.svelte` — apply override to `qualityTier`
- Edit: `src/lib/shared/3d/environments/scenes/ocean/authored/FloraInstances.svelte` — variant URL + base fallback
- Edit: `src/lib/shared/3d/components/controls/DevToolsPopover.svelte` — tier pill group
- Build artifact: `static/models/ocean/ocean_flora_scene_hi.glb` (~60MB, committed)

## Risks

- **Per-slot resize correctness:** if the slot pattern misses a baseColor texture, it gets downsized to 512 (silent quality loss) — verify via `inspect` that exactly the baseColor/emissive set is 1024.
- **Disk/repo size:** +~60MB committed. The repo already tracks the 36MB build, so this is consistent with current practice.
- **Runtime swap thrash:** rapid dev toggling disposes/reloads a 60MB GLB repeatedly. Acceptable for an admin-only tool.
- **VRAM on hi:** ~30 baseColor textures × (1024² ETC1S ≈ 700KB − 512² 175KB) ≈ +15MB VRAM. Fine for a discrete desktop GPU; never served to phones.

## Out of scope

- Geometry LOD / instance-density thinning (no measured perf problem; revisit if a phone trace shows frame drops).
- Lighting/post tuning (dim look is authored intent; volumetric godrays disabled by a separate known bug).
- Generalizing `optimize-ocean-glb.mjs` → `optimize-glb.mjs` (its own backlog spec — not coupled here).
- localStorage persistence of the dev override.
