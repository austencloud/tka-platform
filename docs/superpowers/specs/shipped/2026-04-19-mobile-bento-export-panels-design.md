---
status: shipped
value: 3
effort: S
remaining: ""
depends_on: ""
plan_path: plans/backlog/2026-04-19-mobile-bento-export-panels.md
tags: []
last_triaged: 2026-05-04
---
# Mobile Bento Export Panels Design

**Date:** 2026-04-19
**Files touched:** `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`, `src/lib/shared/sequence-viewer/components/ExportImagePanel.svelte`
**Brainstorm artifacts:** `.superpowers/brainstorm/486540-1776590329/content/bento-refined-v1…v5*.html`

## Problem

The mobile branches of both `ExportVideoDrawer` (Download Animation) and `ExportImagePanel` (Download Card) render their settings as a slide-up sheet that sits over the canvas/card preview. The sheet was a near-carbon-copy of the desktop sidebar: vertical stack of labeled rows, chip groups, steppers. On a 393×709 phone the sheet ends up covering most of the animation and still feels crowded, while the preview is invisible during tuning. Users reported the current layout as "beefed pretty bad" — visually busy, canvas-blocking, and inconsistent with the tactile rail-chip buttons already floating on the canvas.

## Goals

- Mobile export settings live in a **bento** under the preview. Canvas/card stays visible at all times.
- Every tile uses the existing **`.rail-chip`** visual language (glass background, backdrop blur, 14px radius, blue-tint active state) so the experience matches the 2D/3D toggle and other floating chips in the viewer.
- Symmetric rhythm between the two panels: users learn one layout and it transfers.
- Complex categories open a focused sub-sheet. Simple toggles and small controls stay inline. Never more than one layer of depth.

## Non-goals

- Desktop sidebar layout is untouched.
- 3D "Record Scene" variant uses the same structure as 2D with an extra Quality chip set in Export — no dedicated redesign.
- Per-effort parameter sliders (Weight, Time, Amplitude, etc.) are out of scope for mobile. Effort tile only surfaces preset selection; advanced tuning stays on desktop.
- Animation Settings Modal (a separate surface reached from the canvas context menu) is unchanged.

## Visual language

All tiles and sheets reuse the `.rail-chip` primitive from `RenderModeToggle.svelte` / `RightRail.svelte`:

```css
background: rgba(20, 22, 32, 0.78);
backdrop-filter: blur(20px) saturate(140%);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 14px;
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
```

**Active state** matches `.rail-chip[aria-pressed="true"]`:

```css
background: color-mix(in srgb, #4a9eff 18%, rgba(20,22,32,0.78));
border-color: color-mix(in srgb, #4a9eff 50%, transparent);
color: #8fc3ff;
box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
```

Transition: `all 180ms cubic-bezier(0.2, 0, 0.13, 1.5)`. The primitive itself (not a copy of the CSS) should be extracted to a shared class so future chips stay in sync.

## Download Animation panel

### Layout

Below the canvas, the bento zone contains:

- **Primary 2×2 grid** of four rail tiles: `Effects`, `Effort`, `Playback`, `Export`.
- **Full-width download button** (primary accent gradient) below the grid.

Each primary tile opens a sub-sheet when tapped. Tile goes to active-blue while its sheet is open. Tap the `✕` or outside the sheet to close. Only one sub-sheet open at a time.

### Sub-sheet: Effects

Delegate to the existing `EffectsPanel` component (`src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`). It already renders the 9-effect chip grid and per-effect customize sections. The sub-sheet wraps it with the sheet header + close button.

The Effects tile's count dot shows how many tip effects are currently assigned via `getAnimationVisibilityManager().getTipEffectMap()`.

### Sub-sheet: Effort

Eight mutually-exclusive preset buttons in a 4×2 grid, driven by `EFFORTS` from `src/lib/features/effort-lab/domain/effort-types.ts` and the existing `EffortCategory.svelte` component. Each button shows effort label + subtitle (e.g. "Glide" / "light · sustained"). Active button uses the effort's `color` as border/background tint.

