# Mobile 3D Scene Controls — Design

**Date:** 2026-06-22
**Status:** Approved (direction); awaiting on-device validation
**Target device:** iPhone SE (375×667 CSS px) — tightest real viewport

## Problem

The 3D sequence viewer scatters ~5 control surfaces over the scene:

- `RightRail` (top-right): Formation, Camera, Export, Scene, +Dev — 5 popovers
- `PerformerHub` / `PerformerSpine` (bottom-left): performer chip column + 6-tab
  detail slide-out (Avatar, Sequence, Prop, Planes, Effort, FX)
- `UnifiedTimeline` (bottom): play/pause, scrub, speed, step
- App top chrome + bottom nav surrounding the viewer

On a 375px-wide phone these collide with each other and with the scene, leaving
almost no room to actually see the 3D animation. Desktop is fine; mobile is not.

## Goal

On phone-class viewports, consolidate every scene control behind **two
thumb-corner menus**, add a **playback-bar show/hide toggle**, and add a
**fullscreen/immersive button** that reclaims the whole screen. Desktop layout
unchanged.

## Decisions (locked with Austen 2026-06-22)

1. **Container = bottom sheets**, two FABs in the bottom corners. Not corner
   popovers (a 300–340px popover ~spans a 375px screen and collides), not a
   single combined menu (buries the most-touched control — performer selection —
   one tab deeper).
2. **Fullscreen = hybrid, feature-detected.** Native Fullscreen API where
   supported; CSS-immersive fallback on iPhone Safari.
3. **Validation = a real test route**, opened on Austen's actual iPhone SE,
   before any of this touches the production viewer.

## Primitive discovery (never-hand-roll evidence)

| Need | Searched | Result | Decision |
|---|---|---|---|
| Bottom sheet | grep `BottomSheet`, `Sheet`, `Drawer`, `bottom-sheet` in `src/lib/shared`, viewer dirs | No bottom-sheet primitive. `SequenceViewerDrawerHost` is a layout host, not a reusable sheet. Pattern in use is `bits-ui` `Popover` (`ViewerPopover.svelte`). | **Create** `BottomSheet.svelte` extending `bits-ui` Popover (`side="bottom"`, drag-to-dismiss). Reusable app-wide. |
| FAB trigger | `ViewerPopover.svelte` `.rail-chip` (56px glass button) | Exists. | **Reuse** the `.rail-chip` visual language for the two FABs. |
| Fullscreen control | Read `fullscreen-controller.svelte.ts` | Exists; CSS-overlay only, **no** `requestFullscreen()` call. | **Extend** controller: add native API call + app-chrome collapse. |
| Playback hide | `UnifiedTimeline` props `hideProgressBar`, `hideHeader`, `tapToToggle` (used at `ViewerSplitPane.svelte:498`) | Already supports hiding. | **Reuse** via a toggle handle; no new transport code. |
| Mobile gating | `layout.isMobile` (`ViewerSplitPane:208`), `matchMedia("(pointer: coarse)")` (`ExportImagePanel:159`), `isMobileWidth = innerWidth < 768` (`SequenceViewerDrawerHost:82`) | Established. | **Reuse** existing mobile/coarse detection. |
| Mobile test route | `src/routes/test/mandala-mobile/` | Precedent exists. | **Follow** the pattern for `/test/mobile-3d-controls`. |

## Fullscreen — verified constraint

Web-verified 2026-06-22: **iPhone Safari does not support the Fullscreen API on
non-video elements**, and Apple has no announced plans to add it. iPadOS and
desktop support it (webkit-prefixed). Sources: Apple Developer Forums thread
133248, caniuse.com/fullscreen, magicbell PWA-iOS-2026 guide.

Implication: a native-only fullscreen button would silently no-op on the exact
device this redesign targets. Therefore:

```
if (element.requestFullscreen || element.webkitRequestFullscreen) {
  // iPad, desktop, Android Chrome → true OS fullscreen (URL bar gone)
  requestFullscreen()
} else {
  // iPhone Safari → CSS-immersive: collapse app top chrome + bottom nav +
  // viewer overlay so the scene fills the viewport (minus Safari's own URL bar,
  // which iOS will not release). Reuses the FullscreenController CSS path.
}
```

One button, one mental model; mechanism selected per device. CSS-immersive is the
maximum achievable on SE.

## Architecture

All new mobile UI is gated behind the existing mobile/coarse-pointer detection.
Desktop renders `RightRail` + `PerformerHub` exactly as today — zero desktop diff.

### Components

