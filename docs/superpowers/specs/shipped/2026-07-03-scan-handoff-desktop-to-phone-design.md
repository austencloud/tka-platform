---
status: active
value: 3
effort: L
remaining: "Body status: Active"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Scan Handoff — Desktop to Phone (v1) — Design

**Date:** 2026-07-03
**Status:** Active
**Depends on:** `2026-07-02-scan-card-to-collection-design.md` (ScanCardSheet, resolveForImport, the whole filing pipeline — SHIPPED)

## Problem

The collection detail view has a "Scan" button that opens `ScanCardSheet`, a
rear-camera viewfinder for filing physical cards. On a phone that's the right
tool. On a desktop it assumes a camera that usually isn't there, and holding a
printed card up to a laptop webcam is awkward even when one exists.

The user is very often signed into the same account on their phone. The phone
is the natural scanner. We want: from the desktop, hand the scan job to the
phone in one gesture, and have the scanned cards land in the desktop's open
collection live — no new account-linking, no SMS, no push infrastructure.

## Key Realization (why this is small)

The "cards appear on desktop live" half **already works**. `CollectionDetailView`
subscribes to its collection through `subscribeToCollection` (per-doc
`onSnapshot` in `collection-manager.ts`); when the phone adds a member, the
desktop grid refetches and grows on its own. Nothing to build there.

The only missing piece is the **handoff nudge** — getting the phone onto the
scanner for *this* collection fast. That reduces to a deep link + a QR.

