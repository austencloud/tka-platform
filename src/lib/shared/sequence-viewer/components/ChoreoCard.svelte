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
  import type { PreviewCellRenderOptions } from "../services/contracts/IPreviewCellRenderer";
  import { onMount, onDestroy, untrack } from "svelte";
  import { layoutCalculator } from "$lib/shared/render/services/implementations/LayoutCalculator";
  import { SequenceDifficultyCalculator } from "$lib/features/browse/sequences/display/services/implementations/SequenceDifficultyCalculator";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";
  import ContextMenu from "$lib/shared/components/context-menu/ContextMenu.svelte";
  import type { ContextMenuEntry, ContextMenuState } from "$lib/shared/components/context-menu/context-menu-types";
  import { featureFlagService } from "$lib/shared/auth/services/PostHogFeatureFlagService.svelte";
  import { getClaudeCodeCopier } from "$lib/features/browse/sequences/display/getClaudeCodeCopier";
  import { getQRCodeGenerator } from "$lib/shared/qr/getQRCodeGenerator";
  import { toast } from "$lib/shared/toast/state/toast-state.svelte";
  import { DEFAULT_SHARE_OPTIONS } from "$lib/shared/share/domain/models/ShareOptions";
  import { createStartPositionFromBeatStart } from "$lib/features/create/shared/services/implementations/sequence-transforms/sequence-transforms";
  import { previewCellRenderer } from "../services/implementations/PreviewCellRenderer";
  import { cellCacheKeyDeriver } from "../services/implementations/CellCacheKeyDeriver";
  import { pictographBlobCache } from "$lib/shared/render/services/implementations/PictographBlobCache";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { tryGetViewerVisibilityContext } from "../context/viewer-visibility-context";
  import { simplifyAndTruncate } from "$lib/features/create/shared/workspace-panel/shared/utils/word-simplifier";
  import { calculateTimelineRowsByBeatCount } from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
  import type { TimelineRow } from "$lib/features/create/shared/workspace-panel/sequence-display/utils/grid-calculations";
  import { getMandalaPlacements } from "../services/getMandalaPlacements";

  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte";

  // Extracted sub-components
  import CardHeader from "./CardHeader.svelte";
  import CardFooter from "./CardFooter.svelte";
  import CardGridLayout from "./CardGridLayout.svelte";
  import {
    HEADER_HEIGHT_DIVISOR, FOOTER_HEIGHT_DIVISOR,
    BADGE_SIZE_SCALE, BADGE_PADDING_SCALE, BADGE_NUMBER_FONT_SCALE,
    HEADER_WORD_FONT_SCALE, HEADER_WORD_FONT_MIN_SCALE,
    FOOTER_FONT_SCALE, FOOTER_MARGIN_SCALE,
    STEP_NUMBER_FONT_RATIO, STEP_NUMBER_FONT_MAX,
  } from "@tka/render-composition";

  // Eagerly initialize the singleton so its constructor (which mutates $state)
  // runs in the script block, not inside a $derived expression.
  const compositionManager = getImageCompositionManager();

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
  }
  const MAX_PREVIEW_CACHE = 30;
  const globalPreviewCache = new Map<string, CachedPreview>();

  function getPreviewCacheKey(
    seq: SequenceData,
    opts: PreviewCellRenderOptions,
    colCount: number | null,
    isDark: boolean,
    spl: "row" | "column" = "column",
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
    // Resolve prop types to actual values (fall back to global settings) so the
    // in-memory cache differentiates between e.g. staff and fan when the caller
    // doesn't explicitly pass a prop type override.
    const settings = getSettings();
    const resolvedBlue = opts.bluePropType ?? settings.bluePropType ?? "staff";
    const resolvedRed = opts.redPropType ?? settings.redPropType ?? "staff";
    const mv = `${opts.showBlueMotion === false ? "B0" : "B1"}${opts.showRedMotion === false ? "R0" : "R1"}`;
    const gv = `${opts.showVTG ? "V1" : "V0"}${opts.showElemental ? "E1" : "E0"}${opts.showPositions ? "P1" : "P0"}`;
    return `${seq.id ?? seq.word ?? "?"}-${stepLetters}-${seq.steps?.length ?? 0}-${opts.size}-${opts.showStepNumbers}-${opts.showNonRadialPoints}-${opts.showTKA}-${opts.showReversals}-${opts.handPathMode ?? false}-${resolvedBlue}-${resolvedRed}-${colCount ?? "auto"}-${isDark ? "dark" : "light"}-spl:${spl}-d:${durationFingerprint}-m:${motionFingerprint}-vm:${vmKey}-mv:${mv}-gv:${gv}`;
  }

  function storePreviewInCache(key: string, data: CachedPreview): void {
    if (globalPreviewCache.size >= MAX_PREVIEW_CACHE && !globalPreviewCache.has(key)) {
      const oldest = globalPreviewCache.keys().next().value;
      if (oldest !== undefined) {
        const evicted = globalPreviewCache.get(oldest);
        if (evicted) {
          const activeUrls = new Set<string>();
          for (const c of cells) {
            if (c.imageUrl.startsWith("blob:")) activeUrls.add(c.imageUrl);
            if (c.fadeOutUrl?.startsWith("blob:")) activeUrls.add(c.fadeOutUrl);
          }
          for (const cell of evicted.cells) {
            if (cell.imageUrl.startsWith("blob:") && !activeUrls.has(cell.imageUrl)) {
              URL.revokeObjectURL(cell.imageUrl);
            }
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
    /** When true, fill empty col-0 cells with mandala visualizations */
    showMandala?: boolean;
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
  // Do NOT initialize to false - that causes a one-frame flash where backgrounds
  // render in light mode even though the images are rendered for dark mode.
  let activeDarkMode = $state(untrack(() => darkMode));
  let lastContentKey = "";
  let lastImageKey = "";
  // Tracks the portion of the render key that drives GRID STRUCTURE (cell
  // count, columns, durations, start-position row). Crossfade-swaps are
  // only safe when this is unchanged - otherwise cells might shift
  // between old/new rows mid-transition and read as visual glitches.
  let lastGridStableKey = "";

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

  // Start-position layout - "row" puts start in a top row spanning all columns,
  // "column" puts start in a left column. Per-step-count override, falls back
  // to global default. Read reactively via compositionVersion.
  const startPositionLayout = $derived.by<"row" | "column">(() => {
    void compositionVersion;
    if (startPositionLayoutOverride) return startPositionLayoutOverride;
    const stepCount = sequence?.steps?.length ?? 0;
    if (stepCount === 0) return compositionManager.startPositionLayout;
    return compositionManager.getStartPositionLayoutForStepCount(stepCount);
  });

  // Motion visibility: viewer-scoped. When rendered outside a viewer
  // (browse previews, export pipeline), fall back to always-visible.
  const viewerVisibility = tryGetViewerVisibilityContext();
  const showBlueMotion = $derived(viewerVisibility?.blueMotion ?? true);
  const showRedMotion = $derived(viewerVisibility?.redMotion ?? true);
  const allMotionsVisible = $derived(showBlueMotion && showRedMotion);
  const showVTG = $derived.by(() => {
    void glyphVisibilityVersion;
    return vm.getRawGlyphVisibility("vtgGlyph");
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

  // Find the grid position for the QR code.
  // Column layout: bottom of column 1 (under start position). Needs 2+ rows.
  // Row layout: rightmost cell of row 1 (the start row), alongside the start pictograph.
  const qrGridPosition = $derived.by(() => {
    if (!showQRCode || !includeStartPosition) return null;
    if (mandalaLayoutOverride) {
      return {
        gridColumn: mandalaLayoutOverride.qrPos.col,
        gridRow: mandalaLayoutOverride.qrPos.row,
      };
    }
    if (startPositionLayout === "row") {
      if (effectiveColumns < 2) return null;
      return { gridColumn: effectiveColumns, gridRow: 1 };
    }
    if (effectiveRows < 2) return null;
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

    // Generate async - read prop values outside the async callback
    // to avoid tracking additional reactive dependencies
    const seq = sequence;
    const isDark = darkMode;
    const bProp = bluePropType ? String(bluePropType) : undefined;
    const rProp = redPropType ? String(redPropType) : undefined;
    const qrGenerator = getQRCodeGenerator();
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
        // QR is optional - don't block the card
      });
  });

  // Layout calculations
  const difficultyCalculator = new SequenceDifficultyCalculator();

  // Calculate difficulty level (with null safety)
  const difficultyLevel = $derived.by(() => {
    if (!sequence?.steps?.length) return 1;
    return difficultyCalculator.calculateDifficultyLevel([...sequence.steps]);
  });

  // Parse LOOP components for the glyph. The resolver handles both the
  // stored-loopType path (fast) and the on-demand detect path (when a
  // sequence was edited and its stored loopType might be stale), plus
  // caching keyed by sequence id.
  const loopDisplay = $derived.by(() => resolveLoopDisplay(sequence));
  const loopComponents = $derived(
    loopDisplay.components.size > 0 ? loopDisplay.components : null
  );
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

  // When a motion is hidden the sequence becomes a hand-path view: letters
  // are undefined, so the word (which is concatenated letters) must hide too.
  const wordVisible = $derived(showWord && !!sequence.word && allMotionsVisible);

  // Show header when difficulty, LOOP glyph, or word is enabled.
  // The "Blue Prop Path" style header belongs to browse-solo; motion-solo
  // just hides the word and doesn't inject a replacement title.
  const showHeader = $derived(
    (isBrowseSoloMode && !hideSoloHeader) ||
    showDifficultyLevel || (showLoopGlyph && !!loopComponents) || wordVisible
  );

  // Show footer when any footer element is enabled
  const hasPathShapeMetadata = $derived(sequence?.metadata?.pathShape === "linear");
  const showFooter = $derived(showCreatorName || showNotes || showBirthday || hasPathShapeMetadata);

  // Format birthday date - use the sequence's saved birthday when available.
  // Values from Firestore may arrive as Timestamp objects instead of Date,
  // so coerce to Date before calling Date methods.
  const birthdayDate = $derived.by(() => {
    const raw = sequence.birthday ?? sequence.createdAt ?? sequence.dateAdded ?? new Date();
    const date = raw instanceof Date ? raw : typeof (raw as any).toDate === "function" ? (raw as any).toDate() : new Date(raw as any);
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

  // Effective columns - synchronously computed from layout tables so the grid
  // updates immediately when includeStartPosition toggles (before async re-render).
  // Row layout: start sits in the top row, no extra column is added.
  // Column layout: start sits in its own left column, so beat cols + 1.
  const baseColumns = $derived.by(() => {
    if (!sequence?.steps?.length) return columns || 0;
    const stepCount = sequence.steps.length;
    const spl = startPositionLayout;

    if (columnCount !== null && columnCount > 0) {
      // columnCount is the number of *beat* columns the user wants.
      // Column layout adds a dedicated start column; row layout does not.
      return includeStartPosition && spl === "column" ? columnCount + 1 : columnCount;
    }
    // Check per-length column count from global composition settings (4+ steps only)
    if (stepCount >= 4) {
      const compositionCols = compositionManager.getColumnCountForStepCount(stepCount);
      if (compositionCols !== null && compositionCols > 0) {
        return includeStartPosition && spl === "column" ? compositionCols + 1 : compositionCols;
      }
    }
    // Long sequences use fixed 5 columns whether scrolling or force-contained.
    // This keeps the cell grid positions consistent so entering export mode
    // doesn't trigger a full re-render with different column positions.
    if (isLongSequence) {
      return 5;
    }
    // Use the layout service directly for an instant column count
    const [cols] = layoutCalculator.calculateLayout(stepCount, includeStartPosition, spl);
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

  // Effective rows - must match effective columns to keep aspect ratio correct.
  // When the column count comes from any override (prop, composition manager,
  // or isLongSequence), derive rows from that count instead of the layout table
  // (which assumes its own column count and would produce wrong rows).
  const baseRows = $derived.by(() => {
    if (!sequence?.steps?.length) return rows || 0;
    const stepCount = sequence.steps.length;

    // If we know the column count (prop override, composition manager, or
    // long-sequence), derive rows from it. The composition manager check
    // mirrors baseColumns so the two stay in sync.
    const cols = baseColumns;
    const spl = startPositionLayout;
    const hasCompositionOverride = stepCount >= 4
      && compositionManager.getColumnCountForStepCount(stepCount) !== null;
    if (cols > 0 && (columnCount !== null || isLongSequence || hasCompositionOverride)) {
      if (includeStartPosition && spl === "row") {
        // Row layout: start occupies row 0 alone; steps fill full-width rows 1+.
        return 1 + Math.ceil(stepCount / cols);
      }
      // Column layout (or no start): steps use cols-startCol columns, first row
      // already holds some steps alongside the start position.
      const stepsPerRow = includeStartPosition ? cols - 1 : cols;
      const firstRowSteps = Math.min(stepsPerRow, stepCount);
      const remainingSteps = stepCount - firstRowSteps;
      return 1 + Math.ceil(remainingSteps / stepsPerRow);
    }

    const [, rws] = layoutCalculator.calculateLayout(stepCount, includeStartPosition, spl);

    // Column layout only: mandala fill needs at least one col-1 empty between
    // start and QR. 6-count naturally lays out as 4×2 (packed); when mandala
    // is on, expand to 4×3 so col 1 has a single empty cell (Full mandala).
    // Row layout doesn't need this - mandalas go in the top row alongside
    // start/QR and don't require an extra row.
    if (
      showMandala
      && showQRCode
      && includeStartPosition
      && spl === "column"
      && stepCount === 6
      && rws === 2
    ) {
      return 3;
    }
    return rws;
  });

  // Compute mandala placements + optional 4-count horizontal layout override.
  // Takes base dims as inputs; the override reshapes dims downstream.
  const mandalaResult = $derived.by(() => {
    return getMandalaPlacements({
      stepCount: sequence?.steps?.length ?? 0,
      cols: baseColumns,
      rows: baseRows,
      includeStartPosition,
      showQRCode,
      blueVisible: showBlueMotion,
      redVisible: showRedMotion,
      mandalaEnabled: showMandala,
      startPositionLayout,
    });
  });
  const mandalaLayoutOverride = $derived(mandalaResult.layoutOverride);
  const mandalaPlacements = $derived(mandalaResult.placements);

  // Final effective dims - override wins for the 4-count horizontal case.
  const effectiveColumns = $derived(mandalaLayoutOverride?.cols ?? baseColumns);
  const effectiveRows = $derived(mandalaLayoutOverride?.rows ?? baseRows);

  // Compute aspect ratio for the entire preview (width / height)
  // This ensures the preview maintains correct proportions regardless of container size
  const previewAspectRatio = $derived.by(() => {
    if (!effectiveColumns || !effectiveRows) return 1;

    // Width in cell units - use effectiveColumns so the aspect ratio updates
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

    // Header and footer fractions use shared constants from @tka/render-composition
    // so the interactive card and the export image never drift.
    // For narrow grids (<=2 columns), scale fractions down so header/footer
    // don't dominate the card. This matches the headerFooterRefWidth cap.
    const cols = effectiveColumns;
    const hfScale = cols >= 3 ? 1 : cols / 3;
    const headerFraction = showHeader ? (1 / HEADER_HEIGHT_DIVISOR) * hfScale : 0;
    const footerFraction = showFooter ? (1 / FOOTER_HEIGHT_DIVISOR) * hfScale : 0;

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
    const proportional = Math.floor(headerFooterRefWidth / HEADER_HEIGHT_DIVISOR);
    // On-screen viewing needs a minimum readable height (24px).
    // Export/forceContain mode uses exact proportional sizing for WYSIWYG fidelity.
    return forceContain ? proportional : Math.max(proportional, 24);
  });

  const scaledFooterHeight = $derived.by(() => {
    if (!headerFooterRefWidth) return 0;
    return Math.floor(headerFooterRefWidth / FOOTER_HEIGHT_DIVISOR);
  });

  // Step number font size uses shared constant from @tka/render-composition.
  // Using cellWidth directly instead of cqw ensures consistent sizing
  // even for wider duration cells.
  const stepNumFontSize = $derived(
    cellWidth ? Math.min(Math.round(cellWidth * STEP_NUMBER_FONT_RATIO), STEP_NUMBER_FONT_MAX) : 0
  );

  const badgeSize = $derived(scaledHeaderHeight * BADGE_SIZE_SCALE);
  const badgePadding = $derived(scaledHeaderHeight * BADGE_PADDING_SCALE);
  const badgeNumberFontSize = $derived(Math.round(badgeSize * BADGE_NUMBER_FONT_SCALE));

  // Word title font size: shrinks for longer words so the full title fits
  // between the difficulty badge and LOOP icon without clipping.
  // Count letter units (dashes don't count as separate letters).
  const wordTitleFontSize = $derived.by(() => {
    const baseFontSize = Math.floor(scaledHeaderHeight * HEADER_WORD_FONT_SCALE);
    if (!sequence.word) return baseFontSize;

    const displayWord = simplifyAndTruncate(sequence.word, 16);
    let letterCount = 0;
    for (let i = 0; i < displayWord.length; i++) {
      const ch = displayWord[i];
      if (ch !== "-" && ch !== "." && ch !== " ") letterCount++;
    }

    // Up to 10 letters: full size. Beyond that, scale down proportionally.
    if (letterCount <= 10) return baseFontSize;
    return Math.max(Math.floor(baseFontSize * (10 / letterCount)), Math.floor(scaledHeaderHeight * HEADER_WORD_FONT_MIN_SCALE));
  });

  // Footer font/margin use shared constants from @tka/render-composition
  const footerFontSize = $derived(Math.floor(scaledFooterHeight * FOOTER_FONT_SCALE));
  const footerMargin = $derived(Math.floor(scaledFooterHeight * FOOTER_MARGIN_SCALE));


  /**
   * Build render options from current component state
   */
  function buildRenderOptions(): PreviewCellRenderOptions {
    return {
      size: CELL_SIZE,
      bluePropType,
      redPropType,
      catDogModeEnabled,
      // Never bake step numbers into the rendered blob - identical pictographs
      // at different beats must share the same cached image. Step numbers are
      // rendered as HTML overlays on top of the <img> instead.
      showStepNumbers: false,
      showNonRadialPoints: showNonRadial,
      handPointVisibility: handPointVis,
      showTKA: isSoloMode ? false : showTKA,
      showReversals: isSoloMode ? false : showReversals,
      showVTG: isSoloMode ? false : showVTG,
      showElemental: isSoloMode ? false : showElemental,
      showPositions: isSoloMode ? false : showPositions,
      handPathMode,
      browseViewMode,
      showBlueMotion,
      showRedMotion,
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
    // 4-count horizontal mandala override: start/step positions come from the override spec.
    const override = mandalaLayoutOverride;
    if (override) {
      if (stepIndex === -1) {
        return { gridColumn: override.startPos.col, gridRow: override.startPos.row };
      }
      const pos = override.stepPositions[stepIndex];
      if (pos) return { gridColumn: pos.col, gridRow: pos.row };
    }

    // Start position is always at column 1, row 1
    if (stepIndex === -1) {
      return { gridColumn: 1, gridRow: 1 };
    }

    if (includeStartPosition && startPositionLayout === "row") {
      // Row layout: start position occupies row 1 alone; steps fill full-width
      // rows starting at row 2, using all `cols` columns.
      const col = (stepIndex % cols) + 1;
      const row = Math.floor(stepIndex / cols) + 2;
      return { gridColumn: col, gridRow: row };
    }

    if (includeStartPosition) {
      // Column layout: col 1 is reserved for start, steps start at col 2.
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
      const { gridColumn, gridRow } = calculateGridPosition(cell.index, cols);
      return { ...cell, gridColumn, gridRow };
    });

    // Update the global cache entry with new positions
    const renderOptions = buildRenderOptions();
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
        [cols, rws] = layoutService.calculateLayout(stepCount, includeStartPosition, spl);
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
      const renderOptions = buildRenderOptions();

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
          index: i, label: isBrowseSoloMode ? getSoloLocationLabel(i) : String(i + 1),
          imageUrl: "", isLoaded: false,
          gridColumn, gridRow,
          duration: sequence.steps[i]?.duration ?? 1,
        });
      }

      // Pre-calculate contain dimensions and cellWidth BEFORE inserting cells.
      // The containerElement (.choreo-card-root) has parent-determined dimensions
      // (width: 100%; height: 100%), so its size is valid even before cells exist.
      // Without this, the first frame shows auto-sized content that snaps to
      // calculated dimensions on the next frame - a visible jump.
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
      // sees progressive fill-in for genuinely cold sequences. Scheduling at
      // background priority keeps 3D's main-thread budget unstarved.
      if (missedTasks.length > 0) {
        const scheduleRender = async (task: CellTask, cellArrayIndex: number) => {
          const run = async () => {
            try {
              const imageUrl = await previewCellRenderer.renderCell(task.data, task.stepNumber, isDark, task.options);
              // Only apply if the cell is still the placeholder we queued - a
              // later renderAllCells() may have replaced it with a newer render.
              const current = cells[cellArrayIndex];
              if (current && current.index === task.cellIndex && !current.isLoaded) {
                cells[cellArrayIndex] = { ...current, imageUrl, isLoaded: true };
                loadedCount++;
                onRenderProgress?.(loadedCount, totalCellCount);
              }
            } catch (err) {
              console.warn("[ChoreoCard] worker render failed for cell", task.cellIndex, err);
            }
          };
          const scheduler = (globalThis as { scheduler?: { postTask?: (cb: () => unknown, opts: { priority: string }) => Promise<unknown> } }).scheduler;
          if (scheduler?.postTask) {
            await scheduler.postTask(run, { priority: "background" });
          } else {
            await run();
          }
        };
        await Promise.allSettled(missedTasks.map(m => scheduleRender(m.task, m.cellArrayIndex)));
      }

      // Store in global cache for reuse across component remounts
      storePreviewInCache(cacheKey, {
        cells: [...cells],
        columns: cols,
        rows: rws,
        durationRows: computedDurationRows,
        hasMixedDurations: mixed,
        durationColCount,
      });

      // Now safe to revoke old blob URLs - new ones are in the DOM
      for (const url of oldBlobUrls) {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to render cells:", error);
    } finally {
      isRendering = false;
      suppressObserverUpdates = false;
      // Suppress flip animations during the post-render dimension adjustment.
      // Without this, updateContainedDimensions() resizes the grid, triggering
      // animate:flip on all cells. If hasMounted becomes true in the same Svelte
      // batch (via the .then() callback), flipDuration jumps from 0 to 250ms and
      // the animation can be interrupted by a queued re-render, leaving transforms
      // stuck at ~97% completion (visible as shrunken cells with black gaps).
      suppressFlip = true;
      // Measurements were suppressed during rendering to prevent per-cell jumps.
      // Run them once now that all cells are loaded.
      updateCellWidth();
      updateContainedDimensions();
      // Re-enable flip after the dimension adjustment settles
      requestAnimationFrame(() => { suppressFlip = false; });
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
  async function crossfadeCellImages() {
    if (!sequence?.steps?.length || cells.length === 0) return;

    if (isRendering) {
      renderQueued = true;
      return;
    }
    isRendering = true;

    // Flush any pending cleanup timer from a previous cross-fade BEFORE
    // reading the cache. Without this, a rapid toggle (dark→light→dark within
    // 400ms) can pull URLs from the cache that the pending timer is about to
    // revoke - causing ERR_FILE_NOT_FOUND when the timer fires during our await.
    if (crossfadeTimer) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
      crossfadeActive = false;
      cells = cells.map(c => ({ ...c, fadeOutUrl: undefined }));
    }

    try {
      const isDark = darkMode;
      const renderOptions = buildRenderOptions();

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

      // Clean up after the CSS transition completes.
      // Don't revoke fadeOutUrl blob URLs here - they may still be referenced
      // by globalPreviewCache entries for other modes (e.g. the opposite
      // motion-visibility state). Revoking them poisons the cache, causing
      // ERR_FILE_NOT_FOUND on the next toggle. URLs are revoked later by
      // renderAllCells (full re-render), storePreviewInCache (eviction),
      // or clearCellUrls (component destroy).
      if (crossfadeTimer) clearTimeout(crossfadeTimer);
      crossfadeTimer = setTimeout(() => {
        crossfadeActive = false;
        cells = cells.map(c => ({ ...c, fadeOutUrl: undefined }));
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
              const copier = getClaudeCodeCopier();
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
    const cacheKey = getPreviewCacheKey(sequence, renderOptions, columnCount, isDark, startPositionLayout);
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
    // Don't recalculate during cell loading - aspect ratio and container
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
          // Card would be taller than container - constrain by height instead
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
    // Don't update cellWidth while cells are loading sequentially -
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
    const sbm = showBlueMotion;
    const srm = showRedMotion;
    const svtg = showVTG;
    const selm = showElemental;
    const spos = showPositions;
    // Read effectiveColumns so the effect fires when the composition manager's
    // column override changes (e.g. via the right-click column picker).
    const effCols = effectiveColumns;

    const durationKey = sequence?.steps?.map(s => s.duration ?? 1).join(",") ?? "";

    // Image key: props that affect the actual pictograph images (NOT grid positions).
    // effectiveColumns is included here so column count changes trigger a full
    // re-render (not just relayout) - the grid structure, pass dividers, and
    // cell sizes all change when columns change.
    const gv = `${svtg ? "1" : "0"}${selm ? "1" : "0"}${spos ? "1" : "0"}`;
    const imageKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bpt}-${rpt}-${cdm}-${ssn}-${snr}-${hpv}-${stka}-${sr}-${durationKey}-cols:${effCols}-mv:${sbm ? "1" : "0"}${srm ? "1" : "0"}-gv:${gv}`;
    // Layout key: props that only affect grid positions (start position toggle).
    const layoutKey = `${isp}`;
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

    // Grid-structure key: anything that changes row/column count or cell
    // positions. When this is unchanged we can safely reuse the crossfade
    // path for image-content swaps (motion visibility toggle, glyph
    // overlays, etc.) - each cell keeps its slot, only its image changes.
    const gridStableKey = `${stepCount}-${durationKey}-cols:${effCols}-isp:${isp}`;
    const gridStable = gridStableKey === lastGridStableKey && cellsLoaded;

    lastEffectRenderKey = renderKey;
    lastContentKey = contentKey;
    lastImageKey = imageKey;
    lastGridStableKey = gridStableKey;

    if (isDarkModeOnly) {
      untrack(() => {
        crossfadeCellImages();
      });
    } else if (isLayoutOnly) {
      activeDarkMode = dm;
      untrack(() => {
        relayoutCells();
      });
    } else if (gridStable && imageChanged) {
      // Grid structure stable, only cell images need to swap - reuse the
      // crossfade path so the transition reads as a smooth fade rather
      // than a visible pop. Covers motion-visibility toggles, VTG /
      // elemental / positions overlays, TKA glyph, reversal dots, etc.
      activeDarkMode = dm;
      untrack(() => {
        crossfadeCellImages();
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
    lastImageKey = `${sequence?.id ?? ""}-${stepLetters}-${stepCount}-${bluePropType}-${redPropType}-${catDogModeEnabled}-${showStepNumbers}-${showNonRadial}-${handPointVis}-${showTKA}-${showReversals}-${durationKey}-cols:${effectiveColumns}-mv:${showBlueMotion ? "1" : "0"}${showRedMotion ? "1" : "0"}-gv:${showVTG ? "1" : "0"}${showElemental ? "1" : "0"}${showPositions ? "1" : "0"}`;
    lastContentKey = `${lastImageKey}-${includeStartPosition}`;
    lastEffectRenderKey = `${lastContentKey}-${darkMode}`;
    lastGridStableKey = `${stepCount}-${durationKey}-cols:${effectiveColumns}-isp:${includeStartPosition}`;

    // Synchronous cache probe: if the global cache already has this exact render,
    // populate cells immediately so the first paint shows content instead of a
    // loading skeleton flash. renderAllCells() would also hit the cache, but it's
    // async - the component renders at least one frame with isLoading=true first.
    if (sequence?.steps?.length) {
      const renderOptions = buildRenderOptions();
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
        hasMounted = true;
        return;
      }
    }

    renderAllCells().then(() => {
      hasMounted = true;
    });
  });

  onDestroy(() => {
    cancelLongPress();
    clearCellUrls();
    if (crossfadeTimer) clearTimeout(crossfadeTimer);
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
      class:smooth-resize={hasMounted}
      class:height-growing={heightGrowing}
      style={needsScroll ? '' : `width: ${containedWidth ? `${containedWidth}px` : 'auto'}; height: ${containedHeight ? `${containedHeight}px` : 'auto'};`}
      bind:this={previewStackElement}
    >
      <!-- Header section -->
      <CardHeader
        {sequence}
        {showHeader}
        {isBrowseSoloMode}
        {soloColor}
        {browseViewMode}
        {showDifficultyLevel}
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
