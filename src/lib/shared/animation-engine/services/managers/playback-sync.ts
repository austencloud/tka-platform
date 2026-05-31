/**
 * PlaybackSync
 *
 * Owns the per-update render orchestration that was previously the bulk of
 * AnimationEngine.update(), plus the related per-visibility-change logic and
 * change-detection state.
 *
 * Extracted from AnimationEngine as P1.5 of the strangler refactor.
 * Completes P1: AnimationEngine is now a thin façade.
 *
 * Owned methods (moved verbatim from engine):
 *   - update(props)              — per-prop orchestration called every frame
 *   - handleVisibilityChange()   — dark-mode / trails / props / path-shape branches
 *   - pullServiceState()         — pull precomputer/glyph/proptype/proptexture/resize
 *   - initializeTrailCapturer()  — lazy one-shot trail capturer init
 *   - trailSettingsChanged()     — shallow comparison helper
 *
 * Owned state (moved from engine):
 *   change-detection fields, prev-* flags, stateSynchronizer instance,
 *   canvasSize (owned here; engine reads via getCanvasSize()).
 *
 * Does NOT import AnimationEngine — keeps the dependency graph acyclic.
 * CanvasLifecycleManager and sibling managers are imported as `import type` only.
 */

import { StateSynchronizer } from "../state-synchronizer";
import type { AnimatorState } from "../../state/animator-state.svelte";
import type { CanvasLifecycleManager } from "../canvas-lifecycle-manager";
import type { PropSystem } from "./prop-system";
import type { FrameSystem } from "./frame-system";
import type { EffectSystem } from "./effect-system";
import type { AnimationVisibilityState } from "../animation-visibility-synchronizer";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { AnimationEngineProps, AnimationEngineCallbacks } from "../animation-engine.svelte";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { TrailSettings } from "../../domain/types/trail-types";
import { DEFAULT_CANVAS_SIZE } from "../canvas-resizer.svelte";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Default props sentinel used when lastPropsRef is null */
const DEFAULT_ENGINE_PROPS: AnimationEngineProps = {
  blueProp: null,
  redProp: null,
};

export interface PlaybackSyncDeps {
  lifecycleManager: CanvasLifecycleManager;
  propSystem: PropSystem;
  frameSystem: FrameSystem;
  effectSystem: EffectSystem;
  getVM: () => AnimationVisibilityStateManager;
  getCallbacks: () => AnimationEngineCallbacks;
  getCanvasSize: () => number;
  setCanvasSize: (s: number) => void;
  buildFrameDeps: () => {
    effectsConfigState: import("$lib/shared/effects/state/effects-config-state.svelte").EffectsConfigState | null;
    effectRendererManager: import("../effect-renderer-manager").EffectRendererManager;
    getVM: () => AnimationVisibilityStateManager;
  };
}

export class PlaybackSync {
  // ── StateSynchronizer (owned here) ──────────────────────────────────────────
  private readonly stateSynchronizer = new StateSynchronizer();

  // ── Change-detection state (moved from engine) ───────────────────────────────
  private _lastPropsRef: AnimationEngineProps | null = null;
  private prevStepData: StartPositionData | StepData | null = null;
  private prevSequenceData: SequenceData | null = null;
  private prevIsPlaying: boolean = false;
  private prevGridMode: GridMode | null = null;

  private previewDarkModeActive: boolean = false;
  private _prevTrailsActive: boolean = true;
  private _prevPropsVisible: boolean = true;
  private prevPathShape: "arc" | "linear" | "concave" = "arc";
  private prevMotionAwarePaths: boolean = false;

  private previousGridMode: string | null = null;
  private previousShowNonRadialPoints: boolean = true;
  private cacheSequenceId: string | null = null;
  private lastClearSignal: number = 0;
  private lastPreRenderClearSignal: number = 0;

  private settingsLoaded = false;
  private trailCapturerInitialized = false;

  constructor(
    private readonly state: AnimatorState,
    private readonly deps: PlaybackSyncDeps
  ) {}

  // ── Public accessors for engine façade use ───────────────────────────────────

  get lastPropsRef(): AnimationEngineProps | null {
    return this._lastPropsRef;
  }

  get prevSequenceDataForDiag(): SequenceData | null {
    return this.prevSequenceData;
  }

  // ── Prev-state setters (called from engine.initialize()) ────────────────────

  setPrevTrailsActive(value: boolean): void {
    this._prevTrailsActive = value;
  }

  setPrevPropsVisible(value: boolean): void {
    this._prevPropsVisible = value;
  }

