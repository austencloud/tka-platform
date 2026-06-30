# Scan-Card Performance Budget

Measures `scan-to-stable` on `/q/[code]` under throttling, using the `scan-perf`
marks (`src/lib/shared/analytics/scan-perf.ts`). Not CI (Chrome DevTools MCP is
interactive); run before/after any change to the scan path or cell pipeline.

## What the feature does (so the numbers make sense)

A scanned Choreo card renders its pictograph cells by **downloading pre-rendered
images** from a shared cloud store instead of rasterizing each one on the
scanner's phone:

- **On save/publish** (`warm-sequence-cells.ts`) every cell is rendered with the
  canonical visibility set and uploaded to Firebase Storage at
  `pictograph-cells/{hash}.webp` (`pictograph-cloud-cache.ts`).
- **On scan** (`/q/[code]`) a Svelte context flips `probeCloud` on for the card's
  cells (`scan-card-cloud-context.ts` → `ChoreoCard` → `renderCell`). Each cell
  direct-probes its canonical URL: a hit downloads, a miss falls back to a local
  worker render (and, only on the publish path, uploads).
- The cloud hash is **device-independent** (`cloud-cell-key.ts` normalizes the
  8 per-device visibility prefs to `CANONICAL_CARD_VISIBILITY`), so every scanner
  of a given card computes the same hash and shares the same image.

So: a **warm** scan (sequence was published after this shipped, or scanned before)
should be download-bound; a **cold** scan (never-warmed sequence) falls back to
local render — same as the old behavior.

## Budgets (initial targets — refine against the Phase-0 baseline)

- **Warm** (cells in the cloud / IndexedDB): `scan-to-stable` < 400 ms
- **Cold** (first-ever scan, all cells render locally): < 1000 ms

## Stage marks

`performance.mark` names (namespaced `scan:`), in order:
`start → shortcode-resolved → hydrated → card-mount → all-cells-stable`.
(`first-cell-painted` is a defined stage but not currently wired — add a mark at
the first committed cell if per-cell granularity is needed.)

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
5. **Cold run:** in DevTools, clear site data (IndexedDB + the cloud-cell session
   state is per-load anyway) and scan a sequence that has NOT been warmed, then
   repeat. **Warm run:** scan a sequence saved after this shipped (or re-scan).
6. Record both numbers; fail a change if either exceeds its budget.

## Reading the stages

- `start → shortcode-resolved`: Firebase/snapshot resolve + hydrate latency.
- `shortcode-resolved → card-mount`: chunk parse + glyph init + template gate.
- `card-mount → all-cells-stable`: cell acquisition. With the cloud tier **warm**
  this should be download-bound (small WebPs in parallel), NOT worker-render-bound.
  If this segment is large on a warm scan, the cloud probe is missing (check the
  hash alignment / that the sequence was actually warmed at publish).

## Baseline (pre-cloud-tier) — TO CAPTURE

Run the procedure against `main` *before* the cloud tier was active (or with a
sequence guaranteed unwarmed) and paste cold + warm `scan-to-stable` here.

## After (cloud tier live) — TO CAPTURE

Paste cold + warm `scan-to-stable` after the feature is warmed. The warm number
is the headline win (download vs rasterize).

## Known follow-ups (measured, not guessed)

- **Aggressive glyph-init defer.** The full glyph cache init is currently awaited
  before card mount (it's only parallelized with the chunk import). Fully
  deferring it would trim the critical path further, but a cold-scan local render
  needs the glyph cache populated, so this must be gated on "warm scan" or made
  safe — do it only if the `shortcode-resolved → card-mount` stage shows glyph
  init is the bottleneck.
- **Old-sequence backfill.** Sequences saved before render-at-publish shipped are
  never warmed, so they cold-render on scan until re-saved. If the field numbers
  show many cold scans, add a backfill that runs `warmSequenceCells` over the
  public sequence index.
- **R2 read-mirror.** If Firebase Storage egress/latency shows up in the field,
  publish an R2 mirror of `pictograph-cells/` and point reads at the CDN (see the
  design doc's migration trigger).

## CORS

If a cell image read is CORS-blocked on localhost, run `npm run storage:cors:apply`
(the Firebase Storage bucket needs the app origin allowed — same bucket + CORS as
the existing thumbnail cache).
