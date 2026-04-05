<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { Vector3, Color } from "three";
  import { onDestroy } from "svelte";
  import { TrailRenderer3D } from "./TrailRenderer3D";
  import type { TrailMode } from "./TrailRenderer3D";
  import type { DynamicLightManager, LightHandle } from "../lighting/DynamicLightManager";
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
  }: Props = $props();

  const { camera } = useThrelte();

  const renderer = new TrailRenderer3D({
    maxPoints,
    subdivisions: 4,
    width,
    color,
    opacity,
    rainbow,
    qualityTier,
    mode,
    fadeDuration,
  });

  let lightHandle: LightHandle | null = null;
  const lightColor = new Color(color === "rainbow" ? "#ffffff" : color);

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
