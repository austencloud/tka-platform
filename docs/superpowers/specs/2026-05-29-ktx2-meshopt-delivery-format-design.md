# KTX2 + Meshopt Delivery Format — Design

**Date:** 2026-05-29
**Status:** Draft (ocean pipeline already converted; this spec covers repo-wide rollout)
**Source:** 2026 pipeline audit (5-prong workflow, 2026-05-29). All five research prongs independently flagged WebP textures as the #1 gap.

## Problem

Every shipped GLB uses **WebP textures + Draco geometry**. Both are behind the 2026 web-3D curve in ways that directly hurt the stated target (gorgeous AAA scene on a mobile WebGL budget):

- **WebP/PNG/JPEG decompress to full RGBA8 in VRAM.** A 1024² texture = ~4MB resident (more with mipmaps), regardless of file size. VRAM — not download size — is the binding constraint on mobile. The 46.7MB `ocean_flora_scene.glb` is the worst offender.
- **Draco** needs a separate ~200KB WASM decoder fetch and decodes slower than meshopt on mobile CPUs. The codebase already ships `MeshoptDecoder`, so it pays for both decoders while using only Draco.
- **Double compression:** the Blender export emitted Draco AND `gltf-transform --simplify` ran, forcing decode→simplify→re-Draco — two lossy quantization passes for zero net benefit.

## Goal

KTX2/Basis Universal textures (GPU-compressed, stay compressed in VRAM, ~4-8× less resident memory) + meshopt geometry (EXT_meshopt_compression, faster decode, no separate decoder fetch) as the **canonical delivery format for every GLB in the app**, with a single repeatable pipeline.

## Current state (after Track A, 2026-05-29)

The ocean pipeline is already converted as the reference implementation:

- `scripts/blender-export-ocean-full.py` — exports clean (no Draco), `export_gpu_instances=True`, skips `Dais_`.
- `scripts/optimize-ocean-glb.mjs` — 5-pass: (1) `optimize` geometry simplify/instance/flatten + resize→1024, geometry left **uncompressed**; (2) core-API `textureCompress targetFormat:'png'` via sharp — **KTX-Software reads only PNG/JPEG, never WebP**, so textures must be normalized to PNG first; (3) `uastc` (normal/ORM/occlusion); (4) `etc1s` (baseColor/emissive); (5) `meshopt` geometry last. Pass order is forced by two constraints: KTX rejects WebP, and the `optimize` CLI can't output PNG (only ktx2/webp/avif/auto/false). core/functions resolved from the pnpm store via the cli package anchor.
- KTX2-Software (`toktx`/`ktx` v4.4.2) extracted to `.tools/ktx/`, prepended to PATH by the script — no system install.
- Basis transcoder copied to `static/basis/` (mirrors `static/draco/`).
- Loaders wired: `OceanScene` (`useGltf` + `useKtx2`/`useMeshopt`), `FloraInstances` and `GltfAsset` (`useDraco`/`useMeshopt`/`useKtx2` hooks replacing hand-wired loaders).

## Design — repo-wide rollout

### 1. Canonical optimize module

Generalize `optimize-ocean-glb.mjs` into a reusable `scripts/optimize-glb.mjs <input> <output>` that any scene/asset script calls, encoding the canonical flag set once. Per-scene scripts pass paths only. Kills the per-scene copy-paste drift the Blender-first rule already flags.

Codec routing (fixed policy):
- **UASTC** (`--level 4 --zstd 18`): `normalTexture`, `metallicRoughnessTexture`, `occlusionTexture`
- **ETC1S** (`--quality 200`): `baseColorTexture`, `emissiveTexture`
- **meshopt** geometry, resize cap 1024, simplify 0.65 / error 0.001, instance, flatten.

### 2. Asset inventory + conversion

`static/models/ocean/` holds ~25 GLBs. Categorize:
- **Pipeline-built** (regenerate from source): `ocean_flora_scene.glb`, `ocean-environment.glb`.
- **Standalone CC0/AI-gen** (re-optimize in place from raw): corals, rocks, boat, jellyfish, kelp, anemone, octopus, ray, urchin, shell, starfish, structures/, meshy/.

Each standalone gets a one-shot `optimize-glb.mjs raw.glb out.glb` pass. The 12.6MB `boat.glb` and the rock set are the next-biggest VRAM wins after the flora scene.

### 3. Loader convergence

All GLB loads go through the threlte hooks (`useDraco`/`useMeshopt`/`useKtx2`). No hand-wired `GLTFLoader` in module scope anywhere. `GltfAsset` is the shared primitive for placed GLB props; `useGltf` for whole-scene loads. Grep for `new GLTFLoader(` / `new DRACOLoader(` to find stragglers.

### 4. Doc + memory updates

- `.claude/rules/blender-first-3d-scenes.md`: change the pipeline section from "KTX2/WebP" to mandate KTX2(ETC1S+UASTC) + meshopt as the canonical delivery format, with the 3-pass #1307 workaround noted.
- Memory `reference_blender_threejs_pipeline.md`: same correction (it currently says "keep textures (KTX2/WebP)").

## Files

- Create: `scripts/optimize-glb.mjs` (generalized)
- Edit: every `scripts/*optimize*.mjs` to delegate to it
- Edit: `.claude/rules/blender-first-3d-scenes.md`, memory ref note
- Verify: grep for stray hand-wired loaders

## Verification

- `gltf-transform inspect <out>` shows texture format = KTX2 and meshes carry `EXT_meshopt_compression`. (Tool-output proof, no browser.)
- Runtime: `renderer.info.memory.textures` and chrome://gpu before/after on the ocean scene — VRAM drop is the real proof. **Browser-gated → deferred to user on :5173.**
- `npm run check` green after loader refactors.

## Risks

- **Generational loss:** pass 1 resizes via WebP@1024 (to bound memory on the ~1GB raw), then pass 2 re-encodes to PNG → one webp hop for JPEG/PNG-origin textures before KTX2. Negligible visually for a dim underwater scene; if a hero texture bands, give pass 1 a format-preserving resize (CLI `--texture-compress false` if it honors `--texture-size`, else a dedicated `resize` pass) so KTX2 encodes from the original format.
- **#1307 regression:** when gltf-transform 4.4.x ships the `--texture-size`+ktx2 fix, collapse the 3-pass back to a single `optimize --texture-compress ktx2`.
- **Quality on ETC1S color:** `--quality 200` is a starting point; bump for hero albedo if banding appears.

## Out of scope

- WebGPU renderer migration (separate backlog).
- AVIF/progressive texture streaming (revisit if download size — not VRAM — becomes the complaint).
