/**
 * FrameParameterBuilder
 *
 * Computes per-frame animation parameters by querying all services.
 * Resolves effect configs, caches loopability/hand presence.
 *
 * Extracted from AnimationEngine to reduce its line count.
 * This is a plain TypeScript class - no Svelte reactivity needed.
 */

import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { RenderFrameParams } from "../contracts/IAnimationRenderLoop";
import { type TrailSettings, DEFAULT_TRAIL_SETTINGS, TrailMode } from "../../domain/types/TrailTypes";
import { TrackingMode } from "../../domain/types/TrailTypes";
import { DEFAULT_PROP_DIMENSIONS } from "../contracts/IPropTextureLoader";
import { DEFAULT_PROP_FLAME_COLORS } from "../../domain/types/FireTypes";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";
import type { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceAnimationOrchestrator";
import type { EffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";

import type {
  Bloom2DParams,
  Bubbles2DParams,
  Echo2DParams,
  Frost2DParams,
  Ink2DParams,
  Petals2DParams,
  Silk2DParams,
  Pulse2DParams,
  Smoke2DParams,
  Sparkles2DParams,
  Water2DParams,
  Zap2DParams,
} from "$lib/shared/effects/translators/canvas2d-types";
import {
  resolveBloom2D,
  resolveBubbles2D,
  resolveEcho2D,
  resolveFrost2D,
  resolveInk2D,
  resolvePetals2D,
  resolveSilk2D,
  resolvePulse2D,
  resolveSmoke2D,
  resolveSparkles2D,
  resolveWater2D,
  resolveZap2D,
} from "$lib/shared/effects/translators/canvas2d-translator";
import type {
  BloomIntent,
  BubblesIntent,
  EchoIntent,
  FrostIntent,
  InkIntent,
  PetalsIntent,
  SilkIntent,
  PulseIntent,
  SmokeIntent,
  SparklesIntent,
  WaterIntent,
} from "$lib/shared/effects/domain/EffectsConfig";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import { isSeamlesslyLoopable } from "$lib/shared/foundation/services/sequence-loopability-checker";
import { isBilateralProp } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";

import type { AnimationEngineProps } from "./AnimationEngine.svelte";
import type { AnimatorState } from "../../state/animator-state.svelte";
import type { EffectRendererManager } from "./EffectRendererManager";

export class FrameParameterBuilder {
  // ── Effect intent caches ────────────────────────────────────────────
  private zapConfig: Zap2DParams = resolveZap2D(DEFAULT_EFFECTS_CONFIG.zap);
  private sparklesConfig: Sparkles2DParams = resolveSparkles2D(DEFAULT_EFFECTS_CONFIG.sparkles);
  private prevSparklesIntentRef: SparklesIntent | null = null;
  private echoConfig: Echo2DParams = resolveEcho2D(DEFAULT_EFFECTS_CONFIG.echo);
  private prevEchoIntentRef: EchoIntent | null = null;
  private bloomConfig: Bloom2DParams = resolveBloom2D(DEFAULT_EFFECTS_CONFIG.bloom);
  private prevBloomIntentRef: BloomIntent | null = null;
  private waterConfig: Water2DParams = resolveWater2D(DEFAULT_EFFECTS_CONFIG.water);
  private prevWaterIntentRef: WaterIntent | null = null;
  private bubblesConfig: Bubbles2DParams = resolveBubbles2D(DEFAULT_EFFECTS_CONFIG.bubbles);
  private prevBubblesIntentRef: BubblesIntent | null = null;
  private petalsConfig: Petals2DParams = resolvePetals2D(DEFAULT_EFFECTS_CONFIG.petals);
  private prevPetalsIntentRef: PetalsIntent | null = null;
  private smokeConfig: Smoke2DParams = resolveSmoke2D(DEFAULT_EFFECTS_CONFIG.smoke);
  private prevSmokeIntentRef: SmokeIntent | null = null;
  private inkConfig: Ink2DParams = resolveInk2D(DEFAULT_EFFECTS_CONFIG.ink);
  private prevInkIntentRef: InkIntent | null = null;
  private frostConfig: Frost2DParams = resolveFrost2D(DEFAULT_EFFECTS_CONFIG.frost);
  private prevFrostIntentRef: FrostIntent | null = null;
  private silkConfig: Silk2DParams = resolveSilk2D(DEFAULT_EFFECTS_CONFIG.silk);
  private prevSilkIntentRef: SilkIntent | null = null;
  private pulseConfig: Pulse2DParams = resolvePulse2D(DEFAULT_EFFECTS_CONFIG.pulse);
  private prevPulseIntentRef: PulseIntent | null = null;
  private prevZapIntentJson: string = JSON.stringify(DEFAULT_EFFECTS_CONFIG.zap);

  // ── Loopability cache ───────────────────────────────────────────────
  private cachedIsSeamlesslyLoopable: boolean = false;
  private loopabilityCacheHash: string | null = null;

  // ── Hand presence cache ─────────────────────────────────────────────
  sequenceHasBlueMotion: boolean = true;
  sequenceHasRedMotion: boolean = true;
  private handPresenceCacheKey: string | null = null;

  // Sequence content hash for detecting beat duration changes
  lastSequenceContentHash: string | null = null;

  // Reusable frame params object to avoid GC pressure (created once, mutated each frame)
  private readonly frameParams: RenderFrameParams = {
    stepData: null,
    currentStep: 0,
    trailSettings: DEFAULT_TRAIL_SETTINGS,
    gridVisible: true,
    gridMode: GridMode.DIAMOND,
    letter: null,
    props: {
      blueProp: null,
      redProp: null,
      additionalLayers: [],
      bluePropDimensions: DEFAULT_PROP_DIMENSIONS,
      redPropDimensions: DEFAULT_PROP_DIMENSIONS,
    },
    visibility: {
      gridVisible: true,
      propsVisible: true,
      trailsVisible: true,
      blueMotionVisible: true,
      redMotionVisible: true,
    },
    isPlaying: false,
    bluePropFlipped: false,
    redPropFlipped: false,
    bluePropType: undefined,
    redPropType: undefined,
    fireConfig: null,
    darkMode: false,
    propColors: undefined,
    ledConfig: null,
    zapConfig: null,
    sparklesConfig: null,
    echoConfig: null,
    bloomConfig: null,
    waterConfig: null,
    bubblesConfig: null,
    petalsConfig: null,
    smokeConfig: null,
    inkConfig: null,
    frostConfig: null,
    silkConfig: null,
    pulseConfig: null,
    isSeamlesslyLoopable: false,
    sequenceContentHash: undefined,
    tipEffectMap: {},
  };

  /**
   * Get frame params by mutating reusable object (avoids 180 allocations/sec GC pressure)
   */
  getFrameParams(
    props: AnimationEngineProps,
    state: AnimatorState,
    deps: {
      prevDarkMode: boolean;
      prevHasFireTips: boolean;
      prevHasCharcoalTips: boolean;
      trailsSuppressedUntilTextureLoad: boolean;
      effectsConfigState: EffectsConfigState | null;
      settingsService: SettingsState | null;
      effectRendererManager: EffectRendererManager;
      getVM: () => AnimationVisibilityStateManager;
      orchestrator: SequenceAnimationOrchestrator | null;
    }
  ): RenderFrameParams {
    const {
      prevDarkMode,
      prevHasFireTips,
      prevHasCharcoalTips,
      trailsSuppressedUntilTextureLoad,
      effectsConfigState,
      settingsService,
      effectRendererManager: erm,
      getVM,
      orchestrator, // eslint-disable-line @typescript-eslint/no-unused-vars
    } = deps;

    // Mutate the reusable object instead of creating new ones each frame
    const fp = this.frameParams;
    fp.stepData = props.stepData ?? null;
    fp.currentStep = props.currentStep ?? 0;
    fp.virtualTime = props.virtualTime;
    fp.trailSettings = this.getEffectiveTrailSettings(state, trailsSuppressedUntilTextureLoad);
    fp.gridVisible = props.gridVisible ?? true;
    fp.gridMode = props.gridMode ?? GridMode.DIAMOND;
    fp.letter = props.letter ?? null;

    // Mutate nested props object
    fp.props.blueProp = props.blueProp;
    fp.props.redProp = props.redProp;

    // For single-hand sequences (e.g., during assembly), null out the missing
    // hand's prop so the renderer skips drawing it entirely.
    this.updateHandPresenceCache(props.sequenceData ?? null);
    if (!this.sequenceHasBlueMotion) fp.props.blueProp = null;
    if (!this.sequenceHasRedMotion) fp.props.redProp = null;
    fp.props.additionalLayers = props.additionalLayers ?? [];
    fp.props.bluePropDimensions = state.bluePropDimensions;
    fp.props.redPropDimensions = state.redPropDimensions;

    // Mutate nested visibility object
    fp.visibility.gridVisible = state.visibilityState.grid;
    fp.visibility.propsVisible = state.visibilityState.props;
    fp.visibility.trailsVisible = state.visibilityState.trails;
    fp.visibility.blueMotionVisible = state.blueMotionVisible;
    fp.visibility.redMotionVisible = state.redMotionVisible;

    // Set isPlaying to control render loop continuation
    fp.isPlaying = props.isPlaying ?? false;

    // Get flip settings from settings service
    // - Buugeng family: user preference (asymmetric props)
    // - Hand: red hand always flipped (left/right hands are anatomically mirrored)
    const settings = settingsService?.currentSettings;
    const buugengFamily = ["buugeng", "bigbuugeng", "fractalgeng"];
    const bluePropType = state.currentBluePropType.toLowerCase();
    const redPropType = state.currentRedPropType.toLowerCase();

    // Blue prop: Buugeng family uses user preference, hand is never flipped (it's the left hand)
    fp.bluePropFlipped = buugengFamily.includes(bluePropType)
      ? (settings?.blueBuugengFlipped ?? false)
      : false;

    // Red prop: Hand is always flipped (right hand mirror), Buugeng uses user preference
    fp.redPropFlipped =
      redPropType === "hand"
        ? true
        : buugengFamily.includes(redPropType)
          ? (settings?.redBuugengFlipped ?? false)
          : false;

    // Pass prop types for prop-specific rendering rules (e.g., hands never rotate)
    fp.bluePropType = bluePropType;
    fp.redPropType = redPropType;

    // Fire/charcoal overlay config - pass when either effect is active
    fp.fireConfig = (prevHasFireTips || prevHasCharcoalTips) ? erm.fireConfig : null;
    fp.darkMode = prevDarkMode;
    // Prop colors for colored flames - read from EffectsConfigState, else default blue/red
    fp.propColors = effectsConfigState?.fire.propColors ?? DEFAULT_PROP_FLAME_COLORS;

    // LED overlay config
    fp.ledConfig = erm.ledConfig.enabled ? erm.ledConfig : null;

    // Zap (lightning) overlay config - re-resolve when the shared
    // EffectsConfigState reports a changed ZapIntent. JSON diff mirrors the
    // prevCharcoalParamsJson pattern: cheap to compare, zero alloc when stable,
    // one re-resolve per slider tick when the user is actively tweaking.
    if (effectsConfigState) {
      const intent = effectsConfigState.zap;
      const intentJson = JSON.stringify(intent);
      if (intentJson !== this.prevZapIntentJson) {
        this.prevZapIntentJson = intentJson;
        this.zapConfig = resolveZap2D(intent);
      }
    }
    fp.zapConfig = erm.prevHasZapTips ? this.zapConfig : null;

    // Sparkles overlay config - re-resolve when SparklesIntent changes via
    // reference identity (Phase 1b pattern; cheaper than JSON diff and safe
    // because EffectsConfigState assigns a fresh object on every updateSparkles).
    if (effectsConfigState) {
      const intent = effectsConfigState.sparkles;
      if (intent !== this.prevSparklesIntentRef) {
        this.prevSparklesIntentRef = intent;
        this.sparklesConfig = resolveSparkles2D(intent);
      }
    }
    fp.sparklesConfig = erm.prevHasSparklesTips ? this.sparklesConfig : null;

    // Echo overlay config - re-resolve when EchoIntent changes via
    // reference identity (mirrors sparkles; cheap and EffectsConfigState
    // assigns a fresh object on every updateEcho).
    if (effectsConfigState) {
      const intent = effectsConfigState.echo;
      if (intent !== this.prevEchoIntentRef) {
        this.prevEchoIntentRef = intent;
        this.echoConfig = resolveEcho2D(intent);
      }
    }
    fp.echoConfig = erm.prevHasEchoTips ? this.echoConfig : null;

    // Bloom overlay config - re-resolve when BloomIntent changes via
    // reference identity (mirrors echo/sparkles; EffectsConfigState
    // assigns a fresh object on every updateBloom).
    if (effectsConfigState) {
      const intent = effectsConfigState.bloom;
      if (intent !== this.prevBloomIntentRef) {
        this.prevBloomIntentRef = intent;
        this.bloomConfig = resolveBloom2D(intent);
      }
    }
    fp.bloomConfig = erm.prevHasBloomTips ? this.bloomConfig : null;

    // Water overlay config - re-resolve when WaterIntent changes via
    // reference identity (same pattern as bloom/echo/sparkles).
    if (effectsConfigState) {
      const intent = effectsConfigState.water;
      if (intent !== this.prevWaterIntentRef) {
        this.prevWaterIntentRef = intent;
        this.waterConfig = resolveWater2D(intent);
      }
    }
    fp.waterConfig = erm.prevHasWaterTips ? this.waterConfig : null;

    // Bubbles overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.bubbles;
      if (intent !== this.prevBubblesIntentRef) {
        this.prevBubblesIntentRef = intent;
        this.bubblesConfig = resolveBubbles2D(intent);
      }
    }
    fp.bubblesConfig = erm.prevHasBubblesTips ? this.bubblesConfig : null;

    // Petals overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.petals;
      if (intent !== this.prevPetalsIntentRef) {
        this.prevPetalsIntentRef = intent;
        this.petalsConfig = resolvePetals2D(intent);
      }
    }
    fp.petalsConfig = erm.prevHasPetalsTips ? this.petalsConfig : null;

    // Smoke overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.smoke;
      if (intent !== this.prevSmokeIntentRef) {
        this.prevSmokeIntentRef = intent;
        this.smokeConfig = resolveSmoke2D(intent);
      }
    }
    fp.smokeConfig = erm.prevHasSmokeTips ? this.smokeConfig : null;

    // Ink overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.ink;
      if (intent !== this.prevInkIntentRef) {
        this.prevInkIntentRef = intent;
        this.inkConfig = resolveInk2D(intent);
      }
    }
    fp.inkConfig = erm.prevHasInkTips ? this.inkConfig : null;

    // Frost overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.frost;
      if (intent !== this.prevFrostIntentRef) {
        this.prevFrostIntentRef = intent;
        this.frostConfig = resolveFrost2D(intent);
      }
    }
    fp.frostConfig = erm.prevHasFrostTips ? this.frostConfig : null;

    // Silk overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.silk;
      if (intent !== this.prevSilkIntentRef) {
        this.prevSilkIntentRef = intent;
        this.silkConfig = resolveSilk2D(intent);
      }
    }
    fp.silkConfig = erm.prevHasSilkTips ? this.silkConfig : null;

    // Pulse overlay config - same reference-identity diff pattern.
    if (effectsConfigState) {
      const intent = effectsConfigState.pulse;
      if (intent !== this.prevPulseIntentRef) {
        this.prevPulseIntentRef = intent;
        this.pulseConfig = resolvePulse2D(intent);
      }
    }
    fp.pulseConfig = erm.prevHasPulseTips ? this.pulseConfig : null;

    // Per-tip effect assignments for filtering tips by effect type.
    // Cell-level map (from compose grid) takes priority over the global map.
    fp.tipEffectMap = erm.cellTipEffectMap ?? effectsConfigState?.tipEffectMap ?? {};

    // Suppress 2D effect overlays when 3D mode is active
    fp.suppress2DOverlays = state.suppress2DOverlays ?? false;

    // Playback speed for fire cache invalidation
    const vmRef = getVM();
    fp.playbackSpeed = vmRef.getSpeed();

    // Step mode: disable fire frame cache so flames track actual prop positions.
    // The cache records during continuous playback and replays using wall-clock time,
    // which drifts from prop positions during step mode's discrete pauses.
    if (fp.fireConfig) {
      fp.fireConfig.disableFrameCache = vmRef.getPlaybackMode() === "step";
    }

    // Sequence identity for fire cache invalidation (new sequence = invalidate stale fire frames)
    fp.sequenceContentHash = this.lastSequenceContentHash ?? undefined;

    // Seamless loop flag for trail wrap-around.
    // Auto-detect from sequence data when not explicitly provided by parent.
    // Cached per sequence to avoid recomputing on every frame.
    if (props.isSeamlesslyLoopable != null) {
      fp.isSeamlesslyLoopable = props.isSeamlesslyLoopable;
    } else if (props.sequenceData) {
      const hash = this.lastSequenceContentHash;
      if (hash !== this.loopabilityCacheHash) {
        this.cachedIsSeamlesslyLoopable =
          isSeamlesslyLoopable(props.sequenceData);
        this.loopabilityCacheHash = hash;
      }
      fp.isSeamlesslyLoopable = this.cachedIsSeamlesslyLoopable;
    } else {
      fp.isSeamlesslyLoopable = false;
    }

    return fp;
  }

  /**
   * Generate a hash string representing sequence content that affects animation.
   * Includes motion data fingerprint so transforms (rotate, mirror, etc.) trigger re-precomputation.
   */
  getSequenceContentHash(seq: SequenceData): string {
    const stepCount = seq.steps?.length || 0;
    // Build a compact fingerprint of each step's motion data.
    // Transforms change startLocation, endLocation, rotationDirection, orientations -
    // we must detect these changes to re-precompute path caches.
    const motionFingerprint = seq.steps
      ?.map((s) => {
        const b = s.motions?.blue;
        const r = s.motions?.red;
        const bPart = b
          ? `${b.startLocation}${b.endLocation}${b.motionType}${b.rotationDirection}${b.turns}`
          : "_";
        const rPart = r
          ? `${r.startLocation}${r.endLocation}${r.motionType}${r.rotationDirection}${r.turns}`
          : "_";
        return `${bPart}|${rPart}`;
      })
      .join(";") || "";
    return `${seq.id || seq.word || "unknown"}-${stepCount}-${motionFingerprint}`;
  }

  /**
   * Recompute which hands have motion data, cached per sequence identity.
   * For single-hand sequences (assembly in progress), this lets us null out
   * the missing hand's prop so the renderer doesn't draw it.
   */
  updateHandPresenceCache(seq: SequenceData | null): void {
    const steps = seq?.steps;
    const cacheKey = seq ? (seq.id || seq.word || "") + "-" + (steps?.length ?? 0) : null;

    if (cacheKey === this.handPresenceCacheKey) return;
    this.handPresenceCacheKey = cacheKey;

    if (!seq || !steps || steps.length === 0) {
      this.sequenceHasBlueMotion = true;
      this.sequenceHasRedMotion = true;
      return;
    }

    let hasBlue = false;
    let hasRed = false;

    // Check start position
    const startPos = seq.startPosition ?? seq.startingPosition;
    if (startPos?.motions?.blue) hasBlue = true;
    if (startPos?.motions?.red) hasRed = true;

    // Check all steps
    for (const step of steps) {
      if (step.motions?.blue) hasBlue = true;
      if (step.motions?.red) hasRed = true;
      if (hasBlue && hasRed) break;
    }

    this.sequenceHasBlueMotion = hasBlue;
    this.sequenceHasRedMotion = hasRed;
  }

  /**
   * Enforce unilateral prop constraint on trail settings.
   * Unilateral props (fan, club, minihoop, etc.) only have one meaningful
   * endpoint, so BOTH_ENDS must be overridden to RIGHT_END.
   */
  enforceUnilateralConstraint(
    settings: TrailSettings,
    currentBluePropType: string,
    currentRedPropType: string
  ): TrailSettings {
    if (settings.trackingMode !== TrackingMode.BOTH_ENDS) return settings;

    const blueIsBilateral = isBilateralProp(currentBluePropType);
    const redIsBilateral = isBilateralProp(currentRedPropType);

    // Only allow BOTH_ENDS when at least one prop is bilateral
    if (blueIsBilateral || redIsBilateral) return settings;

    return { ...settings, trackingMode: TrackingMode.RIGHT_END };
  }

  /**
   * Return trail settings with unilateral prop constraint enforced.
   * During prop type changes, trails are suppressed entirely to prevent
   * stale endpoint data from rendering as a visible jump line.
   */
  private getEffectiveTrailSettings(
    state: AnimatorState,
    trailsSuppressedUntilTextureLoad: boolean
  ): TrailSettings {
    const settings = this.enforceUnilateralConstraint(
      state.trailSettings,
      state.currentBluePropType,
      state.currentRedPropType
    );
    if (trailsSuppressedUntilTextureLoad) {
      return { ...settings, mode: TrailMode.OFF };
    }
    return settings;
  }

  /** Reset cached hand presence (called on dispose). */
  resetHandPresenceCache(): void {
    this.handPresenceCacheKey = null;
    this.sequenceHasBlueMotion = true;
    this.sequenceHasRedMotion = true;
  }
}
