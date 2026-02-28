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
  import { simplifyAndTruncate } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { calculateTimelineRows } from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
  import type { TimelineRow } from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import PictographCell from "./PictographCell.svelte";

  // ============================================================================
  // GLOBAL CELL URL CACHE
  // Survives component remounts so drag-to-move doesn't re-render all cells.
  // Keyed by sequence content + render options hash. Capped at 10 entries (LRU).
  // ============================================================================
  interface CachedPreview {
    cells: { index: number; label: string; imageUrl: string; gridColumn: number; gridRow: number; duration: number }[];
    columns: number;
    rows: number;
    durationRows?: TimelineRow[];
    hasMixedDurations?: boolean;
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
    const durationFingerprint = seq.steps?.map(s => s.duration ?? 1).join(",") ?? "";
    // Motion fingerprint captures orientation + rotation data that affects rendering.
    // Without this, two sequences with identical letters but different orientations
    // would collide in the cache.
    const motionFingerprint = seq.steps?.map(s => {
      const b = s.motions?.blue;
      const r = s.motions?.red;
      return `${b?.startOrientation ?? ""}${b?.endOrientation ?? ""}${b?.rotationDirection ?? ""}${r?.startOrientation ?? ""}${r?.endOrientation ?? ""}${r?.rotationDirection ?? ""}`;
    }).join("") ?? "";
    return `${seq.id ?? seq.word ?? "?"}-${stepLetters}-${seq.steps?.length ?? 0}-${opts.size}-${opts.showStepNumbers}-${opts.showNonRadialPoints}-${opts.showTKA}-${opts.showReversals}-${opts.bluePropType ?? ""}-${opts.redPropType ?? ""}-${colCount ?? "auto"}-${isDark ? "dark" : "light"}-d:${durationFingerprint}-m:${motionFingerprint}`;
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
    duration: number;       // Duration units (1.0 = standard)
  }

  // State
  let cells = $state<CellData[]>([]);
  let columns = $state(0);
  let rows = $state(0);
  let isLoading = $state(true);
  let isRendering = false;
  let renderQueued = false;
  let cellWidth = $state(0);
  let hasMixedDurations = $state(false);
  let durationRows = $state<TimelineRow[]>([]);

  // Container-based sizing for "contain" behavior
  let containerElement: HTMLDivElement | undefined = $state();
  let containedWidth = $state<number | null>(null);
  let containedHeight = $state<number | null>(null);

  // Scroll mode for long sequences (>16 beats)
  const SCROLL_THRESHOLD = 16;
  const needsScroll = $derived((sequence?.steps?.length ?? 0) > SCROLL_THRESHOLD);
  let gridScrollRef: HTMLDivElement | undefined = $state();

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

    // In duration mode, width is still `columns` (start col + rowCapacity units).
    // Each row takes 1 cell-height regardless of duration mix.
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
  /**
   * Detect whether the sequence has mixed (non-uniform) durations.
   * Returns false if all durations are 1.0 or undefined.
   */
  function detectMixedDurations(steps: readonly { duration?: number }[]): boolean {
    for (const step of steps) {
      const d = step.duration ?? 1;
      if (Math.abs(d - 1.0) > 0.001) return true;
    }
    return false;
  }

  async function renderAllCells() {
    if (!sequence?.steps?.length) {
      isLoading = false;
      return;
    }

    if (isRendering) {
      renderQueued = true;
      return;
    }
    isRendering = true;

    try {
      const layoutService = layoutCalculator;

      // Calculate layout
      const stepCount = sequence.steps.length;
      let cols: number;
      let rws: number;

      // Detect mixed durations — determines uniform grid vs flexbox rows
      const mixed = detectMixedDurations(sequence.steps);
      hasMixedDurations = mixed;

      if (columnCount !== null && columnCount > 0) {
        // Manual column override (e.g., export mode)
        cols = columnCount;
        const stepsPerRow = cols - 1;
        const firstRowSteps = Math.min(stepsPerRow, stepCount);
        const remainingSteps = stepCount - firstRowSteps;
        rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
      } else if (needsScroll) {
        // Long sequences: fixed 5 columns, scrollable grid
        cols = 5;
        const stepsPerRow = cols - 1;
        const firstRowSteps = Math.min(stepsPerRow, stepCount);
        const remainingSteps = stepCount - firstRowSteps;
        rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
      } else {
        [cols, rws] = layoutService.calculateLayout(stepCount, true);
      }

      columns = cols;

      // For mixed durations: compute timeline rows using row capacity
      let computedDurationRows: TimelineRow[] = [];
      if (mixed) {
        const rowCapacity = cols - 1; // cols includes start position column
        computedDurationRows = calculateTimelineRows(sequence.steps, rowCapacity, true);
        rws = computedDurationRows.length;
        durationRows = computedDurationRows;
      } else {
        durationRows = [];
      }

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
        hasMixedDurations = cached.hasMixedDurations ?? false;
        durationRows = cached.durationRows ?? [];
        isLoading = false;
        isRendering = false;
        // Signal 100% immediately for cache hits
        onRenderProgress?.(cached.cells.length, cached.cells.length);
        return;
      }

      // Collect old blob URLs to revoke AFTER new render completes.
      // Revoking before render causes ERR_FILE_NOT_FOUND flashes
      // because the component still displays old URLs during the async gap.
      const oldBlobUrls = cells
        .filter(c => c.imageUrl.startsWith("blob:"))
        .map(c => c.imageUrl);

      // Find and remove any global cache entries that reference these URLs.
      // Without this, toggling dark→light→dark serves revoked URLs from cache.
      if (oldBlobUrls.length > 0) {
        const urlSet = new Set(oldBlobUrls);
        for (const [key, entry] of globalPreviewCache) {
          if (entry.cells.some(c => urlSet.has(c.imageUrl))) {
            globalPreviewCache.delete(key);
          }
        }
      }

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
          gridColumn, gridRow, duration: 1,
        });
      }

      // Step placeholders
      for (let i = 0; i < sequence.steps.length; i++) {
        const { gridColumn, gridRow } = calculateGridPosition(i, cols);
        placeholderCells.push({
          index: i, label: String(i + 1),
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow,
          duration: sequence.steps[i]?.duration ?? 1,
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
      storePreviewInCache(cacheKey, {
        cells: [...cells],
        columns: cols,
        rows: rws,
        durationRows: computedDurationRows,
        hasMixedDurations: mixed,
      });

      // Now safe to revoke old blob URLs — new ones are in the DOM
      for (const url of oldBlobUrls) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to render cells:", error);
    } finally {
      isRendering = false;
      // If a render was requested while we were busy, run it now
      if (renderQueued) {
        renderQueued = false;
        renderAllCells();
      }
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

    // Use content area (clientWidth minus padding), not clientWidth which includes padding.
    // The .preview-stack child lives in the content area, so contain must fit within it.
    const style = getComputedStyle(containerElement);
    const containerWidth = containerElement.clientWidth
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const containerHeight = containerElement.clientHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    if (containerWidth === 0 || containerHeight === 0) return;

    let newWidth: number | null;
    let newHeight: number | null;

    if (needsScroll) {
      // Scroll mode: CSS handles sizing (width/height: 100% on .preview-stack).
      // No JS contain calculation needed — just skip.
      return;
    } else {
      // Contain mode: fit content while preserving aspect ratio
      const contentRatio = previewAspectRatio;
      const containerRatio = containerWidth / containerHeight;

      if (contentRatio > containerRatio) {
        newWidth = containerWidth;
        const h = containerWidth / contentRatio;
        newHeight = Number.isFinite(h) ? h : null;
      } else {
        newHeight = containerHeight;
        const w = containerHeight * contentRatio;
        newWidth = Number.isFinite(w) ? w : null;
      }
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

    const durationKey = sequence?.steps?.map(s => s.duration ?? 1).join(",") ?? "";
    // Build a key from all tracked values to detect actual changes
    const renderKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bpt}-${rpt}-${cdm}-${ssn}-${cc}-${snr}-${hpv}-${stka}-${sr}-${dm}-${durationKey}`;

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

  // Auto-scroll to keep highlighted step visible during playback
  $effect(() => {
    const stepIdx = highlightedStepIndex;
    if (!needsScroll || !gridScrollRef || stepIdx == null) return;

    const cell = gridScrollRef.querySelector('.pictograph-cell.current');
    if (cell) {
      // 'nearest' only scrolls when the cell is outside the viewport — no jumps
      // when the highlighted cell is already visible
      cell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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

<div class="layered-preview" class:dark-mode={darkMode} class:scroll-mode={needsScroll} bind:this={containerElement}>
  {#if isLoading && cells.length === 0}
    <div class="loading-placeholder">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
    </div>
  {:else if cells.length > 0}
    <div
      class="preview-stack"
      class:scroll-mode={needsScroll}
      style={needsScroll ? '' : `width: ${containedWidth ? `${containedWidth}px` : 'auto'}; height: ${containedHeight ? `${containedHeight}px` : 'auto'};`}
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
              {simplifyAndTruncate(sequence.word, 12)}
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
      {#if hasMixedDurations && durationRows.length > 0}
        <!-- Duration-aware flexbox layout: rows wrap by duration capacity -->
        {#if needsScroll}
          <div class="grid-scroll-container themed-scrollbar" bind:this={gridScrollRef}>
            <div class="duration-rows-container">
              {#each durationRows as row, rowIdx (rowIdx)}
                <div class="duration-row">
                  {#if rowIdx === 0 && includeStartPosition}
                    {@const startCell = cells.find(c => c.index === -1)}
                    {#if startCell}
                      <div class="duration-cell" style="flex: 1;">
                        <PictographCell
                          index={startCell.index} label={startCell.label}
                          imageUrl={startCell.imageUrl} isLoaded={startCell.isLoaded}
                          {darkMode} {showHighlight} {highlightedStepIndex}
                        />
                      </div>
                    {/if}
                  {/if}
                  {#each row.steps as { stepIndex, duration } (stepIndex)}
                    {@const cell = cells.find(c => c.index === stepIndex)}
                    {#if cell}
                      <div class="duration-cell" style="flex: {duration};">
                        <PictographCell
                          index={cell.index} label={cell.label}
                          imageUrl={cell.imageUrl} isLoaded={cell.isLoaded}
                          {darkMode} {showHighlight} {highlightedStepIndex} {onStepClick}
                        />
                      </div>
                    {/if}
                  {/each}
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="duration-rows-container">
            {#each durationRows as row, rowIdx (rowIdx)}
              <div class="duration-row">
                {#if rowIdx === 0 && includeStartPosition}
                  {@const startCell = cells.find(c => c.index === -1)}
                  {#if startCell}
                    <div class="duration-cell" style="flex: 1;">
                      <PictographCell
                        index={startCell.index} label={startCell.label}
                        imageUrl={startCell.imageUrl} isLoaded={startCell.isLoaded}
                        {darkMode} {showHighlight} {highlightedStepIndex}
                      />
                    </div>
                  {/if}
                {/if}
                {#each row.steps as { stepIndex, duration } (stepIndex)}
                  {@const cell = cells.find(c => c.index === stepIndex)}
                  {#if cell}
                    <div class="duration-cell" style="flex: {duration};">
                      <PictographCell
                        index={cell.index} label={cell.label}
                        imageUrl={cell.imageUrl} isLoaded={cell.isLoaded}
                        {darkMode} {showHighlight} {highlightedStepIndex} {onStepClick}
                      />
                    </div>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      {:else if needsScroll}
        <!-- Uniform grid: scroll mode -->
        <div class="grid-scroll-container themed-scrollbar" bind:this={gridScrollRef}>
          <div
            class="grid-section"
            style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
          >
            {#each visibleCells as cell (cell.index)}
              <PictographCell
                index={cell.index} label={cell.label}
                imageUrl={cell.imageUrl} isLoaded={cell.isLoaded}
                {darkMode} {showHighlight} {highlightedStepIndex} {onStepClick}
                gridColumn={cell.gridColumn} gridRow={cell.gridRow}
              />
            {/each}
          </div>
        </div>
      {:else}
        <!-- Uniform grid: standard mode -->
        <div
          class="grid-section"
          style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
        >
          {#each visibleCells as cell (cell.index)}
            <PictographCell
              index={cell.index} label={cell.label}
              imageUrl={cell.imageUrl} isLoaded={cell.isLoaded}
              {darkMode} {showHighlight} {highlightedStepIndex} {onStepClick}
              gridColumn={cell.gridColumn} gridRow={cell.gridRow}
            />
          {/each}
        </div>
      {/if}

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

  /* In scroll mode, the scroll container's own padding handles glow space.
     Fill the container edge-to-edge instead of centering with extra padding. */
  .layered-preview.scroll-mode {
    padding: 0;
    align-items: stretch;
    justify-content: stretch;
  }

  .loading-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: var(--theme-card-bg);
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

  /* In scroll mode, fill the parent edge-to-edge instead of using
     JS-calculated contain dimensions */
  .preview-stack.scroll-mode {
    width: 100%;
    height: 100%;
    overflow: hidden;
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

  /* Scroll container for long sequences (>16 beats) */
  .grid-scroll-container {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    /* Padding accommodates highlight scale(1.06) + 3px ring + inner blur.
       12px covers the solid ring and visible glow; outermost blur fringe
       (nearly transparent) gets clipped by overflow-x:hidden — acceptable. */
    padding: 12px;
  }

  /* Duration-aware flexbox layout */
  .duration-rows-container {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
    min-height: 0;
    min-width: 0;
    max-width: 100%;
    overflow: visible;
    background: #f5f5f5;
  }

  .dark-mode .duration-rows-container {
    background: #000;
  }

  .duration-row {
    display: flex;
    gap: 0;
    width: 100%;
  }

  .duration-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
  }

  .duration-cell :global(.pictograph-cell) {
    width: 100%;
    /* Height matches the row height; aspect-ratio on the image keeps it square */
    aspect-ratio: auto;
    height: 100%;
  }

  .duration-cell :global(.cell-image) {
    /* Keep image square and centered within the (potentially wider) cell */
    height: 100%;
    aspect-ratio: 1;
    width: auto;
    object-fit: cover;
    margin: 0 auto;
    display: block;
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

  /* Cell styles live in PictographCell.svelte */

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
    .grid-scroll-container {
      scroll-behavior: auto;
    }
  }
</style>
