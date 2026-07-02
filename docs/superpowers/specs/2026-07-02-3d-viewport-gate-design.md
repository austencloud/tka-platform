# 3D Viewport Gate — Design

**Date:** 2026-07-02
**Status:** Approved ("go nuts") — implementing this session
**Supersedes direction of:** `2026-06-22-mobile-3d-scene-controls-design.md` (that spec bet on cramming 3D controls onto phones; this one withholds 3D from phones entirely until a mobile-native design ships)

## Problem

The 3D sequence viewer is not mobile-friendly. On a phone the scene controls, playback bar, and app chrome collide and leave no room to see the animation (documented at length in the 2026-06-22 spec). Rather than ship a half-designed phone 3D experience, gate 3D by available screen real estate: phones don't get it; large screens, unfolded foldables (e.g. Z Fold 6 unfolded), tablets, and desktop do. Bring phone 3D back when it's actually designed.

Today the only gate on 3D is **WebGL2 capability** (`viewer-modes.ts` `requiresWebgl2`, `viewer-3d-state` `webgl2Available`). There is zero screen-size gating — the 3D cube appears in both the mobile bottom bar and the desktop rail regardless of size.

## Decisions (locked)

- **Threshold metric:** the **shorter viewport side** (`min(width, height)` in CSS px). Orientation-proof. A width-only rule fails: iPhone 15 Pro Max landscape is ~932px wide — **wider** than a Z Fold 6 unfolded (~800–850px) — so "width ≥ X" would let iPhones in and could shut foldables out.
- **Threshold value:** **600px** (`MIN_3D_VIEWPORT_PX`). The repo's own recorded Z Fold 6 unfolded dimensions (`device-constants.ts:76-79`) are **width 800–850 × height 680–750** — its short side drops to **680**. A 700px threshold (my first proposal) would wrongly exclude the exact device the user named. 600 sits safely **above** every phone's short side (~450 max — iPhone 15 Pro Max landscape 932×430) and **below** the Z Fold 6's 680. Tablets (iPad short side ≥744) clear it easily.
- **Too-small UX:** **silently omit + live re-eval + auto-downgrade.** The 3D cube simply isn't in the switcher on phones. It reappears the instant the screen grows/unfolds past threshold. If you're in 3D and the viewport shrinks below threshold (fold the Z Fold), the view auto-downgrades to 2D. The user's 3D **preference is preserved** (not overwritten) — unfolding restores it.
- **Scope:** every 3D entry door — mode switcher (rail + bottom bar), programmatic entry, the 2D-canvas corner icon, and the canvas context-menu item.

## Architecture

### 1. The gate primitive — `src/lib/shared/3d/capabilities/viewport-3d-gate.svelte.ts`

Colocated with `webgl-capabilities.ts` (`isWebGL2Available()`) — both answer "can this environment host 3D."

- **`fits3DViewport(w, h): boolean`** — pure: `Math.min(w, h) >= MIN_3D_VIEWPORT_PX`. The unit-tested core.
- **`fits3DViewportNow(): boolean`** — imperative snapshot from `window.innerWidth/innerHeight` (SSR-guarded → `true`). For init-time coercion and transient menus.
- **`viewportFits3D(): boolean`** — reactive, backed by Svelte 5 `MediaQuery` (`svelte/reactivity`, verified in 5.49.2). Query `(min-width: 600px) and (min-height: 600px)` is exactly `min(w,h) ≥ 600`. `MediaQuery` re-evaluates on resize/fold/rotate on its own — that IS the "live re-eval," no listeners to hand-write. Lazy-instantiated behind a `typeof window` guard because `MediaQuery`'s constructor calls `window.matchMedia` (would crash SSR at module load). SSR fallback: `true` (assume capable; corrects on hydrate).

`MIN_3D_VIEWPORT_PX = 600` lives in `device-constants.ts` next to `BREAKPOINTS`.

### 2. Switcher filtering — `viewer-modes.ts`

- Add `requiresLargeViewport?: boolean` to `ViewerModeOption`; set it on `animation-3d` (mirrors `requiresWebgl2`).
- Extend `viewerModeOptions(webgl2Available, viewportFits3D = true)` to drop `requiresLargeViewport` options when the gate is closed.
- Add pure coercion helpers (unit-tested): `coerce3DContent(c, fits)` (`'animation-3d'→'animation'` when `!fits`) and `coerce3DSplit(cfg, fits)`.
- `ViewerModeBottomBar.svelte` + `ViewerContentRail.svelte` read `viewportFits3D()` directly (leaf components, no prop-drilling) and pass it to `viewerModeOptions`. The `$derived` read makes the cube appear/disappear live on resize.

### 3. Effective-mode coercion (rendering) — `viewer-state.svelte.ts`

The single lever. `SequenceViewerDrawerHost.svelte:609-615` builds the split pane purely from `viewerState.viewerMode` + `viewerState.splitConfig`. Coerce **the getters** when `!viewportFits3D()`:

- `get viewerMode()` → `coerce3DContent` (single `animation-3d` → `animation`).
- `get splitConfig()` → `coerce3DSplit` (any 3D pane → 2D).

