# QR Scan Analytics

**Date:** 2026-03-25
**Status:** Approved
**Feedback:** 9Qyn4d7U7IY9q6yxao3L

## Purpose

Track comprehensive analytics when people scan choreo card QR codes. Understand geographic spread, sequence popularity, engagement patterns, and which physical cards generate the most interest.

## Architecture

Two parallel tracking systems, each doing what it's best at:

1. **PostHog** — behavioral analytics (funnels, retention, session replay, dashboards). Fire a `qr_code_scanned` event with scan metadata. PostHog handles IP geolocation automatically.
2. **Firestore `scanEvents` subcollection** — per-scan records under each shortcode for card-specific queries (e.g., "show me all scans of this specific card"). Lightweight append-only log.

## What Gets Tracked Per Scan

All data gathered without explicit permission (no prompts, no consent dialogs):

| Field | Source | Notes |
|-------|--------|-------|
| `timestamp` | `new Date()` | When the scan happened |
| `shortCode` | URL path | The shortcode that was scanned |
| `printId` | URL query `?pid=xxx` | Which specific physical card (optional) |
| `sequenceWord` | Resolved sequence | The sequence on the card |
| `sequenceId` | Resolved sequence | Unique sequence identifier |
| `country` | Cloudflare `CF-IPCountry` header | 2-letter country code |
| `city` | Cloudflare `CF-IPCity` header | City name (if available) |
| `userAgent` | `navigator.userAgent` | Device, browser, OS |
| `screenWidth` | `window.screen.width` | Screen dimensions |
| `screenHeight` | `window.screen.height` | Screen dimensions |
| `viewportWidth` | `window.innerWidth` | Browser viewport |
| `viewportHeight` | `window.innerHeight` | Browser viewport |
| `referrer` | `document.referrer` | Where they came from |
| `userId` | Auth state (if logged in) | Optional — only if authenticated |

## Implementation

### 1. Server-side: Capture Cloudflare headers

Add `src/routes/p/[code]/+page.server.ts` to extract geo data from Cloudflare headers and pass to the client via the page's `data` prop.

```typescript
export function load({ request, params }) {
  return {
    code: params.code,
    geo: {
      country: request.headers.get("cf-ipcountry") || null,
      city: request.headers.get("cf-ipcity") || null,
    },
  };
}
```

**Important:** The existing `+page.ts` has `export const ssr = false`. The server load function runs regardless of SSR setting — SvelteKit always runs `+page.server.ts` on the server and passes `data` to the client. But `+page.ts` load functions run client-side when `ssr = false`. So we need the geo capture in `+page.server.ts` specifically.

### 2. Client-side: Fire analytics on scan

In `src/routes/p/[code]/+page.svelte`, after successful sequence resolution:

```typescript
// Capture scan analytics (fire-and-forget, never blocks the viewer)
captureQRScanEvent({
  shortCode,
  printId: url.searchParams.get("pid"),
  sequenceWord: sequence.word,
  sequenceId: sequence.id,
  geo: data.geo,
});
```

### 3. PostHog event

Fire `qr_code_scanned` with all scan properties. PostHog adds IP geolocation automatically (redundant with Cloudflare but provides a second source).

```typescript
captureEvent("qr_code_scanned", {
  short_code: shortCode,
  print_id: printId,
  sequence_word: sequenceWord,
  sequence_id: sequenceId,
  country: geo?.country,
  city: geo?.city,
  screen_width: window.screen.width,
  screen_height: window.screen.height,
  viewport_width: window.innerWidth,
  viewport_height: window.innerHeight,
  referrer: document.referrer || null,
  is_deck_sequence: !sequence.ownerId,
});
```

### 4. Firestore scan event log

Append a document to `shortcodes/{code}/scanEvents/{auto-id}`:

```typescript
{
  timestamp: serverTimestamp(),
  printId: string | null,
  country: string | null,
  city: string | null,
  userAgent: string,
  screenWidth: number,
  screenHeight: number,
  referrer: string | null,
  userId: string | null,  // If authenticated
}
```

### 5. Print ID support

When printing cards, append a unique print ID to the QR URL:
- URL format: `/p/ABC123?pid=card-0001`
- The `pid` param is logged but doesn't affect resolution
- This allows tracking individual physical cards

The print ID generation happens at print time (in the card export flow). Each printed card gets a sequential or random ID.

## Firestore Rules

Add read/write rules for the `scanEvents` subcollection:

```
match /shortcodes/{code}/scanEvents/{eventId} {
  allow read: if isAdmin();
  allow create: if true;  // Anyone can log a scan (no auth required)
  allow update, delete: if false;  // Append-only log
}
```

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/routes/p/[code]/+page.server.ts` | Create | Capture Cloudflare geo headers |
| `src/routes/p/[code]/+page.svelte` | Modify | Fire PostHog + Firestore scan events |
| `src/lib/shared/qr/services/implementations/ShortCodeManager.ts` | Modify | Add `logScanEvent()` method |
| `src/lib/shared/qr/services/contracts/IShortCodeManager.ts` | Modify | Add interface for `logScanEvent()` |
| `firestore.rules` | Modify | Add scanEvents subcollection rules |

## What This Does NOT Include

- GPS/precise location (requires browser permission prompt)
- Push notifications (requires opt-in)
- Cross-device tracking (no cookies or fingerprinting)
- Print ID generation in the export flow (separate task — cards print without PIDs for now, PIDs can be added later)

## Query Examples

Once data is collected, these become possible:

```
// Most scanned sequences
SELECT sequence_word, COUNT(*) FROM qr_scans GROUP BY sequence_word ORDER BY count DESC

// Geographic spread
SELECT country, COUNT(*) FROM qr_scans GROUP BY country

// Which physical cards get rescanned
SELECT print_id, COUNT(*) FROM qr_scans WHERE print_id IS NOT NULL GROUP BY print_id HAVING count > 1

// Scan frequency over time
SELECT DATE(timestamp), COUNT(*) FROM qr_scans GROUP BY DATE(timestamp)
```

These queries run in PostHog's dashboard (SQL-like) or via Firestore queries for card-specific data.
