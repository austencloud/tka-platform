# QR Card Journey Map — Design Spec

> **STATUS UPDATE (2026-06-22, post-implementation):** The scan-flow **interstitial
> reveal was DROPPED** after Austen reviewed it live — it interrupted the scan
> payoff (the animation must play instantly, nothing in front of it) and the full
> globe was over-engineered for now. The cheap data layer was KEPT (lat/lng
> capture, `logJourneyPoint` public `journeyPoints` projection, rules/index,
> `journey-stats`/`journey-loader` pure modules) so card travel history accumulates.
> When resurfaced, the journey will be a **non-blocking** surface reusing the
> existing **`GlobalUserMap`** (zoomable Google Maps, already accepts `scanMarkers`),
> NOT the globe.gl globe and NOT in the scan flow. Sections below describe the
> abandoned interstitial approach — read with that caveat.

**Date:** 2026-06-22
**Status:** Interstitial approach abandoned; data layer shipped. See status note above.
**Origin:** Feedback items `Fd5LhGdH` (journey map) + `9Qyn4d7U` (scan capture). Verified ~70% built; this is a focused gap-spec, not from-scratch.

---

## Goal

Turn a scanned physical Choreo Card into a viral collectible. When a stranger scans a card, before the sequence plays they see the card's travel story: a 3D globe with animated arcs tracing where the card has been, plus a headline distance ("Seen in 14 cities · 3 countries · 8,400 km traveled"). The reveal is the payoff for scanning, then it gets out of the way and the sequence plays.

## Audience & surface (locked)

**Scanner-facing**, on the `q/[code]` landing page. Not the creator analytics tab. The viral hook lives or dies on the emotional payoff at the moment a stranger scans the card — so the journey surfaces there, once, then yields to the content.

## What's already built (verified)

| Capability | Location | State |
|---|---|---|
| Per-scan event capture (`printId`, `city`, `country`, `timestamp`, `deviceId`, `userId`, `userAgent`, screen) | `short-code-manager.ts:736-760` `logScanEvent` → `shortcodes/{code}/scanEvents` | ✅ Full |
| Real geo on the card-scan path (Cloudflare `cf-ipcountry`/`cf-ipcity`) | `q/[code]/+page.server.ts:4-7` | ✅ country + city, NO lat/lng |
| 3D globe (globe.gl / three.js), points only, auto-rotate, newest pulses | `ScanActivityGlobe.svelte` | ✅ points; ❌ no arcs |
| Country-centroid lookup (country → lat/lng) | `scan-activity/country-centroids.ts` | ✅ coarse fallback |
| `globe.gl ^2.45.3` (native animated arcs via `.arcsData()`) | `package.json:285` | ✅ installed |
| globe.gl already code-split out of `vendor`, lazy-imported | `vite.config.ts:697-706` | ✅ discrete chunk |
| Genuine-scan gating + stable device id | `qr/utils/scan-detection.ts` (`isGenuineScan`), `getDeviceId()` | ✅ |
| `q/[code]` flow: `loading` → `playing` (mounts full viewer in-page, no redirect) | `q/[code]/+page.svelte:529,562-607` | ✅ |

The raw data for a per-card journey already exists. Every scan event carries `printId` and `timestamp`. The journey is a query + a visualization that don't exist yet.

## Gaps to close

1. **Exact pin coordinates.** Server load reads country + city but not lat/lng. Add `cf-iplatitude`/`cf-iplongitude` (same "visitor location headers" Managed Transform that already feeds `cf-ipcity` — one Cloudflare dashboard toggle). Coarse country-centroid fallback for legacy events / transform-off.
2. **Per-printId journey path.** A query (`scanEvents where printId == pid orderBy timestamp asc`) + ordered arc segments. No flat list exists for the scanner.
3. **The reveal surface.** A new interstitial state on `q/[code]` between `loading` and `playing`.
4. **The collectible payload.** Live travel path (arcs) + cumulative distance. (Ordinal / rarity / first-in-city explicitly dropped — YAGNI.)