This makes every downstream path — desktop split pane, `ViewerSplitPane` `needs3D` (so Three.js never lazy-loads), switcher `activeMode` highlight, `focusedPane` — render 2D consistently. Critically, `wants3D` stays derived from the **raw** closure `$state` vars, and persistence writes stay raw — so the preference survives and the view re-enters 3D automatically on unfold. Mirrors the existing non-mutating fallback in `splitConfigToMode`.

### 4. Engine / renderMode / mobile-overlay auto-downgrade — `SequenceViewerOrchestrator.svelte:525-539`

AND `viewportFits3D()` into `shouldBe3D`. `renderMode` is a separate persisted value in `viewer-3d-state.svelte.ts` driven by `enter3D`/`exit3D`; this one guard therefore covers: the engine, `ctx.renderMode` (→ the mobile `Viewer3DFullscreen` overlay condition at `sequence/[id]/+page.svelte:601`), and all `renderMode === '3d'` UI. When `viewportFits3D()` flips false mid-3D, `shouldBe3D` goes false with `is3D` true → `exit3D()` → 2D. On unfold, `wants3D` (raw) is still true → re-enter.

### 5. Init flash guard — `viewer-3d-state.svelte.ts:280`

`_persistedMode` restores `renderMode` from localStorage synchronously. On a phone with a persisted `'3d'`, that would briefly mount the mobile overlay before the orchestrator corrects it. Coerce: `const _persistedMode = (_webgl2Available && fits3DViewportNow()) ? loadPersistedMode() : "2d";`. Non-mutating — storage keeps `'3d'`, so unfold restores.

### 6. Extra doors

- `Viewer3DCornerIcon.svelte:30` — add `&& viewportFits3D()` to the render condition.
- `canvas-context-menu-builder.ts:399` — gate the "Enter/Exit 3D View" item behind `fits3DViewportNow()` (imperative; the menu is built transiently on right-click).
- `sequence/[id]/+page.svelte:601` — add `&& viewportFits3D()` to the mobile overlay `{#if}` (belt-and-suspenders + auto-close on shrink).

## Testing

Pure-function unit tests (vitest) — the silent-bug core:

- `fits3DViewport`: iPhone SE 375×667 → false; iPhone 15 Pro Max landscape 932×430 → false (the width-only trap); Z Fold 6 unfolded worst-case 800×680 → true; Z Fold 6 folded 384×832 → false; iPad 768×1024 → true; desktop 1920×1080 → true; exact boundary 600×600 → true, 599×600 → false.
- `coerce3DContent` / `coerce3DSplit`: `animation-3d`→`animation` when `!fits`; untouched when `fits`; non-3D content untouched either way.
- `viewerModeOptions`: `animation-3d` present when `(webgl2 && fits)`, absent when `!fits`, absent when `!webgl2`.

Non-goals for tests: the reactive `MediaQuery` wrapper and the Svelte getters (thin framework glue; the logic they call is covered above).

## Non-goals

- Museum 3D (separate system — `Environment3D` museum path untouched).
- WebGL2 detection (unchanged; stacks with this gate).
- The shelved 2026-06-22 mobile-3D-controls build (this supersedes its direction).
- `ComparisonModeBar.svelte` is currently **orphaned** (imported nowhere in `src`); when it's rewired, pass a gate-filtered `allowed` list. The only live 3D-split risk is a persisted config, already handled by §3.

## Files

| File | Change |
|---|---|
| `src/lib/shared/device/domain/constants/device-constants.ts` | add `MIN_3D_VIEWPORT_PX = 600` |
| `src/lib/shared/3d/capabilities/viewport-3d-gate.svelte.ts` | **new** — pure + reactive gate |
| `src/lib/shared/3d/capabilities/viewport-3d-gate.test.ts` | **new** — `fits3DViewport` tests |
| `src/lib/shared/sequence-viewer/services/viewer-modes.ts` | `requiresLargeViewport`, extended filter, coercion helpers |
| `src/lib/shared/sequence-viewer/services/viewer-modes.test.ts` | **new** — filter + coercion tests |
| `src/lib/shared/sequence-viewer/components/ViewerModeBottomBar.svelte` | read gate → `viewerModeOptions` |
| `src/lib/shared/sequence-viewer/components/ViewerContentRail.svelte` | read gate → `viewerModeOptions` |
| `src/lib/shared/sequence-viewer/state/viewer-state.svelte.ts` | coerce `viewerMode`/`splitConfig` getters |
| `src/lib/shared/sequence-viewer/components/SequenceViewerOrchestrator.svelte` | AND gate into `shouldBe3D` |
| `src/lib/shared/3d/state/viewer-3d-state.svelte.ts` | coerce persisted `renderMode` at init |
| `src/lib/shared/3d/components/Viewer3DCornerIcon.svelte` | gate render condition |
| `src/lib/shared/animation-engine/components/canvas-context-menu/canvas-context-menu-builder.ts` | gate 3D menu item |
| `src/routes/sequence/[id]/+page.svelte` | gate mobile overlay `{#if}` |
