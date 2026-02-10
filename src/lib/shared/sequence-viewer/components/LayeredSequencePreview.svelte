<!--
  LayeredSequencePreview.svelte

  Renders a sequence preview with individually animated pictograph cells.
  Each pictograph is rendered separately, enabling:
  - Per-cell selection animation (scale + glow) during playback
  - Smooth start position toggle animation (cell slides in/out)
  - Independent visibility toggles without full re-render

  Structure:
  - Header section (difficulty badge + LOOP glyph) - animates in/out
  - Grid section (individual pictograph cells, each animatable)
  - Footer section (name, notes, birthday) - each animates independently
-->
<script lang="ts">
  // Transitions removed - they caused NaN keyframe errors on initial mount
  // when the container hadn't been sized yet (aspect-ratio elements)
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import type { PreviewCellRenderOptions } from "../services/contracts/IPreviewCellRenderer";
  import { onMount, onDestroy, untrack } from "svelte";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { LOOPTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { createStartPositionFromBeatStart } from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";
  import { previewCellRenderer } from "../services/implementations/PreviewCellRenderer";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";

  // ============================================================================
  // GLOBAL CELL URL CACHE
  // Survives component remounts so drag-to-move doesn't re-render all cells.
  // Keyed by sequence content + render options hash. Capped at 10 entries (LRU).
  // ============================================================================
  interface CachedPreview {
    cells: { index: number; label: string; imageUrl: string; gridColumn: number; gridRow: number }[];
    columns: number;
    rows: number;
  }
  const MAX_PREVIEW_CACHE = 10;
  const globalPreviewCache = new Map<string, CachedPreview>();

  function getPreviewCacheKey(
    seq: SequenceData,
    opts: PreviewCellRenderOptions,
    colCount: number | null,
    isDark: boolean,
  ): string {
    const stepLetters = seq.steps?.map(s => s.letter ?? "?").join("") ?? "";
    return `${seq.id ?? seq.word ?? "?"}-${stepLetters}-${seq.steps?.length ?? 0}-${opts.size}-${opts.showStepNumbers}-${opts.showNonRadialPoints}-${opts.showTKA}-${opts.showReversals}-${opts.bluePropType ?? ""}-${opts.redPropType ?? ""}-${colCount ?? "auto"}-${isDark ? "dark" : "light"}`;
  }

  function storePreviewInCache(key: string, data: CachedPreview): void {
    if (globalPreviewCache.size >= MAX_PREVIEW_CACHE && !globalPreviewCache.has(key)) {
      const oldest = globalPreviewCache.keys().next().value;
      if (oldest !== undefined) {
        // Revoke blob URLs from evicted cache entry
        const evicted = globalPreviewCache.get(oldest);
        if (evicted) {
          for (const cell of evicted.cells) {
            if (cell.imageUrl.startsWith("blob:")) URL.revokeObjectURL(cell.imageUrl);
          }
        }
        globalPreviewCache.delete(oldest);
      }
    }
    globalPreviewCache.set(key, data);
  }

  interface Props {
    sequence: SequenceData;
    // Visibility toggles
    showStepNumbers?: boolean;
    showDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
    showLoopGlyph?: boolean;
    // Settings
    darkMode?: boolean;
    userName?: string;
    customNotesText?: string;
    // Prop overrides
    bluePropType?: PropType;
    redPropType?: PropType;
    catDogModeEnabled?: boolean;
    // Step highlighting (for animation sync)
    highlightedStepIndex?: number | null;  // 0-indexed step to highlight (null = none)
    showHighlight?: boolean;               // Enable highlighting (default: false)
    // Click handler for step seeking
    onStepClick?: (stepIndex: number) => void;  // 0-indexed step that was clicked
    // Layout override
    columnCount?: number | null;  // Override auto-calculated column count (null = auto)
    // Render progress callback (loaded cells, total cells)
    onRenderProgress?: (loaded: number, total: number) => void;
  }

  const {
    sequence,
    showStepNumbers = true,
    showDifficultyLevel = true,
    includeStartPosition = true,
    showCreatorName = true,
    showNotes = true,
    showBirthday = true,
    showLoopGlyph = true,
    darkMode = false,
    userName = "",
    customNotesText = "Created using TKA Scribe",
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    highlightedStepIndex = null,
    showHighlight = false,
    onStepClick,
    columnCount = null,
    onRenderProgress,
  }: Props = $props();

  // Constants
  // Render at high resolution for crisp display on 4K monitors
  // Images scale down cleanly on lower-resolution displays
  const CELL_SIZE = 240; // Match thumbnail pipeline (240px) for instant cache hits from gallery

  // LOOP type resolver for parsing loopType to components
  const loopTypeResolver = new LOOPTypeResolver();

  // Cache for on-demand LOOP detection results (keyed by sequence ID)
  const loopDetectionCache = new Map<string, Set<LOOPComponent> | null>();

  /**
   * Detect LOOP components on demand for sequences without loopType.
   * Uses caching to avoid repeated analysis.
   */
  function detectLoopComponents(seq: SequenceData): Set<LOOPComponent> | null {
    const cacheKey = seq.id;
    if (loopDetectionCache.has(cacheKey)) {
      return loopDetectionCache.get(cacheKey)!;
    }

    if (!seq.steps || seq.steps.length < 2) {
      loopDetectionCache.set(cacheKey, null);
      return null;
    }

    try {
      const result = loopDetector.detectLOOPType(seq);

      if (result.loopType) {
        const components = loopTypeResolver.parseComponents(result.loopType);
        const resultSet = components.size > 0 ? components : null;
        loopDetectionCache.set(cacheKey, resultSet);
        return resultSet;
      }

      loopDetectionCache.set(cacheKey, null);
      return null;
    } catch {
      loopDetectionCache.set(cacheKey, null);
      return null;
    }
  }

  // Individual cell data
  interface CellData {
    index: number;          // -1 for start position, 0+ for steps
    label: string;          // "Start" or step number
    imageUrl: string;       // Rendered image URL (current mode only)
    isLoaded: boolean;      // Whether the real image has loaded (false = show spinner)
    gridColumn: number;     // 1-based CSS grid column
    gridRow: number;        // 1-based CSS grid row
  }

  // State
  let cells = $state<CellData[]>([]);
  let columns = $state(0);
  let rows = $state(0);
  let isLoading = $state(true);
  let isRendering = false;
  let cellWidth = $state(0);

  // Container-based sizing for "contain" behavior
  let containerElement: HTMLDivElement | undefined = $state();
  let containedWidth = $state<number | null>(null);
  let containedHeight = $state<number | null>(null);

  // Visibility settings from user preferences (reactive)
  const visibilitySettings = $derived(getSettings().visibility);
  const showNonRadial = $derived(visibilitySettings?.nonRadialPoints ?? true);
  const handPointVis = $derived<"all" | "active">(visibilitySettings?.handPointVisibility ?? "all");
  const showTKA = $derived(visibilitySettings?.tkaGlyph ?? true);
  const showReversals = $derived(visibilitySettings?.reversalIndicators ?? true);

  // Layout calculations
  const difficultyCalculator = new SequenceDifficultyCalculator();

  // Calculate difficulty level (with null safety)
  const difficultyLevel = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;
    return difficultyCalculator.calculateDifficultyLevel([...sequence.steps]);
  });

  // Parse LOOP components for the glyph
  const loopComponents = $derived.by(() => {
    const loopType = sequence.loopType;

    if (loopType) {
      const components = loopTypeResolver.parseComponents(loopType);
      return components.size > 0 ? components : null;
    }

    if (!loopType && sequence.steps) {
      return detectLoopComponents(sequence);
    }

    return null;
  });

  // Show header when difficulty or LOOP glyph is enabled
  const showHeader = $derived(
    showDifficultyLevel || (showLoopGlyph && loopComponents)
  );

  // Show footer when any footer element is enabled
  const showFooter = $derived(showCreatorName || showNotes || showBirthday);

  // Format birthday date
  const birthdayDate = $derived.by(() => {
    const date = new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  });

  // Effective username
  const effectiveUserName = $derived(userName || authState.user?.displayName || "");

  // Level badge colors
  const defaultLevelStyle = { bg: "linear-gradient(135deg, #fff, #f5f5f5)", border: "#000", text: "#000" };
  const levelStyles: Record<number, { bg: string; border: string; text: string }> = {
    1: defaultLevelStyle,
    2: { bg: "linear-gradient(135deg, #d4d4d4, #a8a8a8)", border: "#000", text: "#000" },
    3: { bg: "linear-gradient(135deg, #ffd700, #b8860b)", border: "#000", text: "#000" },
    4: { bg: "linear-gradient(135deg, #c8a2c8, #9400d3)", border: "#000", text: "#000" },
    5: { bg: "linear-gradient(135deg, #ff4500, #8b0000)", border: "#000", text: "#fff" },
  };

  const currentLevelStyle = $derived(levelStyles[difficultyLevel] ?? defaultLevelStyle);

  // Filtered cells based on includeStartPosition
  const visibleCells = $derived.by(() => {
    if (includeStartPosition) {
      return cells;
    }
    // Filter out start position (index === -1)
    return cells.filter(cell => cell.index !== -1);
  });

  // Effective columns (changes when start position is toggled off)
  const effectiveColumns = $derived.by(() => {
    if (!columns) return 0;
    if (includeStartPosition) return columns;
    // When start position is hidden, first row might have one less item
    // But we keep the same column count for layout consistency
    return columns;
  });

  // Compute aspect ratio for the entire preview (width / height)
  // This ensures the preview maintains correct proportions regardless of container size
  const previewAspectRatio = $derived.by(() => {
    if (!columns || !rows) return 1;

    // Grid aspect: columns (width) / rows (height) of square cells
    const gridWidth = columns;
    const gridHeight = rows;

    // Header adds ~1/3 cell height, footer adds ~1/7 cell height
    const headerFraction = showHeader ? 1/3 : 0;
    const footerFraction = showFooter ? 1/7 : 0;

    // Total height in cell-height units
    const totalHeight = gridHeight + headerFraction + footerFraction;

    // Aspect ratio = width / height
    return gridWidth / totalHeight;
  });

  // Scaled sizes based on grid element width
  const scaledHeaderHeight = $derived.by(() => {
    if (!cellWidth || !Number.isFinite(cellWidth)) return 0;
    return Math.floor(cellWidth / 3);
  });

  const scaledFooterHeight = $derived.by(() => {
    if (!cellWidth || !Number.isFinite(cellWidth)) return 0;
    return Math.floor(cellWidth / 7);
  });

  const badgeSize = $derived(Math.max(16, scaledHeaderHeight * 0.9));
  const badgePadding = $derived(Math.max(2, scaledHeaderHeight * 0.05));
  const badgeNumberFontSize = $derived(Math.max(8, Math.floor(badgeSize / 1.75)));
  // Footer font size scales proportionally - no minimum constraint for WYSIWYG preview
  const footerFontSize = $derived(Math.floor(scaledFooterHeight * 0.55));
  const footerMargin = $derived(Math.floor(scaledFooterHeight * 0.3));

  // Beat number font size (10.526% of cell width, matching StepNumber.svelte)
  const beatNumberFontSize = $derived.by(() => {
    if (!cellWidth || !Number.isFinite(cellWidth)) return 12;
    return Math.max(8, cellWidth * 0.10526);
  });

  const startFontSize = $derived.by(() => {
    if (!cellWidth || !Number.isFinite(cellWidth)) return 10;
    return Math.max(7, cellWidth * 0.0842);
  });

  /**
   * Build render options from current component state
   */
  function buildRenderOptions(): PreviewCellRenderOptions {
    return {
      size: CELL_SIZE,
      bluePropType,
      redPropType,
      catDogModeEnabled,
      showStepNumbers,
      showNonRadialPoints: showNonRadial,
      handPointVisibility: handPointVis,
      showTKA,
      showReversals,
    };
  }

  /**
   * Calculate grid position for a step index.
   * With start position: first row has all columns, subsequent rows offset by 1.
   * Layout example for 16 steps (5 cols × 4 rows):
   *   Row 1: Start(col 1), 1(col 2), 2(col 3), 3(col 4), 4(col 5)
   *   Row 2: 5(col 2), 6(col 3), 7(col 4), 8(col 5)
   *   Row 3: 9(col 2), 10(col 3), 11(col 4), 12(col 5)
   *   Row 4: 13(col 2), 14(col 3), 15(col 4), 16(col 5)
   */
  function calculateGridPosition(stepIndex: number, cols: number): { gridColumn: number; gridRow: number } {
    // Start position is always at column 1, row 1
    if (stepIndex === -1) {
      return { gridColumn: 1, gridRow: 1 };
    }

    // Steps per row (excluding the start column after row 1)
    const stepsPerRow = cols - 1;

    // First row after start position
    const firstRowSteps = cols - 1; // How many steps fit in row 1 after start

    if (stepIndex < firstRowSteps) {
      // This step is in the first row (same row as start)
      // Column is offset by 2 (col 1 is start)
      return { gridColumn: stepIndex + 2, gridRow: 1 };
    }

    // Steps after the first row
    const remainingIndex = stepIndex - firstRowSteps;
    const row = Math.floor(remainingIndex / stepsPerRow) + 2; // +2 because row 1 is start row
    const col = (remainingIndex % stepsPerRow) + 2; // +2 because col 1 is start column

    return { gridColumn: col, gridRow: row };
  }

  /**
   * Render all cells (start position + steps)
   */
  async function renderAllCells() {
    if (!sequence?.steps?.length) {
      isLoading = false;
      return;
    }

    if (isRendering) return;
    isRendering = true;

    try {
      const layoutService = layoutCalculator;

      // Calculate layout
      const stepCount = sequence.steps.length;
      let cols: number;
      let rws: number;

      if (columnCount !== null && columnCount > 0) {
        cols = columnCount;
        const stepsPerRow = cols - 1;
        const firstRowSteps = Math.min(stepsPerRow, stepCount);
        const remainingSteps = stepCount - firstRowSteps;
        rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
      } else {
        [cols, rws] = layoutService.calculateLayout(stepCount, true);
      }

      columns = cols;
      rows = rws;

      // Build render options once for all cells
      const renderOptions = buildRenderOptions();

      // Only render the current mode — halves total render count
      const isDark = darkMode;

      // Check global cache — avoids re-rendering after drag-to-move
      const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark);
      const cached = globalPreviewCache.get(cacheKey);
      if (cached && cached.columns === cols && cached.rows === rws) {
        cells = cached.cells.map(c => ({ ...c, isLoaded: true }));
        isLoading = false;
        isRendering = false;
        // Signal 100% immediately for cache hits
        onRenderProgress?.(cached.cells.length, cached.cells.length);
        return;
      }

      // Clear old URLs before render
      clearCellUrls();

      // Pre-populate ALL cells with placeholders immediately.
      // This gives the grid its full dimensions from frame one — no layout shift
      // as individual cells render. Cells show a spinner until loaded.
      const placeholderCells: CellData[] = [];

      // Start position placeholder
      const firstStep = sequence.steps[0];
      if (sequence.startPosition || firstStep) {
        const { gridColumn, gridRow } = calculateGridPosition(-1, cols);
        placeholderCells.push({
          index: -1, label: "Start",
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow,
        });
      }

      // Step placeholders
      for (let i = 0; i < sequence.steps.length; i++) {
        const { gridColumn, gridRow } = calculateGridPosition(i, cols);
        placeholderCells.push({
          index: i, label: String(i + 1),
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow,
        });
      }

      // Show grid with full dimensions immediately (placeholders fill all cells)
      cells = placeholderCells;
      isLoading = false;

      const totalCellCount = placeholderCells.length;
      let loadedCount = 0;

      // Render cells SEQUENTIALLY (start → 1 → 2 → 3...) so animation can
      // chase the render frontier. Perceived time is much shorter than parallel
      // because cells appear in meaningful order.

      // Start position render
      if (sequence.startPosition || firstStep) {
        const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
        const imageUrl = await previewCellRenderer.renderCell(startData, undefined, isDark, renderOptions);
        const idx = cells.findIndex(c => c.index === -1);
        if (idx !== -1) {
          cells[idx] = { ...cells[idx]!, imageUrl, isLoaded: true };
        }
        loadedCount++;
        onRenderProgress?.(loadedCount, totalCellCount);
      }

      // Step renders — in order, one at a time
      for (let i = 0; i < sequence.steps.length; i++) {
        const step = sequence.steps[i];
        if (!step) continue;

        const imageUrl = await previewCellRenderer.renderCell(step, i + 1, isDark, renderOptions);
        const idx = cells.findIndex(c => c.index === i);
        if (idx !== -1) {
          cells[idx] = { ...cells[idx]!, imageUrl, isLoaded: true };
        }
        loadedCount++;
        onRenderProgress?.(loadedCount, totalCellCount);
      }

      // Store in global cache for reuse across component remounts
      storePreviewInCache(cacheKey, { cells: [...cells], columns: cols, rows: rws });
    } catch (error) {
      console.error("Failed to render cells:", error);
    } finally {
      isRendering = false;
    }
  }

  function clearCellUrls() {
    // Revoke blob URLs to free memory (blob URLs hold a reference to the blob)
    for (const cell of cells) {
      if (cell.imageUrl.startsWith("blob:")) URL.revokeObjectURL(cell.imageUrl);
    }
    cells = [];
  }

  // Track the preview stack element for ResizeObserver
  let previewStackElement: HTMLDivElement | undefined = $state();
  let resizeObserver: ResizeObserver | undefined;
  let containerObserver: ResizeObserver | undefined;

  // Calculate "contain" dimensions - fill container while maintaining aspect ratio
  function updateContainedDimensions() {
    if (!containerElement || !previewAspectRatio || !Number.isFinite(previewAspectRatio)) return;

    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    const contentRatio = previewAspectRatio;

    if (containerWidth === 0 || containerHeight === 0) return;

    const containerRatio = containerWidth / containerHeight;

    let newWidth: number | null;
    let newHeight: number | null;

    if (contentRatio > containerRatio) {
      newWidth = containerWidth;
      const h = containerWidth / contentRatio;
      newHeight = Number.isFinite(h) ? h : null;
    } else {
      newHeight = containerHeight;
      const w = containerHeight * contentRatio;
      newWidth = Number.isFinite(w) ? w : null;
    }

    // Only update state if values actually changed (prevents ResizeObserver → state → resize loop)
    const widthChanged = newWidth !== containedWidth && (newWidth === null || containedWidth === null || Math.abs(newWidth - containedWidth) > 0.5);
    const heightChanged = newHeight !== containedHeight && (newHeight === null || containedHeight === null || Math.abs(newHeight - containedHeight) > 0.5);

    if (widthChanged) containedWidth = newWidth;
    if (heightChanged) containedHeight = newHeight;
  }

  // Track cell width for responsive sizing using ResizeObserver
  function updateCellWidth() {
    if (previewStackElement && columns > 0) {
      const stackWidth = previewStackElement.clientWidth;
      const newCellWidth = Number.isFinite(stackWidth / columns) ? stackWidth / columns : 0;
      // Only update state if value actually changed (prevents ResizeObserver loop)
      if (Math.abs(newCellWidth - cellWidth) > 0.5) {
        cellWidth = newCellWidth;
      }
    }
  }

  // Track if initial render is complete
  let hasMounted = false;
  let lastEffectRenderKey = "";

  // Re-render when relevant props or visibility settings change
  $effect(() => {
    // Track all props that affect rendering by reading them (creates Svelte dependency)
    const stepLetters = sequence?.steps?.map(s => s.letter ?? "?").join("") ?? "";
    const stepCount = sequence?.steps?.length ?? 0;
    const bpt = bluePropType;
    const rpt = redPropType;
    const cdm = catDogModeEnabled;
    const ssn = showStepNumbers;
    const cc = columnCount;
    const snr = showNonRadial;
    const hpv = handPointVis;
    const stka = showTKA;
    const sr = showReversals;
    const dm = darkMode;

    // Build a key from all tracked values to detect actual changes
    const renderKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bpt}-${rpt}-${cdm}-${ssn}-${cc}-${snr}-${hpv}-${stka}-${sr}-${dm}`;

    if (!hasMounted) return;
    if (renderKey === lastEffectRenderKey) return;
    lastEffectRenderKey = renderKey;

    untrack(() => {
      renderAllCells();
    });
  });

  // Set up ResizeObserver for container-based "contain" sizing
  $effect(() => {
    if (containerElement) {
      // Clean up previous observer
      if (containerObserver) {
        containerObserver.disconnect();
      }

      // Create new observer
      containerObserver = new ResizeObserver(() => {
        updateContainedDimensions();
      });
      containerObserver.observe(containerElement);

      // Initial measurement
      updateContainedDimensions();
    }

    return () => {
      if (containerObserver) {
        containerObserver.disconnect();
      }
    };
  });

  // Recalculate contained dimensions when aspect ratio changes
  $effect(() => {
    // Track previewAspectRatio dependency
    const _ratio = previewAspectRatio;
    updateContainedDimensions();
  });

  // Set up ResizeObserver for cell width calculation
  $effect(() => {
    if (previewStackElement) {
      // Clean up previous observer
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      // Create new observer
      resizeObserver = new ResizeObserver(() => {
        updateCellWidth();
      });
      resizeObserver.observe(previewStackElement);

      // Initial measurement
      updateCellWidth();
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  });

  onMount(() => {
    renderAllCells().then(() => {
      hasMounted = true;
    });
  });

  onDestroy(() => {
    clearCellUrls();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (containerObserver) {
      containerObserver.disconnect();
    }
  });
</script>

<div class="layered-preview" class:dark-mode={darkMode} bind:this={containerElement}>
  {#if isLoading && cells.length === 0}
    <div class="loading-placeholder">
      <div class="spinner"></div>
    </div>
  {:else if cells.length > 0}
    <div
      class="preview-stack"
      style="width: {containedWidth ? `${containedWidth}px` : 'auto'}; height: {containedHeight ? `${containedHeight}px` : 'auto'};"
      bind:this={previewStackElement}
    >
      <!-- Header section -->
      {#if showHeader}
        <div
          class="header-section"
          style="height: {scaledHeaderHeight}px;"
        >
          {#if showDifficultyLevel}
            <div
              class="difficulty-badge"
              style="
                background: {currentLevelStyle.bg};
                border-color: {currentLevelStyle.border};
                color: {currentLevelStyle.text};
                width: {badgeSize}px;
                height: {badgeSize}px;
                left: {badgePadding}px;
                font-size: {badgeNumberFontSize}px;
              "
            >
              {difficultyLevel}
            </div>
          {/if}

          {#if sequence.word}
            <span
              class="word-title"
              style="font-size: {Math.max(10, Math.floor(scaledHeaderHeight * 0.55))}px;"
            >
              {sequence.word}
            </span>
          {/if}

          {#if showLoopGlyph && loopComponents}
            <div
              class="loop-icon-badge"
              style="height: {badgeSize}px; right: {badgePadding}px;"
            >
              <LOOPIconStrip
                activeComponents={loopComponents}
                size={Math.floor(badgeSize * 0.6)}
                darkMode={darkMode}
                showFreeformWhenEmpty={false}
              />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Grid section with individual pictograph cells -->
      <div
        class="grid-section"
        style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
      >
        {#each visibleCells as cell (cell.index)}
          {#if onStepClick && cell.index >= 0}
            <button
              class="pictograph-cell clickable"
              class:current={showHighlight && highlightedStepIndex === cell.index}
              class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
              style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
              onclick={() => onStepClick(cell.index)}
              type="button"
              aria-label="Go to step {cell.label}"
            >
              {#if cell.isLoaded}
                <img
                  class="cell-image"
                  src={cell.imageUrl}
                  alt={cell.label}
                  draggable="false"
                />
              {:else}
                <div class="cell-spinner-container">
                  <div class="cell-spinner"></div>
                </div>
              {/if}
            </button>
          {:else}
            <div
              class="pictograph-cell"
              class:current={showHighlight && highlightedStepIndex === cell.index}
              class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
              style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
            >
              {#if cell.isLoaded}
                <img
                  class="cell-image"
                  src={cell.imageUrl}
                  alt={cell.label}
                  draggable="false"
                />
              {:else}
                <div class="cell-spinner-container">
                  <div class="cell-spinner"></div>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>

      <!-- Footer section -->
      {#if showFooter}
        <div
          class="footer-section"
          style="height: {scaledFooterHeight}px; padding-left: {footerMargin}px; padding-right: {footerMargin}px; font-size: {footerFontSize}px;"
        >
          {#if showCreatorName && effectiveUserName}
            <span class="footer-name">
              {effectiveUserName}
            </span>
          {/if}

          {#if showNotes}
            <span class="footer-notes">
              {customNotesText}
            </span>
          {/if}

          {#if showBirthday}
            <span class="footer-birthday">
              🎂 {birthdayDate}
            </span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .layered-preview {
    /* Flexbox centering - child dimensions are calculated via JS */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    box-sizing: border-box;
    /* Padding to accommodate highlight scale + glow on edge cells */
    padding: 12px;
    position: relative;
  }

  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--theme-card-bg);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .preview-stack {
    display: flex;
    flex-direction: column;
    /* Dimensions are calculated via JS for true "contain" behavior.
       The container observer calculates optimal width/height that fills
       the available space while maintaining the content's aspect ratio. */
    /* Fallback to auto if JS hasn't calculated yet */
    min-width: 0;
    min-height: 0;
    /* Allow highlight glow to show on edges */
    overflow: visible;
  }

  /* Header section */
  .header-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 245, 245, 0.98);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .dark-mode .header-section {
    background: rgba(10, 10, 15, 0.98);
    border-bottom-color: rgba(255, 255, 255, 0.15);
  }

  .difficulty-badge {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 50%;
    border: 1px solid black;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: Georgia, serif;
    font-weight: bold;
    flex-shrink: 0;
  }

  .word-title {
    font-family: Georgia, serif;
    font-weight: bold;
    color: #000;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }

  .dark-mode .word-title {
    color: #fff;
  }

  .loop-icon-badge {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .dark-mode .loop-icon-badge {
    background: rgba(255, 255, 255, 0.1);
  }

  /* Grid section - CSS Grid layout */
  .grid-section {
    display: grid;
    gap: 0;
    min-height: 0;
    min-width: 0;
    width: 100%;
    /* Let rows size to content - prevents gaps from 1fr row sizing */
    grid-auto-rows: auto;
    /* Ensure grid doesn't overflow container */
    max-width: 100%;
    /* Allow highlight overflow to be visible */
    overflow: visible;
    /* Light mode background for empty cells */
    background: #f5f5f5;
  }

  .dark-mode .grid-section {
    /* Dark mode background for empty cells */
    background: #000;
  }

  /* Individual pictograph cell */
  .pictograph-cell {
    position: relative;
    /* Use padding-bottom trick for aspect ratio to prevent overflow */
    aspect-ratio: 1;
    overflow: visible; /* Allow selection scale to show */
    transition:
      transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.2s ease;
    /* Subtle border for cell separation */
    box-sizing: border-box;
    border: 1px solid rgba(0, 0, 0, 0.08);
    /* Button reset for clickable variant */
    background: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: default;
  }

  button.pictograph-cell {
    cursor: pointer;
  }

  .dark-mode .pictograph-cell {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .cell-image {
    display: block;
    width: 100%;
    height: 100%;
    /* Use 'cover' to fill the cell completely - images are rendered as squares
       so there should be no cropping. 'contain' was causing gaps when images
       had slightly different aspect ratios. */
    object-fit: cover;
    -webkit-user-drag: none;
    user-select: none;
  }

  /* Per-cell loading spinner */
  .cell-spinner-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    aspect-ratio: 1;
  }

  .cell-spinner {
    width: 24%;
    height: 24%;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-top-color: var(--theme-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* Clickable cells */
  .pictograph-cell.clickable {
    cursor: pointer;
  }

  .pictograph-cell.clickable:hover {
    z-index: 5;
    transform: scale(1.02);
  }

  .pictograph-cell.clickable:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
    z-index: 5;
  }

  /* Current step - "Elevated Luxury" selection with scale + glow */
  .pictograph-cell.current {
    z-index: 10;
    transform: scale(1.06);
    box-shadow:
      0 0 12px rgba(251, 191, 36, 0.6),
      0 0 0 3px rgba(251, 191, 36, 0.9);
    animation: cellSelectionGlowIn 0.4s ease-out forwards;
  }

  @keyframes cellSelectionGlowIn {
    0% {
      box-shadow:
        0 0 0 rgba(251, 191, 36, 0),
        0 0 0 0 rgba(251, 191, 36, 0);
      transform: scale(1);
    }
    50% {
      transform: scale(1.08);
    }
    100% {
      box-shadow:
        0 0 12px rgba(251, 191, 36, 0.6),
        0 0 0 3px rgba(251, 191, 36, 0.9);
      transform: scale(1.06);
    }
  }

  /* Played cells (already passed) - dim to distinguish from upcoming */
  .pictograph-cell.played {
    opacity: 0.6;
    transition: opacity 0.15s ease-out;
  }

  /* Light mode needs stronger dimming since opacity against light bg is subtle */
  .layered-preview:not(.dark-mode) .pictograph-cell.played {
    opacity: 0.4;
  }

  /* Footer section */
  .footer-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(245, 245, 245, 0.98);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    font-family: Georgia, serif;
    color: black;
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .dark-mode .footer-section {
    background: rgba(10, 10, 15, 0.98);
    border-top-color: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .footer-name {
    font-weight: bold;
  }

  .footer-notes {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .footer-birthday {
    margin-left: auto;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .spinner,
    .cell-spinner {
      animation: none;
    }

    .pictograph-cell {
      transition: none;
    }

    .pictograph-cell.current {
      animation: none;
      transform: scale(1);
    }
  }
</style>