**`BottomSheet.svelte`** (new shared primitive — `src/lib/shared/.../controls/`)
- Wraps `bits-ui` `Popover` with `side="bottom"`, full-width content, rounded top
  corners, a grab handle, drag-down-to-dismiss, and backdrop scrim.
- Props: `open` (bindable), `title`, `children` snippet, optional `footer`.
- One clear purpose: present a panel anchored to the bottom edge. Testable in
  isolation; no viewer coupling.

**`MobileSceneControls.svelte`** (new — viewer-scoped, mobile only)
- Renders the two corner FABs + their sheets. Mounted by the viewer alongside
  (and mutually exclusive with) `RightRail`/`PerformerHub`.
- **Left FAB** (person icon) → Performer `BottomSheet`: hosts `PerformerSpine`
  chip column + the 6 `PerformerHubDetail` tabs, reflowed to full sheet width.
- **Right FAB** (sliders icon) → Scene `BottomSheet`: hosts Formation / Camera /
  Export / Scene (+ Dev if `authState.isAdmin`) as a section list or tab row,
  reusing the existing `*Popover` body components (`FormationPopover`,
  `CameraPopover`, `ExportPopover`, `SceneSelectorPopover`, `DevToolsPopover`).
- Reuses the `viewer-3d-context` already in scope — no new state for menu
  contents; only local `$state` for which sheet is open.

**Playback toggle**
- A small chevron handle at the bottom edge that shows/hides `UnifiedTimeline`
  via its existing `hideProgressBar`/`hideHeader` props. Local `$state` boolean,
  default shown. When hidden, the scene reclaims the band.

**Fullscreen button + `FullscreenController` extension**
- Add `requestNativeFullscreen()` / `exitNativeFullscreen()` with feature
  detection to `fullscreen-controller.svelte.ts`; on unsupported devices fall
  through to the existing CSS-overlay state plus a new `appChromeCollapsed` flag
  the app shell reads to hide top chrome + bottom nav.
- Button lives in the viewer overlay (mobile) and reuses the existing
  tap-to-reveal + 3s auto-hide pattern already in the controller.

### Data flow

```
viewer-3d-context (existing)
   │
   ├── MobileSceneControls (mobile only)
   │     ├── left FAB  → BottomSheet → PerformerSpine + PerformerHubDetail
   │     └── right FAB → BottomSheet → Formation/Camera/Export/Scene/Dev bodies
   │
   ├── UnifiedTimeline ──(hideProgressBar)── playback toggle (local $state)
   │
   └── FullscreenController (extended)
         ├── native API path  (iPad/desktop/Android)
         └── CSS-immersive path + appChromeCollapsed (iPhone Safari)
```

### Mounting seam

`MobileSceneControls` is rendered where `RightRail`/`PerformerHub` are today
(`ViewerSplitPane` / `Viewer3DCanvas` overlay), switched by the existing
`layout.isMobile` (or a coarse-pointer derivation). Exact swap point pinned in
the implementation plan.

## Validation harness

`src/routes/test/mobile-3d-controls/+page.svelte` (following
`/test/mandala-mobile`):

- Mounts the **real** 3D viewer with a seeded multi-performer sequence.
- Forces the mobile control layout regardless of viewport width (so it's
  testable on desktop dev too) — the real `MobileSceneControls`, real
  `BottomSheet`, real performer/scene bodies.
- Austen opens it on his iPhone SE to judge thumb reach, sheet feel, and scene
  real estate before merge. Link will be `http://localhost:5173/test/mobile-3d-controls`.

No emoji mockups, no hand-rolled fakes — real components per `visualization-routing.md`.

## Error handling

- `requestFullscreen()` rejects (user gesture / permissions) → catch, fall back
  to CSS-immersive, announce via the controller's existing a11y `announce`.
- Escape / native `fullscreenchange` exit → sync controller `isFullscreen` back.
- Sheet open while the other is open → opening one closes the other (single
  active sheet), mirroring the existing `activePopover` single-open invariant.

## Out of scope

- Desktop redesign (untouched).
- New transport/playback logic (reuse `UnifiedTimeline`).
- New scene/formation/camera/export panel bodies (reuse existing `*Popover`
  body components verbatim inside the sheet).

## Open items for the plan

- Pin the exact mount swap point (`ViewerSplitPane` vs `Viewer3DCanvas`).
- Decide sheet content layout for the right sheet: vertical section list vs a
  top tab row (decide on-device during validation).
- Confirm `appChromeCollapsed` read point in the app shell (header + bottom nav
  components).
