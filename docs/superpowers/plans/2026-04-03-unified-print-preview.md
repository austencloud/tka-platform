# Unified Print Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Cards view and Print Prep with a single Print Preview view that shows pages exactly as they'll print (alternating front/back pages with duplex alignment), with inline export controls.

**Architecture:** New `PrintPreviewPages.svelte` component renders alternating front/back US Letter pages using `PrintCardRenderer` for card images. A `PrintPreviewToolbar.svelte` provides card size, theme, and export controls inline. DeckBrowser and VtgFamilyDrillDown switch from `'grid' | 'cards'` to `'grid' | 'print'`. PrintPrepView and its sub-components are deleted.

**Tech Stack:** Svelte 5, existing PrintCardRenderer/PrintPDFExporter/PrintZipExporter services, card-sizes.ts layout calculations

**Spec:** `docs/superpowers/specs/2026-04-03-unified-print-preview-design.md`

---

### Task 1: Create PrintPreviewToolbar Component

The toolbar strip with card size, theme, and export controls.

**Files:**
- Create: `src/lib/features/choreo-card/components/print-preview/PrintPreviewToolbar.svelte`

- [ ] **Step 1: Create the component**

```svelte
<!--
  PrintPreviewToolbar.svelte — Inline controls for Print Preview:
  card size toggle, theme swatches, export buttons.
-->
<script lang="ts">
  import type { CardSizeId } from "../../domain/card-sizes";
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";

  interface Props {
    cardSize: CardSizeId;
    selectedTheme: string;
    totalCards: number;
    isRendering: boolean;
    isExporting: boolean;
    renderProgress: number;
    renderTotal: number;
    onCardSizeChange: (size: CardSizeId) => void;
    onThemeChange: (themeId: string) => void;
    onExportPDF: () => void;
    onExportZIP: () => void;
  }

  const {
    cardSize, selectedTheme, totalCards,
    isRendering, isExporting, renderProgress, renderTotal,
    onCardSizeChange, onThemeChange, onExportPDF, onExportZIP,
  }: Props = $props();

  const THEMES = [
    { id: "nightSky", label: "Night Sky", color: "#1e1b4b" },
    { id: "deepOcean", label: "Deep Ocean", color: "#0c4a6e" },
    { id: "snowfall", label: "Snowfall", color: "#334155" },
    { id: "emberGlow", label: "Ember Glow", color: "#7c2d12" },
    { id: "sakuraDrift", label: "Sakura", color: "#831843" },
    { id: "fireflyForest", label: "Firefly Forest", color: "#14532d" },
    { id: "autumnDrift", label: "Autumn Drift", color: "#d97706" },
    { id: "pride", label: "Pride", color: "#f43f5e" },
  ] as const;
</script>

<div class="print-toolbar">
  <CardSizeToggle selected={cardSize} onchange={onCardSizeChange} />

  <div class="theme-row" role="radiogroup" aria-label="Card back theme">
    {#each THEMES as theme (theme.id)}
      <button
        class="theme-swatch"
        class:active={selectedTheme === theme.id}
        style:background={theme.color}
        onclick={() => onThemeChange(theme.id)}
        type="button"
        aria-label={theme.label}
        aria-checked={selectedTheme === theme.id}
        role="radio"
      ></button>
    {/each}
  </div>

  <div class="export-group">
    {#if isRendering}
      <span class="progress-text">Rendering {renderProgress}/{renderTotal}...</span>
    {:else}
      <button
        class="export-btn"
        onclick={onExportPDF}
        disabled={isExporting || totalCards === 0}
        type="button"
      >
        <i class="fas fa-file-pdf" aria-hidden="true"></i>
        PDF
      </button>
      <button
        class="export-btn"
        onclick={onExportZIP}
        disabled={isExporting || totalCards === 0}
        type="button"
      >
        <i class="fas fa-file-archive" aria-hidden="true"></i>
        ZIP
      </button>
    {/if}
  </div>
</div>

<!-- Scoped styles for the toolbar -->
```

