---
status: backlog
value: 3
effort: M
remaining: "Body status: Design"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Social Sharing SSR + SEO Fix

**Date:** 2026-05-23
**Status:** Design
**Routes:** `/sequence/[id]`, `/q/[code]`

---

## Problem

Both `/sequence/[id]` and `/q/[code]` set `ssr = false` in their respective `+layout.ts` files. The OG meta tags live inside `<svelte:head>` in the Svelte components, which only render client-side. Social media crawlers (Facebook, Twitter/X, Discord, Slack, iMessage) don't execute JavaScript, so they receive an empty HTML shell with no `<meta>` tags. Every shared sequence link shows a blank preview card or the generic fallback image.

Both routes already have `+page.server.ts` files that fetch metadata:

- **`/sequence/[id]/+page.server.ts`** decodes the URL-encoded sequence data (word, step count, difficulty) and constructs a Firebase Storage thumbnail URL. No Firestore call -- purely URL parsing.
- **`/q/[code]/+page.server.ts`** queries Firestore (`shortcodes/{code}`) via `firebase-admin` to get word, creator, and thumbnail URL. Also extracts geo headers from Cloudflare.

The server load functions work and return data. The problem is that `ssr = false` prevents SvelteKit from rendering the component HTML server-side, so the `<svelte:head>` tags never appear in the initial response.

### Additional SEO issues

| Issue | Details |
|---|---|
| **Stale sitemap** | `static/sitemap.xml` has every `<lastmod>` set to `2026-01-03`. Missing: `/guide/level-1/*`, `/guide/level-2/*`, `/store`, `/browse/gallery`. |
| **og-image.png is HTML** | `static/branding/og-image.html` exists but no actual `og-image.png`. The landing page references `https://tkaflowarts.com/branding/og-image.png` which resolves to an HTML file. Crawlers that check Content-Type will reject it. |
| **No canonical URLs** | Only `/` and `/about` have `<link rel="canonical">`. Sequence, QR, guide, store, privacy, terms pages all lack it. |
| **No JSON-LD on content pages** | Only `/` and `/about` have structured data. Sequence pages (the primary shared content type) have none. |

---

## Architecture Context

| Layer | Value |
|---|---|
| Adapter | `@sveltejs/adapter-cloudflare` v7.2.8 |
| Runtime | Cloudflare Pages Functions (Workers) |
| Compat flags | `nodejs_compat` (supports `firebase-admin`) |
| Firestore access | `$lib/server/firebaseAdmin.ts` -- singleton `firebase-admin` init via `FIREBASE_SERVICE_ACCOUNT_JSON` secret |
| Sequence URL format | `/sequence/{url-encoded-compressed-pipe-delimited-data}` or `/sequence/{legacy-firestore-id}` |
| QR URL format | `/q/{shortcode}` (6-char code resolving via Firestore `shortcodes` collection) |

### Route hierarchy

```
src/routes/+layout.ts          → ssr = true (root)
src/routes/sequence/+layout.ts → ssr = false (overrides root)
src/routes/q/+layout.ts        → ssr = false (overrides root)
```

Both routes have `+page.server.ts` files. SvelteKit runs `+page.server.ts` even when `ssr = false` -- the data is serialized and embedded as `__data.json` for the client to consume. But the component tree is not rendered server-side, so no `<meta>` tags appear in the HTML.

---

## Option A: Enable SSR with `+page.server.ts`

**How it works:** Change `ssr = false` to `ssr = true` for `/sequence` and `/q` layouts. SvelteKit renders the full component server-side, including `<svelte:head>` with OG tags. The existing `+page.server.ts` files already provide the metadata. The component already consumes it via `data.meta`.

**Why it won't work without changes:** The `+page.svelte` components import browser-only modules (`onMount`, `$app/navigation`, Three.js lazy imports, Web Workers, `crypto.subtle`, etc.). With `ssr = true`, SvelteKit would try to render the full component tree server-side and hit import errors for browser APIs.

