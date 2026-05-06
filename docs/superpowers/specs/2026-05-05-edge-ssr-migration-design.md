# Edge SSR Migration: adapter-static → adapter-cloudflare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Serve server-rendered HTML with Open Graph meta tags on share links (`/sequence/[id]`, `/q/[code]`) so social crawlers and search engines see rich previews. Migrate from adapter-static to adapter-cloudflare for selective edge SSR while keeping the bulk of the app as a prerendered SPA.

**Architecture:** Cloudflare Pages with `@sveltejs/adapter-cloudflare`. Static routes prerender at build time. Dynamic routes (share links, API endpoints) run as Pages Functions at the edge. Firebase Admin runs via `nodejs_compat` flag.

**Tech Stack:** SvelteKit, @sveltejs/adapter-cloudflare, Cloudflare Pages Functions, Wrangler, Firebase Admin SDK (edge-compatible via nodejs_compat)

---

## Context

### Current State

- `adapter-static` builds everything to `build/` with `fallback: "index.html"`
- Deployed to Cloudflare Pages as a static site
- All meta tags render client-side (invisible to crawlers)
- Share links (`/sequence/[id]`) encode full sequence data in URL slugs
- Short code links (`/q/[code]`) resolve via Firebase/Firestore
- `seo-manager.ts` exists with `generateMetaTags()` but is unused in routes
- 17 API endpoints, 3 are dev-only (use fs/path/canvas)
- Firebase Admin SDK handles auth verification for API endpoints
- Domain: `tkaflowarts.com` (single domain architecture)

### Problem

Social platforms (Twitter, Facebook, Slack, Discord, iMessage) and search engines receive empty `<meta>` tags when users share sequence links. The OG title, image, and description only populate after JavaScript executes — crawlers never see them.

### Success Criteria

1. `curl -s https://tkaflowarts.com/sequence/enc_... | grep "og:title"` returns the sequence word
2. Twitter Card Validator shows rich preview for any share link
3. Facebook Sharing Debugger shows thumbnail + title + description
4. Google Search Console shows indexed sequence pages with correct titles
5. Existing app functionality unchanged (no regressions)
6. Build time stays under 3 minutes
7. TTFB for SSR'd routes < 200ms at edge

---

## Architecture

### Route Strategy

| Route Pattern | Render Mode | Rationale |
|---------------|-------------|-----------|
| `/` | Prerender | Landing page is static content |
| `/guide/*`, `/about/*` | Prerender | Static educational content |
| `/browse/*`, `/create/*`, `/library/*` | SPA (client) | Auth-gated app modules — no SSR value |
| `/sequence/[id]` | **SSR** | Share links need OG tags; data is in URL |
| `/q/[code]` | **SSR** | Short code links need Firestore lookup for OG tags |
| `/api/admin/*` | Pages Function | Auth-gated admin endpoints |
| `/api/tika/*` (ask, models, voice-command, flagged) | Pages Function | AI assistant endpoints |
| `/api/gallery-write` | Pages Function | Authenticated write endpoint |
| `/api/feedback/ingest` | Pages Function | Public feedback submission |
| `/api/render-pictograph` | **Excluded** | Dev-only, uses Node.js canvas |
| `/api/tika/pictograph` | **Excluded** | Dev-only, uses fs/path |
| `/api/pictograph/[letter]` | **Excluded** | Dev-only, uses fs/path |
| `/api/batch-render`, `/api/test-render`, `/api/dev/*` | **Excluded** | Dev-only |

### SPA Fallback

App routes (`/browse`, `/create`, `/library`, `/compose`, `/festivals`, `/lab`, `/admin`, etc.) continue as client-side SPA. The adapter-cloudflare config uses `fallback: "index.html"` for unmatched routes, preserving current behavior.

### Prerender List

Explicitly prerendered routes (crawled at build time):
- `/`
- `/guide/level-1/*`
- `/about`, `/about/compare`
- `/privacy`, `/terms`
- `/robots.txt`, `/sitemap.xml`, `/.well-known/assetlinks.json`

---

## Component Design

### 1. Adapter Configuration

**File:** `svelte.config.js`

Replace `@sveltejs/adapter-static` with `@sveltejs/adapter-cloudflare`:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'] // Let Cloudflare handle static asset routing
      }
    })
  }
};
```

### 2. Wrangler Configuration

**File:** `wrangler.toml` (new)

```toml
name = "tka-platform"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"

