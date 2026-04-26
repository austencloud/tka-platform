# QR Video R2 Cache Layer — Phase 3 Spec

## Status: Blocked on infrastructure

Phase 1 (headless render worker) and Phase 2 (video landing page) are complete. Videos render on-device and play from blob URLs. This spec covers the missing persistence layer: uploading rendered videos to R2 so subsequent scans skip rendering entirely.

## The Problem

Every scan of an uncached sequence re-renders the video from scratch (~5-10 seconds on a phone). The landing page already checks R2 via HEAD request and attempts an upload after rendering, but the upload has nowhere to land — the app uses `adapter-static`, which means no server-side API routes.

## Constraint

The TKA app deploys as a fully static site via `@sveltejs/adapter-static` on Cloudflare Pages. SvelteKit API routes (`+server.ts`) don't execute at request time. R2 bucket bindings require a server-side runtime.

## Options

### Option A: Cloudflare Pages Function (separate from SvelteKit)

Cloudflare Pages supports a `functions/` directory alongside the static site. A Pages Function at `functions/api/qr-video/[hash].ts` gets native R2 bindings without changing the SvelteKit adapter.

```
functions/
  api/
    qr-video/
      [hash].ts    ← Pages Function with R2 binding
```

`wrangler.toml` (at project root):
```toml
[[r2_buckets]]
binding = "QR_VIDEO_BUCKET"
bucket_name = "tka-pub"
preview_bucket_name = "tka-pub-preview"
```

The function handles PUT (upload) and validates:
- Hash is 64-char hex string
- Content-Type is `video/mp4`
- Body size < 20 MB
- Writes to `qr-videos/{hash}.mp4` in R2

No auth needed — the hash is a content-addressed key (uploading the same content twice is idempotent). Rate limiting via Cloudflare's built-in bot protection is sufficient.

**Pros:** Zero adapter change. Static site stays static. Function deploys alongside.
**Cons:** Need to configure `wrangler.toml` and verify Pages Functions work with the current CI pipeline (`.github/workflows/web-ci.yml`).

### Option B: Migrate to `adapter-cloudflare`

Switch from `adapter-static` to `@sveltejs/adapter-cloudflare`. This enables SvelteKit `+server.ts` routes with `event.platform.env` access to R2 bindings.

Changes required:
1. `svelte.config.js` — swap adapter
2. `src/app.d.ts` — define `Platform` interface with `R2Bucket`
3. `wrangler.toml` — R2 binding config
4. `src/routes/api/qr-video/[hash]/+server.ts` — upload endpoint
5. CI pipeline — update build/deploy steps

**Pros:** First-class SvelteKit integration. Opens the door for future server-side features.
**Cons:** Major infrastructure change. Enables SSR (needs `ssr = false` on all routes to preserve current behavior). Build output changes. Deploy pipeline changes.

### Option C: Standalone Cloudflare Worker (separate deployment)

Deploy a minimal Cloudflare Worker at a subdomain (e.g., `api.tka.app`) that handles R2 uploads. The landing page uploads to that endpoint instead of `/api/qr-video/[hash]`.

**Pros:** Fully decoupled. No changes to the main app.
**Cons:** Separate deployment, separate config, CORS setup needed.

## Recommendation

**Option A** — Cloudflare Pages Function. It's the smallest change that unblocks caching, doesn't touch the adapter, and deploys automatically with the site.

## What's Already Wired

The landing page (`src/routes/q/[code]/+page.svelte`) already:
- Computes the canonical sequence hash via `SequenceEncoder.encode()` → SHA-256
- Checks R2 cache: `HEAD https://pub-f5505ed75927471cb198c54336317370.r2.dev/qr-videos/{hash}.mp4`
- Attempts upload after rendering: `PUT /api/qr-video/${hash}` (currently 404s silently)
- Plays from R2 URL on cache hit, blob URL on cache miss

Once the upload endpoint exists, caching works automatically with zero landing page changes.

## R2 Key Format

`qr-videos/{sha256Hash}.mp4`

The hash is computed from `SequenceEncoder.encode(sequenceData)` → SHA-256. This is the same canonical hash used by `PublicSequenceHashMatcher.computeEncoderHash()` for the public sequence index.

## Storage Math

- Average MP4 size: ~500 KB (720p, 30fps, ~8 seconds, H.264)
- R2 free tier: 10 GB storage, 10 million reads/month, 1 million writes/month
- At 500 KB average: ~20,000 unique sequences before hitting free tier
- R2 egress: $0 (always free)

## Deduplication

Multiple simultaneous first-scanners of the same sequence will both render and both try to upload. R2 PUT is idempotent — same key, same content. No lock needed.