  setPreviousGridMode(value: string | null): void {
    this.previousGridMode = value;
  }

  setPreviousShowNonRadialPoints(value: boolean): void {
    this.previousShowNonRadialPoints = value;
  }

  // ── Reset (called from engine.dispose()) ────────────────────────────────────

  reset(): void {
    this._lastPropsRef = null;
    this.prevStepData = null;
    this.prevSequenceData = null;
  }

  // ── Main per-frame orchestration ─────────────────────────────────────────────

  /**
   * Per-prop orchestration — the entire update() body moved verbatim from engine.
   * Engine's public update() delegates here.
   */
  update(props: AnimationEngineProps): void {
    const { lifecycleManager, propSystem, frameSystem, effectSystem, getCallbacks, buildFrameDeps } = this.deps;

    // Keep simple reference for initial render (no copy, just reference)
    this._lastPropsRef = props;

    // Track only what we actually compare (avoid object spread GC pressure)
    this.prevStepData = props.stepData ?? null;
    this.prevSequenceData = props.sequenceData ?? null;
    this.prevIsPlaying = props.isPlaying ?? false;
    this.prevGridMode = props.gridMode ?? null;

    // Sync state from services that own reactive state
    this.pullServiceState();

    // Handle settings/trail capturer initialization
    const shouldInitTrailCapturer =
      this.state.currentBluePropType !== "staff" ||
      this.state.currentRedPropType !== "staff" ||
      lifecycleManager.settingsService?.currentSettings ||
      props.externalTrailSettings !== undefined;

    if (shouldInitTrailCapturer && lifecycleManager.trailCapturer && !this.trailCapturerInitialized) {
      if (!this.settingsLoaded) {
        this.settingsLoaded = true;
      }
      this.initializeTrailCapturer(props);
      this.trailCapturerInitialized = true;
    }

    // Handle prop type changes (delegated to PropSystem)
    const getFrameParamsFn = () => frameSystem.buildFrameParams(props, buildFrameDeps());
    propSystem.handlePropTypeChanges(props, getFrameParamsFn);

    // Handle trail settings changes - enforce unilateral constraint before syncing
    if (props.externalTrailSettings !== undefined) {
      lifecycleManager.trailSettingsSync?.handleExternalSettingsSync(
        frameSystem.enforceUnilateralConstraint(
          props.externalTrailSettings,
          this.state.currentBluePropType,
          this.state.currentRedPropType
        )
      );
    }

    // Handle synced trail settings from service
    const syncedSettings = lifecycleManager.trailSettingsSync?.state.syncedSettings;
    if (syncedSettings) {
      // Only update and notify if settings actually changed (shallow comparison)
      const settingsChanged = this.trailSettingsChanged(
        this.state.trailSettings,
        syncedSettings
      );

      // CRITICAL: Only write to $state if settings actually changed to prevent infinite loops
      if (settingsChanged) {
        this.state.setTrailSettings(syncedSettings);

        // Only call handleSettingsChange if we're NOT using external settings
        if (props.externalTrailSettings === undefined) {
          lifecycleManager.trailSettingsSync?.handleSettingsChange(
            this.state.trailSettings,
            false
          );
        }

        // Notify parent of the change
        getCallbacks().onTrailSettingsChange?.(syncedSettings);
      }
    }

    // Handle sequence changes
    lifecycleManager.sequenceCache?.handleSequenceChange(props.sequenceData ?? null);

    // Detect sequence content changes and re-initialize orchestrator if needed
    if (props.sequenceData && lifecycleManager.orchestrator) {
      const newHash = frameSystem.getSequenceContentHash(props.sequenceData);
      if (newHash !== frameSystem.lastSequenceContentHash) {
        lifecycleManager.orchestrator.initializeWithDomainData(props.sequenceData);
        frameSystem.lastSequenceContentHash = newHash;

        // Flush stale trail data so old ring buffer points don't draw
        // artifact lines to the new prop positions.
        effectSystem.trailOverlay?.clearBuffers();
        effectSystem.fireTipTracker?.reset();
        effectSystem.fireRenderer?.clearSimulation();
        effectSystem.charcoalRenderer?.clearSimulation();

        // Trigger path cache precomputation for smooth trails during stutters
        if (
          this.state.trailSettings.usePathCache &&
          lifecycleManager.precomputer
        ) {
          const totalSteps = props.sequenceData.steps.length;
          const stepDurationMs = 1000;

          lifecycleManager.precomputer
            .precomputeAnimationPaths(
              props.sequenceData,
              totalSteps,
              stepDurationMs,
              this.state.trailSettings
            )
            .then(() => {
              const pathCache = lifecycleManager.precomputer?.getPathCache();
              if (pathCache && lifecycleManager.renderLoop) {
                lifecycleManager.renderLoop.updateConfig({ pathCache });
              }
            })
            .catch((err) => {
              console.error(`[TRANSFORM-DIAG] Precomputation FAILED:`, err);
            });
        }
      }
    }

    // Handle cache clear signals (only process once per signal)
    const clearSignal = lifecycleManager.sequenceCache?.state.clearSignal ?? 0;
    if (clearSignal > this.lastClearSignal) {
      lifecycleManager.precomputer?.clearCaches();
      if (!effectSystem.trailOverlay) {
        lifecycleManager.trailCapturer?.clearTrails();
      }
      this.cacheSequenceId = null;
      this.lastClearSignal = clearSignal;
    }

    // Handle pre-render clear signals (only process once per signal)
    const preRenderClearSignal =
      lifecycleManager.sequenceCache?.state.preRenderClearSignal ?? 0;
    if (preRenderClearSignal > this.lastPreRenderClearSignal) {
      lifecycleManager.precomputer?.clearPreRenderedFrames();
      this.lastPreRenderClearSignal = preRenderClearSignal;
    }

    // Sync pre-rendered frames flag
    lifecycleManager.sequenceCache?.setHasPreRenderedFrames(
      lifecycleManager.precomputer?.state.preRenderedFramesReady ?? false
    );

    // Handle playback changes
    lifecycleManager.sequenceCache?.handlePlaybackChange(props.isPlaying ?? false);

    // Handle grid mode changes (also reload when nonradial visibility changes)
    const currentGridMode = props.gridMode?.toString() ?? null;
    const currentShowNonRadial = props.showNonRadialPoints ?? true;
    if (
      this.state.isInitialized &&
      lifecycleManager.animationRenderer &&
      (currentGridMode !== this.previousGridMode ||
        currentShowNonRadial !== this.previousShowNonRadialPoints)
    ) {
      this.previousGridMode = currentGridMode;
      this.previousShowNonRadialPoints = currentShowNonRadial;
      lifecycleManager.animationRenderer
        .loadGridTexture(currentGridMode ?? "diamond", currentShowNonRadial)
        .then(() => {
          lifecycleManager.renderLoop?.triggerRender(() =>
            frameSystem.buildFrameParams(props, buildFrameDeps())
          );
        });
    }

    // Handle preview dark mode override
    if (props.previewDarkMode !== undefined && props.previewDarkMode !== null) {
      this.previewDarkModeActive = true;
      const previewDarkMode = props.previewDarkMode;
      if (previewDarkMode !== propSystem.prevDarkMode) {
        propSystem.setPrevDarkMode(previewDarkMode);
        lifecycleManager.animationRenderer?.setDarkMode(previewDarkMode);

        if (this.state.isInitialized) {
          lifecycleManager.renderLoop?.triggerRender(() =>
            frameSystem.buildFrameParams(props, buildFrameDeps())
          );

          propSystem.reloadTexturesForDarkMode(() => {
            lifecycleManager.renderLoop?.triggerRender(() =>
              frameSystem.buildFrameParams(props, buildFrameDeps())
            );
          });
        }
      }
    } else {
      this.previewDarkModeActive = false;
    }

    // Update trail capturer with prop type and loopability changes
    if (lifecycleManager.trailCapturer && this.settingsLoaded) {
      lifecycleManager.trailCapturer.updateConfig({
        bluePropType: this.state.currentBluePropType,
        redPropType: this.state.currentRedPropType,
        isSeamlesslyLoopable: props.isSeamlesslyLoopable,
      });
    }

    // Update glyph transition
    const stepNumber = frameSystem.calculateBeatNumber(props);
    const turnsTuple = frameSystem.calculateTurnsTuple(props);
    const musicalPosition = frameSystem.calculateMusicalPosition(props);
    lifecycleManager.glyphTransition?.updateTarget(
      props.letter ?? null,
      turnsTuple,
      stepNumber,
      musicalPosition
    );

    // Sync glyph state immediately after update so component sees new values
    frameSystem.syncGlyphState();

    // Trigger render if initialized
    if (this.state.isInitialized) {
      lifecycleManager.renderLoop?.triggerRender(() =>
        frameSystem.buildFrameParams(props, buildFrameDeps())
      );
    }
  }

