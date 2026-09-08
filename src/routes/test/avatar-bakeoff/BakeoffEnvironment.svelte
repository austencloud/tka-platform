<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { getRoomEnvironmentTexture } from "$lib/shared/3d/rendering/room-environment";
  import type { LightingId } from "./avatar-bakeoff-data";

  interface Props {
    lighting: LightingId;
    /** Scene-level intensity for the room reflection when it is on. */
    intensity?: number;
    onApplied?: (applied: boolean) => void;
  }

  let { lighting, intensity = 0.55, onApplied = () => {} }: Props = $props();

  const { renderer, scene, invalidate } = useThrelte();

  // The production viewer lights performers with an ambient and one key light
  // and never sets scene.environment. Switching the room on and off for the
  // same candidate separates what the character brings from what the rig
  // withholds.
  $effect(() => {
    const currentScene = scene;
    const previousIntensity = currentScene.environmentIntensity;
    if (lighting !== "room") {
      currentScene.environment = null;
      onApplied(false);
      invalidate();
      return;
    }

    const texture = getRoomEnvironmentTexture(renderer);
    currentScene.environment = texture;
    currentScene.environmentIntensity = intensity;
    onApplied(true);
    invalidate();
    return () => {
      if (currentScene.environment === texture) currentScene.environment = null;
      currentScene.environmentIntensity = previousIntensity;
      onApplied(false);
      invalidate();
    };
  });
</script>
