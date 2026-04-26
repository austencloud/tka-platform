# Domain Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve both landing page and TKA Composer app from tkaflowarts.com, with the app at `/app`.

**Architecture:** Replace domain-based mode detection with path-based detection. Move app routes under `/app` prefix. Prerender public/landing routes. Redirect tkascribe.com to tkaflowarts.com.

**Tech Stack:** SvelteKit, Cloudflare Pages, Firebase

**Spec:** `docs/superpowers/specs/2026-03-22-domain-merge-design.md`

---

## Important Rules

1. **Do NOT change module IDs** — Create, Browse, Compose, etc. keep their current IDs
2. **Do NOT change the app's internal client-side routing** — the module renderer handles navigation within the app shell. Only the SvelteKit route entry points change.
3. **`tkascribe.com` URLs become `tkaflowarts.com` URLs** — but domain references that are literally the DNS domain (CORS, host configs) need separate handling from brand/display references
4. **Test locally with `?mode=landing` and `?mode=app`** query params to verify both modes
5. **The app's client-side routing is SPA** — the `[...path]` catch-all under `/app` handles all module navigation. Individual module routes are NOT separate SvelteKit routes.

---

### Task 1: Delete apps/landing/ and LANDING-EXTRACTION-PLAN.md

**Files:**
- Delete: `apps/landing/` (133 tracked static image files — duplicates of `static/images/arrows/`)
- Delete: `LANDING-EXTRACTION-PLAN.md` (obsolete — contradicts this merge)

- [ ] **Step 1: Remove apps/landing/ from git**

```bash
git rm -r apps/landing/static/
```

- [ ] **Step 2: Remove LANDING-EXTRACTION-PLAN.md**

```bash
git rm LANDING-EXTRACTION-PLAN.md
```

- [ ] **Step 3: Clean up untracked files**

```bash
rm -rf apps/landing/build apps/landing/node_modules
rmdir apps/landing 2>/dev/null || rm -rf apps/landing
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete apps/landing/ and landing extraction plan

Dead code: 133 duplicate SVG files and obsolete extraction plan.
The landing page lives in the main SvelteKit app, not a separate build."
```

---

### Task 2: Mode Detection — Domain-Based to Path-Based

**Files:**
- Modify: `src/config/domains.ts`
- Modify: `src/app.html`

- [ ] **Step 1: Rewrite detectSiteMode() in domains.ts**

Replace the entire `detectSiteMode` function and update constants:

```ts
// Change APP_DOMAIN
export const APP_DOMAIN = "https://tkaflowarts.com/app";

// Replace detectSiteMode — path-based instead of domain-based
export function detectSiteMode(origin?: string): SiteMode {
  if (typeof window !== "undefined") {
    // Dev override via query param
    const params = new URLSearchParams(window.location.search);
    const modeOverride = params.get("mode") as SiteMode | null;
    if (modeOverride && ["app", "landing"].includes(modeOverride)) {
      return modeOverride;
    }
    // Path-based detection
    if (window.location.pathname.startsWith("/app")) {
      return "app";
    }
  }
  return "landing";
}
```

Also update these exports in `domains.ts`:
- **Remove:** `DOMAIN_MODE_MAP` (no longer needed)
- **Remove:** `isLandingDomain()` and `isAppDomain()` (hostname-based, now meaningless)
- **Remove:** `ALL_DOMAINS` and `LEGACY_DOMAINS` arrays (not needed for single domain)
- **Remove:** Netlify/Cloudflare preview deploy hostname checks (lines 62-72) — path-based detection works universally
- **Update:** `getAppCanonicalURL()` to use new `APP_DOMAIN`
- **Update:** `getLandingCanonicalURL()` — still uses `LANDING_DOMAIN` which is unchanged
- **Keep:** `LANDING_DOMAIN`, `APP_DOMAIN`, `LANDING_SEO_CONFIG`, `APP_SEO_CONFIG` — still used
- **Update:** Comment header to reflect single-domain architecture

**Update all call sites** of `detectSiteMode` — the signature changes from `detectSiteMode(origin: string)` to `detectSiteMode()` (no parameter). Call sites:
- `src/routes/+layout.svelte` line 307: `detectSiteMode(window.location.origin)` → `detectSiteMode()`
- `src/routes/+page.svelte` line 32: `detectSiteMode(window.location.origin)` → `detectSiteMode()`
- `src/routes/[...path]/+page.svelte` line 27: will be deleted in Task 3

