# Google Images SEO — Bake the Notation Into Indexable Files

**Status:** active
**Date:** 2026-07-14
**Author:** design pass (autonomous)

## The problem

The page/URL SEO overhaul (2026-07-09) took tkaflowarts.com from D+ to A on text
search. It did nothing for Google Images, and Google Images is a real discovery
channel for a *visual* notation system. Today the answer to "will someone
searching 'kinetic alphabet' in Google Images find the app?" is **no**, because
the app exposes no crawlable image files of its notation.

Evidence (verified in codebase):

- **Pictographs** render as inline `<svg>` drawn client-side after an async
  prepare (`PictographRenderer.svelte`). No file, no `<img src>`. Invisible to
  Google Images.
- **Sequences / choreo cards** render `<canvas>` → `blob:` URL in an `<img>`
  (`sequence-renderer.ts`, `PropAwareThumbnail.svelte`, `PictographCell.svelte`).
  Client-only blobs. Invisible.
- The one real-file path (Firebase Storage `.webp` in `cloud-thumbnail-cache.ts`)
  is crowd-sourced/lazy and only referenced from browse, which is `ssr=false`
  (`[...appPath]/+layout.ts`), so a crawler sees an empty shell.
- **Sitemap** (`sitemap.xml/+server.ts`) is URL-only — zero `<image:image>`.
- **OG images are broken**: 7 marketing pages reference
  `https://tkaflowarts.com/branding/og-image.png`, which does not exist (only
  `og-image.html`, a browser-only template, is committed). Per-sequence `og:image`
  (`sequence/[id]/+page.server.ts`) points at `thumbnails/{word}-{prop}.png` on
  the `appspot.com` bucket — a path/extension/bucket that nothing writes.
- `ImageObject` JSON-LD is used only for the publisher logo, never for content.

## Ranking model we are building toward

Google Images ranks an image on: (1) a real file at a stable URL, (2) on an
indexable HTML page with relevant surrounding text, (3) descriptive filename +
alt + caption + title, (4) presence in an image sitemap with `image:title` /
`image:caption`, (5) `ImageObject` structured data, (6) correct dimensions and a
fast, modern format. We have the rendering engine; we lack the files, the pages,
and the sitemap surface. This spec produces all three.

## Architecture decision: build-time bake → static files

The rendering engine already runs headless under node-`canvas`:

- `Canvas2DDirectRenderer.renderPictograph()` (`canvas-2d-direct-renderer.ts`)
  renders a single pictograph to a node-canvas and `.toBuffer('image/png')`.
  Proven by `scripts/render-pictograph-node.js` and the committed
  `static/images/grant-feature/pictograph-{A..W}.png` (950×950 PNGs).
- The MCP server ships a complete standalone node-canvas **sequence** renderer
  (`mcp-server/src/core/sequence-renderer.ts`) that composites multi-beat choreo
  cards to a PNG buffer.
- `scripts/pictograph-cli.ts` documents the Node polyfill recipe
  (`global.Image`, `document.createElement` shim, `DOMParser`).

**Why bake, not render at the edge:** the production host is Cloudflare Pages
(`@sveltejs/adapter-cloudflare`). node-`canvas` is a native module and cannot run
in the Workers/Pages edge runtime — which is exactly why the existing
`render-pictograph` endpoints are `dev`-gated. Rendering the corpus at **build
time** in Node, writing static WebP/PNG to `static/`, sidesteps the edge entirely
and yields real, cacheable, crawlable files with keyword filenames. This is the
AAA path and it reuses the existing engine rather than reimplementing it.

Rejected alternatives:
- **Edge render (CF Pages Function + resvg-wasm):** would require reimplementing
  the entire renderer against a wasm rasterizer. High effort, runtime cost, no SEO
  benefit over static files.
- **Firebase Function render service:** adds infra + cold starts; the existing
  crowd-sourced webp path already shows why on-demand generation is unreliable for
  crawlers.

## Corpus

- **Letters (Phase 1):** the 47 canonical letters (MCP `list_available_letters`),
  one representative pictograph each — NOT all 650 CSV position/orientation
  variations. 47 is the searchable, ownable set (one file + one page per letter).
