---
status: active
value: 4
effort: M
remaining: "Collection scanner unimplemented; carrier and scan-purpose semantics now depend on the 2026-07-27 official production-ledger design."
depends_on: "2026-07-27-official-card-production-ledger-design.md"
plan_path: ""
tags: []
last_triaged: 2026-08-01
---
# Scan a Physical Card into a Collection — Design

**Date:** 2026-07-02
**Status:** Approved (design dialogue 2026-07-02)
**Owner:** Collections module

> **Superseded in part on 2026-07-27:** The canonical carrier, production, and
> scan-purpose contracts now live in
> [`../2026-07-27-official-card-production-ledger-design.md`](../2026-07-27-official-card-production-ledger-design.md).
> Keep the collection-scoped continuous scanner and sequence-add behavior.
> Replace the assumptions that every printed card is officially minted and
> that filing writes no scan fact. Filing creates a location-suppressed
> observation that is excluded from physical journeys.

## The idea

A user holding a printed choreo card — from a deck they bought or printed —
opens one of their collections, taps Scan, points the camera at the card's QR
code, and the sequence lands in the collection instantly. Filing physical
cards into digital collections, card after card, without leaving the screen.

Austen: *"there should be an easy peasy lemon squeezy way for them to scan the
card that they want to keep and hold onto and have that be added instantly to
the collection."*

## Decisions locked during brainstorming

1. **Collection-scoped only.** No global in-app scanner. The global scan entry
   already exists in its natural form: the phone's camera app reads the card's
   QR and opens the lightweight `/q/[code]` spotlight viewer. In-app scanning
   exists to ADD, not to view.
2. **Continuous filing.** Camera stays open; each recognized card adds with
   haptic + toast; a running count ticks in the header. Physical decks are
   stacks — filing is batch work.
3. **Carrier-aware resolution.** A recognized TKA QR may be an official
   physical carrier, prototype, digital screen carrier, presentation carrier,
   v1 `?pid=` card, or legacy short code. The canonical resolver classifies it
   before the existing identity-first collection import runs. Do not infer
   "printed" or "official" from the presence of a QR. A valid carrier still
   resolves to sequence content; unknown and malformed targets remain
   retryable read failures.

## What already exists (reuse, never hand-roll)

| Need | Existing primitive |
|---|---|
| Camera lifecycle | `src/lib/shared/train/services/camera-manager.ts` — `CameraConfig.facingMode: "environment"`, `getVideoElement()` for the viewfinder, `captureFrame(): ImageData` for detection. Own instance (not the shared getter — the practice mirror configures front-facing). |
| Code → sequence | `ShortCodeManager.resolveShortCode` strategies (`src/lib/shared/qr/services/short-code-manager.ts`): encoded blob, public index, sequenceId-as-word, direct Firestore doc, embedded sequenceData. |
| Add to collection | `collectionsState` (cap guard 500, latency compensation, toasts) + `addSequenceToCollection` (tolerates foreign sequence ids). |
| Save a copy | `src/lib/shared/library/services/library-repository.ts` `saveSequence` (via `library-save-service`). |
| Sheet chrome | `Drawer` primitive — bottom sheet mobile / right drawer desktop, drawer-stack for nesting, same placement logic as `AddSequencesSheet`. |
| Nav hiding | `browseScrollState.hideUI()/showUI()` (picker precedent). |

