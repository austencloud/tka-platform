# QR Landing Page — Full-minus-3D Viewer

**Date:** 2026-06-01
**Status:** Active
**Route:** `/q/[code]` (`src/routes/q/[code]/+page.svelte`)

## Problem

The QR scan landing page (`/q/[code]`) today mounts only `AnimationPlayer` — a
bare 2D canvas with a custom control shell. The full sequence viewer
(`/sequence/[id]`) has far more: the 2D animation, the choreo card, the mandala
(with the undulation control), and the side-by-side split view, all with a
redesigned `ControlDock` control language. None of that reaches the people who
scan a card — in particular the **undulating mandala**, which we want to put in
front of users.

Goal: bring the full viewer experience **minus 3D** to `/q/[code]` while keeping
the page lightweight and chrome-free (the reason it breaks out of the root
layout). Panes in scope: 2D animation, choreo card, mandala, side-by-side. 3D is
explicitly excluded.

## Constraints

- **Lightweight.** The scan page must stay fast. The one real bundle lever is
  Three.js/Threlte, which `ViewerSplitPane` statically imports today (so it rides
  along in any chunk touching the split pane). That must become lazy.
- **Chrome-free.** `/q/+layout@.svelte` deliberately breaks out of the root
  layout to avoid `MainInterface` (nav/sidebar/footer), banners, background host,
  and auth overlays. Keep that breakout.
- **No 3D.** No 3D pane, no `RightRail` 3D toolbar, no Three.js in the QR bundle.
- **Reuse, don't duplicate.** The orchestrator already assembles the four context
  objects `ViewerSplitPane` consumes. Do not hand-roll a second copy
  (`never-hand-roll.md`).
- **No layout shift** on pane/control changes (`no-layout-shift.md`).

## Architecture — Approach A: reuse `SequenceViewerOrchestrator` wholesale

`/q/[code]` mounts `SequenceViewerOrchestrator` and supplies its own `children`
snippet — the exact contract `/sequence/[id]/+page.svelte` uses. The snippet
renders `ViewerSplitPane` (fed the orchestrator's assembled
`playback`/`imageComposition`/`propRendering`/`layout` via `OrchestratorContext`)
plus the QR-specific shell layered on top.

```
/q/[code]/+page.svelte
  └─ SequenceViewerOrchestrator (forceGuest, initialRenderMode='2d')
       children(ctx) =>
         ├─ ViewerSplitPane  (splitConfig: non-3D panes; renderMode '2d')
         │    ├─ AnimatorCanvas      (2D animation + relocated mobile transport)
         │    ├─ ChoreoCard          (card pane)
         │    └─ MandalaPane         (SequenceMandala + MandalaControlDock)
         ├─ ComparisonModeBar       (view switcher, non-3D modes only)
         ├─ ToastContainer          (so orchestrator toasts are visible)
         └─ QR shell                (share sheet, Open TKA CTA, ExportTakeover)
```

Why A over a slim hand-built host: the heavyweight cost is 3D (lazy in either
path); the orchestrator's auth/nav/lan/toast machinery is kilobyte-scale JS, and
`getSettings()`/factory getters are already proven safe on this route. A slim
host would duplicate the orchestrator's context assembly — drift risk, more code,
fights `never-hand-roll.md`.

## Work Item 1 — Lazy-load 3D out of `ViewerSplitPane` (shared change)

`ViewerSplitPane.svelte` statically imports `Viewer3DCanvas` (line 20),
`RightRail` (line 24), and `PerformerHub`. Convert these to dynamic
`{#await import()}` gated on 3D activation (`renderMode === '3d'` /
`splitConfig.*Pane === 'animation-3d'`). The persistent-canvas strategy that
keeps the 3D context alive after first activation stays; only the *import*
becomes lazy.

Precedent: the route's mobile fullscreen 3D is already lazy
(`{#await import("$lib/shared/3d/components/Viewer3DFullscreen.svelte")}`). This
extends the same pattern to the desktop split-pane 3D.

