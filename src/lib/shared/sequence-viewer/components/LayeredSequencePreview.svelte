<!--
  LayeredSequencePreview.svelte

  Renders a sequence preview with individually animated pictograph cells.
  Each pictograph is rendered separately, enabling:
  - Per-cell selection animation (scale + glow) during playback
  - Smooth start position toggle animation (cell slides in/out)
  - Independent visibility toggles without full re-render

  Structure:
  - Header section (word + difficulty badge) - animates in/out
  - Grid section (individual pictograph cells, each animatable)
  - Footer section (name, notes, birthday) - each animates independently
-->
<script lang="ts">
  // Transitions removed - they caused NaN keyframe errors on initial mount
  // when the container hadn't been sized yet (aspect-ratio elements)
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
  import type { LayerRenderOptions, LayerVisibility } from "$lib/shared/render/services/contracts/ILayerCompositor";
  import type { IPictographPreparer } from "$lib/shared/pictograph/shared/services/contracts/IPictographPreparer";
  import { onMount, onDestroy, untrack } from "svelte";
  import { layerCompositor } from "$lib/shared/render/services/implementations/LayerCompositor";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/implementations/PictographPreparer";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
  import { simplifyRepeatedWord } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { LOOPTypeResolver } from "$lib/features/create/generate/shared/services/implementations/LOOPTypeResolver";
  import { loopDetector } from "$lib/features/create/generate/circular/services/implementations/LOOPDetector";
  import LOOPIconStrip from "$lib/shared/components/LOOPIconStrip.svelte";
  import { createStartPositionFromBeatStart } from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";
  import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";

  interface Props {
    sequence: SequenceData;
    // Visibility toggles
    showWord?: boolean;
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
  }

  const {
    sequence,
    showWord = true,
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
  }: Props = $props();

  // Constants
  // Render at high resolution for crisp display on 4K monitors
  // Images scale down cleanly on lower-resolution displays
  const CELL_SIZE = 480; // Render size for each pictograph

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
    lightUrl: string;       // Light mode image URL
    darkUrl: string;        // Dark mode image URL
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

  // Layout calculations
  const difficultyCalculator = new SequenceDifficultyCalculator();

  // Derive word from sequence (with null safety)
  const derivedWord = $derived.by(() => {
    const rawWord = sequence.word || (sequence.steps ?? [])
      .filter(beat => beat.letter)
      .map(beat => beat.letter)
      .join("");
    return simplifyRepeatedWord(rawWord);
  });

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

  // Show header when word, difficulty, or LOOP glyph is enabled
  const showHeader = $derived(
    (showWord && derivedWord) || showDifficultyLevel || (showLoopGlyph && loopComponents)
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

  const wordFontSize = $derived(Math.max(10, scaledHeaderHeight * 0.9));
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
   * Generate a cache key for a pictograph based on its data and render options
   */
  function derivePictographCacheKey(
    pictographData: any,
    stepNumber: number | undefined,
    isDark: boolean
  ): string {
    // Build a deterministic key from all rendering parameters
    const keyParts = [
      pictographData.letter || "start",
      pictographData.motions?.blue?.motionType || "none",
      pictographData.motions?.blue?.startLocation || "",
      pictographData.motions?.blue?.endLocation || "",
      pictographData.motions?.blue?.turns ?? 0,
      pictographData.motions?.red?.motionType || "none",
      pictographData.motions?.red?.startLocation || "",
      pictographData.motions?.red?.endLocation || "",
      pictographData.motions?.red?.turns ?? 0,
      bluePropType || "staff",
      catDogModeEnabled ? (redPropType || "staff") : (bluePropType || "staff"),
      isDark ? "dark" : "light",
      showStepNumbers ? (stepNumber ?? "none") : "nonum",
      CELL_SIZE,
    ];

    // djb2 hash
    const str = keyParts.join("|");
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return `lsp-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Render a single pictograph to a data URL (with IndexedDB caching)
   */
  async function renderPictograph(
    pictographData: any,
    stepNumber: number | undefined,
    isDark: boolean
  ): Promise<string> {
    // Generate cache key
    const cacheKey = derivePictographCacheKey(pictographData, stepNumber, isDark);

    // Check IndexedDB cache first
    try {
      const cachedBlob = await pictographBlobCache.get(cacheKey);
      if (cachedBlob) {
        // Convert blob to data URL
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(cachedBlob);
        });
      }
    } catch (err) {
      // Cache miss or error, proceed to render
    }

    const compositor = layerCompositor;

    // Prepare the pictograph data
    const prepared = await pictographPreparer.prepareSingle(pictographData, {
      themeMode: isDark ? "dark" : "light",
      bluePropType: bluePropType,
      redPropType: catDogModeEnabled ? redPropType : bluePropType,
    });

    // Render options
    const options: LayerRenderOptions = {
      size: CELL_SIZE,
      darkMode: isDark,
      showNonRadialPoints: true,
      handPointVisibility: "all",
      bluePropType: bluePropType,
      redPropType: catDogModeEnabled ? redPropType : bluePropType,
    };

    // Visibility settings
    const visibility: LayerVisibility = {
      showTKA: true,
      showReversals: true,
    };

    // Compose the pictograph
    const result = await compositor.compose(
      prepared,
      options,
      visibility,
      showStepNumbers ? stepNumber : undefined
    );

    // Convert canvas to blob for caching
    const dataUrl = result.canvas.toDataURL("image/png");

    // Cache the result asynchronously (don't await)
    result.canvas.toBlob((blob) => {
      if (blob) {
        pictographBlobCache.set(cacheKey, blob).catch(() => {
          // Ignore cache write errors
        });
      }
    }, "image/png");

    return dataUrl;
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
    const renderStart = performance.now();
    console.log(`[RENDER] renderAllCells START`);

    if (!sequence?.steps?.length) {
      isLoading = false;
      console.log(`[RENDER] renderAllCells SKIP - no steps`);
      return;
    }

    if (isRendering) {
      console.log(`[RENDER] renderAllCells SKIP - already rendering`);
      return;
    }
    isRendering = true;
    console.log(`[RENDER] renderAllCells STARTED, ${sequence.steps.length} steps to render`);

    try {
      const layoutService = layoutCalculator;

      // Calculate layout
      const stepCount = sequence.steps.length;
      let cols: number;
      let rws: number;

      if (columnCount !== null && columnCount > 0) {
        // User-specified column count
        cols = columnCount;
        // Calculate rows: first row has (cols - 1) steps, subsequent rows have (cols - 1) each
        // Total items = 1 (start) + stepCount
        const stepsPerRow = cols - 1;
        const firstRowSteps = Math.min(stepsPerRow, stepCount);
        const remainingSteps = stepCount - firstRowSteps;
        rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
      } else {
        // Auto-calculate layout
        [cols, rws] = layoutService.calculateLayout(stepCount, true);
      }

      columns = cols;
      rows = rws;

      const newCells: CellData[] = [];

      // Render start position
      const firstStep = sequence.steps[0];
      if (sequence.startPosition || firstStep) {
        const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);

        const [lightUrl, darkUrl] = await Promise.all([
          renderPictograph(startData, undefined, false),
          renderPictograph(startData, undefined, true),
        ]);

        const { gridColumn, gridRow } = calculateGridPosition(-1, cols);
        newCells.push({
          index: -1,
          label: "Start",
          lightUrl,
          darkUrl,
          gridColumn,
          gridRow,
        });
      }

      // Render each step
      for (let i = 0; i < sequence.steps.length; i++) {
        const step = sequence.steps[i];
        const [lightUrl, darkUrl] = await Promise.all([
          renderPictograph(step, i + 1, false),
          renderPictograph(step, i + 1, true),
        ]);

        const { gridColumn, gridRow } = calculateGridPosition(i, cols);
        newCells.push({
          index: i,
          label: String(i + 1),
          lightUrl,
          darkUrl,
          gridColumn,
          gridRow,
        });
      }

      // Clear old URLs
      clearCellUrls();

      cells = newCells;
      console.log(`[RENDER] renderAllCells COMPLETE in ${(performance.now() - renderStart).toFixed(2)}ms`);
    } catch (error) {
      console.error("Failed to render cells:", error);
    } finally {
      isLoading = false;
      isRendering = false;
    }
  }

  function clearCellUrls() {
    // Data URLs don't need to be revoked, but if we switch to blob URLs we'd do it here
    cells = [];
  }

  // Track the preview stack element for ResizeObserver
  let previewStackElement: HTMLDivElement | undefined = $state();
  let resizeObserver: ResizeObserver | undefined;
  let containerObserver: ResizeObserver | undefined;

  // Calculate "contain" dimensions - fill container while maintaining aspect ratio
  let resizeCallCount = 0;
  let lastResizeLogTime = 0;

  function updateContainedDimensions() {
    if (!containerElement || !previewAspectRatio || !Number.isFinite(previewAspectRatio)) return;

    resizeCallCount++;
    const now = performance.now();
    // Log resize calls but throttle to avoid console spam
    if (now - lastResizeLogTime > 50) {
      console.log(`[RESIZE] updateContainedDimensions called (call #${resizeCallCount})`);
      lastResizeLogTime = now;
    }

    const containerWidth = containerElement.clientWidth;
    const containerHeight = containerElement.clientHeight;
    const contentRatio = previewAspectRatio;

    if (containerWidth === 0 || containerHeight === 0) return;

    const containerRatio = containerWidth / containerHeight;

    if (contentRatio > containerRatio) {
      // Content is wider than container - constrain by width
      containedWidth = containerWidth;
      const newHeight = containerWidth / contentRatio;
      containedHeight = Number.isFinite(newHeight) ? newHeight : null;
    } else {
      // Content is taller than container - constrain by height
      containedHeight = containerHeight;
      const newWidth = containerHeight * contentRatio;
      containedWidth = Number.isFinite(newWidth) ? newWidth : null;
    }
  }

  // Track cell width for responsive sizing using ResizeObserver
  let cellWidthCallCount = 0;
  let lastCellWidthLogTime = 0;

  function updateCellWidth() {
    if (previewStackElement && columns > 0) {
      cellWidthCallCount++;
      const now = performance.now();
      if (now - lastCellWidthLogTime > 50) {
        console.log(`[RESIZE] updateCellWidth called (call #${cellWidthCallCount})`);
        lastCellWidthLogTime = now;
      }

      // Calculate cell width from the preview stack width
      const stackWidth = previewStackElement.clientWidth;
      const newCellWidth = stackWidth / columns;
      // Guard against NaN/Infinity from division edge cases
      cellWidth = Number.isFinite(newCellWidth) ? newCellWidth : 0;
    }
  }

  // Track if initial render is complete
  let hasMounted = false;

  // Re-render when relevant props change
  $effect(() => {
    // Track all props that affect rendering
    const _sequence = sequence;
    const _sequenceSteps = sequence?.steps;
    const _bluePropType = bluePropType;
    const _redPropType = redPropType;
    const _catDogModeEnabled = catDogModeEnabled;
    const _showStepNumbers = showStepNumbers;
    const _columnCount = columnCount;

    console.log(`[EFFECT] LayeredSequencePreview re-render effect triggered, hasMounted=${hasMounted}`);

    if (hasMounted) {
      untrack(() => {
        renderAllCells();
      });
    }
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

          {#if showWord && derivedWord}
            <span
              class="word-text"
              style="font-size: {wordFontSize}px;"
            >
              {derivedWord}
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
              <!-- Light mode image -->
              <img
                class="cell-image light-image"
                class:hidden={darkMode}
                src={cell.lightUrl}
                alt={cell.label}
                draggable="false"
              />
              <!-- Dark mode image -->
              <img
                class="cell-image dark-image"
                class:visible={darkMode}
                src={cell.darkUrl}
                alt={cell.label}
                draggable="false"
              />
            </button>
          {:else}
            <div
              class="pictograph-cell"
              class:current={showHighlight && highlightedStepIndex === cell.index}
              class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
              style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
            >
              <!-- Light mode image -->
              <img
                class="cell-image light-image"
                class:hidden={darkMode}
                src={cell.lightUrl}
                alt={cell.label}
                draggable="false"
              />
              <!-- Dark mode image -->
              <img
                class="cell-image dark-image"
                class:visible={darkMode}
                src={cell.darkUrl}
                alt={cell.label}
                draggable="false"
              />
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

  .word-text {
    font-family: Georgia, serif;
    font-weight: 700;
    color: #1f2937;
  }

  .dark-mode .word-text {
    color: #ffffff;
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

  /* Light/dark mode crossfade */
  .light-image {
    opacity: 1;
    transition: opacity 0.25s ease-out;
  }

  .light-image.hidden {
    opacity: 0;
  }

  .dark-image {
    position: absolute;
    top: 0;
    left: 0;
    opacity: 0;
    transition: opacity 0.25s ease-out;
  }

  .dark-image.visible {
    opacity: 1;
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
    .spinner {
      animation: none;
    }

    .pictograph-cell {
      transition: none;
    }

    .pictograph-cell.current {
      animation: none;
      transform: scale(1);
    }

    .light-image,
    .dark-image {
      transition: none;
    }
  }
</style>
