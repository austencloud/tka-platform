# Gallery Thumbnail Warm Pass — Design

**Date:** 2026-07-02
**Status:** Approved, pre-implementation
**Author:** Claude + Austen

## Problem

The browse gallery displays deck-enumerated sequences (TnD families `tnd-tog-same-*`,
turn variants `__t_*`) and, since 2026-07-02, QR-baked variants. None of these have
thumbnails in either cache tier:

| Tier | gallery/staff count | tnd / turn / qr | Age |
|---|---|---|---|
| Static bundle (`static/thumbnails/`) | 936 | 0 / 0 / 0 | 2026-06-22 (stale) |
| Cloud (Firebase Storage) | 6 | 0 / 0 / 0 | manifest 2026-07-02 |

Every such card cold-misses all four tiers (static → local IndexedDB → cloud → render),
which fires a cloud existence probe that returns HTTP 404. The browser logs every 404,
producing the console-spam wave the user reported. The image still renders locally and
displays; the 404 is cosmetic but real, and the cloud never warms for guests because
Storage rules require auth to upload (`allow create: if request.auth != null`), so the
crowd-sourced cache starves.

`npm run thumbnails:manifest` and `npm run thumbnails:sync` cannot fix this — both only
mirror/index files that already exist in the cloud, and the cloud doesn't have this
content. The console 404 is unsuppressable from JS (browsers log all HTTP 404s; the
existence probe is load-bearing for self-heal). **The only fix is to make the keys exist
in cloud + static.**

Server-side pre-rendering is off the table: `getSequenceRenderer()` / `getImageComposer()`
hard-throw `if (!browser)` (browser-coupled to OffscreenCanvas + createImageBitmap + SVG→canvas
+ a Web Worker pool). A Node port would be a second renderer that drifts from the client one.

## Goal

A one-time, admin-triggered, **client-side** warm pass that renders + uploads the cold
gallery thumbnails through the **real** renderer (zero parity risk), so the cold-cache
404 wave stops and the gallery loads instantly for everyone. Followed by a credentialed
`thumbnails:manifest` + `thumbnails:sync` to index and bundle the results.

## Non-Goals

- No server-side / headless renderer. (Reuse the client pipeline only.)
- No new render engine, no new compositor, no QR generator. (Reuse `ThumbnailRenderOrchestrator`.)
- No automation of the credentialed node scripts (they need `serviceAccountKey.json`,
  run outside the browser). Run manually after a warm pass.
- No change to the crowd-sourcing self-heal design. QR variants still self-heal for
  sequences the warm pass skips (e.g. no short code yet).

## Architecture

Three units, each independently testable, plus one deletion.

### 1. `gallery-thumbnail-warmer.ts` (new service — the core)

`src/lib/shared/browse/services/gallery-thumbnail-warmer.ts`

Owns iteration, throttling, cancellation, progress, and scope. **Does not render** — it
drives the existing orchestrator.

```ts
export interface WarmScope {
  props: PropType[];               // e.g. [STAFF] lean, or all CORE_PROPS
  modes: Array<'dark' | 'light'>;  // ['dark'] lean
  qr: boolean[];                   // [false, true] — non-QR and QR variants
}

export interface WarmProgress {
  done: number;
  total: number;
  rendered: number;   // full-miss → rendered + uploaded
  skipped: number;    // already cached, or qrConsistent:false
  failed: number;
  current?: string;   // "IIII (staff, dark, qr)"
}

export interface WarmHandle {
  cancel(): void;
  readonly promise: Promise<WarmProgress>;
}

export function startGalleryWarm(
  scope: WarmScope,
  onProgress: (p: WarmProgress) => void
): WarmHandle;
```

Behavior:
- Loads sequences once via the existing browse loader (`PublicSequencesLoader.loadSequenceMetadata()`),
  the same source `BrowseDataSource` uses for combined mode.
- `total = sequences.length × props.length × modes.length × qr.length`.
- For each combo, builds a `ThumbnailRenderInput` (variant `"gallery"`, the given prop as
  `bluePropType`, `lightMode` per mode, `visibility.showQRCode` per qr flag, all other
  fields at gallery defaults so `usesDefaults` stays true) and calls
  `orchestrator.getThumbnail({ sequence, input, priority })`.
  **Correctness anchor:** the input the warmer builds must mirror the input the live
  gallery card (`PropAwareThumbnail` → its render input) constructs for the same
  sequence/prop/mode/qr, so the derived cache key is byte-identical to the one that 404s in
  production. Read that construction site during implementation and reuse the same field
  values (do not re-derive an independent input shape).
- `getThumbnail()` already checks all four tiers and **renders + uploads only on a full
  miss**. So warming naturally skips anything already cached — no new probe/skip logic.
  A cache hit → `skipped++`; a fresh render (`fromCache:false`, non-null url) → `rendered++`;
  a null url → `failed++`.
- QR combos where the sequence has no short code: the renderer returns `qrConsistent:false`,
  the orchestrator skips the cache write (no poisoning), the warmer counts `skipped`.
- Concurrency-limited (default 4 in-flight) via a simple promise pool. Honors a cancel
  flag checked between combos; cancel resolves the promise with the progress-so-far.
- Emits `onProgress` after each combo.

Depends on: `getThumbnailRenderOrchestrator()`, the browse loader getter, `PropType`,
`ThumbnailRenderInput`. Testable by mocking the orchestrator (assert it's called with the
right inputs per scope, and that counts tally rendered/skipped/failed).

### 2. AdminToolbar "Warm Gallery" button (thin — quick lean run)

`src/lib/shared/debug/components/AdminToolbar.svelte` (+ Desktop/Mobile children).