Effect:
- The QR bundle (and the main viewer's *initial* load) no longer ship Three.js
  until 3D is actually activated.
- The main viewer's desktop 3D gains a one-time load delay on first activation
  (acceptable, matches mobile fullscreen today).

**Regression gate:** the main viewer (`/sequence/[id]`) desktop 3D split and
3D-3D comparison must still work after this change. This is the highest-risk
edit because `ViewerSplitPane` is shared.

## Work Item 2 — Rewrite `/q/[code]/+page.svelte` shell

Replace the bare `AnimationPlayer` mount with the orchestrator + children
snippet. Keep the `@` layout breakout.

- **Mount:** `SequenceViewerOrchestrator` with `sequence={resolvedSeq}`,
  `isMobile`, `forceGuest={true}`, `initialRenderMode='2d'`,
  `onClose={() => goto('/browse/gallery?from=scan&code=' + shortCode)}`.
- **Pane set / view switcher:** drive `splitConfig` and reuse the existing
  `ComparisonModeBar`, filtered to **non-3D** comparison modes (animation, card,
  mandala, and the side-by-side combinations among those three). No
  `animation-3d` option appears.
- **Toasts:** mount one lightweight `ToastContainer` so orchestrator
  `showToast()` calls (e.g. share success) are visible. Without it they queue
  silently.
- **Layout:** preserve the existing responsive sidebar/bottom behavior the QR
  page already has (`isSidebarLayout`, `drawerLayout`). The mobile-portrait
  relocated transport bar shipped on 2026-06-01 lives inside `ViewerSplitPane`
  now and applies automatically.

## Work Item 3 — Control reconciliation (hybrid)

Evidence inventory of viewer vs QR-page affordances drove this split.

**Preserve (QR-only — the viewer doesn't surface these):**
- Native mobile share sheet (`shareOrDownloadBlob`) — viewer only has
  `navigator.share`/clipboard, no mobile blob download.
- "Open TKA" CTA (`secondaryAction`) — viewer has no user-facing "open app".
- The polished `ExportTakeover` overlay — more complete than the viewer's
  `ExportProgressOverlay`.
- Scan analytics (`captureEvent("card_scanned", …)`) and prop threading
  (`bluePropType`/`redPropType`).

**Adopt (viewer-only — the wins):**
- `MandalaPane` + `MandalaControlDock` — the undulation Speed slider (0.25–3×),
  plus Shape/Spin/Colors/Weight/Depth, and mandala export.
- `ChoreoCard` pane and its context menu.
- Side-by-side split + the per-pane `ControlDock` chrome.

**Dedupe:**
- Video export already uses the same `VideoExportOrchestrator` on both sides.
  Route the viewer's export through QR's existing `ExportTakeover` rather than
  mounting a second progress overlay.

## Bootstrap (resolved)

- `getSettings()` self-initializes from localStorage with `DEFAULT_SETTINGS`
  fallback — safe uninitialized.
- `forceGuest={true}` makes the orchestrator skip auth reads
  (`isLoggedIn: false`); no auth listener required.
- Factory getters (`getAnimationPlaybackController`, `getVideoExportOrchestrator`,
  glyph cache) self-resolve without root bootstrap — already proven on this route
  (`no-DI-container` rule: DI dissolved, factory getters are the pattern).
- LAN sync is initialized lazily inside `orchestrator.loadServices()` and no
  LAN-sync UI is exposed on the scan page.
- One `ToastContainer` is the only host the QR route must add.

No root-layout bootstrap is reintroduced; the chrome-free breakout is preserved.

## Out of scope

- Any 3D pane / 3D controls on the QR page.
- Auth-gated actions (sign-in to save, library actions) — `forceGuest` suppresses
  them.
- Persisting "set as intended" prop (viewer owner-only feature).
- Changing the main `/sequence/[id]` route beyond the shared 3D-lazy-load.

## Risks

1. **Shared `ViewerSplitPane` edit (Work Item 1).** Main viewer 3D must be
   regression-verified. Mitigation: gate strictly on 3D activation, keep the
   persistent-canvas state machine intact, test desktop 3D split before claiming
   done.
2. **Scan-page load weight.** The orchestrator mounts more state than the current
   QR page. Mitigation: measure `/q/[code]` bundle + load before/after; the 3D
   lazy-load should net-reduce it.
3. **`ComparisonModeBar` location.** Pin whether it lives in `ViewerSplitPane`
   or the route during planning; filter its option set to non-3D.
4. **Double export overlay.** Ensure only `ExportTakeover` renders, not the
   viewer's `ExportProgressOverlay`, on the QR page.

## Verification

- `npm run check` clean on all touched files.
- `npm run build` succeeds; compare `/q/[code]` chunk weight before/after (expect
  Three.js no longer eagerly in the path).
- Runtime: `/q/[code]` on a narrow/portrait viewport — switch through animation /
  card / mandala / side-by-side; confirm undulation slider works; confirm 3D
  never loads (no Three.js network request); confirm share sheet + Open TKA CTA +
  ExportTakeover still function.
- Regression: `/sequence/[id]` desktop 3D split still renders.

## Related

- `2026-05-24-qr-live-animation-design.md` — the current QR page.
- `2026-05-28-viewer-comparison-modes-design.md`,
  `2026-05-28-viewer-mobile-switcher-design.md` — comparison-mode + switcher.
- `2026-05-24-mandala-viewer-design.md`,
  `2026-05-25-mandala-module-design.md` — mandala pane + control dock.
- `2026-05-13-left-rail-2d-3d-split-design.md` — split-pane architecture.
- `2026-05-25-card-scan-attribution-pipeline-design.md` — scan analytics.
- Rules: `never-hand-roll.md`, `fast-iteration-loop.md`, `no-layout-shift.md`,
  `no-di-container` memory.