No new authentication is required. A phone signed into the same Firebase account
is the same `uid`; Firestore rules already scope collection writes to the owner.
Same-account sign-in IS the authorization. (SMS verification would secure an
*unauthenticated* channel we deliberately don't have.)

## Locked Decisions

1. **Trigger — always on desktop.** The desktop `ScanCardSheet` shows the
   phone-handoff QR as the primary view, with a secondary "use this computer's
   camera" action for the webcam case. Not gated on camera-missing detection.
2. **Signed-out phone — deep link survives sign-in.** Auth is in-place
   (popup / Google One-Tap), no login-page redirect, so the collection URL and
   the pending scan intent survive the auth flow. After sign-in the sheet opens.
   A phone signed into a *different* account can't resolve the owner's bare
   collection id → the existing null-collection path shows "collection not
   found."
3. **URL scheme — mirror `/browse/creators/[userId]`.** New parser + BrowseModule
   onMount branch + one-shot intent. No new route file (SPA fallback already
   serves `/browse/*` with zero route files).

## Reuse Table (never-hand-roll gate)

| Need | Reusing | Path |
|---|---|---|
| Scanner UI + filing pipeline | `ScanCardSheet` (extend: dual-mode) | `src/lib/features/browse/collections/components/ScanCardSheet.svelte` |
| Deep-link parser pattern | `getCreatorIdFromURL()` (add sibling) | `src/lib/shared/browse/state/browse-navigation-state.svelte.ts:54` |
| One-shot deep-link intent | `pending-sequence.svelte.ts` pattern (add sibling module) | `src/lib/features/browse/state/pending-sequence.svelte.ts` |
| URL-override-on-mount seam | BrowseModule onMount creator branch | `src/lib/features/browse/shared/components/BrowseModule.svelte:386` |
| Collection detail nav | `browseNavigationState.viewCollectionDetail(id)` | `browse-navigation-state.svelte.ts:308` |
| QR render | `getQrCodeGenerator().generateForUrl(url, opts)` | `src/lib/shared/qr/services/qr-code-generator.ts:271` |
| Canonical prod URL | `getAppCanonicalURL(path)` | `src/config/domains.ts:96` |
| Live desktop update | `subscribeToCollection` (already wired in detail view) | `src/lib/shared/library/services/collection-manager.ts` |
| Desktop/mobile split | `placement` derived (`right`/`bottom`) already in ScanCardSheet | ScanCardSheet:59 |

Nothing new invented. Two new leaf files (a URL-parser sibling lives in an
existing file; the one-shot intent is a tiny new module) + one component extended.

## Architecture

### 1. Deep link + parser

QR payload: `getAppCanonicalURL("browse/collections/{collectionId}?scan=1")`
→ `https://tkaflowarts.com/browse/collections/{collectionId}?scan=1`. Canonical
prod domain regardless of the desktop's origin, because the phone must reach a
publicly-routable URL. (Dev limitation: on localhost the QR still points at prod,
so cross-device dev testing hits prod — acceptable, noted.)

New export in `browse-navigation-state.svelte.ts`, sibling to
`getCreatorIdFromURL()`:

```ts
export interface CollectionScanTarget {
  collectionId: string;
  scan: boolean;
}

/**
 * Read a collection deep link from the URL: /browse/collections/[id] with an
 * optional ?scan=1 flag. Returns null on any other path. This is how a phone
 * that scanned the desktop handoff QR lands straight on the collection with the
 * scanner open.
 */
export function getCollectionScanTargetFromURL(): CollectionScanTarget | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts[0] === "browse" && parts[1] === "collections" && parts[2]) {
    const scan = new URLSearchParams(window.location.search).get("scan") === "1";
    return { collectionId: decodeURIComponent(parts[2]), scan };
  }
  return null;
}
```

### 2. One-shot scan intent

New module `src/lib/features/browse/state/pending-scan-intent.svelte.ts`
(colocated with its sibling `pending-sequence.svelte.ts`), mirroring that
one-shot exactly (same `.svelte.ts` + `$state` convention):

```ts
let pendingScanCollectionId = $state<string | null>(null);

/** Stash a request to auto-open the scan sheet for a collection, set from a
 *  deep link on load, consumed once by the collection detail view. */
export function setPendingScanIntent(collectionId: string): void {
  pendingScanCollectionId = collectionId;
}

/** Read and clear the pending scan intent. One-shot so a refresh or a later
 *  visit to the same collection doesn't reopen the scanner. */
export function consumePendingScanIntent(): string | null {
  const id = pendingScanCollectionId;
  pendingScanCollectionId = null;
  return id;
}
```

### 3. BrowseModule onMount consumption

In `BrowseModule.onMount`, after the existing `getCreatorIdFromURL()` branch and
`browseNavigationState.initialize("gallery")`, add:

```ts
const scanTarget = getCollectionScanTargetFromURL();
if (scanTarget) {
  browseNavigationState.viewCollectionDetail(scanTarget.collectionId);
  if (scanTarget.scan) setPendingScanIntent(scanTarget.collectionId);
}
```

Ordering: this runs after `initialize()`, so the deep link wins over the
localStorage-restored location (same contract the creator branch relies on).

### 4. CollectionDetailView auto-open

`CollectionDetailView` already owns `let scanSheetOpen = $state(false)` and mounts
`{#if scanSheetOpen && !foreignOwnerId}<ScanCardSheet …>`. On mount, consume the
intent:

```ts
onMount(() => {
  const pending = consumePendingScanIntent();
  if (pending === collectionId && !foreignOwnerId) scanSheetOpen = true;
});
```

`!foreignOwnerId` guard keeps a wrong-account phone (which lands foreign or
null) out of the scanner. If the collection didn't resolve, the sheet never
mounts and the existing not-found path shows.

### 5. ScanCardSheet — dual mode

One component, split by `placement` (already derived: `right` on desktop,
`bottom` on mobile). The phone handed off from the desktop lands in `bottom`
placement → today's camera-first behavior, unchanged.

**Change:** camera no longer starts unconditionally in onMount. Extract to a
`chooseCamera()` gate:

- **Mobile (`placement === "bottom"`):** call `startCamera()` on mount, exactly
  as today. Phone IS the scanner.
- **Desktop (`placement === "right"`):** do NOT start the camera. Render the
  handoff panel (below). A secondary "Use this computer's camera" button sets
  `cameraChosen = true` and calls `startCamera()`, flipping to the existing
  viewfinder.

New desktop handoff panel (replaces the viewfinder area when
`placement === "right" && !cameraChosen`):

- Styled QR of the deep link (`getQrCodeGenerator().generateForUrl(handoffUrl)`),
  generated in an `onMount`/`$effect`, rendered as the returned `svg` (or
  `dataUrl` img). Reserve a fixed box (no layout shift on async decode —
  `no-layout-shift.md`).
- Copy: "Scan this with your phone to add cards. They'll appear here as you go."
- Live counter: capture `target.sequenceCount` as `baselineCount` when the panel
  opens; show `Math.max(0, (target?.sequenceCount ?? 0) - baselineCount)` cards
  added, `tabular-nums`. Reads off the existing live `target` derived — updates
  as the phone files. Zero new subscription.
- Secondary button "Use this computer's camera" → `cameraChosen = true;
  startCamera()`.

`handoffUrl = getAppCanonicalURL(\`browse/collections/${collectionId}?scan=1\`)`.

The camera-cleanup in the mount teardown stays; it's a no-op if the camera was
never started (guard `camera.stop()` is already safe on an uninitialized
manager — verify).

### Data flow

```
Desktop: tap Scan → ScanCardSheet (right placement)
  → handoff panel: QR of tkaflowarts.com/browse/collections/{id}?scan=1
  → desktop counter reads live target.sequenceCount (already subscribed)

Phone: camera app scans QR → opens app at that URL
  → BrowseModule.onMount reads getCollectionScanTargetFromURL()
  → viewCollectionDetail(id) + setPendingScanIntent(id)
  → (if signed out: in-place auth; URL/intent survive)
  → CollectionDetailView.onMount consumes intent → scanSheetOpen = true
  → ScanCardSheet (bottom placement) → camera → resolveForImport → file
  → addSequenceToCollection writes to Firestore

Desktop: subscribeToCollection fires → grid grows, counter ticks. Live.
```

## Error Handling

- **Wrong account / unresolvable collection:** bare id doesn't resolve for a
  different `uid`; `!foreignOwnerId` guard + existing null-collection path →
  "collection not found." No scanner opens.
- **Signed-out phone:** in-place auth; deep link + intent survive; sheet opens
  post-auth. (Intent is module-level in-memory — survives the popup auth flow,
  which does not reload the page. If a provider ever forces a full-page
  redirect, the intent is lost and the phone lands on the collection without the
  scanner auto-opening — acceptable degradation; the Scan button is right there.)
- **Desktop, no camera, user clicks "use this computer's camera":** existing
  `cameraError` path (CameraManager maps `NotFoundError` → readable message) +
  the existing "Try again" retry. The handoff QR remains the escape hatch.
- **QR generation failure:** if `generateForUrl` throws, show the raw deep link
  as selectable text fallback so the handoff still works.

## Testing

**Unit (`state`/`services` scoped — the `.svelte.test.ts` browser-mode sweep rule):**
- `getCollectionScanTargetFromURL()`: `/browse/collections/abc?scan=1` →
  `{collectionId:"abc", scan:true}`; without `?scan` → `scan:false`;
  `/browse/creators/x`, `/browse/gallery`, `/` → null; URL-encoded id decodes.
- `pending-scan-intent`: set then consume returns id; second consume returns
  null (one-shot); consume without set returns null.

**Manual (device):**
- Desktop collection → Scan → sheet shows QR, no camera prompt.
- "Use this computer's camera" → viewfinder starts.
- Phone camera app → scan QR → app opens on the collection, scanner open.
- Scan a printed card on the phone → desktop grid grows + desktop counter ticks
  live, both devices in view.
- Signed-out phone → auth → lands in scanner.

## Out of Scope (later rungs)

- **v2 — FCM web push:** notify the phone without the desktop showing a QR.
  Real infra (token registry, service worker, permission UX); iOS only in
  installed PWAs. Not built.
- **v3 — Capacitor native push:** the "top tier" full-screen native scan UI.
  Gated on the T6 Capacitor project (spec approved 2026-04-24, unbuilt). When it
  lands it swaps only the *delivery* — the deep link, scanner, and live desktop
  sync are the same code.
- SMS phone verification — explicitly rejected (secures a channel we don't have).
- Cross-account delegated scanning — not a use case (you scan into your own
  collections).
