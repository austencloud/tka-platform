<!--
AnimatorCanvas.svelte - Canvas2D Animation Canvas

================================================================================
ARCHITECTURAL NOTE
================================================================================

This component is a thin wrapper around AnimationEngine.

All orchestration logic has been extracted to:
  src/lib/shared/animation-engine/services/animation-engine.svelte.ts

The component's role:
1. Mount container element
2. Initialize engine
3. Pass props to engine.update() in single $effect
4. Derive state from engine.animatorState
5. Render template (canvas-wrapper, GlyphOverlay, ProgressOverlay)
6. Disassemble/reassemble: same DOM tree, CSS transitions only

Last audit: 2025-12-27
================================================================================
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";
  import type { TrailSettings } from "../domain/types/trail-types";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/trail-capture-types";
  import CanvasSurface from "./CanvasSurface.svelte";
  import WordHeader from "./layers/WordHeader.svelte";
  import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
  import SequenceProgressBar from "$lib/shared/animation-engine/components/layers/SequenceProgressBar.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { createAnimatorPlaybackAdapter } from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { AnimationEngine } from "../services/animation-engine.svelte";
  import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";
  import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import {
    tryGetLoopDisplayResolver,
    type LoopDisplay,
  } from "$lib/shared/loop-labeler/get-loop-display-resolver";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { FireOverlayConfig } from "../domain/types/fire-types";
  import type { LedOverlayConfig } from "../domain/types/led-types";
  import type { TipEffectMap, TipEffortMap, EffectType } from "../domain/types/tip-effect-types";
  import CanvasContextMenuHost from "./canvas-context-menu/CanvasContextMenuHost.svelte";
  import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
  import SplitCanvasView from "./SplitCanvasView.svelte";
  import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

  // Props
  let {
    blueProp,
    redProp,
    additionalLayers = [],
    tunnelSpectrum = true,
    tunnelSelectedLayer = null,
    gridVisible = true,
    gridMode = GridMode.DIAMOND,
    backgroundAlpha = 1,
    letter = null,
    stepData = null,
    sequenceData = null,
    currentStep = 0,
    isPlaying = false,
    onCanvasReady = () => {},
    onPlaybackToggle = () => {},
    trailSettings: externalTrailSettings = $bindable(),
    bluePropType = null,
    redPropType = null,
    word = null,
    previewDarkMode = null,
    hideTkaGlyph = false,
    hideStepNumbers = false,
    positionGlyphVisible = false,
    hidePathLines = false,
    hideProgressBar = false,
    hideHeader = false,
    isSeamlesslyLoopable = undefined,
    progressBarVariant = "gradient",
    onProgressBarSeek = null,
    onProgressBarScrubStart = null,
    onProgressBarScrubEnd = null,
    focused = false,
    fireConfig = undefined,
    ledConfig = undefined,
    tipEffectMap: cellTipEffectMap = undefined,
    tipEffortMap: cellTipEffortMap = undefined,
    disableContextMenu = false,
    fillContainer = false,
    prewarmEffects = undefined,
    showNonRadialPoints = true,
    resizePaused = false,
    onInitialized: onInitializedCallback = undefined,
    onEffectError = undefined,
    visibilityManagerOverride = undefined,
    effectsConfigState = undefined,
    externalToggleDisassemble = undefined,
    externalDisassembled = false,
    suppress2DOverlays = false,
    virtualTime = undefined,
    onToggle3DView = undefined,
    contextId = undefined,
    tapToToggle = false,
    hidePlay = undefined,
    overlayTransport = false,
    progressLine = false,
    hoverHint = "none",
    cornerToggle = false,
    extraContextMenuItems = [],
    beatIndicators = true,
    bpm = undefined,
    onBpmChange = undefined,
    playbackMode = undefined,
    onPlaybackModeChange = undefined,
  }: {
    blueProp: PropState | null;
    redProp: PropState | null;
    additionalLayers?: AdditionalLayerProps[];
    tunnelSpectrum?: boolean;
    tunnelSelectedLayer?: number | null;
    gridVisible?: boolean;
    gridMode?: GridMode | null;
    backgroundAlpha?: number;
    letter?: Letter | null;
    stepData?: StartPositionData | StepData | null;
    sequenceData?: SequenceData | null;
    currentStep?: number;
    isPlaying?: boolean;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onPlaybackToggle?: () => void;
    trailSettings?: TrailSettings;
    bluePropType?: string | null;
    redPropType?: string | null;
    word?: string | null;
    previewDarkMode?: boolean | null;
    hideTkaGlyph?: boolean;
    hideStepNumbers?: boolean;
    /** Show the α/β/γ start→end position indicator centered at the top. Educational
     *  overlay for the guide's hand-path exploration; off by default everywhere else. */
    positionGlyphVisible?: boolean;
    /** Force-hide the dotted prop-center path lines regardless of the visibility
     *  manager (e.g. the Tunnel art view, which never wants path overlays). */
    hidePathLines?: boolean;
    hideProgressBar?: boolean;
    /** Hide the WordHeader slot (portrait-mobile reclaims this vertical space). */
    hideHeader?: boolean;
    isSeamlesslyLoopable?: boolean;
    progressBarVariant?: "minimal" | "raised" | "rounded" | "neon" | "gradient" | "labeled" | "gradient-labeled";
    onProgressBarSeek?: ((targetStep: number) => void) | null;
    onProgressBarScrubStart?: (() => void) | null;
    onProgressBarScrubEnd?: (() => void) | null;
    focused?: boolean;
    fireConfig?: Partial<FireOverlayConfig>;
    ledConfig?: Partial<LedOverlayConfig>;
    /** Per-cell tip effect map that overrides the global map */
    tipEffectMap?: TipEffectMap;
    /** Per-cell tip effort map that overrides the global map */
    tipEffortMap?: TipEffortMap;
    disableContextMenu?: boolean;
    fillContainer?: boolean;
    /** WebGL overlay effects (today: "fire") to warm at engine startup so the
     *  first switch never freezes. Forwarded to CanvasSurface → AnimationEngine. */
    prewarmEffects?: EffectType[];
    showNonRadialPoints?: boolean;
    /** When true, the engine's ResizeObserver is paused to prevent canvas buffer clears during CSS transitions */
    resizePaused?: boolean;
    /** Fires when the canvas engine has initialized and rendered its first frame */
    onInitialized?: () => void;
    /** Called when an effect (fire/charcoal/LED) fails repeatedly and is auto-disabled */
    onEffectError?: (effectName: string, error: Error) => void;
    /** Per-instance visibility manager. When provided, this canvas uses its own
     * manager instead of the global singleton. Enables multiple canvases to have
     * independent visibility/effect settings (e.g. landing page with two players). */
    visibilityManagerOverride?: AnimationVisibilityStateManager;
    /** Live EffectsConfigState (single source of truth for per-effect intents -
     *  zap, sparkles, motion, bloom today; fire/led/charcoal in later phases).
     *  The engine reads from this each frame to pick up slider changes from
     *  the Customize panels without touching the visibility manager. */
    effectsConfigState?: EffectsConfigState;
    /** When provided, overrides the internal disassemble toggle for the context menu.
     * The context menu will call this callback instead of the built-in split animation. */
    externalToggleDisassemble?: () => void;
    /** When provided alongside externalToggleDisassemble, controls the context menu label
     * ("Disassemble" vs "Reassemble"). Defaults to false. */
    externalDisassembled?: boolean;
    /** When true, 2D effect overlays (fire/charcoal/LED/trails) are hidden - 3D mode handles effects */
    suppress2DOverlays?: boolean;
    /** Virtual time for this frame (in ms). Used during video export. */
    virtualTime?: number;
    onToggle3DView?: () => void;
    contextId?: string;
    /** When true, a quick tap on the canvas body toggles play/pause and flashes
     *  a transient play/pause icon. Off by default so views with their own tap
     *  semantics are unaffected. */
    tapToToggle?: boolean;
    /** Hide the transport's play button. Defaults to `tapToToggle`, which is
     *  right for embedded/showcase players: minimal chrome, and the canvas
     *  itself is the play control. A full viewer pane sets it false — the 3D
     *  pane has no canvas tap (orbit controls own the drag) so its transport
     *  must carry the button, and two panes of one viewer showing two
     *  different transports is the thing this prop exists to prevent. */
    hidePlay?: boolean;
    /** Float the transport over the bottom of the canvas instead of reserving a
     *  row beneath it. Matches Viewer3DCanvas's .timeline-anchor exactly, so the
     *  2D and 3D panes of one viewer put the bar in the same place and the
     *  canvas gets the height either way. Off by default: an embedded preview
     *  sized to its artwork has no spare room to float over. */
    overlayTransport?: boolean;
    /** Render the minimal, non-interactive progress LINE (SequenceProgressBar —
     *  the live twin of the baked-in video-export bar) in the progress slot
     *  instead of the full UnifiedTimeline transport. For embedded/showcase
     *  players that pair it with tapToToggle. Off by default. */
    progressLine?: boolean;
    /** Mouse-only hover affordance teaching "click the canvas to play/pause".
     *  Only renders on fine-pointer/hover devices (touch keeps the tap-flash).
     *  Pairs with tapToToggle. Off by default so existing consumers are
     *  unaffected.
     *  - "badge": centered glass circle + word (Pause/Play) fades in on hover.
     *  - "pill":  small corner caption pill on hover.
     *  - "scrim": faint hover vignette, no icon.
     *  - "none":  no hint (default). */
    hoverHint?: "none" | "badge" | "pill" | "scrim";
    /** Persistent play/pause button pinned to the canvas's upper-right corner.
     *  A real <button> (works on mouse AND touch), anchored inside the square
     *  canvas via CanvasSurface's cornerControl slot. Pairs with onPlaybackToggle.
     *  Off by default. */
    cornerToggle?: boolean;
    /** Extra entries injected into the right-click context menu (e.g. "Save
     *  tunnel"). Prepended before the built-in items by CanvasContextMenuHost.
     *  Defaults to [] so existing consumers are unaffected. */
    extraContextMenuItems?: ContextMenuEntry[];
    /** Show the canvas's Start/End text overlay (GlyphOverlay's
     *  isAtStartPosition/isAtEndPosition indicator). On by default everywhere;
     *  the guide showcase turns it off (the on-screen strip already labels
     *  Start/steps, so the canvas overlay is redundant there). */
    beatIndicators?: boolean;
    /** Tempo and continuous/step for the timeline under the canvas. Wire both
     *  halves of a pair or neither — the timeline renders each control only
     *  when its value and its callback are both present. */
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
    playbackMode?: "continuous" | "step";
    onPlaybackModeChange?: (mode: "continuous" | "step") => void;
  } = $props();

  const resolvedContextId = contextId ?? `canvas-${Math.random().toString(36).slice(2, 8)}`;

  const playbackAdapter = createAnimatorPlaybackAdapter({
    getCurrentStep: () => currentStep,
    getSteps: () => sequenceData?.steps ?? [],
    getIsPlaying: () => isPlaying,
    onSeek: (targetStep) => onProgressBarSeek?.(targetStep),
    onTogglePlay: () => onPlaybackToggle(),
    getBpm: () => bpm,
    onBpmChange: onBpmChange ? (next) => onBpmChange(next) : undefined,
    getPlaybackMode: () => playbackMode ?? "continuous",
    onPlaybackModeChange: onPlaybackModeChange
      ? (mode) => onPlaybackModeChange(mode)
      : undefined,
  });

  // Disassemble mode state machine
  // assembled → disassembling → disassembled → reassembling → assembled
  // All transitions happen via CSS on the SAME DOM tree. No overlay swaps.
  type ViewState = "assembled" | "disassembling" | "disassembled" | "reassembling";
  let viewState = $state<ViewState>("assembled");
  let contentWrapperEl: HTMLDivElement | undefined = $state();
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let pointerStart: { x: number; y: number; t: number } | null = null;
  let tapFeedbackSeq = 0;
  let tapFeedback = $state<{ icon: "play" | "pause"; key: number } | null>(null);
  let tapFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  const isDisassembledView = $derived(viewState !== "assembled");
  // Mount the split view in the DOM for all non-assembled states.
  const showSplitCanvases = $derived(viewState !== "assembled");
  // Ask the split view to be expanded while disassembling/disassembled; collapse
  // while reassembling. The split view gates the actual expand on its own
  // engines being ready first.
  const splitExpandRequested = $derived(viewState === "disassembling" || viewState === "disassembled");
  // Pause split canvas resize during transitions - only allow resize in the
  // settled "disassembled" state.
  const splitResizePaused = $derived(viewState !== "disassembled");

  function toggleDisassemble() {
    if (viewState === "assembled") {
      // Pause ResizeObserver so the CSS width transition doesn't clear the canvas buffer
      engine?.pauseResize();
      viewState = "disassembling";
      // The split view mounts collapsed and fires onBothReady when its engines render.
    } else if (viewState === "disassembled") {
      // Pause ResizeObserver before CSS width transition back to full size
      engine?.pauseResize();
      // Collapse the split view (splitExpandRequested flips false); remove it when
      // its collapse transition ends (onCollapseComplete).
      viewState = "reassembling";
    }
    // Ignore during active transitions
  }

  // The split view finished its expand (open) transition: settle into the
  // disassembled state and resume the hero engine's ResizeObserver so it catches
  // up to the new (narrower) container size.
  function handleSplitExpandComplete() {
    if (viewState === "disassembling") {
      viewState = "disassembled";
      engine?.resumeResize();
    }
  }

  // The split view finished its collapse (close) transition: settle back to
  // assembled (which unmounts the split view) and resume the hero engine's
  // ResizeObserver so it catches up to the restored full-width container.
  function handleSplitCollapseComplete() {
    if (viewState === "reassembling") {
      viewState = "assembled";
      engine?.resumeResize();
    }
  }

  function handlePointerDown(e: PointerEvent) {
    pointerStart = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    longPressFired = false;
    if (e.button !== 0 || e.pointerType === "mouse" || disableContextMenu) return;
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      longPressFired = true;
      contextMenuHost?.openContextMenu(x, y);
    }, 500);
  }

  function handlePointerMove(e: PointerEvent) {
    cancelLongPress();
    if (pointerStart) {
      const dx = e.clientX - pointerStart.x;
      const dy = e.clientY - pointerStart.y;
      if (dx * dx + dy * dy > 100) pointerStart = null; // moved >10px → not a tap
    }
  }

  function handlePointerUp(e: PointerEvent) {
    cancelLongPress();
    if (!tapToToggle || longPressFired || !pointerStart) {
      pointerStart = null;
      return;
    }
    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const elapsed = e.timeStamp - pointerStart.t;
    pointerStart = null;
    if (dx * dx + dy * dy > 100 || elapsed > 500) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        'button, a, [role="slider"], [role="menu"], [role="menuitem"], .unified-timeline, input',
      )
    )
      return;
    // Tap-to-toggle fires ONLY on the canvas square, not the surrounding chrome
    // (word header, progress slot, empty pane margin). The square is
    // CanvasSurface's .canvas-wrapper; pointer-events:none overlays (tap-flash,
    // hover hint) let taps fall through to it so closest() still resolves.
    if (!target?.closest(".canvas-wrapper")) return;
    // Capture state BEFORE the toggle: onPlaybackToggle() updates the isPlaying
    // prop synchronously (the controller notifies subscribers synchronously and
    // Svelte 5 props read live), so reading isPlaying afterwards yields the
    // already-toggled value and flashes the wrong icon. The flash should show
    // the state we're entering = the opposite of what we were.
    const wasPlaying = isPlaying;
    onPlaybackToggle();
    // On a mouse/pen the hover hint already shows the play/pause state, so the
    // centered flash would collide with it (two icons mid-transition). Skip the
    // flash there and let the hint be the feedback; keep it for touch (no hover).
    const pointerHasHover = e.pointerType === "mouse" || e.pointerType === "pen";
    if (!(pointerHasHover && hoverHint !== "none")) {
      showTapFeedback(!wasPlaying);
    }
  }

  // Corner button: a real <button>, so the body pointer handler skips it
  // (target.closest('button') early-returns) — no double toggle, no flash.
  function handleCornerToggle() {
    getHapticFeedback().impact("light");
    onPlaybackToggle();
  }

  function showTapFeedback(willPlay: boolean) {
    getHapticFeedback().impact("light");
    tapFeedback = { icon: willPlay ? "play" : "pause", key: ++tapFeedbackSeq };
    if (tapFeedbackTimer !== null) clearTimeout(tapFeedbackTimer);
    tapFeedbackTimer = setTimeout(() => {
      tapFeedback = null;
      tapFeedbackTimer = null;
    }, 600);
  }

  function cancelLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // Unmount cleanup so the long-press and tap-feedback timeouts can't fire
  // (and touch state or the context-menu host) after the component is gone.
  $effect(() => {
    return () => {
      cancelLongPress();
      if (tapFeedbackTimer !== null) {
        clearTimeout(tapFeedbackTimer);
        tapFeedbackTimer = null;
      }
    };
  });

  let contextMenuHost: CanvasContextMenuHost | undefined = $state();

  // Engine instance - created and owned by the CanvasSurface leaf, bound back
  // here so the disassemble transition can drive pauseResize/resumeResize and
  // the context menu can read effect diagnostics. Undefined until the leaf mounts.
  let engine = $state<AnimationEngine>();

  // Use $derived to read visibilityManagerOverride reactively (avoids state_referenced_locally)
  const visibilityManager = $derived(visibilityManagerOverride ?? getAnimationVisibilityManager());

  // Initialize visibility state via $effect.pre to avoid state_referenced_locally on visibilityManager
  let tkaGlyphVisible = $state(false);
  let elementalGlyphVisible = $state(false);
  let stepNumbersVisible = $state(false);
  let globalDarkMode = $state(false);
  let wordHeaderVisible = $state(false);
  let progressBarVisible = $state(false);
  let bluePathLinesVisible = $state(false);
  let redPathLinesVisible = $state(false);
  $effect.pre(() => {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    elementalGlyphVisible = visibilityManager.getVisibility("elementalGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    bluePathLinesVisible = visibilityManager.getVisibility("bluePathLines");
    redPathLinesVisible = visibilityManager.getVisibility("redPathLines");
  });

  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : globalDarkMode
  );

  const effectiveTkaGlyphVisible = $derived(tkaGlyphVisible && !hideTkaGlyph);
  // The elemental glyph describes the relationship between one blue prop and
  // one red prop. Once a tunnel adds more prop layers, showing that same glyph
  // would falsely describe the whole canvas as a single two-prop relationship.
  const effectiveElementalGlyphVisible = $derived(
    elementalGlyphVisible && additionalLayers.length === 0
  );
  const effectiveBeatNumbersVisible = $derived(stepNumbersVisible && !hideStepNumbers);
  const effectiveBluePathLinesVisible = $derived(bluePathLinesVisible && !hidePathLines);
  const effectiveRedPathLinesVisible = $derived(redPathLinesVisible && !hidePathLines);

  function handleVisibilityChange() {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    elementalGlyphVisible = visibilityManager.getVisibility("elementalGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    bluePathLinesVisible = visibilityManager.getVisibility("bluePathLines");
    redPathLinesVisible = visibilityManager.getVisibility("redPathLines");
  }

  // Register/unregister observer reactively so visibilityManager is tracked
  $effect(() => {
    const mgr = visibilityManager;
    mgr.registerObserver(handleVisibilityChange);
    return () => {
      mgr.unregisterObserver(handleVisibilityChange);
    };
  });

  // Difficulty level from sequence data
  const computedDifficultyLevel = $derived.by(() => {
    if (!sequenceData?.steps?.length) return null;
    return calculateSequenceDifficultyLevel([...sequenceData.steps]);
  });

  // Shared resolver: same components + slice-aware rotation as every other
  // LOOP badge surface, cached by sequence id.
  const emptyLoopDisplay: LoopDisplay = {
    components: new Set<LOOPComponent>(),
    rotationPeriod: undefined as
      | import("$lib/shared/foundation/domain/models/generation/circular-models").Period
      | undefined,
    inversionPeriod: undefined as
      | import("$lib/shared/foundation/domain/models/generation/circular-models").Period
      | undefined,
    overlayComponents: undefined as Set<LOOPComponent> | undefined,
    period: 1,
  };
  const loopDisplay = $derived.by(() => {
    if (!sequenceData) return emptyLoopDisplay;
    const resolver = tryGetLoopDisplayResolver();
    return resolver ? resolver(sequenceData) : emptyLoopDisplay;
  });
  const computedLoopComponents = $derived(
    loopDisplay.components.size > 0 ? loopDisplay.components : null
  );
  const computedRotationPeriod = $derived(loopDisplay.rotationPeriod);
  const computedInversionPeriod = $derived(loopDisplay.inversionPeriod);
  const computedReflectionAxis = $derived(loopDisplay.reflectionAxis);
  const computedOverlayComponents = $derived(loopDisplay.overlayComponents);

  // Word-header underline follows the parent's stepData attribution (identity
  // lookup) so it always agrees with the glyph letter — including step-playback
  // dwells, where the parent attributes the integer boundary to the COMPLETED
  // beat, not the upcoming one. Falls back to positional floor when stepData
  // isn't one of sequenceData's step refs (cloned/preview data).
  const headerActiveStepNumber = $derived.by(() => {
    const steps = sequenceData?.steps;
    if (!steps?.length) return null;
    if (stepData) {
      const idx = steps.indexOf(stepData as (typeof steps)[number]);
      if (idx >= 0) return idx + 1;
      if (sequenceData?.startPosition && stepData === sequenceData.startPosition) return null;
    }
    return currentStep >= 1 && currentStep < steps.length + 0.99
      ? Math.floor(currentStep)
      : null;
  });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost?.openContextMenu(e.clientX, e.clientY);
  }
