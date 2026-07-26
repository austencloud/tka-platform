---
status: active
value: 4
effort: M
remaining: "Body status: Active — approved design, pending implementation plan"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Instant Scan-Card Pictographs — Design

**Date:** 2026-06-29
**Status:** Active — approved design, pending implementation plan
**Goal:** When someone scans a QR code, the Choreo card and its pictographs appear
effectively instantly — no per-cell "stabilizing" while the scanner's phone
rasterizes each pictograph. Backed by proper instrumentation and automated tests
so the win is measurable and regression-proof.

---

## Problem (evidenced, not assumed)

Traced the full `/q/[code]` scan path with three parallel code explorations.
Findings (file:line):

1. **Every pictograph cell re-renders live on the scanner's device.**
   `ChoreoCard` → `CardGridLayout` → `renderCell()`
   (`src/lib/shared/sequence-viewer/services/preview-cell-renderer.ts`) composes
   each pictograph from SVG parts, rasterizes it via the worker pool
   (`src/lib/shared/render/services/worker-render-pool.ts`), and caches the PNG
   blob in IndexedDB (`pictograph-blob-cache.ts`). The cache is **per-device**.

2. **A scanner's IndexedDB is always empty on first visit**, so every cell
   rasterizes from scratch (~50–200ms per batch on desktop; worse on a phone).
   This cold render is the "took a while to stabilize" the user observed in a
   posted scan video.

3. **A pre-rendered whole-card image already exists but is never shown.** Each
   shortcode doc carries `thumbnailUrl` (generated + uploaded on every save —
   `src/lib/features/library/services/library-save-service.ts:103`). The scan
   page fetches it at SSR (`src/routes/q/[code]/+page.server.ts:40`) and uses it
   **only for the OpenGraph meta tag** (`+page.svelte:217`). The scanner stares
   at a pulsing word-glyph loader instead.

4. **Heavy critical path before the card even mounts.** `+page.svelte` onMount
   runs a `Promise.all` that blocks on full glyph-cache init (all 26 letters +
   every turn/element/TnD glyph — needed for the *animator*, not the static
   card), lazy chunk parse (ViewerSplitPane + Orchestrator), and shortcode
   resolve + hydrate, all before `ChoreoCard` renders.

5. **No instrumentation.** No perf marks on this path, no time-to-stable budget,
   no regression test.

**A real per-pictograph image store does not exist.** `static/pictographs/{box,
diamond}/{α,β}/{0-3}-hand.png` is a 16-file stub (start positions, hand variant
only). The cloud thumbnail pipeline (`cloud-thumbnail-cache.ts`, Firebase
Storage WebP + manifest) is **whole-sequence, browse-gallery only** — not wired
into the scan card and not at cell granularity.

---

## Approach (decided)

Stop rasterizing pictographs on the scanner's phone. Instead, **`ChoreoCard`
assembles the grid by downloading per-pictograph images** that were rendered
once, elsewhere, and stored globally. The card stays the real interactive
component; it just stops firing the device renderer. (Whole-card static
thumbnail was rejected by the user: a frozen card desyncs from the live
animation canvas. Per-cell images keep the card real and the animation
independent.)

Generation strategy: **crowd-sourced + render-at-publish (combo).**
- First device to ever render a given pictograph uploads it (self-warming).
- The owner's save/publish proactively renders + uploads every cell, so the
  first scanner of a fresh sequence is already warm.

Storage backend: **Firebase Storage for v1** (decision + rationale below).

---

## Storage backend decision: Firebase Storage (v1), R2 read-mirror later

**Chosen: Firebase Storage**, as a sibling of `cloud-thumbnail-cache.ts`.

Rationale grounded in this repo:
- The combo strategy **requires client-side upload** (both crowd-source and
  render-at-publish upload WebPs from the browser). `cloud-thumbnail-cache`
  already performs authenticated client upload to Firebase Storage. Reuse it.
  R2 has **no client upload path** here — it would need a new signed-URL Worker.
- It is a true sibling of the existing whole-sequence thumbnail cache (same
  `manifest.json` + `knownExists` + localStorage pattern). Maximum reuse, per
  `never-hand-roll.md`.
- The localhost-https CORS script already exists (`npm run storage:cors:apply`,
  memory `reference_firebase_storage_cors_localhost_https`).

Why not R2 now: R2's wins (zero egress, edge CDN) are **scale-cost**
optimizations, not a speed requirement for a handful of small WebPs per scan.
In this codebase R2 is the *server-published bulk* pattern (daily shortcode
snapshot JSON) — the wrong fit for ad-hoc client writes.

**Migration trigger (documented, not built):** Part 4 instrumentation logs real
field latency + egress. If those numbers justify it, add an R2 **read-mirror**
(server-published from the Firebase bucket, mirroring the snapshot pipeline) and
point reads at the R2 CDN while keeping Firebase as the write target.

---

## Components

### Part 1 — Per-cell cloud image store (core fix)

**New service:** `src/lib/shared/render/services/pictograph-cloud-cache.ts`
(sibling of `cloud-thumbnail-cache.ts`, cell granularity instead of
whole-sequence).

- **Key:** the existing deterministic hash from
  `src/lib/shared/sequence-viewer/services/cell-cache-key-deriver.ts`
  (pictograph identity + prop type + color/view mode), **normalized to one
  canonical render size** (display scales via CSS; viewport size must NOT be in
  the cloud key or every breakpoint forks a new image). Same hash on every
  device → globally reusable: one stored image serves that pictograph across all
  sequences.