---

## Architecture

### Data model change

Geo gains exact coordinates, surfaced to two writes: the admin `scanEvents` log (optional `lat`/`lng`, future exact pins) and the new public `journeyPoints` projection (see below). Existing rows without coords resolve to country-centroid at read time. No migration — the read layer tolerates `null`.

**`q/[code]/+page.server.ts`** — extend `geo`:

```ts
const geo = {
  country: request.headers.get("cf-ipcountry") || null,
  city: request.headers.get("cf-ipcity") || null,
  lat: parseFloatOrNull(request.headers.get("cf-iplatitude")),
  lng: parseFloatOrNull(request.headers.get("cf-iplongitude")),
};
```

**`logScanEvent`** (`short-code-manager.ts:736`) — extend the `event` param with `lat`/`lng`, write through. The `q/[code]` call site (`+page.svelte:513-523`) passes `data.geo.lat`/`data.geo.lng`. The two client-only call sites (`sequence/[id]`, `SequenceViewerDrawerHost`) keep passing `null` — they aren't physical-card scans and have no server geo.

### Journey read — public projection, NOT scanEvents

The existing `scanEvents` doc carries `deviceId`, `userAgent`, `referrer`, `screen*` (`short-code-manager.ts:736-760`) and is `allow read: if isAdmin()` (`firestore.rules:937-941`). Making it world-readable to feed the journey would leak scanner fingerprinting data. Instead, write a **separate public projection** that carries only what the reveal needs.

**New subcollection `shortcodes/{code}/journeyPoints/{autoId}`:**

```ts
{ printId: string | null; lat: number | null; lng: number | null;
  city: string | null; country: string | null; timestamp: string; }
```

The scan path writes this in parallel with `scanEvents` (one extra fire-and-forget `addDoc`). `scanEvents` stays admin-only and unchanged.

New read in a focused module (`journey-loader.ts`):

```ts
async loadJourney(code: string, printId: string | null): Promise<JourneyPoint[]>
```

- `printId` present → `query(journeyPoints, where("printId","==",printId), orderBy("timestamp","asc"))`.
- `printId` null (legacy prints with no `?pid`) → all points for the code, ordered by timestamp. The "code-level journey" fallback.
- A pure `rowsToJourneyPoints(rows)` resolves coords (event `lat`/`lng`, else `countryCentroid(country)`), drops points with no resolvable location, and is unit-tested in isolation. The Firestore query is a thin wrapper around it.

**Firestore requirements:**
- New rule block under `shortcodes/{code}`: `match /journeyPoints/{id} { allow create: if true; allow read: if true; allow update, delete: if false; }`. Mirrors the existing `scanEvents` create-only posture but adds public read on the PII-free projection.
- Composite index on `journeyPoints`: `printId ASC, timestamp ASC` (the `printId`-filtered + time-ordered query).

### Journey math — `journey-stats.ts` (new, pure, unit-tested)

```ts
haversineKm(a: LatLng, b: LatLng): number
totalDistanceKm(points: JourneyPoint[]): number   // sum of consecutive great-circle hops
uniqueCities(points): number
uniqueCountries(points): number
toArcs(points): Arc[]   // [{startLat,startLng,endLat,endLng}] for consecutive pairs
```

No Firestore, no DOM — testable in isolation. Haversine validated against known city-pair distances.

### Globe extension — `ScanActivityGlobe.svelte`

Add an optional prop:

```ts
arcs?: { startLat: number; startLng: number; endLat: number; endLng: number }[];
```

Wire to globe.gl's native arc layer:

```ts
globe.arcsData(arcs)
  .arcColor(() => "#34d399")
  .arcDashLength(0.5)
  .arcDashGap(0.5)
  .arcDashAnimateTime(2000)   // the "travel" motion
  .arcStroke(0.6);
```