  // ── Visibility-change orchestration ─────────────────────────────────────────

  /**
   * Handle visibility state changes from the subscription.
   * Moved verbatim from engine.handleVisibilityChange().
   */
  handleVisibilityChange(state: AnimationVisibilityState): void {
    const { lifecycleManager, propSystem, frameSystem, effectSystem, getVM, buildFrameDeps } = this.deps;

    this.state.setVisibilityState(state);

    const vm = getVM();

    // Sync Dark Mode to renderer when it changes
    if (state.darkMode !== propSystem.prevDarkMode && !this.previewDarkModeActive) {
      propSystem.setPrevDarkMode(state.darkMode);
      lifecycleManager.animationRenderer?.setDarkMode(state.darkMode);

      if (this.state.isInitialized) {
        lifecycleManager.renderLoop?.triggerRender(() =>
          frameSystem.buildFrameParams(this._lastPropsRef ?? DEFAULT_ENGINE_PROPS, buildFrameDeps())
        );

        propSystem.reloadTexturesForDarkMode(() => {
          lifecycleManager.renderLoop?.triggerRender(() =>
            frameSystem.buildFrameParams(this._lastPropsRef ?? DEFAULT_ENGINE_PROPS, buildFrameDeps())
          );
        });
      }
    }

    // Trigger render when trails visibility changes
    const trailsInMap = this.hasEffectInMap(effectSystem.effectsConfigState?.tipEffectMap, "trails");
    if (trailsInMap !== this._prevTrailsActive) {
      const trailsTurnedOff = this._prevTrailsActive && !trailsInMap;
      this._prevTrailsActive = trailsInMap;

      if (trailsTurnedOff && effectSystem.trailOverlay) {
        effectSystem.trailOverlay.clear();
        effectSystem.trailOverlay.setVisible(false);
      } else if (trailsInMap && effectSystem.trailOverlay) {
        effectSystem.trailOverlay.setVisible(true);
      }

      if (this.state.isInitialized) {
        lifecycleManager.renderLoop?.triggerRender(() =>
          frameSystem.buildFrameParams(this._lastPropsRef ?? DEFAULT_ENGINE_PROPS, buildFrameDeps())
        );
      }
    }

    // Trigger render when props visibility changes
    if (state.props !== this._prevPropsVisible) {
      const becameVisible = state.props && !this._prevPropsVisible;
      this._prevPropsVisible = state.props;

      if (becameVisible) {
        lifecycleManager.trailCapturer?.clearTrails();
      }

      if (this.state.isInitialized) {
        lifecycleManager.renderLoop?.triggerRender(() =>
          frameSystem.buildFrameParams(this._lastPropsRef ?? DEFAULT_ENGINE_PROPS, buildFrameDeps())
        );
      }
    }

    // Delegate all effect-specific sync to EffectSystem
    effectSystem.syncEffects(state, vm);

    // Path shape or hybrid mode changed.
    const pathShape = vm.getPathShape();
    const motionAwarePaths = vm.getMotionAwarePaths();
    if (pathShape !== this.prevPathShape || motionAwarePaths !== this.prevMotionAwarePaths) {
      this.prevPathShape = pathShape;
      this.prevMotionAwarePaths = motionAwarePaths;

      effectSystem.fireTipTracker?.reset();

      if (effectSystem.fireRenderer?.isInitialized()) {
        effectSystem.fireRenderer.clearSimulation();
      }
      if (effectSystem.charcoalRenderer?.isInitialized()) {
        effectSystem.charcoalRenderer.clearSimulation();
      }

      lifecycleManager.trailCapturer?.clearTrails();

      lifecycleManager.precomputer?.clearCaches();
      lifecycleManager.renderLoop?.updateConfig({ pathCache: null });

      if (
        lifecycleManager.precomputer &&
        this.state.trailSettings.usePathCache &&
        this.prevSequenceData
      ) {
        const totalSteps = this.prevSequenceData.steps.length;
        const stepDurationMs = 1000;
        lifecycleManager.precomputer
          .precomputeAnimationPaths(
            this.prevSequenceData,
            totalSteps,
            stepDurationMs,
            this.state.trailSettings
          )
          .then(() => {
            const pathCache = lifecycleManager.precomputer?.getPathCache();
            if (pathCache && lifecycleManager.renderLoop) {
              lifecycleManager.renderLoop.updateConfig({ pathCache });
              lifecycleManager.trailCapturer?.clearTrails();
            }
          })
          .catch(() => {
            // Precomputation failed - real-time capture continues
          });
      }

      if (this.state.isInitialized) {
        lifecycleManager.renderLoop?.triggerRender(() =>
          frameSystem.buildFrameParams(this._lastPropsRef ?? DEFAULT_ENGINE_PROPS, buildFrameDeps())
        );
      }
    }
  }