**Required changes to make it work:**
1. Guard every browser-only import behind `if (browser)` or dynamic `import()` inside `onMount`.
2. Move the heavy rendering logic (animation engine, 3D, video workers) into lazy-loaded child components.
3. Ensure all `$derived` expressions that reference browser globals short-circuit during SSR.

**Estimated scope:** Both components are 900+ lines with deep dependency trees. Auditing every import and `$derived` expression for SSR safety is a multi-day effort with regression risk across the entire viewer pipeline.

**Verdict:** Too invasive. The goal is OG tags in the initial HTML, not full server-side rendering of a 900-line interactive component.

## Option B: Cloudflare Worker Bot Detection

**How it works:** A Cloudflare Worker sits in front of the SvelteKit app. When it detects a bot user-agent (Facebookbot, Twitterbot, Slackbot, etc.), it intercepts the request and returns a minimal HTML page with just `<meta>` tags. Human users pass through to the normal SPA.

**Why it's wrong for this setup:** The SvelteKit app already runs on Cloudflare Pages Functions. Adding a separate Worker in front creates a routing conflict (Pages Functions vs. standalone Worker on the same domain). It also duplicates the metadata-fetching logic that already exists in `+page.server.ts`.

**Verdict:** Architecturally redundant. The right answer is within SvelteKit, not outside it.

## Option C (Recommended): SSR-Only Layout with Thin Server Component

**How it works:** Create a parallel layout group that enables SSR for just the meta tags, without requiring the full component tree to be SSR-safe. SvelteKit supports this via `+layout.server.ts` combined with a thin `+page.svelte` that handles `<svelte:head>` server-side and defers the full UI to a client-only child.

The actual mechanism:

1. **Set `ssr = true`** in the `/sequence` and `/q` layout files.
2. **Keep the existing `+page.server.ts` files** (they already work and provide the metadata).
3. **Split the `+page.svelte` into two layers:**
   - A thin outer `+page.svelte` that only renders `<svelte:head>` with OG tags from `data.meta`, plus a client-only wrapper.
   - The full interactive viewer in a component that only mounts client-side via `{#if browser}`.

This is the standard SvelteKit pattern for SSR meta tags on client-heavy pages. The server renders just the `<head>` tags and a loading skeleton. The client hydrates and mounts the full interactive UI.

### Why this is the right choice

1. **No new infrastructure.** Uses existing `+page.server.ts` files, existing Firestore access, existing adapter.
2. **Minimal diff.** The `<svelte:head>` block already exists and already reads from `data.meta`. The only change is ensuring the component is SSR-safe at the top level.
3. **No routing conflicts.** Stays within SvelteKit's rendering pipeline.
4. **Works for all bots.** Server-rendered HTML = works for every crawler, not just ones matching a user-agent list.
5. **Progressive enhancement.** Human users see the same loading → interactive flow they see today.

---

## Implementation Plan

### 1. Fix `og-image.png` (5 min)

The landing page and sitemap reference `https://tkaflowarts.com/branding/og-image.png`. The file at `static/branding/og-image.html` is an HTML template for generating the OG image, not the image itself.

**Action:** Render the HTML template to a 1200x630 PNG and save it as `static/branding/og-image.png`. Delete or rename `og-image.html` to `og-image-template.html` to prevent confusion.

Alternatively, capture a screenshot of the template at 1200x630 and save as PNG. The template already has the correct dimensions hardcoded in its CSS (`width: 1200px; height: 630px`).

### 2. Enable SSR on `/sequence/[id]` (core fix)

**File: `src/routes/sequence/+layout.ts`**

```ts
// SSR enabled so crawlers receive OG meta tags in the initial HTML.
// The +page.svelte uses {#if browser} to defer interactive UI to client.
export const ssr = true;
export const prerender = false;
```

**File: `src/routes/sequence/[id]/+page.svelte`**

