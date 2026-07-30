# Scan-Card Performance Budget

This budget measures how long `/q/[code]` takes to show a complete Choreo card
on a mid-range phone connection. The card is the first useful result of a QR
scan. The full Sequence Viewer can keep loading behind it.

## Shipping path

The scan route has two layers:

1. The server resolves the short code, decodes the sequence, and computes the
   canonical cloud URL for every pictograph cell.
2. The HTML response contains a complete card with those image URLs. It stays
   visible while the browser downloads the interactive Sequence Viewer.
3. The interactive viewer replaces the bootstrap card only after its own cells
   are stable.

The scanner does not rasterize pictographs. QR creation verifies both card
themes before minting a short code, and scan pages read the resulting canonical
WebP assets from `pictograph-cells/{hash}.webp`.

## Budgets

Use the same 390 × 844 at 2× profile, Slow 4G, and 4× CPU slowdown for every
comparison.

| Measure                       |        Budget |
| ----------------------------- | ------------: |
| Cold user-visible card stable |    ≤ 5,000 ms |
| Warm user-visible card stable |    ≤ 3,500 ms |
| Cumulative Layout Shift       |         < 0.1 |
| Initial static JavaScript     | ≤ 400 KiB raw |

The viewer controls are progressive. Their module graph must not delay the
bootstrap card or make it disappear before the interactive card is ready.

## Marks

The app records these `scan:` marks:

`start → shortcode-resolved → hydrated → card-mount → first-cell-painted →
all-cells-stable → viewer-load-start → viewer-modules-ready`

The browser measurement also installs `probe:ssr-card-stable` before navigation.
It fires after all `[data-scan-cell-image]` elements have loaded and decoded,
followed by two animation frames. This is the primary user-visible measurement.

`scan:start` begins during hydration, so it is useful for comparing app stages
but does not include the server response or the first HTML paint.

## Measurement procedure

1. Build the production app and serve that exact output over local HTTPS.
2. Open an isolated browser profile with a 390 × 844 viewport at 2× device
   pixel ratio.
3. Set Slow 4G network throttling and 4× CPU slowdown.
4. Install observers for paint, LCP, CLS, and the bootstrap image
   load/decode/stable sequence before navigating.
5. Navigate to a known valid short code in a new origin context for the cold
   run.
6. Reload the same page without clearing browser state for the warm run.
7. Confirm that all 11 bootstrap images succeed and that the bootstrap remains
   visible until the interactive viewer reports ready.
8. Trace the production manifest from the SvelteKit start entry, app entry,
   root layout, and scan-route nodes through every static import. Report this
   full closure, not only the route node.

Chrome DevTools MCP is interactive, so this measurement is recorded manually
rather than run in CI.

## 2026-07-30 result

Production build, local HTTPS, Chrome 150, short code `B2ZM`.

| Navigation-relative measure  |           Cold |           Warm |
| ---------------------------- | -------------: | -------------: |
| Response start               |       707.5 ms |       730.8 ms |
| Response end                 |       996.8 ms |     1,206.8 ms |
| DOM content loaded           |     3,251.1 ms |     1,866.2 ms |
| First Contentful Paint       |     3,272.0 ms |     1,848.0 ms |
| All bootstrap images loaded  |     4,046.8 ms |     2,772.4 ms |
| **User-visible card stable** | **4,085.0 ms** | **2,906.7 ms** |
| App `all-cells-stable`       |     6,519.2 ms |     2,906.9 ms |
| Cumulative Layout Shift      |          0.023 |          0.023 |

All 11 canonical images loaded successfully in both runs. The cold run's last
cell response completed at 4,045.3 ms; the warm run's completed at 2,583.4 ms.
The initial cold image LCP was 4,088 ms.

The interactive viewer stayed behind the visible card while its modules loaded.
On the severe cold throttle, `viewer-modules-ready` arrived at 51,752.3 ms. On
the warm reload it arrived at 4,155.8 ms. This no longer blocks the useful scan
result, but it is the next graph worth trimming.

### Before and after

The previous route could not show the card until client hydration, short-code
resolution, viewer parsing, and cell acquisition had all finished.

| User-visible comparison |      Before |      After | Reduction |
| ----------------------- | ----------: | ---------: | --------: |
| Cold                    | 14,613.4 ms | 4,085.0 ms |     72.0% |
| Warm                    | 10,595.5 ms | 2,906.7 ms |     72.6% |

The old number was the closest available card-stable app mark. The new number
is navigation-relative and observes the server-rendered card directly, so it
also covers work the former hydration-relative mark could not see.

### Startup JavaScript

The exact static startup closure is 24 files and 344,081 raw bytes (336 KiB).
No startup file exceeds 1 MiB, and the production chunk graph contains zero
cycles. The pre-change closure was 141 files and about 6.6 MiB.

Root presence and analytics integrations now load after the scan result instead
of pulling Firebase and PostHog into the hydration path. The full Sequence
Viewer remains a dynamic import.

## Release checks

- Server HTML returns HTTP 200 and contains one bootstrap card with 11 image
  elements.
- Cold and warm runs render zero failed cells.
- The bootstrap remains visible until the interactive viewer is ready.
- Browser console contains no warnings, errors, or issues.
- Layout passes at 1920 × 1080, 2560 × 1440, 3840 × 2160, 1440 × 900,
  820 × 1180, 960 × 412, and 375 × 667.
- Type checking, focused scan tests, render-contract tests, and the production
  build pass before release.

## Next target

Keep the server-rendered card architecture. The next performance pass should
reduce the dynamically loaded Sequence Viewer graph, then investigate the
remaining 0.023 CLS during hydration. Server response caching is worth
measuring separately, but it is not the dominant delay in the current cold
run.

## CORS

If a cell image is CORS-blocked on localhost, run
`npm run storage:cors:apply`. The Firebase Storage bucket must allow the app
origin, matching the existing thumbnail cache.
