<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface LanternDef {
    x: number;
    z: number;
    height: number;
    scale: number;
  }

  interface Props {
    lanterns?: LanternDef[];
    bodyColor?: string;
    glowColor?: string;
    lightIntensity?: number;
    lightDistance?: number;
  }

  let {
    lanterns = [
      { x: -1.5, z: 2.0, height: 2.8, scale: 0.9 },
      { x: 0.5, z: 3.5, height: 3.0, scale: 1.0 },
      { x: 2.5, z: 2.0, height: 2.7, scale: 0.85 },
      { x: -2.5, z: -1.5, height: 2.9, scale: 0.95 },
      { x: 1.0, z: -3.0, height: 3.1, scale: 0.9 },
      { x: 3.5, z: -1.0, height: 2.6, scale: 0.8 },
    ],
    bodyColor = "#cc4444",
    glowColor = "#ffaa44",
    lightIntensity = 6,
    lightDistance = 5,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);
</script>

{#each lanterns as lantern}
  <T.Group
    position.x={lantern.x}
    position.y={groundY + lantern.height}
    position.z={lantern.z}
    scale={[lantern.scale, lantern.scale, lantern.scale]}
  >
    <!-- Cord -->
    <T.Mesh position.y={0.2}>
      <T.CylinderGeometry args={[0.005, 0.005, 0.4, 4]} />
      <T.MeshStandardMaterial color="#222222" roughness={1} />
    </T.Mesh>

    <!-- Top cap -->
    <T.Mesh position.y={0.02}>
      <T.CylinderGeometry args={[0.04, 0.06, 0.04, 8]} />
      <T.MeshStandardMaterial color="#333333" roughness={0.9} metalness={0.3} />
    </T.Mesh>

    <!-- Paper body — emissive for warm glow -->
    <T.Mesh position.y={-0.12}>
      <T.CylinderGeometry args={[0.12, 0.1, 0.24, 8]} />
      <T.MeshStandardMaterial
        color={bodyColor}
        emissive={glowColor}
        emissiveIntensity={0.8}
        roughness={0.95}
        transparent
        opacity={0.85}
      />
    </T.Mesh>

    <!-- Bottom rim -->
    <T.Mesh position.y={-0.25}>
      <T.CylinderGeometry args={[0.06, 0.04, 0.03, 8]} />
      <T.MeshStandardMaterial color="#333333" roughness={0.9} metalness={0.3} />
    </T.Mesh>

    <!-- Point light inside -->
    <T.PointLight
      position.y={-0.1}
      color={glowColor}
      intensity={lightIntensity}
      distance={lightDistance}
      decay={2.0}
    />
  </T.Group>
{/each}
