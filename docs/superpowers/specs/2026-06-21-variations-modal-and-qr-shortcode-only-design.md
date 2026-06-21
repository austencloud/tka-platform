# Variations Modal + QR Short-Code-Only — Design

Date: 2026-06-21
Status: Approved (Austen, "go nuts")

## Problem

Two defects in the Browse/Gallery "Variations" experience, observed on a 4K screen:

1. **Variations view is enormous and ugly.** Clicking a sequence with multiple
   variations opens `VariationPickerDrawer` (a bottom `Drawer`) whose grid uses
   `repeat(auto-fit, minmax(min(100%, clamp(200px, 20vw, 480px)), 1fr))`. With
   only 2 variations on a 3840px screen, `auto-fit` + `1fr` stretches each card
   to ~half the viewport — giant cards, wasted space.

2. **QR codes are dense, unscannable, and not the short code.** Browse cards are
   cloud-cached **composite images** rendered by `image-composer.ts`. QR
   visibility comes from `compositionManager.showQRCode` baked into the image.
   For guests, the QR path falls back to `createOfflineCode` → an `s~...` blob
   that encodes the **entire sequence** into the QR URL. The thumbnail cache key
   (`deriveKey`) does not include auth state, so a guest-rendered card with the
   dense `s~` QR gets uploaded to the shared cloud cache and shown to everyone.
   Different `s~` payload lengths also produce inconsistent QR module density.

## Decisions (locked)

- Signed-in users: QR always uses the Firebase short code (`tka.run/<code>`).
- **Guests (not authenticated): no QR at all.** Do not generate, do not bake.
- Rip out the dense-QR (`s~` / "offline") generation path entirely.
- Codec (`encodeSequenceForQR`/`decodeSequenceFromQR`) full removal is the goal,
  but it is entangled with shortcode-doc embedding + resolution + scan-activity.
  Remove fully **iff** resolution can fall back to a `sequenceId` fetch without
  breaking legit short codes; otherwise retain it strictly as internal
  serialization (never as a QR payload) and report precisely what was kept + why.
- Variation cards: medium (~300–340px) in a centered modal, max-width ~1100px.

## Workstream A — Variations: Drawer → centered Modal

**Files:** `src/lib/features/browse/sequences/display/components/VariationPickerDrawer.svelte`
(and its consumer `src/lib/features/browse/shared/components/GalleryTab.svelte`
if the open/close contract changes).

**Reuse, do not hand-roll:**
- `src/lib/shared/foundation/ui/modal/BaseModal.svelte` (native `<dialog>`, size
  presets, backdrop/ESC, focus trap). Use size `lg`.
- `ModalHeader.svelte` (title + close) replaces `DrawerHeader`.

**Changes:**
- Replace the `Drawer` wrapper with `BaseModal` (centered). Keep the
  `isOpen` / `onClose` / `onSelect` props and the variation list intact.
- Grid: `grid-template-columns: repeat(auto-fill, minmax(300px, 340px));`
  `justify-content: center;` — fixed-max cards (NOT `1fr`), so 1 card renders
  at 340px centered, never stretched. Modal body `max-width: ~1100px`, scrolls.
- Keep `ChoreoCardThumbnail` with `eager`.
- Mobile (`max-width: 767px`): BaseModal goes full-screen (size `full`) so phones
  are not cramped. Verify the existing `view-transition-name` suppression on
  mobile still holds.
- Preserve the i18n keys (`browse_variations_title`, `browse_choose_variation`).
- No-layout-shift: the grid is fixed-cell, so no reflow when QR appears/absent.

**Verification:** load `http://localhost:5173/browse/gallery`, open a multi-
variation word (e.g. AABB), confirm via screenshot that the modal is centered,
capped width, cards are ~320px, and a single-variation case is not stretched.

## Workstream B — QR: short-code-only, guests get none

**Definitely remove (dense-QR path):**
- `qr-code-generator.ts:197-212` — the `if (options?.offline)` branch and the
  `offline` option in `QRCodeOptions` (`qr/services/types.ts:97`). Always short
  code.
- `short-code-manager.ts:180-194` — the guest short-circuit that returns
  `createOfflineCode`. Guests must not reach the QR path at all (caller gates).
- `short-code-manager.ts:470` — `createOfflineCode` method.
- `sequence-viewer-overlay-state.svelte.ts:89,103` — `createOfflineCode` calls;
  guests get no QR overlay (gate on auth, show nothing / sign-in affordance).
- `resolveShortCode` inline `s~` branch (`short-code-manager.ts:~515-520`).

**Guests render no QR:**
- `PropAwareThumbnail.svelte` — when unauthenticated, force
  `effectiveVisibility.showQRCode = false`. Because `showQRCode` is part of the
  cache key, guest renders key separately (`showQRCode:false`) from signed-in
  renders (`showQRCode:true`) — a guest's no-QR card can no longer overwrite the
  signed-in short-code card in the shared cloud cache.
- `ChoreoCard.svelte:317` and `QRMandalaOverlay.svelte:120` — replace
  `offline = !authState.isAuthenticated` with: if `!authState.isAuthenticated`,
  skip QR generation entirely (no `qrDataUrl`); else generate short-code QR.

**Codec removal (conditional):**
- Investigate whether `record.encoded` (shortcode-doc embed, written at
  `short-code-manager.ts:409`, read at `:636`) can be dropped in favor of
  resolving the sequence by the doc's `sequenceId` (already stored/backfilled),
  with community sequences being guest-readable by id.
  - If yes: remove `encodeSequenceForQR`, `decodeSequenceFromQR`, `INLINE_PREFIX`,
    `compressForQR`, `decompressFromQR`, the `encoded` doc field, and update
    `scan-activity-state.svelte.ts:246` (old `s~` scans become unsupported — an
    accepted regression). Delete the now-dead codec tests
    (`tests/unit/codec/qr-roundtrip.test.ts`, the s~ portions of
    `tests/unit/services/CompositionalEncoding.test.ts`,
    `tests/unit/services/sequence-codec.test.ts`).
  - If no (resolution genuinely depends on embedded data): keep the codec as
    internal serialization ONLY, ensure it is never a QR payload, and report the
    retention + reason. Update tests accordingly.

**Consistent QR sizing** falls out: every QR becomes a fixed-length short-code
URL → uniform module density → consistent visual size.

**Operational (not code):** after the fix ships, run the admin "Clear Cloud
Thumbnails" once so existing dense-`s~` cached images re-render with short-code
QRs (for signed-in renders). Flag this to Austen.

**Verification:** signed-in render of a browse card → scan the QR → resolves to
`tka.run/<code>` and loads the sequence. Guest render → no QR present. `npm run
check` green. Codec tests pass or are removed per the conditional above.

## Out of scope

- Changing the short-code minting/resolution scheme itself (base36, tiered
  codes) — see `project_short_code_domain`.
- Redesigning the card visual (`ChoreoCard`/`CardGridLayout`) beyond QR slot.