Style it as a single horizontal row: card size toggle on left, theme swatches in center, export buttons on right. Keep it compact — one line, no wrapping on desktop.

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewToolbar.svelte
git commit -m "feat(choreo-card): add PrintPreviewToolbar with size, theme, and export controls"
```

---

### Task 2: Create PrintPreviewPages Component

The core component that renders alternating front/back pages.

**Files:**
- Create: `src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte`

- [ ] **Step 1: Create the component**

This component:
1. Takes sequences, cardSize, theme, visibility options as props
2. Uses `getPageLayout(cardSize)` to determine grid dimensions
3. Groups sequences into page-sized batches (e.g. 9 for poker)
4. For each batch, renders TWO pages: a fronts page and a backs page
5. Fronts: cards left-to-right, top-to-bottom in the grid
6. Backs: same cards but columns mirrored (position 3,2,1 instead of 1,2,3)
7. Renders cards progressively using PrintCardRenderer from DI container
8. Each page is a white rectangle at 8.5:11 aspect ratio

Key implementation details:
- Use `container.items.printCardRenderer` to get the renderer
- Call `renderFront()` and `renderBack()` for each sequence
- Convert canvases to data URLs for display as `<img>` tags
- Position cards within each page using CSS grid matching the page layout
- Mirror column order on back pages: `cols - 1 - (i % cols)` for the column position
- Show a progress bar during rendering
- Pages scroll vertically with gap between them

Props interface:
```typescript
interface Props {
  sequences: SequenceData[];
  cardSize: CardSizeId;
  theme: string;
  isLoading: boolean;
  showGrid?: boolean;
  showTKA?: boolean;
  showWord?: boolean;
  includeStartPosition?: boolean;
  handPointsVisible?: boolean;
  /** Emits rendered CardPair[] for export use */
  onPairsReady?: (pairs: CardPair[]) => void;
}
```

The `onPairsReady` callback passes rendered CardPair objects (with front/back canvases) up to the parent so the export buttons can use them without re-rendering.

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/print-preview/PrintPreviewPages.svelte
git commit -m "feat(choreo-card): add PrintPreviewPages showing alternating front/back print pages"
```

---

### Task 3: Replace Cards View in DeckBrowser

**Files:**
- Modify: `src/lib/features/choreo-card/components/DeckBrowser.svelte`

- [ ] **Step 1: Update ViewMode type and imports**

Change line 82:
```typescript
// OLD
type ViewMode = 'grid' | 'cards';
// NEW
type ViewMode = 'grid' | 'print';
```

Remove imports for CardPageLayout, CardPreviewSettings. Add imports for PrintPreviewPages and PrintPreviewToolbar.

Remove the `onPrintPrep` prop from the interface (no longer needed — Print Preview IS the view).

- [ ] **Step 2: Replace the Cards toggle button**

In the view mode toggle (around line 432-455), change the "Cards" button to "Print Preview":

```svelte
<button
  class="action-chip"
  class:active={viewMode === 'print'}
  onclick={() => setViewMode('print')}
  type="button"
  role="radio"
  aria-checked={viewMode === 'print'}
>
  <i class="fas fa-print" aria-hidden="true"></i>
  Print Preview
</button>
```

Remove the card size toggle, settings gear, and print button that were conditionally shown for the cards view. Instead, when `viewMode === 'print'`, show `<PrintPreviewToolbar>`.

- [ ] **Step 3: Replace CardPageLayout with PrintPreviewPages**

Where CardPageLayout was rendered (around line 542-556), replace with:

```svelte
{:else if viewMode === 'print'}
  <PrintPreviewToolbar
    {cardSize}
    {selectedTheme}
    totalCards={renderedPairs.length}
    {isRendering}
    {isExporting}
    {renderProgress}
    renderTotal={filteredSequences.length}
    onCardSizeChange={setCardSize}
    onThemeChange={handleThemeChange}
    onExportPDF={handleExportPDF}
    onExportZIP={handleExportZIP}
  />
  <PrintPreviewPages
    sequences={filteredSequences}
    {cardSize}
    theme={selectedTheme}
    isLoading={false}
    {handPointsVisible}
    {showGrid}
    {showTKA}
    {showWord}
    {includeStartPosition}
    onPairsReady={(pairs) => { renderedPairs = pairs; }}
  />
```

- [ ] **Step 4: Add export handler functions**

Add `handleExportPDF` and `handleExportZIP` functions that use the existing `PrintPDFExporter` and `PrintZipExporter` from the DI container, passing the `renderedPairs` state.

- [ ] **Step 5: Remove CardPreviewSettings sidebar and related code**

Delete the `<CardPreviewSettings>` sidebar panel that was only shown in cards mode. Remove the `settingsOpen` state and related toggle logic.

- [ ] **Step 6: Verify build**

```bash
npm run check
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/choreo-card/components/DeckBrowser.svelte
git commit -m "feat(choreo-card): replace Cards view with Print Preview in DeckBrowser"
```

---

### Task 4: Replace Cards View in VtgFamilyDrillDown

**Files:**
- Modify: `src/lib/features/choreo-card/components/VtgFamilyDrillDown.svelte`

- [ ] **Step 1: Update ViewMode and imports**

Change line 13:
```typescript
type ViewMode = 'grid' | 'print';
```

Remove CardPageLayout import. Add PrintPreviewPages and PrintPreviewToolbar imports.

