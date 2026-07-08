<!--
CanvasSurface.svelte - Non-recursive LEAF render body for AnimatorCanvas

================================================================================
ARCHITECTURAL NOTE
================================================================================

This is the single-canvas render body extracted out of AnimatorCanvas.svelte.

WHY IT EXISTS:
AnimatorCanvas self-imported (`import AnimatorCanvasSelf from "./AnimatorCanvas.svelte"`)
to render its blue-only / red-only split-mode canvases. That self-import — plus the
AnimatorCanvas -> DisassembleCanvasView -> AnimatorCanvas cycle — crashed Vite HMR
(`reading 'default'` + forced full reload on every edit).

CanvasSurface is the cycle-break: a NON-RECURSIVE leaf that owns the engine, the
single `.canvas-wrapper`, and the 2D overlays. It MUST NEVER import
AnimatorCanvas.svelte, DisassembleCanvasView.svelte, DisassembleTransition.svelte,
or any SplitCanvasView. Keep this file leaf-clean.

WHAT IT OWNS:
1. The AnimationEngine instance (created with `new AnimationEngine()` directly).
2. Container element + the `.canvas-wrapper` div.
3. The 2D overlays (GlyphOverlay, PathLinesOverlay, ProgressOverlay).
4. The hidden GlyphRenderer (TKAGlyph -> SVG bridge).
5. Engine lifecycle: init/dispose + RenderContext registry register/unregister.
6. The single $effect that pushes reactive props into engine.update().
7. All engine-driven derivations the overlays consume.

