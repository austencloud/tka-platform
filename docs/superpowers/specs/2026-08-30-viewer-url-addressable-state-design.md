# Sequence Viewer: Fully URL-Addressable State

**Date:** 2026-08-30
**Status:** Approved (design review passed; architecture revised against codebase evidence)
**Owner surfaces:** `/sequence/[id]` route + in-app viewer drawer overlay

## Problem

A copied viewer link carries almost nothing. `buildViewerShareDetails`
(`src/lib/shared/sequence-viewer/services/viewer-orchestrator-model.ts:81`)
encodes only `word`, `creator`, `notes`, `difficulty`, `birthday`, `bpm`,
`dark`. Everything else — active effect and its tuning, viewer mode, split
layout, prop types beyond `bp`/`rp`, 2D/3D settings, export options, card
controls, tunnel config, Post Studio setup — lives in ~25 localStorage keys on
the sender's machine. Opening a shared link therefore shows the *recipient's*
last-used state, not what the sender was looking at.

Requirement (Austen, 2026-08-30): *"when I click a link I want that link to
take me to the exact place with the exact visuals that I was looking at at the
moment that I copied that link. It should not open up a sequence viewer to
whatever settings I had last."*

## Approved Decisions

1. **View-only override.** A link's state drives that viewing session. The
   recipient's persisted settings are never written by opening a link. Closing
   the viewer returns them to their own defaults.
2. **Live sync, debounced.** The address bar is always a complete snapshot
   (replaceState via `mutateCurrentUrl`, ~400 ms debounce). Copying the
   address bar and using Share/Copy Link yield equivalent links.
3. **Hybrid link shape.** Readable headline params for the common knobs; one
   compressed blob param for deep state. Only non-default values are encoded,
   so a plain link stays as short as today.

## Architecture

### The seam is instance construction, not storage interception

The codebase already owns the "seed from a snapshot, never touch the user's
saved config" capability: `createEffectsConfigState(initial, { persist: false })`
(`src/lib/shared/effects/state/effects-config-state.svelte.ts:314`), shipped by
`TunnelDetailPreview`, `Scene3DPreview`, and `PostStudio`. This spec extends
that pattern to every participating store instead of adding any localStorage
shim/interception layer. Consequences, by construction:

- Opening a link performs **zero localStorage writes**.
- Closing the viewer restores the user's own settings automatically — the
  viewer's per-mount instances die on unmount; the next open loads from disk.
- No boot-ordering hazard: `initial` flows in as a plain constructor argument
  at viewer mount.

### ViewerUrlSession (new)

`src/lib/shared/sequence-viewer/services/viewer-url-session.svelte.ts`

One instance per viewer mount, created by both entry points (the
`/sequence/[id]` page and `openSequenceOverlay`) **before** the orchestrator
constructs its stores.

```ts
interface ViewerUrlSession {
  /** Decoded slice payload from the inbound URL, or null. */
  getSeed(sliceId: SliceId): unknown | null;
  /** True when this slice arrived via URL AND differs from the user's own
   *  persisted state → construct the backing store view-only. */
  isOverride(sliceId: SliceId): boolean;
  /** Mounted surfaces register a live capture; deregister on destroy. */
  registerSlice(sliceId: SliceId, capture: () => unknown | null): () => void;
  /** Synchronous full capture (bypasses debounce). Used by Share/Copy Link. */
  captureNow(): ViewerUrlState;
  /** Param names this session may have written; for close cleanup. */
  ownedParams(): readonly string[];
}
```

Capture semantics: `captured = { ...urlSeed, ...liveCaptures }`. A slice whose
surface is not currently mounted (e.g. tunnel config while the 2D pane is
active) **passes through verbatim** — arriving state is never dropped just
because its pane isn't open at copy time.

### The own-link rule

A slice whose URL payload deep-equals the user's own persisted state seeds
normally (`persist: true`) — *your own link is not an override*. This closes
the reload trap: tweak → live sync writes the URL → reload → without this rule
the URL would seed a view-only instance of your own settings and post-reload
tweaks would silently stop persisting.

### Post Studio carve-out (deliberate product exception)

`viewer-state-persistence.ts` intentionally never restores `post-studio` from
localStorage ("opening a sequence should show the sequence, never drop you
into an editor"). That ban is about **stale local preferences**. A URL that
explicitly requests post-studio is **explicit intent** and IS honored. Do not
"fix" this back; the distinction is stale-pref vs. explicit link.

## URL Format

```
/sequence/EHWE?vm=split&fx=sparkles&bp=staff&bpm=92&dark=1&cols=4&s=d1:<deflate>
```

- **Identity:** `?v=` / route id remain sequence identity **only**. Visual
  state never bakes into the shortcode record (protects the shortcode dedup
  invariant and printed QR cards).
- **Headline params (readable, hand-editable):** existing `vm`, `view`, `bpm`,
  `bp`, `rp`, `dark`, `t` keep their names and behavior; new `fx` (active
  effect id), `cols` (choreo-card column count), `split` (`left,right` panes).
- **Blob `s`:** `{ sv: 1, fx: {...}, an: {...}, ex: {...}, t3: {...},
  cd: {...}, tn: {...}, ps: {...} }` through the existing `compressForURL`
  (`src/lib/shared/navigation/services/sequence-codec.ts:86`, fflate deflate +
  base64url — no new dependency). Verified: no existing consumer of a `?s=`
  param.
- **Non-defaults only.** Each slice's `capture()` returns `null` when at
  defaults and is omitted. A never-touched viewer produces today's short link.
- **Versioning & tolerance:** `sv` versions the envelope. Unknown slice ids
  are ignored. A slice that fails validation is dropped, never fatal —
  validation is each store's existing normalize path (e.g.
  `normalizeEffectsConfig`), not a parallel validator.

