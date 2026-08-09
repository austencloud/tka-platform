<script lang="ts">
  /**
   * AutumnLighting
   *
   * Moonlit dusk rig for the Enchanted Autumn Dusk scene.
   *
   * The key light and the moon billboard now share one direction. Before this
   * pass the warm key raked in from (14, 10, 8) while the moon hung at
   * (-6, 26, -56), so the brightest object in the sky lit nothing and read as a
   * sticker. Everything below is built around that single agreement:
   *
   *   1. Moon key   — cool DirectionalLight from AUTUMN_MOON_DIRECTION. This is
   *                   the only shadow caster, so contact shadows fall away from
   *                   the moon exactly as a viewer expects.
   *   2. Warm ember — low amber DirectionalLight from the opposite horizon,
   *                   the last of the sunset. Shapes the trunks, casts nothing.
   *   3. Hemisphere — dusk sky dome: violet-mauve above, near-black earth below.
   *   4. Ambient    — a restrained lift so bark and floor survive tone mapping.
   *   5. Pond point — local violet bounce for the recessed pond and wet stones.
   *
   * Purely declarative — no useTask, no $state, no $effect.
   */

  import { T } from "@threlte/core";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";
  import { AUTUMN_MOON_DIRECTION } from "./autumn-moon";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
  }

  let { quality, groundY = 0 }: Props = $props();

  // The light is placed along the moon's direction, far enough out that its
  // orthographic shadow frustum comfortably clears the canopy.
  const MOON_LIGHT_DISTANCE = 42;
  const moonLength = Math.hypot(...AUTUMN_MOON_DIRECTION);
  const moonKey = AUTUMN_MOON_DIRECTION.map(
    (component) => (component / moonLength) * MOON_LIGHT_DISTANCE
  ) as [number, number, number];
</script>

<!-- Moon key: cool, from the moon's own direction, and the scene's only shadow
     caster. The camera spans ±20 rather than the clearing alone: hero trees
     stand 13-20m out and throw shadows ~1.7x their height, so a clearing-tight
     box clipped them mid-shadow and left a visible straight edge across the
     ground. Texel density is bought back with a 2048 map on the high tier. -->
<T.DirectionalLight
  color="#b9c6f2"
  intensity={1.85}
  position.x={moonKey[0]}
  position.y={moonKey[1] + groundY}
  position.z={moonKey[2]}
  castShadow={quality.shadows}
  shadow.mapSize.width={quality.shadowMapSize}
  shadow.mapSize.height={quality.shadowMapSize}
  shadow.camera.near={1}
  shadow.camera.far={110}
  shadow.camera.left={-20}
  shadow.camera.right={20}
  shadow.camera.top={20}
  shadow.camera.bottom={-20}
  shadow.bias={-0.0007}
  shadow.normalBias={0.04}
  shadow.radius={3}
  shadow.intensity={0.58}
/>

<!-- Warm ember light from the opposite horizon: the last of the sunset behind
     the camera. It keeps the amber identity of the scene and models the trunks
     the moon key leaves dark, but it casts nothing so there is exactly one
     shadow direction to read. -->
<T.DirectionalLight
  color="#ff8748"
  intensity={1.05}
  position.x={14}
  position.y={7}
  position.z={16}
/>

<!-- Shadow fill. Shadowed ground was reading as ink-black pools because the
     only thing lighting a shadowed pixel was the hemisphere term. This is a
     dim, wide, non-casting bounce from roughly the camera's side, standing in
     for light scattered back off the clearing floor. It is what turns a hard
     shadow into a shaded area. -->
<T.DirectionalLight
  color="#6f6396"
  intensity={0.5}
  position.x={-8}
  position.y={5}
  position.z={26}
/>

<!-- Dusk hemisphere ambient keeps bark, distant silhouettes, and understory
     readable on ordinary displays. -->
<T.HemisphereLight color="#8a6ba0" groundColor="#462e28" intensity={0.92} />

<!-- A restrained ambient lift preserves scanned bark and floor detail after
     tone mapping without flattening the moon/ember split. -->
<T.AmbientLight color="#c2a2c0" intensity={0.46} />

<!-- A local violet reflection source gives the recessed pond and its wet
     stones a readable cool edge without raising the whole forest floor. -->
<!-- Dropped from 2.2: at that strength it lit the pond's stone bank at a
     grazing angle and produced a hot pale rim around the water. -->
<T.PointLight
  color="#8170c5"
  intensity={1.25}
  distance={16}
  decay={2}
  position.x={-10.5}
  position.y={4.2 + groundY}
  position.z={7}
/>
