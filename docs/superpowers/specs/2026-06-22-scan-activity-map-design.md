# Scan Activity → Map-First Redesign

**Date:** 2026-06-22
**Module:** Choreo Cards › Scan Activity tab
**Status:** Approved design, pre-implementation

## Problem

The Scan Activity tab is busy and misleading:

- Top-right shows a cryptic dual counter (`{codes} codes · {recent} recent`) that reads like made-up numbers.
- A red "Failed to load: Missing or insufficient permissions" appears ("restriction failed") — the live map subscribes to the `scanEvents` collectionGroup, which is `isAdmin()`-only (firestore.rules:955-958). The query fires before the admin claim resolves, surfacing the error.
- The "map" is a 3D globe (`ScanActivityGlobe`) that places dots at **country centroids + random jitter** (`ScanActivityTab.globePoints` → `country-centroids` + `hashJitter`). Positions are fabricated; it can never show where a scan actually happened.

Austen's ask: a 2D map showing where scans have actually occurred — "has anybody ever scanned a card anywhere, literally outside, near me in Chicago."

## Ground Truth (verified against prod Firestore + code)

- **Scan write path:** `/q/[code]/+page.server.ts` reads Cloudflare headers `cf-ipcountry`, `cf-ipcity`, `cf-iplatitude`, `cf-iplongitude` and passes them to `shortCodeManager.logScanEvent` (admin-only `scanEvents`) and `logJourneyPoint` (public `journeyPoints`). The other loggers (`/sequence/[id]`, `SequenceViewerDrawerHost`) pass `country: null` and no coords — viewer-open events, not real scans.
- **Data reality:** 8 codes have `scanCount > 0` (3 scanned 2026-06-22). Sampled `scanEvents` carry `city: null`, `country` sometimes `"US"`, **no `lat`/`lng` field at all**. `journeyPoints` empty. Parent docs have null `lastCity`/`lastCountry`. Cause: **Cloudflare only emits `cf-ipcountry` by default**; `cf-iplatitude/longitude/city` require the "Add visitor location headers" Managed Transform, which is off. Most logged scans are also dev/localhost (no Cloudflare in front).
- **Reusable primitive:** `src/lib/features/community/components/GlobalUserMap.svelte` is a real 2D Google Map (pan/zoom) and **already has a `scanMarkers` prop** (`{id, lat, lng, label, styleClass}`) documented as "injected by the ChoreoCard Scan Activity view." The intended design existed; the tab regressed to the fake globe.
- **API key:** `env.PUBLIC_GOOGLE_MAPS_API_KEY` via `$env/dynamic/public` (Community guards on it being set / not the placeholder).
- **Recent-list primitive:** `RecentScansList.svelte` (props `events`, `onRowClick`, `limit`) already renders compact scan rows.

## Decisions (approved)

1. **Coordinate source:** enable Cloudflare visitor-location headers (one dashboard toggle by Austen). Real **city-level** coords on future prod `/q` scans. IP geo is city/metro accuracy — not street/house level; that ceiling is accepted. No backfill for past coordless scans.
2. **View scope:** map-dominant + a compact recent list; clicking a recent row flies the map to that pin.
3. **Plot source:** admin `scanEvents` (already wired, carries coords going forward). The tab is admin-only, so admin-only data is fine. Do **not** add a public `journeyPoints` collectionGroup path.
4. **Keep** the admin mine/all scope toggle.

## Architecture

### A. Data layer — `state/scan-activity-state.svelte.ts`

- Extend `ScanEventRow` with `lat: number | null` and `lng: number | null`; read `data.lat` / `data.lng` (coerce to finite number or null) in the `scanEvents` snapshot handler.
- **Admin-gate the subscription** to remove the permission error: do not start the `collectionGroup(scanEvents)` `onSnapshot` until auth is resolved AND the user is admin. When not admin / not ready, leave `recentEvents` empty and set a benign state (no `error`). Only set `error` for genuine post-authorization failures. The `shortcodes` query (public read) may still run for counts.
- Add derived `mapPins`: events with finite `lat` & `lng`, mapped to `GlobalUserMap`'s `scanMarkers` shape (`id = code+timestamp`, `label = "{word|code} · {city ?? country ?? ''}"`, newest → `styleClass: "pin-new"`, rest `"pin"`). Cap to a sane recent count (e.g. 200).
- Add derived counts: `locatedCount` (= mapPins length) and total scan count for the honest header counter.

