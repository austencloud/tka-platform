<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { Vector3, Color } from "three";
  import { onDestroy, untrack } from "svelte";
  import { TrailRenderer3D } from "./trail-renderer-3d";
  import type { TrailMode } from "./trail-renderer-3d";
  import type { DynamicLightManager, LightHandle } from "../lighting/dynamic-light-manager";
  import type { QualityTier } from "../types";

  interface Props {
    tipPosition: Vector3 | null;
    color: string;
    propId: "blue" | "red";
    width?: number;
    opacity?: number;
    maxPoints?: number;
    rainbow?: boolean;
    enabled?: boolean;
    qualityTier?: QualityTier;
    lightManager?: DynamicLightManager | null;
    mode?: TrailMode;
    fadeDuration?: number;
    /** HDR core multiplier; >1 so scene bloom (HIGH/MED tier) catches the trail. */
    emissiveStrength?: number;
  }

  let {
    tipPosition,
    color,
    propId,
    width = 0.03,
    opacity = 0.85,
    maxPoints = 120,
    rainbow = false,
    enabled = true,
    qualityTier = "medium" as QualityTier,
    lightManager = null,
    mode = "fade" as TrailMode,
    fadeDuration = 2.0,
    emissiveStrength = 2.5,
  }: Props = $props();

  const { camera } = useThrelte();

  // svelte-ignore state_referenced_locally
  const renderer = new TrailRenderer3D({
    // svelte-ignore state_referenced_locally
    maxPoints,
    // svelte-ignore state_referenced_locally
    width,
    // svelte-ignore state_referenced_locally
    color,
    // svelte-ignore state_referenced_locally
    opacity,
    // svelte-ignore state_referenced_locally
    rainbow,
    // svelte-ignore state_referenced_locally
    qualityTier,
    // svelte-ignore state_referenced_locally
    mode,
    // svelte-ignore state_referenced_locally
    fadeDuration,
    // svelte-ignore state_referenced_locally
    emissiveStrength,
  });

  // Push live prop changes (thickness/brightness/color/rainbow from the tuning
  // sliders) into the already-constructed renderer. Without this the renderer
  // keeps its construction-time config and the sliders appear to do nothing.
  $effect(() => {
    renderer.updateConfig({ width, opacity, color, rainbow, emissiveStrength });
  });

  let lightHandle: LightHandle | null = null;
  const lightColor = untrack(() => new Color(color === "rainbow" ? "#ffffff" : color));

  useTask(() => {
    if (!enabled || !tipPosition) {
      if (lightHandle && lightManager) {
        lightManager.releaseLight(lightHandle);
        lightHandle = null;
      }
      return;
    }

    renderer.addPoint(tipPosition);

    const cam = camera.current;
    if (cam) {
      renderer.update(cam.position);
    }

    if (lightManager) {
      if (!lightHandle) {
        lightHandle = lightManager.requestLight(
          tipPosition,
          lightColor,
          0.5,
          3.0
        );
      } else {
        lightManager.updateLight(lightHandle, tipPosition, 0.5);
      }
    }
  });

  onDestroy(() => {
    if (lightHandle && lightManager) {
      lightManager.releaseLight(lightHandle);
    }
    renderer.dispose();
  });
</script>

{#if enabled}
  <T is={renderer.object3D} />
{/if}
