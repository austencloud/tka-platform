# AI-Gen Base-Mesh Feeder Lane — Design

**Date:** 2026-05-29
**Status:** Draft
**Source:** 2026 pipeline audit (2026-05-29), AI-gen prong. Multiple independent 2026 head-to-heads (3DAI Studio, VizCad).

## Problem

This session wired Meshy as the AI-3D generator, but two things are off for 2026:

1. **Wrong primary tool for geometry.** 2026 consensus: Meshy's strength is PBR
   texturing + 500+ stylized art presets + auto-rig; its geometry is the weakest
   of the field ("soft/melted"). For clean game-ready topology, **Tripo P1.0**
   (native polygon-mesh model, quad-dominant, 48-20K face ceiling that maps to a
   mobile budget without a retopo pass) is the purpose-built 2026 winner.
2. **No tool produces drop-in final assets.** Every credible 2026 review concludes
   AI-gen output is a concept / base-mesh stage that still owes a Blender
   retopo + bake pass. The risk is wiring AI-gen output straight into `useGltf`
   and shipping melted geometry / baked-in lighting into the gorgeous ocean scene.

## Goal

A codified lane: AI-gen produces **base meshes / detail sources**, which always
route through the Blender-first pipeline before they reach the app. AI-gen is a
**feeder**, never wired directly to a loader.

## Design

### 1. Tool roles (2026)

| Tool | Role | Notes |
|------|------|-------|
| **Tripo P1.0** (Tripo3D API) | Primary **geometry** | quad-dominant, game-budget topology; ~$19.9/mo Pro, 300 free credits; webhook API |
| **Meshy-6** (already wired) | **Texture / stylize / rig** | 500+ art presets (matches "magical reef" goal), 2K PBR, Smart Remesh, auto-rig. Retexture Tripo base meshes. Default model is now `meshy-6` (script updated) |
| **Microsoft TRELLIS.2** (open weights) | **Batch base meshes** | self-hostable, zero per-asset cost — for high-volume reef-wildlife variation when API credits add up |
| **Hunyuan3D 2.1** (open weights) | **Hero detail to bake FROM** | 500-600K tris, 8K PBR; never a direct asset — bake-down source only |
| Rodin Gen-2.5 | (parked) | Business-tier API gate confirmed 2026; only via fal.ai pay-per-use if a single hero ever needs sculpt detail |

### 2. The lane (hard rule)

```
AI-gen (Tripo P1.0 / TRELLIS.2)          ← base mesh
        │
        ▼
Blender pass  (decimate or quad-remesh, re-origin, bake normals/AO from a
              dense source, scale to scene units)
        │
        ▼
Meshy-6 retexture / style preset          ← optional, for stylized look
        │
        ▼
scripts/optimize-glb.mjs  (KTX2 + meshopt)  ← canonical delivery format
        │
        ▼
static/models/<scene>/  +  registry entry   ← drop-in
```

**Forbidden:** AI-gen output → `useGltf`/`GltfAsset` directly. Always through the
Blender + optimize lane.

### 3. Tooling

- `scripts/generate-tripo.mjs` — mirror of `generate-stage-meshy.mjs` against the
  Tripo3D REST API (preview → webhook poll → download GLB). Reads
  `TRIPO_API_KEY` from gitignored `.env`.
- Keep `generate-stage-meshy.mjs` (now `meshy-6`) for the texture/stylize step.
- Optional `scripts/trellis-local/` notes for self-hosted batch generation.

### 4. Rule codification

Add an AI-gen subsection to `.claude/rules/blender-first-3d-scenes.md`:
AI-gen is a base-mesh feeder; never a final-asset source; always routes through
Blender retopo+bake → KTX2 optimize.

## Files

- Create: `scripts/generate-tripo.mjs`
- Edit: `.claude/rules/blender-first-3d-scenes.md` (AI-gen feeder subsection)
- Keep: `generate-stage-meshy.mjs` (texture/stylize role)

## Verification

- Tripo P1.0 vs Meshy-5/6 topology A/B on one reef-creature prompt (wireframe
  screenshots) — proves the topology difference firsthand. **Browser/Blender-gated.**
- Any AI-gen asset that ships has a Blender pass in its provenance (no raw AI GLB in `static/`).

## Risks

- API cost creep — prefer TRELLIS.2 self-host for volume.
- License/IP: confirm each provider's commercial-use terms for generated assets
  before shipping (record in the asset's `scene.json`/manifest entry).
- Tool churn — this field moves monthly; re-audit tool roles each quarter.

## Out of scope

- Auto-pipeline (one-click prompt → optimized GLB). Manual Blender pass stays in
  the loop until AI-gen topology is provably drop-in (not in 2026).
