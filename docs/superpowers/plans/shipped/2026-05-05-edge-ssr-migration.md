# Edge SSR Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from adapter-static to adapter-cloudflare so share links serve server-rendered OG meta tags visible to social crawlers.

**Architecture:** Cloudflare Pages with selective SSR. Static routes prerender at build. `/sequence/[id]` and `/q/[code]` SSR at edge with OG meta tags. API endpoints run as Pages Functions with `nodejs_compat` for Firebase Admin.

**Tech Stack:** SvelteKit, @sveltejs/adapter-cloudflare, Wrangler, Firebase Admin, lz-string (sequence decoding)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `svelte.config.js` | Modify | Switch adapter-static → adapter-cloudflare |
| `wrangler.toml` | Create | Cloudflare Pages project config, nodejs_compat flag |
| `package.json` | Modify | Swap adapter dependency |
| `src/routes/sequence/[id]/+page.server.ts` | Create | Decode sequence URL → return OG metadata for SSR |
| `src/routes/sequence/[id]/+page.svelte` | Modify | Wire server data into `<svelte:head>` OG tags |
| `src/routes/q/[code]/+page.server.ts` | Modify | Add Firestore lookup for sequence metadata |
| `src/routes/q/[code]/+page.svelte` | Modify | Wire server data into `<svelte:head>` OG tags |
| `src/lib/server/firebaseAdmin.ts` | Modify | Remove fs-based credential loading |
| `src/hooks.server.ts` | Modify | Wrap console-forward in dev guard |
| `src/routes/api/render-pictograph/+server.ts` | Modify | Add production guard |
| `src/routes/api/tika/pictograph/+server.ts` | Modify | Add production guard |
| `src/routes/api/pictograph/[letter]/+server.ts` | Modify | Add production guard |
| `static/og-default.png` | Create | Fallback OG image for sequences without thumbnails |

---

### Task 1: Adapter Swap + Wrangler Config

**Files:**
- Modify: `package.json:127`
- Modify: `svelte.config.js:1-11`
- Create: `wrangler.toml`

- [ ] **Step 1: Install adapter-cloudflare, remove adapter-static**

```bash
npm install --save-dev @sveltejs/adapter-cloudflare && npm uninstall @sveltejs/adapter-static
```

- [ ] **Step 2: Update svelte.config.js**

Replace lines 1-11 of `svelte.config.js`:

```javascript
import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess({ script: true }),

  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>']
      }
    }),
```

Everything else in svelte.config.js stays unchanged (aliases, paths, prerender, compilerOptions, onwarn).

- [ ] **Step 3: Create wrangler.toml**

Create `wrangler.toml` in project root:

```toml
name = "tka-platform"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".svelte-kit/cloudflare"

[vars]
PUBLIC_ENVIRONMENT = "production"
```

- [ ] **Step 4: Verify build succeeds**

```bash
npm run build
```

Expected: Build completes, output goes to `.svelte-kit/cloudflare/` instead of `build/`.

- [ ] **Step 5: Commit**

```bash
git add svelte.config.js wrangler.toml package.json package-lock.json
git commit -m "feat: swap adapter-static for adapter-cloudflare with wrangler config"
```

---

### Task 2: Dev-Only Endpoint Guards

**Files:**
- Modify: `src/routes/api/render-pictograph/+server.ts:1-11`
- Modify: `src/routes/api/tika/pictograph/+server.ts:1-14`
- Modify: `src/routes/api/pictograph/[letter]/+server.ts` (top of file)

These endpoints use `fs`, `path`, and `canvas` (Node.js-only). They already don't function in production static builds. Add explicit guards so the edge runtime doesn't try to import them.

- [ ] **Step 1: Guard render-pictograph**

Add at line 2 of `src/routes/api/render-pictograph/+server.ts` (after the first import):

```typescript
import { dev } from '$app/environment';
```

Then wrap the handler body. Replace the existing `export const GET: RequestHandler = async (event) => {` with:

```typescript
export const GET: RequestHandler = async (event) => {
  if (!dev) {
    return new Response('This endpoint is only available in development', { status: 404 });
  }
```

The rest of the function body stays unchanged. The closing `}` stays.

- [ ] **Step 2: Guard tika/pictograph**

Add at line 15 of `src/routes/api/tika/pictograph/+server.ts` (after existing imports):

```typescript
import { dev } from '$app/environment';
```

Then add at the top of the POST handler body:

```typescript
  if (!dev) {
    return json({ error: 'This endpoint is only available in development' }, { status: 404 });
  }
```

- [ ] **Step 3: Guard pictograph/[letter]**

Same pattern. Add `import { dev } from '$app/environment';` after existing imports.

