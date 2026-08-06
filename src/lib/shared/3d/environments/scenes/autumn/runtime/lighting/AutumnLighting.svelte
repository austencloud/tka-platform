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
  color="#ff8748"
  intensity={1.42}
  position.x={14}
  position.y={10}
  position.z={8}
  castShadow={quality.shadows}
  shadow.mapSize.width={1024}
  shadow.mapSize.height={1024}
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
  color="#7d8fce"
  intensity={1.16}
  position.x={-12}
  position.y={12}
  position.z={-6}
/>

<!-- Dusk hemisphere ambient keeps bark, distant silhouettes, and understory
     readable on ordinary displays while the directional pair preserves the
     warm/cool night split. -->
<T.HemisphereLight color="#89669b" groundColor="#49302b" intensity={0.92} />

<!-- A restrained ambient lift preserves the scanned bark and floor detail
     after tone mapping without flattening the warm/cool directional split. -->
<T.AmbientLight color="#d3a8bb" intensity={0.46} />

<!-- A local violet reflection source gives the recessed pond and its wet
     stones a readable cool edge without raising the whole forest floor. -->
<T.PointLight
  color="#8170c5"
  intensity={2.2}
  distance={15}
  decay={2}
  position.x={-10.5}
  position.y={3.2 + groundY}
  position.z={7}
/>