</script>

{#snippet cornerToggleControl()}
  <button
    type="button"
    class="corner-toggle"
    aria-label={isPlaying ? "Pause" : "Play"}
    data-ghost="safe"
    data-ghost-kind="play"
    onclick={handleCornerToggle}
  >
    <span class="corner-disc">
      <Crossfade key={isPlaying} duration={DURATION.fast}>
        <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"></i>
      </Crossfade>
    </span>
  </button>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="animation-container"
  data-focused={focused || undefined}
  data-fill={fillContainer || undefined}
  data-no-progress={hideProgressBar || undefined}
  data-hide-header={hideHeader || undefined}
  data-hover-hint={hoverHint !== "none" ? hoverHint : undefined}
  data-tap-toggle={tapToToggle || undefined}
  data-overlay-transport={overlayTransport || undefined}
  data-corner-toggle={cornerToggle || undefined}
  data-playing={isPlaying || undefined}
  data-view={viewState}
  data-ghost="safe"
  data-ghost-kind="stage"
  data-ghost-state={isPlaying ? "playing" : undefined}
  data-ghost-linger={isPlaying ? "" : undefined}
  data-ghost-word={word || undefined}
  oncontextmenu={handleContextMenu}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={cancelLongPress}
>
  <div class="content-wrapper" bind:this={contentWrapperEl} data-dark-mode={darkModeEnabled ? "true" : "false"}>
    <!-- Always mounted so 3D→2D flips don't re-mount the header. -->
    <div class="header-slot">
      <WordHeader
        {word}
        visible={wordHeaderVisible}
        darkMode={darkModeEnabled}
        activeStepNumber={headerActiveStepNumber}
        difficultyLevel={computedDifficultyLevel}
        loopComponents={computedLoopComponents}
        rotationPeriod={computedRotationPeriod}
        inversionPeriod={computedInversionPeriod}
        reflectionAxis={computedReflectionAxis}
        overlayComponents={computedOverlayComponents}
      />
    </div>

    <CanvasSurface
      bind:engine
      {blueProp}
      {redProp}
      {additionalLayers}
      {tunnelSpectrum}
      {tunnelSelectedLayer}
      {gridVisible}
      {gridMode}
      {backgroundAlpha}
      {letter}
      {stepData}
      {sequenceData}
      {currentStep}
      {isPlaying}
      bind:trailSettings={externalTrailSettings}
      {bluePropType}
      {redPropType}
      {previewDarkMode}
      {isSeamlesslyLoopable}
      {showNonRadialPoints}
      {fireConfig}
      {ledConfig}
      tipEffectMap={cellTipEffectMap}
      tipEffortMap={cellTipEffortMap}
      {virtualTime}
      {hideTkaGlyph}
      {hideStepNumbers}
      {positionGlyphVisible}
      {darkModeEnabled}
      {effectiveTkaGlyphVisible}
      elementalGlyphVisible={effectiveElementalGlyphVisible}
      {effectiveBeatNumbersVisible}
      bluePathLinesVisible={effectiveBluePathLinesVisible}
      redPathLinesVisible={effectiveRedPathLinesVisible}
      {suppress2DOverlays}
      {resizePaused}
      visibilityManagerOverride={visibilityManagerOverride}
      {effectsConfigState}
      {prewarmEffects}
      {beatIndicators}
      contextId={resolvedContextId}
      {onCanvasReady}
      onInitialized={onInitializedCallback}
      {onEffectError}
      cornerControl={cornerToggle ? cornerToggleControl : undefined}
    />

    <!-- Split canvases: blue-only and red-only, expand below hero during disassemble.
         Rendered via SplitCanvasView (CanvasSurface leaves) - never a self-import. -->
    {#if showSplitCanvases}
      <SplitCanvasView
        {blueProp}
        {redProp}
        {gridVisible}
        {gridMode}
        {letter}
        {stepData}
        {sequenceData}
        {currentStep}
        {isPlaying}
        {fireConfig}
        {ledConfig}
        {darkModeEnabled}
        expandRequested={splitExpandRequested}
        resizePaused={splitResizePaused}
        onExpandComplete={handleSplitExpandComplete}
        onCollapseComplete={handleSplitCollapseComplete}
      />
    {/if}

    <!-- Always mounted, same reason as header-slot above. -->
    <div class="progress-slot">
      {#if progressLine}
        <SequenceProgressBar
          {currentStep}
          totalSteps={sequenceData?.steps?.length ?? 0}
          visible={progressBarVisible && !hideProgressBar}
          darkMode={darkModeEnabled}
          onSeek={onProgressBarSeek ? (ratio) => playbackAdapter.seek(ratio) : null}
          onScrubStart={onProgressBarScrubStart}
          onScrubEnd={onProgressBarScrubEnd}
        />
      {:else}
        <UnifiedTimeline
          playback={playbackAdapter}
          visible={progressBarVisible && !hideProgressBar}
          hidePlay={hidePlay ?? tapToToggle}
        />
      {/if}
    </div>
  </div>

  {#if hoverHint !== "none"}
    <!-- Mouse-only hover affordance (CSS :hover, gated to fine pointers). The
         icon/word reflect the action a click will take. pointer-events:none so
         it never eats the tap that toggles playback. -->
    <div class="hover-hint hover-hint--{hoverHint}" aria-hidden="true">
      {#if hoverHint === "badge"}
        <span class="hint-stack">
          <span class="hint-disc">
            <Crossfade key={isPlaying} duration={DURATION.fast}>
              <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"></i>
            </Crossfade>
          </span>
          <span class="hint-word">
            <Crossfade key={isPlaying} duration={DURATION.fast}>
              {isPlaying ? "Pause" : "Play"}
            </Crossfade>
          </span>
        </span>
      {:else if hoverHint === "pill"}
        <span class="hint-pill">
          <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}"></i>
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </span>
      {/if}
    </div>
  {/if}

  {#if tapFeedback}
    {#key tapFeedback.key}
      <div class="tap-feedback" aria-hidden="true">
        <i class="fas {tapFeedback.icon === 'play' ? 'fa-play' : 'fa-pause'}"></i>
      </div>
    {/key}
  {/if}

  {#if !disableContextMenu}
    <CanvasContextMenuHost
      bind:this={contextMenuHost}
      disassembled={externalToggleDisassemble ? externalDisassembled : isDisassembledView}
      onToggleDisassemble={externalToggleDisassemble ?? toggleDisassemble}
      captureEffectDiagnostics={() => engine?.captureEffectDiagnostics() ?? {}}
      {onToggle3DView}
      extraItems={extraContextMenuItems}
      {visibilityManager}
    />
  {/if}
</div>

<style>
  /* Outer container: centers content, establishes container query context */
  .animation-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    container-type: size;
    position: relative;
  }

  /* Transient play/pause flash on canvas tap — teaches the tap-to-toggle gesture
     the way video players do (icon pops, then fades). pointer-events:none so it
     never eats the next tap. */
  .tap-feedback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 6;
  }

  .tap-feedback i {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 84px;
    height: 84px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(4px);
    color: rgba(255, 255, 255, 0.95);
    font-size: 36px;
    animation: tapFeedbackPop 600ms cubic-bezier(0.2, 0, 0, 1) forwards;
  }

  @keyframes tapFeedbackPop {
    0% {
      opacity: 0;
      transform: scale(0.6);
    }
    25% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.3);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tap-feedback i {
      animation-duration: 250ms;
    }
  }

  /* ── Hover affordance (mouse only) ──────────────────────────────────
     Teaches "click the canvas to play/pause" for pointer devices. Hidden
     entirely on touch (no hover) where the tap-flash already covers
     discovery. pointer-events:none so it never blocks the toggle tap.

     CRITICAL: the markup is always in the DOM (gated only by the hoverHint
     prop), so ALL of its layout/visuals must default to display:none here.
     Without this, any non-hover context — touch devices AND Chrome's
     responsive/device-emulation mode — drops the styled overlay and the raw
     icon/word leak into normal flow beside the canvas. Only the hover-capable
     media query below turns it back on. */
  .hover-hint {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    /* Tap-to-toggle (with or without a hover hint) reads as clickable on a
       mouse, so show the pointer cursor over the canvas. */
    .animation-container[data-hover-hint],
    .animation-container[data-tap-toggle] {
      cursor: pointer;
    }

    .hover-hint {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      transition: opacity 150ms ease-out;
    }

    .animation-container[data-hover-hint]:hover .hover-hint {
      opacity: 1;
    }

    /* badge: centered glass disc + word */
    .hover-hint--badge {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Badge scales with the canvas: cqmin = the smaller side of the square
       canvas (the .animation-container is container-type:size). Clamps keep it
       sane on a tiny mobile pane and a huge desktop/export pane alike. */
    .hint-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(5px, 2cqmin, 12px);
      transform: scale(0.92);
      transition: transform 150ms cubic-bezier(0.2, 0, 0, 1);
    }

    .animation-container[data-hover-hint="badge"]:hover .hint-stack {
      transform: scale(1);
    }

    .hint-disc {
      display: flex;
      align-items: center;
      justify-content: center;
      width: clamp(44px, 15cqmin, 96px);
      height: clamp(44px, 15cqmin, 96px);
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.42);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
      color: rgba(255, 255, 255, 0.96);
      /* icon size = ~38% of the disc */
      font-size: clamp(17px, 5.7cqmin, 36px);
    }

    /* Optical centering: the play triangle reads right-heavy in a circle. */
    .hint-disc i.fa-play {
      transform: translateX(2px);
    }

    .hint-word {
      font-size: clamp(10px, 3cqmin, 15px);
      font-weight: 600;
      letter-spacing: 0.04em;
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
    }

    /* pill: corner caption */
    .hint-pill {
      position: absolute;
      top: 12px;
      left: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid rgba(255, 255, 255, 0.16);
      color: rgba(255, 255, 255, 0.95);
      font-size: 13px;
      font-weight: 600;
      transform: translateY(-4px);
      transition: transform 150ms cubic-bezier(0.2, 0, 0, 1);
    }

    .animation-container[data-hover-hint="pill"]:hover .hint-pill {
      transform: translateY(0);
    }

    /* scrim: faint vignette, no icon */
    .hover-hint--scrim {
      background: radial-gradient(
        ellipse at center,
        rgba(0, 0, 0, 0) 45%,
        rgba(0, 0, 0, 0.22) 100%
      );
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hover-hint,
    .hint-stack,
    .hint-pill {
      transition: none;
    }
  }

  /* ── Corner play/pause toggle ──────────────────────────────────────
     A real <button> pinned to the canvas square's top-right (rendered inside
     CanvasSurface's position:relative .canvas-wrapper via the cornerControl
     slot). HIDDEN at rest; revealed on mouse hover of the canvas (and on
     keyboard focus) — the YouTube/Vimeo idiom. Touch has no hover, so it stays
     hidden there and the body tap-to-toggle covers play/pause. cqmin sizes it
     to the canvas. The header's loop badge lives in a separate strip above, so
     this corner is free. */
  .corner-toggle {
    position: absolute;
    top: clamp(8px, 2.5cqmin, 20px);
    right: clamp(8px, 2.5cqmin, 20px);
    z-index: 7;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px; /* touch-target floor (design system) */
    min-height: 44px;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    /* Hidden at rest, tucked toward its corner so the reveal pops outward. */
    opacity: 0;
    transform: scale(0.55) translateY(-12px);
    transform-origin: top right;
    pointer-events: none; /* non-interactive until revealed */
    transition:
      opacity 140ms ease,
      transform 150ms ease; /* exit: quick, no overshoot */
    -webkit-tap-highlight-color: transparent;
  }

  /* Persistent PAUSED indicator — always visible on every pointer type
     (including touch, which has no hover). A stray tap that pauses the tunnel
     must leave an unmissable, tappable way to resume; the hover-only reveal
     above never shows on touch, so this rule is NOT gated to
     (hover: hover)/(pointer: fine) and instead keys off data-playing. */
  .animation-container[data-corner-toggle]:not([data-playing]) .corner-toggle {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: auto;
  }

  /* Keyboard focus reveals + arms on any device (not gated to hover). */
  .corner-toggle:focus-visible {
    opacity: 1;
    transform: scale(1) translateY(0);
    pointer-events: auto;
    transition:
      opacity 200ms ease,
      transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1); /* enter: bouncy pop */
  }

  .corner-disc {
    display: flex;
    align-items: center;
    justify-content: center;
    width: clamp(44px, 11cqmin, 84px);
    height: clamp(44px, 11cqmin, 84px);
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    color: rgba(255, 255, 255, 0.96);
    font-size: clamp(18px, 4.6cqmin, 38px);
    opacity: 0.9;
    transition:
      opacity 140ms ease,
      transform 140ms ease,
      box-shadow 140ms ease;
  }

  .corner-toggle:hover .corner-disc,
  .corner-toggle:focus-visible .corner-disc {
    opacity: 1;
    transform: scale(1.06);
  }

  .corner-toggle:active .corner-disc {
    transform: scale(0.94);
  }

  .corner-toggle:focus-visible {
    outline: none;
  }

  .corner-toggle:focus-visible .corner-disc {
    box-shadow:
      0 0 0 2px var(--theme-accent, #6366f1),
      0 4px 16px rgba(0, 0, 0, 0.3);
  }

  /* Optical centering: the play triangle reads right-heavy in a circle. */
  .corner-disc i.fa-play {
    transform: translateX(1px);
  }

  /* Reveal is scoped to the CANVAS SQUARE only — hovering the square (not the
     header, progress slot, or empty pane margin) shows the button + a pointer
     cursor. The button lives inside CanvasSurface's .canvas-wrapper, reached
     with :global; the rest stays scoped. Gated to fine-pointer/hover so touch
     never sticky-shows it. */
  @media (hover: hover) and (pointer: fine) {
    /* Pointer cursor on the canvas square whenever it's clickable — the
       tap-to-toggle canvas (every viewer/landing/tutorial player) and the
       corner-button variant. The honest "this is clickable" signal; discovery
       then happens via the tap + flash. */
    .animation-container[data-tap-toggle] :global(.canvas-wrapper),
    .animation-container[data-corner-toggle] :global(.canvas-wrapper) {
      cursor: pointer;
    }

    .animation-container[data-corner-toggle] :global(.canvas-wrapper:hover .corner-toggle) {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
      transition:
        opacity 200ms ease,
        transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1); /* enter: bouncy pop */
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .corner-disc {
      transition: none;
    }
    /* No pop under reduced motion — reveal is a plain fade, no scale/translate. */
    .corner-toggle,
    .corner-toggle:focus-visible,
    .animation-container[data-corner-toggle] :global(.canvas-wrapper:hover .corner-toggle) {
      transform: none;
      transition: opacity 140ms ease;
    }
  }

  /* ===========================================
     PORTRAIT MODE (default): Vertical stack
     [Header]
     [Square Canvas]
     [Split Canvases - only when disassembled]
     [Progress Bar]
     =========================================== */

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    /*
     * Portrait mode: Width = canvas side = min(container_width, container_height - overhead)
     * Overhead: header (~53px) + pill timeline (~60px) + margin (12px) = ~125px
     * Use 8.5rem (136px) for breathing room
     */
    width: min(calc(100cqw - 12px), calc(100cqh - 8.5rem - 12px));
    max-width: calc(100cqh - 8.5rem);
    /* Container query context for header font scaling */
    container-type: inline-size;
    border-radius: 4px;
    overflow: hidden;
  }

  /* When the progress bar is relocated out of the canvas (e.g. mobile split,
     where the transport lives in its own bar below the choreo card), the
     8.5rem reservation above over-reserves by the height of an absent pill.
     Reclaim it in portrait so the square canvas grows to fill the pane.
     Overhead drops to header (~3.3rem) + breathing room. */
  @container (max-aspect-ratio: 1.15) {
    .animation-container[data-no-progress] .content-wrapper {
      width: min(calc(100cqw - 12px), calc(100cqh - 3.5rem - 12px));
      max-width: calc(100cqh - 3.5rem);
    }
  }

  /* Header slot: in portrait, takes natural height at top */
  .header-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 100px;
    opacity: 1;
  }

  /* Base .canvas-wrapper styling lives in CanvasSurface.svelte (the leaf that
     owns the element). The responsive overrides below reach into it via
     :global() because component-scoped selectors don't cross the component
     boundary. */

  /* ===========================================
     SPLIT CANVASES container sizing.
     The split-row visuals (.split-canvases / .split-canvas + their
     max-height/opacity transition) now live in SplitCanvasView.svelte.
     AnimatorCanvas only adjusts the hero content-wrapper to make room.
     =========================================== */

  /* When split canvases are showing, narrow the content-wrapper so the taller
     layout (hero + split row) fits vertically. The 2:3 aspect ratio means
     width = (available_height - chrome) * 2/3 */
  .animation-container[data-view="disassembling"] .content-wrapper,
  .animation-container[data-view="disassembled"] .content-wrapper {
    width: min(calc(100cqw - 12px), calc((100cqh - 7rem) * 2 / 3));
    max-width: calc((100cqh - 7rem) * 2 / 3);
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Progress slot: in portrait, takes natural height at bottom */
  /* Floating transport — the 2D twin of Viewer3DCanvas's .timeline-anchor.
     Anchored to .animation-container (position: relative) rather than to the
     content wrapper, so the bar spans the pane the way the 3D one does. */
  .animation-container[data-overlay-transport] .progress-slot {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    max-height: none;
    overflow: visible;
    pointer-events: auto;
  }

  .progress-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 100px;
    opacity: 1;
    transition: max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                opacity 0.2s ease-out;
  }

  /* ===========================================
     CONSTRAINED MODE: Canvas-only when squeezed
     When container is wider than tall (aspect ratio > 1.15),
     hide chrome and maximize the square canvas.
     =========================================== */

  @container (min-aspect-ratio: 1.15) {
    .content-wrapper {
      width: calc(100cqh - 2.5rem);
      max-width: calc(100cqh - 2.5rem);
      height: auto;
    }

    /* No in-canvas progress bar (relocated transport): the 2.5rem here was
       breathing room above an absent pill. Header is already hidden in this
       branch, so drop nearly all the overhead and let the square grow to the
       pane's full height. */
    .animation-container[data-no-progress] .content-wrapper {
      width: calc(100cqh - 1rem);
      max-width: calc(100cqh - 1rem);
    }

    .header-slot {
      max-height: 0;
      opacity: 0;
    }

    :global(.canvas-wrapper) {
      width: 100%;
      height: 100cqw;
    }
  }

  /* ===========================================
     FOCUSED MODE: Always show word + progress bar
     =========================================== */

  .animation-container[data-focused] .content-wrapper {
    width: min(calc(100cqw - 12px), calc(100cqh - 8.5rem - 12px));
    max-width: calc(100cqh - 8.5rem);
    max-height: calc(100cqh - 4px);
    height: auto;
  }

  .animation-container[data-focused] .header-slot {
    max-height: 100px !important;
    opacity: 1 !important;
  }

  /* Explicit hide wins over the focused force-show (higher specificity). Used in
     portrait-mobile to reclaim the word-header band for the canvas. */
  .animation-container[data-hide-header] .header-slot,
  .animation-container[data-focused][data-hide-header] .header-slot {
    max-height: 0 !important;
    opacity: 0 !important;
    pointer-events: none;
  }

  /* Header hidden but the transport still lives in-canvas (portrait viewer
     drawer): the 8.5rem focused reserve above holds ~100px for a header that
     isn't rendered, shrinking the square and leaving a dead band around it.
     Reserve only the progress slot. (The triple-attr rule below still wins
     when the transport is relocated too.) */
  .animation-container[data-focused][data-hide-header] .content-wrapper {
    width: min(calc(100cqw - 12px), calc(100cqh - 3rem - 12px));
    max-width: calc(100cqh - 3rem);
  }

  /* Header hidden AND transport relocated: let the square canvas claim almost
     the whole pane height. */
  .animation-container[data-focused][data-hide-header][data-no-progress] .content-wrapper {
    width: min(calc(100cqw - 12px), calc(100cqh - 1rem));
    max-width: calc(100cqh - 1rem);
    max-height: calc(100cqh - 4px);
  }

  .animation-container[data-focused] :global(.canvas-wrapper) {
    width: 100%;
    height: 100cqw;
    flex-shrink: 1;
    min-height: 0;
  }

  /* Focused + constrained: when container is wider than tall (e.g. mobile
     video export with settings open), reduce chrome overhead so the square
     canvas can use more of the limited height. */
  @container (min-aspect-ratio: 1.15) {
    .animation-container[data-focused] .content-wrapper {
      width: min(calc(100cqw - 12px), calc(100cqh - 3.5rem - 12px));
      max-width: calc(100cqh - 3.5rem);
    }
  }

  /* Only crush the header on extremely wide containers (mobile landscape)
     where vertical space is truly scarce. The 1.15 threshold was too aggressive
     and smushed the word header on desktop export mode. */
  @container (min-aspect-ratio: 2.5) {
    .animation-container[data-focused] .header-slot {
      max-height: 28px !important;
    }
  }

  /* Focused + disassembled: content-wrapper narrows for the split row */
  .animation-container[data-focused][data-view="disassembling"] .content-wrapper,
  .animation-container[data-focused][data-view="disassembled"] .content-wrapper {
    width: min(calc(100cqw - 12px), calc((100cqh - 8.5rem) * 2 / 3));
    max-width: calc((100cqh - 8.5rem) * 2 / 3);
    transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* ===========================================
     EXTREMELY CONSTRAINED: Minimal chrome
     =========================================== */

  @container (min-aspect-ratio: 2.5) {
    .content-wrapper {
      border-radius: 0;
    }
  }

  /* ===========================================
     FILL CONTAINER MODE: Edge-to-edge rendering
     Used by sub-canvases in split view.
     =========================================== */

  .animation-container[data-fill] {
    align-items: stretch;
    justify-content: stretch;
  }

  .animation-container[data-fill] .content-wrapper {
    width: 100% !important;
    max-width: none !important;
    max-height: none !important;
    height: 100%;
    container-type: size;
  }

  .animation-container[data-fill] :global(.canvas-wrapper) {
    flex: 1;
    height: auto !important;
    min-height: 0;
  }

  /* ===========================================
     REDUCED MOTION
     =========================================== */

  @media (prefers-reduced-motion: reduce) {
    .content-wrapper,
    .header-slot,
    .progress-slot {
      transition: none;
    }
  }
</style>