The parent (AnimatorCanvas) binds the engine back out via `bind:engine` so it can
drive pauseResize/resumeResize during the disassemble transition and surface
captureEffectDiagnostics to the context menu.
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
  import GlyphRenderer from "./GlyphRenderer.svelte";
  import GlyphOverlay from "./layers/GlyphOverlay.svelte";
  import PathLinesOverlay from "./layers/PathLinesOverlay.svelte";
  import ProgressOverlay from "./layers/ProgressOverlay.svelte";
  import { AnimationEngine } from "../services/animation-engine.svelte";
  import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";
  import { isSeamlesslyLoopable as sequenceLoopabilityCheck } from "$lib/shared/foundation/services/sequence-loopability-checker";
  import type { FireOverlayConfig } from "../domain/types/fire-types";
  import type { LedOverlayConfig } from "../domain/types/led-types";
  import type { TipEffectMap, TipEffortMap, EffectType } from "../domain/types/tip-effect-types";
  import { untrack, type Snippet } from "svelte";
  import { fireCacheInvalidation } from "../state/fire-invalidation-signal.svelte";
  import { effectErrorSignal } from "../state/effect-error-signal.svelte";
  import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { tryGetViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";
  import { getRenderContextRegistry } from "../get-render-context-registry";
  import { installAnimatorDiagnostics } from "../debug/animator-diagnostics";

  let {
    // Engine-driving props
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
    trailSettings: externalTrailSettings = $bindable(),
    bluePropType = null,
    redPropType = null,
    previewDarkMode = null,
    isSeamlesslyLoopable = undefined,
    showNonRadialPoints = true,
    fireConfig = undefined,
    ledConfig = undefined,
    tipEffectMap: cellTipEffectMap = undefined,
    tipEffortMap: cellTipEffortMap = undefined,
    virtualTime = undefined,
    // Overlay / glyph visibility props (resolved by the parent from the visibility manager)
    hideTkaGlyph = false,
    hideStepNumbers = false,
    darkModeEnabled = false,
    effectiveTkaGlyphVisible = false,
    effectiveBeatNumbersVisible = false,
    bluePathLinesVisible = false,
    redPathLinesVisible = false,
    suppress2DOverlays = false,
    // Engine wiring props
    resizePaused = false,
    visibilityManagerOverride = undefined,
    effectsConfigState = undefined,
    prewarmEffects = undefined,
    contextId = undefined,
    // Callbacks
    onCanvasReady = () => {},
    onInitialized = undefined,
    onEffectError = undefined,
    // Bound back to the parent so it can drive resize + diagnostics
    engine = $bindable(),
    // Optional overlay pinned inside the square .canvas-wrapper (position:relative),
    // e.g. a corner play/pause toggle. Anchors to the actual canvas, not the
    // header/progress stack. Undefined → nothing rendered.
    cornerControl = undefined,
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
    trailSettings?: TrailSettings;
    bluePropType?: string | null;
    redPropType?: string | null;
    previewDarkMode?: boolean | null;
    isSeamlesslyLoopable?: boolean;
    showNonRadialPoints?: boolean;
    fireConfig?: Partial<FireOverlayConfig>;
    ledConfig?: Partial<LedOverlayConfig>;
    tipEffectMap?: TipEffectMap;
    tipEffortMap?: TipEffortMap;
    virtualTime?: number;
    hideTkaGlyph?: boolean;
    hideStepNumbers?: boolean;
    darkModeEnabled?: boolean;
    effectiveTkaGlyphVisible?: boolean;
    effectiveBeatNumbersVisible?: boolean;
    bluePathLinesVisible?: boolean;
    redPathLinesVisible?: boolean;
    suppress2DOverlays?: boolean;
    resizePaused?: boolean;
    visibilityManagerOverride?: AnimationVisibilityStateManager;
    effectsConfigState?: EffectsConfigState;
    /** WebGL overlay effects (today: "fire") to warm at engine startup so the
     *  first switch to them never freezes. Omit on memory-sensitive surfaces. */
    prewarmEffects?: EffectType[];
    contextId?: string;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onInitialized?: () => void;
    onEffectError?: (effectName: string, error: Error) => void;
    /** The engine instance, bound back to the parent for resize + diagnostics control. */
    engine?: AnimationEngine;
    /** Optional overlay pinned inside the square canvas (e.g. a corner toggle). */
    cornerControl?: Snippet;
  } = $props();

  const resolvedContextId = contextId ?? `canvas-${Math.random().toString(36).slice(2, 8)}`;

  let containerElement: HTMLDivElement | undefined = $state();

  // Engine instance - created here in the leaf and bound back out to the parent.
  const engineInstance = new AnimationEngine();
  engine = engineInstance;

  // Sync 2D overlay suppression (for 3D mode)
  $effect.pre(() => {
    engineInstance.animatorState.setSuppress2DOverlays(suppress2DOverlays);
  });

  // Use $derived to read visibilityManagerOverride reactively (avoids state_referenced_locally)
  const visibilityManager = $derived(visibilityManagerOverride ?? getAnimationVisibilityManager());
  $effect.pre(() => {
    // Read through visibilityManager derived (which already tracks visibilityManagerOverride)
    // to avoid capturing the destructured prop directly
    const override = visibilityManager !== getAnimationVisibilityManager() ? visibilityManager : null;
    if (override) {
      engineInstance.setVisibilityManager(override);
    }
  });

  // Fall back to ancestor-provided context when no prop is passed so the
  // customize panel (Zap/Sparkle/Echo/Bloom) actually drives this canvas.
  const inheritedEffectsConfig = getEffectsConfigContext();
  $effect.pre(() => {
    const ecs = effectsConfigState ?? inheritedEffectsConfig ?? null;
    engineInstance.setEffectsConfigState(ecs);
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

  // Hover-intent prewarm: when the user points at an effect in the picker,
  // EffectsPanel sets ecs.prewarmHint. Warm that effect's webgl renderer (today:
  // fire) ahead of the click so the switch never freezes. Best-effort — a no-op
  // before init or for non-webgl effects.
  $effect(() => {
    const ecs = effectsConfigState ?? inheritedEffectsConfig ?? null;
    const hint = ecs?.prewarmHint;
    if (!hint) return;
    untrack(() => engineInstance.prewarmEffect(hint));
  });

  // Push viewer-scoped motion visibility into the engine whenever the toggle
  // changes. Reads tryGet so this still works outside the viewer
  // (landing page, browse previews) - context absent → method never called.
  const viewerVisibilityCtx = tryGetViewerVisibilityContext();
  $effect(() => {
    if (!viewerVisibilityCtx) return;
    engineInstance.setMotionVisibility(
      viewerVisibilityCtx.blueMotion,
      viewerVisibilityCtx.redMotion,
    );
  });

  const effectiveIsSeamlesslyLoopable = $derived.by(() => {
    if (isSeamlesslyLoopable !== undefined) return isSeamlesslyLoopable;
    if (!sequenceData) return false;
    return sequenceLoopabilityCheck(sequenceData);
  });

  // When an external caller (e.g. video export orchestrator) signals that the
  // fire frame cache is stale, invalidate it so the simulation re-records.
  let lastFireInvalidationSignal = fireCacheInvalidation.signal;
  $effect(() => {
    const sig = fireCacheInvalidation.signal;
    if (sig !== lastFireInvalidationSignal) {
      lastFireInvalidationSignal = sig;
      const mode = fireCacheInvalidation.mode;
      if (mode === "cacheOnly") {
        untrack(() => engineInstance.invalidateFireFrameCacheOnly());
      } else if (mode === "thermalClear") {
        untrack(() => engineInstance.clearFireThermalFields());
      } else {
        untrack(() => engineInstance.invalidateFireCache());
      }
    }
  });

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
          `[CanvasSurface] ${name} effect was auto-disabled after repeated failures. ` +
          `Toggle the effect off and on to retry. Error: ${err.message}`
        );
        effectErrorSignal.clear();
      }
    }
  });

  // Derived state from engine
  const isInitialized = $derived(engineInstance.animatorState.isInitialized);
  const isPreRendering = $derived(engineInstance.animatorState.isPreRendering);
  const preRenderProgress = $derived(engineInstance.animatorState.preRenderProgress);
  const preRenderedFramesReady = $derived(engineInstance.animatorState.preRenderedFramesReady);
  const displayedLetter = $derived(engineInstance.animatorState.displayedLetter);
  const displayedTurnsTuple = $derived(engineInstance.animatorState.displayedTurnsTuple);
  const displayedStepNumber = $derived(engineInstance.animatorState.displayedStepNumber);
  const displayedMusicalPosition = $derived(engineInstance.animatorState.displayedMusicalPosition);

  // Initialize engine when container element appears.
  // The hero canvas stays mounted always - no teardown during disassemble.
  $effect(() => {
    const el = containerElement;
    if (!el) return;

    // Register the render context AFTER the (async) engine init resolves.
    // getRenderContext returns null until the awaited lifecycle init has created
    // the renderer/renderLoop/trailCapturer/resizer. The previous queueMicrotask
    // fired before that completed, so getRenderContext returned null and the
    // context was NEVER registered — silently disabling every registry consumer
    // (the export's native-res resize and the export-start trail reset). The
    // `disposed` guard prevents registering a context for an engine that was torn
    // down before init finished.
    let disposed = false;
    untrack(() => {
      void engineInstance
        .initialize(el, {
          onCanvasReady,
          onTrailSettingsChange: (settings) => {
            externalTrailSettings = settings;
          },
          onEffectError,
          prewarmEffects,
        })
        .then(() => {
          if (disposed) return;
          const ctx = engineInstance.getRenderContext(resolvedContextId, el);
          if (ctx) {
            getRenderContextRegistry().register(ctx);
          }
        })
        .catch(() => {
          // Init failures surface via onEffectError; nothing to register.
        });
    });

    // Dev-only: install the LED/fire console diagnostics on window. Gated on
    // import.meta.env.DEV so production never gets these window globals. The
    // teardown removes them when the engine is disposed.
    let disposeDiagnostics: (() => void) | undefined;
    if (import.meta.env.DEV) {
      disposeDiagnostics = installAnimatorDiagnostics(
        engineInstance,
        () => containerElement,
      );
    }

    return () => {
      disposed = true;
      untrack(() => {
        disposeDiagnostics?.();
        getRenderContextRegistry().unregister(resolvedContextId);
        engineInstance.dispose();
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
      tunnelSpectrum,
      tunnelSelectedLayer,
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
      showNonRadialPoints,
    };
    untrack(() => {
      if (currentFireConfig) {
        engineInstance.setFireConfig(currentFireConfig);
      }
      if (currentLedConfig) {
        engineInstance.setLedConfig(currentLedConfig);
      }
      engineInstance.setCellTipEffectMap(currentCellTipEffectMap);
      engineInstance.setCellTipEffortMap(currentCellTipEffortMap);
      engineInstance.update(props);
    });
  });

  $effect(() => {
    if (isInitialized) {
      engineInstance.processPendingGlyph();
      // Wait for the render loop to paint at least one frame before
      // signaling readiness. The initializer sets isInitialized BEFORE
      // starting the render loop (step 8 vs step 10), so without this
      // delay the callback fires while the canvas is still blank.
      untrack(() => {
        if (onInitialized) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onInitialized?.();
            });
          });
        }
      });
    }
  });

  // Pause/resume resize observation when parent controls it via prop
  $effect(() => {
    if (resizePaused) {
      engineInstance.pauseResize();
    } else {
      engineInstance.resumeResize();
    }
  });

  function handleGlyphSvgReady(
    svgString: string,
    width: number,
    height: number,
    x: number,
    y: number
  ) {
    engineInstance.handleGlyphSvgReady(svgString, width, height, x, y);
  }
