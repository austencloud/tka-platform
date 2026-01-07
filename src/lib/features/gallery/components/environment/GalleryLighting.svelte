<script lang="ts">
  /**
   * GalleryLighting
   *
   * Bright museum lighting - walls, floor, ceiling always visible.
   * Toggle affects thumbnail mode, not overall visibility.
   */

  import { T } from "@threlte/core";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import {
    SPOTLIGHT_ANGLE,
    WALL_HEIGHT,
    FRAME_CENTER_Y,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Exhibits to illuminate with spotlights */
    exhibits: readonly Exhibit[];
    /** Whether lights are on (affects mood, not visibility) */
    lightsOn?: boolean;
  }

  let { exhibits, lightsOn = true }: Props = $props();

  // ALWAYS bright enough to see everything clearly
  // "Lights off" is more like evening mood, not pitch black
  const ambientIntensity = $derived(lightsOn ? 1.2 : 0.8);
  const spotlightIntensity = $derived(lightsOn ? 2.5 : 1.5);
  const fillIntensity = $derived(lightsOn ? 1.0 : 0.6);
  const backFillIntensity = $derived(lightsOn ? 0.7 : 0.4);

  // Spotlight is positioned above the frame, pointing down at it
  const spotlightY = WALL_HEIGHT - 50;
  const spotlightTargetY = FRAME_CENTER_Y;
</script>

<!-- Warm ambient light for base illumination -->
<T.AmbientLight intensity={ambientIntensity} color="#fff8f0" />

<!-- Strong overhead fill light (dramatic but visible) -->
<T.DirectionalLight
  position={[0, WALL_HEIGHT, 500]}
  intensity={fillIntensity}
  color="#fffaf5"
/>

<!-- Secondary fill from behind -->
<T.DirectionalLight
  position={[0, WALL_HEIGHT * 0.7, -200]}
  intensity={backFillIntensity}
  color="#ffeedd"
/>

<!-- Spotlights on each exhibit (warm white for art visibility) -->
<!-- Note: castShadow disabled for spotlights - each shadow-casting light uses
     texture units for shadow maps. With many exhibits, this exceeds the typical
     16 texture unit GPU limit, causing the scene to render black. -->
{#each exhibits as exhibit (exhibit.id)}
  {@const slot = exhibit}
  <T.SpotLight
    position={[
      exhibit.avatarPosition.x,
      spotlightY,
      exhibit.avatarPosition.z - 50,
    ]}
    target.position={[
      exhibit.avatarPosition.x,
      spotlightTargetY,
      exhibit.avatarPosition.z,
    ]}
    intensity={spotlightIntensity}
    angle={SPOTLIGHT_ANGLE}
    penumbra={0.6}
    color="#fff5e6"
  />
{/each}
