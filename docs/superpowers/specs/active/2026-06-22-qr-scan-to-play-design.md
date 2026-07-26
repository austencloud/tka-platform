---
status: active
value: 4
effort: M
remaining: "Body status: active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# QR "Scan to Play" — Play-Button QR + Scan Tracking Fix

Date: 2026-06-22
Status: active

## Problem

Every physical Choreo card ships with a QR code, but two things are wrong:

1. **Scans are invisible in-app.** The Scan Activity tab is fully built and reads
   Firestore `shortcodes/{code}/scanEvents` via `collectionGroup`, but the actual
   card-scan route never writes there. So printed cards have been scanned and the
   owner can't see any of it in-app.
2. **The QR doesn't say what it does.** Nothing on the card signals that scanning
   plays the animated sequence. No center affordance, no caption.

## Ground Truth (verified this session)

- QR generation: `src/lib/shared/qr/services/qr-code-generator.ts` →
  `createQROptions` (line ~93), using `qr-code-styling` ^1.9.2. The lib natively
  supports `image` + `imageOptions` (verified against lib docs) for a center
  overlay; the generator currently omits them. Default `errorCorrectionLevel: "M"`.
- Encoded URL is always `https://tka.run/{6-char-code}` (`generateForSequence`
  line ~201). A center image overlay does NOT change encoded data.
- Printed-card QR path: `src/lib/shared/render/services/image-composer.ts` →
  `renderQRCode` (line 703) calls `qrCodeGenerator.generateAsImage()` (line 732),
  which routes through `generateQR` → `createQROptions`. One change at the
  generator covers physical cards, in-app QR, and the worker path (the worker
  receives a main-thread bitmap from the same generator via `preRenderedQR`).
- The QR is drawn at `qrSize = stepSize * getQRCellScale(stepCount)` centered in a
  `stepSize` cell with `padding = (stepSize - qrSize)/2` (line 725-726) — a blank
  band exists below the QR for a caption.
- Scan route: `src/routes/q/[code]/+page.svelte`. At line ~461, inside an existing
  `if (!isInlineEncoded(shortCode) && isGenuineScan(shortCode))` gate, it fires
  PostHog `captureEvent("card_scanned", { country, city, ... })`. Geo comes from
  `+page.server.ts` (Cloudflare `cf-ipcountry`/`cf-ipcity`) as `data.geo`. It does
  NOT call `logScanEvent`. Scanning resolves the sequence into
  `SequenceViewerOrchestrator` and sets `pageState = { kind: "playing" }` — it
  genuinely plays/animates, so "Scan to play" is accurate.
- Writer: `ShortCodeManager.logScanEvent(code, {...})`
  (`src/lib/shared/qr/services/short-code-manager.ts` ~line 736) writes to
  `shortcodes/{code}/scanEvents`. Currently only called from
  `SequenceViewerDrawerHost.svelte` and `sequence/[id]/+page.svelte` (both
  client-side, so they pass `country: null, city: null`).

## Decisions (locked)

- QR treatment: **center play button + caption** (both reinforce).
- Caption copy: **"Scan to play"** — matches the play-triangle icon and is literally
  accurate (the link opens the animated player).

## Design

### Part A — Embedded play button

`qr-code-generator.ts` → `createQROptions`:

- Add `image: PLAY_ICON_DATA_URL` and
  `imageOptions: { imageSize: 0.22, margin: 4, hideBackgroundDots: true, crossOrigin: "anonymous" }`.
- Bump `qrOptions.errorCorrectionLevel` from `"M"` to `"H"` (30% recovery) so the
  overlay never breaks scannability. (Keep honoring an explicit
  `style.errorCorrectionLevel` override if one is passed.)
- `PLAY_ICON_DATA_URL`: inline SVG data URL — a rounded play triangle in a soft
  circular badge. Color matches the QR dark-module color (`style.color`,
  dark-mode aware: white badge/triangle on dark cards). No new static asset.
- Cache key (`qr-code-generator.ts` line ~152) already keys on `JSON.stringify(style)`
  + url + size + margin. Since the icon color derives from `style.color`, confirm
  the icon variant is captured by the key; if the icon URL is independent of
  `style`, fold it into the cache key so a theme switch can't serve a stale icon.

### Part B — "Scan to play" caption (printed card)

`image-composer.ts` → `renderQRCode`:

- Reserve a caption strip: reduce the drawn `qrSize` slightly (or use the existing
  bottom `padding` band) so the QR stays square and centered with room beneath.
- Draw `"Scan to play"` centered horizontally under the QR via `ctx.fillText`,
  styled consistent with existing card text (font family/size scaled to
  `stepSize`, dark-mode-aware color). Keep it subtle, not shouty.
- Print path only. In-app QR components inherit the play button (same generator)
  but not the caption unless explicitly added later.

### Part C — Scan tracking fix

`src/routes/q/[code]/+page.svelte`, inside the existing `isGenuineScan` gate
(~line 461), alongside `captureEvent`:

```ts
void shortCodeManager.logScanEvent(shortCode, {
  printId: page.url.searchParams.get("pid") || null,
  country: data?.geo?.country ?? null,   // server-side Cloudflare geo
  city: data?.geo?.city ?? null,
  userAgent: navigator.userAgent,
  referrer: document.referrer || null,
  userId: authState.user?.uid ?? null,
  deviceId: deviceIdService.getDeviceId(),
}).catch(() => {});
```

- Verify the exact `logScanEvent` signature and the deviceId service import
  against `short-code-manager.ts` before wiring; thread only fields it accepts.
- Keep PostHog `captureEvent` as-is (separate analytics channel).

## Verification

- `npm run check` green; `npm run build` green.
- Render a card through the real print/render path; screenshot the QR — play
  button centered, "Scan to play" legible.
- Scan the rendered QR with a phone — confirms it still resolves to the player.
- Trigger a real `/q/{code}` load; confirm a `scanEvents` doc appears in Firestore
  and surfaces in the Scan Activity tab with geo.

## Out of scope

- Redesigning the Scan Activity tab (already built).
- In-app QR caption (print-card only for now).
- Changing the encoded URL or short-code scheme.
