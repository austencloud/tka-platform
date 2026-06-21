# Load Performance Optimization

> Three-phase plan to cut build output bloat, speed up cold loads, and move rendering to the edge.

## Context

TKA platform is a SvelteKit SPA deployed to Cloudflare Pages via `adapter-static`. Firebase backend (Firestore, Auth, Storage). 28 feature modules, code-split via dynamic `import()` in `ModuleRenderer`.

### Current metrics (2026-05-05)

| Metric | Value |
|--------|-------|
| Total JS output | 19.6MB across 450 chunks |
| Largest chunk | vendor-three (4.3MB) — Three.js/Threlte ecosystem |
| Total CSS | 3.9MB across 203 files |
| Core-only build time | 105s (with feature gates) |
| Full build time | 183s |
| Service worker precache | 4,676 entries (Workbox, actively harmful) |
| Font Awesome | `all.min.css` loads full icon set; only Solid used |

### Constraints

- **Festival offline use:** Users scan QR codes at festivals with bad internet. Viewed sequences must work offline. App shell must cache.
- **Capacitor migration planned:** PWA is transitional. Capacitor handles true native offline. Web SW should be minimal, not comprehensive.
- **No monorepo migration:** Evaluated and rejected (20-25% build improvement for 2-3 weeks of migration work).
- **No DI container:** Dissolved. Factory getters are the architecture. `composition-root` does side-effect registrations only.

---

## Phase A: Cut the Fat (2-3 days)

### A1. Replace Workbox with Minimal Hand-Written Service Worker

**Problem:** SvelteKitPWA generates a Workbox SW that precaches `**/*.{js,css,csv,html,ico,png,svg,woff2,woff,webp,webmanifest}`. Thousands of entries downloaded before user interaction.

**Current state:** Kill-switch SW at `static/sw.js` self-unregisters. Workbox config in `vite.config.ts` still generates full SW during builds (~170 lines, lines 637-804).

**Changes:**

1. Remove `SvelteKitPWA` entirely from `vite.config.ts` (import + ~170 lines of config)
2. Remove `@vite-pwa/sveltekit` from `package.json`
3. Write minimal `static/sw.js` (~80 lines):
   - **App shell:** Cache-first for `/app` (SPA fallback HTML) + root CSS bundle + Font Awesome CSS
   - **Fonts:** Cache-first for `/fonts/**/*.woff2` — immutable, cache forever
   - **Viewed sequences:** Network-first for `/sequence/*` and `/q/*` — cache on success for offline festival use
   - **Firebase Storage thumbnails:** StaleWhileRevalidate for `firebasestorage.googleapis.com` images user has viewed
   - **JS chunks:** No SW caching — browser HTTP cache handles content-hashed filenames
   - **Everything else:** Network-only
4. Delete stale build artifacts: `build/workbox-59d21171.js`, `build/sw.js`
5. Remove `__PWA_ENABLED__` define flag and conditional — SW always registers, just minimal now
6. Keep `static/pwa/manifest.webmanifest` and iOS splash screens (installability, not caching)

**Why this is better offline support:** Workbox caches 4,676 files the user may never visit. This caches the ~50 things they actually used. Viewed sequences work offline. App shell loads offline. New content falls back to network with timeout.

### A2. Verify Three.js Critical Path Isolation

**Problem:** `vendor-three` is 4.3MB. Must only load when user navigates to Museum/Archive/3D features.

**Current state:** Grep shows Three.js route imports only in `test/custom-avatar` and `(public)/roots` — both non-critical. `ModuleRenderer` uses dynamic `import()` for museum/archive. `startActiveModulePreload` in root layout only fires for active URL segment.

**Changes:**

1. Build with `ANALYZE=true`, inspect treemap for Three.js leakage into vendor or entry chunks
2. Check `composition-root` side-effect imports — if any transitively pull Three.js, defer them
3. Verify `vendor-three` chunk is only referenced by museum/archive/lab module chunks
4. If leakage found: add dynamic `import()` boundaries at the leak point

### A3. CSS Dead Code Audit + Font Awesome Subset

**Problem:** 3.9MB raw CSS. Font Awesome `all.min.css` includes Brands, Regular, Solid, v4-compat, v5-compat. TKA only uses Solid (`fas`) and ~5 brand icons.

**Changes:**

1. Switch `all.min.css` to `solid.min.css` in `app.html` (line 670) — cuts FA CSS by ~60%
2. Cherry-pick needed brand icons (if any) into a small supplemental CSS file
3. Verify feature-gate plugin eliminates disabled component CSS (stub replaces component = no `<style>` block compiled)
4. Audit `app.css` for unused global styles — grep class names defined in app.css against `.svelte` files
5. Quantify Font Awesome static file contribution separately from component CSS

### A4. Modulepreload Hints for Critical Chunks

**Problem:** Browser discovers JS chunks sequentially — each import triggers the next fetch. Modulepreload lets browser fetch the chain in parallel.

**Current state:** Root layout has `startActiveModulePreload()` that fires `import()` for active module in prod. But this is JS-initiated (runs after hydration). HTML-level `<link rel="modulepreload">` fires earlier.

**Changes:**

