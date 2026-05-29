<!--
  ChoreoCard.svelte

  Renders a sequence preview with individually animated pictograph cells.
  Layout shell that composes extracted sub-components:
  - CardHeader (difficulty badge + LOOP glyph + word title)
  - CardGridLayout (grid section with cells, QR, mandalas)
  - CardFooter (name, notes, birthday)
  - CellRenderer (per-cell images, overlays - used by CardGridLayout)

  Owns: motion visibility, solo mode, context menu, animation/interactions,
  responsive containment, cell rendering pipeline, caching.
-->
<script lang="ts">
  import { DIFFICULTY_LEVELS, DEFAULT_DIFFICULTY_STYLE } from "$lib/shared/config/difficulty-styles";
  // Note: transition/animation imports (fade, fly, scale, flip, cubicOut) moved to
  // extracted sub-components (CardHeader, CardFooter, CardGridLayout, CellRenderer).
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { PreviewCellRenderOptions } from "../services/preview-cell-renderer";
  import { onMount, onDestroy, untrack } from "svelte";
  import { calculateLayout } from "$lib/shared/render/services/layout-calculator";
  import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { tryGetLoopDisplayResolver, type LoopDisplay } from "$lib/shared/loop-labeler/getLoopDisplayResolver";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import { featureFlagService } from "$lib/shared/auth/services/PostHogFeatureFlagService.svelte";
  import { getQRCodeGenerator } from "$lib/shared/qr/getQRCodeGenerator";
  import { encodeViewMode } from "$lib/shared/browse/domain/BrowseViewMode";
  import { createStartPositionFromBeatStart } from "$lib/shared/create/services/sequence-transforms";
  import { renderCell, deleteCellCache } from "../services/preview-cell-renderer";
  import { cellCacheKeyDeriver } from "../services/implementations/CellCacheKeyDeriver";
  import { pictographBlobCache } from "$lib/shared/render/services/pictograph-blob-cache";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { tryGetViewerVisibilityContext } from "../context/viewer-visibility-context";
  import { calculateTimelineRowsByBeatCount } from "$lib/shared/create/utils/grid-calculations";
  import type { TimelineRow } from "$lib/shared/create/utils/grid-calculations";

  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

  // Extracted sub-components
  import CardHeader from "./CardHeader.svelte";
  import CardFooter from "./CardFooter.svelte";
  import CardGridLayout from "./CardGridLayout.svelte";

  // Extracted modules
  import {
    type CachedPreview,
    globalPreviewCache,
    getPreviewCacheKey,
    storePreviewInCache,
    calculateGridPosition,
    detectMixedDurations,
    buildRenderOptions,
  } from "$lib/shared/choreo-card/services/choreo-card-cell-pipeline";
  import { createChoreoCardLayoutState } from "$lib/shared/choreo-card/state/choreo-card-layout-state.svelte";
  import { createCrossfaderState } from "$lib/shared/choreo-card/state/crossfader-state.svelte";
  import { buildChoreoCardContextMenu } from "$lib/shared/choreo-card/services/choreo-card-context-menu";

  // Eagerly initialize the singleton so its constructor (which mutates $state)
  // runs in the script block, not inside a $derived expression.
  const compositionManager = getImageCompositionManager();

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
    /** When true, fill empty col-0 cells with mandala visualizations */
    showMandala?: boolean;
    /** Render as hand path visualization (HAND props, float arrows, no TKA) */
    handPathMode?: boolean;
    /** Browse view mode for solo prop/hand filtering */
    browseViewMode?: import("$lib/shared/browse/domain/BrowseViewMode").BrowseViewMode;
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
    // Increment to force a full re-render (clears caches and re-renders all cells)
    rerenderTrigger?: number;
    // Suppress solo mode header ("Blue Prop Path" / "Red Hand Path")
    hideSoloHeader?: boolean;
    // Right-click context menu callback
    onContextMenu?: (x: number, y: number) => void;
    // Per-instance override for start-position layout (defaults to global user
    // setting via compositionManager). Embedded contexts (landing page,
    // marketing previews) need a fixed layout independent of viewer prefs.
    startPositionLayoutOverride?: "row" | "column" | null;
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
    showMandala = false,
    handPathMode = false,
    browseViewMode,
    darkMode = false,
    userName = "",
    customNotesText = "Created using TKA Composer",
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
    rerenderTrigger = 0,
    hideSoloHeader = false,
    onContextMenu,
    startPositionLayoutOverride = null,
  }: Props = $props();

  // Long-press state for touch context menu
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressOrigin: { x: number; y: number } | null = null;
  let longPressFired = false;

  function cancelLongPress() {
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
  // Suppress cellWidth updates during cell loading. Cell content swaps cause
  // the preview-stack to micro-fluctuate, cascading into font/header jitter.
  // Container dimensions (containedWidth/Height) are NEVER suppressed — the
  // container root is parent-sized and unaffected by cell content.
  let suppressCellWidthUpdates = false;
  let cellWidth = $state(0);
  let prevEffectiveColumns = $state(0);
  let suppressFlip = $state(false);
  let hasMixedDurations = $state(false);
  let durationRows = $state<TimelineRow[]>([]);
  let durationColCount = $state(0);

  const crossfader = createCrossfaderState(() => darkMode);
  // Reactive aliases used by the template and internal functions
  const crossfadeActive = $derived(crossfader.crossfadeActive);
  const activeDarkMode = $derived(crossfader.activeDarkMode);

  // Container-based sizing for "contain" behavior
  let containerElement: HTMLDivElement | undefined = $state();
  let containedWidth = $state<number | null>(null);
  let containedHeight = $state<number | null>(null);

  let gridScrollRef: HTMLDivElement | undefined = $state();

  // Visibility settings from user preferences (reactive)
  const visibilitySettings = $derived(getSettings().visibility);
  const showNonRadial = $derived(visibilitySettings?.nonRadialPoints ?? true);
  const handPointVis = $derived<"all" | "active">(visibilitySettings?.handPointVisibility ?? "all");
  const showTKA = $derived(visibilitySettings?.tkaGlyph ?? true);
  const showReversals = $derived(visibilitySettings?.reversalIndicators ?? true);

  // Motion visibility - when one hand is hidden, the sequence is a hand-path
  // view: letters and word become meaningless (letters are defined by both
  // hands combined), so we suppress the word heading. Level/LOOP stay.
  // Glyph visibility - VTG/elemental/positions read from VM too so toggling
  // those in the export panel invalidates the preview cache.
  const vm = getVisibilityStateManager();
  let glyphVisibilityVersion = $state(0);
  function onGlyphVisibilityChanged(): void { glyphVisibilityVersion++; }
  vm.registerObserver(onGlyphVisibilityChanged, ["glyph"]);
  onDestroy(() => {
    vm.unregisterObserver(onGlyphVisibilityChanged);
  });

  // Observe composition manager so per-step-count settings (start position
  // layout, column overrides) trigger layout re-derivation.
  let compositionVersion = $state(0);
  function onCompositionChanged(): void { compositionVersion++; }
  compositionManager.registerObserver(onCompositionChanged);
  onDestroy(() => {
    compositionManager.unregisterObserver(onCompositionChanged);
  });

  // Motion visibility: viewer-scoped. When rendered outside a viewer
  // (browse previews, export pipeline), fall back to always-visible.
  const viewerVisibility = tryGetViewerVisibilityContext();
  const showBlueMotion = $derived(viewerVisibility?.blueMotion ?? true);
  const showRedMotion = $derived(viewerVisibility?.redMotion ?? true);
  const allMotionsVisible = $derived(showBlueMotion && showRedMotion);
  const showTnD = $derived.by(() => {
    void glyphVisibilityVersion;
    return vm.getRawGlyphVisibility("tndGlyph");
  });
  const showElemental = $derived.by(() => {
    void glyphVisibilityVersion;
    return vm.getRawGlyphVisibility("elementalGlyph");
  });
  const showPositions = $derived.by(() => {
    void glyphVisibilityVersion;
    return vm.getRawGlyphVisibility("positionsGlyph");
  });

  // QR code state - generated async, cached by sequence ID + dark mode.
  // The grid cell is always reserved (via qrGridPosition) so layout doesn't
  // shift when the QR image loads in.
  let qrDataUrl = $state<string | null>(null);
  const qrCacheMap = new Map<string, string>();
  let lastQrKey = "";

  const encodedViewMode = $derived(browseViewMode ? encodeViewMode(browseViewMode) : undefined);

  const qrCacheKey = $derived.by(() => {
    if (!showQRCode || !sequence) return "";
    const seqId = sequence.id ?? sequence.word ?? "unknown";
    // Auth state is part of the key: guests get inline (offline) QR codes,
    // signed-in users get Firestore short codes. A guest who signs in
    // mid-session re-derives the key and regenerates the correct code.
    const authTag = authState.isAuthenticated ? "a" : "g";
    return `${seqId}:${darkMode}:${authTag}${encodedViewMode ? `:${encodedViewMode}` : ""}`;
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

    // Generate async - read prop values outside the async callback
    // to avoid tracking additional reactive dependencies
    const seq = sequence;
    const isDark = darkMode;
    const bProp = bluePropType ? String(bluePropType) : undefined;
    const rProp = redPropType ? String(redPropType) : undefined;
    const vm = encodedViewMode;
    // Guests generate self-contained inline QR codes (no Firestore write,
    // no auth, no DB clutter). Signed-in users mint short codes for the
    // shorter URL + scan analytics.
    const offline = !authState.isAuthenticated;
    const qrGenerator = getQRCodeGenerator();
    if (!qrGenerator || !seq) return;

    qrGenerator
      .generateForSequence(seq, {
        size: 200,
        margin: 1,
        style: "modern",
        darkMode: isDark,
        offline,
        bluePropType: bProp,
        redPropType: rProp,
        viewMode: vm,
      })
      .then((result) => {
        qrCacheMap.set(key, result.dataUrl);
        // Only update if this is still the current key (sequence didn't change mid-flight)
        if (lastQrKey === key) {
          qrDataUrl = result.dataUrl;
        }
      })
      .catch(() => {
        // QR is optional - don't block the card
      });
  });

  // Calculate difficulty level (with null safety)
  const difficultyLevel = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;
    return calculateSequenceDifficultyLevel([...sequence.steps]);
  });

  // Parse LOOP components for the glyph. The resolver handles both the
  // stored-loopType path (fast) and the on-demand detect path (when a
  // sequence was edited and its stored loopType might be stale), plus
  // caching keyed by sequence id.
  const EMPTY_LOOP_DISPLAY: LoopDisplay = { components: new Set(), period: 1 };
  const loopDisplay = $derived.by(() => {
    const resolve = tryGetLoopDisplayResolver();
    return resolve ? resolve(sequence) : EMPTY_LOOP_DISPLAY;
  });
  const loopComponentsRaw = $derived(
    loopDisplay.components.size > 0 ? loopDisplay.components : null
  );
  const loopComponents = $derived.by(() => {
    if (!loopComponentsRaw) return null;
    if (!isSoloMode && !isHandsMode) return loopComponentsRaw;
    const filtered = new Set(loopComponentsRaw);
    if (isSoloMode) filtered.delete(LOOPComponent.SWAPPED);
    if (isHandsMode || handPathMode) filtered.delete(LOOPComponent.INVERTED);
    return filtered.size > 0 ? filtered : null;
  });
  const loopRotationPeriod = $derived(loopDisplay.rotationPeriod);
  const loopInversionPeriod = $derived(loopDisplay.inversionPeriod);
  const loopPeriod = $derived(loopDisplay.period);

  // Solo mode: hide dual-prop metadata (word, letters, difficulty, LOOP)
  // When browseViewMode has granularity "solo", we're showing one prop/hand only.
  // The header shows a color label instead of the sequence word.
  const isBrowseSoloMode = $derived(browseViewMode?.granularity === "solo");
  // Motion-visibility solo: one color toggled off in the export panel. The
  // pictograph is effectively single-hand, so letters/VTG/positions are
  // meaningless (they describe hand PAIRS) and must hide the same way.
  const isMotionSoloMode = $derived(
    (showBlueMotion && !showRedMotion) || (showRedMotion && !showBlueMotion)
  );
  const isSoloMode = $derived(isBrowseSoloMode || isMotionSoloMode);
  const soloColor = $derived<"blue" | "red" | undefined>(
    browseViewMode?.color ??
      (isMotionSoloMode ? (showBlueMotion ? "blue" : "red") : undefined)
  );

  const isHandsMode = $derived(browseViewMode?.subject === "hands");

  // Word requires both props visible — meaningless in hands mode or solo mode.
  const wordVisible = $derived(showWord && !!sequence.word && !isSoloMode && !isHandsMode);

  // Level irrelevant without props or in solo mode.
  const effectiveShowDifficulty = $derived(showDifficultyLevel && !isHandsMode && !isSoloMode);

  const showHeader = $derived(
    (isBrowseSoloMode && !hideSoloHeader) ||
    effectiveShowDifficulty || (showLoopGlyph && !!loopComponents) || wordVisible
  );

  // Show footer when any footer element is enabled
  const hasPathShapeMetadata = $derived(sequence?.metadata?.pathShape === "linear" || sequence?.metadata?.pathShape === "concave");
  const showFooter = $derived(showCreatorName || showNotes || showBirthday || hasPathShapeMetadata);

  // Format birthday date - use the sequence's saved birthday when available.
  // Values from Firestore may arrive as Timestamp objects instead of Date,
  // so coerce to Date before calling Date methods.
  const birthdayDate = $derived.by(() => {
    const raw = sequence.birthday || sequence.createdAt || sequence.dateAdded || new Date();
    const date = raw instanceof Date ? raw : typeof (raw as any).toDate === "function" ? (raw as any).toDate() : new Date(raw as any);
    if (isNaN(date.getTime())) {
      const now = new Date();
      return `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  });

  // Effective username
  const effectiveUserName = $derived(userName || authState.user?.displayName || "");

  // Level badge colors - single source of truth shared with the image compositor
  const currentLevelStyle = $derived.by(() => {
    const style = DIFFICULTY_LEVELS[difficultyLevel] ?? DEFAULT_DIFFICULTY_STYLE;
    return { bg: style.cssBg, border: style.border, text: style.text };
  });

  // Layout state factory (extracted) — computes columns, rows, aspect ratio, sizing
  const layoutState = createChoreoCardLayoutState(() => ({
    sequence,
    includeStartPosition,
    columnCount,
    showHeader,
    showFooter,
    showQRCode,
    showMandala,
    forceContain,
    showBlueMotion,
    showRedMotion,
    startPositionLayoutOverride,
    compositionVersion,
    cellWidth,
    hasMixedDurations,
    durationColCount,
  }));

  // Reactive aliases for values that move to the layout state factory.
  // Keeps downstream code and the template unchanged.
  const isLongSequence = $derived(layoutState.isLongSequence);
  const needsScroll = $derived(layoutState.needsScroll);
  const startPositionLayout = $derived(layoutState.startPositionLayout);
  const effectiveColumns = $derived(layoutState.effectiveColumns);
  const effectiveRows = $derived(layoutState.effectiveRows);
  const mandalaLayoutOverride = $derived(layoutState.mandalaLayoutOverride);
  const mandalaPlacements = $derived(layoutState.mandalaPlacements);
  const previewAspectRatio = $derived(layoutState.previewAspectRatio);
  const scaledHeaderHeight = $derived(layoutState.scaledHeaderHeight);
  const scaledFooterHeight = $derived(layoutState.scaledFooterHeight);
  const stepNumFontSize = $derived(layoutState.stepNumFontSize);
  const badgeSize = $derived(layoutState.badgeSize);
  const badgePadding = $derived(layoutState.badgePadding);
  const badgeNumberFontSize = $derived(layoutState.badgeNumberFontSize);
  const wordTitleFontSize = $derived(layoutState.wordTitleFontSize);
  const footerFontSize = $derived(layoutState.footerFontSize);
  const footerMargin = $derived(layoutState.footerMargin);
  const qrGridPosition = $derived(layoutState.qrGridPosition);

  // Filtered cells based on includeStartPosition.
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

  /**
   * Build render options from current component state (delegates to extracted pure function)
   */
  function buildRenderOptionsFn(): PreviewCellRenderOptions {
    return buildRenderOptions({
      cellSize: CELL_SIZE,
      bluePropType,
      redPropType,
      catDogModeEnabled,
      showNonRadial,
      handPointVis,
      showTKA,
      showReversals,
      showTnD,
      showElemental,
      showPositions,
      isSoloMode,
      handPathMode,
      browseViewMode,
      showBlueMotion,
      showRedMotion,
    });
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
   * Look up the visible motion for a given cell in motion-solo mode.
   * cellIndex === -1 means start position, otherwise a step index.
   * Returns undefined when not in motion-solo or data is missing.
   */
  function getMotionSoloMotion(cellIndex: number):
    | import("$lib/shared/pictograph/shared/domain/models/MotionData").MotionData
    | undefined {
    if (!isMotionSoloMode) return undefined;
    const color = showBlueMotion ? "blue" : "red";
    if (cellIndex === -1) {
      const startData = sequence.startPosition ??
        (sequence.steps?.[0] ? createStartPositionFromBeatStart(sequence.steps[0]) : undefined);
      return startData?.motions?.[color] ?? undefined;
    }
    return sequence.steps?.[cellIndex]?.motions?.[color] ?? undefined;
  }

  /** Format turns for the solo-mode bottom-left badge. "fl" stays "fl".
   *  Returns empty string for 0 turns so the overlay stays hidden. */
  function formatSoloTurns(turns: number | "fl" | undefined | null): string {
    if (turns === undefined || turns === null) return "";
    if (turns === "fl") return "fl";
    if (turns === 0) return "";
    return turns.toString();
  }

  /** Short-form orientation label. Level 1-3 are "in", "out", "cl", "cn".
   *  Level 6 interradials collapse to 2-char forms. Returns null if unknown. */
  function shortOrientation(ori: string | undefined | null): string | null {
    if (!ori) return null;
    switch (ori) {
      case "in": return "in";
      case "out": return "out";
      case "clock": return "cl";
      case "counter": return "cn";
      case "clock_in": return "cli";
      case "clock_out": return "clo";
      case "counter_in": return "cni";
      case "counter_out": return "cno";
      default: return ori.length <= 3 ? ori : ori.slice(0, 3);
    }
  }

  /** Thin wrapper over extracted calculateGridPosition with component-scoped closure values */
  function calcGridPos(stepIndex: number, cols: number): { gridColumn: number; gridRow: number } {
    return calculateGridPosition(stepIndex, cols, includeStartPosition, startPositionLayout, mandalaLayoutOverride);
  }

  /** Format duration for badge display (e.g., 2 → "2×", 1.25 → "1.25×") */
  function formatDuration(d: number): string {
    return Number.isInteger(d) ? `${d}×` : `${d}×`;
  }

  /**
   * Fast relayout: update grid positions and column/row counts without re-rendering images.
   * Used when only columnCount or includeStartPosition changes - the pictograph images
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
      const { gridColumn, gridRow } = calcGridPos(cell.index, cols);
      return { ...cell, gridColumn, gridRow };
    });

    // Update the global cache entry with new positions
    const renderOptions = buildRenderOptionsFn();
    const isDark = darkMode;
    const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark, startPositionLayout);
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
    }, cells);
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
      // Calculate layout
      const stepCount = sequence.steps.length;
      let cols: number;
      let rws: number;

      // Detect mixed durations - determines uniform grid vs timeline rows
      const mixed = detectMixedDurations(sequence.steps);
      hasMixedDurations = mixed;

      // Resolve column count: explicit prop > composition setting (4+ steps) > layout table
      const resolvedColumnCount = columnCount
        ?? (stepCount >= 4 ? compositionManager.getColumnCountForStepCount(stepCount) : null);

      const spl = startPositionLayout;

      if (resolvedColumnCount !== null && resolvedColumnCount > 0) {
        // Manual or composition column override.
        // resolvedColumnCount is the number of *beat* columns.
        // Row layout: start sits in the top row, no extra column added.
        // Column layout: start occupies its own column, so cols = beats + 1.
        cols = includeStartPosition && spl === "column" ? resolvedColumnCount + 1 : resolvedColumnCount;
        if (includeStartPosition && spl === "row") {
          rws = 1 + Math.ceil(stepCount / cols);
        } else {
          const stepsPerRow = includeStartPosition ? cols - 1 : cols;
          const firstRowSteps = Math.min(stepsPerRow, stepCount);
          const remainingSteps = stepCount - firstRowSteps;
          rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
        }
      } else if (isLongSequence) {
        // Long sequences: fixed 5 columns (both scroll mode and export/forceContain)
        cols = 5;
        if (includeStartPosition && spl === "row") {
          rws = 1 + Math.ceil(stepCount / cols);
        } else {
          const stepsPerRow = includeStartPosition ? cols - 1 : cols;
          const firstRowSteps = Math.min(stepsPerRow, stepCount);
          const remainingSteps = stepCount - firstRowSteps;
          rws = 1 + Math.ceil(remainingSteps / stepsPerRow);
        }
      } else {
        [cols, rws] = calculateLayout(stepCount, includeStartPosition, spl);
      }

      columns = cols;

      // For mixed durations: compute timeline rows using row capacity.
      // Column mode: start is a separate column barrier, NOT inline in the first row.
      // Row mode: start occupies its own top row; steps use full width.
      let computedDurationRows: TimelineRow[] = [];
      if (mixed) {
        // cols already accounts for start-column in column mode (subtract 1
        // to get beat columns); in row mode start doesn't consume a column.
        const beatsPerRow = includeStartPosition && spl === "column" ? cols - 1 : cols;
        computedDurationRows = calculateTimelineRowsByBeatCount(sequence.steps, beatsPerRow);
        // Row mode adds a top row for the start position.
        rws = computedDurationRows.length + (includeStartPosition && spl === "row" ? 1 : 0);
        durationRows = computedDurationRows;
        // Compute max step duration units in any row. Column mode adds a
        // start-position column alongside; row mode does not.
        let maxStepUnits = 0;
        for (const row of computedDurationRows) {
          maxStepUnits = Math.max(maxStepUnits, row.totalDuration);
        }
        durationColCount = maxStepUnits + (includeStartPosition && spl === "column" ? 1 : 0);
      } else {
        durationRows = [];
        durationColCount = 0;
      }

      rows = rws;

      // Build render options once for all cells
      const renderOptions = buildRenderOptionsFn();

      // Only render the current mode - halves total render count
      const isDark = darkMode;

      // Check global cache - avoids re-rendering after drag-to-move
      const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark, startPositionLayout);
      const cached = globalPreviewCache.get(cacheKey);
      if (cached && cached.columns === cols && cached.rows === rws) {
        cells = cached.cells.map(c => ({ ...c, isLoaded: true }));
        hasMixedDurations = cached.hasMixedDurations ?? false;
        durationRows = cached.durationRows ?? [];
        durationColCount = cached.durationColCount ?? 0;
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
      // This gives the grid its full dimensions from frame one - no layout shift
      // as individual cells render. Cells show a spinner until loaded.
      const placeholderCells: CellData[] = [];

      // Start position placeholder
      const firstStep = sequence.steps[0];
      if (sequence.startPosition || firstStep) {
        const { gridColumn, gridRow } = calcGridPos(-1, cols);
        placeholderCells.push({
          index: -1, label: "Start",
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow, duration: 1,
        });
      }

      // Step placeholders
      for (let i = 0; i < sequence.steps.length; i++) {
        const { gridColumn, gridRow } = calcGridPos(i, cols);
        placeholderCells.push({
          index: i, label: isBrowseSoloMode ? getSoloLocationLabel(i) : String(i + 1),
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow,
          duration: sequence.steps[i]?.duration ?? 1,
        });
      }

      // Seed cellWidth from whatever containedWidth the observer already set.
      // Don't call updateContainedDimensions() here — the ResizeObserver on
      // containerElement is the sole source of truth for container size.
      // Reading it eagerly during a view-switch transition measures mid-layout
      // and produces tiny cells.
      if (containedWidth && cols > 0) {
        const newCw = containedWidth / cols;
        if (Math.abs(newCw - cellWidth) > 0.5) cellWidth = newCw;
      }

      // Suppress cellWidth observer updates during loading. Cell content swaps
      // cause preview-stack micro-fluctuations that cascade into font jitter.
      // Container dimensions are never suppressed (parent-sized, stable).
      suppressCellWidthUpdates = true;

      // Show grid with full dimensions immediately (placeholders fill all cells)
      cells = placeholderCells;
      isLoading = false;

      const totalCellCount = placeholderCells.length;
      let loadedCount = 0;

      // Build per-cell render tasks ahead of time - we need the pictograph data,
      // cell options (for mixed-duration widthMultiplier), and cache key for each.
      interface CellTask {
        cellIndex: number;           // -1 for start, 0..n-1 for steps
        data: PictographData;
        stepNumber: number | undefined;
        options: PreviewCellRenderOptions;
        cacheKey: string;
      }
      const tasks: CellTask[] = [];
      if (sequence.startPosition || firstStep) {
        const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
        tasks.push({
          cellIndex: -1,
          data: startData,
          stepNumber: undefined,
          options: renderOptions,
          cacheKey: cellCacheKeyDeriver.deriveCacheKey(startData, undefined, isDark, renderOptions),
        });
      }
      for (let i = 0; i < sequence.steps.length; i++) {
        const step = sequence.steps[i];
        if (!step) continue;
        const stepDuration = step.duration ?? 1;
        const cellOpts = (mixed && stepDuration !== 1)
          ? { ...renderOptions, widthMultiplier: stepDuration }
          : renderOptions;
        tasks.push({
          cellIndex: i,
          data: step,
          stepNumber: i + 1,
          options: cellOpts,
          cacheKey: cellCacheKeyDeriver.deriveCacheKey(step, i + 1, isDark, cellOpts),
        });
      }

      // PHASE 1: parallel IDB read for every cell. Any hit lets us paint the
      // cell instantly in a single batched assignment below. Misses fall
      // through to Phase 2 where the worker pool renders them in background.
      const blobResults = await Promise.all(
        tasks.map(t => pictographBlobCache.get(t.cacheKey).catch(() => null))
      );

      // Apply all IDB hits in a single batch assignment. One Svelte reactive
      // flush → one paint. Replaces the sequential cell-by-cell loop that
      // stalled warm sequences for ~1.5s.
      const updatedCells: CellData[] = cells.map(c => ({ ...c }));
      const missedTasks: { task: CellTask; cellArrayIndex: number }[] = [];
      let hitCount = 0;
      for (let t = 0; t < tasks.length; t++) {
        const task = tasks[t]!;
        const blob = blobResults[t];
        const idx = updatedCells.findIndex(c => c.index === task.cellIndex);
        if (idx === -1) continue;
        if (blob) {
          updatedCells[idx] = { ...updatedCells[idx]!, imageUrl: URL.createObjectURL(blob), isLoaded: true };
          hitCount++;
        } else {
          missedTasks.push({ task, cellArrayIndex: idx });
        }
      }
      cells = updatedCells;
      loadedCount = hitCount;
      onRenderProgress?.(loadedCount, totalCellCount);

      // PHASE 2: for cells that missed IDB, render via the worker pool in
      // parallel. Each cell updates independently as it completes, so the user
      // sees progressive fill-in for genuinely cold sequences.
      if (missedTasks.length > 0) {
        await Promise.allSettled(missedTasks.map(async ({ task, cellArrayIndex }) => {
          try {
            const imageUrl = await renderCell(task.data, task.stepNumber, isDark, task.options);
            const current = cells[cellArrayIndex];
            if (current && current.index === task.cellIndex && !current.isLoaded) {
              cells[cellArrayIndex] = { ...current, imageUrl, isLoaded: true };
              loadedCount++;
              onRenderProgress?.(loadedCount, totalCellCount);
            }
          } catch (err) {
            console.warn("[ChoreoCard] worker render failed for cell", task.cellIndex, err);
          }
        }));
      }

      // Store in global cache for reuse across component remounts
      storePreviewInCache(cacheKey, {
        cells: [...cells],
        columns: cols,
        rows: rws,
        durationRows: computedDurationRows,
        hasMixedDurations: mixed,
        durationColCount,
      }, cells);

      // Now safe to revoke old blob URLs - new ones are in the DOM
      for (const url of oldBlobUrls) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to render cells:", error);
    } finally {
      isRendering = false;
      suppressCellWidthUpdates = false;
      // Suppress flip animations during the post-render dimension adjustment.
      suppressFlip = true;
      // CellWidth was suppressed during loading — run once now.
      updateCellWidth();
      hasMounted = true;
      requestAnimationFrame(() => {
        suppressFlip = false;
        flipEnabled = true;
      });
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
  async function crossfadeCellImages(mode: "crossfade" | "swap" = "crossfade") {
    if (!sequence?.steps?.length || cells.length === 0) return;

    if (isRendering) {
      renderQueued = true;
      return;
    }
    isRendering = true;

    // Flush any pending cleanup timer from a previous cross-fade
    crossfader.flushPendingCrossfade(() => {
      cells = cells.map(c => ({ ...c, fadeOutUrl: undefined }));
    });

    try {
      const isDark = darkMode;
      const renderOptions = buildRenderOptionsFn();

      // Check global cache first - may already have the target mode rendered
      const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark, startPositionLayout);
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
          const imageUrl = await renderCell(startData, undefined, isDark, renderOptions);
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
          const imageUrl = await renderCell(step, i + 1, isDark, cellRenderOptions);
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
        }, cells);
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

      crossfader.beginCrossfade(isDark, mode);

      // Clean up after the CSS transition completes.
      crossfader.scheduleCrossfadeEnd(() => {
        cells = cells.map(c => ({ ...c, fadeOutUrl: undefined }));
      });
    } catch (error) {
      console.error("Failed to cross-fade dark mode:", error);
      // Fallback: apply dark mode immediately
      crossfader.setActiveDarkMode(darkMode);
    } finally {
      isRendering = false;
      if (renderQueued) {
        renderQueued = false;
        crossfader.abortCrossfade(() => {
          cells = cells.map(c => ({ ...c, fadeOutUrl: undefined }));
        });
        renderAllCells();
      }
    }
  }

  function clearCellUrls() {
    const cachedUrls = new Set<string>();
    for (const entry of globalPreviewCache.values()) {
      for (const c of entry.cells) {
        if (c.imageUrl.startsWith("blob:")) cachedUrls.add(c.imageUrl);
      }
    }
    for (const cell of cells) {
      if (cell.imageUrl.startsWith("blob:") && !cachedUrls.has(cell.imageUrl)) {
        URL.revokeObjectURL(cell.imageUrl);
      }
      if (cell.fadeOutUrl?.startsWith("blob:") && !cachedUrls.has(cell.fadeOutUrl)) {
        URL.revokeObjectURL(cell.fadeOutUrl);
      }
    }
    cells = [];
  }

  // Admin context menu (extracted to choreo-card-context-menu.ts)
  let contextMenuState: ContextMenuState = $state({ open: false });

  const contextMenuItems = $derived(
    buildChoreoCardContextMenu(sequence, featureFlagService.isAdmin, {
      forceRerender: forceRerenderAllCells,
    })
  );

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

    const renderOptions = buildRenderOptionsFn();
    const isDark = darkMode;

    // 1. Clear global in-memory preview cache entry for this sequence
    const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark, startPositionLayout);
    globalPreviewCache.delete(cacheKey);

    // 2. Delete IndexedDB blobs for all cells of this sequence
    const firstStep = sequence.steps[0];
    if (sequence.startPosition || firstStep) {
      const startData = sequence.startPosition || createStartPositionFromBeatStart(firstStep!);
      await deleteCellCache(startData, undefined, isDark, renderOptions);
    }
    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i];
      if (step) {
        await deleteCellCache(step, i + 1, isDark, renderOptions);
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

  // Calculate "contain" dimensions — fit preview-stack inside containerElement
  // while preserving aspect ratio. Never suppressed: the container root is
  // parent-sized (width/height: 100%) and unaffected by cell content swaps.
  // The ResizeObserver on containerElement is the sole trigger.
  let _containerWasZero = false;
  function updateContainedDimensions() {
    if (!containerElement || !previewAspectRatio || !Number.isFinite(previewAspectRatio)) {
      return;
    }

    const style = getComputedStyle(containerElement);
    const containerWidth = containerElement.clientWidth
      - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const containerHeight = containerElement.clientHeight
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);

    if (containerWidth === 0 || containerHeight === 0) {
      _containerWasZero = true;
      containedWidth = null;
      containedHeight = null;
      return;
    }

    const revealedFromZero = _containerWasZero;
    _containerWasZero = false;

    let newWidth: number | null;
    let newHeight: number | null;

    if (needsScroll) {
      containedWidth = null;
      containedHeight = null;
      return;
    }

    const contentRatio = previewAspectRatio;
    const containerRatio = containerWidth / containerHeight;

    if (forceContain && fitWidth) {
      const hFromWidth = containerWidth / contentRatio;
      if (Number.isFinite(hFromWidth) && hFromWidth > containerHeight) {
        newHeight = containerHeight;
        const w = containerHeight * contentRatio;
        newWidth = Number.isFinite(w) ? w : null;
      } else {
        newWidth = containerWidth;
        newHeight = Number.isFinite(hFromWidth) ? hFromWidth : null;
      }
    } else if (contentRatio > containerRatio) {
      newWidth = containerWidth;
      const h = containerWidth / contentRatio;
      newHeight = Number.isFinite(h) ? h : null;
    } else {
      newHeight = containerHeight;
      const w = containerHeight * contentRatio;
      newWidth = Number.isFinite(w) ? w : null;
    }

    const widthChanged = newWidth !== containedWidth && (newWidth === null || containedWidth === null || Math.abs(newWidth - containedWidth) > 0.5);
    const heightChanged = newHeight !== containedHeight && (newHeight === null || containedHeight === null || Math.abs(newHeight - containedHeight) > 0.5);

    if (widthChanged) containedWidth = newWidth;
    if (heightChanged) containedHeight = newHeight;

    if (revealedFromZero) {
      suppressFlip = true;
      requestAnimationFrame(() => {
        updateCellWidth();
        requestAnimationFrame(() => {
          suppressFlip = false;
        });
      });
    }
  }

  function updateCellWidth() {
    if (suppressCellWidthUpdates) return;

    if (previewStackElement && columns > 0) {
      const stackWidth = previewStackElement.clientWidth;
      if (stackWidth < 1) return;
      const newCellWidth = Number.isFinite(stackWidth / columns) ? stackWidth / columns : 0;
      if (Math.abs(newCellWidth - cellWidth) > 0.5) {
        cellWidth = newCellWidth;
      }
    }
  }

  // Track if initial render is complete (controls visibility gate)
  let hasMounted = $state(false);
  // Separate flag for FLIP — enabled one frame AFTER hasMounted so the
  // visibility reflow doesn't trigger FLIP with duration > 0.
  let flipEnabled = $state(false);
  const flipDuration = $derived(flipEnabled && !suppressFlip ? 250 : 0);
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
    const sbm = showBlueMotion;
    const srm = showRedMotion;
    const stnd = showTnD;
    const selm = showElemental;
    const spos = showPositions;
    // Read effectiveColumns so the effect fires when the composition manager's
    // column override changes (e.g. via the right-click column picker).
    const effCols = effectiveColumns;

    const durationKey = sequence?.steps?.map(s => s.duration ?? 1).join(",") ?? "";

    // Image key: props that affect the actual pictograph images (NOT grid positions).
    // Cell images are rendered at a fixed CELL_SIZE (240px) regardless of column
    // count, so column changes only need relayoutCells() (instant grid repositioning).
    const gv = `${stnd ? "1" : "0"}${selm ? "1" : "0"}${spos ? "1" : "0"}`;
    const imageKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bpt}-${rpt}-${cdm}-${ssn}-${snr}-${hpv}-${stka}-${sr}-${durationKey}-mv:${sbm ? "1" : "0"}${srm ? "1" : "0"}-gv:${gv}`;
    // Layout key: props that only affect grid positions (column count, start position toggle).
    const layoutKey = `${isp}-cols:${effCols}`;
    // Full content key combines both
    const contentKey = `${imageKey}-${layoutKey}`;
    const renderKey = `${contentKey}-${dm}`;

    if (!hasMounted) return;
    if (renderKey === lastEffectRenderKey) return;

    const cellsLoaded = untrack(() => cells.length > 0 && cells.some(c => c.isLoaded));
    const hasDurations = untrack(() => hasMixedDurations);
    const gridStableKey = `${stepCount}-${durationKey}-cols:${effCols}-isp:${isp}`;

    const changeType = crossfader.classifyChange(contentKey, imageKey, gridStableKey, cellsLoaded, hasDurations);

    lastEffectRenderKey = renderKey;
    crossfader.updateKeys({ contentKey, imageKey, gridStableKey });

    if (changeType === "dark-mode-only") {
      untrack(() => {
        crossfadeCellImages();
      });
    } else if (changeType === "layout-only") {
      crossfader.setActiveDarkMode(dm);
      untrack(() => {
        relayoutCells();
      });
    } else if (changeType === "grid-stable-image") {
      crossfader.setActiveDarkMode(dm);
      untrack(() => {
        crossfadeCellImages("swap");
      });
    } else {
      crossfader.setActiveDarkMode(dm);
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
  // scrolls ALL ancestor scroll containers - on the landing page this causes
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

  // Watch rerenderTrigger - parent increments to force a full cache-clearing re-render
  let lastRerenderTrigger = 0;
  $effect(() => {
    const trigger = rerenderTrigger;
    if (!hasMounted || trigger === lastRerenderTrigger) return;
    lastRerenderTrigger = trigger;
    untrack(() => {
      forceRerenderAllCells();
    });
  });

  onMount(() => {
    // Initialize keys so the $effect can detect dark-mode-only and layout-only changes
    const stepLetters = sequence?.steps?.map(s => s.letter ?? "?").join("") ?? "";
    const stepCount = sequence?.steps?.length ?? 0;
    const durationKey = sequence?.steps?.map(s => s.duration ?? 1).join(",") ?? "";
    const initImageKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bluePropType}-${redPropType}-${catDogModeEnabled}-${showStepNumbers}-${showNonRadial}-${handPointVis}-${showTKA}-${showReversals}-${durationKey}-mv:${showBlueMotion ? "1" : "0"}${showRedMotion ? "1" : "0"}-gv:${showTnD ? "1" : "0"}${showElemental ? "1" : "0"}${showPositions ? "1" : "0"}`;
    const initContentKey = `${initImageKey}-${includeStartPosition}-cols:${effectiveColumns}`;
    const initGridStableKey = `${stepCount}-${durationKey}-cols:${effectiveColumns}-isp:${includeStartPosition}`;
    crossfader.updateKeys({ contentKey: initContentKey, imageKey: initImageKey, gridStableKey: initGridStableKey });
    lastEffectRenderKey = `${initContentKey}-${darkMode}`;

    // Synchronous cache probe: if the global cache already has this exact render,
    // populate cells immediately so the first paint shows content instead of a
    // loading skeleton flash. renderAllCells() would also hit the cache, but it's
    // async - the component renders at least one frame with isLoading=true first.
    if (sequence?.steps?.length) {
      const renderOptions = buildRenderOptionsFn();
      const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, darkMode, startPositionLayout);
      const cached = globalPreviewCache.get(cacheKey);
      if (cached) {
        cells = cached.cells.map(c => ({ ...c, isLoaded: true }));
        columns = cached.columns;
        rows = cached.rows;
        hasMixedDurations = cached.hasMixedDurations ?? false;
        durationRows = cached.durationRows ?? [];
        durationColCount = cached.durationColCount ?? 0;
        isLoading = false;
        updateCellWidth();
        hasMounted = true;
        requestAnimationFrame(() => {
          flipEnabled = true;
        });
        return;
      }
    }

    renderAllCells();
  });

  onDestroy(() => {
    cancelLongPress();
    clearCellUrls();
    crossfader.destroy();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (containerObserver) {
      containerObserver.disconnect();
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="choreo-card-root" class:dark-mode={activeDarkMode} class:scroll-mode={needsScroll} class:force-contain={forceContain} bind:this={containerElement}
  oncontextmenu={(e: MouseEvent) => {
    e.preventDefault();
    if (longPressFired) {
      longPressFired = false;
      return;
    }
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
      style={needsScroll ? '' : `width: ${containedWidth ? `${containedWidth}px` : 'auto'}; height: ${containedHeight ? `${containedHeight}px` : 'auto'};${(!containedWidth || !containedHeight || cellWidth < 1) ? ' visibility: hidden;' : ''}`}
      bind:this={previewStackElement}
    >
      <!-- Header section -->
      <CardHeader
        {sequence}
        {showHeader}
        {isBrowseSoloMode}
        {soloColor}
        {browseViewMode}
        showDifficultyLevel={effectiveShowDifficulty}
        {difficultyLevel}
        {currentLevelStyle}
        {wordVisible}
        {showLoopGlyph}
        {loopComponents}
        {loopRotationPeriod}
        {loopInversionPeriod}
        {loopPeriod}
        {scaledHeaderHeight}
        {badgeSize}
        {badgePadding}
        {badgeNumberFontSize}
        {wordTitleFontSize}
        {activeDarkMode}
      />

      <!-- Grid section with individual pictograph cells -->
      <CardGridLayout
        {sequence}
        {cells}
        {visibleCells}
        {effectiveColumns}
        {effectiveRows}
        {hasMixedDurations}
        {durationRows}
        {durationColCount}
        {includeStartPosition}
        {needsScroll}
        {showHighlight}
        {highlightedStepIndex}
        {showQRCode}
        {qrDataUrl}
        {qrGridPosition}
        showMandala={showMandala}
        {mandalaPlacements}
        {flipDuration}
        {cellWidth}
        {activeDarkMode}
        {bluePropType}
        {redPropType}
        {onStepClick}
        onGridScrollRefChange={(el) => { gridScrollRef = el; }}
        {showStepNumbers}
        {crossfadeActive}
        transitionMode={crossfader.transitionMode}
        {isBrowseSoloMode}
        {isMotionSoloMode}
        {soloColor}
        {stepNumFontSize}
        {formatDuration}
        {getMotionSoloMotion}
        {formatSoloTurns}
        {shortOrientation}
      />

      <!-- Footer section -->
      <CardFooter
        {showFooter}
        {showCreatorName}
        {showNotes}
        {showBirthday}
        {hasPathShapeMetadata}
        {effectiveUserName}
        {customNotesText}
        {birthdayDate}
        {scaledFooterHeight}
        {footerFontSize}
        {footerMargin}
        {activeDarkMode}
      />
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

  /* In scroll mode, fill the parent edge-to-edge instead of using
     JS-calculated contain dimensions */
  .preview-stack.scroll-mode {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Light mode needs stronger dimming since opacity against light bg is subtle.
     This rule targets child component elements from the parent context. */
  .choreo-card-root:not(.dark-mode) :global(.pictograph-cell.played) {
    opacity: 0.4;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .preview-stack {
      transition: none;
    }
  }
</style>
