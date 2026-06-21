<script lang="ts">

import { getQualityTierDetector } from "$lib/shared/3d/effects/quality/get-quality-tier-detector";
  /**
   * Central coordinator that reads TipEffectMap assignments and routes each
   * prop tip to the correct 3D renderer. Sits between the animation system
   * (which provides PropState3D per frame) and the visual effect components
   * (Trail3D, and eventually Fire3D, LED3D, etc.).
   *
   * Renders in rig-local space: receives hand positions and prop states,
   * computes rig-local tip positions via TipPositionBridge3D, and adds
   * imperative meshes to an effectsParentRef (a T.Group inside the rig).
   *
   * Each frame it:
   *   1. Computes rig-local center for each prop (handPos + propState.worldPosition)
   *   2. Feeds prop states through TipPositionBridge3D to get rig-local tip positions
   *   3. Resolves which effect each tip is assigned via resolveEffect()
   *   4. Passes tip positions to the appropriate renderer components
   */

  import { useThrelte, useTask } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import { tryGetViewer3DContext } from "../context/viewer-3d-context";
  import { Vector3, Color, Object3D, Quaternion, Euler } from "three";
  import Trail3D from "./trails/Trail3D.svelte";
  import { LedRenderer3D, type LedTipInput } from "./led/led-renderer-3d";
  import { CharcoalRenderer3D, type CharcoalTipInput } from "./charcoal/charcoal-renderer-3d";
  import { FireRenderer3D, type FireTipInput } from "./fire/fire-renderer-3d";
  import { DynamicLightManager, type LightHandle } from "./lighting/dynamic-light-manager";
  import { TipPositionBridge3D } from "./tip-position-bridge-3d";
  import { PovStripRenderer3D } from "./poi/pov-strip-renderer-3d";
  import type { StripPattern } from "$lib/shared/poi/domain/strip-pattern";
  import {
    resolveEffect,
    type TipEffectMap,
    type EffectType,
  } from "$lib/shared/animation-engine/domain/types/tip-effect-types";
  import { TIER_CONFIGS, type QualityTierConfig } from "./types";
  import type { PropState3D } from "@austencloud/scene-3d";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import {
    resolveTrails3D,
    resolveLed3D,
    resolveFire3D,
  } from "$lib/shared/effects/translators/webgl3d-translator";
  import { evaluatePattern } from "$lib/shared/animation-engine/domain/patterns/evaluator";
  import { createReusableContext } from "$lib/shared/animation-engine/domain/patterns/context";
  import { ledBrightnessToFloat } from "$lib/shared/animation-engine/domain/types/led-types";
  import { PROP_COLORS } from "@austencloud/scene-3d";

  interface TipDatum {
    position: Vector3 | null;
    effect: EffectType;
  }

  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "");
    const bigint = parseInt(clean, 16);
    return {
      r: ((bigint >> 16) & 255) / 255,
      g: ((bigint >> 8) & 255) / 255,
      b: (bigint & 255) / 255,
    };
  }

  interface Props {
    bluePropState: PropState3D | null;
    redPropState: PropState3D | null;
    isPlaying: boolean;
    staffHalfLength?: number;
    tipEffectMap?: TipEffectMap;
    globalTipEffectMap?: TipEffectMap;
    /** Rig-local hand position for blue prop (from PerformerRig HandAnchor). y is always 0. */
    blueHandPos?: { x: number; z: number };
    /** Rig-local hand position for red prop (from PerformerRig HandAnchor). y is always 0. */
    redHandPos?: { x: number; z: number };
    /** Parent Object3D to add imperative meshes to (rig group). Falls back to scene root. */
    effectsParentRef?: Object3D;
    /**
     * @deprecated Ignored - trail parameters now come from EffectsConfigState
     * via context. Left in place so parent components don't break; removed
     * in Phase B when callers migrate.
     */
    trailConfig?: {
      color?: string;
      width?: number;
      opacity?: number;
      maxPoints?: number;
      rainbow?: boolean;
    };
    /** Active strip pattern for POV LED rendering. When set, LED effect uses PovStripRenderer3D instead of LedRenderer3D. */
    activeStripPattern?: StripPattern | null;
    /** POV persistence duration in seconds */
    povPersistenceDuration?: number;
  }

  let {
    bluePropState,
    redPropState,
    isPlaying,
    staffHalfLength = 0.5,
    tipEffectMap,
    globalTipEffectMap = {},
    blueHandPos = { x: 0, z: 0 },
    redHandPos = { x: 0, z: 0 },
    effectsParentRef,
    trailConfig = {},
    activeStripPattern = null,
    povPersistenceDuration = 0.12,
  }: Props = $props();

  const { scene, camera } = useThrelte();
  const qualityTierDetector = getQualityTierDetector();
  const tipBridge = new TipPositionBridge3D();

  // Brighter HDR core on capable tiers so the scene bloom pass makes trails
  // glow (presence). LOW keeps the additive Gaussian halo alone - no bloom
  // there, so over-driving emissive would just clip to white.
  const trailTierBoost = $derived(
    qualityTierDetector.currentTier === "high"
      ? 1.6
      : qualityTierDetector.currentTier === "medium"
        ? 1.3
        : 1.0,
  );

  // Canonical effect config - read from context, or create a default-seeded
  // local state as a fallback so this component still works when mounted
  // outside a viewer that sets the context explicitly.
  const effectsState = getEffectsConfigContext() ?? createEffectsConfigState();

  // LED renderers managed directly (bypasses Svelte prop propagation timing)
  let blueLedRenderer: LedRenderer3D | null = null;
  let redLedRenderer: LedRenderer3D | null = null;

  let blueLedLightHandle: LightHandle | null = null;
  let redLedLightHandle: LightHandle | null = null;
  const ledCentroid = new Vector3();
  const ledColor = new Color();

  // Charcoal renderer (single instance - all tips share one particle pool)
  let charcoalRenderer: CharcoalRenderer3D | null = null;

  // Fire renderer (single instance - all tips share one particle pool)
  let fireRenderer: FireRenderer3D | null = null;

  // POV strip renderers - used when a StripPattern is active
  let bluePovRenderer: PovStripRenderer3D | null = null;
  let redPovRenderer: PovStripRenderer3D | null = null;

  // Reusable vectors for staff axis computation
  const _staffAxis = new Vector3();
  const _staffCenter = new Vector3();

  // Reusable LED pattern evaluation context. Rebuilt fields per-tip per-frame
  // so patterns like rainbow/breathe/sparkle animate in 3D the same way they
  // do in 2D. Without this, patternId was ignored and every LED got painted
  // with the static primaryColor hex.
  const _ledEvalCtx = createReusableContext();
  // Module-monotonic start time so the LED pattern animates continuously
  // across play/pause and across sequence changes - avoids the reset-to-0
  // "flash" you'd get from using raw performance.now() wall-clock seconds.
  const _ledStartMs = performance.now();

  // Previous-frame tip position cache for LED sub-frame supersampling.
  // At 60fps a fast-moving LED covers ~12cm per frame, which looks like
  // a string of widely-spaced dots. Interpolating N points per real frame
  // between prev→current gives an effective 60·N Hz sample rate that
  // reads as a continuous glowing arc, matching how real LEDs look to
  // the human eye (persistence of vision integrates continuous emission).
  // Keyed by `${propIndex}-${tipIndex}`. Cleared on playback reset.
  const _ledPrevPositions = new Map<string, Vector3>();

  // Supersample count per quality tier. Higher = smoother fast motion at
  // the cost of more instances drawn per frame. At HIGH, 4 staff tips × 8
  // supersamples = 32 active LED instances per frame, well within budget.
  const LED_SUPERSAMPLE_BY_TIER: Record<string, number> = {
    high: 8,
    medium: 4,
    low: 1,
  };


  // Reactive so it responds to runtime tier changes (e.g. user override or
  // auto-downgrade after frame budget miss).
  const tierConfig: QualityTierConfig = $derived(
    TIER_CONFIGS[qualityTierDetector.currentTier],
  );

  // Scene-scoped light pool. Deferred until effectsParentRef or scene.current
  // is available.
  let lightManager = $state<DynamicLightManager | null>(null);

  $effect(() => {
    const parent = effectsParentRef ?? scene.current;
    const cfg = tierConfig;
    if (!parent) return;

    // Dispose previous manager if it exists.
    // untrack prevents reading lightManager from re-triggering this effect.
    untrack(() => {
      if (lightManager) {
        lightManager.dispose();
      }
    });
    lightManager = new DynamicLightManager(parent, cfg);
  });

  // Per-tip tracking: each prop has two tips (staff = 2 ends).
  // Updated every frame inside useTask.
  let blueTipData = $state<TipDatum[]>([
    { position: null, effect: "none" },
    { position: null, effect: "none" },
  ]);
  let redTipData = $state<TipDatum[]>([
    { position: null, effect: "none" },
    { position: null, effect: "none" },
  ]);

  // Mutable arrays for effect tips - updated directly in useTask, read by
  // renderers in the SAME frame tick (bypasses Svelte's batched prop updates).
  const blueLedTips: LedTipInput[] = [];
  const redLedTips: LedTipInput[] = [];
  const charcoalTips: CharcoalTipInput[] = [];
  const fireTips: FireTipInput[] = [];

  // Viewer3D context for offline export gating - null when rendered outside
  // the sequence viewer (museum, realm).
  const _viewer3DCtx = tryGetViewer3DContext();

  /**
   * Core per-frame effect update logic. Extracted from useTask so the
   * offline exporter can call it with a deterministic dt.
   */
  function updateEffectsFrame(delta: number): void {
    if (!isPlaying) {
      tipBridge.reset();
      blueLedRenderer?.reset();
      redLedRenderer?.reset();
      bluePovRenderer?.reset();
      redPovRenderer?.reset();
      charcoalRenderer?.reset();
      fireRenderer?.reset();
      // Drop the LED prev-position cache so resume/scrub doesn't draw an
      // 8-sample bridge from the stale pre-pause position to the new one.
      _ledPrevPositions.clear();
      return;
    }

    const resolvedLed = resolveLed3D(effectsState.led);
    // Pattern evaluator needs both colors in normalized LedColor form - it
    // decides internally whether to interpolate between them or ignore them
    // entirely (e.g. rainbow ignores both).
    //
    // "prop-matched" mode is a contract: the blue prop shows canonical blue,
    // the red prop shows canonical red, regardless of what primaryColor/
    // secondaryColor currently are. The 2D side enforces this by hardcoding
    // in resolveHandColor(); we do the same here so switching *from* a
    // single-color preset (green glow) *to* prop-matched doesn't leak the
    // old primary color onto the blue prop. Colors match PROP_COLORS so the
    // LEDs visually line up with the rendered prop material exactly.
    let blueBaseColor: { r: number; g: number; b: number };
    let redBaseColor: { r: number; g: number; b: number };
    if (resolvedLed.colorMode === "prop-matched") {
      blueBaseColor = hexToRgb(PROP_COLORS.blue.main);
      redBaseColor = hexToRgb(PROP_COLORS.red.main);
    } else if (resolvedLed.colorMode === "per-hand") {
      blueBaseColor = hexToRgb(resolvedLed.primaryColor);
      redBaseColor = hexToRgb(resolvedLed.secondaryColor);
    } else {
      // unified: both props use the same primary color
      blueBaseColor = hexToRgb(resolvedLed.primaryColor);
      redBaseColor = hexToRgb(resolvedLed.primaryColor);
    }
    // Each prop has 2 tips; 2 props total = 4 LEDs for pattern indexing.
    const TOTAL_LEDS = 4;
    const ledTimeSeconds = (performance.now() - _ledStartMs) / 1000;
    // Brightness is stored as a discrete 1-5 level and needs to be mapped
    // to the 0.2-1.0 alpha multiplier the shader expects. The 2D side
    // calls the same helper so both backends track the slider identically.
    const ledBrightness = ledBrightnessToFloat(resolvedLed.brightness);
    const ledSupersampleCount =
      LED_SUPERSAMPLE_BY_TIER[qualityTierDetector.currentTier] ?? 4;

    /**
     * Push N interpolated LED samples between the previous-frame tip position
     * and the current-frame tip position into the given output array. On the
     * first frame (no prev) we just push a single sample at the current
     * position. All samples share the same pattern-evaluated color and the
     * same velocity, since they all represent points along a single motion
     * arc within a single frame.
     */
    function pushSupersampledLed(
      out: LedTipInput[],
      key: string,
      current: { x: number; y: number; z: number },
      velocity: { x: number; y: number; z: number },
      speed: number,
      r: number,
      g: number,
      b: number,
    ): void {
      const prev = _ledPrevPositions.get(key);
      const N = ledSupersampleCount;
      if (!prev || N <= 1) {
        out.push({
          position: new Vector3(current.x, current.y, current.z),
          r,
          g,
          b,
          brightness: ledBrightness,
          velocityX: velocity.x,
          velocityY: velocity.y,
          velocityZ: velocity.z,
          speed,
        });
      } else {
        // Emit N samples at t = 1/N, 2/N, …, N/N so the final sample is
        // exactly the current position (keeps the leading-edge LED where
        // the physics sim says it should be).
        for (let i = 1; i <= N; i++) {
          const t = i / N;
          const x = prev.x + (current.x - prev.x) * t;
          const y = prev.y + (current.y - prev.y) * t;
          const z = prev.z + (current.z - prev.z) * t;
          out.push({
            position: new Vector3(x, y, z),
            r,
            g,
            b,
            brightness: ledBrightness,
            velocityX: velocity.x,
            velocityY: velocity.y,
            velocityZ: velocity.z,
            speed,
          });
        }
      }
      // Cache current position for next frame's interpolation start point.
      let cached = _ledPrevPositions.get(key);
      if (!cached) {
        cached = new Vector3();
        _ledPrevPositions.set(key, cached);
      }
      cached.set(current.x, current.y, current.z);
    }

    // Use actual frame delta from Threlte's render loop. Clamp to avoid
    // physics explosions after tab-switch or debugger pause (same safeguard
    // as CharcoalRenderer and FireRenderer use internally).
    const dt = Math.min(delta, 1 / 15);
    blueLedTips.length = 0;
    redLedTips.length = 0;
    charcoalTips.length = 0;
    fireTips.length = 0;

    // PerformerRig renders the blue-colored prop using bluePropState at
    // blueHandPos, and the red-colored prop using redPropState at redHandPos.
    // Effects must follow that same mapping or the blue trail ends up on the
    // red prop and vice versa.
    const visualBlueProp = bluePropState;
    const visualRedProp = redPropState;

    // Compute rig-local center for each visual prop.
    const blueRigCenter = visualBlueProp ? {
      x: blueHandPos.x + visualBlueProp.worldPosition.x,
      y: visualBlueProp.worldPosition.y,
      z: blueHandPos.z + visualBlueProp.worldPosition.z,
    } : null;

    const redRigCenter = visualRedProp ? {
      x: redHandPos.x + visualRedProp.worldPosition.x,
      y: visualRedProp.worldPosition.y,
      z: redHandPos.z + visualRedProp.worldPosition.z,
    } : null;

    if (visualBlueProp && blueRigCenter) {
      const result = tipBridge.update(0, visualBlueProp, blueRigCenter, staffHalfLength, dt);
      blueTipData = result.tips.map((tip, tipIndex) => {
        const resolved = resolveEffect(
          0,
          tipIndex,
          tipEffectMap,
          globalTipEffectMap ?? {},
        );
        // "none" renders nothing - no silent fallback to trails. The default
        // effect comes from the resolved tip map, not an invented value here.
        const effect = resolved;

        if (effect === "led") {
          // Run the LED pattern evaluator for this specific tip so
          // patterns like rainbow/breathe/sparkle animate over time
          // and vary across the 4-LED layout. Without this call, the
          // 3D viewer ignored patternId entirely.
          _ledEvalCtx.time = ledTimeSeconds;
          _ledEvalCtx.ledIndex = tipIndex; // 0,1 for blue's two tips
          _ledEvalCtx.totalLeds = TOTAL_LEDS;
          _ledEvalCtx.speed = resolvedLed.patternSpeed;
          _ledEvalCtx.primaryColor = blueBaseColor;
          _ledEvalCtx.secondaryColor = redBaseColor;
          _ledEvalCtx.propIndex = 0;
          _ledEvalCtx.tipIndex = tipIndex;
          _ledEvalCtx.x = tip.position.x;
          _ledEvalCtx.y = tip.position.y;
          _ledEvalCtx.velocityX = tip.velocity.x;
          _ledEvalCtx.velocityY = tip.velocity.y;
          _ledEvalCtx.speedMagnitude = tip.speed;
          const color = evaluatePattern(resolvedLed.patternId, _ledEvalCtx);
          pushSupersampledLed(
            blueLedTips,
            `0-${tipIndex}`,
            tip.position,
            tip.velocity,
            tip.speed,
            color.r,
            color.g,
            color.b,
          );
        } else if (effect === "charcoal") {
          charcoalTips.push({
            position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
            velocityX: tip.velocity.x,
            velocityY: tip.velocity.y,
            velocityZ: tip.velocity.z,
            speed: tip.speed,
            jerk: tip.jerk.x * tip.jerk.x + tip.jerk.y * tip.jerk.y + tip.jerk.z * tip.jerk.z > 0
              ? Math.sqrt(tip.jerk.x * tip.jerk.x + tip.jerk.y * tip.jerk.y + tip.jerk.z * tip.jerk.z)
              : 0,
          });
        } else if (effect === "fire") {
          fireTips.push({
            position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
            velocityX: tip.velocity.x,
            velocityY: tip.velocity.y,
            velocityZ: tip.velocity.z,
            speed: tip.speed,
            jerk: Math.sqrt(
              tip.jerk.x * tip.jerk.x + tip.jerk.y * tip.jerk.y + tip.jerk.z * tip.jerk.z,
            ),
          });
        }

        return {
          position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
          effect,
        };
      });
    }

    if (visualRedProp && redRigCenter) {
      const result = tipBridge.update(1, visualRedProp, redRigCenter, staffHalfLength, dt);
      redTipData = result.tips.map((tip, tipIndex) => {
        const resolved = resolveEffect(
          1,
          tipIndex,
          tipEffectMap,
          globalTipEffectMap ?? {},
        );
        // "none" renders nothing - no silent fallback to trails. The default
        // effect comes from the resolved tip map, not an invented value here.
        const effect = resolved;

        if (effect === "led") {
          // Same pattern evaluator call for red prop's tips. The red prop
          // uses ledIndex 2/3 so the pattern's spatial offset (used by
          // rainbow, chase, wave, etc.) spans the full 4-LED layout.
          _ledEvalCtx.time = ledTimeSeconds;
          _ledEvalCtx.ledIndex = 2 + tipIndex;
          _ledEvalCtx.totalLeds = TOTAL_LEDS;
          _ledEvalCtx.speed = resolvedLed.patternSpeed;
          _ledEvalCtx.primaryColor = redBaseColor;
          _ledEvalCtx.secondaryColor = blueBaseColor;
          _ledEvalCtx.propIndex = 1;
          _ledEvalCtx.tipIndex = tipIndex;
          _ledEvalCtx.x = tip.position.x;
          _ledEvalCtx.y = tip.position.y;
          _ledEvalCtx.velocityX = tip.velocity.x;
          _ledEvalCtx.velocityY = tip.velocity.y;
          _ledEvalCtx.speedMagnitude = tip.speed;
          const color = evaluatePattern(resolvedLed.patternId, _ledEvalCtx);
          pushSupersampledLed(
            redLedTips,
            `1-${tipIndex}`,
            tip.position,
            tip.velocity,
            tip.speed,
            color.r,
            color.g,
            color.b,
          );
        } else if (effect === "charcoal") {
          charcoalTips.push({
            position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
            velocityX: tip.velocity.x,
            velocityY: tip.velocity.y,
            velocityZ: tip.velocity.z,
            speed: tip.speed,
            jerk: tip.jerk.x * tip.jerk.x + tip.jerk.y * tip.jerk.y + tip.jerk.z * tip.jerk.z > 0
              ? Math.sqrt(tip.jerk.x * tip.jerk.x + tip.jerk.y * tip.jerk.y + tip.jerk.z * tip.jerk.z)
              : 0,
          });
        } else if (effect === "fire") {
          fireTips.push({
            position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
            velocityX: tip.velocity.x,
            velocityY: tip.velocity.y,
            velocityZ: tip.velocity.z,
            speed: tip.speed,
            jerk: Math.sqrt(
              tip.jerk.x * tip.jerk.x + tip.jerk.y * tip.jerk.y + tip.jerk.z * tip.jerk.z,
            ),
          });
        }

        return {
          position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
          effect,
        };
      });
    }

    // LED rendering - direct imperative update in the same frame tick.
    // Determine the parent for imperative meshes: effectsParentRef (rig group)
    // or fall back to scene root via camera parent chain.
    const cam = camera.current;
    let imperativeParent: Object3D | null = effectsParentRef ?? null;

    if (!imperativeParent && cam) {
      // Walk up to the root Scene object
      let root = cam.parent;
      while (root?.parent) root = root.parent;
      imperativeParent = root;
    }

    if (imperativeParent) {
      const now = performance.now() / 1000;
      const hasPovPattern = activeStripPattern != null;

      if (hasPovPattern) {
        // POV Strip Mode: full 200-LED strip with persistence-of-vision trails

        // Initialize POV renderers lazily
        if (!bluePovRenderer) {
          bluePovRenderer = new PovStripRenderer3D(qualityTierDetector.currentTier);
          bluePovRenderer.initialize(imperativeParent);
        }
        if (!redPovRenderer) {
          redPovRenderer = new PovStripRenderer3D(qualityTierDetector.currentTier);
          redPovRenderer.initialize(imperativeParent);
        }
        bluePovRenderer.setPersistenceDuration(povPersistenceDuration);
        redPovRenderer.setPersistenceDuration(povPersistenceDuration);

        // Compute staff axis + rotation angle for blue prop
        if (blueLedTips.length > 0 && bluePropState) {
          const rotation = bluePropState.worldRotation;
          const horizontalQuat = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
          const finalQuat = rotation.clone().multiply(horizontalQuat);
          _staffAxis.set(0, 1, 0).applyQuaternion(finalQuat).normalize();

          _staffCenter.copy(bluePropState.worldPosition);

          // Rotation angle: extract from the quaternion's Z-axis rotation
          const euler = new Euler().setFromQuaternion(rotation, "ZYX");
          const rotAngle = euler.z;

          bluePovRenderer.update(
            _staffAxis, _staffCenter, staffHalfLength,
            rotAngle, activeStripPattern!, cam!, now, 1.0,
          );
        } else {
          bluePovRenderer.reset();
        }

        // Compute staff axis + rotation angle for red prop
        if (redLedTips.length > 0 && redPropState) {
          const rotation = redPropState.worldRotation;
          const horizontalQuat = new Quaternion().setFromEuler(new Euler(0, 0, Math.PI / 2));
          const finalQuat = rotation.clone().multiply(horizontalQuat);
          _staffAxis.set(0, 1, 0).applyQuaternion(finalQuat).normalize();

          _staffCenter.copy(redPropState.worldPosition);

          const euler = new Euler().setFromQuaternion(rotation, "ZYX");
          const rotAngle = euler.z;

          redPovRenderer.update(
            _staffAxis, _staffCenter, staffHalfLength,
            rotAngle, activeStripPattern!, cam!, now, 1.0,
          );
        } else {
          redPovRenderer.reset();
        }

        // Suppress legacy LED renderers while POV is active
        blueLedRenderer?.reset();
        redLedRenderer?.reset();
      } else {
        // Legacy 2-point LED mode (unchanged)
        if (!blueLedRenderer) {
          blueLedRenderer = new LedRenderer3D(qualityTierDetector.currentTier);
          blueLedRenderer.initialize(imperativeParent);
        }
        if (!redLedRenderer) {
          redLedRenderer = new LedRenderer3D(qualityTierDetector.currentTier);
          redLedRenderer.initialize(imperativeParent);
        }

        if (blueLedTips.length > 0) {
          blueLedRenderer.update(blueLedTips, cam!, now);
        } else {
          blueLedRenderer.reset();
        }

        if (redLedTips.length > 0) {
          redLedRenderer.update(redLedTips, cam!, now);
        } else {
          redLedRenderer.reset();
        }

        // Suppress POV renderers while legacy mode is active
        bluePovRenderer?.reset();
        redPovRenderer?.reset();
      }

      // Charcoal renderer (single pool for all tips)
      if (!charcoalRenderer) {
        charcoalRenderer = new CharcoalRenderer3D(qualityTierDetector.currentTier);
        charcoalRenderer.initialize(imperativeParent);
      }

      if (charcoalTips.length > 0) {
        charcoalRenderer.update(charcoalTips, dt);
      } else {
        charcoalRenderer.reset();
      }

      // Fire renderer
      if (!fireRenderer) {
        fireRenderer = new FireRenderer3D(qualityTierDetector.currentTier);
        fireRenderer.initialize(imperativeParent);
      }

      if (fireTips.length > 0) {
        // Push the user's curated tuning (intensity/turbulence/brightness)
        // before the physics step. resolveFire3D is a cheap pure spread,
        // matching the per-frame resolveLed3D idiom above.
        fireRenderer.updateConfig(resolveFire3D(effectsState.fire));
        fireRenderer.update(fireTips, dt);
      } else {
        fireRenderer.reset();
      }
    }
  }

  // Register the effect update function on viewer3DState so the offline
  // exporter can call it with deterministic dt each frame.
  $effect(() => {
    if (_viewer3DCtx) {
      _viewer3DCtx.updateEffects = updateEffectsFrame;
      return () => {
        // Only clear if we're still the registered callback
        if (_viewer3DCtx.updateEffects === updateEffectsFrame) {
          _viewer3DCtx.updateEffects = null;
        }
      };
    }
    return;
  });

  // Threlte render-loop: call the extracted update function each frame.
  // During offline export, Threlte is in 'manual' render mode so this
  // only fires when advance() is called - no gating needed.
  useTask((delta) => {
    updateEffectsFrame(delta);
  });

  // Filter to only tips that have the "trails" effect assigned and a valid position.
  const blueTrailTips = $derived(
    blueTipData.filter(
      (t): t is TipDatum & { position: Vector3 } =>
        t.effect === "trails" && t.position !== null,
    ),
  );
  const redTrailTips = $derived(
    redTipData.filter(
      (t): t is TipDatum & { position: Vector3 } =>
        t.effect === "trails" && t.position !== null,
    ),
  );

  onDestroy(() => {
    lightManager?.dispose();
    tipBridge.reset();
    blueLedRenderer?.dispose();
    redLedRenderer?.dispose();
    bluePovRenderer?.dispose();
    redPovRenderer?.dispose();
    charcoalRenderer?.dispose();
    fireRenderer?.dispose();
  });
