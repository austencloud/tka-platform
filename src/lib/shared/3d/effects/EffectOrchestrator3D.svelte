<script lang="ts">
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
  import { Vector3, Color, Object3D, Quaternion, Euler } from "three";
  import { container } from "$lib/shared/di";
  import Trail3D from "./trails/Trail3D.svelte";
  import { LedRenderer3D, type LedTipInput } from "./led/LedRenderer3D";
  import { CharcoalRenderer3D, type CharcoalTipInput } from "./charcoal/CharcoalRenderer3D";
  import { FireRenderer3D, type FireTipInput } from "./fire/FireRenderer3D";
  import { DynamicLightManager, type LightHandle } from "./lighting/DynamicLightManager";
  import { TipPositionBridge3D } from "./TipPositionBridge3D";
  import { PovStripRenderer3D } from "./poi/PovStripRenderer3D";
  import type { StripPattern } from "$lib/features/poi/domain/StripPattern";
  import {
    resolveEffect,
    type TipEffectMap,
    type EffectType,
  } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import { TIER_CONFIGS, type QualityTierConfig } from "./types";
  import type { PropState3D } from "../domain/models/PropState3D";
  import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
  import { createEffectsConfigState } from "$lib/shared/effects/state/effects-config-state.svelte";
  import {
    resolveTrails3D,
    resolveLed3D,
  } from "$lib/shared/effects/translators/webgl3d-translator";

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
     * @deprecated Ignored — trail parameters now come from EffectsConfigState
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
  const qualityTierDetector = container.items.qualityTierDetector;
  const tipBridge = new TipPositionBridge3D();

  // Canonical effect config — read from context, or create a default-seeded
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

  // Charcoal renderer (single instance — all tips share one particle pool)
  let charcoalRenderer: CharcoalRenderer3D | null = null;

  // Fire renderer (single instance — all tips share one particle pool)
  let fireRenderer: FireRenderer3D | null = null;

  // POV strip renderers — used when a StripPattern is active
  let bluePovRenderer: PovStripRenderer3D | null = null;
  let redPovRenderer: PovStripRenderer3D | null = null;

  // Reusable vectors for staff axis computation
  const _staffAxis = new Vector3();
  const _staffCenter = new Vector3();


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

  // Mutable arrays for effect tips — updated directly in useTask, read by
  // renderers in the SAME frame tick (bypasses Svelte's batched prop updates).
  const blueLedTips: LedTipInput[] = [];
  const redLedTips: LedTipInput[] = [];
  const charcoalTips: CharcoalTipInput[] = [];
  const fireTips: FireTipInput[] = [];

  useTask(() => {
    if (!isPlaying) {
      tipBridge.reset();
      blueLedRenderer?.reset();
      redLedRenderer?.reset();
      bluePovRenderer?.reset();
      redPovRenderer?.reset();
      charcoalRenderer?.reset();
      fireRenderer?.reset();
      return;
    }

    const resolvedLed = resolveLed3D(
      effectsState.led,
      effectsState.overrides?.led3D as Partial<Parameters<typeof resolveLed3D>[1]> | undefined,
    );
    const blueLedRgb = hexToRgb(resolvedLed.primaryColor);
    const redLedRgb = hexToRgb(
      resolvedLed.colorMode === "prop-matched" || resolvedLed.colorMode === "per-hand"
        ? resolvedLed.secondaryColor
        : resolvedLed.primaryColor,
    );

    const dt = 1 / 60;
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
        const effect = resolved === "none" ? "trails" : resolved;

        if (effect === "led") {
          blueLedTips.push({
            position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
            r: blueLedRgb.r,
            g: blueLedRgb.g,
            b: blueLedRgb.b,
            brightness: 1.0,
            velocityX: tip.velocity.x,
            velocityY: tip.velocity.y,
            velocityZ: tip.velocity.z,
            speed: tip.speed,
          });
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
        const effect = resolved === "none" ? "trails" : resolved;

        if (effect === "led") {
          redLedTips.push({
            position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
            r: redLedRgb.r,
            g: redLedRgb.g,
            b: redLedRgb.b,
            brightness: 1.0,
            velocityX: tip.velocity.x,
            velocityY: tip.velocity.y,
            velocityZ: tip.velocity.z,
            speed: tip.speed,
          });
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
          });
        }

        return {
          position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
          effect,
        };
      });
    }

    // LED rendering — direct imperative update in the same frame tick.
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
        fireRenderer.update(fireTips, dt);
      } else {
        fireRenderer.reset();
      }
    }
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
  {@const resolvedTrails = resolveTrails3D(effectsState.trails, effectsState.overrides?.trails3D as Partial<Parameters<typeof resolveTrails3D>[1]> | undefined)}
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
    {lightManager}
  />
{/each}

{#each redTrailTips as tip, i (i)}
  {@const resolvedTrails = resolveTrails3D(effectsState.trails, effectsState.overrides?.trails3D as Partial<Parameters<typeof resolveTrails3D>[1]> | undefined)}
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
    {lightManager}
  />
{/each}

<!-- LED, charcoal, and fire effects are managed imperatively by the orchestrator's
     useTask — renderer instances add meshes to the effectsParentRef (rig group).
     This bypasses Svelte's batched prop propagation so effect data flows
     in the same frame tick as the tip position computation. -->
