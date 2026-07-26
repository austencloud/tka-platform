---
status: active
value: 4
effort: M
remaining: "Body status: Audit complete with verified evidence (static build analysis + in-browser runtime trace via Chrome DevTools MCP). Three fixes SHIPPED (committed, build-verified green). The headline win — three.js off the boot path — is diagnosed precisely but BLOCKED on a package change; the landing LCP win needs one design decision. This spec is the handoff: findings, what shipped, and the…"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Performance Audit (Boot JS + Landing LCP) — Design

**Date:** 2026-06-16
**Status:** Audit complete with verified evidence (static build analysis + in-browser runtime trace via Chrome DevTools MCP). Three fixes SHIPPED (committed, build-verified green). The headline win — three.js off the boot path — is diagnosed precisely but BLOCKED on a package change; the landing LCP win needs one design decision. This spec is the handoff: findings, what shipped, and the prioritized backlog with file:line specifics.

**Author:** Claude (Opus 4.8) performance-audit session 2026-06-13 → 2026-06-16.
**Related memory:** `project_bundle_three_boot_weld.md` (the chunking diagnosis, so it isn't re-derived).

---

## TL;DR

- **Verified runtime baseline** (production build via `wrangler pages dev`, desktop, no throttle): landing **LCP = 5,389 ms** (Google "good" < 2,500ms), **CLS = 0.00**.
- LCP is dominated by two independent problems, both JS/fetch-gated, not bandwidth-gated:
  1. **Hero video discovery — 3,262ms (60% of LCP).** The LCP element is a 4.4MB Instagram showcase video mounted by client JS via a Firestore query, with **no `poster`** — nothing paints until a long async chain completes.
  2. **Boot JS render delay — 2,090ms (39% of LCP).** ~4.5MB gz of JS (three.js chunk 881KB gz + ~30 chunks) saturates the main thread before paint.
- **Shipped this session** (commits below): three isolated to its own chunk, `/audio/*` served from CDN not the Worker, dead deps removed, `globe.gl` lazy-loaded.
- **Biggest remaining win is the hero-video LCP** (instant-paint poster) — needs one decision: what's the poster.
- **Boot JS three-on-boot** is the systemic issue; the clean fix is a package release (`@austencloud/scene-3d` with `sideEffects:false`).

---

## What shipped (committed, build verified green: exit 0, no TDZ, prerender passes)

| Commit | Change | Evidence |
|---|---|---|
| `dc6bfe998b` | `perf(bundle): isolate three ecosystem into vendor-three chunk` | three (881KB gz) + threlte + scene-3d/camera-3d/ez-tree + postprocessing grouped into one named chunk so it stops sharing the boot path with small libs. Grouping EVERY three-importer avoids the `vendor↔vendor-three` circular-chunk TDZ. |
| `e5c6694b18` | `perf(deploy): serve /audio/* from CDN, not the Cloudflare Worker` | `static/audio` (253MB, largest static dir — museum soundscapes + meditation audio, served by URL) was missing from `svelte.config.js` adapter `routes.exclude`, routing every audio request through the Worker. Added `/audio/*`. |
| `872a694d1a` (a parallel agent swept these from the shared index) | dead deps removed + globe lazy + overrides | Removed `qrcode-generator` + `@ai-sdk/openai` (verified 0 imports). `globe.gl` (bundles its own three via three-globe, used in ONE tab) converted to `{#await import()}` in `ScanActivityTab.svelte` — verified **164KB off boot**. `three`/`zod` pnpm `overrides` added (partial — see Known Gaps). |

Net measured boot JS: original single **~5.3MB-gz mega-vendor chunk → ~4.55MB gz** boot closure. Real but modest; the dominant 3D stack is still boot-reachable (see Finding 2).

---

## Finding 1 — Landing hero video is the LCP, gated 3.26s behind client JS (HIGHEST IMPACT, landing-specific)

**Verified via Chrome DevTools `performance_analyze_insight` → LCPBreakdown:**
- LCP element: `VIDEO class='video-layer'` (nodeId 413) = `https://storage.googleapis.com/the-kinetic-alphabet.firebasestorage.app/showcase/instagram/DFYyy8RxSij.mp4` — a **4.4MB mp4**, network priority **Low**, render-blocking No.
- It is queued at **3,299ms** — not discoverable earlier because it's mounted by client JS.

**Mount chain (the 3.26s load delay):**
boot JS → hydrate → mount `VideoShowcaseSection.svelte` → `loadVideos()` (`src/lib/features/landing-preview/services/video-curator-loader.ts:20`) → dynamic-import `firebase/firestore` → `getDocs(collection(db,"showcaseVideos"))` round-trip → map `{ src: v.videoUrl }` (`VideoShowcaseSection.svelte:84-86`) → `EndlessVideoPlayer` `videoCache.getVideoUrl()` → fetch 4.4MB mp4 → decode → paint.

**Why nothing paints meanwhile:** the `<video>` elements at `src/lib/features/landing-preview/components/EndlessVideoPlayer.svelte:374` and `:386` have **no `poster` attribute**. The `ShowcaseVideo.thumbnail` field exists but is set to `null` (`video-curator-loader.ts:43`), and `VideoShowcaseSection.svelte:21` starts `videos = $state([])` (empty, client-populated). The landing IS server-rendered/prerendered (`src/routes/+layout.ts:3` `ssr=true`; `src/routes/+page.ts:2` `prerender=true`) with real `<h1>`/`<img>` content in the HTML — but the *LCP* element (the video) is not in that HTML.

**Fix (pick one; both compose):**
1. **Add a `poster`** to the two `<video>` elements → LCP becomes the poster image (sub-second) instead of the 4.4MB video. Requires a poster source — populate `thumbnail` (video first-frame), use a static hero image, or a sensible default.
2. **Bake the first hero video URL + poster into the prerendered page** (it's `prerender=true`) so the LCP element is discoverable in the initial HTML and the browser fetches it immediately — eliminates the 3.26s discovery delay. Caveat: showcase list is Firestore-dynamic; prerendering a "featured" first item avoids staleness of the full list.

**Expected impact:** LCP from 5.4s → roughly FCP (sub-second) on the poster. This is the single highest-leverage change.

**Open decision (blocks implementation):** what is the poster source?

---

## Finding 2 — three.js (~881KB gz) + the 3D stack ride the boot path on every page (SYSTEMIC)

**Verified:** boot loads the three chunk (`AdnoACu6.js` in the audited build, 881KB gz, contains `WebGLRenderer`) alongside the svelte runtime chunk (37KB gz) and ~30 others. Contributes the **2,090ms render delay** (main thread parsing/executing boot JS before paint).

**Root cause (proven across 7 builds — see `project_bundle_three_boot_weld.md`):** NOT a source import. No boot-path source file imports three (`+layout.svelte`, `+page.svelte`, `MainApplication.svelte` are clean; only `@austencloud/scene-3d` boot imports are `import type`, erased by `verbatimModuleSyntax`). It's a chunk weld: `@threlte` imports the Svelte runtime, so Rollup co-locates the runtime with three; every component needs the runtime, so boot pulls the three chunk.

**Why manualChunks alone can't fix it:**
- `return undefined` for three → Rollup merges it into the universal svelte-runtime chunk → on boot.
- `return "vendor-three"` (named, shipped) → isolates three into its own chunk BUT requires grouping every three-importing package or you get a `vendor↔vendor-three` circular-chunk TDZ that crashes prerender. Shipped config does the grouping → green, but three still boot-reachable.
- Pinning the Svelte runtime to its own chunk (the actual fix) → re-introduces a different TDZ cycle. Got three-importing nodes from 93→15 but didn't drop boot.

**The clean fix (BLOCKED on package release):** `@austencloud/scene-3d` (published `^0.1.3`, not a workspace package) ships a barrel that eagerly re-exports **115 three-importing components** with **no `sideEffects:false`** → not tree-shakeable. Shipping that package with `sideEffects:false` (or deep subpath exports) lets the runtime weld break and three move fully off boot. This is the highest-value follow-up but must be done in that package's repo.

**Now unblocked:** with Chrome DevTools MCP reconnected, chunk-surgery attempts can be runtime-verified against a real LCP re-measure on the local `wrangler` server — the verification loop that was missing during the static-only phase.

---

## Static-audit backlog (verified, not yet implemented)

**Assets**
- `static/models` (206MB) ships in the deploy; `scripts/trim-deploy-assets.js:10` only strips files >25MiB. Lower the R2-offload threshold to ~4–8MB, or add `models/ocean/meshy` + `polyhaven` to an R2 list.
- `hand-rig.glb` (14.7MB) + `rigged-hand.glb` (3.6MB): **zero references anywhere** (verified) — safe to delete (deploy-size only).
- `boat.glb` (12.6MB) renders as a near-black silhouette (`scene-configs.ts:1177`, color `#0a1520`) but ships full textures — strip textures / compress via existing gltf-transform pipeline. (Needs visual verification.)
- ~83MB raw PNG/JPG in `static/images` etc. → WebP for UI images, KTX2 for 3D color textures (keep normal maps lossless).

**Dependencies**
- Two copies of `three` in the pnpm store (0.173.0 + 0.182.0, 53MB). The `three: "$three"` override does NOT dedupe because the holdouts (camera-controls, postprocessing, troika) declare three as a **peerDependency**, which overrides don't rewrite. Needs a different mechanism (e.g. `pnpm.peerDependencyRules` / explicit resolution).
- `fabric` (full canvas engine) imported in 13 files but 12 use only its `Point` 2-field vector — replace with a local vector or three's `Vector2`; lazy-load fabric in the one real consumer (`svg-to-canvas-converter.ts`).

**Reactivity**
- Browse gallery search re-runs full filter+sort over 1000+ sequences on every keystroke — `create-browse-engine.svelte.ts:186-207`, driven by `GalleryTab.svelte:145` → `setSearch` (`:543`, no debounce). Debounce ~250ms; sort source once (sort is invariant to search text).
- Stage choreography recomputes 4 derives per animation frame — `stage-choreography-state.svelte.ts:131-217`; only `interpolatedPositions` needs the playhead. Split playhead-derived from edit-derived state.
- Unvirtualized full-library lists (`ProfileTabs.svelte:117`, museum `SequenceBrowserOverlay.svelte:130`, two `SequenceBrowserSidebar.svelte` — last two also unkeyed). Route through existing `VirtualizedSequenceGrid`.

**Correctness (surfaced by the build, not perf)**
- `/guide/level-1/positions-motions` (has `prerender = true`) throws `d is not a function` in `GuideSection.svelte` during SSR — broken static output.
- `src/lib/shared/firestore/index.ts` barrel re-exports `firestore-crud.ts` while mutually dependent → Rollup circular-chunk warnings ("likely broken execution order"). Barrels are also banned by the project `code-style` rule. Drop the barrel; import `firestore-crud.ts` directly.

---

## What's verified well (so it isn't re-chased)

- Reactivity is disciplined: biggest state files have zero `$effect`; no infinite-loop risk; only 3 minor cleanup leaks across ~90 resource-creating effects.
- Ocean flora GLB (35MB) is exemplary: meshopt + KTX2, lazy on scene mount, disposed on unmount, R2-served.
- Hot render loops (`animation-render-loop.ts`, `web-gl-fire-renderer.ts`) are allocation-clean.
- Firebase imports are fully modular; `firebase-admin` confined to the server boundary.
- Landing is SSR/prerendered with real content; CLS is 0.00.

---

## Recommended order

1. **Hero video poster** (Finding 1) — biggest LCP win, ~instant. Blocked only on poster-source decision. Implement + re-trace LCP on the local wrangler server to prove the drop.
2. **`@austencloud/scene-3d` `sideEffects:false`** (Finding 2) — unblocks three-off-boot; needs a release of that package. Then re-run the chunk config + verify LCP render-delay drop.
3. Asset trim/compress + dep dedupe + reactivity debounces — independent, mostly browser-free to verify.

## How to reproduce the runtime audit
```
npm run build
npx wrangler pages dev .svelte-kit/cloudflare --port 5180 --ip 127.0.0.1 --compatibility-date=2024-11-01
# then via Chrome DevTools MCP: new_page http://127.0.0.1:5180/ ; performance_start_trace (reload+autoStop)
```
Note: use `127.0.0.1` explicitly — `localhost` collided with another project's dev server during this audit and produced numbers for the wrong app (caught and discarded). Local wrangler numbers are inflated vs production CDN; trust the *breakdown* (load-delay vs render-delay split), not the absolute ms.