**Known behavior change:** Preview deploys on `.pages.dev` and `.netlify.app` will default to "landing" mode. To test app mode on preview deploys, use `?mode=app`.

- [ ] **Step 2: Update src/app.html landing detection**

Change line 15 from:
```js
var isLanding = (h === 'tkaflowarts.com' || h === 'www.tkaflowarts.com');
```
to:
```js
var isLanding = !window.location.pathname.startsWith('/app');
```

Remove the `var h = window.location.hostname;` line if no longer used.

- [ ] **Step 3: Verify mode detection locally**

Open `http://localhost:5173/` — should show landing page.
Open `http://localhost:5173/?mode=app` — should show app override.
(Cannot verify `/app` route yet — that's created in Task 3.)

- [ ] **Step 4: Commit**

```bash
git add src/config/domains.ts src/app.html
git commit -m "feat: switch mode detection from domain-based to path-based

detectSiteMode() now checks pathname.startsWith('/app') instead of
hostname. APP_DOMAIN updated to tkaflowarts.com/app."
```

---

### Task 3: Move App Routes Under /app

**Files:**
- Modify: `src/routes/+page.svelte` (becomes landing-only)
- Create: `src/routes/app/+page.svelte` (app entry point)
- Create: `src/routes/app/+layout.ts` (SSR disabled for app routes)
- Create: `src/routes/app/[...path]/+page.svelte` (SPA catch-all)
- Delete: `src/routes/[...path]/+page.svelte` (old catch-all)
- Modify: `src/routes/+layout.ts` (adjust root — may need to allow SSR for public routes)

- [ ] **Step 1: Create src/routes/app/+layout.ts**

This disables SSR for app routes only (the root +layout.ts currently disables it globally):

```ts
// App routes are client-only SPA — DI container requires browser APIs
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 2: Create src/routes/app/AppShellLoader.svelte (shared component)**

Both the app entry point and the catch-all need the same logic. Create a shared component to avoid duplication:

```svelte
<!-- src/routes/app/AppShellLoader.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { Component } from "svelte";
  import LoadingGate from "$lib/shared/components/loading/LoadingGate.svelte";

  let MainApp = $state<Component | null>(null);

  onMount(() => {
    (window as any).__tkaLoadProgress?.(84, "Resolving services...");
    import("$lib/shared/application/components/MainApplication.svelte").then(
      (mod) => {
        MainApp = mod.default;
      }
    );
  });
</script>

{#if MainApp}
  <MainApp />
{:else}
  <LoadingGate />
{/if}
```

- [ ] **Step 3: Create src/routes/app/+page.svelte**

App entry point — uses the shared loader:

```svelte
<script lang="ts">
  import AppShellLoader from "./AppShellLoader.svelte";
</script>

<AppShellLoader />
```

- [ ] **Step 4: Create src/routes/app/[...path]/+page.svelte**

SPA catch-all for client-side routing within the app:

```svelte
<script lang="ts">
  import AppShellLoader from "../AppShellLoader.svelte";
</script>

<AppShellLoader />
```

- [ ] **Step 5: Simplify src/routes/+page.svelte to landing-only**

Remove all app-mode conditional logic. This page now only renders the landing page. Remove the `detectSiteMode` import and the `MainApp` dynamic import. Keep the landing content (BackgroundHost, HeroSection, etc.). Also update the `detectSiteMode()` call in this file (signature changed in Task 2).

- [ ] **Step 6: Delete src/routes/[...path]/+page.svelte and +page.ts**

```bash
git rm "src/routes/[...path]/+page.svelte" "src/routes/[...path]/+page.ts"
```

These are replaced by `src/routes/app/[...path]/+page.svelte`.

- [ ] **Step 7: Update root +layout.ts for prerendering**

The current root `+layout.ts` has `ssr = false` and `prerender = false`. Since app routes now have their own `+layout.ts` with these settings, the ROOT can be changed to allow SSR for public routes:

```ts
// Root layout: SSR enabled for landing/public pages
// App routes override this with their own +layout.ts (ssr: false)
export const ssr = true;
```

Note: Test this carefully. If the root layout component imports anything that breaks in SSR (like the DI container), those imports need to be conditional. The root layout already branches on `siteMode` and only loads heavy things in app mode via `onMount`, so this should work — but verify. The `(public)` route group uses `+layout@.svelte` reset which bypasses the root layout entirely, so those routes are safe regardless.

- [ ] **Step 8: Create src/routes/+page.ts for landing prerender**

```ts
// Landing page can be prerendered as static HTML
export const prerender = true;
```

- [ ] **Step 9: Verify locally**

- `http://localhost:5173/` → Landing page (no sidebar, backgrounds, hero section)
- `http://localhost:5173/app` → Full app with sidebar and modules
- `http://localhost:5173/app/create` → App with Create module active
- `http://localhost:5173/about` → About page (public, no sidebar)

- [ ] **Step 10: Commit**

```bash
git add src/routes/
git commit -m "feat: move app routes under /app prefix

Landing page at root, app at /app. SPA catch-all handles
client-side routing within the app shell."
```

---

### Task 4: PWA & Service Worker Scope

**Files:**
- Modify: `static/pwa/manifest.webmanifest` (scope)
- Modify: `src/hooks.client.ts` (SW scope)
- Modify: `vite.config.ts` (PWA plugin scope)

- [ ] **Step 1: Update manifest.webmanifest scope**

Change line 10:
```json
"scope": "/"
```
to:
```json
"scope": "/app"
```

`start_url` is already `/app`. No change needed.

- [ ] **Step 2: Update hooks.client.ts SW registration scope**

Change line 32:
```ts
.register("/firebase-messaging-sw.js", { scope: "/" })
```
to:
```ts
.register("/firebase-messaging-sw.js", { scope: "/app" })
```

- [ ] **Step 3: Update vite.config.ts PWA plugin scope and navigateFallback**

Find the VitePWA config section (around line 687) and make these changes:
- Update `scope` to `"/app"`
- Change `navigateFallback` from `"/200.html"` to `"/app"` (the SPA entry point for app routes)
- Review `navigateFallbackDenylist` — patterns like `/api/`, `/auth/`, `/firebase*` are outside `/app` scope now, but keeping them is harmless

- [ ] **Step 4: Commit**

```bash
git add static/pwa/manifest.webmanifest src/hooks.client.ts vite.config.ts
git commit -m "feat: restrict PWA and service worker scope to /app"
```

---

### Task 5: Update tkascribe.com URL References

**Files:**
- Modify: `src/config/domains.ts` (already partially done in Task 2)
- Modify: `firebase-functions/src/sendMagicLink.ts`
- Modify: `config/firebase-storage-cors.json`
- Modify: `static/robots.txt`
- Modify: `static/sitemap.xml`
- Modify: `src/routes/sitemap.xml/+server.ts`
- Modify: `src/routes/+page.svelte` (JSON-LD structured data)
- Modify: `src/routes/landing/components/InAppBrowserModal.svelte`
- Modify: `android-twa/twa-manifest.json`
- Modify: `android-twa/app/build.gradle`
- Modify: `android-twa/app/src/main/res/values/strings.xml`
- Modify: `static/branding/og-image.html`
- Modify: `scripts/posthog-query.cjs`

- [ ] **Step 1: Update firebase-functions/src/sendMagicLink.ts**

Change `continueUrl` from `https://tkascribe.com/` to `https://tkaflowarts.com/app`.

- [ ] **Step 2: Update config/firebase-storage-cors.json**

Replace `tkascribe.com` origins with `tkaflowarts.com`:
```json
"origin": [
  "https://tkaflowarts.com",
  "https://www.tkaflowarts.com",
  "http://localhost:5173",
  "http://localhost:5174"
]
```

- [ ] **Step 3: Update static/robots.txt**

Change line 2: `# https://tkascribe.com` → `# https://tkaflowarts.com`
Change line 45: `Sitemap: https://tkascribe.com/sitemap.xml` → `Sitemap: https://tkaflowarts.com/sitemap.xml`

- [ ] **Step 4: Update static/sitemap.xml**

Replace all `tkascribe.com` URLs with `tkaflowarts.com`. App routes should include the `/app` prefix. Or better: delete this file entirely and rely on the dynamic `src/routes/sitemap.xml/+server.ts`.

- [ ] **Step 5: Update src/routes/sitemap.xml/+server.ts**

Update domain references. The dynamic sitemap should generate URLs under `tkaflowarts.com` with app routes under `/app`. Remove the `isAppDomain()` conditional — there's only one domain now.

- [ ] **Step 6: Update src/routes/+page.svelte JSON-LD**

Update all `tkascribe.com` URLs in the structured data to `tkaflowarts.com`. App URLs get the `/app` prefix. Also update `support@tkascribe.com` email to `support@tkaflowarts.com` (line ~186).

- [ ] **Step 7: Update InAppBrowserModal.svelte**

Change hardcoded clipboard URL from `https://tkascribe.com` to `https://tkaflowarts.com/app`.

- [ ] **Step 8: Update Android TWA files**

In `android-twa/twa-manifest.json`:
- `"host": "tkascribe.com"` → `"host": "tkaflowarts.com"`
- `"startUrl": "/"` → `"startUrl": "/app"`
- Icon URLs: `tkascribe.com` → `tkaflowarts.com`
- `"webManifestUrl"`: update to tkaflowarts.com
- `"fullScopeUrl"`: update to tkaflowarts.com/app

In `android-twa/app/build.gradle`:
- `hostName: 'tkascribe.com'` → `hostName: 'tkaflowarts.com'`
- Update `fullScopeUrl` and `webManifestUrl` references

In `android-twa/app/src/main/res/values/strings.xml`:
- Update any tkascribe.com references

- [ ] **Step 9: Update static/branding/og-image.html**

Replace `tkascribe.com` with `tkaflowarts.com`.

- [ ] **Step 10: Update scripts/posthog-query.cjs**

Update hostname filters from `tkascribe.com` to `tkaflowarts.com`.

- [ ] **Step 11: Commit**

```bash
git add firebase-functions/ config/ static/ src/routes/ android-twa/ scripts/
git commit -m "feat: update all tkascribe.com URLs to tkaflowarts.com

App URLs now use tkaflowarts.com/app. Landing URLs use tkaflowarts.com.
CORS, sitemaps, robots.txt, Android TWA, Firebase, and OG image updated."
```

---

### Task 6: Card Back URL Updates (Low Priority)

**Files:**
- Modify: `src/lib/features/choreo-card/components/CardBack.svelte`
- Modify: `src/lib/features/choreo-card/components/card-back/CardBackV1.svelte`
- Modify: `src/lib/features/choreo-card/components/card-back/CardBackV2.svelte`
- Modify: `src/lib/features/choreo-card/components/card-back/CardBackV3.svelte`
- Modify: `src/lib/features/choreo-card/components/card-back/CardBackV4.svelte`

- [ ] **Step 1: Update printed card URLs**

Replace `tkascribe.com` with `tkaflowarts.com` in all card back components. These are URLs printed on physical cards, so they should point to the landing page (tkaflowarts.com), not the app directly.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/
git commit -m "feat: update printed card URLs from tkascribe.com to tkaflowarts.com"
```

---

### Task 7: Delete Entire Migration Module

The migration module was built to prompt users migrating from tkaflowarts.com to tkascribe.com. That direction is now reversed and handled by server-side redirects. Delete the entire module.

**Files to delete (full dependency tree):**
- `src/lib/shared/migration/config/migration-config.ts`
- `src/lib/shared/migration/state/migration-state.svelte.ts` (imports migration-config)
- `src/lib/shared/migration/components/MigrationChecker.svelte` (imports state + modal + banner)
- `src/lib/shared/migration/components/MigrationModal.svelte` (imported by MigrationChecker)
- `src/lib/shared/migration/components/MigrationBanner.svelte` (imported by MigrationChecker)

**File to modify:**
- `src/lib/shared/application/components/MainApplication.svelte` (imports MigrationChecker)

- [ ] **Step 1: Remove MigrationChecker import from MainApplication.svelte**

Find and remove the `MigrationChecker` import and its usage in the template.

- [ ] **Step 2: Delete entire migration directory**

```bash
git rm -r src/lib/shared/migration/
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: No broken imports.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/migration/ src/lib/shared/application/components/MainApplication.svelte
git commit -m "chore: delete migration module (entire directory)

Domain migration is now handled by server-side 301 redirects,
not client-side migration prompts. Full module removed:
config, state, MigrationChecker, MigrationModal, MigrationBanner."
```

---

### Task 8: Prerendering for Public Routes

**Files:**
- Create: `src/routes/(public)/+layout.ts` (enable SSR/prerender for public routes)
- Potentially modify: `src/routes/+layout.svelte` (ensure SSR-compatible for landing)

- [ ] **Step 1: Create (public) layout.ts**

Create `src/routes/(public)/+layout.ts`:
```ts
export const prerender = true;
export const ssr = true;
```

- [ ] **Step 2: Test build**

```bash
npm run build
```

Check for SSR errors. If the root layout imports browser-only code unconditionally, those imports need to be guarded with `import { browser } from "$app/environment"` checks.

- [ ] **Step 3: Fix any SSR issues**

The root `+layout.svelte` already uses `onMount` for all heavy initialization (DI, Firebase, etc.), so browser-only code should be safe. But verify that no top-level imports break during SSR.

If prerendering causes issues, this task can be deferred — the app works fine without it. Prerendering is an optimization, not a requirement.

- [ ] **Step 4: Commit (if successful)**

```bash
git add src/routes/
git commit -m "feat: enable prerendering for public landing pages

Static HTML generated at build time for /, /about, /roots,
/terms, /privacy, /delete-account. App routes remain client-only SPA."
```

---

### Task 9: Cloudflare Deployment & Redirects

This task is infrastructure, not code. It involves the Cloudflare dashboard.

- [ ] **Step 1: Create _redirects file for tkascribe.com**

Create `static/_redirects` (or update existing):
```
# Public routes — preserve path
/sequence/*  https://tkaflowarts.com/sequence/:splat  301
/p/*         https://tkaflowarts.com/p/:splat  301
/about       https://tkaflowarts.com/about  301
/terms       https://tkaflowarts.com/terms  301
/privacy     https://tkaflowarts.com/privacy  301

# Everything else — redirect to /app
/*           https://tkaflowarts.com/app/:splat  301
```

Note: This `_redirects` file would only apply to the tkascribe.com deployment. If both domains point to the same Cloudflare Pages project, you'll need Cloudflare Page Rules or a middleware approach instead. Coordinate with the user on the Cloudflare setup.

- [ ] **Step 2: Update Cloudflare Pages custom domains**

Either:
- (A) Add `tkaflowarts.com` as custom domain on the main Pages project, remove the separate landing deployment
- (B) Use Cloudflare DNS to point tkaflowarts.com at the same Pages project

The user should handle this in the Cloudflare dashboard.

- [ ] **Step 3: Add tkaflowarts.com to Firebase authorized domains**

In Firebase Console → Authentication → Settings → Authorized domains, ensure `tkaflowarts.com` is listed.

- [ ] **Step 4: Apply CORS config**

```bash
gsutil cors set config/firebase-storage-cors.json gs://the-kinetic-alphabet.firebasestorage.app
```

- [ ] **Step 5: Commit _redirects**

```bash
git add static/_redirects
git commit -m "feat: add redirect rules for tkascribe.com → tkaflowarts.com"
```

---

### Task 10: Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 2: Run typecheck**

```bash
npm run check
```

Expected: No type errors.

- [ ] **Step 3: Search for remaining tkascribe.com references**

```bash
grep -ri "tkascribe\.com" --include="*.ts" --include="*.svelte" --include="*.json" --include="*.html" --include="*.js" --include="*.xml" --include="*.txt" src/ static/ firebase-functions/ config/ android-twa/ scripts/ | grep -v node_modules | grep -v .svelte-kit | grep -v build/
```

Expected: Zero results (except possibly card back components if Task 6 was deferred, and `.claude/settings.local.json` which is local config).

- [ ] **Step 4: Search for old domain-based mode detection**

```bash
grep -r "DOMAIN_MODE_MAP\|hostname.*tkascribe\|hostname.*tkaflowarts" src/ --include="*.ts" --include="*.svelte"
```

Expected: Zero results.

- [ ] **Step 5: Spot-check key values**

Verify:
- `APP_DOMAIN` in `domains.ts` is `"https://tkaflowarts.com/app"`
- `manifest.webmanifest` scope is `"/app"` and start_url is `"/app"`
- `src/app.html` uses path-based detection, not hostname
- `src/routes/app/+page.svelte` exists and loads MainApplication
- `src/routes/+page.svelte` only renders landing content (no app conditional)

- [ ] **Step 6: Fix any remaining issues and commit**