The tile itself displays the current effort's label and glows in the effort color. No param sliders.

### Sub-sheet: Playback

Three sections:

1. **Tempo** — `<TempoControl bpm={bpm} onBpmChange={…} showPresets={false} showPractice={false} presetsMode="popover" />`. Same config `EffectsPanel` already uses (see `EffectsPanel.svelte:208`). This gives users hold-to-accelerate `±` buttons, tap-tempo on the number, and a popover with numeric presets — no reinvention.
2. **Mode** — two full-width chips: `Continuous` / `Step`. Drives `onPlaybackModeChange`. Matches `PlaybackMode = "continuous" | "step"` from `animation-panel-state.svelte.ts`.
3. **Timing** — two chips: `Start Hold` / `End Hold`. Drives `exportOptions.setVideoIncludeStartPosition` / `setVideoIncludeEndHold`.

### Sub-sheet: Export

Three sections:

1. **Frame rate** — chips: `30` / `60`. 120 fps is dropped for animations.
2. **Resolution** — chips: `720p` / `1080p`. 4K and 8K are dropped for animations.
3. **Quality** (3D only, guarded by `renderMode === "3d"`) — chips: `Standard` / `Cinema`.
4. **Loops** — `− [1×] +` stepper. Moved here from Playback (Loops is an export-time parameter, not a playback parameter).

### Download button

The full-width tile stays outside the sub-sheet system so export is always one tap away. Uses existing `onExport` prop and `exportDisabled` derived state. Progress and cancel UI in the existing `isExporting` branch is preserved.

## Download Card panel

### Layout

Below the card preview:

- **Primary 1×3 row** of three rail tiles: `Content`, `Columns`, `Theme`.
- **Full-width Download Card button** below.

### Content tile

Opens a sub-sheet with four sections, all driven by the existing visibility managers:

1. **Header** — chips: `Word` / `Level` / `LOOP`. Via `imageComposition.setAddWord`, `setAddDifficultyLevel`, `setShowLoopGlyph`.
2. **Footer** — chips: `Name` / `Notes` / `Date`. Via `imageComposition.setShowCreatorName`, `setShowNotes`, `setShowBirthday`.
3. **Pictograph** — chips: `Grid` / `TKA` / `VTG` / `Positions` / `Non-radial`. Via `vm.setGridVisibility`, `vm.setGlyphVisibility`, `vm.setNonRadialVisibility`. VTG and elemental glyphs still move together (existing `toggleVtg` logic).
4. **Extras** — chips: `QR` / `Mandala`. Via `imageComposition.setShowQRCode`, `setShowMandala`.

The Content tile's count dot shows `<on>/<total>` across all four sections so users can see at a glance how many visibility items are on without opening the sheet.

### Columns tile (inline)

Inline `− [Auto | 2–8] +` stepper. Cycles through `allColumnOptions` filtered by `beatCount`, starting from `Auto`. No sub-sheet. Value reads via `exportOptions.imageColumnCount`, writes via `exportOptions.setImageColumnCount`.

### Theme tile (inline)

Inline split-pill: `☀ Light` / `☾ Dark`. Two halves of one tile, active half uses the rail-chip active tint. Writes via `exportOptions.setImageDarkMode`.

## Interaction model

- **Tap a primary tile** → sub-sheet slides up from the bottom of the canvas area, the tile goes to active-blue. Transition: `fly` with `y: 120, duration: 280, easing: cubicOut` (matches existing mobile sheet).
- **Tap ✕ or outside the sheet** → sheet slides down, tile returns to resting. Backdrop behind the sheet catches outside taps.
- **Only one sub-sheet at a time.** Opening a second tile closes the first.
- **Sheet size:** max `72%` of the viewport height. Content overflow scrolls inside the sheet (`overscroll-behavior: contain` on the sheet root).

