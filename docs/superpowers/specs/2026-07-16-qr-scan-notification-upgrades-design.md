# QR Scan Notification Upgrades — Design

**Date:** 2026-07-16
**Status:** In implementation
**Owner:** Austen

Four improvements to the admin QR-scan notification pipeline
(`scanEvents` write → `pulseScanActivity` → `notifyAdmins` → `onNewNotification` → FCM).

## 1. Simplify the scanned word

The notification label was raw `sequenceName || word || code`. A LOOP word
(`FΨFΨFΨFΨ`) must display in smallest form (`FΨ`) per
`.claude/rules/simplified-word-display.md`. `simplifyRepeatedWord` lives in app
code (`src/lib/shared/foundation/utils/word-simplifier.ts`) and the functions
package can't import from `src/`, so the pure util is ported to
`firebase-functions/src/pulse/wordSimplifier.ts` and applied to the label.

## 2. Attribute signed-in scanners

The `/q/[code]` route hardcoded `userId: null` at scan time ("auth isn't
initialized on this bare route"). Fix: `QScanPage` awaits `initializeAuthListener()`
(raced against a 1.5s timeout so anonymous scans never stall) before
`logScanEvent`, passing `authState.user?.uid`. The function then resolves the
scanner's display name and reads:

- Signed-in, non-admin: `Austen scanned "FΨ" in Portland, OR`
- Anonymous: `"FΨ" scanned in Portland, OR`
- Admin scanning own card: **suppressed** (volume = "all except your own").

## 3. Coalesce a burst into one rolling digest

Chosen behavior: **global rolling digest** (one notification that keeps updating,
not a flood of "reds").

Implementation exploits the existing trigger topology: `onNewNotification` fires
on document **create** only. So the digest is a per-admin notification doc with a
deterministic id keyed to a 10-minute window bucket
(`qr-scan-digest-${floor(now / 10min)}`), upserted in a transaction:

- **First scan in the window** → `set` (fires `onNewNotification` → exactly one
  push). Message = full single-scan detail (see §2).
- **Subsequent scans in the same window** → `update` (accumulate `scanCount`,
  distinct `cities`/`codes`, refresh the latest-scan click target). Updates do
  **not** re-fire `onNewNotification`, so no additional pushes and no new "red".
  Once `scanCount > 1` the message escalates to
  `9 scans · 3 cities · last 10 min`.

Tradeoff: hard 10-min bucket boundaries (a scan at 9:59 and 10:01 land in
adjacent docs) in exchange for race-free idempotent upserts (two near-simultaneous
scans resolve to the same doc id and serialize through the transaction).

Message builders (`singleScanMessage` / `digestMessage`) are pure and unit-tested.

## 4. Interactive destination — map + card peek

Click target chosen: **Scan Activity map flown to the scan's pin, with the scanned
card peeked beside it.**

- Notification doc now carries `shortCode`, `scanLat`, `scanLng`, `scanCity`
  (latest scan in the digest).
- `InboxNotificationItem` gains an `admin-qr-scan` case: set a
  `scan-notification-target` state `{ code, lat, lng }`, close the inbox,
  `handleModuleChange("choreo_card", "scan-activity")`.
- `ScanActivityTab` consumes the target on mount/effect: flies the map (`focus`)
  and opens a `ScanCardPeek` panel that lazy-resolves the code via
  `shortCodeManager.resolveShortCode` and renders the sequence-viewer `ChoreoCard`
  plus an **Open card** button → `/q/{code}`.
- The FCM push `url` stays `/app?tab=notifications` (the deep-linker doesn't map
  the admin `choreo_card` module; a lock-screen tap lands in the inbox, one tap
  from the interactive item). In-app click is the fully-wired path Austen
  described.

## Files

Functions: `pulse/wordSimplifier.ts` (new), `pulse/scanDigestMessages.ts` (new,
pure), `pulse/notifyAdmins.ts` (+`notifyAdminsScanDigest`),
`pulse/pulseTriggers.ts` (rewrite `pulseScanActivity`), `push/onNewNotification.ts`
(pulse titles).

App: `routes/q/[code]/QScanPage.svelte` (auth capture),
`feedback/domain/models/notification-models.ts` (`PulseNotification` +
`scanLat`/`scanLng`/`scanCount`/`fromUserName`),
`features/choreo-card/state/scan-notification-target.svelte.ts` (new),
`inbox/components/notifications/InboxNotificationItem.svelte` (click case),
`features/choreo-card/components/scan-activity/ScanActivityTab.svelte` (consume
target), `features/choreo-card/components/scan-activity/ScanCardPeek.svelte` (new).

Tests: `firebase-functions` word-simplifier + digest-message unit tests.
