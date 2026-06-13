# Card-Back Cache Pre-Warm (2026-05-31)

## Context

After the front render moved to the worker pool (`2026-05-31-worker-pool-prewarm-wiring`),
the card **back** is the only remaining main-thread render work in a cold deck draw.
Measured (deck 4, 1644×2244):

| Card | `buildBackJob` | `paintBackJob` |
|---|---|---|
| 1 (cold) | **339 ms** | ~0 ms |
| 2–N | **2–4 ms** | ~0 ms |

The 339 ms is `buildBackJob`'s first call **mounting + screenshotting the theme-constant
Svelte components** (`rasterizeBrand`, `rasterizeUrl`, `rasterizeDifficultyBadge`,
`rasterizeLoopIcon` → `rasterizeComponent`) and loading fonts. Cached per theme/level/icon
in `card-back-bitmaps-constant.ts` (`brandCache`/`urlCache`/`badgeCache`/`loopIconCache`),
so cards 2–N are ~3 ms. The freeze lands on the **first visible card render**.

These rasterizers mount real components — they genuinely can't run in a worker, and don't
need to. We relocate the freeze off the visible-render critical path.

## Goal

Move the ~340 ms back-cache warm into the pre-warm window (deck-open → review transition),
overlapping navigation — exactly as the front pool seed does — so the main thread is
responsive when cards actually paint. Per-card back stays ~3 ms.

## Non-goals

- Parallelizing the back into the worker. Measured per-card cost is ~3 ms; the only real
  cost is the one-time warm, which this spec relocates rather than parallelizes. (Full
  worker port rejected — measurement shows ~3 ms/card, net wash.)
- Warming all 3 levels × 6 loop icons. The 340 ms bulk is brand + url + fonts
  (theme-constant), covered by one `buildBackJob` call. Later cards with a different
  level/loop-set pay a few ms on first encounter. YAGNI.

## Architecture

### New: `warmCardBackCaches(sequence, theme)`

`src/lib/features/choreo-card/services/card-back/warm-card-back-caches.ts`:

- Calls `buildBackJob(sequence, { width: 1644, height: 2244, bleedPx: 72, theme })` once.
  This populates the theme-constant caches (`brandCache`/`urlCache`/`badgeCache`/
  `loopIconCache` are module-level in `card-back-bitmaps-constant.ts`) and loads the fonts.
  The dims match `PrintCardRenderer.renderBack`'s scale-2 output; the constant caches key on
  `CARD_RENDER_WIDTH` (1644 const) + theme, so they warm correctly regardless of card size.
- **Frees the warm's per-card bitmaps** so the throwaway render doesn't leak one card's
  worth of GPU memory: close `job.mandala?.bitmap` and every `job.bitmaps[]` whose `kind`
  is per-card — `turn-glyph`, `reversal-glyph`, `step-count`, `start-pos-pictograph`,
  `loop-icon`, `loop-label`. **Skip** the cache-shared kinds — `brand`, `url-ornament`,
  `difficulty-badge` — because those ImageBitmaps are the same objects held by the constant
  caches; closing them would corrupt the cache the warm just populated.
- `void`-wrapped fire-and-forget; `try/catch` swallows (warm failure → first card pays the
  340 ms as today, no regression).

### Call site

`DeckReleaserTab.loadSelectedSequences`, immediately after the existing `prewarmCardPool`
call (the seam both Draw and view-release funnel through). Fire-and-forget:

```ts
warmCardBackCaches(rs.sequences[0], rs.theme);
```

Guarded by the existing `rs.sequences.length` (the block only runs after sequences resolve).
Both faces are now pre-warmed at the same seam — front pool seed + back cache warm —
overlapping the step→review transition.

### Layering

`warmCardBackCaches` lives in `choreo-card` (where `buildBackJob` lives). It is NOT folded
into `prewarmCardPool` (shared render layer) — that would invert layering (shared importing
a feature module). Two sibling fire-and-forget calls at the call site.

## Data flow (after)

```
Draw / view-release → loadSelectedSequences sets rs.sequences
  ├─ prewarmCardPool(...)            // front: probe + bundle + seed 8 workers (~5s, hidden)
  └─ warmCardBackCaches(seq0, theme) // back: buildBackJob once → warm constant caches (~340ms, hidden)
  → rs.step = "review" → PrintPreviewPages.renderAll
       per card: front → worker (warm, ~7ms) ; back → main buildBackJob (warm, ~3ms) + paintBackJob (~0ms)
```

## Testing

- **Unit** (`warm-card-back-caches.test.ts`): `warmCardBackCaches` calls an injected
  `buildBackJob` once with the standard dims + theme; closes per-card-kind bitmaps + mandala;
  does NOT close `brand`/`url-ornament`/`difficulty-badge` bitmaps; swallows a `buildBackJob`
  rejection without throwing.
- **Runtime** (existing harness, :5173): time `buildBackJob` for card 1 after calling
  `warmCardBackCaches` first → expect ~3 ms (warm), vs ~340 ms cold. Confirms the freeze
  relocates.

## Files

- **Create** `src/lib/features/choreo-card/services/card-back/warm-card-back-caches.ts`
- **Modify** `src/lib/features/choreo-card/components/deck-releaser/DeckReleaserTab.svelte`
  — one `warmCardBackCaches(...)` call beside `prewarmCardPool`.
- **Create** `src/lib/features/choreo-card/services/card-back/__tests__/warm-card-back-caches.test.ts`

## Risk

- **Closing a cache-shared bitmap** → corrupts the constant cache → blank brand/url on every
  card. Mitigated by closing only the per-card `kind`s (explicit allowlist) + `mandala`.
- Warm is best-effort; failure is a no-op (first card pays the warm as today).