  // ── Service-state pull (was engine.syncServiceState) ────────────────────────

  /**
   * Pull precomputer/glyph/proptype/proptexture/resize state into AnimatorState.
   * Moved from engine.syncServiceState(). Called at the top of update().
   * Internal-only — not exposed on the public surface.
   */
  private pullServiceState(): void {
    const { lifecycleManager, propSystem, frameSystem, effectSystem, getCanvasSize, setCanvasSize } = this.deps;

    const precomputer = lifecycleManager.precomputer;
    if (precomputer) {
      const ps = precomputer.state;
      this.state.setPreRendering(ps.isPreRendering);
      this.state.setPreRenderProgress(ps.preRenderProgress);
      this.state.setPreRenderedFramesReady(ps.preRenderedFramesReady);
    }

    // Sync from glyph transition service
    frameSystem.syncGlyphState();

    // Sync from prop type service - delegated to PropSystem.
    propSystem.syncPropTypeFromChanger();

    // Sync from prop texture service
    const propTextureLoader = lifecycleManager.propTextureLoader;
    if (propTextureLoader) {
      const pts = propTextureLoader.state;
      this.state.setBluePropDimensions(pts.blueDimensions);
      this.state.setRedPropDimensions(pts.redDimensions);
    }

    // Sync from resize service (delegated to StateSynchronizer)
    const newSize = this.stateSynchronizer.syncResizeState({
      canvasResizerService: lifecycleManager.resizer,
      trailCapturer: lifecycleManager.trailCapturer,
      renderLoopService: lifecycleManager.renderLoop,
      effectRendererManager: effectSystem.rendererManager,
    });
    setCanvasSize(newSize);
  }

