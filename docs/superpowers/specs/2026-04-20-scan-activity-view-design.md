# Scan Activity — Design Spec

**Date:** 2026-04-20
**Author:** Austen (via brainstorm session)
**Status:** Draft for review
**Replaces:** `src/lib/features/admin/components/analytics/ShortCodeAnalytics.svelte` and the top-level "Short Codes" admin tab

---

## 1. Goal

Replace the admin-panel "Short Codes" tab with a visual, live **Scan Activity** view that lives inside the ChoreoCard module. Same component serves both roles — the admin scope is a permission toggle on a shared page, not a separate product.

The view is a live, gallery-style feed of Choreo Card scans. When someone scans a QR code, their card bumps to the top of the feed, a pin pulses on the world map, and the event is recorded permanently. Signed-in users see their own cards; admins toggle a scope switch to see everything. No deletion exists.

## 2. Non-goals

- No deletion / cleanup / deletion-candidates concept. Every minted code is permanent. This is a *hard* constraint — the word "delete" must not appear anywhere in the UI or the data model of this view.
- No migration for existing scanEvents documents. Historical events have no `deviceId`; they stay that way. We start tracking forward.
- No cross-session fingerprinting. Only explicit `deviceId` + `userId` linkage. No UA/IP fuzzy matching.
- No public (signed-out) view in this iteration. Architecture allows it later.

## 3. Decisions locked in brainstorm

| Decision | Chosen |
|---|---|
| Home module | ChoreoCard (retire admin Short Codes tab) |
| Admin model | Same component, `isGlobalScope` permission flag |
| Feed unit | **Hybrid**: per-code card + click opens drawer with per-scan history |
| Map | Embedded 280px minimap (same `GlobalUserMap` component) + link to full Community map |
| Card visual | Scaled-down real Choreo Card thumbnail |
| Scan arrival animation | **A — Jump to top** (reinforces the "newest first" sort) |
| Device identity | **B1** — `deviceId` in localStorage, auto-linked to `userId` on sign-in, multi-device preserved |
| Short code length | Keep 6 chars; migration path to 8 if we approach ~300k codes |
| Filter bar | **None** in v1. Search inline, no time/location/device filters |

---

## 4. Navigation placement

Scan Activity is a new `Section` entry in `CHOREO_CARD_TABS` in `src/lib/shared/navigation/config/tab-definitions.ts` (line 556). It slots in as the third item alongside Decks (line 557) and Card Designer (line 565).

```
decks | designer | scan-activity
```

**Section config:**

- `id: "scan-activity"`
- `label: "Scan Activity"`
- `icon: '<i class="fas fa-satellite-dish" aria-hidden="true"></i>'`
- `color: "#10b981"` (emerald, matching the previous admin tab)
- `gradient: "linear-gradient(135deg, #34d399 0%, #10b981 100%)"`

The existing sidebar nav pipeline renders this with zero additional plumbing — ChoreoCardTab.svelte has a `navigationState.activeTab` effect (line 166) that branches on section id. Adding `"scan-activity"` to the union `ChoreoCardMode` at line 162 and adding a `{:else if mode === "scan-activity"}` branch at line 582 is the full integration.

**Retired:**

- `src/lib/shared/navigation/config/tab-definitions.ts` — "short-codes" entry in `ADMIN_TABS` removed
- `src/lib/features/admin/components/analytics/ShortCodeAnalytics.svelte` — file deleted
- `src/lib/features/admin/components/AdminDashboard.svelte` — `activeSection === "short-codes"` branch removed, lazy-loaded ShortCodeAnalytics state variable removed

## 5. Layout

Desktop (≥1400px):

```
┌──────────────────────────────────────────────────────────────────┐
│  [●] Scan Activity  · 147 codes · 12 in last hour   [search][/]   │
│                                            [My cards | All (admin)] │
├─────────────────────────────────────────────────────┬────────────┤
│                                                     │            │
│  [card] [card] [card] [card] [card]                 │  globe     │
│  [card] [card] [card] [card] [card]                 │            │
│  [card] [card] [card] [card] [card]                 │  recents   │
│       (5-col gallery grid)                           │            │
│                                                     │  top locs  │
│                                                     │            │
│                                                     │  → full map│
└─────────────────────────────────────────────────────┴────────────┘
```

Column counts match gallery: **5 at ≥1400px, 4 at ≥1000px, 3 at ≥600px, 2 below**. Minimap column collapses to a "📍 Map" button below ~1100px that opens in a bottom-sheet overlay.

All body text uses `var(--font-size-sm)` (14px) or `var(--font-size-base)` (16px). All interactive elements are ≥`var(--min-touch-target)` (44px) tall. Header is 18px/600.

## 6. The card (ScanActivityCard)

