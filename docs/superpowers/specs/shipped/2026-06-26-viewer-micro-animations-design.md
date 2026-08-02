# Sequence Viewer — Viewer-Wide Micro-Animation Pass

**Date:** 2026-06-26
**Status:** Design — awaiting review
**Scope:** Full (scene transitions + micro-layer + showy extras), approach A (choreographed scene transitions)

## Goal

Every element that appears, disappears, or changes layout in the sequence viewer
and practice mode is **choreographed**, not snapped. The headline defect: entering
practice mode is a three-part instant snap (rail vanishes, header swaps, bar mounts
cold). Make it read as one directed scene change. Then apply a consistent
micro-animation layer across the viewer and a few deliberately playful "showy"
touches.

User directive: *"overdo it… every little layout chip deserves consideration of how
it can be intentional and choreographed."*

## Non-negotiable: reuse the existing animation system

This codebase already has a complete motion system. This pass adds **zero new
animation infrastructure** — it applies what exists. Anyone implementing must reach
for these, never hand-roll:

| Need | Reuse | Path |
|---|---|---|
| Durations / easings / staggers / slide distances | CSS tokens `--duration-*`, `--ease-*`, `--stagger-*`, `--slide-distance-*` | `src/app.css` (~264–302) |
| Opacity / directional / scale enter-exit | svelte `fade` / `slide` / `scale` | `svelte/transition` |
| Height/width collapse without the Svelte NaN bug | `safeSlide({ axis })` | `src/lib/shared/utils/transitions.ts` |
| Spring enter/exit for panels | `PresenceAnimation` + presets | `src/lib/shared/ui-animation/animations.svelte.ts`, `presets.ts` |
| Grid reorder | `safeFlip` | `src/lib/shared/sequence-viewer/components/CardGridLayout.svelte` |
| Looping / pulse / shimmer / pop keyframes | `keyframes.css` (already reduced-motion-gated) | `src/lib/shared/transitions/keyframes.css` |
| Reduced-motion JS guard | `shouldAnimate()` | `src/lib/shared/.../animator.ts` (pattern) |

Token defaults to standardize on: enter/exit of layout chunks = `--duration-normal`
(200ms) `--ease-out`; micro feedback = `--duration-fast` (150ms); celebratory/showy
overshoot = `--ease-spring`. Stagger between choreographed steps = `--stagger-normal`
(50ms).

## Principles

1. **Reduced motion is mandatory.** Every animation no-ops under
   `prefers-reduced-motion: reduce`. CSS keyframes already do; svelte transition
   directives must use reduced-motion-aware durations (0ms when reduced).
2. **No layout shift introduced.** Cross-fading text (titles, captions) uses the
   ghost-sizer / stacked-grid pattern (`no-layout-shift.md`) so width never jumps.
   Animation reserves space; it never causes a reflow that moves siblings.
3. **GPU-friendly.** Animate `transform` / `opacity` (and the already-transitioning
   `grid-template-columns`); avoid animating layout properties that thrash.
4. **One scene, staggered.** A mode change is a timeline, not N independent snaps.

---

## Bucket 1 — Scene transitions (the core fix)

All in `src/lib/shared/sequence-viewer/components/SequenceViewerDrawerHost.svelte`
unless noted.

### 1a. Enter/exit practice — the choreographed scene

Four moving parts today, each snapping:

