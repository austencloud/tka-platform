# Card-Scan Attribution Pipeline

**Date:** 2026-05-25
**Status:** Approved
**Replaces:** `src/lib/shared/attribution/` (deferred prompt system — removed)

## Purpose

Trace the full funnel: QR card scan → card viewer → "Open TKA" → signup. Answer: which cards drive signups, which decks perform best, where are people scanning.

## Architecture

PostHog-native funnel. No custom dashboard or Firestore funnel logic. PostHog handles anonymous→identified user merging automatically via `distinct_id`.

## Funnel Events

| Step | Event | Key Properties |
|------|-------|----------------|
| 1. Scan | `card_scanned` | `short_code`, `sequence_word`, `deck_id?`, `deck_name?`, `country`, `city` |
| 2. App open | `scan_app_opened` | `short_code`, `sequence_word`, `deck_id?`, `deck_name?` |
| 3. Signup | `user_signed_up` | `scan_source_code?`, `scan_source_deck?` |

Event 1 fires on `/q/{code}` page load (replaces current `qr_video_scanned` event name).
Event 2 fires when app detects `?from=scan&code={code}` params on entry.
Event 3 already exists — just needs enrichment with scan context if present.

## Data Flow

```
[Physical Card] → QR scan → /q/{code}
                              │
                              ├── page.server.ts loads shortcode doc (has deckId, deckName, word)
                              ├── Cloudflare headers provide country/city
                              ├── PostHog fires "card_scanned" with all metadata
                              │
                              └── User clicks "Open TKA"
                                    │
                                    └── /browse/gallery?from=scan&code={shortCode}
                                          │
                                          ├── MainApplication detects params
                                          ├── Stores scanSourceCode in sessionStorage
                                          ├── PostHog fires "scan_app_opened"
                                          ├── Strips params from URL (clean UX)
                                          │
                                          └── User signs up (minutes/days later)
                                                │
                                                ├── posthog.identify() merges sessions
                                                └── signup event enriched with scan_source_*
```

## Schema Changes

### Shortcode Firestore doc — new optional fields

```ts
interface ShortCodeDoc {
  // ... existing fields ...
  deckId?: string;    // e.g. "loop-type-1"
  deckName?: string;  // e.g. "LOOP Type 1"
}
```

Nullable. Most sequences aren't in decks — that's fine. Deck composition stamps these at short code creation time.

### ShortCodeManager.createShortCode options

```ts
interface ShortCodeURLOptions {
  // ... existing fields ...
  deckId?: string;
  deckName?: string;
}
```

### Session state for scan context

```ts
// sessionStorage keys
const SCAN_SOURCE_CODE = "tka_scan_source_code";
const SCAN_SOURCE_DECK = "tka_scan_source_deck";
```

Using sessionStorage (not localStorage) so it expires with the browser tab. If user doesn't sign up this session, the attribution window closes — that's correct behavior for this type of attribution.

## Code Changes

### 1. Remove old attribution system

Delete entirely:
- `src/lib/shared/attribution/` (all files)
- `src/lib/features/lab/tabs/AttributionLab.svelte`
- `src/lib/features/admin/components/analytics/AttributionDashboard.svelte`
- Attribution tab entry from admin ADMIN_TABS in tab-definitions.ts
- Already-commented imports/triggers in MainApplication.svelte

### 2. ShortCodeManager — accept deck metadata

In `createShortCodeInternal()`, persist `deckId` and `deckName` from options onto the Firestore doc when provided.

### 3. Deck composer — pass deck info

Where deck composition creates short codes for printed cards, pass `{ deckId, deckName }` in options.

### 4. `/q/[code]/+page.server.ts` — load deck fields

Already loads the shortcode doc. Add `deckId`, `deckName` to the returned data.

### 5. `/q/[code]/+page.svelte` — enriched event + CTA link

- Rename event from `qr_video_scanned` to `card_scanned`
- Add `deck_id`, `deck_name`, `city` properties
- Change CTA href from `/browse/gallery` to `/browse/gallery?from=scan&code={shortCode}`

### 6. App entry scan detection

In MainApplication init (where attribution triggers used to live):
- Check URL for `?from=scan&code={code}`
- If present: fire `scan_app_opened` PostHog event, store code in sessionStorage, strip params from URL via `replaceState`

### 7. Signup event enrichment

In the auth signup flow, check sessionStorage for scan source. If present, include `scan_source_code` and `scan_source_deck` on the `user_signed_up` PostHog event.

## PostHog Funnel Configuration

After deployment, create funnel in PostHog:
1. `card_scanned` → `scan_app_opened` → `user_signed_up`
2. Breakdown by: `deck_id`, `country`, `short_code`
3. Conversion window: 7 days (configurable)

## What This Doesn't Cover

- Multi-touch attribution (user scans 3 cards before signing up — first-touch wins via sessionStorage)
- Offline scan tracking (no internet = no PostHog event, but Firestore scanEvents still logs on next page load)
- Print-run identification (which physical batch a card came from) — future enhancement via printId field

## Success Criteria

- PostHog shows `card_scanned` events with deck metadata
- Funnel from scan → app open shows real conversion rate
- At least one signup can be traced back to a specific card/deck
