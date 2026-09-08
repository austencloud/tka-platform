<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import { createOceanWaterSurface } from "../../../../worlds/ocean/ocean-water-surface";

  interface Props {
    groundY?: number;
    /**
     * Absolute elevation of the surface. Wins over groundY when given. The
     * ocean scene adds 25 ft to its original deep-water column, which is fine
     * for one authored scene and useless to any caller that knows the
     * waterline it wants — the Water Traverse knows it exactly.
     */
    surfaceY?: number;
    size?: number;
    segments?: number;
    /**
     * Underside look. The defaults are the ocean scene's: a 12%-opacity film
     * with a heavy total-internal-reflection ring, correct when you swim just
     * beneath it in that scene's light. Seen from eighteen metres down a
     * flooded trench the same numbers render as a black lid, so any caller
     * that owns its own depth owns these too.
     */
    opacity?: number;
    color?: string;
    skyColor?: string;
    tirDarkness?: number;
    /**
     * A raw ShaderMaterial gets none of Three's fog chunks, so the surface has
     * to be told the scene's haze itself. Defaults match OceanScene's FogExp2.
     * Without this the plane is the only object in the scene that keeps its
     * colour at distance, and its rim reads as the edge of a lid.
     */
    fogColor?: string;
    fogDensity?: number;
  }

  let {
    groundY = 0,
    surfaceY,
    // Matches the seabed's 220 m extent closely enough that fog eats the rim
    // before the eye reaches it. At 50 the plane's circular edge was legible
    // as a black lid with a curved cut-off, which reads as a ceiling rather
    // than a surface — the boundary failure this scene exists to avoid.
    // Segments stay at 256: at 110 m that is ~6.7 per wavelength, and anything
    // finer only sharpens detail beyond 30 m, where fog has already taken it.
    size = 110,
    segments = 256,
    opacity = 0.12,
    color = "#0d3050",
    skyColor = "#3f7892",
    tirDarkness = 1.0,
    fogColor = "#0a2438",
    fogDensity = 0.026,
  }: Props = $props();

  const { camera } = useThrelte();
  const world = untrack(() =>
    createOceanWaterSurface({
      groundY,
      surfaceY,
      size,
      segments,
      opacity,
      color,
      skyColor,
      tirDarkness,
      fogColor,
      fogDensity,
    })
  );

  $effect(() => {
    world.setFog(fogColor, fogDensity);
  });

  useTask((delta) => {
    const cam = camera.current;
    if (cam) world.update(delta, cam);
  });

  onDestroy(world.dispose);
</script>

<T is={world.object} />