</script>

<!-- Hidden GlyphRenderer that converts TKAGlyph to SVG for Canvas2D rendering -->
{#if letter}
  <GlyphRenderer {letter} {stepData} onSvgReady={handleGlyphSvgReady} />
{/if}

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
      darkMode={darkModeEnabled}
      isAtStartPosition={!hideStepNumbers && currentStep < 1 && sequenceData !== null}
      isAtEndPosition={
        !hideStepNumbers &&
        sequenceData !== null &&
        !effectiveIsSeamlesslyLoopable &&
        currentStep >= (sequenceData.steps?.length ?? 0) + 0.99
      }
    />

    {#if bluePathLinesVisible || redPathLinesVisible}
      <PathLinesOverlay
        {sequenceData}
        {currentStep}
        {stepData}
        showBlue={bluePathLinesVisible}
        showRed={redPathLinesVisible}
        vm={visibilityManager}
      />
    {/if}

    <ProgressOverlay
      {isPreRendering}
      {preRenderProgress}
      {preRenderedFramesReady}
    />
  {/if}

  {@render cornerControl?.()}
</div>

<style>
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

  .canvas-wrapper :global(canvas) {
    background: transparent;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* ===========================================
     REDUCED MOTION
     =========================================== */

  @media (prefers-reduced-motion: reduce) {
    .canvas-wrapper,
    .canvas-wrapper :global(canvas) {
      transition: none;
    }
  }
</style>
