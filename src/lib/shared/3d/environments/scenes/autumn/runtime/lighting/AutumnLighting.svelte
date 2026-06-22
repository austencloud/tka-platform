<script lang="ts">
  /**
   * AutumnLighting
   *
   * Warm/cool dusk split rig for the Enchanted Autumn Dusk scene.
   *
   * Three lights work together to sell the "golden hour" atmosphere:
   *   1. Warm sun   — low-angle DirectionalLight from one side, raking
   *                   the scene in amber-gold. Casts shadows when
   *                   quality.shadows is true.
   *   2. Cool fill  — opposing DirectionalLight from the shadow side,
   *                   tinting unlit surfaces in muted slate-blue.
   *   3. Hemisphere — dusk sky dome: deep violet-mauve sky, near-black
   *                   earthy ground, wrapping the scene in twilight.
   *
   * Purely declarative — no useTask, no $state, no $effect.
   */

  import { T } from "@threlte/core";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
  }

  let { quality, groundY = 0 }: Props = $props();
</script>

<!-- Warm low sun: amber-gold, raking from the right-forward side at a low
     elevation (y=6) so it casts long dramatic shadows across the scene. -->
<T.DirectionalLight
  color="#ffb060"
  intensity={2.2}
  position.x={14}
  position.y={6}
  position.z={8}
  castShadow={quality.shadows}
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.camera.near={0.5}
  shadow.camera.far={60}
  shadow.camera.left={-20}
  shadow.camera.right={20}
  shadow.camera.top={20}
  shadow.camera.bottom={-20}
/>

<!-- Cool fill: slate-blue from the opposite/shadow side — no shadow cast,
     purely to lift the shadow side off pure black. -->
<T.DirectionalLight
  color="#3a6a8a"
  intensity={0.7}
  position.x={-12}
  position.y={8}
  position.z={-6}
/>

<!-- Dusk hemisphere ambient: deep violet-mauve sky, near-black earthy ground.
     Keeps shadow areas readable without washing out the warm/cool split. -->
<T.HemisphereLight
  color="#4a2a50"
  groundColor="#1a0f14"
  intensity={0.6}
/>
