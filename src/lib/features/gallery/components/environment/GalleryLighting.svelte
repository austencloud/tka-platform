<script lang="ts">
  /**
   * GalleryLighting
   *
   * Museum-style lighting with ambient base + spotlights on exhibits.
   */

  import { T } from "@threlte/core";
  import type { Exhibit } from "../../domain/models/Exhibit";
  import {
    AMBIENT_INTENSITY,
    SPOTLIGHT_INTENSITY,
    SPOTLIGHT_ANGLE,
    WALL_HEIGHT,
    FRAME_CENTER_Y,
  } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Exhibits to illuminate with spotlights */
    exhibits: readonly Exhibit[];
    /** Ambient light intensity */
    ambientIntensity?: number;
    /** Spotlight intensity */
    spotlightIntensity?: number;
  }

  let {
    exhibits,
    ambientIntensity = AMBIENT_INTENSITY,
    spotlightIntensity = SPOTLIGHT_INTENSITY,
  }: Props = $props();

  // Spotlight is positioned above the frame, pointing down at it
  const spotlightY = WALL_HEIGHT - 50;
  const spotlightTargetY = FRAME_CENTER_Y;
</script>

<!-- Ambient light for base illumination -->
<T.AmbientLight intensity={ambientIntensity} color="#ffffff" />

<!-- Main directional light (soft overhead) -->
<T.DirectionalLight
  position={[0, WALL_HEIGHT, 0]}
  intensity={0.4}
  color="#ffffff"
  castShadow
/>

<!-- Spotlights on each exhibit -->
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
    penumbra={0.5}
    color="#fffaf0"
    castShadow
  />
{/each}
