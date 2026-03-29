# Visibility Tab Restoration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the pre-Jan-7-2026 three-panel visibility tab with live previews for Pictograph, Animation, and Image Export settings.

**Architecture:** Three panel components (PictographPanel, AnimationPanel, ImagePanel) each with a live preview area above toggle controls, orchestrated by VisibilityTab. Desktop shows all three side-by-side via flexbox; mobile shows one at a time via MobileSegmentControl. All state management unchanged — uses existing VisibilityStateManager, AnimationVisibilityManager, and ImageCompositionManager.

**Tech Stack:** Svelte 5, TypeScript, ITI DI, existing animation engine, PictographWithVisibility component.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/shared/settings/components/tabs/visibility/visibility-types.ts` | Create | `VisibilityMode` type |
| `src/lib/shared/settings/components/tabs/visibility/MobileSegmentControl.svelte` | Create | Mobile panel switcher |
| `src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte` | Create | Pictograph preview + toggles |
| `src/lib/shared/settings/components/tabs/visibility/AnimationPreviewCanvas.svelte` | Create | Pure render wrapper for AnimatorCanvas |
| `src/lib/shared/settings/components/tabs/visibility/AnimationPreviewController.svelte` | Create | Loads sequence, manages playback lifecycle |
| `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte` | Create | Animation preview + controls |
| `src/lib/shared/settings/components/tabs/visibility/ImageExportPreviewLayered.svelte` | Create | Simulated choreo card with animated overlays |
| `src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte` | Create | Image export preview + toggles |
| `src/lib/shared/settings/components/tabs/VisibilityTab.svelte` | Rewrite | Orchestrator: 3 panels, desktop side-by-side, mobile segmented |

## Key References

- **Git ref for old code:** `f005d11b7^` (pre-Jan-7 simplification) and `5a9f89eac^` (pre-March-19 deletion)
- **Still-existing components:** `PictographWithVisibility.svelte`, `example-data.ts`, all state managers
- **DI pattern:** Use `container.items.x` (ITI), NOT `resolve<T>(TYPES.X)` (old inversify)
- **Service imports:** `IBrowseLoader` → `container.items.browseLoader`, playback → `createPlaybackControllerFactory()`

## Upgrades from Old Version

The restored tab includes features added between Jan 7 and March 19 that the old version didn't have:

1. **Pictograph Panel:** Add Blue/Red motion toggles, Grid toggle, Step Numbers toggle (from current chip version)
2. **Animation Panel:** Add Props toggle, Progress Bar toggle, grid mode cycling (diamond→box→none)
3. **Image Panel:** Add QR Code toggle, Step Numbers toggle, rename "Birthday" → "Date"
4. **ImageExportPreviewLayered:** Add step numbers overlay, QR code indicator

---

### Task 1: Foundation Files (visibility-types.ts + MobileSegmentControl)

**Files:**
- Create: `src/lib/shared/settings/components/tabs/visibility/visibility-types.ts`
- Create: `src/lib/shared/settings/components/tabs/visibility/MobileSegmentControl.svelte`

- [ ] **Step 1: Create visibility-types.ts**

```typescript
/** Mode selection for mobile view */
export type VisibilityMode = "pictograph" | "animation" | "image";
```

- [ ] **Step 2: Create MobileSegmentControl.svelte**

Restore from git ref `f005d11b7^`. This component is unchanged — it's a pure presentational segmented control with three buttons (Pictograph, Animation, Image). Uses `VisibilityMode` type, emits `onModeChange`. Styles use theme variables and WCAG touch targets.

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "visibility" | head -20`
Expected: No errors referencing these files.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/visibility-types.ts src/lib/shared/settings/components/tabs/visibility/MobileSegmentControl.svelte
git commit -m "feat(settings): add visibility-types and MobileSegmentControl for restored visibility tab"
```

---

### Task 2: PictographPanel with Live Preview

**Files:**
- Create: `src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte`

- [ ] **Step 1: Create PictographPanel.svelte**

Base on git ref `f005d11b7^` PictographPanel. Key structure:
- Header with icon + "Pictograph" title
- `.preview-frame` containing `PictographWithVisibility` with `examplePictographData`, `forceShowAll={true}`, `previewMode={true}`, and click callbacks that call `onToggle(key)`
- Controls below: **Motions** group (Blue dot + "Blue", Red dot + "Red"), **Glyphs** group (TKA, VTG, Elemental, Positions), **Details** group (Reversals, Non-Radial, Step Numbers), **Grid** group (All Points / Active Only segmented)

**Upgrades from old version:**
- Add `blueMotionVisible` and `redMotionVisible` props + toggles (the old panel didn't have motion toggles)
- Add `stepNumbersVisible` prop + toggle in Details group
- Add `showGrid` prop + toggle in Grid group
- Add dependency hint: "Some glyphs need both motions visible" when `!allMotionsVisible`
- Disable glyph toggles when `!allMotionsVisible`

Props interface:
```typescript
interface Props {
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
  showGrid: boolean;
  tkaGlyphVisible: boolean;
  vtgGlyphVisible: boolean;
  elementalGlyphVisible: boolean;
  positionsGlyphVisible: boolean;
  reversalIndicatorsVisible: boolean;
  nonRadialVisible: boolean;
  stepNumbersVisible: boolean;
  handPointVisibility: "all" | "active";
  allMotionsVisible: boolean;
  onToggle: (key: string) => void;
  isMobileHidden?: boolean;
}
```

Styling: Use the old panel card pattern (`--theme-card-bg`, rounded 20px, hover lift, container queries). Preview frame is square aspect-ratio, max-width 280px.

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "PictographPanel" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte
git commit -m "feat(settings): add PictographPanel with live preview and motion/glyph toggles"
```