Restructure the component into two layers:

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/stores";

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
  const sequenceId = $derived($page.params.id);

  // OG meta values from server data (available during SSR)
  const ogWord = $derived(data?.meta?.word || "Sequence");
  const ogCreator = $derived(data?.meta?.creator || null);
  const ogDesc = $derived(
    ogCreator
      ? `Flow sequence by ${ogCreator}${data?.meta?.stepCount ? ` • ${data.meta.stepCount} beats` : ""}${data?.meta?.difficulty ? ` • Level ${data.meta.difficulty}` : ""}`
      : "View this flow sequence in TKA Composer"
  );
  const ogImage = $derived(data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png");
  const ogUrl = $derived(`https://tkaflowarts.com/sequence/${sequenceId}`);
</script>

<svelte:head>
  <title>{ogWord} - TKA Composer</title>
  <meta name="description" content={ogDesc} />
  <link rel="canonical" href={ogUrl} />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{ogWord} - TKA Composer" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:width" content="960" />
  <meta property="og:image:height" content="540" />
  <meta property="og:url" content={ogUrl} />
  <meta property="og:site_name" content="TKA - The Kinetic Alphabet" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{ogWord} - TKA Composer" />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />

  <!-- JSON-LD -->
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": "${ogWord}",
    "description": "${ogDesc}",
    "url": "${ogUrl}",
    "image": "${ogImage}",
    "isPartOf": {
      "@type": "WebApplication",
      "name": "TKA Composer",
      "url": "https://tkaflowarts.com/"
    }${ogCreator ? `,
    "author": {
      "@type": "Person",
      "name": "${ogCreator}"
    }` : ""}
  }
  </script>`}
</svelte:head>

{#if browser}
  <!-- Full interactive viewer only loads client-side -->
  {#await import("./SequenceViewerPage.svelte") then mod}
    <mod.default {data} />
  {/await}
{:else}
  <!-- SSR placeholder: loading skeleton for bots and initial paint -->
  <div class="sequence-route-page">
    <div class="loading-container">
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:rgba(255,255,255,0.5);">
        Loading sequence...
      </div>
    </div>
  </div>
{/if}

<style>
  .sequence-route-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    background: var(--theme-panel-bg, #0a0a14);
  }

  .loading-container {
    flex: 1;
  }
</style>
```

**New file: `src/routes/sequence/[id]/SequenceViewerPage.svelte`**

Move the entire current `+page.svelte` content (minus the `<svelte:head>` block and Props interface) into this new component. This component never runs during SSR -- it's only dynamically imported when `browser` is true.

The component receives `data` as a prop and contains all the browser-only logic: `onMount`, `goto`, `replaceState`, Web Workers, animation engine, 3D renderer, etc.

### 3. Enable SSR on `/q/[code]` (same pattern)

**File: `src/routes/q/+layout.ts`**

```ts
// SSR enabled so crawlers receive OG meta tags in the initial HTML.
export const ssr = true;
export const prerender = false;
```

**File: `src/routes/q/[code]/+page.svelte`**

Same split pattern: thin `+page.svelte` with `<svelte:head>` + `{#if browser}` dynamic import of `QRVideoPage.svelte`.

```svelte
<script lang="ts">
  import { browser } from "$app/environment";
  import { page } from "$app/stores";

  interface Props {
    data: {
      geo: { country: string | null; city: string | null };
      meta: {
        word: string | null;
        creator: string | null;
        thumbnailUrl: string | null;
      };
    };
  }

  const { data }: Props = $props();

  const ogWord = $derived(data?.meta?.word || "Sequence");
  const ogDesc = $derived(
    ogWord !== "Sequence"
      ? `Watch the ${ogWord} flow sequence`
      : "Watch this flow sequence"
  );
  const ogImage = $derived(data?.meta?.thumbnailUrl || "https://tkaflowarts.com/og-default.png");
  const ogUrl = $derived(`https://tkaflowarts.com/q/${$page.params.code}`);
