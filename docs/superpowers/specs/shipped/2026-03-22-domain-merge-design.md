# Domain Merge — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Merge tkaflowarts.com (landing) and tkascribe.com (app) into a single domain deployment at tkaflowarts.com.

---

## Decision

Serve both the landing page and the TKA Composer app from `tkaflowarts.com`, with the app at `/app`. Retire `tkascribe.com` as a redirect. Delete the unused `apps/landing/` directory.

### Rationale

- One domain consolidates SEO authority, SSL, DNS, analytics, and deployment config
- The landing page and app already live in one SvelteKit codebase — the separation is purely domain-based
- Eliminates the domain hop when users click "Start exploring" on the landing page
- Simpler infrastructure to maintain long-term
- Enables prerendering of landing/public pages while keeping the app as client-only SPA

---

## Current State

| Aspect | Current |
|--------|---------|
| Landing page | `tkaflowarts.com` — deployed separately, but source is in main SvelteKit app |
| App | `tkascribe.com` — main SvelteKit app |
| Mode detection | `detectSiteMode()` in `src/config/domains.ts` checks `window.location.hostname` |
| `src/app.html` | Hostname-based landing detection at line 15: `var isLanding = (h === 'tkaflowarts.com' ...)` |
| Root layout | Branches on siteMode: landing mode skips DI, Firebase, auth. App mode loads everything. |
| Public routes | `(public)` route group with `+layout@.svelte` reset — already bypasses app shell |
| `apps/landing/` | 133 tracked files, all static image assets (duplicate of `static/images/arrows/`). No source code. Dead weight. |
| Service worker | Registers with `scope: "/"` in `src/hooks.client.ts`. Vite PWA plugin scope in `vite.config.ts`. |

---

## Target State

### Route Structure

```
tkaflowarts.com/                → Landing page (prerendered, no sidebar, lightweight)
tkaflowarts.com/about           → About page (prerendered, public)
tkaflowarts.com/about/compare   → Compare page (prerendered, public)
tkaflowarts.com/roots           → Roots page (prerendered, public)
tkaflowarts.com/terms           → Terms of Service (prerendered, public)
tkaflowarts.com/privacy         → Privacy Policy (prerendered, public)
tkaflowarts.com/delete-account  → Account deletion (prerendered, public)

tkaflowarts.com/app             → TKA Composer entry point (client SPA, full app shell)
tkaflowarts.com/app/create      → Create module
tkaflowarts.com/app/browse      → Browse module
tkaflowarts.com/app/compose     → Compose module
tkaflowarts.com/app/learn       → Learn module
tkaflowarts.com/app/train       → Train module
tkaflowarts.com/app/watch       → Watch module
tkaflowarts.com/app/arena       → Arena module
tkaflowarts.com/app/settings    → Settings
...all other modules

tkaflowarts.com/embed/spinner   → Embeddable spinner (standalone, stays at root)
tkaflowarts.com/sequence/[id]   → Deep link to sequence (public, reset layout)
tkaflowarts.com/p/[code]        → Short share link (public, reset layout)
tkaflowarts.com/1989            → Museum retro (standalone)
tkaflowarts.com/1995            → Museum retro (standalone)
tkaflowarts.com/1998            → Museum retro (standalone)
tkaflowarts.com/2003            → Museum retro (standalone)
```

Note: `/notation` is currently a 301 redirect to `/#notation`, not a standalone page. It stays as-is and is not prerendered.

### Mode Detection

**`src/config/domains.ts`** — Replace domain-based detection with path-based:

```ts
export function detectSiteMode(): SiteMode {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const modeOverride = params.get("mode") as SiteMode | null;
    if (modeOverride && ["app", "landing"].includes(modeOverride)) {
      return modeOverride;
    }
    if (window.location.pathname.startsWith("/app")) {
      return "app";
    }
  }
  return "landing";
}
```

**`src/app.html`** — Replace hostname-based landing detection with path-based:

```js
// Before
var isLanding = (h === 'tkaflowarts.com' || h === 'www.tkaflowarts.com');

// After
var isLanding = !window.location.pathname.startsWith('/app');
```

The `?mode=` override is preserved for local development/testing.

Everything downstream of `detectSiteMode()` stays the same — root layout already branches on the returned mode value.