</script>

{#each blueTrailTips as tip, i (i)}
  {@const resolvedTrails = resolveTrails3D(effectsState.trails)}
  <Trail3D
    tipPosition={tip.position}
    color={resolvedTrails.rainbow ? "rainbow" : resolvedTrails.blueColor}
    propId="blue"
    width={resolvedTrails.tubeRadius}
    opacity={resolvedTrails.brightness}
    maxPoints={resolvedTrails.maxPoints}
    rainbow={resolvedTrails.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    emissiveStrength={resolvedTrails.emissive * trailTierBoost}
    {lightManager}
  />
{/each}

{#each redTrailTips as tip, i (i)}
  {@const resolvedTrails = resolveTrails3D(effectsState.trails)}
  <Trail3D
    tipPosition={tip.position}
    color={resolvedTrails.rainbow ? "rainbow" : resolvedTrails.redColor}
    propId="red"
    width={resolvedTrails.tubeRadius}
    opacity={resolvedTrails.brightness}
    maxPoints={resolvedTrails.maxPoints}
    rainbow={resolvedTrails.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    emissiveStrength={resolvedTrails.emissive * trailTierBoost}
    {lightManager}
  />
{/each}

<!-- LED, charcoal, and fire effects are managed imperatively by the orchestrator's
     useTask - renderer instances add meshes to the effectsParentRef (rig group).
     This bypasses Svelte's batched prop propagation so effect data flows
     in the same frame tick as the tip position computation. -->