- **Sequences (Phase 2):** curated/released sequences already surfaced in the
  sitemap (`deckReleases/counter/manifests`, capped) — a finite, known-at-build
  set, baked via the sequence renderer.

## Slug scheme (Greek + dash → ASCII, URL/filename safe)

Greek letters and the `-` suffix are not URL/filename friendly and carry no
English keyword weight. Canonical map:

| Letter | slug | Letter | slug |
|---|---|---|---|
| A–Z | a–z (lowercased) | Δ | delta |
| Θ | theta | Λ | lambda |
| Σ | sigma | Φ | phi |
| Ψ | psi | Ω | omega |
| α | alpha | β | beta |
| γ | gamma | `X-` etc. | `x-dash` (base slug + `-dash`) |

- File: `static/notation/letters/kinetic-alphabet-letter-{slug}.webp` (+ `.png`
  fallback). Optionally `-{size}` suffix for a small variant.
- Page: `/notation/letters/{slug}`, index at `/notation/letters`.

## Per-letter page (indexable surface)

Prerendered leaf under the `/notation` pillar. Reuses `EditorialNav` +
`public-editorial.css`. Contains:

- `<h1>` naming the letter + type, unique keyword-rich prose built from CSV motion
  data + MCP type classification (avoids thin/duplicate content).
- The baked `<img>` (real file, descriptive alt + `<figcaption>`), width/height set
  (no layout shift).
- `ImageObject` + `BreadcrumbList` JSON-LD; canonical; OG/Twitter using the baked
  image.
- Internal links to `/notation`, `/composer`, adjacent letters.

IA justification (never-hand-roll): the `/guide` letters reader is a client-side
learning experience (`GuidePictograph`, `ssr` reader). These `/notation/letters/*`
pages are a distinct prerendered reference/SEO surface, the same way `/notation`
and `/composer` are separate pillars. They do not duplicate guide chrome.

## Image sitemap

Extend `sitemap.xml/+server.ts`: add `xmlns:image`, and for each baked letter (and
Phase 2 sequence) emit an `<image:image>` with `<image:loc>`, `<image:title>`,
`<image:caption>` on the corresponding page `<url>`.

## OG fixes

1. Bake `static/branding/og-image.png` (1200×630) in the pipeline: dark gradient +
   wordmark + a strip of real baked pictographs. Resolves the 7 dead references.
2. Per-sequence `og:image` (Phase 2): point at the real baked sequence file; until
   a sequence is baked, fall back to the existing `og-default.png` (which exists).

## Build wiring

The bake is a prebuild step (`scripts/bake-notation-images.mjs`), invoked before
`vite build` (added to the `build` npm script chain) and runnable standalone. It
must be idempotent and skip unchanged outputs. Native `canvas` must be buildable
in CI (Linux image needs `libpango-dev`/`libcairo2-dev`); flagged as a CI
prerequisite.

## Testing (proof)

- **Pure logic unit tests** (no canvas): slug map round-trips all 47 letters;
  filename builder; letter→page-copy derivation from CSV+type.
- **Sitemap test:** generated XML declares `xmlns:image` and contains an
  `<image:image>`/`<image:loc>` for a known baked letter.
- **Page contract test** (extends `seo-head-contract.test.ts` style): a letter page
  contains `<svelte:head>`, `og:image`, `rel=canonical`, an `<img>` with non-empty
  `alt`, and `ImageObject` JSON-LD.
- **OG resolution test:** no source file references `branding/og-image.png` unless
  that file exists on disk (guards the dead-reference regression).
- **Baked-output fixture test:** committed baked PNGs are valid (magic bytes,
  950×950). The live bake runs in CI/local where `canvas` builds; it produced the
  committed fixtures and is unchanged.
- `pnpm run check` clean.

## Environment note

node-`canvas` cannot be compiled in the current sandbox (`libpango-dev` absent;
`nodejs.org` header download blocked by network policy). The engine is proven by
the committed baked PNGs; the live bake runs in CI and on Austen's machine. Tests
that need canvas are structured to validate committed fixtures; everything else is
canvas-free and runs here.

## Non-goals

- Baking all 650 CSV variations (canonical one-per-letter only).
- Edge/runtime rendering.
- Migrating browse/app-shell surfaces to SSR (out of scope; the bake gives
  crawlers files without touching the SPA).