[vars]
PUBLIC_ENVIRONMENT = "production"
```

Secrets (set via `wrangler pages secret put`):
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `FEEDBACK_INGEST_KEY`

### 3. Sequence Route Server Load

**File:** `src/routes/sequence/[id]/+page.server.ts` (new)

Decodes sequence metadata from the URL for SSR meta tag rendering. No network calls needed — all data is encoded in the URL slug and search params.

```typescript
import type { PageServerLoad } from './$types';
import { parseSequenceRouteId, decodeSequenceWithCompression } from '$lib/shared/navigation/services/sequence-encoder';

export const load: PageServerLoad = ({ params, url }) => {
  const parsed = parseSequenceRouteId(params.id);
  
  let word: string | null = url.searchParams.get('word');
  let creator: string | null = url.searchParams.get('creator');
  let difficulty: string | null = url.searchParams.get('difficulty');
  let stepCount: number | null = null;
  let thumbnailUrl: string | null = null;

  // Try to decode sequence for additional metadata
  if (parsed.encoded) {
    try {
      const decoded = decodeSequenceWithCompression(parsed.encoded);
      word ??= decoded.word ?? decoded.name ?? null;
      stepCount = decoded.steps?.length ?? null;
    } catch {
      // Decode failure is non-fatal — URL params are sufficient
    }
  }

  // Build thumbnail URL from word + prop type
  const propType = url.searchParams.get('bp') || 'staff';
  if (word) {
    thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(word)}-${propType}.png?alt=media`;
  }

  return {
    meta: {
      word,
      creator,
      difficulty,
      stepCount,
      thumbnailUrl,
    }
  };
};
```

### 4. Sequence Route Meta Tags

**File:** `src/routes/sequence/[id]/+page.svelte` (modify `<svelte:head>`)

Replace current client-only meta tags with server-data-driven tags:

```svelte
<script lang="ts">
  // ... existing script ...
  const { data } = $props(); // from +page.server.ts
</script>

<svelte:head>
  {@const title = sequence?.word || data?.meta?.word || "Sequence"}
  {@const creator = sequence?.ownerDisplayName || data?.meta?.creator}
  {@const desc = creator
    ? `Flow sequence by ${creator}${data?.meta?.stepCount ? ` • ${data.meta.stepCount} beats` : ''}${data?.meta?.difficulty ? ` • Level ${data.meta.difficulty}` : ''}`
    : `View this flow sequence in TKA Composer`}
  {@const image = data?.meta?.thumbnailUrl || 'https://tkaflowarts.com/og-default.png'}

  <title>{title} - TKA Composer</title>
  <meta name="description" content={desc} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{title} - TKA Composer" />
  <meta property="og:description" content={desc} />
  <meta property="og:image" content={image} />
  <meta property="og:url" content="https://tkaflowarts.com/sequence/{$page.params.id}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{title} - TKA Composer" />
  <meta name="twitter:description" content={desc} />
  <meta name="twitter:image" content={image} />
</svelte:head>
```

### 5. Short Code Route SSR Enhancement

**File:** `src/routes/q/[code]/+page.server.ts` (modify)

Add sequence metadata lookup for OG tags:

```typescript
import type { PageServerLoad } from './$types';
import { getAdminDb } from '$lib/server/firebaseAdmin';

export const load: PageServerLoad = async ({ params, request }) => {
  const geo = {
    country: request.headers.get('cf-ipcountry') || null,
    city: request.headers.get('cf-ipcity') || null,
  };

  // Resolve short code for OG meta tags
  let meta = { word: null, creator: null, thumbnailUrl: null };
  try {
    const db = getAdminDb();
    const doc = await db.collection('shortcodes').doc(params.code).get();
    if (doc.exists) {
      const data = doc.data();
      meta = {
        word: data?.word || data?.name || null,
        creator: data?.ownerDisplayName || null,
        thumbnailUrl: data?.thumbnailUrl || null,
      };
    }
  } catch {
    // Firestore lookup failure is non-fatal
  }

  return { geo, meta };
};
```

### 6. Firebase Admin Edge Compatibility

**File:** `src/lib/server/firebaseAdmin.ts` (modify)

Remove filesystem-based credential loading. Edge runtime gets credentials from env vars only:

```typescript
import admin from "firebase-admin";

let initialized = false;

function loadServiceAccount(): unknown {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!fromEnv) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable. " +
      "Set via wrangler pages secret put FIREBASE_SERVICE_ACCOUNT_JSON"
    );
  }
  return JSON.parse(fromEnv);
}

export function getFirebaseAdminApp(): admin.app.App {
  if (initialized && admin.apps.length) {
    return admin.apps[0]!;
  }
  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }
  initialized = true;
  return admin.apps[0]!;
}

export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}

export function getAdminDb(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
```

### 7. Dev-Only Endpoint Guards

**Files:** `src/routes/api/render-pictograph/+server.ts`, `src/routes/api/tika/pictograph/+server.ts`, `src/routes/api/pictograph/[letter]/+server.ts`

Add production guard at top of each handler:

```typescript
import { dev } from '$app/environment';

export const GET: RequestHandler = async (event) => {
  if (!dev) {
    return new Response('This endpoint is only available in development', { status: 404 });
  }
  // ... existing logic ...
};
```

### 8. Hooks Server Cleanup

**File:** `src/hooks.server.ts` (modify)

Wrap console forwarding in dev guard:

```typescript
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
  if (dev && event.url.pathname === "/api/console-forward") {
    // ... console forwarding logic (unchanged) ...
  }
  // ... rest of hooks (CORS, CSP, security headers — unchanged) ...
};
```

---

## Deploy Pipeline

### Build

```bash
npm run build  # SvelteKit builds to .svelte-kit/cloudflare/
```

### Local Testing

```bash
npx wrangler pages dev .svelte-kit/cloudflare
```

### Deploy

```bash
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=tka-platform
```

Or connect GitHub repo to Cloudflare Pages dashboard for automatic deploys on push.

### Secrets Setup (One-Time)

```bash
npx wrangler pages secret put FIREBASE_SERVICE_ACCOUNT_JSON --project-name=tka-platform
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=tka-platform
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name=tka-platform
npx wrangler pages secret put FEEDBACK_INGEST_KEY --project-name=tka-platform
```

---

## Migration Steps (High-Level)

1. Install `@sveltejs/adapter-cloudflare`, remove `@sveltejs/adapter-static`
2. Create `wrangler.toml`
3. Update `svelte.config.js` adapter config
4. Add dev guards to fs-dependent endpoints
5. Simplify `firebaseAdmin.ts` (env-var only)
6. Wrap console-forward in dev guard
7. Create `src/routes/sequence/[id]/+page.server.ts`
8. Update `src/routes/sequence/[id]/+page.svelte` meta tags to use server data
9. Enhance `src/routes/q/[code]/+page.server.ts` with Firestore metadata lookup
10. Update `/q/[code]/+page.svelte` meta tags
11. Add default OG image to `static/og-default.png`
12. Verify build succeeds with new adapter
13. Test locally with `wrangler pages dev`
14. Deploy to Cloudflare Pages
15. Validate with Twitter Card Validator + Facebook Sharing Debugger

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `firebase-admin` incompatible with Workers | `nodejs_compat` flag enables Node.js APIs. If still fails, fall back to REST-based Firestore reads for OG metadata only. |
| Cold start latency on SSR routes | Sequence route does zero network calls (URL decode only). Short code route does one Firestore read. Both should be < 50ms. |
| SPA routes break with new adapter | `fallback` config preserves SPA behavior for unmatched routes. Client-side routing unchanged. |
| Build output format changes break CI | Update any CI scripts from `build/` to `.svelte-kit/cloudflare/`. Likely just the deploy command. |
| `decodeSequenceWithCompression` uses browser APIs | Verify it works in Workers runtime. It's pure JS (base64 + pako decompress) — should be fine. If not, the server load catches the error and falls through to URL params. |

---

## Out of Scope

- Full SSR for authenticated app routes (Browse, Create, Library) — no SEO value behind auth
- Server-side rendering of pictograph images — thumbnails served from Firebase Storage
- Dynamic sitemap generation with all public sequences — separate future enhancement
- Image CDN / OG image generation service — use existing Firebase Storage thumbnails
- Migrating existing Cloudflare Pages project settings — assumes fresh `wrangler pages` setup or dashboard reconfiguration

---

## Effort Estimate

| Task | Effort | Parallelizable |
|------|--------|----------------|
| Adapter swap + wrangler config | 15 min | No (foundation) |
| Dev endpoint guards | 10 min | Yes |
| Firebase Admin simplification | 10 min | Yes |
| Hooks cleanup | 5 min | Yes |
| Sequence +page.server.ts + meta tags | 30 min | Yes |
| Short code +page.server.ts + meta tags | 20 min | Yes |
| Default OG image asset | 5 min | Yes |
| Build verification | 10 min | No (after above) |
| Local wrangler testing | 20 min | No (after build) |
| Deploy + social validator testing | 15 min | No (after local) |
| **Total** | **~2.5 hours** | |

With subagent parallelism on the middle tasks: **~1.5 hours wall clock**.
