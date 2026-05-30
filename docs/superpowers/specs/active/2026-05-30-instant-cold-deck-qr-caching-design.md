# Instant Cold Deck — QR Shortcode + Image Caching (2026-05-30)

## The finding (measured, not guessed)

The cold-deck profiler (`/test/worker-pictograph` → Profile cold deck) on a 36-card
deck:

| phase | ms | % |
|---|---|---|
| **qr** | **13688** | **93.46** |
| cell | 207 | 1.41 |
| decode | 52 | 0.35 |
| header/footer/border/composite/mandala | ~22 | <0.1 |
| **cold total** | **14646** | (406ms/card) |
| warm total | 15165 | (≈ cold — caching does nothing today) |

QR is the entire bottleneck: **~380ms/card**, and **warm ≈ cold** because the cost
is a per-card **network round-trip**, not compute. The whole prior worker/GPU
effort was optimizing the 6.5% that isn't QR. Strip the QR cost and a 36-card deck
renders in **~960ms (~27ms/card)** — instant.

## Root cause (verified in code)

- `ImageComposer.renderQRCode` → `qrCodeGenerator.generateAsImage(sequence, …)` →
  `QRCodeGenerator.generateForSequence` → `ShortCodeManager.createShortCode`
  (`qr-code-generator.ts:184`) which runs `findExistingCodeByHash` — **a Firestore
  query every render** (`short-code-manager.ts:329`).
- `ShortCodeManager` has **no persistent result cache**. `inflightByKey`
  (`short-code-manager.ts:72`) only dedupes *concurrent* calls in one tick — repeat
  renders/sessions re-query Firestore.
- There is **no batch** — N cards = N serial Firestore queries.
- There is **no QR image cache** — the QR SVG render + `new Image()` decode
  (`qr-code-generator.ts:133,227`) runs every card.
- Shortcodes key off the sequence **content hash** and are stored globally in
  Firestore, so the cost is the *query*, not creation → perfectly cacheable.
  `hashSequenceContent` already exists as the content key.

## Goal

Every cold deck loads near-instantly; re-views are instant; zero pixel change to
the QR (keep the chosen rounded "modern" style). Pure caching + batching — no
rendering, worker, or GPU changes.

## Non-goals

- No QR visual change. No worker/GPU. No pictograph-cache rebuild (cells are 1.4%).
- Not changing when product short codes are *created* (still global, hash-keyed,
  Firestore-backed) — only eliminating redundant *resolution* and *rendering*.

## Architecture — three pieces

### 1. Persistent shortcode cache (`sequenceContentHash → code`)

New `ShortCodeCache` (memory `Map` + IndexedDB), keyed by `hashSequenceContent(seq)`
plus the URL-option discriminants that change the code/URL (`bluePropType`,
`redPropType`, `viewMode`, `deckId`) — i.e. the same inputs `createShortCode`'s
`ShortCodeURLOptions` vary on. A sequence's code is resolved **once ever** locally;
every later render reads the cache → zero network.

- Memory layer: session-fast, unbounded-but-small (codes are tiny strings).
- IndexedDB layer: cross-session persistence (mirrors `pictograph-blob-cache`
  pattern). Entry: `{ key, code, url, ts }`. LRU prune by `ts`.
- `ShortCodeManager.createShortCode` consults this cache first (memory → IDB →
  Firestore), writes through on resolve. Single source so all callers benefit.

### 2. Batch pre-resolve (`resolveCodesForDeck(sequences, options)`)

One call before a deck render that resolves every sequence's code with **one
batched Firestore read** (`where(encoderHash in chunk)`, chunked at Firestore's
30-id `in` limit) for cache misses, creating any genuinely-new codes in a single
pass, and populating `ShortCodeCache`. Turns the first cold view of a fresh deck
from N serial round-trips into ~⌈N/30⌉.

