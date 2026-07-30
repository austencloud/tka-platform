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

## Budgets (initial targets; refine against the Phase-0 baseline)

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
       stages: ["start", "shortcode-resolved", "hydrated", "card-mount",
         "first-cell-painted", "all-cells-stable"]
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

## Historical baseline

No pre-cloud-tier measurement was preserved before the cloud path became active.
The current measurement cannot reconstruct that baseline without changing the
implementation under test.

## Current measurement (cloud tier live)

Measured 2026-07-30 from a production `pnpm run build:fast` build served over
local HTTPS. Chrome 150 emulated a 390 × 844 mobile viewport at 2× device pixel
ratio, 4× CPU slowdown, and Slow 4G. The short code was `B2ZM`.

The cold run used a new origin. IndexedDB, Cache Storage, and service-worker
registrations were empty before navigation. The warm run was a normal reload
with 11 pictograph blobs present in IndexedDB.

| Stage from `scan:start` | Cold browser | Warm browser |
| --- | ---: | ---: |
| `shortcode-resolved` | 7,019.3 ms | 4,443.7 ms |
| `hydrated` | 8,460.2 ms | 4,664.9 ms |
| `card-mount` | 8,493.8 ms | 4,684.1 ms |
| `first-cell-painted` | 14,613.0 ms | 10,595.1 ms |
| `all-cells-stable` | 14,613.4 ms | 10,595.5 ms |

Both provisional budgets failed:

- Cold: 14,613.4 ms against the 1,000 ms budget.
- Warm: 10,595.5 ms against the 400 ms budget.

The cloud contract itself held. The cold run fetched all 11 canonical cell
assets from Firebase Storage with HTTP 200 responses and rendered no failed
cells. The warm run made zero cloud-cell requests, read all 11 cells from
IndexedDB, and rendered no failed cells. A second warm control with HTTP cache
bypassed measured 11,241.4 ms.

The largest measured segments are `start → shortcode-resolved` and
`card-mount → all-cells-stable`. The warm reload spent 4,443.7 ms resolving the
short code and 5,911.4 ms after card mount even though cell acquisition made no
network requests. It also evaluated 168 cached local script resources. The next
pass should separate IndexedDB open/read/decode/commit timing, keep animation
and unrelated route modules off the card's critical path, and remove the
network-bound shortcode resolve from repeat scans. Rerun this budget after
those changes.

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