- **Storage path:** Firebase Storage `pictograph-cells/{hash}.webp`.
- **Manifest:** `pictograph-cells/manifest.json`, loaded once on scan-page boot
  to pre-populate a `knownExists` set so reads never 404-probe. Mirror
  `cloud-thumbnail-cache`'s manifest + localStorage-persisted `knownExists`
  (7-day TTL) approach exactly.

**New tier in the cell pipeline** (`preview-cell-renderer.ts` /
`src/lib/shared/choreo-card/services/choreo-card-cell-pipeline.ts`). Lookup
order becomes:

1. IndexedDB blob cache (existing, per-device, fastest when warm)
2. **NEW: cloud cell cache** — if `knownExists`, download the WebP (no render)
3. live worker render → store IndexedDB → **upload to cloud** (crowd-source;
   skip upload if already `knownExists`)

A cold scanner (empty IndexedDB) hits tier 2 and downloads — never rasterizes.

### Part 2 — Render-at-publish

In `library-save-service.ts`, immediately after the existing whole-card
`generateAndUploadThumbnail`, add a **background** step:
- For each step in the sequence, derive the canonical cell key for the
  sequence's `intendedProp` + default scan color mode, render via the worker
  pool, and upload any not already in `knownExists`.
- Fire-and-forget — must not block or slow the save success UX.
- Guarantees the first scanner of a freshly-published sequence is warm.

### Part 3 — Critical-path trim ("load the card first")

On `src/routes/q/[code]/+page.svelte`:
- **Stop blocking the card on full `getGlyphCache().initialize()`.** That loads
  all 26 letters + every turn/element/TnD glyph for the *animator*. Defer it
  until the animation pane actually opens (`qrViewerMode === "animation"`).
- Cells are images now, so the card grid needs ~zero live glyph deps. Mount
  `ChoreoCard` as soon as `resolvedSeq` + cell images are ready; lazy-load the
  animation pane after first card paint.
- `modulepreload` the viewer chunks (ViewerSplitPane, Orchestrator) so module
  parse is off the blocking path.

### Part 4 — Instrumentation (lands first; proves before/after)

`performance.mark` / `performance.measure` at each stage boundary in
`+page.svelte` onMount:
`ssr-meta-received → services-init → shortcode-resolve(start/end) →
chunk-load → hydrate → card-mount → first-cell-painted → all-cells-stable`.

- One headline `scan-to-stable` measure.
- Pipe into the existing `src/lib/shared/analytics/runtime-monitor.ts` + a dev
  overlay (console table or on-screen in dev).
- Optionally log `scan-to-stable` + per-stage timings to analytics so real
  field numbers come back from actual scans (the video-poster scenario), and to
  feed the R2 migration-trigger decision.

### Part 5 — Automated tests

- **Unit (Vitest — the CI regression guard):** cell-pipeline tier logic.
  - cloud hit ⇒ worker render is **never** called
  - cloud miss ⇒ render **and** upload are called
  - key determinism: same pictograph + options ⇒ identical key across two
    simulated "devices"; canonical-size normalization holds across viewport
    sizes
  - manifest pre-population seeds `knownExists`
- **End-to-end budget (Chrome DevTools MCP, throttled CPU + network):** load
  `/q/[code]`, read the `scan-to-stable` mark, assert under budget cold and
  warm. Documented manual/periodic procedure (DevTools MCP is not CI).

**Budgets (initial targets, refined after Phase 0 baseline):**
- Warm (cloud images cached/known): `scan-to-stable` < 400ms
- Cold (first-ever scan, images downloaded not rendered): < 1000ms

---

## Sequencing

- **Phase 0 — Instrumentation (Part 4).** Land marks + measures first, capture a
  baseline on a throttled profile. Nothing else is provable without this.
- **Phase 1 — Per-cell cloud store + pipeline tier (Part 1).** The biggest win.
  Includes unit tests for the tier logic (Part 5 unit).
- **Phase 2 — Render-at-publish (Part 2).** First-scanner-warm guarantee.
- **Phase 3 — Critical-path trim (Part 3).** Defer animator glyph init, mount
  card first, preload chunks.
- Tests (Part 5) land alongside each phase; the DevTools budget check runs at
  the end of Phase 1 and again after Phase 3.

---

## Out of scope / non-goals

- R2 read-mirror (documented migration trigger only; not built in v1).
- Bulk offline pre-generation of the full pictograph universe (the chosen combo
  self-warms; bulk pre-gen can be a later baseline if field data shows cold-tail
  misses).
- The browse-gallery whole-sequence thumbnail pipeline is unchanged. (The
  gallery's perceived slowness on hard reload is a separate in-memory-cache-loss
  issue, tracked separately; the per-cell store may incidentally help but is not
  scoped to fix the gallery here.)
- The animation canvas render path is unchanged; it remains independent of the
  static pictograph cells.

---

## Reuse / never-hand-roll ledger

- **Cloud cache pattern:** reusing `cloud-thumbnail-cache.ts` structure
  (manifest + knownExists + localStorage + Firebase Storage client upload) as a
  cell-granularity sibling. Not rebuilding upload auth.
- **Cell key:** reusing `cell-cache-key-deriver.ts` (normalized), not inventing
  a new identity scheme.
- **Render path:** reusing `worker-render-pool.ts` + `preview-cell-renderer.ts`,
  inserting a tier — not a new renderer.
- **"Assemble from stored image, fall back to render" precedent:** Tika's
  `InlinePictograph.svelte` already does static-file → IndexedDB → render. Same
  shape, finer key.
- **Instrumentation sink:** reusing `runtime-monitor.ts`.
- **CORS:** existing `npm run storage:cors:apply`.
