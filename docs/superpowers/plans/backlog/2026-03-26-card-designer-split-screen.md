# Card Designer Split-Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the card designer from a single-sequence prev/next navigator to a split-screen with thumbnail grid picker (left) and stacked front+back card preview (right), with full localStorage persistence.

**Architecture:** `CardDesigner.svelte` becomes a thin orchestrator that owns localStorage state and observer registrations. Three new child components handle the UI: `SequencePickerGrid` (left panel thumbnail grid), `CardPreviewStack` (right panel stacked cards with focus toggle), and `DesignerSettingsSidebar` (slide-out controls). State flows down via props, events flow up.

**Tech Stack:** Svelte 5 runes, PropAwareThumbnail, ChoreoCard, CardBackV5, localStorage, ResizeObserver

**Spec:** `docs/superpowers/specs/2026-03-26-card-designer-split-screen-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte` | Left panel: thumbnail grid with filter chips, selection highlight, scroll-to-selected |
| `src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte` | Right panel: stacked front+back cards, focus toggle, responsive scaling |
| `src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte` | Slide-out settings: theme, visibility, export, info card |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/features/choreo-card/components/CardDesigner.svelte` | Major rewrite: split-screen orchestrator, persistence, observer ownership |

---

## Task 1: SequencePickerGrid Component

The left-panel thumbnail grid with filters and selection.

**Files:**
- Create: `src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte`

- [ ] **Step 1: Create the component shell**

Props:
```typescript
interface Props {
  sequences: SequenceData[];
  selectedIndex: number;
  selectedLength: number;
  onSelect: (index: number) => void;
  onLengthChange: (length: number) => void;
}
```

The component:
1. Renders filter chips at top (All, 2, 4, 6, 8, 10, 12, 16) — reuse the `lengthOptions` array and chip styling from current `CardDesigner.svelte` (lines 109-118, lines 319-349)
2. Below chips: a CSS grid of `PropAwareThumbnail` components (3 columns default)
3. Selected thumbnail gets an accent border highlight
4. Click thumbnail → calls `onSelect(index)`
5. Empty state: filter icon + "No {length}-beat sequences" when filtered list is empty

Import `PropAwareThumbnail` from `$lib/features/browse/sequences/display/components/PropAwareThumbnail.svelte`.

Key implementation details:
- The grid is a simple `div` with `display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; overflow-y: auto;`
- Each cell wraps a `PropAwareThumbnail` in a clickable container with `border: 2px solid transparent` that becomes `border-color: var(--theme-accent)` when selected
- Scroll-to-selected: use a `$effect` that watches `selectedIndex` and calls `element.scrollIntoView({ block: "nearest", behavior: "smooth" })` on the selected cell. Use `tick()` on mount to ensure the grid has rendered before the initial scroll.

Reference `CardDesigner.svelte` lines 319-349 for the existing filter chip markup and styling.

- [ ] **Step 2: Verify it renders standalone**

Temporarily render `SequencePickerGrid` in `CardDesigner.svelte` with hardcoded props to confirm thumbnails display and clicking works.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/designer/SequencePickerGrid.svelte
git commit -m "feat(card-designer): add SequencePickerGrid component with filter chips and thumbnail grid"
```

---

## Task 2: CardPreviewStack Component

The right-panel stacked front+back cards with toggleable focus.

**Files:**
- Create: `src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte`

- [ ] **Step 1: Create the component**

Props:
```typescript
interface Props {
  sequence: SequenceData | null;
  focusedCard: "front" | "back" | null;
  onFocusChange: (focused: "front" | "back" | null) => void;
  // Visibility props (passed from orchestrator's observer-derived state)
  handPointsVisible: boolean;
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;
  startPositionLayout: string;
  showBirthday: boolean;
  showQRCode: boolean;
  // Info card mode
  showInfoCard: boolean;
}
```

The component:
1. Stacks front (`ChoreoCard`) on top and back (`CardBackV5`) below
2. Uses `ResizeObserver` on its container to get available width and height
3. Computes card scaling per card:
   - Equal mode (focusedCard === null): each card gets `containerHeight * 0.5 - gap`
   - Focus mode: hero gets `containerHeight * 0.7`, other gets `containerHeight * 0.3`
   - Within each slot, scale card to fit: `Math.min(slotWidth / cardNaturalWidth, slotHeight / cardNaturalHeight)`
   - Back card always renders at 500x700 and uses `transform: scale()` (same as current)
   - Front card aspect ratio detection: poll for `<img>` natural dimensions (port `watchForImage` from current CardDesigner lines 289-299)