**The one genuinely new capability: QR decoding.** No decoder exists in the
app today (`qr-code-styling` only *generates*). Adopt
[`barcode-detector`](https://github.com/Sec-ant/barcode-detector) (Sec-ant) —
the Barcode Detection API ponyfill backed by ZXing-C++ WASM; uses the native
`BarcodeDetector` engine where the platform provides it. It is the engine
inside vue-qrcode-reader and @yudiel/react-qr-scanner. Integration
requirement: it fetches `zxing_*.wasm` from jsDelivr at runtime by default —
**self-host the .wasm under `static/`** and point the loader at it with
`prepareZXingModule({ locateFile })`, same discipline as the Draco decoder at
`static/draco/`.

## Architecture

```
CollectionDetailView (own collections only)
  └── "Scan" header button → mounts ScanCardSheet

ScanCardSheet.svelte  (features/browse/collections/components/)
  ├── Drawer (bottom mobile / right desktop, nav hidden while open)
  ├── viewfinder <video> ← own CameraManager (facingMode: "environment")
  ├── detection loop (~200ms interval): captureFrame() → BarcodeDetector.detect()
  ├── header: "Scan into {name}" + session count + Done
  └── per-hit pipeline (card-scan-import service):
        extract target → resolve carrier/legacy target
          → resolveForImport(shortCode) → add/import → haptic + toast
```

### New units

**1. `ScanCardSheet.svelte`** — the Drawer host. Owns camera lifecycle
(start on mount, stop on cleanup — camera MUST release on close), detection
interval, session seen-set, count, toasts. Mount-closed + rAF-open slide-in,
`requestClose()` slide-out before unmount (AddSequencesSheet pattern).

**2. `extractScanTarget(rawValue: string): ScanTarget | null`.** Pure function
(plain module, tree-shakeable). Accepts `https://tka.run/x/{token}`, legacy
`https://tka.run/{code}` with optional parameters, bare codes, and inline
`s~...` payloads. Returns a carrier token or legacy code. Non-TKA QR content
is ignored silently.

**3. Carrier resolver plus `ShortCodeManager.resolveForImport(code)`.** A
carrier target first resolves through the canonical server resolver to a short
code and carrier classification. Legacy targets already contain the code. The
existing record fetch then uses **identity-first strategy order**: public index
/ sequenceId-as-word / direct doc load FIRST (returns
`{ sequence, hasDoc: true }` with a real doc id + ownerId), embedded blob /
encoded decode LAST (`{ sequence, hasDoc: false }`). Viewing wants speed;
filing wants stable collection identity.

**4. Import fork** (inside the scan handler, not a new service):

- `hasDoc: true` → add the doc id to the collection. A reference — creator
  attribution intact, identical to adding from the Community picker.
- `hasDoc: false` → `saveSequence` a copy into My Library, then add the new
  own-doc id. Silent to the user; the toast is the same "added ✓". This is
  the COMMON path for printed deck cards (deck shortcodes embed sequenceData
  without ownerId).

Invariant preserved: collection members are always Firestore-doc-resolvable
(own or public) — `getCollectionSequences` displays them without changes.

### Session semantics

- **Seen-set dedupe:** a code that already fired this session is ignored
  (card still in frame ≠ add twice). On resolve/add FAILURE the code is
  removed from the set so re-aiming retries.
- **Already a member:** distinct toast "already in {collection}", no write,
  code enters seen-set.
- **Cap:** existing 500-cap guard in collections-state; its toast surfaces
  as-is and scanning continues (user may re-aim at other cards, same result).
- **Detection pause:** while a hit is resolving, detection skips ticks —
  prevents double-fire and overlapping writes.

### Entry point

`CollectionDetailView` header, next to "Add": Scan button, shown only when
`collection && !renaming && !foreignOwnerId` (same gate as Add). Also on the
own-collection empty state beside the "Add sequences" CTA. Signed-in is
implied (own collection detail requires auth).

## Error handling

| Failure | Behavior |
|---|---|
| Camera denied / missing / busy | CameraManager already throws mapped messages ("Camera access was denied…" etc.). Render inline in the sheet with a Retry button — the established consumer pattern (CameraPreview, VideoRecordPanel). |
| Frame with no QR / non-TKA QR | Loop keeps scanning. No error UI. |
| Resolve fails (network) | Toast "Couldn't read that card — try again"; code removed from seen-set; scanning continues. |
| saveSequence copy fails | Same toast + seen-set removal. No partial state (add only runs after save succeeds). |

## Analytics

Filing scans create a deduplicated observation with purpose `filing`, suppressed
location, and `eligibleForJourney: false`. This records how the collection
relationship was created without treating home filing as travel. See the
canonical production-ledger spec linked above.

## Out of scope (deliberate)

- Global / viewer-side in-app scanner (phone camera + `/q/[code]` covers it)
- Scanning to any other destination (library, favorites) — collections only
- Batch review UI before commit — adds friction to filing; instant add is the point
- Capacitor native scanner plugin — web `getUserMedia` + ponyfill works in
  the wrapped app too; revisit only if WASM performance disappoints on device

## Testing & verification

- Unit: `extractScanTarget` (carrier URL, legacy URL, params, case, inline
  `s~`, garbage), tested as a pure function in vitest.
- Unit: `resolveForImport` strategy order + `hasDoc` fork (mock Firestore
  record shapes: doc-backed, embedded-only, encoded-only).
- Unit: scan handler session semantics (dedupe, already-member, failure
  removes from seen-set) via collections-state mocks.
- Device: camera + real printed card — Austen on phone (dev server is HTTPS,
  so `getUserMedia` works on LAN). Claude cannot verify camera visually.