New component: `src/lib/features/choreo-card/components/scan-activity/ScanActivityCard.svelte`.

Composes `ChoreoCardThumbnail.svelte` (the existing gallery primitive at `src/lib/features/browse/sequences/display/components/ChoreoCardThumbnail/ChoreoCardThumbnail.svelte`) inside a wrapper chrome. Pictograph rendering stays inside `ChoreoCardThumbnail`, which uses `PropAwareThumbnail` (CLAUDE.md compliance — no custom SVG rendering).

**Wrapper chrome overlays:**

- Top-right: scan count badge (emerald chip, e.g. "8")
- Top-left (optional): `hot` class when card is the most recently scanned one — adds emerald glow
- Bottom-left: word (14px mono, emerald)
- Bottom-right: code pill + 5-day sparkline (14px height)
- Footer: city + "time ago" (14px)

Cards with failed round-trip integrity check render with `placeholder` style: dashed border, hatched pictograph cells, red scan-count badge showing "!", word reading "restoration failed". The card is still clickable — clicking opens the drawer with raw decoded data for debugging.

**Click → opens drawer** (§7). No hover tooltip. Context menu (long-press / right-click) reuses `ContextMenu.svelte` with standard share/copy/open-in-viewer entries.

## 7. The drawer (ScanHistoryDrawer)

New component: `src/lib/features/choreo-card/components/scan-activity/ScanHistoryDrawer.svelte`.

Uses `src/lib/shared/foundation/ui/Drawer.svelte` with `placement="bottom"` and `snapPoints={[0.5, 0.9]}`. Half-height shows summary; drag-up snaps to 90% for full history.

**Drawer contents (top to bottom):**

1. **Handle + close** (built-in)
2. **Header row** — word, code pill, "total scans" count, "first scanned" date, "last scanned" date
3. **Pictograph strip** — full ChoreoCardThumbnail rendered at hero size, 3× the feed thumbnail
4. **Per-scan timeline** — reverse-chronological list of scan events. Each row: time-ago, city, country flag, deviceId short-form (or userId if linked — click opens device/owner profile drawer layered on top)
5. **Sparkline** — 30-day activity bar chart (can be pushed behind a "Show trend" toggle if we want to keep the drawer quick)
6. **Owner block** — who minted this code, when, link to their profile

Drawer is read-only. No delete button. No "reassign" button. Immutability is a property of the data, not a UI choice.

## 8. Live behavior

### 8.1 Subscription

`ScanActivityTab.svelte` subscribes to Firestore in `onMount` using the canonical pattern from `src/lib/shared/feedback/services/implementations/FeedbackSubscriber.ts`:

1. Initial hydration: `getDocsFromServer()` on filtered shortcodes
2. Subsequent updates: `onSnapshot(query, { includeMetadataChanges: false })` on a `collectionGroup("scanEvents")` query ordered by `timestamp desc`, limit 100
3. Cleanup: unsubscribe on destroy, guard with `unsubscribed` flag

**Scope filter** is applied in the query:

- "My cards" → `where("ownerId", "==", currentUserId)` on shortcodes query. Codes with `ownerId === "system"` or undefined are excluded from this scope; they only appear in "All (admin)".
- "All (admin)" → no filter, admin-only

**Search** (header input) matches case-insensitive against the code's `word` field OR the code itself. Runs client-side against the already-loaded `codes` map; does not re-query Firestore.

Events are merged into a client-side `codes: Map<string, ScanActivityCode>` where each code holds its latest scan metadata and lifetime counts.

### 8.2 Animation — jump to top

When a new scanEvent arrives:

1. Update `codes` map entry for the affected code (bump scanCount, update `lastScannedAt`, push scan event into local ring buffer)
2. Re-sort codes array by `lastScannedAt desc`
3. Svelte 5 `{#each}` keyed rendering with CSS FLIP-equivalent approach: use `view-transition-name: scan-card-{code}` on each card, wrap the sort update in `document.startViewTransition()` if available, fall back to a CSS transition on `order`/`transform` for unsupported browsers
4. Card at the new top-left position gets the `hot` class for 3 seconds after jump, adding emerald glow
5. Corresponding minimap pin pulses (reused `new` class)

Respect `prefers-reduced-motion: reduce` — skip the transition, just re-render at the new position.

### 8.3 Minimap

Embedded `GlobalUserMap.svelte` instance configured for scan-event markers. Currently `GlobalUserMap` renders user profile markers from a different data source; a minimal extension is needed:

- Add a `markers: MapMarker[]` prop and a `size: "embedded" | "full"` prop (default: "full" preserves current behavior)
- `ScanActivityTab` passes scan-event markers: `{ lat, lng, label: code, styleClass: isRecent ? "new" : "pin" }`
- Most recent 4 rows rendered as a `RecentScansList` component below the globe (reuse `.rrow` styling from mockup)
- "Top locations" component: 7-day rollup aggregated client-side from loaded scan events. Horizontal bar chart, top 5 countries. Not a filter.