4. Click handler on each card wrapper:
   - If this card is already focused → set `focusedCard = null` (equalize)
   - If not focused → set `focusedCard = "front"` or `"back"`
5. CSS transition: `transition: flex 300ms ease` on both card slots

Reference `CardDesigner.svelte` lines 144-210 for the existing layout math and back card scaling. Port the logic but change from side-by-side to vertical stacking. The key difference: constraint is height-per-card, not total-width.

Import `ChoreoCard` from `../ChoreoCard.svelte`, `CardBackV5` from `../card-back/CardBackV5.svelte`, `InfoCardFront` from `../card-back/InfoCardFront.svelte`, `InfoCardBack` from `../card-back/InfoCardBack.svelte`.

- [ ] **Step 2: Verify it renders**

Temporarily render in `CardDesigner.svelte` with a test sequence. Confirm both cards display, clicking toggles focus, transition animates.

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/designer/CardPreviewStack.svelte
git commit -m "feat(card-designer): add CardPreviewStack with stacked layout and focus toggle"
```

---

## Task 3: DesignerSettingsSidebar Component

Slide-out settings panel extracted from current CardDesigner controls.

**Files:**
- Create: `src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte`

- [ ] **Step 1: Create the component**

Props:
```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  isExporting: boolean;
  // Info card
  showInfoCard: boolean;
  onInfoCardToggle: () => void;
}
```

The component:
1. Renders as a fixed-position overlay panel on the right edge
2. Slides in/out with CSS transform (`translateX(100%)` → `translateX(0)`)
3. Contains:
   - Theme switcher: icon chips for `ANIMATED_BACKGROUNDS`, clicking calls `settingsService.updateSetting("backgroundType", type)` (port from CardDesigner lines 129-135, 355-392)
   - Visibility toggles: hand points, grid, TKA, word, start position — each toggle calls the global state managers directly (`visibilityManager`, `imageComposition`)
   - QR code and birthday toggles
   - Export button (calls `onExport`)
   - Info card toggle (calls `onInfoCardToggle`)
4. Escape key closes (call `onClose`)

**Why not reuse CardSettingsModal?** The existing modal includes a live preview panel that takes half its real estate — redundant when the card preview is already visible. The sidebar is controls-only.

Settings changes flow through the existing global state managers (`visibilityManager`, `imageComposition`, `settingsService`). The orchestrator's observer registrations will detect the changes and pass updated derived props to `CardPreviewStack`.

Reference `CardDesigner.svelte` lines 355-520 for the existing control markup. Port the theme chips and visibility toggles.

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/designer/DesignerSettingsSidebar.svelte
git commit -m "feat(card-designer): add DesignerSettingsSidebar with theme and visibility controls"
```

---

## Task 4: Rewrite CardDesigner as Split-Screen Orchestrator

Replace the current 25KB single-file component with the split-screen layout using the three new child components.

**Files:**
- Modify: `src/lib/features/choreo-card/components/CardDesigner.svelte`

- [ ] **Step 1: Read the current CardDesigner.svelte completely**

Understand all state, observers, derived values, handlers, and template structure before rewriting. Key things to preserve:
- Observer registrations on `visibilityManager` and `imageComposition` (lines 56-72)
- All derived visibility props (lines 74-89)
- Export handler (lines 243-285)
- Context menu integration (lines 95-98, CardDesignerContextMenuHost)
- Keyboard navigation (lines 221-224)

- [ ] **Step 2: Rewrite the component**

The new `CardDesigner.svelte` structure:

**Script section:**
1. Same Props interface: `sequences: SequenceData[], isLoading: boolean`
2. **Persistence**: read all `choreoCard.designer*` keys on mount:
   - `designerSequenceId` → find index in sequences array
   - `designerLength` → beat filter
   - `designerFocusedCard` → "front" | "back" | null
   - `designerShowInfoCard` → boolean
   - `designerSidebarOpen` → boolean
3. **Observer registrations**: same pattern as current (lines 56-72). Orchestrator owns these.
4. **Derived visibility props**: same as current (lines 74-89). Passed as props to `CardPreviewStack`.
5. **Filtered sequences**: same derived (line 138-142)
6. **Selected index**: derive from `designerSequenceId` + filtered list. If ID not found, default to 0.
7. **Handlers**: write to localStorage on every state change:
   - `handleSelect(index)` → save sequence ID
   - `handleLengthChange(length)` → save length, reset index if current sequence drops out
   - `handleFocusChange(card)` → save focused card
   - `handleSidebarToggle()` → save sidebar state
   - `handleInfoCardToggle()` → save info card state