### B. View — `ScanActivityTab.svelte` (rewrite)

- Full-bleed `GlobalUserMap` with `apiKey={env.PUBLIC_GOOGLE_MAPS_API_KEY}`, `locations={[]}`, `scanMarkers={mapPins}`, `userLocation={center}`, `size="full"`, `onScanMarkerClick={...}`.
- **Center logic:** newest located pin → else `null` (GlobalUserMap defaults to world view). Clicking a `RecentScansList` row sets `center` to that pin's coords → GlobalUserMap's existing `userLocation` effect pans + zooms to city level.
- **Recent list:** reuse `RecentScansList`, docked as an overlay panel (corner) or side column. Row click = locate (fly-to). Keep an affordance to open the card (`/q/{code}`) too — secondary action.
- **Header:** live dot + single honest counter `"{total} scans · {located} located"`. Keep admin mine/all scope radiogroup. Remove the grid, search, top-locations.
- **States:**
  - API key missing/placeholder → reuse Community's warning block pattern.
  - Loading → thin neutral loader (per `feedback_skeletons_must_match_layout`).
  - Admin-ready but zero located pins → empty state: "No located scans yet. Pins appear once a card is scanned in the wild and Cloudflare location headers are on." Show coordless-scan count if any.
- Remove imports/usage of `ScanActivityGlobe`, `TopLocationsBlock`, `country-centroids`, `hashJitter`, `globePoints`.

### C. Shared primitive extension — `GlobalUserMap.svelte`

- Add optional prop `onScanMarkerClick?: (id: string) => void`. In the `scanMarkers` `$effect`, attach a `gmp-click` listener per scan marker that calls it. No change to existing community-marker behavior. (Extending the shared primitive, not forking — per `never-hand-roll` / `chip-primitives` precedent.)

### D. Cleanup (verify-then-delete)

- Delete `ScanActivityGlobe.svelte` (only importer is ScanActivityTab).
- Delete `TopLocationsBlock.svelte` (only importer is ScanActivityTab).
- Delete `ScanHistoryDrawer.svelte` (already orphaned — no importer).
- **Keep** `country-centroids.ts` (used by `qr/journey/journey-loader.ts` + a test) and the `globe.gl` dependency (used by the QR journey reveal: `journey-stats.ts`, vite.config, hooks.client). Do not remove either.

### E. External (Austen, out of code scope, required for real data)

Cloudflare dashboard → the zone for `tka.run` (and any scan-serving domain) → **Rules › Settings › Managed Transforms** → enable **Add visitor location headers**. This emits `cf-iplatitude`, `cf-iplongitude`, `cf-ipcity`. Free on all plans. Until on, only `cf-ipcountry` arrives and pins won't populate.

## Data Flow

```
card scanned (prod /q) → +page.server.ts reads cf-ip* headers → geo {country,city,lat,lng}
  → logScanEvent(scanEvents: {..., lat, lng})   [admin-only]
ScanActivityState.subscribe (admin-gated) → collectionGroup(scanEvents) snapshot
  → recentEvents[] (now with lat/lng) → mapPins (finite coords only)
ScanActivityTab → GlobalUserMap scanMarkers + RecentScansList
  → row click → center → map flies to pin; pin click → label / open card
```

## Error Handling

- Pre-admin / unauth: silent empty state, never a red permission error.
- Genuine snapshot error after authorization: show `error` text (existing pattern).
- Missing API key: warning block, no map mount.
- Coordless events: excluded from `mapPins`, surfaced as a count, never plotted at a fake position.

## Testing

- Unit (state): a `scanEvents` doc with finite `lat`/`lng` → appears in `mapPins`; null/absent coords → excluded but counted; newest → `pin-new`. Admin-gate: non-admin/unready → no subscription, no `error`, empty `recentEvents`.
- Manual (admin, prod or with CF headers): scan a card in the wild → pin appears at city; click recent row → map flies; pin click → label/open. Verify no "restriction failed" on load as non-admin and as admin.

## Out of Scope / YAGNI

- Marker clustering (add later if pin volume warrants).
- Backfilling coords onto historical scans.
- Public (non-admin) scan map / `journeyPoints` collectionGroup.
- Heatmaps, time-scrubbing, per-card journey arcs (the journey-reveal feature already owns arcs).