- **Rail** (`:503` `{#if showRail && !ctx.practiceActive}` → `ViewerContentRail`).
  The grid (`.viewer-and-export.desktop.has-rail`, `:966`) uses
  `grid-template-columns: auto 1fr`; `auto` does not interpolate, so the existing
  250ms grid transition can't animate it — the rail just disappears.
  **Fix:** change the rail track from `auto` to a transitionable width
  (`var(--viewer-rail-width) 1fr`, with `--viewer-rail-width` measured/fixed to the
  rail's natural width) so the column width animates to `0` on the existing 250ms
  grid transition. Keep the rail element mounted through the collapse via a Svelte
  out-transition (`safeSlide`, `axis: 'x'`, + fade) so its content slides left and
  fades while the track closes. Mirror on enter (slide in from left as the track
  opens).
- **Header left-actions** (`:352` practice group vs normal group).
  **Fix:** wrap each branch so the outgoing set fades+slides out and the incoming
  set fades+slides in, keyed on `ctx.practiceActive`, staggered `--stagger-normal`
  after the rail begins collapsing. Stacked positioning so the swap introduces no
  width jump.
- **Header title** (`:452` "Sequence Viewer" ↔ "Practice Mode" ↔ export titles).
  **Fix:** crossfade via `{#key}` + `fade`, using the stacked-grid ghost-sizer so
  the title box is sized to the widest label and never reflows the centered group.
- **PracticeBar** (`:691` `{#if ctx.practiceActive}`).
  **Fix:** rises from the bottom — `fly`/`slide` `axis: 'y'` + fade,
  `--duration-normal` `--ease-out`, delayed one stagger so it lands after the rail
  has begun clearing. Exit reverses (drops + fades) before the rail returns.
- **Mobile bottom bar** (`:682` `ViewerModeBottomBar`).
  **Fix:** slide-down + fade on exit, slide-up + fade on enter (it and the
  PracticeBar occupy the same bottom region — sequence so one leaves as the other
  arrives, no overlap flash).

**Timeline (enter practice):** rail collapse + mobile-bar drop start at t=0 →
title/action crossfade at t≈+50ms → PracticeBar rises at t≈+100ms. Total ≈300ms.
**Exit:** reverse order (bar drops first, then rail expands, header crossfades back).

### 1b. Export panel content fade

The export sidebar column width already animates (`:941`, 250ms), but the panel
content inside (`.export-panel-container`, `:970`; `ExportVideoDrawer` /
`ExportImagePanel`) pops. **Fix:** fade the panel content in/out synced to the
column transition (fade `--duration-normal`), so interior content tracks the slide.

### 1c. Recording3D overlay

`Recording3DOverlay` mount (`:569`) snaps over the canvas. **Fix:** `scale`
(0.98→1) + `fade`, `--duration-fast`.

---

## Bucket 2 — Micro-layer (consistent across the viewer)

- **play ↔ pause icon morph.** Currently an instant `<i>` class swap in
  `PracticeBar.svelte` (`:71` area) and `HorizontalTransportRow.svelte` (`:60–68`).
  **Fix:** key the icon on `isPlaying` and crossfade/scale (~120ms) so the glyph
  swaps with motion. Shared treatment in both transport surfaces.
- **Popover entrances.** `PracticeConfigPopover.svelte` (bits-ui, `forceMount`,
  `:83`) appears with no entrance. **Fix:** drive a CSS scale(0.96→1)+fade off the
  bits-ui `data-state=open/closed`, `transform-origin` toward the trigger,
  `--duration-fast`. Match `ExportPopover`'s existing advanced-section slide feel.
- **Image load-in fade.** Pictograph cells (`ChoreoCard` / `CellRenderer`) and the
  QR code (`CardGridLayout.svelte` `:486`) swap image `src` instantly. **Fix:**
  fade image opacity 0→1 on `load` (~180ms). QR wrapper already scales; add the
  image fade so it doesn't pop inside the scale.
- **Press feedback consistency.** Ensure transport/step buttons that lack an
  `:active` state get `transform: scale(0.96)` on press (`HorizontalTransportRow`
  step buttons `:100–122` have hover but no active). Matches the `:active` scale
  already on PracticeBar buttons.

---

## Bucket 3 — Showy extras (deliberately playful, all reduced-motion gated)

- **Smooth-mode fill bar "breathing."** When progression mode is smooth, the fill
  bar (`PracticeBar.svelte` `:417`) gets a slow ambient glow pulse
  (`opacity 0.3↔0.6`, ~2.5s, `keyframes.css` `pulse-glow`) so it reads as "alive
  and climbing."
- **Faster-button celebration.** On a level-up (BPM crossing a level boundary), a
  one-shot celebratory pulse (scale + brightness) on the Faster button, reusing the
  existing bump pattern (`pb-bump`) rather than a new keyframe.
- **Active-cell depth.** The focused pictograph during playback
  (`PictographCell.svelte` `:140–166`, already scales+glows) gains an animated
  drop-shadow that slides in beneath it (~250ms) for a subtle 3D lift.
- **Caption crossfade.** PracticeBar caption (`:425`, reserved-width, currently
  snaps) crossfades on text change (`{#key}` + fade, ~100ms). Width already
  reserved, so no shift.
- **Fill-bar elastic settle.** On loop/round completion, the fill width uses
  `--ease-spring` for a brief elastic overshoot instead of linear ease.

---

## Out of scope

- Route-level View Transitions API morphs (snapshots the live WebGL subtree; risky
  to art-direct — revisit separately).
- Redesigning any component's layout or controls (this is motion-only).
- 3D scene / canvas-internal animation.
- The two uncommitted prop-context-intermingled files
  (`SequenceViewerOrchestrator` / `DrawerHost`) — DrawerHost is edited here for the
  scene transition; coordinate the commit per `commit-only-own-changes` (the
  practice hunks are mine, the prop-context removal is another agent's).

## Testing / verification

- `npm run check` green (one full pass at the commit gate).
- Visual proof via Chrome DevTools MCP (requires verbal permission): capture
  practice **enter** and **exit** on desktop + mobile widths; confirm rail
  slides (not snaps), header crossfades, bar rises, no layout jump on the title.
- `prefers-reduced-motion: reduce` emulation: confirm all of the above resolve
  instantly with no motion and no broken state.
- Per `verification-protocol.md`: no "should work" claims without capture in-message.

## Implementation order

1. Bucket 1a practice scene (headline) — rail track + 4-part timeline.
2. Bucket 1b/1c export + recording.
3. Bucket 2 micro-layer.
4. Bucket 3 showy extras.
5. Reduced-motion sweep + DevTools capture + `npm run check`.