## 9. Identity model (deviceId + userId linkage)

**New primitive:** `src/lib/shared/auth/services/implementations/DeviceIdService.ts`

- `getDeviceId(): string` — reads from `localStorage.getItem("tka:deviceId")`; if absent, generates `crypto.randomUUID()`, persists, returns
- `linkDeviceToUser(userId: string): Promise<void>` — called on sign-in; writes/updates `users/{userId}/devices/{deviceId}` doc with `{ firstSeen, lastSeen, userAgent, label?: string }`
- Registered in the DI container; consumed by `ShortCodeManager.logScanEvent` and by the auth state machine's post-sign-in hook

**Schema change to `scanEvents`:**

Add `deviceId: string` field to `ShortCodeManager.logScanEvent` (file `src/lib/shared/qr/services/implementations/ShortCodeManager.ts` line 603). All new events include deviceId; `userId` remains nullable and is populated only when signed in at scan time.

**New subcollection:** `users/{uid}/devices/{deviceId}`

- `{ firstSeen: string, lastSeen: string, userAgent: string, label?: string }`
- Written at link time, updated on subsequent scans where `userId === uid && deviceId === deviceId`
- Admin can read across users; users can only read their own

**Retroactive linking:** on sign-in, we don't rewrite past scanEvents. The "owner profile" view does a two-step lookup: (1) fetch `users/{uid}/devices/*`, (2) query scanEvents `where deviceId in [thisUser'sDevices] or userId == uid`. The `userId == uid` half picks up future scans; the `deviceId in [...]` half picks up past anonymous scans from devices that later signed in.

## 10. Round-trip integrity check

Every card rendered in the feed must pass a **decode → re-encode → string-compare** round-trip on the `encoded` blob before rendering. If the re-encoded string differs from the stored `encoded`, the card renders as the "restoration failed" placeholder (§6).

**Implementation:** extend `SequenceEncoder` with a `verifyRoundTrip(encoded: string): { ok: boolean; decoded?: SequenceData; reason?: string }` method. Compare motion-by-motion on the decoded vs. re-encoded+re-decoded output (field-level diff on `motionType`, `rotationDirection`, `startLocation`, `endLocation`, `turns`, `startOrientation`, `endOrientation`, `handPath`, `prefloatMotionType`, `prefloatRotationDirection`, `skewSteps`, `skewDir`). String compare on the blob itself is too fragile across compression-layer differences.

Cache verification results by `encoderHash` (already stored on shortcode records) so we don't re-verify on every re-render.

The LPhOrr bug fixed 2026-04-20 (`parseInt` → `parseFloat`) would have been caught by this check before it reached production.

## 11. Error states

| Condition | Behavior |
|---|---|
| Sequence decode throws | Placeholder card with red badge, "decode failed" label |
| Round-trip check fails | Placeholder card with "restoration failed" label, click-to-open shows raw motion diff |
| Firestore subscription errors | Full-page error state with retry button; reuse existing error UI patterns |
| Empty state (no scans ever) | Illustrated empty state: "Your cards haven't been scanned yet. Share a QR to see activity here." |
| Empty state (filter returns 0) | Inline "No matches for 'xyz'" under the search bar |
| Minimap script fails to load | Minimap column shows a static message + link to full Community map; feed is unaffected |
| User signed out | View hidden from sidebar entirely (handled by sidebar visibility rules on the Section's metadata) |

## 12. Performance

- Initial load: `getDocsFromServer` on shortcodes (filtered by scope) + last 100 scanEvents. Target: <500ms on broadband.
- Round-trip integrity: memoized by `encoderHash`. Runs once per unique code, not per re-render.
- Card rendering: `ChoreoCardThumbnail` already cloud-caches rendered pictograph images via `PropAwareThumbnail`. No perf change from current gallery.
- Subscription: single `collectionGroup` listener. Re-filters happen client-side against the `codes` map.
- Expected data volume: tens of thousands of codes in the foreseeable future. Feed virtualizes below 200 cards (lazy-load next page on scroll) using the same pattern as `VirtualizedSequenceGrid.svelte`.

## 13. Security & Firestore rules

No rules change required. The 2026-04-20 deploy already covers:

- `shortcodes/{code}`: read open, update restricted to `scanCount + lastScannedAt + dailyScans` fields
- `match /{path=**}/scanEvents/{eventId}`: read for admins, create open, update/delete forbidden

New device subcollection needs a rule:

```
match /users/{uid}/devices/{deviceId} {
  allow read: if request.auth.uid == uid || isAdmin();
  allow write: if request.auth.uid == uid;
}
```

## 14. Accessibility

- All interactive elements ≥44px touch target (`--min-touch-target`)
- All body text ≥14px (`--font-size-min`)
- Cards have `role="button"`, `aria-label` summarizing word + location + time
- Drawer's WAI-ARIA handling is built into `Drawer.svelte` (`trapFocus`, `returnFocusOnClose`)
- `prefers-reduced-motion: reduce` disables jump-to-top animation
- Emerald color contrast against dark background passes WCAG AAA for large text (>18px or >14px bold)
- Search input uses `type="search"` with an `aria-label="Search scans by word or code"`. No visible label in the header bar — `aria-label` is the only accessible name

## 15. Testing

**Unit:**

- `DeviceIdService`: generates and persists a UUID; returns same value across calls
- `SequenceEncoder.verifyRoundTrip`: passes on clean data, fails on corrupted blob, identifies specific failing field
- Sort stability: re-sorting `codes` map on scan event produces correct order

**Integration (vitest):**

- Full encode → decode → hydrate → verifyRoundTrip cycle passes for reference sequences including fractional turns (already partially covered by `SequenceHydrator.test.ts`)
- Mock Firestore subscription fires scan event → code's position updates + animation class applied

**Manual / QA:**

- Scan a QR code on one device, see it appear in the feed on a second device within 2 seconds
- Sign out, clear cookies, scan — event shows with deviceId but no userId
- Sign in with same browser, scan again — event has both deviceId and userId
- Open drawer on a hot card, verify all historical scans shown
- Admin toggle flips scope correctly; non-admin user doesn't see the toggle at all
- Resize window across breakpoints — grid re-flows, minimap collapses below 1100px
- Keyboard navigate: Tab through cards → Enter opens drawer → Escape closes it → focus returns to the card

## 16. Rollout

1. **Phase 1 — feature parity.** Add `ScanActivityTab.svelte` + new components; wire into `CHOREO_CARD_TABS`; ship in parallel with admin tab still live.
2. **Phase 2 — deviceId instrumentation.** `DeviceIdService` + `logScanEvent` extension. Deploy backend rules for `users/{uid}/devices/*`.
3. **Phase 3 — retire admin tab.** Remove `ShortCodeAnalytics.svelte` and admin tab entry. AdminDashboard branch removed.
4. **No data migration.** Historical scanEvents without `deviceId` remain. The two-step lookup gracefully handles both.

## 17. Open questions

None blocking. Things we may revisit post-v1:

- Public signed-out view (when community discovery launches)
- Owner profile drawer layering (drawer-on-drawer UX; may want a dedicated route instead)
- `isPublic` flag on codes for creator-controlled discoverability
- Label-your-device feature ("my phone" vs "work laptop")
- Real-time collaborative scan sessions (multiplayer emoji reactions)

## 18. File manifest (what changes, at a glance)

**New files:**

- `src/lib/features/choreo-card/components/scan-activity/ScanActivityTab.svelte`
- `src/lib/features/choreo-card/components/scan-activity/ScanActivityCard.svelte`
- `src/lib/features/choreo-card/components/scan-activity/ScanHistoryDrawer.svelte`
- `src/lib/features/choreo-card/components/scan-activity/RecentScansList.svelte`
- `src/lib/features/choreo-card/components/scan-activity/TopLocationsBlock.svelte`
- `src/lib/features/choreo-card/state/scan-activity-state.svelte.ts`
- `src/lib/shared/auth/services/implementations/DeviceIdService.ts`
- `src/lib/shared/auth/services/contracts/IDeviceIdService.ts`

**Modified:**

- `src/lib/shared/navigation/config/tab-definitions.ts` — add `"scan-activity"` to CHOREO_CARD_TABS; remove "short-codes" from ADMIN_TABS
- `src/lib/features/choreo-card/components/ChoreoCardTab.svelte` — add `"scan-activity"` to `ChoreoCardMode`, branch in render
- `src/lib/shared/qr/services/implementations/ShortCodeManager.ts` — add `deviceId` field to `logScanEvent` signature
- `src/lib/shared/qr/services/contracts/IShortCodeManager.ts` — mirror signature change
- `src/lib/features/community/components/GlobalUserMap.svelte` — add `markers` prop + `size` variant
- `src/lib/shared/navigation/services/implementations/SequenceEncoder.ts` — add `verifyRoundTrip` method
- `firestore.rules` — add `users/{uid}/devices/{deviceId}` rule
- `src/lib/features/admin/components/AdminDashboard.svelte` — remove short-codes branch

**Deleted:**

- `src/lib/features/admin/components/analytics/ShortCodeAnalytics.svelte`

---

**End of spec.**