Remove the `onPrintPrep` prop — no longer needed.

- [ ] **Step 2: Replace toggle button and toolbar**

Same changes as DeckBrowser: "Cards" button becomes "Print Preview" button. Card size toggle and print button replaced by PrintPreviewToolbar when in print mode.

- [ ] **Step 3: Replace CardPageLayout with PrintPreviewPages**

Where CardPageLayout was rendered (around line 201-215), replace with PrintPreviewPages using `allSequences` (the flattened sequences from ratio groups).

- [ ] **Step 4: Add export handlers**

Same pattern as DeckBrowser — handleExportPDF/handleExportZIP using DI container services.

- [ ] **Step 5: Verify build**

```bash
npm run check
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/choreo-card/components/VtgFamilyDrillDown.svelte
git commit -m "feat(choreo-card): replace Cards view with Print Preview in VtgFamilyDrillDown"
```

---

### Task 5: Remove PrintPrepView and Related State from ChoreoCardTab

**Files:**
- Modify: `src/lib/features/choreo-card/components/ChoreoCardTab.svelte`

- [ ] **Step 1: Remove PrintPrepView import and rendering**

Remove line 22: `import PrintPrepView from "./PrintPrepView.svelte";`

Remove the `printPrepActive`, `printPrepDeckOverride`, `printPrepSequencesOverride` state variables (around lines 179-182).

Remove the `{#if mode === "decks" && printPrepActive}` block that renders PrintPrepView (around lines 586-597).

Remove the `onPrintPrep` callback in the DeckBrowser component usage (around line 622-626).

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/choreo-card/components/ChoreoCardTab.svelte
git commit -m "refactor(choreo-card): remove PrintPrepView state from ChoreoCardTab"
```

---

### Task 6: Delete Old Files

**Files:**
- Delete: `src/lib/features/choreo-card/components/card-preview/CardPageLayout.svelte`
- Delete: `src/lib/features/choreo-card/components/PrintPrepView.svelte`
- Delete: `src/lib/features/choreo-card/components/print-prep/PrintPrepSidebar.svelte`
- Delete: `src/lib/features/choreo-card/components/print-prep/PrintPrepCardGrid.svelte`
- Delete: `src/lib/features/choreo-card/components/print-prep/PrintPrepDetailModal.svelte`
- Delete: `src/lib/features/choreo-card/components/card-preview/CardPreviewSettings.svelte` (if no other importers)

- [ ] **Step 1: Verify no remaining imports**

```bash
grep -r "CardPageLayout\|PrintPrepView\|PrintPrepSidebar\|PrintPrepCardGrid\|PrintPrepDetailModal\|CardPreviewSettings" src/ --include="*.ts" --include="*.svelte" -l
```

Fix any remaining references before deleting.

- [ ] **Step 2: Delete the files**

```bash
rm src/lib/features/choreo-card/components/card-preview/CardPageLayout.svelte
rm src/lib/features/choreo-card/components/PrintPrepView.svelte
rm src/lib/features/choreo-card/components/print-prep/PrintPrepSidebar.svelte
rm src/lib/features/choreo-card/components/print-prep/PrintPrepCardGrid.svelte
rm src/lib/features/choreo-card/components/print-prep/PrintPrepDetailModal.svelte
rm src/lib/features/choreo-card/components/card-preview/CardPreviewSettings.svelte
```

- [ ] **Step 3: Remove empty directories if applicable**

```bash
rmdir src/lib/features/choreo-card/components/print-prep 2>/dev/null || true
```

- [ ] **Step 4: Verify build**

```bash
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(choreo-card): delete old Cards view and Print Prep components"
```

---

### Task 7: Verify via DevTools

**Files:** None (verification only)

- [ ] **Step 1: Navigate to VTG Split-Same**

Open DevTools, navigate to VTG > Split-Same (Water). Verify toolbar shows Grid and Print Preview.

- [ ] **Step 2: Switch to Print Preview**

Click Print Preview. Verify:
- Pages render as US Letter rectangles
- Page 1 shows fronts in a 3x3 grid (poker) with white backgrounds
- Page 2 shows matching backs with mandalas, columns mirrored
- Pages alternate front/back throughout
- Toolbar shows card size, theme swatches, and export buttons
- Theme swatches change the card backs when clicked

- [ ] **Step 3: Test PDF export**

Click PDF export. Open the generated PDF. Verify front/back pages are duplex-aligned.

- [ ] **Step 4: Test ZIP export**

Click ZIP export. Verify it downloads with fronts/ and backs/ folders.

- [ ] **Step 5: Test on a LOOPs deck**

Navigate to a LOOPs deck, switch to Print Preview, verify it works there too.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(choreo-card): print preview verification adjustments"
```