Points layer unchanged. Backward compatible — `arcs` defaults to `[]`, so the creator tab keeps working untouched. (Free future side-benefit: creator Scan Activity globe can pass arcs later; out of scope here.)

### Interstitial — `ScanJourneyInterstitial.svelte` (new)

- Lives in `routes/q/[code]/` (or a `q`-local component dir — plan decides). Lazy-imports the extended globe so three.js only arrives with the reveal.
- Props: `points: JourneyPoint[]`, `word`, callbacks `onContinue`.
- Renders: globe (points + chronological arcs) + headline line built from `journey-stats` (`Seen in {cities} cities · {countries} countries · {distance} km traveled`), a tap-to-skip affordance, and a ~3–4s auto-advance timer to `onContinue`.
- **Low-data state** (≤1 resolvable point): no globe spin / single pulsing pin + "You're the first to scan this card." Still auto-advances.
- Uses `tabular-nums` on the distance figure and reserves the headline's widest-case width (no-layout-shift rule) so the count-up / final value doesn't reflow.

### Flow on `q/[code]`

New `pageState` variant `{ kind: "journey", word, points }` between `loading` and `playing`.

```
loading
  ├─ resolve sequence (existing)            ┐ in parallel
  └─ loadJourney(code, pid)                 ┘
log this scan (existing, now w/ lat/lng) — optimistically append to points
decide:
  isGenuineScan(code) && points.length >= 2 && !deviceSeenThisCard
    → journey    (interstitial; masks orchestrator chunk load) → playing
  else
    → playing    (skip straight through; repeat visits, single-point cards)
```

`deviceSeenThisCard`: reuse the existing genuine-scan / device-id machinery so a scanner only gets the reveal once per device per card. The interstitial deliberately overlaps the orchestrator's lazy load — the time we'd otherwise spend on a loading spinner becomes the reveal.

---

## Error handling

- Journey query fails / Firestore unreachable → skip interstitial, go straight to `playing`. The reveal is never load-bearing for content. Matches the existing fire-and-forget telemetry posture (`+page.svelte:511-524`).
- No resolvable points → low-data state, then `playing`.
- globe.gl chunk fails to load → skip to `playing` (catch the dynamic import).
- Missing lat/lng on every event + unknown country → point dropped; if all dropped, low-data state.

## Privacy

- Scanner sees city-level pins only — no user identity, no display of timestamps, no precise address.
- The creator's own registration scan can reveal their home city in the path. Acceptable for a card designed to travel and be shared, but documented here so it's a known tradeoff, not a surprise. If it becomes a concern, a future option is to omit the first (creator) point or let the creator opt the card's journey private — not in this scope.

## Testing

- `journey-stats.ts` — unit tests: haversine against known distances, `totalDistanceKm` over multi-hop paths, city/country dedup, `toArcs` pairing (including 0/1-point edge cases).
- Interstitial decision logic — genuine-first-scan gating, low-data fallback, repeat-visit skip. Extract the decision into a pure helper so it's testable without mounting.
- Manual / DevTools verification of the globe reveal on a real `q/[code]` route with seeded multi-city scan events (verification-protocol: screenshot or runtime query before claiming done).

## Out of scope

- Ordinal / rarity / first-in-city mechanics (dropped by product decision).
- Creator-side journey paths in Scan Activity tab (the globe extension enables it; wiring it is separate).
- Geocoding services — Cloudflare headers + country centroids cover it; no third-party geocoder.

## Open items for the plan

1. ~~Public-read on `scanEvents`~~ — **resolved:** use a PII-free public `journeyPoints` projection; `scanEvents` stays admin-only. Composite index on `journeyPoints` (`printId ASC, timestamp ASC`).
2. Cloudflare "visitor location headers" Managed Transform toggle — Austen enables in dashboard (a credential/console action, not code). Centroid fallback ships without it.
3. ~~Where `loadJourney` lives~~ — **resolved:** focused `journey-loader.ts` module, not on `ShortCodeManager`. The scan-path projection write lives on the manager (`logJourneyPoint`).