---

### Task 3: Animation Preview Components

**Files:**
- Create: `src/lib/shared/settings/components/tabs/visibility/AnimationPreviewCanvas.svelte`
- Create: `src/lib/shared/settings/components/tabs/visibility/AnimationPreviewController.svelte`

- [ ] **Step 1: Create AnimationPreviewCanvas.svelte**

Restore from git ref `5a9f89eac^`. Pure rendering wrapper around `AnimatorCanvas`. Takes `animationState` (AnimationPanelState) and `gridVisible` (boolean). Derives `currentStepData` and `currentLetter` from `animationState`. Passes through to `AnimatorCanvas` with trail settings from `animationSettings`.

No changes needed from old version — this was already using ITI-compatible imports.

- [ ] **Step 2: Create AnimationPreviewController.svelte**

Restore from git ref `5a9f89eac^`. This component:
1. Creates its own `AnimationPanelState` and `PlaybackController` (not the singleton — uses `createPlaybackControllerFactory()`)
2. On mount: loads "B" sequence via `container.items.browseLoader.loadFullSequenceData("B")`
3. Applies 1,1 turn pattern via `turnPatternManager.applyPattern()` for visible trails
4. Initializes playback controller, auto-starts looping playback
5. Subscribes to `AnimationVisibilityManager` for real-time setting updates
6. Shows loading spinner (`ProgressRing`), error state, or `AnimationPreviewCanvas`
7. Disposes playback controller on unmount

Already uses `container.items` (ITI) and `createPlaybackControllerFactory()`. Verify all imports resolve.

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "AnimationPreview" | head -10`

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/AnimationPreviewCanvas.svelte src/lib/shared/settings/components/tabs/visibility/AnimationPreviewController.svelte
git commit -m "feat(settings): add AnimationPreviewController and Canvas for live animation preview"
```

---

### Task 4: AnimationPanel with Preview and Controls

**Files:**
- Create: `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte`

- [ ] **Step 1: Create AnimationPanel.svelte**