</script>

<svelte:head>
  <title>{ogWord} - TKA</title>
  <meta name="description" content={ogDesc} />
  <link rel="canonical" href={ogUrl} />

  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="{ogWord} - TKA" />
  <meta property="og:description" content={ogDesc} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:url" content={ogUrl} />
  <meta property="og:site_name" content="TKA - The Kinetic Alphabet" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{ogWord} - TKA" />
  <meta name="twitter:description" content={ogDesc} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="theme-color" content="#0f0f1a" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": "${ogWord}",
    "description": "${ogDesc}",
    "thumbnailUrl": "${ogImage}",
    "url": "${ogUrl}",
    "isPartOf": {
      "@type": "WebApplication",
      "name": "TKA Composer",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}
</svelte:head>

{#if browser}
  {#await import("./QRVideoPage.svelte") then mod}
    <mod.default {data} />
  {/await}
{:else}
  <div style="display:flex;align-items:center;justify-content:center;height:100dvh;background:#0f0f1a;color:rgba(255,255,255,0.5);">
    Loading sequence...
  </div>
{/if}
```

**New file: `src/routes/q/[code]/QRVideoPage.svelte`**

Move the current full `+page.svelte` body here, same as the sequence route.

### 4. Improve `/sequence/[id]/+page.server.ts` thumbnail URL

The current server load constructs a thumbnail URL from Firebase Storage:

```ts
const thumbnailUrl = word
  ? `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(word)}-${propType}.png?alt=media`
  : null;
```

This is a good approach. Two improvements:

1. **Add `og:image:width` and `og:image:height`** to help crawlers allocate space before downloading. TKA thumbnails are 960x540.
2. **Fallback to `og-default.png`** if `word` is null (already handled in the component, but should also be set server-side so the meta tag never has `content="null"`).

### 5. `/q/[code]/+page.server.ts` -- enrich with thumbnail URL fallback

The Firestore shortcode document may not have a `thumbnailUrl` field. If it has a `word`, construct the Firebase Storage thumbnail URL as a fallback (same pattern as the sequence route):

```ts
if (!meta.thumbnailUrl && meta.word) {
  meta.thumbnailUrl = `https://firebasestorage.googleapis.com/v0/b/the-kinetic-alphabet.appspot.com/o/thumbnails%2F${encodeURIComponent(meta.word)}-staff.png?alt=media`;
}
```

### 6. Fix `og-image.png` (static asset)

Generate a real PNG from `static/branding/og-image.html` and save as `static/branding/og-image.png`.

Quick approach: open the HTML in Chrome at 1200x630 viewport and screenshot, or use a headless capture. The HTML template already has correct dimensions. Save the result and verify `Content-Type: image/png` when served.

### 7. Update sitemap

Replace `static/sitemap.xml` with current routes and dates. Missing pages:

| URL | Priority |
|---|---|
| `/guide/level-1` | 0.7 |
| `/guide/level-1/letters` | 0.7 |
| `/guide/level-1/positions-motions` | 0.7 |
| `/guide/level-1/words` | 0.7 |
| `/guide/level-2` | 0.7 |
| `/guide/level-2/turns` | 0.7 |
| `/guide/level-2/double-turns` | 0.7 |
| `/store` | 0.6 |
| `/browse/gallery` | 0.8 |
| `/roots` | 0.4 |
| `/delete-account` | 0.2 |

Update all `<lastmod>` values to `2026-05-23`.

Fix the `og-image.png` reference in the sitemap's `<image:loc>` to point to the actual PNG.

### 8. Add `<link rel="canonical">` to remaining pages

Pages missing canonical URLs: `/sequence/[id]`, `/q/[code]`, `/guide/*`, `/store`, `/privacy`, `/terms`, `/roots`, `/browse/gallery`.

The sequence and QR pages get canonical links as part of the SSR fix (shown above). The remaining public pages need a one-line addition to their `<svelte:head>` blocks.

---

## Risks and Mitigations

### `firebase-admin` cold start on Cloudflare Workers

The `/q/[code]` server load imports `firebase-admin` dynamically. With `ssr = true`, this runs on every page request (not just data fetches). `firebase-admin` is a large package; cold starts on Cloudflare Workers may add 200-500ms latency.

**Mitigation:** The `+page.server.ts` already wraps the Firestore call in a try/catch with silent fallback. If it's slow, the page still loads -- the OG tags just fall back to defaults. For crawlers, latency doesn't matter (they're not interactive users). For human visitors, the dynamic import of the heavy component takes longer than the server load anyway.

### Sequence URL decoding server-side

The `/sequence/[id]/+page.server.ts` calls `decodeSequenceWithCompression()`. This function uses `decompressFromURL()` which is likely `lz-string`. Verify this function has no browser dependencies (no `document`, `window`, `localStorage`). From the code review, it appears to be pure computation -- should work fine in Workers.

**Already validated:** The existing `+page.server.ts` files import and call these functions today. They run server-side even with `ssr = false` (SvelteKit still executes server load functions for data serialization). If they worked before, they'll work with SSR enabled.

### Component import tree during SSR

The `{#if browser}` guard prevents the heavy component from being imported during SSR. However, SvelteKit's module analysis might still try to resolve the dynamic import path at build time. The `{#await import(...)}` pattern is the standard SvelteKit approach for client-only dynamic imports and should work correctly.

**Mitigation:** If build issues arise, the fallback is to use `onMount` + reactive state to control rendering:

```svelte
<script>
  import { onMount } from "svelte";
  let mounted = $state(false);
  onMount(() => { mounted = true; });
</script>

{#if mounted}
  {#await import("./SequenceViewerPage.svelte") then mod}
    <mod.default {data} />
  {/await}
{/if}
```

---

## Files Changed (Summary)

| File | Change |
|---|---|
| `src/routes/sequence/+layout.ts` | `ssr = false` → `ssr = true` |
| `src/routes/sequence/[id]/+page.svelte` | Split: thin SSR shell + `{#if browser}` dynamic import |
| `src/routes/sequence/[id]/SequenceViewerPage.svelte` | **New.** Contains current full viewer logic. |
| `src/routes/sequence/[id]/+page.server.ts` | Add thumbnail fallback for null word |
| `src/routes/q/+layout.ts` | `ssr = false` → `ssr = true` |
| `src/routes/q/[code]/+page.svelte` | Split: thin SSR shell + `{#if browser}` dynamic import |
| `src/routes/q/[code]/QRVideoPage.svelte` | **New.** Contains current full QR video logic. |
| `src/routes/q/[code]/+page.server.ts` | Add thumbnail URL fallback from word |
| `static/branding/og-image.png` | **New.** Rendered from og-image.html template. |
| `static/branding/og-image.html` | Rename to `og-image-template.html` |
| `static/sitemap.xml` | Update dates, add missing pages |
| Various `(public)` pages | Add `<link rel="canonical">` |

---

## Verification Plan

1. **Build check:** `npm run build` passes with no SSR errors.
2. **Crawl simulation:** `curl -s https://tkaflowarts.com/sequence/{test-id} | grep 'og:title'` returns the sequence word.
3. **Facebook debugger:** https://developers.facebook.com/tools/debug/ -- paste a sequence URL, confirm preview card shows title + thumbnail.
4. **Twitter card validator:** https://cards-dev.twitter.com/validator -- paste a sequence URL, confirm preview renders.
5. **Discord paste test:** Paste a `/q/{code}` link in a Discord channel, confirm rich embed appears with thumbnail.
6. **og-image.png content-type:** `curl -sI https://tkaflowarts.com/branding/og-image.png | grep content-type` returns `image/png`.
7. **Lighthouse SEO audit:** Run on `/`, `/sequence/{id}`, `/q/{code}`. Confirm no missing meta warnings.