- Added to `ShortCodeManager`. Reuses `findExistingCodeByHash` logic batched.
- Called from the deck render entry (`PrintPreviewPages.renderAll`) before the
  render lanes. Best-effort: on failure, falls back to per-card resolution (still
  cached) — no broken render.

### 3. QR image cache (`payloadURL + size + style + darkMode → dataURL`)

New `QrImageCache` (memory + IndexedDB) so the QR SVG render + decode happens once
per distinct payload. Key = the final encoded URL + render discriminants.

- `QRCodeGenerator.generateForUrl` (already exists, no code-resolution) gains a
  cache check; `generateAsImage` routes: resolve code via the cached path → build
  URL → QR-image-cache lookup → `generateForUrl` render on miss → decode to
  `HTMLImageElement`.
- IndexedDB entry: `{ key, dataUrl, ts }`, LRU prune.

## Render flow (after)

`ImageComposer.renderQRCode(sequence, …)`:
1. Resolve code+URL via `ShortCodeCache` (hit → no network; miss → resolve+cache).
2. `QrImageCache` lookup by URL+discriminants (hit → decoded image, done).
3. Miss → `generateForUrl(url)` (the existing rounded-style render) → cache the
   dataURL → decode → draw.

Deck render (`PrintPreviewPages.renderAll`): `await resolveCodesForDeck(seqs, opts)`
once up front (best-effort) → lanes render with all codes pre-cached.

## Cache invalidation

- Shortcode cache key = content hash + URL options → changes iff the encoded
  sequence/options change → automatic.
- QR image cache key = payload URL + size/style/darkMode → changes iff the QR
  pixels would change → automatic. A `QR_CACHE_SCHEMA` constant bumps all keys if
  the QR style is ever redesigned.

## Files

- **Create** `src/lib/shared/qr/services/short-code-cache.ts` — memory + IndexedDB
  `ShortCodeCache` (`get`/`set`/`getMany`/prune).
- **Create** `src/lib/shared/qr/services/qr-image-cache.ts` — memory + IndexedDB
  `QrImageCache`.
- **Modify** `src/lib/shared/qr/services/short-code-manager.ts` — `createShortCode`
  consults `ShortCodeCache`; add `resolveCodesForDeck(sequences, options)` batch.
- **Modify** `src/lib/shared/qr/services/qr-code-generator.ts` — `generateForUrl`/
  `generateAsImage` consult `QrImageCache`.
- **Modify** `src/lib/shared/render/services/image-composer.ts` — `renderQRCode`
  uses the cached resolve + image path (likely already does via `generateAsImage`,
  so the cache lands transparently — verify).
- **Modify** `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`
  — `resolveCodesForDeck(seqs, …)` once before render lanes.
- **Remove (final task)** the profiler spike: `__assembly-perf-probe.ts` + its taps
  in `image-composer.ts`/`card-front-assembler.ts`/`svg-image-cache.ts`, and the
  `/test/worker-pictograph` route (now profiler-only spike).

## Testing / gate

- **Unit:** `ShortCodeCache` hit/miss/persistence; `QrImageCache` hit/miss; batch
  resolve chunking + miss-fallback.
- **The gate is the profiler itself:** re-run Profile cold deck. Expect `qr` phase
  to collapse from ~93% to a small fraction; `coldPerCardMs` to drop from ~407ms to
  tens of ms; **warm ≪ cold** (proving the cache now bites). Record before/after.
- **Visual:** QR unchanged (rounded modern style) — eyeball one card.

## Risk / notes

- Firestore `in` query 30-id cap → chunk. Offline/Firestore-down → per-card
  fallback (cached after first), render never blocks on it.
- IndexedDB quota: codes are tiny; QR dataURLs are small base64 SVGs — bound the QR
  cache (LRU, e.g. a few MB) like `DeckCardBlobCache`.
- The shortcode is product-meaningful (scan tracking via tka.run/CODE) — this
  design keeps creating/using real Firestore codes; it only stops *re-resolving*
  and *re-rendering* them. No tracking regression.