Mirrors the existing `clearCloudThumbnails()` exactly:
- `warmGalleryThumbnails()` with an `isWarming` guard, progress via the existing
  `introResetMessage` (`"Warming 340/1600 (staff, dark)"`).
- Fixed **lean** scope: `{ props: [STAFF], modes: ['dark'], qr: [false, true] }`.
- Wired as `onWarmGalleryThumbnails` + `isWarming` into `AdminToolbarDesktop` and
  `AdminToolbarMobile`, rendered as a button next to "Clear Cloud Thumbnails".
- Cancel: clicking again while running cancels (reuse the same button, label flips to
  "Stop warming").

### 3. Repurposed `admin/generate-thumbnails` route (thin — full-control run)

`src/routes/admin/generate-thumbnails/+page.svelte`.

The current body (8 hardcoded words from legacy `*_ver1.meta.json`, prop-combo PNG preview,
uploads nothing) is a dead prototype and gets **replaced**. Keep the page's progress-bar /
ETA / stats-bar scaffolding (it's already built and on-brand); rewire it to the warmer:
- Scope pickers: prop multi-select and mode select as toggle buttons / `SegmentedControl`
  (**no checkboxes** — design-system rule), plus a QR on/off toggle. Default selection =
  lean; "Select all props" available for the full-matrix leave-it-running job.
- Start / Cancel, live progress (`done/total`, `rendered/skipped/failed`, ETA), current-combo
  label. Optionally show the last rendered thumbnail as a live preview (reuse the existing
  preview panel).
- Admin-gated (same `isAdmin` check the toolbar uses).

### 4. Delete dead endpoint

Remove `src/routes/api/batch-render/+server.ts`. Verified dead: its `POST` calls
`getSequenceRenderer()` in a server context, which throws `getSequenceRenderer() is
browser-only`; its documented driver `scripts/batch-rerender-gallery.js` does not exist.
Grep for any other referrers before deleting; remove them if found.

## Data Flow

```
Admin clicks Warm (toolbar lean OR route full-matrix)
  → startGalleryWarm(scope, onProgress)
      → loadSequenceMetadata()  (once)
      → for each sequence × prop × mode × qr  (pool of 4):
          orchestrator.getThumbnail({ sequence, input })
            → tier 1-4 check; full miss → render (real renderer) → upload to cloud
          → tally rendered / skipped / failed; onProgress(...)
  → resolves WarmProgress
Admin tells Claude "done"
  → npm run thumbnails:manifest   (index new cloud files)
  → npm run thumbnails:sync       (bundle to static for guests)
```

## Scope Decision

Storage cost is trivial at any scope (full matrix ≈ 800 seq × 48 combos × ~100KB ≈ ~3.8GB
≈ ~$0.10/mo, near the 5GB free tier). The binding cost is **render wall-clock**: lean
(~1,600 renders) ≈ 5–10 min; full matrix (~38k renders) ≈ hours of an open tab. Hence
scope is configurable, defaulting lean, with full matrix available on the route for a
deliberate leave-it-running job. Neither pretends a single config is canonical — the long
tail still self-heals via crowd upload.

## Error Handling

- Per-combo failures are counted (`failed++`) and never abort the run (one orphaned/corrupt
  sequence must not kill the pass). Matches the orchestrator's existing graceful null return.
- Cancel is cooperative (checked between combos); resolves with progress-so-far.
- Upload failures inside `getThumbnail` are already non-fatal (fire-and-forget with
  `.catch()`); the warmer sees a rendered url and counts it rendered. A subsequent
  `thumbnails:manifest` reflects what actually landed in the cloud, which is the source of
  truth — so a silently-failed upload simply isn't indexed and self-heals later.
- Not-signed-in / non-admin: the button/route are admin-gated; uploads require auth per
  Storage rules. If somehow run unauthenticated, uploads 403 and are counted as rendered-but-
  not-persisted; acceptable (no crash), and the admin gate prevents it in practice.

## Testing

- `gallery-thumbnail-warmer.test.ts` (unit): mock the orchestrator + loader. Assert:
  scope expansion produces the right combo count and inputs; rendered/skipped/failed tally
  correctly for cache-hit vs fresh-render vs null results; cancel stops further calls and
  resolves with partial progress; concurrency never exceeds the pool size.
- Manual verification (per project rules): run a lean warm signed-in as admin, confirm the
  cloud gallery/staff count jumps (Firebase console or a manifest regen), reload the gallery
  with a cleared browser cache, confirm the `_dark` / `_qr_dark` 404 wave is gone for warmed
  sequences.

## Files

- **Create:** `src/lib/shared/browse/services/gallery-thumbnail-warmer.ts` — grep found no
  existing warmer/bulk-render service (`warm|bulkRender|renderAll|batchRender|prerender`
  returned only unrelated matches and the dead prototype).
- **Create:** `src/lib/shared/browse/services/gallery-thumbnail-warmer.test.ts`
- **Edit:** `AdminToolbar.svelte`, `AdminToolbarDesktop.svelte`, `AdminToolbarMobile.svelte`
  — add the warm button beside Clear Cloud Thumbnails.
- **Replace:** `src/routes/admin/generate-thumbnails/+page.svelte` — dead prototype body →
  warmer-driven full-control page.
- **Delete:** `src/routes/api/batch-render/+server.ts`.
- **Manual (post-run):** `npm run thumbnails:manifest`, `npm run thumbnails:sync`.

## Related

- Memory: `reference_thumbnail_cache_lockstep.md` (4-tier cache, lockstep invariants, QR
  self-heal design, regen commands).
- `thumbnail-render-orchestrator.ts` (the pipeline this drives), `cloud-thumbnail-cache.ts`
  (upload + probe + negative cache), `thumbnail-key-deriver.ts` (usesDefaults / QR keying).