1. Post-build script reads `.vite/manifest.json`, extracts chunk graph for Create and Browse entry points
2. Injects `<link rel="modulepreload">` tags into built HTML for top ~5 chunks per critical module
3. Conditional: only for `/app` route, not landing pages
4. Alternative: evaluate Vite's built-in `modulePreload` config first

---

## Phase B: Full Load Architecture (1 week)

### B1. Defer Non-Critical Boot Registrations

**Problem:** `composition-root/index.ts` runs 8+ side-effect registrations synchronously when layout awaits it. Some pull feature-specific code (VideoExportOrchestrator, EndlessSpinnerOrchestrator, LOOPDetector) at boot even if user never visits those features.

**Changes:**

1. Run production build, measure each `bootProfiler.mark()` segment to identify actual bottleneck
2. Split registrations into critical (shortcode, browse loader, public index — needed for first render) and deferred (video export, endless spinner, loop labeler, QR injection)
3. Wrap deferred registrations in `requestIdleCallback` — they resolve lazily on first use anyway
4. Move glyph preload (`textRenderer.preloadGlyphImages()`) from blocking containerReady (layout line 254-259) to `requestIdleCallback` — canvas headers fall back to text until glyphs arrive

### B2. Font Loading Optimization

**Problem:** Font Awesome loads as render-blocking `<link rel="stylesheet">`. WOFF2 files discovered only after CSS parses. No `font-display` override.

**Changes:**

1. Add `font-display: swap` override — inline `<style>` in `app.html` overriding FA font-face declarations
2. Preload Solid WOFF2: `<link rel="preload" href="/fonts/webfonts/fa-solid-900.woff2" as="font" type="font/woff2" crossorigin>`
3. Combined with A3's switch to `solid.min.css` — less CSS to parse, preloaded font file
4. Confirm no Google Fonts dependency (system-ui fallback suggests self-hosted only)

### B3. Image Format Enforcement

**Problem:** Static assets may include PNG/JPEG where WebP/AVIF would be 50-70% smaller.

**Changes:**

1. Build-time lint script — runs after `vite build`, scans `build/` for `.png`/`.jpg` above 10KB without `.webp` sibling
2. Exemption list: `static/pwa/**`, favicons, SVGs
3. Reports violations, doesn't block build (some PNGs intentional)
4. CI check, not a bundler transform — no build-time re-encoding

---

## Phase C: Edge Architecture (2+ weeks)

### C1. Switch `adapter-static` to `adapter-cloudflare`

**Problem:** `adapter-static` prebuilds every page as flat HTML. No edge-side logic. Every user downloads same SPA shell and bootstraps client-side.

Consequences:
- Landing pages load full SvelteKit client runtime before rendering
- QR shortcode routes (`/q/[code]`) require client-side Firebase fetch before navigating
- No R2 integration for Project B (QR video cache pipeline)

**Current state:**
- Cloudflare Pages + `adapter-static`
- Standalone Cloudflare Worker for `tka.run` shortcode redirects
- Landing/app split exists in routing (`detectSiteMode()`)

**Changes:**

1. Install `@sveltejs/adapter-cloudflare`, replace `adapter-static` in `svelte.config.js`
2. Server routes for edge work:
   - `/q/[code]/+page.server.ts` — resolve shortcode via Firebase REST API (not SDK — Workers use V8 isolates), return sequence data as page props
   - `/sequence/[id]/+page.server.ts` — fetch sequence metadata, embed as props for instant render + SEO
   - Landing pages (`/`, `/about`, etc.) — server-render with `csr = false`, zero client JS
3. App routes stay client-only — `/app/**` keeps `ssr = false`, no behavior change
4. `wrangler.toml` config:
   - R2 bucket binding for video cache (unblocks Project B)
   - KV namespace for shortcode cache (avoid hitting Firebase on every QR scan)
   - Edge cache headers for static assets
5. Retire standalone `tka.run` Worker — shortcode resolution moves into SvelteKit server routes
6. Progressive migration: start with just adapter swap + existing client-only routes (zero behavior change), add server routes incrementally

**Risks:**
- Firebase Admin SDK won't run in Workers (V8 isolates, not Node). Use REST API or `firebase/lite`.
- Worker cold starts ~5ms on Cloudflare — no latency concern.

**Impact:**
- QR scan → sequence view: eliminates client-side Firebase fetch (~500-1500ms on bad connections)
- Landing: server-rendered HTML in ~50ms from edge, no JS needed
- Unblocks Project B R2 cache layer
- SEO: sequence pages get real meta tags at edge instead of empty SPA shell

---

## Phase Summary

| Phase | Effort | Biggest Win |
|-------|--------|-------------|
| A: Cut the Fat | 2-3 days | Kill Workbox precache (seconds off cold load), FA subset, modulepreload hints |
| B: Full Load Architecture | 1 week | Defer non-critical boot registrations, font-display swap, image format lint |
| C: Edge Architecture | 2+ weeks | Edge SSR for QR/landing, R2 bindings for Project B, retire standalone Worker |

## Out of Scope

- **Monorepo packaging:** Evaluated, rejected (20-25% gain for 2-3 weeks migration)
- **Project B (QR video pipeline):** Separate spec, separate agent. Phase C unblocks its R2 layer.
- **Capacitor offline:** Separate project. Minimal SW here bridges the gap until Capacitor ships.
