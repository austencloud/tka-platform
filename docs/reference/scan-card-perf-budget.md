# Scan-Card Performance Budget

Measures `scan-to-stable` on `/q/[code]` under throttling, using the `scan-perf`
marks (`src/lib/shared/analytics/scan-perf.ts`). Not CI (Chrome DevTools MCP is
interactive); run before/after any change to the scan path or cell pipeline.

## What the feature does (so the numbers make sense)

A scanned Choreo card renders its pictograph cells by **downloading pre-rendered
images** from a shared cloud store. The scanner never rasterizes them:

- **On save/publish** (`warm-sequence-cells.ts`) cells are warmed in the
  background with canonical visibility and uploaded to Firebase Storage at
  `pictograph-cells/{hash}.webp` (`pictograph-cloud-cache.ts`).
- **Before QR creation**, `QRCodeGenerator` strictly warms and reads back every
  cell for the exact prop pair in both card themes. It does not mint the QR when
  any canonical asset is missing.
- **On scan** (`/q/[code]`) a Svelte context flips `probeCloud` on for the card's
  cells (`scan-card-cloud-context.ts` → `ChoreoCard` → `renderCell`) and also
  sets `cloudOnly`. Each cell direct-probes its canonical URL. A hit downloads;
  a missing asset settles as unavailable and never launches the scanner's local
  renderer.
- The cloud hash is **device-independent** (`cloud-cell-key.ts` normalizes the
  8 per-device visibility prefs to `CANONICAL_CARD_VISIBILITY`), so every scanner
  of a given card computes the same hash and shares the same image.

The performance distinction is browser-local: a **warm-browser** scan reads
IndexedDB, while a **cold-browser** scan downloads the verified WebPs.

## Budgets (initial targets — refine against the Phase-0 baseline)

- **Warm browser** (cells in IndexedDB): `scan-to-stable` < 400 ms
- **Cold browser** (empty IndexedDB, cells downloaded): < 1000 ms

## Stage marks

`performance.mark` names (namespaced `scan:`), in order:
`start → shortcode-resolved → hydrated → card-mount → first-cell-painted →
all-cells-stable`. The two cell marks are aligned to animation frames after
their reactive updates commit.

## Procedure (Chrome DevTools MCP — requires verbal permission to drive the browser)

1. Serve the app: dev server on 5173 (HTTPS), or `npm run build && npm run preview`.
2. DevTools MCP `emulate`: CPU 4× slowdown + "Slow 4G" network (approximate a
   mid-range phone on mobile data — the real scan context).
3. `navigate_page` to `https://localhost:5173/q/<code>` for a known short code.
4. After the card is visible, `evaluate_script`:
   ```js
   () => {
     const s = performance.getEntriesByName("scan:start", "mark")[0];
     const e = performance.getEntriesByName("scan:all-cells-stable", "mark")[0];
     const stage = (n) => {
       const m = performance.getEntriesByName("scan:" + n, "mark")[0];
       return m && s ? Math.round(m.startTime - s.startTime) : null;
     };
     return {
       scanToStable: e && s ? Math.round(e.startTime - s.startTime) : null,
       stages: ["start", "shortcode-resolved", "hydrated", "card-mount", "all-cells-stable"]
         .map((n) => ({ n, t: stage(n) })),
     };
   }
   ```
5. **Cold-browser run:** clear site data, then scan a valid QR. **Warm-browser
   run:** reload the same code without clearing IndexedDB.
6. Record both numbers; fail a change if either exceeds its budget.

## Reading the stages

- `start → shortcode-resolved`: Firebase/snapshot resolve + hydrate latency.
- `shortcode-resolved → card-mount`: hydration, viewer chunk parse, and the
  template gate.
- `card-mount → all-cells-stable`: cell acquisition. With the cloud tier **warm**
  this should be download-bound (small WebPs in parallel), not
  worker-render-bound.
  If this segment is large on a warm scan, the cloud probe is missing (check the
  hash alignment / that the sequence was actually warmed at publish).

## Baseline (pre-cloud-tier) — TO CAPTURE

Run the procedure against `main` *before* the cloud tier was active (or with a
sequence guaranteed unwarmed) and paste cold + warm `scan-to-stable` here.

## After (cloud tier live) — TO CAPTURE

Paste cold + warm `scan-to-stable` after the feature is warmed. The warm number
is the headline win (download vs rasterize).

## Current integrity contract

- QR creation verifies dark and light assets before minting a short code.
- Blue and red props, mixed-prop mode, motion visibility, and wide held-step
  cells all participate in the canonical render contract.
- The Scan Activity admin surface can backfill older short codes through the
  same `warmSequenceCells` path.

## Measured follow-up

- **R2 read-mirror.** If Firebase Storage egress/latency shows up in the field,
  publish an R2 mirror of `pictograph-cells/` and point reads at the CDN (see the
  design doc's migration trigger).

## CORS

If a cell image read is CORS-blocked on localhost, run `npm run storage:cors:apply`
(the Firebase Storage bucket needs the app origin allowed — same bucket + CORS as
the existing thumbnail cache).
