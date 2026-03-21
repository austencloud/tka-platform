<!--
  ChoreoCard.svelte

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
  import { fade, fly, scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";
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
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuEntry, ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import { featureFlagService } from "$lib/shared/auth/services/PostHogFeatureFlagService.svelte";
  import { container } from "$lib/shared/di";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/ShareOptions";
  import { createStartPositionFromBeatStart } from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";
  import { previewCellRenderer } from "../services/implementations/PreviewCellRenderer";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { simplifyAndTruncate } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { calculateTimelineRowsByBeatCount } from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
  import type { TimelineRow } from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

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
    durationColCount?: number;
    passDividerGridRows?: number[];
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
    const vm = opts.browseViewMode;
    const vmKey = vm ? `${vm.subject}-${vm.granularity}-${vm.color}` : "default";
    return `${seq.id ?? seq.word ?? "?"}-${stepLetters}-${seq.steps?.length ?? 0}-${opts.size}-${opts.showStepNumbers}-${opts.showNonRadialPoints}-${opts.showTKA}-${opts.showReversals}-${opts.handPathMode ?? false}-${opts.bluePropType ?? ""}-${opts.redPropType ?? ""}-${colCount ?? "auto"}-${isDark ? "dark" : "light"}-d:${durationFingerprint}-m:${motionFingerprint}-vm:${vmKey}`;
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
    showWord?: boolean;
    showStepNumbers?: boolean;
    showDifficultyLevel?: boolean;
    includeStartPosition?: boolean;
    showCreatorName?: boolean;
    showNotes?: boolean;
    showBirthday?: boolean;
    showLoopGlyph?: boolean;
    showQRCode?: boolean;
    /** Render as hand path visualization (HAND props, float arrows, no TKA) */
    handPathMode?: boolean;
    /** Browse view mode for solo prop/hand filtering */
    browseViewMode?: import("$lib/features/browse/shared/domain/BrowseViewMode").BrowseViewMode;
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
    forceContain?: boolean;  // Force contain mode even for long sequences (disables scroll)
    fitWidth?: boolean;  // Always constrain by width (mobile export: let parent scroll for tall cards)
    // Render progress callback (loaded cells, total cells)
    onRenderProgress?: (loaded: number, total: number) => void;
    // Context menu callback (right-click / long-press)
    onContextMenu?: (x: number, y: number) => void;
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
    showQRCode = false,
    handPathMode = false,
    browseViewMode,
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
    forceContain = false,
    fitWidth = false,
    onRenderProgress,
    onContextMenu,
  }: Props = $props();

  // Long-press for touch context menu (matches animation canvas pattern)
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressOrigin: { x: number; y: number } | null = null;
  let longPressFired = false;

  function cancelLongPress(): void {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressOrigin = null;
  }

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
    fadeOutUrl?: string;    // Previous image URL during dark mode cross-fade
  }

  // State
  let cells = $state<CellData[]>([]);
  let columns = $state(0);
  let rows = $state(0);
  let isLoading = $state(true);
  let isRendering = false;
  let renderQueued = false;
  // Suppress ResizeObserver-driven updates during sequential cell loading.
  // Explicit calls from renderAllCells() still work; only observer callbacks are blocked.
  let suppressObserverUpdates = false;
  let cellWidth = $state(0);
  // Tracks previous column count so we can skip flip animation during
  // start-position toggles (container resize handles the visual transition).
  let prevEffectiveColumns = $state(0);
  let suppressFlip = $state(false);
  let hasMixedDurations = $state(false);
  let durationRows = $state<TimelineRow[]>([]);
  /** Max duration units in any single row (including start position), for CSS --col-count */
  let durationColCount = $state(0);

  // Cross-fade state: smooth dark mode transitions without sequential spinners
  let crossfadeActive = $state(false);
  let crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  // Initialize to the prop value so the first render has the correct dark mode class.
  // Do NOT initialize to false — that causes a one-frame flash where backgrounds
  // render in light mode even though the images are rendered for dark mode.
  let activeDarkMode = $state(untrack(() => darkMode));
  let lastContentKey = "";
  let lastImageKey = "";

  // Container-based sizing for "contain" behavior
  let containerElement: HTMLDivElement | undefined = $state();
  let containedWidth = $state<number | null>(null);
  let containedHeight = $state<number | null>(null);
  let heightGrowing = $state(false);

  // Scroll mode for long sequences (>16 beats)
  const SCROLL_THRESHOLD = 16;
  // Whether the sequence exceeds scroll threshold (independent of forceContain)
  const isLongSequence = $derived((sequence?.steps?.length ?? 0) > SCROLL_THRESHOLD);
  const needsScroll = $derived(!forceContain && isLongSequence);
  let gridScrollRef: HTMLDivElement | undefined = $state();

  // Orientation cycle pass dividers
  // When orientationCycleCount > 1, the sequence contains multiple passes.
  // We insert visual dividers between them so the performer knows where
  // each repetition starts.
  const orientationCycleCount = $derived(sequence?.orientationCycleCount ?? 1);
  const stepsPerPass = $derived.by(() => {
    if (orientationCycleCount <= 1) return 0;
    const totalSteps = sequence?.steps?.length ?? 0;
    return Math.floor(totalSteps / orientationCycleCount);
  });
  // Step indices where a pass boundary occurs (0-indexed step indices).
  // E.g., for 8 steps with cycleCount=2, stepsPerPass=4 → boundary at index 4
  const passBoundaryStepIndices = $derived.by(() => {
    if (orientationCycleCount <= 1 || stepsPerPass <= 0) return [];
    const boundaries: number[] = [];
    for (let pass = 1; pass < orientationCycleCount; pass++) {
      boundaries.push(pass * stepsPerPass);
    }
    return boundaries;
  });

  // Visibility settings from user preferences (reactive)
  const visibilitySettings = $derived(getSettings().visibility);
  const showNonRadial = $derived(visibilitySettings?.nonRadialPoints ?? true);
  const handPointVis = $derived<"all" | "active">(visibilitySettings?.handPointVisibility ?? "all");
  const showTKA = $derived(visibilitySettings?.tkaGlyph ?? true);
  const showReversals = $derived(visibilitySettings?.reversalIndicators ?? true);

  // QR code state — generated async, cached by sequence ID + dark mode.
  // The grid cell is always reserved (via qrGridPosition) so layout doesn't
  // shift when the QR image loads in.
  let qrDataUrl = $state<string | null>(null);
  const qrCacheMap = new Map<string, string>();
  let lastQrKey = "";

  // Find the grid position for the QR code: bottom of column 1 (under start position).
  // Only show when there are naturally 2+ rows — don't force an extra row for short sequences.
  const qrGridPosition = $derived.by(() => {
    if (!showQRCode || !includeStartPosition || effectiveRows < 2) return null;
    return { gridColumn: 1, gridRow: effectiveRows };
  });

  // Derive a stable cache key from the values that actually matter for QR content.
  // This prevents re-generation when unrelated reactive values change.
  const qrCacheKey = $derived.by(() => {
    if (!showQRCode || !sequence) return "";
    const seqId = sequence.id ?? sequence.word ?? "unknown";
    return `${seqId}:${darkMode}`;
  });

  $effect(() => {
    const key = qrCacheKey;
    if (!key) {
      qrDataUrl = null;
      lastQrKey = "";
      return;
    }

    // Skip if we already generated for this exact key
    if (key === lastQrKey) return;
    lastQrKey = key;

    // Check cache first
    const cached = qrCacheMap.get(key);
    if (cached) {
      qrDataUrl = cached;
      return;
    }

    // Generate async — read prop values outside the async callback
    // to avoid tracking additional reactive dependencies
    const seq = sequence;
    const isDark = darkMode;
    const bProp = bluePropType ? String(bluePropType) : undefined;
    const rProp = redPropType ? String(redPropType) : undefined;
    const qrGenerator = container.items.qrCodeGenerator;
    if (!qrGenerator || !seq) return;

    qrGenerator
      .generateForSequence(seq, {
        size: 200,
        margin: 1,
        style: "modern",
        darkMode: isDark,
        offline: false,
        bluePropType: bProp,
        redPropType: rProp,
      })
      .then((result) => {
        qrCacheMap.set(key, result.dataUrl);
        // Only update if this is still the current key (sequence didn't change mid-flight)
        if (lastQrKey === key) {
          qrDataUrl = result.dataUrl;
        }
      })
      .catch(() => {
        // QR is optional — don't block the card
      });
  });

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

  // Solo mode: hide dual-prop metadata (word, letters, difficulty, LOOP)
  // When browseViewMode has granularity "solo", we're showing one prop/hand only.
  // The header shows a color label instead of the sequence word.
  const isSoloMode = $derived(browseViewMode?.granularity === "solo");
  const soloColor = $derived(browseViewMode?.color);

  // Show header when difficulty, LOOP glyph, or word is enabled
  const showHeader = $derived(
    isSoloMode ||
    showDifficultyLevel || (showLoopGlyph && loopComponents) || (showWord && sequence.word)
  );

  // Show footer when any footer element is enabled
  const hasPathShapeMetadata = $derived(sequence?.metadata?.pathShape === "linear");
  const showFooter = $derived(showCreatorName || showNotes || showBirthday || hasPathShapeMetadata);

  // Format birthday date — use the sequence's saved birthday when available
  const birthdayDate = $derived.by(() => {
    const date = sequence.birthday ?? sequence.createdAt ?? sequence.dateAdded ?? new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  });

  // Effective username
  const effectiveUserName = $derived(userName || authState.user?.displayName || "");

  // Level badge colors — single source of truth shared with the image compositor
  const currentLevelStyle = $derived.by(() => {
    const style = DIFFICULTY_LEVELS[difficultyLevel] ?? DEFAULT_DIFFICULTY_STYLE;
    return { bg: style.cssBg, border: style.border, text: style.text };
  });

  // Filtered cells based on includeStartPosition.
  // Start cell (index -1) is always excluded here and rendered separately
  // so it can have its own enter/exit transition without breaking animate:flip.
  // When start position is hidden, recalculate grid positions so steps
  // fill the grid from column 1 (instead of leaving a gap at column 1).
  const visibleCells = $derived.by(() => {
    if (includeStartPosition) {
      return cells.filter(cell => cell.index !== -1);
    }
    const cols = effectiveColumns || 4;
    return cells
      .filter(cell => cell.index !== -1)
      .map(cell => ({
        ...cell,
        gridColumn: (cell.index % cols) + 1,
        gridRow: Math.floor(cell.index / cols) + 1,
      }));
  });

  // Effective columns — synchronously computed from layout tables so the grid
  // updates immediately when includeStartPosition toggles (before async re-render).
  const effectiveColumns = $derived.by(() => {
    if (!sequence?.steps?.length) return columns || 0;
    const stepCount = sequence.steps.length;

    if (columnCount !== null && columnCount > 0) {
      // columnCount is the number of *beat* columns the user wants.
      // When the start position is shown, add 1 for its column.
      return includeStartPosition ? columnCount + 1 : columnCount;
    }
    // Long sequences use fixed 5 columns whether scrolling or force-contained.
    // This keeps the cell grid positions consistent so entering export mode
    // doesn't trigger a full re-render with different column positions.
    if (isLongSequence) {
      return 5;
    }
    // Use the layout service directly for an instant column count
    const [cols] = layoutCalculator.calculateLayout(stepCount, includeStartPosition);
    return cols;
  });

  // When the column count changes (start position toggle, column picker),
  // skip flip animation so cells snap to new positions while the container
  // resize transition handles the visual smoothness.
  $effect(() => {
    const cols = effectiveColumns;
    if (prevEffectiveColumns > 0 && cols !== prevEffectiveColumns) {
      suppressFlip = true;
      // Re-enable flip after the container resize transition completes
      setTimeout(() => { suppressFlip = false; }, 300);
    }
    prevEffectiveColumns = cols;
  });

  // Effective rows — must match effective columns to keep aspect ratio correct.
  // When columnCount is overridden or isLongSequence forces 5 columns, calculate
  // rows from that column count instead of the layout table (which assumes its own columns).
  const effectiveRows = $derived.by(() => {
    if (!sequence?.steps?.length) return rows || 0;
    const stepCount = sequence.steps.length;

    // If we know the column count (override or long-sequence), derive rows from it
    const cols = effectiveColumns;
    if (cols > 0 && (columnCount !== null || isLongSequence)) {
      const stepsPerRow = includeStartPosition ? cols - 1 : cols;
      const firstRowSteps = Math.min(stepsPerRow, stepCount);
      const remainingSteps = stepCount - firstRowSteps;
      return 1 + Math.ceil(remainingSteps / stepsPerRow);
    }

    const [, rws] = layoutCalculator.calculateLayout(stepCount, includeStartPosition);
    return rws;
  });

  // Compute aspect ratio for the entire preview (width / height)
  // This ensures the preview maintains correct proportions regardless of container size
  const previewAspectRatio = $derived.by(() => {
    if (!effectiveColumns || !effectiveRows) return 1;

    // Width in cell units — use effectiveColumns so the aspect ratio updates
    // instantly when includeStartPosition toggles (before async re-render).
    const gridWidth = effectiveColumns;

    // In duration mode, each row's pixel height = cardWidth / durationColCount
    // (because the widest row fills the card, and images maintain aspect ratio).
    // In cell units: rowHeight = columns / durationColCount.
    // For uniform grid: rowHeight = 1 cell unit (square cells).
    const rowHeightInCellUnits = (hasMixedDurations && durationColCount > 0)
      ? effectiveColumns / durationColCount
      : 1;
    const gridHeight = effectiveRows * rowHeightInCellUnits;

    // Header adds ~1/3 cell height, footer adds ~1/7 cell height.
    // For narrow grids (<=2 columns), scale fractions down so header/footer
    // don't dominate the card. This matches the headerFooterRefWidth cap.
    const cols = effectiveColumns;
    const hfScale = cols >= 3 ? 1 : cols / 3;
    const headerFraction = showHeader ? (1/3) * hfScale : 0;
    const footerFraction = showFooter ? (1/7) * hfScale : 0;

    // Total height in cell-height units
    const totalHeight = gridHeight + headerFraction + footerFraction;

    // Aspect ratio = width / height
    return gridWidth / totalHeight;
  });

  // Scaled sizes based on grid element width.
  // When only 2 columns are visible, cells are very wide and the header/footer
  // become disproportionately large. Cap the reference width as if there were
  // at least 3 columns so header/footer stay compact.
  const headerFooterRefWidth = $derived.by(() => {
    if (!cellWidth || !Number.isFinite(cellWidth)) return 0;
    const cols = effectiveColumns || 1;
    if (cols >= 3) return cellWidth;
    // Scale down: use (containerWidth / 3) instead of (containerWidth / 2)
    return cellWidth * cols / 3;
  });

  const scaledHeaderHeight = $derived.by(() => {
    if (!headerFooterRefWidth) return 0;
    const proportional = Math.floor(headerFooterRefWidth / 3);
    // On-screen viewing needs a minimum readable height (24px).
    // Export/forceContain mode uses exact proportional sizing for WYSIWYG fidelity.
    return forceContain ? proportional : Math.max(proportional, 24);
  });

  const scaledFooterHeight = $derived.by(() => {
    if (!headerFooterRefWidth) return 0;
    return Math.floor(headerFooterRefWidth / 7);
  });

  // Step number font size: 10.526% of cell width (which equals row height
  // for square cells). Using cellWidth directly instead of cqw ensures
  // consistent sizing even for wider duration cells.
  const stepNumFontSize = $derived(
    cellWidth ? Math.min(Math.round(cellWidth * 0.10526), 28) : 0
  );

  const badgeSize = $derived(scaledHeaderHeight * 0.9);
  const badgePadding = $derived(scaledHeaderHeight * 0.05);
  const badgeNumberFontSize = $derived(Math.round(badgeSize * 0.5625));

  // Word title font size: shrinks for longer words so the full title fits
  // between the difficulty badge and LOOP icon without clipping.
  // Count letter units (dashes don't count as separate letters).
  const wordTitleFontSize = $derived.by(() => {
    const baseFontSize = Math.floor(scaledHeaderHeight * 0.66);
    if (!sequence.word) return baseFontSize;

    const displayWord = simplifyAndTruncate(sequence.word, 16);
    // Count letter units: each letter char counts as 1, dashes are part of the preceding letter
    let letterCount = 0;
    for (let i = 0; i < displayWord.length; i++) {
      const ch = displayWord[i];
      if (ch !== "-" && ch !== "." && ch !== " ") letterCount++;
    }

    // Up to 10 letters: full size. Beyond that, scale down proportionally.
    if (letterCount <= 10) return baseFontSize;
    return Math.max(Math.floor(baseFontSize * (10 / letterCount)), Math.floor(scaledHeaderHeight * 0.35));
  });

  // Footer font size scales proportionally - no minimum constraint for WYSIWYG preview
  const footerFontSize = $derived(Math.floor(scaledFooterHeight * 0.55));
  const footerMargin = $derived(Math.floor(scaledFooterHeight * 0.3));


  /**
   * Build render options from current component state
   */
  function buildRenderOptions(): PreviewCellRenderOptions {
    return {
      size: CELL_SIZE,
      bluePropType,
      redPropType,
      catDogModeEnabled,
      // Never bake step numbers into the rendered blob — identical pictographs
      // at different beats must share the same cached image. Step numbers are
      // rendered as HTML overlays on top of the <img> instead.
      showStepNumbers: false,
      showNonRadialPoints: showNonRadial,
      handPointVisibility: handPointVis,
      showTKA: isSoloMode ? false : showTKA,
      showReversals: isSoloMode ? false : showReversals,
      handPathMode,
      browseViewMode,
    };
  }

  /**
   * For solo mode, extract the end location of the kept color's motion
   * for a given step. Falls back to step number if no motion data.
   */
  function getSoloLocationLabel(stepIndex: number): string {
    if (!isSoloMode || !sequence.steps) return String(stepIndex + 1);
    const step = sequence.steps[stepIndex];
    if (!step?.motions) return String(stepIndex + 1);
    const motion = soloColor === "blue" ? step.motions.blue : step.motions.red;
    if (!motion?.endLocation) return String(stepIndex + 1);
    // Capitalize location abbreviation: "n" → "N", "ne" → "NE"
    return motion.endLocation.toUpperCase();
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

    if (includeStartPosition) {
      // With start position: col 1 is reserved for start, steps start at col 2
      const stepsPerRow = cols - 1;
      const firstRowSteps = cols - 1;

      if (stepIndex < firstRowSteps) {
        return { gridColumn: stepIndex + 2, gridRow: 1 };
      }

      const remainingIndex = stepIndex - firstRowSteps;
      const row = Math.floor(remainingIndex / stepsPerRow) + 2;
      const col = (remainingIndex % stepsPerRow) + 2;
      return { gridColumn: col, gridRow: row };
    } else {
      // Without start position: all columns available for steps
      const col = (stepIndex % cols) + 1;
      const row = Math.floor(stepIndex / cols) + 1;
      return { gridColumn: col, gridRow: row };
    }
  }

  /**
   * Compute divider row positions and adjust cell gridRows for pass boundaries.
   * Returns the grid rows where dividers should be rendered.
   */
  function applyPassDividerOffsets(
    cellData: CellData[],
    boundaries: number[],
    cols: number
  ): { dividerGridRows: number[]; extraRows: number } {
    if (boundaries.length === 0) return { dividerGridRows: [], extraRows: 0 };

    // Find the grid row of each boundary step (the first step of the new pass)
    const dividerGridRows: number[] = [];
    for (const boundaryIdx of boundaries) {
      // The divider goes BEFORE this step's row. Find what row this step
      // would normally be on (before any offsets).
      const pos = calculateGridPosition(boundaryIdx, cols);
      dividerGridRows.push(pos.gridRow); // Divider row inserted before this row
    }

    // Offset cells: for each cell, count how many divider rows precede it
    for (const cell of cellData) {
      let offset = 0;
      for (const divRow of dividerGridRows) {
        if (cell.gridRow >= divRow) {
          offset++;
        }
      }
      if (offset > 0) {
        cell.gridRow += offset;
      }
    }

    // The divider rows themselves are offset by preceding dividers
    const adjustedDividerRows = dividerGridRows.map((row, i) => row + i);

    return { dividerGridRows: adjustedDividerRows, extraRows: boundaries.length };
  }

  // State for pass divider grid rows (populated during render)
  let passDividerGridRows = $state<number[]>([]);

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

  /** Format duration for badge display (e.g., 2 → "2×", 1.25 → "1.25×") */
  function formatDuration(d: number): string {
    return Number.isInteger(d) ? `${d}×` : `${d}×`;
  }

  /**
   * Fast relayout: update grid positions and column/row counts without re-rendering images.
   * Used when only columnCount or includeStartPosition changes — the pictograph images
   * are identical, only their positions in the grid change.
   */
  function relayoutCells() {
    if (!sequence?.steps?.length || cells.length === 0) return;

    const stepCount = sequence.steps.length;
    const cols = effectiveColumns;
    const rws = effectiveRows;

    columns = cols;
    rows = rws;

    // Recalculate grid positions for all existing cells
    cells = cells.map(cell => {
      const { gridColumn, gridRow } = calculateGridPosition(cell.index, cols);
      return { ...cell, gridColumn, gridRow };
    });

    // Update the global cache entry with new positions
    const renderOptions = buildRenderOptions();
    const isDark = darkMode;
    const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark);
    storePreviewInCache(cacheKey, {
      cells: cells.map(c => ({
        index: c.index, label: c.label, imageUrl: c.imageUrl,
        gridColumn: c.gridColumn, gridRow: c.gridRow, duration: c.duration,
      })),
      columns: cols,
      rows: rws,
      durationRows,
      hasMixedDurations,
      durationColCount,
      passDividerGridRows,
    });
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

      // Detect mixed durations — determines uniform grid vs timeline rows
      const mixed = detectMixedDurations(sequence.steps);
      hasMixedDurations = mixed;

      if (columnCount !== null && columnCount > 0) {
        // Manual column override (e.g., export mode)
        cols = columnCount;
        const stepsPerRow = includeStartPosition ? cols - 1 : cols;
        const firstRowSteps = Math.min(stepsPerRow, stepCount);
        const remainingSteps = stepCount - firstRowSteps;
        rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
      } else if (isLongSequence) {
        // Long sequences: fixed 5 columns (both scroll mode and export/forceContain)
        cols = 5;
        const stepsPerRow = includeStartPosition ? cols - 1 : cols;
        const firstRowSteps = Math.min(stepsPerRow, stepCount);
        const remainingSteps = stepCount - firstRowSteps;
        rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
      } else {
        [cols, rws] = layoutService.calculateLayout(stepCount, includeStartPosition);
      }

      columns = cols;

      // For mixed durations: compute timeline rows using row capacity.
      // Start position is handled as a separate column barrier, NOT inline in the first row.
      let computedDurationRows: TimelineRow[] = [];
      if (mixed) {
        // Use the layout table's column count as beats-per-row.
        // cols already includes start position (+1), so subtract it to get beat columns.
        const beatsPerRow = includeStartPosition ? cols - 1 : cols;
        computedDurationRows = calculateTimelineRowsByBeatCount(sequence.steps, beatsPerRow);
        rws = computedDurationRows.length;
        durationRows = computedDurationRows;
        // Compute max step duration units in any row, then add 1 for start column
        let maxStepUnits = 0;
        for (const row of computedDurationRows) {
          maxStepUnits = Math.max(maxStepUnits, row.totalDuration);
        }
        durationColCount = maxStepUnits + (includeStartPosition ? 1 : 0);
      } else {
        durationRows = [];
        durationColCount = 0;
      }

      // Account for pass divider rows in total row count
      const dividerCount = (!mixed && passBoundaryStepIndices.length > 0)
        ? passBoundaryStepIndices.length : 0;
      rws += dividerCount;
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
        durationColCount = cached.durationColCount ?? 0;
        passDividerGridRows = cached.passDividerGridRows ?? [];
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
          index: i, label: isSoloMode ? getSoloLocationLabel(i) : String(i + 1),
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow,
          duration: sequence.steps[i]?.duration ?? 1,
        });
      }

      // Apply pass divider row offsets for multi-pass orientation cycles.
      // Row count was already adjusted above; here we just shift cell positions.
      if (!mixed && passBoundaryStepIndices.length > 0) {
        const { dividerGridRows } = applyPassDividerOffsets(
          placeholderCells, passBoundaryStepIndices, cols
        );
        passDividerGridRows = dividerGridRows;
      } else {
        passDividerGridRows = [];
      }

      // Pre-calculate contain dimensions and cellWidth BEFORE inserting cells.
      // The containerElement (.choreo-card-root) has parent-determined dimensions
      // (width: 100%; height: 100%), so its size is valid even before cells exist.
      // Without this, the first frame shows auto-sized content that snaps to
      // calculated dimensions on the next frame — a visible jump.
      updateContainedDimensions();
      if (containedWidth && cols > 0) {
        const newCw = containedWidth / cols;
        if (Math.abs(newCw - cellWidth) > 0.5) cellWidth = newCw;
      }

      // Lock observer-driven updates for the duration of cell loading.
      // Individual cell content swaps cause ResizeObserver firings that
      // cascade into header/footer height changes and card repositioning.
      suppressObserverUpdates = true;

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

        // For mixed-duration sequences, pass widthMultiplier so the image renderer
        // produces a wider canvas with the pictograph content centered
        const stepDuration = step.duration ?? 1;
        const cellRenderOptions = (mixed && stepDuration !== 1)
          ? { ...renderOptions, widthMultiplier: stepDuration }
          : renderOptions;

        const imageUrl = await previewCellRenderer.renderCell(step, i + 1, isDark, cellRenderOptions);
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
        durationColCount,
        passDividerGridRows: [...passDividerGridRows],
      });

      // Now safe to revoke old blob URLs — new ones are in the DOM
      for (const url of oldBlobUrls) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to render cells:", error);
    } finally {
      isRendering = false;
      suppressObserverUpdates = false;
      // Measurements were suppressed during rendering to prevent per-cell jumps.
      // Run them once now that all cells are loaded.
      updateCellWidth();
      updateContainedDimensions();
      // If a render was requested while we were busy, run it now
      if (renderQueued) {
        renderQueued = false;
        renderAllCells();
      }
    }
  }

  /**
   * Cross-fade between dark and light mode without showing sequential spinners.
   * Renders all new-mode images in the background while keeping old images visible,
   * then swaps all at once with a simultaneous opacity cross-fade.
   */
  async function crossfadeDarkMode() {
    if (!sequence?.steps?.length || cells.length === 0) return;

    if (isRendering) {
      renderQueued = true;
      return;
    }
    isRendering = true;

    // Flush any pending cleanup timer from a previous cross-fade BEFORE
    // reading the cache. Without this, a rapid toggle (dark→light→dark within
    // 400ms) can pull URLs from the cache that the pending timer is about to
    // revoke — causing ERR_FILE_NOT_FOUND when the timer fires during our await.
    if (crossfadeTimer) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
      crossfadeActive = false;
      // Immediately run the cleanup that was scheduled:
      // revoke fadeOutUrls and purge cache entries referencing them.
      const toRevoke: string[] = [];
      cells = cells.map(c => {
        if (c.fadeOutUrl?.startsWith("blob:")) toRevoke.push(c.fadeOutUrl);
        return { ...c, fadeOutUrl: undefined };
      });
      if (toRevoke.length > 0) {
        const revokedSet = new Set(toRevoke);
        for (const [key, entry] of globalPreviewCache) {
          if (entry.cells.some(c => revokedSet.has(c.imageUrl))) {
            globalPreviewCache.delete(key);
          }
        }
        for (const url of toRevoke) URL.revokeObjectURL(url);
      }
    }

    try {
      const isDark = darkMode;
      const renderOptions = buildRenderOptions();

      // Check global cache first — may already have the target mode rendered
      const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark);
      const cached = globalPreviewCache.get(cacheKey);

      let newUrls: Map<number, string>;

      if (cached) {
        newUrls = new Map(cached.cells.map(c => [c.index, c.imageUrl]));
      } else {
        // Render all cells in background without updating DOM
        newUrls = new Map();
        const firstStep = sequence.steps[0];

        if (sequence.startPosition || firstStep) {
          const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
          const imageUrl = await previewCellRenderer.renderCell(startData, undefined, isDark, renderOptions);
          newUrls.set(-1, imageUrl);
        }

        const mixed = detectMixedDurations(sequence.steps);
        for (let i = 0; i < sequence.steps.length; i++) {
          const step = sequence.steps[i];
          if (!step) continue;
          const stepDuration = step.duration ?? 1;
          const cellRenderOptions = (mixed && stepDuration !== 1)
            ? { ...renderOptions, widthMultiplier: stepDuration }
            : renderOptions;
          const imageUrl = await previewCellRenderer.renderCell(step, i + 1, isDark, cellRenderOptions);
          newUrls.set(i, imageUrl);
        }

        // Store in cache for future use
        storePreviewInCache(cacheKey, {
          cells: cells.map(c => ({
            ...c,
            imageUrl: newUrls.get(c.index) ?? c.imageUrl,
            fadeOutUrl: undefined,
          })),
          columns,
          rows,
          durationRows: [...durationRows],
          hasMixedDurations,
          durationColCount,
          passDividerGridRows: [...passDividerGridRows],
        });
      }

      // If another render was requested while we were working, abort the cross-fade
      if (renderQueued) {
        for (const url of newUrls.values()) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        }
        return;
      }

      // Batch swap: set fadeOutUrl to old image, imageUrl to new image
      cells = cells.map(c => ({
        ...c,
        fadeOutUrl: c.imageUrl,
        imageUrl: newUrls.get(c.index) ?? c.imageUrl,
      }));

      // Wait for DOM to render both images (old at opacity 1, new at opacity 0)
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      // Trigger the cross-fade: backgrounds transition and images fade simultaneously
      activeDarkMode = isDark;
      crossfadeActive = true;

      // Clean up after the CSS transition completes
      if (crossfadeTimer) clearTimeout(crossfadeTimer);
      crossfadeTimer = setTimeout(() => {
        crossfadeActive = false;
        const toRevoke: string[] = [];
        cells = cells.map(c => {
          if (c.fadeOutUrl?.startsWith("blob:")) toRevoke.push(c.fadeOutUrl);
          return { ...c, fadeOutUrl: undefined };
        });
        // Invalidate any globalPreviewCache entries that reference the revoked URLs.
        // Without this, toggling dark→light→dark serves revoked blob URLs from cache.
        if (toRevoke.length > 0) {
          const revokedSet = new Set(toRevoke);
          for (const [key, entry] of globalPreviewCache) {
            if (entry.cells.some(c => revokedSet.has(c.imageUrl))) {
              globalPreviewCache.delete(key);
            }
          }
        }
        for (const url of toRevoke) URL.revokeObjectURL(url);
        crossfadeTimer = null;
      }, 400);
    } catch (error) {
      console.error("Failed to cross-fade dark mode:", error);
      // Fallback: apply dark mode immediately
      activeDarkMode = darkMode;
    } finally {
      isRendering = false;
      if (renderQueued) {
        renderQueued = false;
        crossfadeActive = false;
        if (crossfadeTimer) { clearTimeout(crossfadeTimer); crossfadeTimer = null; }
        cells = cells.map(c => ({ ...c, fadeOutUrl: undefined }));
        renderAllCells();
      }
    }
  }

  function clearCellUrls() {
    // Collect all blob URLs that are still referenced by the globalPreviewCache.
    // Revoking those would poison the cache — a new ChoreoCard mounting for
    // the same sequence would hit the cache and get revoked URLs (ERR_FILE_NOT_FOUND).
    const cachedUrls = new Set<string>();
    for (const entry of globalPreviewCache.values()) {
      for (const c of entry.cells) {
        if (c.imageUrl.startsWith("blob:")) cachedUrls.add(c.imageUrl);
      }
    }
    // Only revoke URLs that are NOT in the cache
    for (const cell of cells) {
      if (cell.imageUrl.startsWith("blob:") && !cachedUrls.has(cell.imageUrl)) {
        URL.revokeObjectURL(cell.imageUrl);
      }
    }
    cells = [];
  }

  // Admin context menu (save/copy/claude + re-render)
  let contextMenuState: ContextMenuState = $state({ open: false });

  const contextMenuItems: ContextMenuEntry[] = $derived.by(() => {
    const seq = sequence;
    const isAdmin = featureFlagService.isAdmin;
    const items: ContextMenuEntry[] = [];

    if (isAdmin) {
      items.push(
        {
          id: "save-image",
          label: "Save image",
          icon: "fa-download",
          async action() {
            try {
              const { sharer } = await import(
                "$lib/shared/share/services/implementations/Sharer"
              );
              await sharer.downloadImage(seq, { ...DEFAULT_SHARE_OPTIONS, format: "PNG" });
              toast.success("Image saved");
            } catch (err) {
              console.error("Save image failed:", err);
              toast.error("Failed to save image");
            }
          },
        },
        {
          id: "copy-image",
          label: "Copy image",
          icon: "fa-copy",
          async action() {
            try {
              const { sharer } = await import(
                "$lib/shared/share/services/implementations/Sharer"
              );
              const blob = await sharer.getImageBlob(seq, { ...DEFAULT_SHARE_OPTIONS, format: "PNG" });
              await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
              toast.success("Image copied to clipboard");
            } catch (err) {
              console.error("Copy image failed:", err);
              toast.error("Failed to copy image");
            }
          },
        },
        {
          id: "copy-for-claude",
          label: "Copy for Claude",
          icon: "fa-robot",
          async action() {
            try {
              const copier = container.items.claudeCodeCopier;
              const result = await copier.copyForClaude(seq);
              if (result.success) {
                toast.success("Copied for Claude");
              } else {
                toast.error("Failed to copy for Claude");
              }
            } catch (err) {
              console.error("Copy for Claude failed:", err);
              toast.error("Failed to copy for Claude");
            }
          },
        },
        { type: "separator" as const },
      );
    }

    items.push({
      id: "rerender",
      label: "Re-render",
      icon: "fa-sync-alt",
      action() {
        forceRerenderAllCells();
      },
    });

    return items;
  });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuState = { open: true, x: e.clientX, y: e.clientY };
  }

  function closeContextMenu() {
    contextMenuState = { open: false };
  }

  /**
   * Force re-render: clear all caches for this sequence and re-render all cells.
   */
  async function forceRerenderAllCells(): Promise<void> {
    if (!sequence?.steps?.length) return;

    const renderOptions = buildRenderOptions();
    const isDark = darkMode;

    // 1. Clear global in-memory preview cache entry for this sequence
    const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark);
    globalPreviewCache.delete(cacheKey);

    // 2. Delete IndexedDB blobs for all cells of this sequence
    const firstStep = sequence.steps[0];
    if (sequence.startPosition || firstStep) {
      const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
      await previewCellRenderer.deleteCellCache(startData, undefined, isDark, renderOptions);
    }
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i];
      if (step) {
        await previewCellRenderer.deleteCellCache(step, i + 1, isDark, renderOptions);
      }
    }

    // 3. Clear current cells and re-render
    clearCellUrls();
    isLoading = true;
    renderAllCells();
  }

  // Track the preview stack element for ResizeObserver
  let previewStackElement: HTMLDivElement | undefined = $state();
  let resizeObserver: ResizeObserver | undefined;
  let containerObserver: ResizeObserver | undefined;

  // Calculate "contain" dimensions - fill container while maintaining aspect ratio
  function updateContainedDimensions() {
    // Don't recalculate during cell loading — aspect ratio and container
    // size are stable, but ResizeObserver firings from cell content swaps
    // can cause micro-fluctuations that shift the card.
    if (suppressObserverUpdates) return;

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
      // Clear JS dimensions so CSS takes over.
      containedWidth = null;
      containedHeight = null;
      return;
    } else if (forceContain) {
      // Force-contain mode: fit to whichever dimension is more constrained,
      // same as normal contain. overflow:visible on root handles any overflow.
      // When fitWidth is set (mobile export), always constrain by width so
      // the card renders at full fidelity and the parent pane scrolls.
      const contentRatio = previewAspectRatio;
      const containerRatio = containerWidth / containerHeight;

      if (fitWidth) {
        // Mobile export: constrain by width for full-fidelity rendering,
        // but cap to container height so tall cards don't overflow the preview.
        const widthConstrained = containerWidth;
        const hFromWidth = containerWidth / contentRatio;
        if (Number.isFinite(hFromWidth) && hFromWidth > containerHeight) {
          // Card would be taller than container — constrain by height instead
          newHeight = containerHeight;
          const w = containerHeight * contentRatio;
          newWidth = Number.isFinite(w) ? w : null;
        } else {
          newWidth = widthConstrained;
          newHeight = Number.isFinite(hFromWidth) ? hFromWidth : null;
        }
      } else if (contentRatio > containerRatio) {
        // Wide card: constrain by width
        newWidth = containerWidth;
        const h = containerWidth / contentRatio;
        newHeight = Number.isFinite(h) ? h : null;
      } else {
        // Tall card on desktop: constrain by height, let width be natural
        newHeight = containerHeight;
        const w = containerHeight * contentRatio;
        newWidth = Number.isFinite(w) ? w : null;
      }
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

    // Track growth direction for CSS transition: smooth when growing, instant when shrinking.
    // Growing = focus-in (card expands into larger container). The 250ms height transition
    // creates a pleasing smooth growth. Shrinking = unfocus (card must shrink to fit smaller
    // container). The transition would cause the card to lag behind, making it too tall for
    // the container and displacing it upward via centering.
    if (heightChanged && newHeight !== null && containedHeight !== null) {
      heightGrowing = newHeight > containedHeight;
    }

    if (widthChanged) containedWidth = newWidth;
    if (heightChanged) containedHeight = newHeight;
  }

  // Track cell width for responsive sizing using ResizeObserver
  function updateCellWidth() {
    // Don't update cellWidth while cells are loading sequentially —
    // fractional size changes from cell content swaps cascade into
    // header/footer height changes that cause visible jumps.
    if (suppressObserverUpdates) return;

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
  let hasMounted = $state(false);
  // Flip animation duration: 0 during initial mount or column count changes
  // (container resize transition handles the visual smoothness instead)
  const flipDuration = $derived(hasMounted && !suppressFlip ? 250 : 0);
  let lastEffectRenderKey = "";

  // Re-render when relevant props or visibility settings change.
  // Three fast paths avoid full sequential re-render:
  //   1. Dark-mode-only change → cross-fade existing images
  //   2. Column/layout-only change → relayout grid positions (no image re-render)
  //   3. Everything else → full re-render
  $effect(() => {
    // Track all props that affect rendering by reading them (creates Svelte dependency)
    const stepLetters = sequence?.steps?.map(s => s.letter ?? "?").join("") ?? "";
    const stepCount = sequence?.steps?.length ?? 0;
    const bpt = bluePropType;
    const rpt = redPropType;
    const cdm = catDogModeEnabled;
    const ssn = showStepNumbers;
    const cc = columnCount;
    const isp = includeStartPosition;
    const snr = showNonRadial;
    const hpv = handPointVis;
    const stka = showTKA;
    const sr = showReversals;
    const dm = darkMode;

    const durationKey = sequence?.steps?.map(s => s.duration ?? 1).join(",") ?? "";

    // Image key: props that affect the actual pictograph images (NOT grid positions)
    const imageKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bpt}-${rpt}-${cdm}-${ssn}-${snr}-${hpv}-${stka}-${sr}-${durationKey}`;
    // Layout key: props that only affect grid positions (column count, start position)
    const layoutKey = `${cc}-${isp}`;
    // Full content key combines both
    const contentKey = `${imageKey}-${layoutKey}`;
    const renderKey = `${contentKey}-${dm}`;

    if (!hasMounted) return;
    if (renderKey === lastEffectRenderKey) return;

    const contentChanged = contentKey !== lastContentKey;
    const imageChanged = imageKey !== lastImageKey;
    const cellsLoaded = untrack(() => cells.length > 0 && cells.some(c => c.isLoaded));
    const isDarkModeOnly = !contentChanged && cellsLoaded;
    // Layout-only: images are identical but columns/start position changed.
    // Duration sequences need a full re-render because durationRows/durationColCount
    // must be recalculated (relayoutCells only repositions uniform grid cells).
    const hasDurations = untrack(() => hasMixedDurations);
    const isLayoutOnly = !imageChanged && contentChanged && cellsLoaded && !hasDurations;

    lastEffectRenderKey = renderKey;
    lastContentKey = contentKey;
    lastImageKey = imageKey;

    if (isDarkModeOnly) {
      untrack(() => {
        crossfadeDarkMode();
      });
    } else if (isLayoutOnly) {
      activeDarkMode = dm;
      untrack(() => {
        relayoutCells();
      });
    } else {
      activeDarkMode = dm;
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

  // Recalculate contained dimensions when aspect ratio or sizing mode changes
  $effect(() => {
    // Track all dependencies that affect the sizing calculation
    const _ratio = previewAspectRatio;
    const _fc = forceContain;
    const _ns = needsScroll;
    const _fw = fitWidth;
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

  // Auto-scroll to keep highlighted step visible during playback.
  // Uses manual scrollTop instead of scrollIntoView() because scrollIntoView
  // scrolls ALL ancestor scroll containers — on the landing page this causes
  // the entire page to jump to the top when the sequence loops.
  $effect(() => {
    const stepIdx = highlightedStepIndex;
    if (!needsScroll || !gridScrollRef || stepIdx == null) return;

    const cell = gridScrollRef.querySelector('.pictograph-cell.current') as HTMLElement | null;
    if (cell) {
      const containerRect = gridScrollRef.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      const cellTop = cellRect.top - containerRect.top + gridScrollRef.scrollTop;
      const cellBottom = cellTop + cellRect.height;

      const visibleTop = gridScrollRef.scrollTop;
      const visibleBottom = visibleTop + containerRect.height;

      if (cellTop < visibleTop) {
        gridScrollRef.scrollTo({ top: cellTop, behavior: 'smooth' });
      } else if (cellBottom > visibleBottom) {
        gridScrollRef.scrollTo({ top: cellBottom - containerRect.height, behavior: 'smooth' });
      }
    }
  });

  onMount(() => {
    // Initialize keys so the $effect can detect dark-mode-only and layout-only changes
    const stepLetters = sequence?.steps?.map(s => s.letter ?? "?").join("") ?? "";
    const stepCount = sequence?.steps?.length ?? 0;
    const durationKey = sequence?.steps?.map(s => s.duration ?? 1).join(",") ?? "";
    lastImageKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bluePropType}-${redPropType}-${catDogModeEnabled}-${showStepNumbers}-${showNonRadial}-${handPointVis}-${showTKA}-${showReversals}-${durationKey}`;
    lastContentKey = `${lastImageKey}-${columnCount}-${includeStartPosition}`;
    lastEffectRenderKey = `${lastContentKey}-${darkMode}`;
    renderAllCells().then(() => {
      hasMounted = true;
    });
  });

  onDestroy(() => {
    clearCellUrls();
    cancelLongPress();
    if (crossfadeTimer) clearTimeout(crossfadeTimer);
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (containerObserver) {
      containerObserver.disconnect();
    }
  });