### APP_DOMAIN Constant

```ts
// Before
export const APP_DOMAIN = "https://tkascribe.com";

// After
export const APP_DOMAIN = "https://tkaflowarts.com/app";
```

All references to `APP_DOMAIN` throughout the codebase will point to the new location. Links from the landing page ("Start exploring") will use relative `/app` path instead of an absolute URL to a different domain.

### Domain Configuration

Update the domain config map in `domains.ts`:

- Remove `tkascribe.com` and `www.tkascribe.com` entries
- Update `tkaflowarts.com` to serve both landing and app (mode determined by path, not domain)
- Keep localhost as app mode by default for development

### App Route Prefix

All current app routes move under `/app`:

- Current: `src/routes/+page.svelte` (home route, conditional landing/app)
- New: `src/routes/app/+page.svelte` (app entry point, loads MainApplication)
- **Delete** `src/routes/[...path]/+page.svelte` (old catch-all)
- **Create** `src/routes/app/[...path]/+page.svelte` (new catch-all under /app for SPA client routing)

The root `src/routes/+page.svelte` becomes the landing page only (no conditional branching).

### PWA Manifest

```json
{
  "name": "TKA Composer",
  "short_name": "TKA Composer",
  "start_url": "/app",
  "scope": "/app",
  "id": "tka-composer-2025"
}
```

Scope restricted to `/app` so the PWA doesn't capture landing page navigation.

### Service Worker

Update service worker registration scope:

- `src/hooks.client.ts`: Change SW registration scope from `"/"` to `"/app"`
- `vite.config.ts`: Update Vite PWA plugin `scope` config to `/app`

This ensures the service worker only intercepts app routes, not landing page requests.

### Prerendering

Add `+layout.ts` to the `(public)` route group and root landing route:

```ts
export const prerender = true;
export const ssr = true;
```

This produces static HTML for landing and public pages at build time. App routes under `/app` remain client-only (`ssr = false`, `prerender = false`).

**Prerendered routes:** `/`, `/about`, `/about/compare`, `/roots`, `/terms`, `/privacy`, `/delete-account`

**Client-only SPA routes:** `/app`, `/app/*`

**Standalone routes (unchanged):** `/1989`, `/1995`, `/1998`, `/2003`, `/sequence/[id]`, `/p/[code]`, `/embed/spinner`

### Deployment

**Cloudflare Pages:**
- One deployment serves both landing and app from `tkaflowarts.com`
- Custom domain `tkaflowarts.com` points to this deployment

**tkascribe.com redirect strategy (path-aware):**

Public routes redirect 1:1 (same path). App routes redirect under `/app`. The root redirects to `/app`.

```
# Public routes — same path
https://tkascribe.com/sequence/*    https://tkaflowarts.com/sequence/:splat  301
https://tkascribe.com/p/*           https://tkaflowarts.com/p/:splat  301
https://tkascribe.com/about         https://tkaflowarts.com/about  301
https://tkascribe.com/terms         https://tkaflowarts.com/terms  301
https://tkascribe.com/privacy       https://tkaflowarts.com/privacy  301

# App routes — redirect to /app
https://tkascribe.com/              https://tkaflowarts.com/app  301
https://tkascribe.com/*             https://tkaflowarts.com/app/:splat  301
```

Note: More specific rules match first in Cloudflare `_redirects`, so `/sequence/*` and `/p/*` are handled before the catch-all.

### Android TWA

Update `twa-manifest.json`:
- `host`: `tkaflowarts.com` (was `tkascribe.com`)
- `startUrl`: `/app`
- Icon URLs: update to `tkaflowarts.com` domain

Update `.well-known/assetlinks.json` route to serve for `tkaflowarts.com`.

### Share Links & Deep Links

- Sequence deep links (`/sequence/[id]`) stay at root level — they're public pages, not app routes
- Short share links (`/p/[code]`) stay at root level
- `APP_DOMAIN` update handles all internal share URL generation
- Existing `tkascribe.com` links redirect via the path-aware 301 rules

### Firebase Auth

Firebase auth domain config needs `tkaflowarts.com` added as an authorized domain (may already be there). Magic link `continueUrl` updates to `tkaflowarts.com/app`.

### Firebase Storage CORS

Update `config/firebase-storage-cors.json` to include `tkaflowarts.com` origins:

```json
[
  {
    "origin": [
      "https://tkaflowarts.com",
      "https://www.tkaflowarts.com",
      "http://localhost:5173",
      "http://localhost:5174"
    ]
  }
]
```

Apply with `gsutil cors set` after updating.

### WebAuthn

The `rpID` is derived dynamically from `event.url.hostname` in `webauthnConfig.ts`. No code change needed — it will automatically use `tkaflowarts.com`. Existing passkeys registered under `tkascribe.com` will stop working, which is acceptable pre-release.

---

## Cleanup

### Delete `apps/landing/`

All 133 tracked files are duplicate static images (SVG arrows matching `static/images/arrows/`). The `build/` and `node_modules/` directories are gitignored. No source code. Remove entirely.

### Delete `LANDING-EXTRACTION-PLAN.md`

Obsolete root-level doc that describes extracting the landing page to a separate project — the opposite of what this spec does.

### Delete migration config module

`src/lib/shared/migration/config/migration-config.ts` was built for migrating FROM `tkaflowarts.com` TO `tkascribe.com`. After this merge, the direction is reversed and the redirect handles it. Delete this module and any unused migration components.

### Remove Conditional Home Route

Current `src/routes/+page.svelte` conditionally renders landing OR app based on `siteMode`. After the merge, this file renders landing only. The app entry point moves to `src/routes/app/+page.svelte`.

### Update All `tkascribe.com` URL References

All hardcoded `tkascribe.com` references in source code need updating. Key files:

| File | What to change |
|------|---------------|
| `src/config/domains.ts` | `APP_DOMAIN`, domain config map, `getAppUrl()` |
| `src/app.html` | Hostname detection → path detection |
| `src/hooks.client.ts` | Service worker scope |
| `vite.config.ts` | PWA plugin scope |
| `firebase-functions/src/sendMagicLink.ts` | `continueUrl` |
| `config/firebase-storage-cors.json` | CORS origins |
| `static/robots.txt` | Sitemap URL, domain references |
| `static/sitemap.xml` | All URLs (or delete in favor of dynamic sitemap) |
| `src/routes/sitemap.xml/+server.ts` | Domain in generated URLs |
| `src/routes/+page.svelte` | JSON-LD structured data URLs |
| `src/routes/landing/components/InAppBrowserModal.svelte` | Hardcoded clipboard URL |
| `src/routes/landing/components/HeroInstallFlow.svelte` | APP_DOMAIN links |
| `android-twa/twa-manifest.json` | `host`, icon URLs, manifest URL |
| `android-twa/app/build.gradle` | `hostName`, manifest/scope URLs |
| `scripts/posthog-query.cjs` | Hostname filters |
| `src/lib/features/choreo-card/components/CardBack*.svelte` | Printed card URL (low priority — redirect handles it) |

### Sitemaps

Two sitemaps exist:
- `static/sitemap.xml` — static file with hardcoded URLs
- `src/routes/sitemap.xml/+server.ts` — dynamic generator

Both need domain updates. Consider deleting the static file and relying solely on the dynamic generator.

---

## Out of Scope

- Buying new domains (tkacomposer.com, etc.)
- Changing the app name (already done — TKA Composer)
- Restructuring modules within the app
- Changing module IDs or internal routing
- Museum/retro route changes

---

## Risks

### Existing Deep Links

Any links to `tkascribe.com/sequence/[id]` in the wild will need the path-aware 301 redirect. Since the app was never formally released, exposure is minimal.

### PWA Reinstall

Changing the PWA scope from `/` to `/app` and the domain from `tkascribe.com` to `tkaflowarts.com` will require existing installed users to reinstall. Acceptable since the user base is small and pre-release.

### Firebase Auth Domain

If `tkaflowarts.com` isn't already in Firebase's authorized domains list, magic links and OAuth will fail until it's added. Check and add before deployment.

### SEO Transition

The 301 redirect from tkascribe.com passes link equity to tkaflowarts.com. Google will reindex within days. Since the site has minimal existing SEO authority, the risk is negligible.

### Service Worker Cache

Existing service workers cached under the old domain/scope may serve stale content. The scope change to `/app` means the old SW won't intercept new routes. Users may need to clear cache or the SW will expire naturally.