  // ── Trail capturer initialization ────────────────────────────────────────────

  private initializeTrailCapturer(props: AnimationEngineProps): void {
    const { lifecycleManager, frameSystem, getCanvasSize } = this.deps;
    const trailCapturer = lifecycleManager.trailCapturer;
    if (!trailCapturer || !this.settingsLoaded) return;

    // Use external trail settings if provided, otherwise use internal state
    const effectiveTrailSettings =
      props.externalTrailSettings ?? this.state.trailSettings;

    // Also update internal state if external settings provided
    if (props.externalTrailSettings) {
      this.state.setTrailSettings(props.externalTrailSettings);
    }

    trailCapturer.initialize({
      canvasSize: getCanvasSize(),
      bluePropDimensions: this.state.bluePropDimensions,
      redPropDimensions: this.state.redPropDimensions,
      trailSettings: frameSystem.enforceUnilateralConstraint(
        effectiveTrailSettings,
        this.state.currentBluePropType,
        this.state.currentRedPropType
      ),
      bluePropType: this.state.currentBluePropType,
      redPropType: this.state.currentRedPropType,
    });

    lifecycleManager.trailSettingsSync?.initialize(trailCapturer, () =>
      lifecycleManager.renderLoop?.triggerRender(() =>
        frameSystem.buildFrameParams(props, this.deps.buildFrameDeps())
      )
    );

    // CRITICAL: Immediately sync external settings after initializing the sync service
    if (props.externalTrailSettings) {
      lifecycleManager.trailSettingsSync?.handleExternalSettingsSync(
        props.externalTrailSettings
      );
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Shallow comparison of trail settings (faster than JSON.stringify)
   */
  private trailSettingsChanged(a: TrailSettings, b: TrailSettings): boolean {
    return (
      a.mode !== b.mode ||
      a.effect !== b.effect ||
      a.fadeDurationMs !== b.fadeDurationMs ||
      a.maxPoints !== b.maxPoints ||
      a.lineWidth !== b.lineWidth ||
      a.glowBlur !== b.glowBlur ||
      a.blueColor !== b.blueColor ||
      a.redColor !== b.redColor ||
      a.minOpacity !== b.minOpacity ||
      a.maxOpacity !== b.maxOpacity ||
      a.trackingMode !== b.trackingMode ||
      a.hideProps !== b.hideProps ||
      a.usePathCache !== b.usePathCache ||
      a.previewMode !== b.previewMode ||
      a.tailLength !== b.tailLength
    );
  }

  /** Returns true if any entry in the map has the given effect type. */
  private hasEffectInMap(map: import("../../domain/types/tip-effect-types").TipEffectMap | undefined, effect: string): boolean {
    if (!map) return false;
    return Object.values(map).some((a) => a.effect === effect);
  }
}