</script>

<!-- Shared cell content: handles cross-fade images, step numbers, and duration badges -->
{#snippet cellContent(cell: CellData, showDurBadge: boolean)}
  {#if cell.isLoaded}
    {#if cell.fadeOutUrl}
      <img class="cell-image cell-fade-old" class:fading={crossfadeActive} src={cell.fadeOutUrl} alt="" draggable="false" />
    {/if}
    <img
      class="cell-image"
      class:cell-fade-new={!!cell.fadeOutUrl}
      class:reveal={crossfadeActive}
      src={cell.imageUrl}
      alt={cell.label}
      draggable="false"
    />
    {#if showStepNumbers}<span class="step-number-overlay" class:dark-mode={activeDarkMode} style="font-size: {stepNumFontSize}px;" transition:fade|local={{ duration: 150 }}>{cell.label}</span>{/if}
    {#if showDurBadge && hasMixedDurations && cell.duration !== 1}<span class="duration-badge" class:dark-mode={activeDarkMode}>{formatDuration(cell.duration)}</span>{/if}
  {:else}
    <div class="cell-spinner-container">
      <ProgressRing percent={-1} size={20} strokeWidth={2} />
    </div>
  {/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="choreo-card-root" class:dark-mode={activeDarkMode} class:scroll-mode={needsScroll} class:force-contain={forceContain} bind:this={containerElement}
  oncontextmenu={(e: MouseEvent) => {
    e.preventDefault();
    // If the long-press timer already opened the menu, don't open it again
    if (longPressFired) {
      longPressFired = false;
      return;
    }
    // Parent menu takes priority — don't also open inline menus
    if (onContextMenu) {
      onContextMenu(e.clientX, e.clientY);
      return;
    }
    handleContextMenu(e);
  }}
  onpointerdown={(e: PointerEvent) => {
    if (e.button !== 0 || e.pointerType === "mouse" || !onContextMenu) return;
    longPressFired = false;
    const x = e.clientX;
    const y = e.clientY;
    longPressOrigin = { x, y };
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      longPressOrigin = null;
      longPressFired = true;
      onContextMenu(x, y);
    }, 500);
  }}
  onpointermove={(e: PointerEvent) => {
    if (longPressOrigin) {
      const dx = e.clientX - longPressOrigin.x;
      const dy = e.clientY - longPressOrigin.y;
      if (dx * dx + dy * dy > 100) cancelLongPress();
    }
  }}
  onpointerup={() => cancelLongPress()}
  onpointercancel={() => cancelLongPress()}
>
  {#if isLoading && cells.length === 0}
    <div class="loading-placeholder">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
    </div>
  {:else if cells.length > 0}
    <div
      class="preview-stack"
      class:scroll-mode={needsScroll}
      class:smooth-resize={hasMounted}
      class:height-growing={heightGrowing}
      style={needsScroll ? '' : `width: ${containedWidth ? `${containedWidth}px` : 'auto'}; height: ${containedHeight ? `${containedHeight}px` : 'auto'};`}
      bind:this={previewStackElement}
    >
      <!-- Header section -->
      {#if showHeader}
        <div
          class="header-section"
          style="height: {scaledHeaderHeight}px;"
          transition:fly|local={{ y: -20, duration: 250, easing: cubicOut }}
        >
          {#if isSoloMode}
            <span
              class="word-title"
              style="font-size: {wordTitleFontSize}px; color: {soloColor === 'blue' ? 'var(--prop-blue, #2196f3)' : 'var(--prop-red, #f44336)'};"
            >
              {soloColor === "blue" ? "Blue" : "Red"} {browseViewMode?.subject === "hands" ? "Hand Path" : "Prop Path"}
            </span>
          {:else}
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
                transition:scale|local={{ duration: 200, easing: cubicOut }}
              >
                {difficultyLevel}
              </div>
            {/if}

            {#if showWord && sequence.word}
              <span
                class="word-title"
                style="font-size: {wordTitleFontSize}px;"
                transition:fade|local={{ duration: 200 }}
              >
                {simplifyAndTruncate(sequence.word, 16)}
              </span>
            {/if}

            {#if showLoopGlyph && loopComponents}
              <div
                class="loop-icon-badge"
                style="height: {badgeSize}px; right: {badgePadding}px;"
                transition:fade|local={{ duration: 200 }}
              >
                <LOOPIconStrip
                  activeComponents={loopComponents}
                  size={Math.floor(badgeSize * 0.6)}
                  darkMode={activeDarkMode}
                  showFreeformWhenEmpty={false}
                />
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Grid section with individual pictograph cells -->
      {#if hasMixedDurations && durationRows.length > 0}
        <!-- Duration-aware layout: start position as fixed column barrier, step rows to the right -->
        {@const startCell = cells.find(c => c.index === -1)}
        {@const stepMaxUnits = durationColCount - (includeStartPosition ? 1 : 0)}
        {#if needsScroll}
          <div class="grid-scroll-container themed-scrollbar" bind:this={gridScrollRef}>
            <div class="duration-layout" style="--max-units: {durationColCount}; --step-max: {stepMaxUnits};">
              {#if includeStartPosition && startCell}
                <div class="duration-start-col" transition:fade|local={{ duration: 200 }}>
                  <div
                    class="pictograph-cell"
                    class:current={showHighlight && highlightedStepIndex === -1}
                  >
                    {@render cellContent(startCell, false)}
                  </div>
                  {#if showQRCode}
                    <div class="pictograph-cell qr-cell" transition:fade|local={{ duration: 200 }}>
                      {#if qrDataUrl}
                        <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
                      {/if}
                    </div>
                  {/if}
                </div>
              {/if}
              <div class="duration-steps-area">
                {#each durationRows as row, rowIdx (rowIdx)}
                  <div class="duration-row">
                    {#each row.steps as { stepIndex, duration } (stepIndex)}
                      {@const cell = cells.find(c => c.index === stepIndex)}
                      {#if cell}
                        <div class="duration-cell" style="--dur: {duration}; flex: {duration};">
                          {#if onStepClick}
                            <button
                              class="pictograph-cell clickable"
                              class:current={showHighlight && highlightedStepIndex === cell.index}
                              class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                              onclick={() => onStepClick(cell.index)}
                              type="button"
                              aria-label="Go to step {cell.label}"
                            >
                              {@render cellContent(cell, true)}
                            </button>
                          {:else}
                            <div
                              class="pictograph-cell"
                              class:current={showHighlight && highlightedStepIndex === cell.index}
                              class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                            >
                              {@render cellContent(cell, true)}
                            </div>
                          {/if}
                        </div>
                      {/if}
                    {/each}
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {:else}
          <div class="duration-layout" style="--max-units: {durationColCount}; --step-max: {stepMaxUnits};">
            {#if includeStartPosition && startCell}
              <div class="duration-start-col">
                <div
                  class="pictograph-cell"
                  class:current={showHighlight && highlightedStepIndex === -1}
                >
                  {@render cellContent(startCell, false)}
                </div>
                {#if showQRCode && qrDataUrl}
                  <div class="pictograph-cell qr-cell" transition:fade|local={{ duration: 200 }}>
                    <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
                  </div>
                {/if}
              </div>
            {/if}
            <div class="duration-steps-area">
              {#each durationRows as row, rowIdx (rowIdx)}
                <div class="duration-row">
                  {#each row.steps as { stepIndex, duration } (stepIndex)}
                    {@const cell = cells.find(c => c.index === stepIndex)}
                    {#if cell}
                      <div class="duration-cell" style="--dur: {duration}; flex: {duration};">
                        {#if onStepClick}
                          <button
                            class="pictograph-cell clickable"
                            class:current={showHighlight && highlightedStepIndex === cell.index}
                            class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                            onclick={() => onStepClick(cell.index)}
                            type="button"
                            aria-label="Go to step {cell.label}"
                          >
                            {@render cellContent(cell, true)}
                          </button>
                        {:else}
                          <div
                            class="pictograph-cell"
                            class:current={showHighlight && highlightedStepIndex === cell.index}
                            class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                          >
                            {@render cellContent(cell, true)}
                        </div>
                      {/if}
                    </div>
                  {/if}
                {/each}
              </div>
            {/each}
            </div>
          </div>
        {/if}
      {:else if needsScroll}
        <!-- Uniform grid: scroll mode -->
        {@const startCellScroll = cells.find(c => c.index === -1)}
        <div class="grid-scroll-container themed-scrollbar" bind:this={gridScrollRef}>
          <div
            class="grid-section"
            style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
          >
            {#if startCellScroll && includeStartPosition}
              <div
                class="cell-flip-wrapper"
                style="grid-column: 1; grid-row: 1;"
                transition:scale|local={{ duration: 200, easing: cubicOut }}
              >
                <div class="pictograph-cell">
                  {@render cellContent(startCellScroll, false)}
                </div>
              </div>
            {/if}
            {#each visibleCells as cell (cell.index)}
              <div
                class="cell-flip-wrapper"
                style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
                animate:flip={{ duration: flipDuration, easing: cubicOut }}
              >
              {#if onStepClick && cell.index >= 0}
                <button
                  class="pictograph-cell clickable"
                  class:current={showHighlight && highlightedStepIndex === cell.index}
                  class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                  onclick={() => onStepClick(cell.index)}
                  type="button"
                  aria-label="Go to step {cell.label}"
                >
                  {@render cellContent(cell, true)}
                </button>
              {:else}
                <div
                  class="pictograph-cell"
                  class:current={showHighlight && highlightedStepIndex === cell.index}
                  class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                >
                  {@render cellContent(cell, true)}
                </div>
              {/if}
              </div>
            {/each}
            {#if qrGridPosition && qrDataUrl}
              <div
                class="cell-flip-wrapper qr-cell-wrapper"
                style="grid-column: {qrGridPosition.gridColumn}; grid-row: {qrGridPosition.gridRow};"
              >
                <div class="pictograph-cell qr-cell">
                  <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <!-- Uniform grid: standard mode -->
        {@const startCell = cells.find(c => c.index === -1)}
        <div
          class="grid-section"
          style="grid-template-columns: repeat({effectiveColumns}, 1fr);"
        >
          {#if startCell && includeStartPosition}
            <div
              class="cell-flip-wrapper"
              style="grid-column: 1; grid-row: 1;"
              transition:scale|local={{ duration: 200, easing: cubicOut }}
            >
              <div class="pictograph-cell">
                {@render cellContent(startCell, false)}
              </div>
            </div>
          {/if}
          {#each visibleCells as cell (cell.index)}
            <div
              class="cell-flip-wrapper"
              style="grid-column: {cell.gridColumn}; grid-row: {cell.gridRow};"
              animate:flip={{ duration: flipDuration, easing: cubicOut }}
            >
            {#if onStepClick && cell.index >= 0}
              <button
                class="pictograph-cell clickable"
                class:current={showHighlight && highlightedStepIndex === cell.index}
                class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
                onclick={() => onStepClick(cell.index)}
                type="button"
                aria-label="Go to step {cell.label}"
              >
                {@render cellContent(cell, true)}
              </button>
            {:else}
              <div
                class="pictograph-cell"
                class:current={showHighlight && highlightedStepIndex === cell.index}
                class:played={showHighlight && highlightedStepIndex !== null && cell.index < highlightedStepIndex}
              >
                {@render cellContent(cell, true)}
              </div>
            {/if}
            </div>
          {/each}
          {#if qrGridPosition}
            <div
              class="cell-flip-wrapper qr-cell-wrapper"
              style="grid-column: {qrGridPosition.gridColumn}; grid-row: {qrGridPosition.gridRow};"
            >
              <div class="pictograph-cell qr-cell">
                {#if qrDataUrl}
                  <img class="qr-code-image" src={qrDataUrl} alt="Scan to get this sequence" draggable="false" />
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Footer section -->
      {#if showFooter}
        <div
          class="footer-section"
          style="height: {scaledFooterHeight}px; padding-left: {footerMargin}px; padding-right: {footerMargin}px; font-size: {footerFontSize}px;"
          transition:fly|local={{ y: 20, duration: 250, easing: cubicOut }}
        >
          {#if showCreatorName && effectiveUserName}
            <span class="footer-name" transition:fly|local={{ x: -20, duration: 200, easing: cubicOut }}>
              {effectiveUserName}
            </span>
          {/if}

          {#if showNotes}
            <span class="footer-notes" transition:fade|local={{ duration: 200 }}>
              {customNotesText}
            </span>
          {/if}

          {#if showBirthday}
            <span class="footer-birthday" transition:fly|local={{ x: 20, duration: 200, easing: cubicOut }}>
              🎂 {birthdayDate}
            </span>
          {/if}

          {#if hasPathShapeMetadata}
            <span class="footer-path-shape">Linear shifts</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<ContextMenu menuState={contextMenuState} items={contextMenuItems} onClose={closeContextMenu} />

<style>
  .choreo-card-root {
    position: relative;
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
  }

  /* In scroll mode, the scroll container's own padding handles glow space.
     Fill the container edge-to-edge instead of centering with extra padding. */
  .choreo-card-root.scroll-mode {
    padding: 0;
    align-items: stretch;
    justify-content: stretch;
  }

  .choreo-card-root.force-contain {
    overflow: visible;
    /* Keep align-items: center (inherited from .choreo-card-root) so the
       content stays visually centered during the grid transition.
       flex-start was causing a 187px upward jump on the first frame. */
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
    overflow: hidden;
  }

  /* Smooth width transition only AFTER initial render is complete.
     During initial cell loading, width transitions cause visible jumps
     as the contain dimensions settle. */
  .preview-stack.smooth-resize {
    transition: width 250ms cubic-bezier(0.2, 0, 0, 1),
                height 250ms cubic-bezier(0.2, 0, 0, 1);
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
    overflow: hidden;
    transition: background-color 350ms ease, border-color 350ms ease;
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
    font-family: Cambria, serif;
    font-weight: bold;
    padding-bottom: 1px;
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
    max-width: 75%;
    transition: color 350ms ease, font-size 200ms ease;
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
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0;
  }

  /* Duration-aware layout — start column barrier + step rows to the right */
  .duration-layout {
    display: flex;
    width: 100%;
    min-height: 0;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .dark-mode .duration-layout {
    background: #000;
  }

  /* Start position: fixed column that spans the full height as a barrier */
  .duration-start-col {
    flex: 0 0 calc(1 / var(--max-units, 5) * 100%);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .dark-mode .duration-start-col {
    background: #0a0a0f;
  }

  .duration-start-col .pictograph-cell {
    width: 100%;
    aspect-ratio: 1;
  }

  .duration-start-col .cell-image {
    width: 100%;
    height: auto;
    display: block;
  }

  /* Steps area: fills remaining width, stacks rows vertically */
  .duration-steps-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .duration-row {
    display: flex;
    gap: 0;
    width: 100%;
  }

  .duration-cell {
    /* flex distributes width proportionally within the row.
       max-width caps each cell so rows with fewer total units
       don't stretch cells beyond their proportion of the max step row. */
    max-width: calc(var(--dur, 1) / var(--step-max, 4) * 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    /* Background matches pictograph so wider cells have seamless side fill */
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .dark-mode .duration-cell {
    background: #0a0a0f;
  }

  .duration-cell .pictograph-cell {
    width: 100%;
    aspect-ratio: auto;
  }

  .duration-cell .cell-image {
    /* Image fills the cell width; height follows natural aspect ratio */
    width: 100%;
    height: auto;
    display: block;
  }

  /* Grid section - CSS Grid layout */
  .grid-section {
    display: grid;
    gap: 0;
    min-height: 0;
    min-width: 0;
    width: 100%;
    /* Fill remaining space after header/footer. 1fr rows divide the available
       height evenly so the last row isn't clipped behind the footer. Cells
       keep aspect-ratio: 1 but shrink slightly from perfect squares to fit. */
    flex: 1;
    grid-auto-rows: 1fr;
    max-width: 100%;
    overflow: hidden;
    /* Light mode background for empty cells */
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .dark-mode .grid-section {
    /* Dark mode background for empty cells */
    background: #000;
  }

  /* Wrapper for FLIP animation — a real grid item so Svelte can measure bounding rects.
     The pictograph-cell inside fills it completely. */
  .cell-flip-wrapper {
    overflow: hidden;
  }

  .cell-flip-wrapper > .pictograph-cell {
    width: 100%;
    height: 100%;
  }

  /* Individual pictograph cell */
  .pictograph-cell {
    position: relative;
    /* Container context for step-number-overlay cqw/cqh units */
    container-type: inline-size;
    aspect-ratio: 1;
    overflow: hidden;
    box-sizing: border-box;
    /* Subtle border for cell separation */
    border: 1px solid rgba(0, 0, 0, 0.08);
    /* Button reset for clickable variant */
    background: none;
    padding: 0;
    margin: 0;
    font: inherit;
    color: inherit;
    cursor: default;
    transition: border-color 350ms ease;
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

  /* Cross-fade: old image fades out while new image fades in simultaneously.
     Both images are stacked in the same cell during the transition. */
  .cell-fade-old {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    opacity: 1;
    transition: opacity 350ms ease;
    pointer-events: none;
  }

  .cell-fade-old.fading {
    opacity: 0;
  }

  .cell-image.cell-fade-new {
    opacity: 0;
    transition: opacity 350ms ease;
  }

  .cell-image.cell-fade-new.reveal {
    opacity: 1;
  }

  /* Step number overlay — rendered as HTML instead of baked into blobs
     so identical pictographs at different beats share one cached image */
  .step-number-overlay {
    position: absolute;
    top: 5.3%;
    left: 5.3%;
    font-family: Georgia, serif;
    font-weight: bold;
    /* font-size set via inline style from stepNumFontSize (cellWidth-based)
       so wider duration cells get the same number size as square cells */
    line-height: 1;
    color: #231f20;
    pointer-events: none;
    user-select: none;
  }

  .step-number-overlay.dark-mode {
    color: #ffffff;
  }

  /* Duration badge — bottom-center, matches DurationGlyph.svelte positioning
     (y=890 in 950-unit viewBox = ~93.7% from top, centered horizontally) */
  .duration-badge {
    position: absolute;
    bottom: 2%;
    left: 50%;
    transform: translateX(-50%);
    font-family: Inter, "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 600;
    font-size: min(5.5cqw, 14px);
    line-height: 1;
    color: #231f20;
    pointer-events: none;
    user-select: none;
  }

  .duration-badge.dark-mode {
    color: #ffffff;
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

  /* QR code cell — occupies the last row of column 1, under the start position.
     In duration layouts (flex column), margin-top: auto pushes it to the bottom. */
  .qr-cell {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: auto;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .dark-mode .qr-cell {
    background: #000;
  }

  .qr-code-image {
    width: 80%;
    height: 80%;
    object-fit: contain;
    -webkit-user-drag: none;
    user-select: none;
  }

  /* Clickable cells */
  .pictograph-cell.clickable {
    cursor: pointer;
  }

  /* No individual cell hover scale in viewer - whole pane scales instead */

  .pictograph-cell.clickable:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: -2px;
    z-index: 5;
  }

  /* Current step - "Elevated Luxury" selection with scale + glow */
  .pictograph-cell.current {
    z-index: 10;
  }

  /* Golden selection overlay — rendered via ::after so it paints ON TOP of
     the cell image. Stays within cell bounds so nothing overflows. */
  .pictograph-cell.current::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 3px solid rgba(251, 191, 36, 0.9);
    box-shadow: inset 0 0 14px rgba(251, 191, 36, 0.5);
    pointer-events: none;
    animation: cellSelectionGlowIn 0.4s ease-out forwards;
  }

  @keyframes cellSelectionGlowIn {
    0% {
      border-color: rgba(251, 191, 36, 0);
      box-shadow: inset 0 0 0 rgba(251, 191, 36, 0);
    }
    100% {
      border-color: rgba(251, 191, 36, 0.9);
      box-shadow: inset 0 0 14px rgba(251, 191, 36, 0.5);
    }
  }

  /* Played cells (already passed) - dim to distinguish from upcoming */
  .pictograph-cell.played {
    opacity: 0.6;
    transition: opacity 0.15s ease-out;
  }

  /* Light mode needs stronger dimming since opacity against light bg is subtle */
  .choreo-card-root:not(.dark-mode) .pictograph-cell.played {
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
    transition: background-color 350ms ease, border-color 350ms ease, color 350ms ease;
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

  .footer-path-shape {
    font-size: inherit;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .preview-stack,
    .pictograph-cell,
    .header-section,
    .grid-section,
    .footer-section,
    .word-title,
    .duration-layout,
    .duration-start-col,
    .duration-cell,
    .cell-fade-old,
    .cell-image.cell-fade-new {
      transition: none;
    }

    .pictograph-cell.current::after {
      animation: none;
    }

    .grid-scroll-container {
      scroll-behavior: auto;
    }
  }
</style>
