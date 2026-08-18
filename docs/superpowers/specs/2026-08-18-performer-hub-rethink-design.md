# Performer Hub Rethink — Design

**Date:** 2026-08-18
**Status:** Approved (brainstormed with Austen 2026-08-17/18)
**Surface:** the 3D viewer's performer dock (`src/lib/shared/3d/components/controls/`)

## Problem

The performer hub grew tab-by-tab and it shows:

- The sequence word renders as raw text (`{sequenceWord}` spans) — wrong font,
  repeats uncollapsed (`X-BΦ-Θ-X-BΦ-Θ-X-BΦ-Θ-X-BΦ-Θ-`), violating both the TKA
  glyph rule and `simplified-word-display.md`.
- The prop tab's layout (2-column grid of categories, each with its own
  `auto-fit` row) strands dead space wherever category sizes mismatch.
- The panel caps at 720px (`clamp(520px, 34vw, 720px)`) and expands vertically
  first — backwards on a 4K screen.
- `.detail-panel` carries a 135° gradient + `border-left: none` while
  `.spine-panel` runs a 180° gradient — the panel reads bright-top/dark-left,
  an artifact of expecting a taller spine to fuse against.
- The avatar picker is a grid of T-pose thumbnails; selection deserves a real
  staging moment.
- The Sequence tab is a panel that exists to hold two buttons.
- The Planes matrix is opaque to newcomers: anonymous colored squares, an iOS
  switch (against design language), a footer row that exists only for Reset.
- Effects stacks vertically before using width.

## Decisions (settled in brainstorm)

1. **Split container model.** The dock (spine + flyout) keeps everything you
   tune while the loop plays: Prop, Planes, Effort, Effects. The two
   browse-a-library tasks — Avatar, Sequence — promote to full `BaseModal`
   surfaces. Their dock tabs become launchers with compact summaries.
2. **Avatar modal uses a live 3D preview** (Threlte canvas, idle pose, slow
   orbit) fed by the shared GLTF cache; grid thumbnails get re-rendered in a
   natural pose (replacing T-pose webps at the same R2 URL scheme).
3. **Sequence: choreo card in the modal, glyph chip in the dock.** The dock
   row is `TKAWordGlyph` + step count + Change/Clear; `SequencePickerModal`
   gains a preview pane rendering the real `ChoreoCard` front.
4. **Planes: mini diagram + plain-language rows.** Inline SVG of the three
   planes color-matched to `PLANE_COLORS`; labeled Blue/Red hand chips; eye
   toggle with visible text state; standard toggle button replaces the iOS
   switch; Reset moves into the section header.

## Design

### 1. Dock shell (`PerformerHub.svelte`, `PerformerHubDetail.svelte`)

- Width: `clamp(32.5rem, 44vw, 68.75rem)` (520→1100px), rem-expressed per
  `4k-native-layout.md`. Wider band ⇒ shorter tabs.
- Kill both directional gradients. Spine and detail share one flat panel
  surface (`--theme-panel-bg` + at most one uniform performer-color wash at
  the same angle on both boxes). Detail regains `border-left` and the shared
  radius; the fused look comes from matching background + a 1px seam
  highlight, not missing borders.
- Tab bar keeps six segments. Avatar and Sequence become launchers: activating
  them opens their modal; their panes render only a summary chip + primary
  button (they remain real tab panes so keyboard nav and aria stay coherent).

### 2. Typography

- `PerformerIdentityHeader.svelte`: replace the `{sequenceWord}` span with
  `TKAWordGlyph` (`fitToParent`, small height). It collapses repeats via
  `compressWord` internally.
- Same swap anywhere else the hub prints a word. Post-condition grep: no raw
  `sequenceWord` interpolation in any hub template.

### 3. Prop tab (`PropFamilyPicker.svelte`)

- One continuous grid of all prop families with inline category labels; pinned column counts per container
  tier (6 columns, 8 at the widest tier) — no `auto-fit`, no per-category
  layout islands. Category identity becomes inline section labels within the
  flow, not independent grids.
- Variant drill-down unchanged. Prop-size slider stays below.

### 4. Avatar modal (new `AvatarSelectModal.svelte`)

- Built on `BaseModal`. Left ~40%: live Threlte canvas, focused avatar GLB,
  idle pose, slow orbit, simple pedestal; under it the avatar name and a large
  "Select this avatar" button. Right: grid of natural-pose thumbnails.
- Focus ≠ select: clicking a card focuses it into the preview (and prewarms
  via `prepareAvatarForDisplay`); the big button commits. Esc/backdrop closes
  without change.
- Dock avatar pane: current avatar chip + "Change avatar".
- Accepted cost: one extra WebGL context while open (precedent: Grip Lab,
  museum multi-canvas).
- Asset task: re-render avatar thumbnails in a natural pose; same URL scheme
  (`/models/avatars/thumbnails/<id>.webp` on R2), regenerated content.

### 5. Sequence (dock chip + `SequencePickerModal` upgrade)

- Dock pane: one row — `TKAWordGlyph`, "N steps", Change, Clear.
- `SequencePickerModal` gains a preview pane rendering the real `ChoreoCard`
  front for the highlighted sequence (reuse, not a new renderer).

### 6. Planes tab (`PlanesPopover.svelte`)

- Top: small inline isometric SVG — stick figure with wall/wheel/floor planes,
  colors from `PLANE_COLORS`.
- Rows read as sentences: plane name + eye toggle with visible "Shown/Hidden"
  state + two labeled hand chips ("Blue"/"Red") using chip-rule blue/red tone
  semantics — replacing the anonymous squares.
- Location-labels iOS switch → standard toggle button.
- Footer dies; Reset renders in the section header only when state is
  non-default.

### 7. Effects + Effort

- Effort: untouched.
- Effects: container-query tiers in the hub presentation so the wider dock
  lays out 2-up (LOOKS 2→4 columns) instead of stacking. CSS only.

## Out of scope

Spine/rail interaction model, effort palette content, effects registry, the
bottom transport bar.

## Verification

- Screenshot sweep per `visual-verification-mandatory.md` (all seven
  viewports) on: dock at each tab, avatar modal, sequence modal.
- Grep-proofs: no raw word interpolation, no `type="checkbox"`, no new
  chip-class buttons, no left-edge accent bars.
- `npm run check` green; contract tests untouched.
