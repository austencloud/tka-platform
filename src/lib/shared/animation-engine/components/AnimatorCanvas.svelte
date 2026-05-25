<!--
AnimatorCanvas.svelte - Canvas2D Animation Canvas

================================================================================
ARCHITECTURAL NOTE
================================================================================

This component is a thin wrapper around AnimationEngine.

All orchestration logic has been extracted to:
  src/lib/shared/animation-engine/services/implementations/AnimationEngine.svelte.ts

The component's role:
1. Mount container element
2. Initialize engine
3. Pass props to engine.update() in single $effect
4. Derive state from engine.state
5. Render template (canvas-wrapper, GlyphOverlay, ProgressOverlay)
6. Disassemble/reassemble: same DOM tree, CSS transitions only

Last audit: 2025-12-27
================================================================================
-->
<script lang="ts">
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
  import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
  import type { PropState } from "$lib/shared/foundation/domain/types/PropState";
  import type { TrailSettings } from "../domain/types/TrailTypes";
  import type { AdditionalLayerProps } from "$lib/shared/animation-engine/domain/types/TrailCaptureTypes";
  import GlyphRenderer from "./GlyphRenderer.svelte";
  import GlyphOverlay from "./layers/GlyphOverlay.svelte";
  import PathLinesOverlay from "./layers/PathLinesOverlay.svelte";
  import WordHeader from "./layers/WordHeader.svelte";
  import ProgressOverlay from "./layers/ProgressOverlay.svelte";
  import UnifiedTimeline from "$lib/shared/timeline/UnifiedTimeline.svelte";
  import { createAnimatorPlaybackAdapter } from "$lib/shared/timeline/adapters/animator-playback-adapter.svelte";
  import { AnimationEngine } from "../services/implementations/AnimationEngine.svelte";
  import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";
  import { isSeamlesslyLoopable as sequenceLoopabilityCheck } from "$lib/shared/foundation/services/sequence-loopability-checker";
  import { calculateDifficultyLevel as calculateSequenceDifficultyLevel } from "$lib/shared/browse/services/sequence-difficulty-calculator";
  import { tryGetLoopDisplayResolver } from "$lib/shared/loop-labeler/getLoopDisplayResolver";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import type { FireOverlayConfig } from "../domain/types/FireTypes";
  import type { LedOverlayConfig } from "../domain/types/LedTypes";
  import type { TipEffectMap, TipEffortMap } from "../domain/types/TipEffectTypes";
  import CanvasContextMenuHost from "./canvas-context-menu/CanvasContextMenuHost.svelte";
  import { onDestroy, untrack } from "svelte";
  import { fireCacheInvalidation } from "../state/fire-invalidation-signal.svelte";
  import { effectErrorSignal } from "../state/effect-error-signal.svelte";
  import AnimatorCanvasSelf from "./AnimatorCanvas.svelte";
  import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { tryGetViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";

  // Props
  let {
    blueProp,
    redProp,
    additionalLayers = [],
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
    hideProgressBar = false,
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
  }: {
    blueProp: PropState | null;
    redProp: PropState | null;
    additionalLayers?: AdditionalLayerProps[];
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
    hideProgressBar?: boolean;
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
  } = $props();

  const playbackAdapter = createAnimatorPlaybackAdapter({
    getCurrentStep: () => currentStep,
    getSteps: () => sequenceData?.steps ?? [],
    getIsPlaying: () => isPlaying,
    onSeek: (targetStep) => onProgressBarSeek?.(targetStep),
    onTogglePlay: () => onPlaybackToggle(),
  });

  // Disassemble mode state machine
  // assembled → disassembling → disassembled → reassembling → assembled
  // All transitions happen via CSS on the SAME DOM tree. No overlay swaps.
  type ViewState = "assembled" | "disassembling" | "disassembled" | "reassembling";
  let viewState = $state<ViewState>("assembled");
  let contentWrapperEl: HTMLDivElement | undefined = $state();
  let splitCanvasesEl: HTMLDivElement | undefined = $state();
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Mount split canvases collapsed, expand only after both engines are initialized
  let splitExpanded = $state(false);
  let splitReadyCount = $state(0);

  const isDisassembledView = $derived(viewState !== "assembled");
  // Show split canvases in DOM for all non-assembled states
  const showSplitCanvases = $derived(viewState !== "assembled");
  // Pause split canvas resize during transitions - only allow resize in settled "disassembled" state
  const splitResizePaused = $derived(viewState !== "disassembled");

  function handleSplitCanvasReady() {
    splitReadyCount++;
  }

  function toggleDisassemble() {
    if (viewState === "assembled") {
      splitReadyCount = 0;
      // Pause ResizeObserver so the CSS width transition doesn't clear the canvas buffer
      engine.pauseResize();
      viewState = "disassembling";
      // Split canvases mount collapsed. They'll fire onInitialized when ready.
    } else if (viewState === "disassembled") {
      // Pause ResizeObserver before CSS width transition back to full size
      engine.pauseResize();
      // Collapse split canvases, then remove them when transition ends
      splitExpanded = false;
      viewState = "reassembling";
    }
    // Ignore during active transitions
  }

  // Expand split canvases once both engines have initialized and rendered
  $effect(() => {
    if (viewState === "disassembling" && splitReadyCount >= 2) {
      // Both split canvases are initialized. Expand on next frame so the
      // browser has laid out the collapsed state first (CSS transition trigger).
      untrack(() => {
        requestAnimationFrame(() => {
          splitExpanded = true;
        });
      });
    }
  });

  // Listen for CSS transition end to finalize state changes
  function handleSplitTransitionEnd(e: TransitionEvent) {
    // Only react to max-height transitions on the split-canvases element itself
    if (e.target !== splitCanvasesEl || e.propertyName !== "max-height") return;

    if (viewState === "disassembling") {
      viewState = "disassembled";
      // Resume ResizeObserver - catch up to the new (narrower) container size
      engine.resumeResize();
    } else if (viewState === "reassembling") {
      viewState = "assembled";
      splitExpanded = false;
      // Resume ResizeObserver - catch up to the restored full-width container
      engine.resumeResize();
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0 || e.pointerType === "mouse" || disableContextMenu) return;
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      contextMenuHost?.openContextMenu(x, y);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  let containerElement: HTMLDivElement | undefined = $state();
  let contextMenuHost: CanvasContextMenuHost | undefined = $state();

  // Engine instance - wire per-instance visibility manager before initialization
  const engine = new AnimationEngine();

  // Sync 2D overlay suppression (for 3D mode)
  $effect.pre(() => {
    engine.state.suppress2DOverlays = suppress2DOverlays;
  });

  // Use $derived to read visibilityManagerOverride reactively (avoids state_referenced_locally)
  const visibilityManager = $derived(visibilityManagerOverride ?? getAnimationVisibilityManager());
  $effect.pre(() => {
    // Read through visibilityManager derived (which already tracks visibilityManagerOverride)
    // to avoid capturing the destructured prop directly
    const override = visibilityManager !== getAnimationVisibilityManager() ? visibilityManager : null;
    if (override) {
      engine.setVisibilityManager(override);
    }
  });

  // Fall back to ancestor-provided context when no prop is passed so the
  // customize panel (Zap/Sparkle/Echo/Bloom) actually drives this canvas.
  const inheritedEffectsConfig = getEffectsConfigContext();
  $effect.pre(() => {
    const ecs = effectsConfigState ?? inheritedEffectsConfig ?? null;
    engine.setEffectsConfigState(ecs);
    // Wire to the global VM singleton so the fallback getActiveEffect/setActiveEffect
    // delegates work in UI contexts that don't use the effects-config-context provider.
    getAnimationVisibilityManager().effectsConfigState = ecs;
  });

  // Re-sync the engine whenever effects config changes (fire sliders, presets, etc.).
  // EffectsConfigState mutations don't notify the VM observer, so we bridge here.
  // untrack the notification so observer-triggered mutations don't re-enter this effect.
  $effect(() => {
    const ecs = effectsConfigState ?? inheritedEffectsConfig ?? null;
    if (!ecs) return;
    void ecs.version;
    untrack(() => getAnimationVisibilityManager().notifyObservers());
  });

  // Push viewer-scoped motion visibility into the engine whenever the toggle
  // changes. Reads tryGet so AnimatorCanvas still works outside the viewer
  // (landing page, browse previews) - context absent → method never called.
  const viewerVisibilityCtx = tryGetViewerVisibilityContext();
  $effect(() => {
    if (!viewerVisibilityCtx) return;
    engine.setMotionVisibility(
      viewerVisibilityCtx.blueMotion,
      viewerVisibilityCtx.redMotion,
    );
  });

  // Initialize visibility state via $effect.pre to avoid state_referenced_locally on visibilityManager
  let tkaGlyphVisible = $state(false);
  let stepNumbersVisible = $state(false);
  let beatPositionVisible = $state(false);
  let globalDarkMode = $state(false);
  let wordHeaderVisible = $state(false);
  let progressBarVisible = $state(false);
  let fireEffectEnabled = $state(false);
  let pathLinesVisible = $state(false);
  $effect.pre(() => {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    beatPositionVisible = visibilityManager.getVisibility("beatPosition");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    const tipMap = visibilityManager.effectsConfigState?.tipEffectMap ?? {};
    fireEffectEnabled = Object.values(tipMap).some(a => a.effect === "fire");
    pathLinesVisible = visibilityManager.getVisibility("pathLines");
  });

  const darkModeEnabled = $derived(
    previewDarkMode !== null ? previewDarkMode : globalDarkMode
  );

  const effectiveTkaGlyphVisible = $derived(tkaGlyphVisible && !hideTkaGlyph);
  const effectiveBeatNumbersVisible = $derived(stepNumbersVisible && !hideStepNumbers);
  const effectiveStepPositionVisible = $derived(beatPositionVisible);

  const effectiveIsSeamlesslyLoopable = $derived.by(() => {
    if (isSeamlesslyLoopable !== undefined) return isSeamlesslyLoopable;
    if (!sequenceData) return false;
    return sequenceLoopabilityCheck(sequenceData);
  });

  function handleVisibilityChange() {
    tkaGlyphVisible = visibilityManager.getVisibility("tkaGlyph");
    stepNumbersVisible = visibilityManager.getVisibility("stepNumbers");
    beatPositionVisible = visibilityManager.getVisibility("beatPosition");
    globalDarkMode = visibilityManager.isDarkMode();
    wordHeaderVisible = visibilityManager.getVisibility("wordHeader");
    progressBarVisible = visibilityManager.getVisibility("progressBar");
    const tipMap = visibilityManager.effectsConfigState?.tipEffectMap ?? {};
    fireEffectEnabled = Object.values(tipMap).some(a => a.effect === "fire");
    pathLinesVisible = visibilityManager.getVisibility("pathLines");
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
  const emptyLoopDisplay = {
    components: new Set<LOOPComponent>(),
    rotationPeriod: undefined as
      | import("$lib/shared/foundation/domain/models/generation/circular-models").Period
      | undefined,
    inversionPeriod: undefined as
      | import("$lib/shared/foundation/domain/models/generation/circular-models").Period
      | undefined,
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
  const computedLoopPeriod = $derived(loopDisplay.period);

  // When an external caller (e.g. video export orchestrator) signals that the
  // fire frame cache is stale, invalidate it so the simulation re-records.
  let lastFireInvalidationSignal = fireCacheInvalidation.signal;
  $effect(() => {
    const sig = fireCacheInvalidation.signal;
    if (sig !== lastFireInvalidationSignal) {
      lastFireInvalidationSignal = sig;
      const mode = fireCacheInvalidation.mode;
      if (mode === "cacheOnly") {
        untrack(() => engine.invalidateFireFrameCacheOnly());
      } else if (mode === "thermalClear") {
        untrack(() => engine.clearFireThermalFields());
      } else {
        untrack(() => engine.invalidateFireCache());
      }
    }
  });

  // --- EXPORT DIAGNOSTIC (remove after debugging) ---
  if (typeof window !== 'undefined') {
    (window as any).__tka_fire_diag = {
      enable: () => engine.enableFireDiagnostics(),
      disable: () => engine.disableFireDiagnostics(),
      reset: () => engine.resetFireDiagnosticCounter(),
      sample: () => engine.sampleFireCanvas(),
    };
    (window as any).__tka_fire_snapshot = () => engine.snapshotFireCanvas();
    (window as any).__tka_led_diag = {
      stats: () => {
        const renderer = engine.getLedRenderer();
        if (!renderer) { console.log('[led-diag] no ledRenderer'); return; }
        const display = renderer.readPixelStats();
        const trail = renderer.readTrailFBOStats();
        const bloom = renderer.readBloomFBOStats();
        console.log(`[led-diag] display(8bit): maxR=${display?.maxR} maxG=${display?.maxG} maxB=${display?.maxB} maxA=${display?.maxA} nonZero=${display?.nonZero}/${display?.total}`);
        console.log(`[led-diag] trail(float): maxR=${trail?.maxR?.toFixed(4)} maxG=${trail?.maxG?.toFixed(4)} maxB=${trail?.maxB?.toFixed(4)} maxA=${trail?.maxA?.toFixed(4)}`);
        console.log(`[led-diag] bloom(float): maxR=${bloom?.maxR?.toFixed(4)} maxG=${bloom?.maxG?.toFixed(4)} maxB=${bloom?.maxB?.toFixed(4)} maxA=${bloom?.maxA?.toFixed(4)}`);
        return { display, trail, bloom };
      },
      snapshot: () => {
        const renderer = engine.getLedRenderer();
        if (!renderer?.getCanvas()) { console.log('[led-diag] no canvas'); return; }
        const c = renderer.getCanvas()!;
        c.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `led-overlay-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
          console.log('[led-diag] snapshot saved');
        });
      },
      exportCompositeTest: () => {
        if (!containerElement) { console.log('[led-diag] no container'); return; }
        const mainCanvas = containerElement.querySelector('canvas');
        if (!mainCanvas) { console.log('[led-diag] no main canvas'); return; }
        const container = mainCanvas.parentElement!;

        const outputSize = 974;
        const offscreen = document.createElement('canvas');
        offscreen.width = outputSize;
        offscreen.height = outputSize;
        const ctx = offscreen.getContext('2d')!;

        ctx.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, outputSize, outputSize);

        const overlays = container.querySelectorAll('canvas');
        for (const ov of overlays) {
          if (ov === mainCanvas || ov.width === 0 || ov.height === 0) continue;
          const isWebGL = !!((ov as HTMLCanvasElement).getContext("webgl2") || (ov as HTMLCanvasElement).getContext("webgl"));
          if (isWebGL && ov.width !== outputSize) {
            const tmp = document.createElement('canvas');
            tmp.width = ov.width;
            tmp.height = ov.height;
            const tmpCtx = tmp.getContext('2d')!;
            tmpCtx.clearRect(0, 0, ov.width, ov.height);
            tmpCtx.drawImage(ov, 0, 0);
            ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, outputSize, outputSize);
          } else {
            ctx.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, outputSize, outputSize);
          }
        }

        const pixels = ctx.getImageData(0, 0, outputSize, outputSize).data;
        let maxR = 0, maxG = 0, maxB = 0, maxA = 0;
        let aboveA5 = 0, aboveA25 = 0, aboveA100 = 0;
        const total = outputSize * outputSize;
        for (let px = 0; px < pixels.length; px += 4) {
          const pr = pixels[px]!, pg = pixels[px+1]!, pb = pixels[px+2]!, pa = pixels[px+3]!;
          if (pr > maxR) maxR = pr;
          if (pg > maxG) maxG = pg;
          if (pb > maxB) maxB = pb;
          if (pa > maxA) maxA = pa;
          if (pa > 5) aboveA5++;
          if (pa > 25) aboveA25++;
          if (pa > 100) aboveA100++;
        }
        console.log(`[led-blast] COMPOSITE: maxRGBA=${maxR},${maxG},${maxB},${maxA} coverageA>5=${((aboveA5/total)*100).toFixed(1)}% A>25=${((aboveA25/total)*100).toFixed(1)}% A>100=${((aboveA100/total)*100).toFixed(1)}%`);

        offscreen.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const dl = document.createElement('a');
          dl.href = url;
          dl.download = `led-export-composite-${Date.now()}.png`;
          dl.click();
          URL.revokeObjectURL(url);
        });
      },
      nuclearBlast: async () => {
        if (!containerElement) { console.log('[led-blast] no container'); return; }
        const mainCanvas = containerElement.querySelector('canvas');
        if (!mainCanvas) { console.log('[led-blast] no main canvas'); return; }
        const container = mainCanvas.parentElement!;

        const configs = [
          { name: 'BASELINE', flags: {} },
          { name: 'NO_BLOOM', flags: { noBloom: true } },
          { name: 'NO_TRAIL', flags: { noTrail: true } },
          { name: 'SPRITES_ONLY', flags: { spritesOnly: true } },
          { name: 'NO_BLOOM+NO_TRAIL', flags: { noBloom: true, noTrail: true } },
        ];

        const outputSize = 974;
        const results: {name: string; maxRGBA: string; coverageA5: string; coverageA25: string; coverageA100: string}[] = [];

        for (const cfg of configs) {
          (window as any).__tka_led_blast = cfg.flags;
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

          const offscreen = document.createElement('canvas');
          offscreen.width = outputSize;
          offscreen.height = outputSize;
          const ctx = offscreen.getContext('2d')!;
          ctx.drawImage(mainCanvas, 0, 0, mainCanvas.width, mainCanvas.height, 0, 0, outputSize, outputSize);

          const overlays = container.querySelectorAll('canvas');
          for (const ov of overlays) {
            if (ov === mainCanvas || ov.width === 0 || ov.height === 0) continue;
            const isWebGL = !!((ov as HTMLCanvasElement).getContext("webgl2") || (ov as HTMLCanvasElement).getContext("webgl"));
            if (isWebGL && ov.width !== outputSize) {
              const tmp = document.createElement('canvas');
              tmp.width = ov.width; tmp.height = ov.height;
              const tmpCtx = tmp.getContext('2d')!;
              tmpCtx.clearRect(0, 0, ov.width, ov.height);
              tmpCtx.drawImage(ov, 0, 0);
              ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, outputSize, outputSize);
            } else {
              ctx.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, outputSize, outputSize);
            }
          }

          const pixels = ctx.getImageData(0, 0, outputSize, outputSize).data;
          let maxR = 0, maxG = 0, maxB = 0, maxA = 0;
          let aboveA5 = 0, aboveA25 = 0, aboveA100 = 0;
          const total = outputSize * outputSize;
          for (let px = 0; px < pixels.length; px += 4) {
            const pr = pixels[px]!, pg = pixels[px+1]!, pb = pixels[px+2]!, pa = pixels[px+3]!;
            if (pr > maxR) maxR = pr;
            if (pg > maxG) maxG = pg;
            if (pb > maxB) maxB = pb;
            if (pa > maxA) maxA = pa;
            if (pa > 5) aboveA5++;
            if (pa > 25) aboveA25++;
            if (pa > 100) aboveA100++;
          }

          const result = {
            name: cfg.name,
            maxRGBA: `${maxR},${maxG},${maxB},${maxA}`,
            coverageA5: ((aboveA5/total)*100).toFixed(1),
            coverageA25: ((aboveA25/total)*100).toFixed(1),
            coverageA100: ((aboveA100/total)*100).toFixed(1),
          };
          results.push(result);
          console.log(`[led-blast] ${cfg.name}: maxRGBA=${result.maxRGBA} A>5=${result.coverageA5}% A>25=${result.coverageA25}% A>100=${result.coverageA100}%`);
        }

        (window as any).__tka_led_blast = {};
        console.log('[led-blast] === NUCLEAR BLAST COMPLETE ===');
        console.table(results);
        return results;
      },
    };
  }

  // When an overlay effect (fire/charcoal/LED) fails repeatedly, the render loop
  // auto-disables it and fires this signal. Show a warning so the user knows.
  let lastEffectErrorSignal = effectErrorSignal.signal;
  $effect(() => {
    const sig = effectErrorSignal.signal;
    if (sig !== lastEffectErrorSignal) {
      lastEffectErrorSignal = sig;
      const name = effectErrorSignal.effectName;
      const err = effectErrorSignal.error;
      if (name && err) {
        console.warn(
          `[AnimatorCanvas] ${name} effect was auto-disabled after repeated failures. ` +
          `Toggle the effect off and on to retry. Error: ${err.message}`
        );
        effectErrorSignal.clear();
      }
    }
  });

  // Derived state from engine
  const rendererLoading = $derived(engine.state.rendererLoading);
  const rendererError = $derived(engine.state.rendererError);
  const isInitialized = $derived(engine.state.isInitialized);
  const isPreRendering = $derived(engine.state.isPreRendering);
  const preRenderProgress = $derived(engine.state.preRenderProgress);
  const preRenderedFramesReady = $derived(engine.state.preRenderedFramesReady);
  const displayedLetter = $derived(engine.state.displayedLetter);
  const displayedTurnsTuple = $derived(engine.state.displayedTurnsTuple);
  const displayedStepNumber = $derived(engine.state.displayedStepNumber);
  const displayedMusicalPosition = $derived(engine.state.displayedMusicalPosition);

  // Initialize engine when container element appears.
  // The hero canvas stays mounted always - no teardown during disassemble.
  $effect(() => {
    const el = containerElement;
    if (!el) return;

    untrack(() => {
      engine.initialize(el, {
        onCanvasReady,
        onTrailSettingsChange: (settings) => {
          externalTrailSettings = settings;
        },
        onEffectError,
      });
    });

    return () => {
      untrack(() => {
        engine.dispose();
      });
    };
  });

  // Single effect to pass all props to engine
  $effect(() => {
    const currentFireConfig = fireConfig;
    const currentLedConfig = ledConfig;
    const currentCellTipEffectMap = cellTipEffectMap;
    const currentCellTipEffortMap = cellTipEffortMap;
    const props = {
      blueProp,
      redProp,
      additionalLayers,
      gridVisible,
      gridMode,
      backgroundAlpha,
      letter,
      stepData,
      sequenceData,
      currentStep,
      isPlaying,
      externalTrailSettings,
      bluePropType,
      redPropType,
      previewDarkMode,
      isSeamlesslyLoopable,
      virtualTime,
    };
    untrack(() => {
      if (currentFireConfig) {
        engine.setFireConfig(currentFireConfig);
      }
      if (currentLedConfig) {
        engine.setLedConfig(currentLedConfig);
      }
      engine.setCellTipEffectMap(currentCellTipEffectMap);
      engine.setCellTipEffortMap(currentCellTipEffortMap);
      engine.update(props);
    });
  });

  $effect(() => {
    if (isInitialized) {
      engine.processPendingGlyph();
      // Wait for the render loop to paint at least one frame before
      // signaling readiness. The initializer sets isInitialized BEFORE
      // starting the render loop (step 8 vs step 10), so without this
      // delay the callback fires while the canvas is still blank.
      untrack(() => {
        if (onInitializedCallback) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onInitializedCallback?.();
            });
          });
        }
      });
    }
  });

  // Pause/resume resize observation when parent controls it via prop
  $effect(() => {
    if (resizePaused) {
      engine.pauseResize();
    } else {
      engine.resumeResize();
    }
  });

  function handleGlyphSvgReady(
    svgString: string,
    width: number,
    height: number,
    x: number,
    y: number
  ) {
    engine.handleGlyphSvgReady(svgString, width, height, x, y);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    contextMenuHost?.openContextMenu(e.clientX, e.clientY);
  }
</script>

<!-- Hidden GlyphRenderer that converts TKAGlyph to SVG for Canvas2D rendering -->
{#if letter}
  <GlyphRenderer {letter} {stepData} onSvgReady={handleGlyphSvgReady} />
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="animation-container"
  data-focused={focused || undefined}
  data-fill={fillContainer || undefined}
  data-view={viewState}
  oncontextmenu={handleContextMenu}
  onpointerdown={handlePointerDown}
  onpointermove={cancelLongPress}
  onpointerup={cancelLongPress}
  onpointercancel={cancelLongPress}
>
  <div class="content-wrapper" bind:this={contentWrapperEl} data-dark-mode={darkModeEnabled ? "true" : "false"}>
    <!-- Always mounted so 3D→2D flips don't re-mount the header. -->
    <div class="header-slot">
      <WordHeader
        {word}
        visible={wordHeaderVisible}
        darkMode={darkModeEnabled}
        activeStepNumber={currentStep >= 1 && currentStep < (sequenceData?.steps?.length ?? 0) + 0.99 ? Math.floor(currentStep) : null}
        difficultyLevel={computedDifficultyLevel}
        loopComponents={computedLoopComponents}
        rotationPeriod={computedRotationPeriod}
        inversionPeriod={computedInversionPeriod}
        loopPeriod={computedLoopPeriod}
      />
    </div>

    <div
      class="canvas-wrapper"
      bind:this={containerElement}
      data-transparent={backgroundAlpha === 0 ? "true" : "false"}
      data-dark-mode={darkModeEnabled ? "true" : "false"}
    >
      {#if !suppress2DOverlays}
        <GlyphOverlay
          {letter}
          {displayedLetter}
          {displayedTurnsTuple}
          {displayedStepNumber}
          {displayedMusicalPosition}
          {stepData}
          tkaGlyphVisible={effectiveTkaGlyphVisible}
          stepNumbersVisible={effectiveBeatNumbersVisible}
          beatPositionVisible={effectiveStepPositionVisible}
          darkMode={darkModeEnabled}
          isAtStartPosition={!hideStepNumbers && currentStep < 1 && sequenceData !== null}
          isAtEndPosition={
            !hideStepNumbers &&
            sequenceData !== null &&
            !effectiveIsSeamlesslyLoopable &&
            currentStep >= (sequenceData.steps?.length ?? 0) + 0.99
          }
        />

        {#if pathLinesVisible}
          <PathLinesOverlay {sequenceData} {currentStep} />
        {/if}

        <ProgressOverlay
          {isPreRendering}
          {preRenderProgress}
          {preRenderedFramesReady}
        />
      {/if}

    </div>

    <!-- Split canvases: blue-only and red-only, expand below hero during disassemble -->
    {#if showSplitCanvases}
      <div
        class="split-canvases"
        class:expanded={splitExpanded}
        bind:this={splitCanvasesEl}
        ontransitionend={handleSplitTransitionEnd}
      >
        <div class="split-canvas">
          <AnimatorCanvasSelf
            {blueProp}
            redProp={null}
            {gridVisible}
            {gridMode}
            backgroundAlpha={0}
            {letter}
            {stepData}
            {sequenceData}
            {currentStep}
            {isPlaying}
            {fireConfig}
            {ledConfig}
            fillContainer={true}
            hideTkaGlyph={true}
            hideStepNumbers={true}
            hideProgressBar={true}
            disableContextMenu={true}
            focused={false}
            resizePaused={splitResizePaused}
            onInitialized={handleSplitCanvasReady}
          />
        </div>
        <div class="split-canvas">
          <AnimatorCanvasSelf
            blueProp={null}
            {redProp}
            {gridVisible}
            {gridMode}
            backgroundAlpha={0}
            {letter}
            {stepData}
            {sequenceData}
            {currentStep}
            {isPlaying}
            {fireConfig}
            {ledConfig}
            fillContainer={true}
            hideTkaGlyph={true}
            hideStepNumbers={true}
            hideProgressBar={true}
            disableContextMenu={true}
            focused={false}
            resizePaused={splitResizePaused}
            onInitialized={handleSplitCanvasReady}
          />
        </div>
      </div>
    {/if}

    <!-- Always mounted, same reason as header-slot above. -->
    <div class="progress-slot">
      <UnifiedTimeline
        playback={playbackAdapter}
        visible={progressBarVisible && !hideProgressBar}
      />
    </div>
  </div>

  {#if !disableContextMenu}
    <CanvasContextMenuHost
      bind:this={contextMenuHost}
      disassembled={externalToggleDisassemble ? externalDisassembled : isDisassembledView}
      onToggleDisassemble={externalToggleDisassemble ?? toggleDisassemble}
      captureEffectDiagnostics={() => engine.captureEffectDiagnostics()}
      {onToggle3DView}
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

  /* Header slot: in portrait, takes natural height at top */
  .header-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 100px;
    opacity: 1;
  }

  /* Canvas wrapper: square in portrait mode. Owns the background color so the
     main canvas can stay transparent - effect overlays at z<3 sit between this
     background and the main canvas's opaque prop pixels. */
  .canvas-wrapper {
    position: relative;
    width: 100%;
    /* Square: height = width using container query */
    height: 100cqw;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    transition: background-color 350ms ease;
  }

  .canvas-wrapper[data-dark-mode="true"] {
    background: #0a0a0f;
  }

  .canvas-wrapper[data-transparent="true"] {
    background: transparent;
  }

  /* ===========================================
     SPLIT CANVASES: Blue-only and Red-only
     Expand below hero during disassemble.
     Same DOM tree - no swap, CSS transitions only.
     =========================================== */

  .split-canvases {
    display: flex;
    width: 100%;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    /* Collapse: fade out quickly, no delay */
    transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                opacity 0.2s ease-in;
  }

  .split-canvases.expanded {
    /* Each half-width canvas is square, so row height = 50% of wrapper width */
    max-height: 50cqw;
    opacity: 1;
    /* Expand: delay opacity so engines have time to render before becoming visible */
    transition: max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1),
                opacity 0.3s ease-out 0.2s;
  }

  .split-canvas {
    width: 50%;
    aspect-ratio: 1 / 1;
    position: relative;
    overflow: hidden;
  }

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
  .progress-slot {
    flex-shrink: 0;
    overflow: hidden;
    max-height: 100px;
    opacity: 1;
    transition: max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
                opacity 0.2s ease-out;
  }

  .canvas-wrapper :global(canvas) {
    background: transparent;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
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

    .header-slot {
      max-height: 0;
      opacity: 0;
    }

    .canvas-wrapper {
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

  .animation-container[data-focused] .canvas-wrapper {
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

  .animation-container[data-fill] .canvas-wrapper {
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
    .progress-slot,
    .split-canvases,
    .canvas-wrapper :global(canvas) {
      transition: none;
    }
  }
</style>
