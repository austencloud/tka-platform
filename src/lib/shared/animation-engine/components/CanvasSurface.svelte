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
  import ProgressOverlay from "./layers/ProgressOverlay.svelte";
  import { AnimationEngine } from "../services/implementations/AnimationEngine.svelte";
  import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../state/animation-visibility-state.svelte";
  import { isSeamlesslyLoopable as sequenceLoopabilityCheck } from "$lib/shared/foundation/services/sequence-loopability-checker";
  import type { FireOverlayConfig } from "../domain/types/FireTypes";
  import type { LedOverlayConfig } from "../domain/types/LedTypes";
  import type { TipEffectMap, TipEffortMap } from "../domain/types/TipEffectTypes";
  import { untrack } from "svelte";
  import { fireCacheInvalidation } from "../state/fire-invalidation-signal.svelte";
  import { effectErrorSignal } from "../state/effect-error-signal.svelte";
  import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { tryGetViewerVisibilityContext } from "$lib/shared/sequence-viewer/context/viewer-visibility-context";
  import { getRenderContextRegistry } from "../getRenderContextRegistry";

  let {
    // Engine-driving props
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
    effectiveStepPositionVisible = false,
    pathLinesVisible = false,
    suppress2DOverlays = false,
    // Engine wiring props
    resizePaused = false,
    visibilityManagerOverride = undefined,
    effectsConfigState = undefined,
    contextId = undefined,
    // Callbacks
    onCanvasReady = () => {},
    onInitialized = undefined,
    onEffectError = undefined,
    // Bound back to the parent so it can drive resize + diagnostics
    engine = $bindable(),
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
    effectiveStepPositionVisible?: boolean;
    pathLinesVisible?: boolean;
    suppress2DOverlays?: boolean;
    resizePaused?: boolean;
    visibilityManagerOverride?: AnimationVisibilityStateManager;
    effectsConfigState?: EffectsConfigState;
    contextId?: string;
    onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
    onInitialized?: () => void;
    onEffectError?: (effectName: string, error: Error) => void;
    /** The engine instance, bound back to the parent for resize + diagnostics control. */
    engine?: AnimationEngine;
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

  // --- EXPORT DIAGNOSTIC (remove after debugging) ---
  if (typeof window !== 'undefined') {
    (window as any).__tka_fire_diag = {
      enable: () => engineInstance.enableFireDiagnostics(),
      disable: () => engineInstance.disableFireDiagnostics(),
      reset: () => engineInstance.resetFireDiagnosticCounter(),
      sample: () => engineInstance.sampleFireCanvas(),
    };
    (window as any).__tka_fire_snapshot = () => engineInstance.snapshotFireCanvas();
    (window as any).__tka_led_diag = {
      stats: () => {
        const renderer = engineInstance.getLedRenderer();
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
        const renderer = engineInstance.getLedRenderer();
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

    untrack(() => {
      engineInstance.initialize(el, {
        onCanvasReady,
        onTrailSettingsChange: (settings) => {
          externalTrailSettings = settings;
        },
        onEffectError,
      });

      queueMicrotask(() => {
        const ctx = engineInstance.getRenderContext(resolvedContextId, el);
        if (ctx) {
          getRenderContextRegistry().register(ctx);
        }
      });
    });

    return () => {
      untrack(() => {
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
