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
  import { Vector3 } from "three";
  import { container } from "$lib/shared/di";
  import Trail3D from "./trails/Trail3D.svelte";
  import { DynamicLightManager } from "./lighting/DynamicLightManager";
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

  interface Props {
    bluePropState: PropState3D | null;
    redPropState: PropState3D | null;
    isPlaying: boolean;
    staffHalfLength?: number;
    tipEffectMap?: TipEffectMap;
    globalTipEffectMap?: TipEffectMap;
    avatarPosition?: { x: number; y: number; z: number };
    facingAngle?: number;
    gridOffset?: number;
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
    avatarPosition = { x: 0, y: 0, z: 0 },
    facingAngle = 0,
    gridOffset = 0,
    trailConfig = {},
  }: Props = $props();

  const { scene } = useThrelte();
  const qualityTierDetector = container.items.qualityTierDetector;
  const tipBridge = new TipPositionBridge3D();

  // Reactive so it responds to runtime tier changes (e.g. user override or
  // auto-downgrade after frame budget miss).
  const tierConfig: QualityTierConfig = $derived(
    TIER_CONFIGS[qualityTierDetector.currentTier],
  );

  // Scene-scoped light pool. Deferred until scene.current is available
  // (Threlte's scene ref may not be populated at component construction time).
  let lightManager = $state<DynamicLightManager | null>(null);

  $effect(() => {
    const s = scene.current;
    const cfg = tierConfig;
    if (!s) return;

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

  useTask(() => {
    if (!isPlaying) {
      tipBridge.reset();
      return;
    }

    const dt = 1 / 60;
    const transforms = { avatarPosition, facingAngle, gridOffset };

    if (bluePropState) {
      const result = tipBridge.update(0, bluePropState, staffHalfLength, dt, transforms);
      blueTipData = result.tips.map((tip, tipIndex) => {
        const resolved = resolveEffect(
          0,
          tipIndex,
          tipEffectMap,
          globalTipEffectMap ?? {},
        );
        return {
          position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
          // Default to trails when no effect is explicitly assigned
          effect: resolved === "none" ? "trails" : resolved,
        };
      });
    }

    if (redPropState) {
      const result = tipBridge.update(1, redPropState, staffHalfLength, dt, transforms);
      redTipData = result.tips.map((tip, tipIndex) => {
        const resolved = resolveEffect(
          1,
          tipIndex,
          tipEffectMap,
          globalTipEffectMap ?? {},
        );
        return {
          position: new Vector3(tip.position.x, tip.position.y, tip.position.z),
          effect: resolved === "none" ? "trails" : resolved,
        };
      });
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