Add at top of GET handler body:

```typescript
  if (!dev) {
    return new Response('This endpoint is only available in development', { status: 404 });
  }
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds. Dev-only imports (fs, path, canvas) are still present but guarded.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/render-pictograph/+server.ts src/routes/api/tika/pictograph/+server.ts src/routes/api/pictograph/\[letter\]/+server.ts
git commit -m "feat: add production guards to dev-only API endpoints"
```

---

### Task 3: Firebase Admin Edge Compatibility

**Files:**
- Modify: `src/lib/server/firebaseAdmin.ts`

Remove filesystem-based credential loading (`fs.existsSync`, `fs.readFileSync`, `path.resolve`). Edge runtime provides credentials via `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable only.

- [ ] **Step 1: Rewrite firebaseAdmin.ts**

Replace the entire contents of `src/lib/server/firebaseAdmin.ts` with:

```typescript
import admin from "firebase-admin";
import { dev } from "$app/environment";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

let initialized = false;

function loadServiceAccount(): unknown {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (fromEnv) {
    return JSON.parse(fromEnv);
  }

  // Filesystem fallback only in dev (edge runtime has no fs)
  if (dev) {
    const candidates = [
      "serviceAccountKey.json",
      resolve("../../serviceAccountKey.json"),
    ];
    const keyPath = candidates.find((p) => existsSync(p));
    if (keyPath) {
      try {
        return JSON.parse(readFileSync(keyPath, "utf8"));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to read ${keyPath}: ${message}`);
      }
    }
  }

  throw new Error(
    "Missing Firebase Admin credentials. " +
    (dev
      ? "Provide serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT_JSON env var."
      : "Set FIREBASE_SERVICE_ACCOUNT_JSON via: wrangler pages secret put FIREBASE_SERVICE_ACCOUNT_JSON")
  );
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

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds. The `fs`/`path` imports are tree-shaken in production because they're behind `if (dev)`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/firebaseAdmin.ts
git commit -m "feat: make Firebase Admin edge-compatible (env-var credentials, fs fallback dev-only)"
```

---

### Task 4: Hooks Server Cleanup

**Files:**
- Modify: `src/hooks.server.ts:26-44`

Wrap console forwarding in dev guard so `process.stdout.write` doesn't execute on edge.

- [ ] **Step 1: Add dev import and wrap console forwarding**

Add at top of `src/hooks.server.ts`:

```typescript
import { dev } from "$app/environment";
```

Change line 28 from:

```typescript
  if (event.url.pathname === "/api/console-forward") {
```

To:

```typescript
  if (dev && event.url.pathname === "/api/console-forward") {
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks.server.ts
git commit -m "feat: wrap console-forward endpoint in dev guard for edge compatibility"
```

---

### Task 5: Sequence Route Server Load + OG Meta Tags

**Files:**
- Create: `src/routes/sequence/[id]/+page.server.ts`
- Modify: `src/routes/sequence/[id]/+page.svelte:439-447`

Add server-side load function that extracts metadata from the URL (no network calls). Update `<svelte:head>` to render OG tags from server data.

- [ ] **Step 1: Create +page.server.ts**

Create `src/routes/sequence/[id]/+page.server.ts`:

```typescript
import type { PageServerLoad } from "./$types";
import {
  parseSequenceRouteId,
  decodeSequenceWithCompression,
} from "$lib/shared/navigation/services/sequence-encoder";

export const load: PageServerLoad = ({ params, url }) => {
  const parsed = parseSequenceRouteId(params.id);

  let word: string | null = url.searchParams.get("word");
  let creator: string | null = url.searchParams.get("creator");
  let difficulty: string | null = url.searchParams.get("difficulty");
  let stepCount: number | null = null;

  if (parsed.encoded) {
    try {
      const decoded = decodeSequenceWithCompression(parsed.encoded);
      word ??= decoded.word ?? decoded.name ?? null;
      stepCount = decoded.steps?.length ?? null;
    } catch {
      // Decode failure is non-fatal — URL params provide fallback
    }
  }

  const propType = url.searchParams.get("bp") || "staff";
  const thumbnailUrl = word
    ? `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(word)}-${propType}.png?alt=media`
    : null;

  return {
    meta: { word, creator, difficulty, stepCount, thumbnailUrl },
  };
};
```

- [ ] **Step 2: Add Props interface and wire data in +page.svelte**

In `src/routes/sequence/[id]/+page.svelte`, add at line 44 (after the existing imports, before the route params section):

```typescript
  interface Props {
    data: {
      meta: {
        word: string | null;
        creator: string | null;
        difficulty: string | null;
        stepCount: number | null;
        thumbnailUrl: string | null;
      };
    };
  }

  const { data }: Props = $props();
```

- [ ] **Step 3: Replace `<svelte:head>` block**

Replace lines 439-447 of `src/routes/sequence/[id]/+page.svelte`:

```svelte
<svelte:head>
  {@const ogWord = sequence?.word || data?.meta?.word || "Sequence"}
  {@const ogCreator = sequence?.ownerDisplayName || data?.meta?.creator}
  {@const ogDesc = ogCreator
    ? `Flow sequence by ${ogCreator}${data?.meta?.stepCount ? ` • ${data.meta.stepCount} beats` : ""}${data?.meta?.difficulty ? ` • Level ${data.meta.difficulty}` : ""}`
    : "View this flow sequence in TKA Composer"}
  {@const ogImage = data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png"}
  {@const ogUrl = `https://tkaflowarts.com/sequence/${$page.params.id}`}

  <title>{ogWord} - TKA Composer</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{ogWord} - TKA Composer" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content={ogUrl} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{ogWord} - TKA Composer" />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>
```

- [ ] **Step 4: Verify typecheck**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "Error|found"
```

Expected: 0 new errors.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/routes/sequence/\[id\]/+page.server.ts src/routes/sequence/\[id\]/+page.svelte
git commit -m "feat: add SSR OG meta tags for sequence share links"
```

---

### Task 6: Short Code Route SSR Enhancement + OG Meta Tags

**Files:**
- Modify: `src/routes/q/[code]/+page.server.ts`
- Modify: `src/routes/q/[code]/+page.svelte:305-316`

Add Firestore metadata lookup so `/q/[code]` share links serve OG tags for social previews.

- [ ] **Step 1: Rewrite +page.server.ts with metadata lookup**

Replace the entire contents of `src/routes/q/[code]/+page.server.ts`:

```typescript
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, request }) => {
  const geo = {
    country: request.headers.get("cf-ipcountry") || null,
    city: request.headers.get("cf-ipcity") || null,
  };

  let meta: { word: string | null; creator: string | null; thumbnailUrl: string | null } = {
    word: null,
    creator: null,
    thumbnailUrl: null,
  };

  try {
    const { getAdminDb } = await import("$lib/server/firebaseAdmin");
    const db = getAdminDb();
    const doc = await db.collection("shortcodes").doc(params.code).get();
    if (doc.exists) {
      const data = doc.data();
      meta = {
        word: data?.word || data?.name || null,
        creator: data?.ownerDisplayName || null,
        thumbnailUrl: data?.thumbnailUrl || null,
      };
    }
  } catch {
    // Firestore lookup failure is non-fatal — page still works without OG enrichment
  }

  return { geo, meta };
};
```

- [ ] **Step 2: Update Props interface in +page.svelte**

In `src/routes/q/[code]/+page.svelte`, replace the Props interface (lines 44-51):

```typescript
  interface Props {
    data: {
      geo: {
        country: string | null;
        city: string | null;
      };
      meta: {
        word: string | null;
        creator: string | null;
        thumbnailUrl: string | null;
      };
    };
  }
```

- [ ] **Step 3: Replace `<svelte:head>` block**

Replace lines 305-316 of `src/routes/q/[code]/+page.svelte`:

```svelte
<svelte:head>
  {@const ogWord = state.kind === "playing" || state.kind === "rendering" ? state.word : data?.meta?.word || "Sequence"}
  {@const ogDesc = ogWord !== "Sequence" ? `Watch the ${ogWord} flow sequence` : "Watch this flow sequence"}
  {@const ogImage = data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png"}

  <title>{ogWord} - TKA</title>
  <meta name="description" content={ogDesc} />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="{ogWord} - TKA" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content="https://tkaflowarts.com/q/{$page.params.code}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{ogWord} - TKA" />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="theme-color" content="#0f0f1a" />
</svelte:head>
```

- [ ] **Step 4: Verify typecheck**

```bash
npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -E "Error|found"
```

Expected: 0 new errors.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/routes/q/\[code\]/+page.server.ts src/routes/q/\[code\]/+page.svelte
git commit -m "feat: add SSR OG meta tags for short code share links"
```

---

### Task 7: Default OG Image + Build Verification

**Files:**
- Create: `static/og-default.png`

- [ ] **Step 1: Create placeholder OG image**

The OG default image needs to be 1200x630px (standard OG dimensions). Create a simple branded fallback.

For now, create a minimal SVG-converted PNG. If a proper branded image exists in the repo, use that instead. Check:

```bash
find static -name "*.png" | grep -i "og\|social\|share\|brand" | head -5
```

If nothing suitable exists, create a minimal 1200x630 PNG using ImageMagick or similar:

```bash
npx sharp-cli create --width 1200 --height 630 --channels 4 --background "#0f0f1a" static/og-default.png
```

Or manually place a branded PNG at `static/og-default.png`. The image should show the TKA logo on a dark background at 1200x630px.

- [ ] **Step 2: Full build verification**

```bash
npm run build
```

Expected: Build succeeds with adapter-cloudflare output in `.svelte-kit/cloudflare/`.

- [ ] **Step 3: Verify SSR output contains OG tags**

After build, check that the sequence route produces server-rendered HTML:

```bash
npx wrangler pages dev .svelte-kit/cloudflare --port 8788
```

In a separate terminal:

```bash
curl -s http://localhost:8788/sequence/z:test123?word=FIRE&creator=Austen | grep "og:title"
```

Expected output contains:
```html
<meta property="og:title" content="FIRE - TKA Composer" />
```

- [ ] **Step 4: Verify SPA routes still work**

```bash
curl -s http://localhost:8788/browse/gallery | grep "<title>"
```

Expected: Returns the SPA fallback HTML (index.html with client-side routing). The page title will be generic until JS hydrates.

- [ ] **Step 5: Commit**

```bash
git add static/og-default.png
git commit -m "feat: add default OG image fallback for share links"
```

---

### Task 8: Update Build Scripts + Final Verification

**Files:**
- Modify: `package.json` (build scripts)

- [ ] **Step 1: Update build scripts**

The `inject-modulepreload.js` script currently targets `build/index.html`. With adapter-cloudflare, the output directory changes. Update the script path or remove it if Cloudflare Pages handles preloading differently.

Check if the script needs updating:

```bash
grep -n "build/index.html\|build\\\\index" scripts/inject-modulepreload.js
```

If it references `build/index.html`, update to target the correct output path for adapter-cloudflare (`.svelte-kit/cloudflare/index.html` or check the actual output structure).

If the static fallback HTML lives elsewhere in the new output, update the script accordingly. If adapter-cloudflare doesn't produce a single `index.html` fallback, the modulepreload script may need to target the server-rendered template instead.

- [ ] **Step 2: Run full build pipeline**

```bash
npm run build
```

Verify no errors.

- [ ] **Step 3: Run typecheck**

```bash
npx svelte-check --tsconfig ./tsconfig.json
```

Expected: 0 new errors (pre-existing warnings are fine).

- [ ] **Step 4: Commit any script updates**

```bash
git add package.json scripts/inject-modulepreload.js
git commit -m "feat: update build scripts for adapter-cloudflare output paths"
```

---

### Task 9: Deploy + Social Validator Testing

**Files:** None (operational task)

This task requires Austen's Cloudflare credentials and is the one step that cannot be done by subagents.

- [ ] **Step 1: Set secrets**

```bash
npx wrangler pages secret put FIREBASE_SERVICE_ACCOUNT_JSON --project-name=tka-platform
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=tka-platform
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name=tka-platform
npx wrangler pages secret put FEEDBACK_INGEST_KEY --project-name=tka-platform
```

Each will prompt for the secret value interactively.

- [ ] **Step 2: Deploy**

```bash
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=tka-platform
```

- [ ] **Step 3: Validate OG tags with curl**

```bash
curl -s https://tkaflowarts.com/sequence/enc_...?word=FIRE&creator=Austen | grep "og:"
```

Expected: All OG meta tags present in raw HTML.

- [ ] **Step 4: Validate with social platforms**

- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

Paste a real share link. Verify title, description, and image render.

- [ ] **Step 5: Verify no regressions**

- Browse gallery loads correctly
- Create module works
- Authentication works (Firebase token verification via API endpoints)
- QR video landing page (`/q/[code]`) plays video

- [ ] **Step 6: Tag release**

```bash
git tag edge-ssr-v1
```

---

## Dependency Graph

```
Task 1 (adapter swap) ← foundation, must complete first
  ├── Task 2 (dev guards) — parallel
  ├── Task 3 (Firebase Admin) — parallel
  ├── Task 4 (hooks cleanup) — parallel
  ├── Task 5 (sequence OG tags) — parallel
  ├── Task 6 (short code OG tags) — parallel after Task 3
  └── Task 7 (OG image + verify) — after Tasks 2-6
      └── Task 8 (build scripts) — after Task 7
          └── Task 9 (deploy) — after Task 8, requires user credentials
```

Tasks 2, 3, 4, 5 can run in parallel after Task 1. Task 6 depends on Task 3 (Firebase Admin must be edge-compatible before the short code route can import it). Tasks 7-9 are serial.