Canvas is never fully covered. With the 72% cap, at least ~28% of the canvas area remains visible above the sheet — enough to see the beat the user is tuning. Primary tiles and download button stay below the sheet (always visible).

## Components to reuse

Existing, no changes:

- `TempoControl` — `src/lib/shared/sequence-viewer/components/TempoControl.svelte`
- `EffectsPanel` — `src/lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte`
- `EffortCategory` — `src/lib/shared/animation-engine/components/animation-settings-modal/categories/EffortCategory.svelte`
- `EFFORTS` descriptor + `EffortId` type — `src/lib/features/effort-lab/domain/effort-types.ts`
- `PlaybackModeToggle` — `src/lib/features/compose/components/controls/PlaybackModeToggle.svelte` (Continuous/Step)
- `getAnimationVisibilityManager()` — tip effects, effort preset, BPM
- `getImageCompositionManager()` — card composition visibility
- `getVisibilityStateManager()` — pictograph visibility
- `ExportOptionsStateManager` — FPS, resolution, loops, columns, dark mode

New shared pieces (small, co-located with the two panels):

- A single shared CSS block for the rail-tile primitive used by both panels. Extracted rather than duplicated.
- A `RailBentoSheet.svelte` component that wraps the sub-sheet chrome (backdrop, header bar, close button, slide-up transition) and takes a snippet for its body. Keeps both panels from duplicating the sheet frame. Placed alongside the export panels in `src/lib/shared/sequence-viewer/components/bento/`.

## State and event flow

No changes to state. All the writes go through the existing managers. Props in both panels are unchanged — only the `layout === "bottom"` branch is rewritten. Desktop `sidebar` branch is preserved as-is.

Count dots are computed locally from existing state:

- **Effects count** — `vm.getTipEffectMap()` unique non-none count.
- **Content count** — sum of `on` flags across Header / Footer / Pictograph / Extras, vs total slot count.

## File-level changes

### `ExportVideoDrawer.svelte`

- Keep `layout === "sidebar"` branch untouched.
- Rewrite `layout === "bottom"` branch: primary 2×2 grid, download button, one `RailBentoSheet` instance per open tile (controlled by a `openSheet: null | "effects" | "effort" | "playback" | "export"` state).
- Remove the current `settingsOpen` boolean — superseded by `openSheet`.
- Delete the inline `setting-row` / `chip` / `loop-count` CSS blocks that only served the mobile sheet; keep what's shared with desktop.

### `ExportImagePanel.svelte`

- Keep `layout === "sidebar"` branch untouched.
- Rewrite `layout === "bottom"` branch: primary 1×3 row (Content / Columns / Theme) + download button.
- Content opens a `RailBentoSheet`; Columns uses an inline stepper; Theme uses an inline split-pill.
- Delete the mobile-only `inline-settings` / stacked `setting-row` blocks.

### New files

- `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte` — sheet chrome.
- `src/lib/shared/sequence-viewer/components/bento/rail-tile.css` — shared tile styling, imported by both panels.

## Testing

- Visual check at 393×709 and 360×640 in Chrome DevTools device emulation. Canvas must remain ≥ 28% visible when any sheet is open.
- Tap each primary tile, verify sub-sheet opens and active-state glow appears.
- Verify `TempoControl` tap-tempo and hold-to-accelerate still work inside the Playback sheet.
- Verify Columns stepper cycles through `Auto → 2 → 3 → … → beatCount` and clamps correctly.
- Verify Theme split-pill switches `imageDarkMode` and the card preview theme follows.
- Verify Effects sub-sheet still drives `AnimationVisibilityManager` correctly (no regression in tip-effect assignment).
- Verify 3D mode shows the Quality chips in Export sub-sheet, 2D mode hides them.

## Rollout

Single PR. Desktop untouched, so no risk to that surface. Mobile branches are the only changes, guarded behind the existing `layout === "bottom"` conditional — no feature flag needed. Manual QA on real device before merge.
