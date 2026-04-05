<script lang="ts">
  /**
   * Central coordinator that reads TipEffectMap assignments and routes each
   * prop tip to the correct 3D renderer. Sits between the animation system
   * (which provides PropState3D per frame) and the visual effect components
   * (Trail3D, and eventually Fire3D, LED3D, etc.).
   *
   * Each frame it:
   *   1. Feeds prop states through TipPositionBridge3D to get world-space tip positions
   *   2. Resolves which effect each tip is assigned via resolveEffect()
   *   3. Passes tip positions to the appropriate renderer components
   */

  import { useThrelte, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import { Vector3, Color, Group } from "three";
  import { container } from "$lib/shared/di";
  import Trail3D from "./trails/Trail3D.svelte";
  import { LedRenderer3D, type LedTipInput } from "./led/LedRenderer3D";
  import { CharcoalRenderer3D, type CharcoalTipInput } from "./charcoal/CharcoalRenderer3D";
  import { FireRenderer3D, type FireTipInput } from "./fire/FireRenderer3D";
  import { DynamicLightManager, type LightHandle } from "./lighting/DynamicLightManager";
  import { TipPositionBridge3D } from "./TipPositionBridge3D";
  import {
    resolveEffect,
    type TipEffectMap,
    type EffectType,
  } from "$lib/shared/animation-engine/domain/types/TipEffectTypes";
  import { TIER_CONFIGS, type QualityTierConfig } from "./types";
  import type { PropState3D } from "../domain/models/PropState3D";

  interface TipDatum {
    position: Vector3 | null;
    effect: EffectType;
  }

  // Default LED colors per prop (blue/red) — used when no pattern engine config
  const LED_BLUE_COLOR = { r: 0.23, g: 0.51, b: 0.96 }; // #3b82f6
  const LED_RED_COLOR = { r: 0.94, g: 0.27, b: 0.27 }; // #ef4444

  interface Props {
    bluePropState: PropState3D | null;
    redPropState: PropState3D | null;
    isPlaying: boolean;
    staffHalfLength?: number;
    tipEffectMap?: TipEffectMap;
    globalTipEffectMap?: TipEffectMap;
    bluePropAnchorRef?: Group;
    redPropAnchorRef?: Group;
    trailConfig?: {
      color?: string;
      width?: number;
      opacity?: number;
      maxPoints?: number;
      rainbow?: boolean;
    };
  }

  let {
    bluePropState,
    redPropState,
    isPlaying,
    staffHalfLength = 0.5,
    tipEffectMap,
    globalTipEffectMap = {},
    bluePropAnchorRef,
    redPropAnchorRef,
    trailConfig = {},
  }: Props = $props();

  const { scene, camera } = useThrelte();
  const qualityTierDetector = container.items.qualityTierDetector;
  const tipBridge = new TipPositionBridge3D();

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


  // Reactive so it responds to runtime tier changes (e.g. user override or
  // auto-downgrade after frame budget miss).
  const tierConfig: QualityTierConfig = $derived(
    TIER_CONFIGS[qualityTierDetector.currentTier],
  );

  // Threlte's scene.current is only available inside reactive contexts ($effect),
  // NOT inside useTask imperative callbacks. Capture the reference here so
  // useTask can use it for LED renderer initialization.
  let sceneRef: import("three").Scene | null = null;

  // Scene-scoped light pool. Deferred until scene.current is available
  // (Threlte's scene ref may not be populated at component construction time).
  let lightManager = $state<DynamicLightManager | null>(null);

  $effect(() => {
    const s = scene.current;
    const cfg = tierConfig;
    if (!s) return;

    sceneRef = s;

    // Dispose previous manager if it exists
    if (lightManager) {
      lightManager.dispose();
    }
    lightManager = new DynamicLightManager(s, cfg);
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
      charcoalRenderer?.reset();
      fireRenderer?.reset();
      return;
    }

    const dt = 1 / 60;
    blueLedTips.length = 0;
    redLedTips.length = 0;
    charcoalTips.length = 0;
    fireTips.length = 0;

    // Note: in the 3D viewer, bluePropState visually corresponds to the red-colored
    // prop and vice versa (the naming follows the avatar's perspective, not the viewer's).
    // Swap so trail colors match the visible prop colors.
    if (redPropState) {
      const result = tipBridge.update(0, redPropState, staffHalfLength, dt, bluePropAnchorRef);
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
            r: LED_BLUE_COLOR.r,
            g: LED_BLUE_COLOR.g,
            b: LED_BLUE_COLOR.b,
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

    if (bluePropState) {
      const result = tipBridge.update(1, bluePropState, staffHalfLength, dt, redPropAnchorRef);
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
            r: LED_RED_COLOR.r,
            g: LED_RED_COLOR.g,
            b: LED_RED_COLOR.b,
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
    // scene.current is NOT available inside useTask in this Threlte version.
    // Get the scene from the camera's parent chain instead.
    const cam = camera.current;
    if (cam) {
      // Walk up to the root Scene object
      let root = cam.parent;
      while (root?.parent) root = root.parent;

      if (root) {
        // Capture scene ref for cleanup
        if (!sceneRef) sceneRef = root as import("three").Scene;

        // Initialize LED renderers lazily
        if (!blueLedRenderer) {
          blueLedRenderer = new LedRenderer3D(qualityTierDetector.currentTier);
          blueLedRenderer.initialize(root as import("three").Scene);
        }
        if (!redLedRenderer) {
          redLedRenderer = new LedRenderer3D(qualityTierDetector.currentTier);
          redLedRenderer.initialize(root as import("three").Scene);
        }
        const now = performance.now() / 1000;

        // Update blue LED renderer
        if (blueLedTips.length > 0) {
          blueLedRenderer.update(blueLedTips, cam, now);
        } else {
          blueLedRenderer.reset();
        }

        // Update red LED renderer
        if (redLedTips.length > 0) {
          redLedRenderer.update(redLedTips, cam, now);
        } else {
          redLedRenderer.reset();
        }

        // Charcoal renderer (single pool for all tips)
        if (!charcoalRenderer) {
          charcoalRenderer = new CharcoalRenderer3D(qualityTierDetector.currentTier);
          charcoalRenderer.initialize(root as import("three").Scene);
        }

        if (charcoalTips.length > 0) {
          charcoalRenderer.update(charcoalTips, dt);
        } else {
          charcoalRenderer.reset();
        }

        // Fire renderer
        if (!fireRenderer) {
          fireRenderer = new FireRenderer3D(qualityTierDetector.currentTier);
          fireRenderer.initialize(root as import("three").Scene);
        }

        if (fireTips.length > 0) {
          fireRenderer.update(fireTips, dt);
        } else {
          fireRenderer.reset();
        }
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
    charcoalRenderer?.dispose();
    fireRenderer?.dispose();
  });
</script>

{#each blueTrailTips as tip, i (i)}
  <Trail3D
    tipPosition={tip.position}
    color={trailConfig.color ?? "#3b82f6"}
    propId="blue"
    width={trailConfig.width}
    opacity={trailConfig.opacity}
    maxPoints={trailConfig.maxPoints}
    rainbow={trailConfig.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    {lightManager}
  />
{/each}

{#each redTrailTips as tip, i (i)}
  <Trail3D
    tipPosition={tip.position}
    color={trailConfig.color ?? "#ef4444"}
    propId="red"
    width={trailConfig.width}
    opacity={trailConfig.opacity}
    maxPoints={trailConfig.maxPoints}
    rainbow={trailConfig.rainbow}
    enabled={isPlaying}
    qualityTier={qualityTierDetector.currentTier}
    {lightManager}
  />
{/each}

<!-- LED effects are managed imperatively by the orchestrator's useTask
     (LedRenderer3D instances added directly to the Three.js scene).
     This bypasses Svelte's batched prop propagation so LED data flows
     in the same frame tick as the tip position computation. -->