## Apply Path

1. Entry point parses the URL → constructs `ViewerUrlSession`.
2. Orchestrator/surfaces construct their stores:
   `create<X>State(session.getSeed(id) ?? undefined, { persist: !session.isOverride(id) })`.
3. Viewer mode: reuse the existing `initialViewerMode` →
   `viewerState.setViewerMode()` seam
   (`SequenceViewerOrchestrator.svelte:219`); `vm` already reaches the page
   (`SequenceViewerPage.svelte:137`). Extend, don't duplicate.

## Capture / Write Path

- Debounced (~400 ms) `mutateCurrentUrl` replaceState writes. Composes with
  the existing `?v=` writer (both merge into the live URL).
- `getShareUrl` / Share / Copy Link call `session.captureNow()` and build from
  the canonical route + fresh capture — never from the possibly-stale address
  bar. "The moment I copied" is literal.
- `closeSequenceOverlay` strips **all** `session.ownedParams()` (today it
  removes only `v` — `sequence-viewer-overlay-state.svelte.ts:177`), so the
  underlying module route never keeps stale viewer state.

## Slice Inventory

| Slice | Blob key / params | Backing state | Seam status |
| --- | --- | --- | --- |
| View + split | `vm`, `view`, `split` (headline) | `tka-viewer-mode`, `tka-viewer-split-config` | `initial*` props exist; plumb through session |
| Effects | `fx` headline + `fx` blob (preset + tuning) | `tka_effects_config` | **Done** — factory has `initial` + `persist` |
| Props | `bp`, `rp` (headline) | existing `parsePropsFromURL` | Exists; unchanged |
| Speed / time | `bpm`, `t` (headline) | existing params | Exists; unchanged |
| 2D anim settings | `an` | `tka_animation_settings`, `animation-visibility-settings`, `tka_trail_settings` | Factory exists; add `initial`/`persist` via `createPersistenceHelper` |
| Export options | `ex` | `tka_export_options` | Factory exists; add options |
| 3D viewer | `t3` | `tka-3d-animator-state`, `tka-viewer3d-environment`, `tka-scene-features`, `tka-3d-playback-state`, `tka-scene-audio-v1`, quality override | `createPlaybackState` already takes options; others need the seam |
| Card controls | `cd` + `cols` headline | `tka-image-composition-settings`, `columnCount` (viewer context) | Add seam |
| Tunnel | `tn` | `tka_tunnel_view_state` (+ presets referenced by id only) | load/persist functions → add factory-style seam |
| Post Studio | `ps` | PostStudio setup (already `persist:false` internally) | Add setup capture/apply |

Per-slice field inventories are implementation-phase discovery; each slice's
executor reads its store and encodes exactly the persisted shape (post-
normalize), never an invented parallel schema.

`createPersistenceHelper` (`src/lib/shared/state/utils/persistent-state.ts`,
7 consumers) gains optional `initial`/`persist` support once; stores built on
it inherit the seam.

## Never-Hand-Roll Evidence

- Searched: `mutateCurrentUrl`, `url-syncer`, `searchParams`, `STORAGE_KEY`,
  `persist`, `createPersistenceHelper`, `getShareUrl`, `initialViewerMode`.
- Owners found and reused: `url-state.ts` (URL writes), `sequence-codec.ts`
  (compression), effects-config factory pattern (view-only instances),
  `initial*` orchestrator props (viewer mode seed), existing params
  (`vm/view/bpm/bp/rp/dark/t`).
- Created: `ViewerUrlSession` + slice registry — genuinely new capability
  (full-state snapshot/restore across the URL boundary); no existing owner.
  Rejected alternative: localStorage shim (parallel implementation of the
  factory `persist:false` capability; restore-on-close bug; boot-order
  fragility).

## Testing

1. **Round-trip per slice:** `capture → encode → decode → apply → capture` is
   identity.
2. **Defaults are silent:** every slice returns `null` at defaults; a default
   session produces no `s` param and no new headline params.
3. **Zero-write guard:** applying a full-state link performs no localStorage
   writes (spy on `Storage.prototype.setItem`).
4. **Unmounted pass-through:** open link with tunnel state, stay in 2D,
   `captureNow()` still contains the tunnel payload verbatim.
5. **Own-link rule:** URL payload deep-equal to disk → store constructed
   `persist: true`.
6. **Close cleanup:** after `closeSequenceOverlay`, none of `ownedParams()`
   remain in the URL.
7. **captureNow synchrony:** a settings change followed immediately by
   `captureNow()` reflects the change (no debounce dependence).
8. **Tolerance:** unknown slice id and corrupt blob are ignored without
   breaking the viewer.

Live verification: full round-trip in the browser — set state, copy link, open
in a fresh profile/incognito context, confirm identical visuals; confirm
recipient's localStorage untouched.

## Out of Scope

- Minting server-side state records (state rides in the URL only).
- QR encoding of visual state (QR stays identity-only via `tka.run`).
- `/q` scan ingress (hands off to `/sequence`; gains nothing here).
- Cross-user preset sharing beyond what the blob carries.