Base on git ref `f005d11b7^` AnimationPanel. Key structure:
- Header with icon + "Animation" title
- `.preview-frame` containing `AnimationPreviewController`
- Desktop controls: Playback (Continuous/Step), Speed/BPM presets, Canvas toggles (Grid, Arms, Beat #s), Trails (Off/Subtle/Vivid + Both Ends), Overlays (TKA Glyph, Word)
- Mobile controls: Compact 2-column layout

**Upgrades from old version:**
- Add `propsVisible` prop + toggle in Canvas group
- Add `progressBarVisible` prop + toggle in Overlays group
- Add grid mode cycling button (diamond→box→none) replacing simple grid on/off
- Add Dark Mode toggle

Updated Props interface:
```typescript
interface Props {
  gridMode: string;
  beatNumbersVisible: boolean;
  armsVisible: boolean;
  propsVisible: boolean;
  trailStyle: TrailStyle;
  playbackMode: PlaybackMode;
  bpm: number;
  tkaGlyphVisible: boolean;
  wordHeaderVisible: boolean;
  progressBarVisible: boolean;
  darkMode: boolean;
  onToggle: (key: string) => void;
  onTrailStyleChange: (style: string) => void;
  onPlaybackModeChange: (mode: PlaybackMode) => void;
  onBpmChange: (bpm: number) => void;
  isMobileHidden?: boolean;
}
```

For grid mode cycling: button displays `Grid: {gridMode}` and calls `onToggle("cycleGrid")`.
For dark mode: button with moon icon, calls `onToggle("darkMode")`.

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "AnimationPanel" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte
git commit -m "feat(settings): add AnimationPanel with live preview and expanded controls"
```

---

### Task 5: ImageExportPreviewLayered

**Files:**
- Create: `src/lib/shared/settings/components/tabs/visibility/ImageExportPreviewLayered.svelte`

- [ ] **Step 1: Create ImageExportPreviewLayered.svelte**

Restore from git ref `5a9f89eac^`. This component simulates a choreo card layout:
- Header section: word text + difficulty badge (animated fly/fade/scale transitions)
- Grid section: horizontal strip of `PictographWithVisibility` components showing AABB sequence from `example-data.ts`, with optional start position cell
- Footer section: creator name, notes text, date (each animates independently)
- Dark mode support via `.dark-mode` class
- Override selectors that make invisible glyphs truly hidden (opacity 0) instead of dimmed (0.4)

**Upgrades from old version:**
- Add `showStepNumbers` prop — when true, shows step number overlay on each cell
- Add `showQRCode` prop — when true, shows a small QR icon indicator in corner
- Rename `showBirthday` → `showDate` for clarity (keep internal compat)

Updated Props:
```typescript
interface Props {
  showWord?: boolean;
  showDifficultyLevel?: boolean;
  includeStartPosition?: boolean;
  showStepNumbers?: boolean;
  showQRCode?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showDate?: boolean;
  customNotesText?: string;
  darkMode?: boolean;
  onToggleTKA?: () => void;
  onToggleVTG?: () => void;
  onToggleElemental?: () => void;
  onTogglePositions?: () => void;
  onToggleReversals?: () => void;
  onToggleNonRadial?: () => void;
}
```

For step numbers: overlay a small number in the bottom-left of each sequence cell when visible.
For QR code: show a small `fas fa-qrcode` icon in the header or footer area.

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "ImageExport" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/ImageExportPreviewLayered.svelte
git commit -m "feat(settings): add ImageExportPreviewLayered with animated overlay transitions"
```

---

### Task 6: ImagePanel with Preview and Controls

**Files:**
- Create: `src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte`

- [ ] **Step 1: Create ImagePanel.svelte**

Base on git ref `f005d11b7^` ImagePanel. Key structure:
- Header with icon + "Choreo Card" title (renamed from "Image Export" — matches current section name)
- `.preview-frame` containing `ImageExportPreviewLayered` with all toggle props passed through
- Controls: **Include** group (Word, Difficulty, Start Pos, Step Numbers), **Display** group (QR Code), **Footer** group (Name, Notes, Date), **Custom Notes** text input

**Upgrades from old version:**
- Add `showStepNumbers` prop + toggle
- Add `showQRCode` prop + toggle
- Rename "Birthday" → "Date"
- Pass dark mode state to preview

Props interface:
```typescript
interface Props {
  addWord: boolean;
  addBeatNumbers: boolean;
  addDifficultyLevel: boolean;
  includeStartPosition: boolean;
  showQRCode: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
  customNotesText: string;
  darkMode: boolean;
  onToggle: (key: string) => void;
  onCustomNotesChange: (value: string) => void;
  onPictographToggle: (key: string) => void;
  isMobileHidden?: boolean;
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "ImagePanel" | head -10`

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte
git commit -m "feat(settings): add ImagePanel with layered export preview"
```

---

### Task 7: Rewrite VisibilityTab Orchestrator

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/VisibilityTab.svelte`

- [ ] **Step 1: Rewrite VisibilityTab.svelte**

Replace the flat chip layout with the three-panel orchestrator. Structure:

```
<div class="visibility-tab">
  <!-- Mobile only: segment control -->
  <div class="mobile-only">
    <MobileSegmentControl currentMode={mobileMode} onModeChange={handleModeChange} />
  </div>

  <!-- Panels container: column on mobile, row on desktop -->
  <div class="visibility-panels-container">
    <PictographPanel ... isMobileHidden={mobileMode !== "pictograph"} />
    <AnimationPanel ... isMobileHidden={mobileMode !== "animation"} />
    <ImagePanel ... isMobileHidden={mobileMode !== "image"} />
  </div>
</div>
```

**State management:** Keep the same pattern from the current version — get state managers, register observers, derive state with `$derived.by()` using version bump for reactivity. The toggle handler functions from the current version are correct and should be kept, just routed through the panel `onToggle` callbacks.

**Layout CSS:**
- Container type `inline-size` on `.visibility-tab`
- At `@container visibility-tab (min-width: 700px)`: `.mobile-only` hidden, `.visibility-panels-container` becomes `flex-direction: row` with `align-items: stretch`
- Below 700px: panels stack vertically, mobile segment control visible, `isMobileHidden` hides non-active panels

**Key: No props needed from SettingsModule.** The current `<VisibilityTab />` call has no props. Keep it that way — all state accessed via singleton state managers.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -c "error TS"`
Expected: 0 (or same count as before this change)

- [ ] **Step 3: Run build**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/settings/components/tabs/VisibilityTab.svelte
git commit -m "feat(settings): restore three-panel visibility tab with live previews"
```

---

### Task 8: Visual Verification

- [ ] **Step 1: Verify desktop layout**

Navigate to `localhost:5173/settings/visibility`. Confirm three panels display side-by-side on desktop with:
- Pictograph panel: live pictograph preview responding to toggles
- Animation panel: playing animation with trails
- Image panel: simulated choreo card with animated overlays

- [ ] **Step 2: Verify mobile layout**

Resize browser to <700px width. Confirm:
- Segment control appears at top
- Only active panel shows
- Switching segments changes visible panel

- [ ] **Step 3: Verify toggle functionality**

Toggle each setting and confirm:
- Pictograph preview updates immediately
- Animation preview reflects grid/trail/overlay changes
- Image export preview shows/hides word, difficulty, footer elements with transitions

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix(settings): polish visibility tab panel layout and interactions"
```