8. **Keyboard**: global ArrowLeft/Right listener (same as current)
9. **Export**: same handler (lines 243-285)

**Template section:**
```svelte
<div class="designer-split" bind:this={containerEl}>
  <div class="picker-panel">
    <SequencePickerGrid
      sequences={filteredSequences}
      {selectedIndex}
      {selectedLength}
      onSelect={handleSelect}
      onLengthChange={handleLengthChange}
    />
  </div>

  <div class="preview-panel">
    <CardPreviewStack
      sequence={currentSequence}
      focusedCard={focusedCard}
      onFocusChange={handleFocusChange}
      {handPointsVisible} {showGrid} {showTKA} {showWord}
      {includeStartPosition} {startPositionLayout}
      {showBirthday} {showQRCode} {showInfoCard}
    />

    <button class="settings-toggle" onclick={handleSidebarToggle}>
      <i class="fas fa-gear"></i>
    </button>

    <DesignerSettingsSidebar
      open={sidebarOpen}
      onClose={handleSidebarToggle}
      onExport={handleExport}
      {isExporting}
      {showInfoCard}
      onInfoCardToggle={handleInfoCardToggle}
    />
  </div>
</div>
```

**Style section:**
```css
.designer-split {
  display: flex;
  width: 100%;
  height: 100%;
  gap: 16px;
  overflow: hidden;
}

.picker-panel {
  width: 40%;
  min-width: 200px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.preview-panel {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.settings-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  /* ... button styling ... */
}
```

- [ ] **Step 3: Verify the full flow**

1. Page loads → picker shows thumbnails, cards show the persisted sequence
2. Click thumbnail → cards update
3. Arrow keys → next/prev, picker scrolls to follow
4. Click a card → focus toggles
5. Open settings → sidebar slides in
6. Change theme → cards update live
7. Refresh page → same sequence, same filter, same focus state

- [ ] **Step 4: Run typecheck**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/choreo-card/components/CardDesigner.svelte
git commit -m "feat(card-designer): rewrite as split-screen orchestrator with persistence"
```

---

## Task 5: Restore-by-ID Edge Cases

Handle the persistence edge cases identified in the spec.

**Files:**
- Modify: `src/lib/features/choreo-card/components/CardDesigner.svelte`

- [ ] **Step 1: Implement restore logic**

On mount, the orchestrator reads `designerSequenceId` from localStorage and needs to find the matching sequence in the loaded list. Handle these cases:

1. **ID found in filtered list** → set index, scroll picker to it
2. **ID found in unfiltered list but not current filter** → switch filter to "All" (0), then find index
3. **ID not found at all** (deleted sequence) → clear persisted ID, select first sequence
4. **Empty sequence list** → show empty state, no selection

Add a `$effect` that runs when `sequences` array changes (e.g., on initial load or when ChoreoCardTab updates):
```typescript
$effect(() => {
  if (sequences.length === 0) return;
  const restoredId = localStorage.getItem("choreoCard.designerSequenceId");
  if (!restoredId) { selectedIndex = 0; return; }

  // Try current filter first
  let idx = filteredSequences.findIndex(s => s.id === restoredId);
  if (idx >= 0) { selectedIndex = idx; return; }

  // Try unfiltered
  idx = sequences.findIndex(s => s.id === restoredId);
  if (idx >= 0) {
    selectedLength = 0; // switch to "All"
    localStorage.setItem(STORAGE_KEY_LENGTH, "0");
    // filteredSequences will recompute, then find index
    selectedIndex = idx;
    return;
  }

  // Not found at all — clear and default
  localStorage.removeItem("choreoCard.designerSequenceId");
  selectedIndex = 0;
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/features/choreo-card/components/CardDesigner.svelte
git commit -m "fix(card-designer): handle restore-by-ID edge cases for deleted and filtered sequences"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

- [ ] **Step 3: Visual verification checklist**

1. Page loads with persisted sequence selected and highlighted in picker
2. Click thumbnail → both cards update immediately
3. ArrowLeft/Right → sequential navigation, picker scrolls to follow
4. Click front card → expands to 70%, back shrinks to 30%. Click again → equalizes.
5. Click back card → same focus behavior in reverse
6. Gear icon → settings sidebar slides in from right
7. Change theme → cards re-render with new background
8. Toggle visibility (grid, TKA, hand points) → front card updates live
9. Export → downloads PNG of current front card
10. Refresh page → identical state restored (sequence, filter, focus, sidebar)
11. Filter to a beat count with no sequences → empty state shows
12. Delete the persisted sequence from library → refresh → falls back to first sequence

- [ ] **Step 4: Final commit if any fixes needed**
