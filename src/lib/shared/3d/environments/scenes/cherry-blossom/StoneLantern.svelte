<script lang="ts">
  import { T } from "@threlte/core";
  import { userProportionsState } from "@austencloud/scene-3d";

  interface Props {
    position: { x: number; z: number };
    scale?: number;
    lightColor?: string;
    lightIntensity?: number;
    lightDistance?: number;
  }

  let {
    position,
    scale = 1.0,
    lightColor = "#ffaa66",
    lightIntensity = 12,
    lightDistance = 8,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const baseH = 0.15;
  const shaftH = 0.8;
  const chamberH = 0.35;
  const roofH = 0.3;

  const stone = "#8a8a7a";
  const stoneDark = "#6a6a5e";
</script>

<T.Group
  position.x={position.x}
  position.y={groundY}
  position.z={position.z}
  scale={[scale, scale, scale]}
>
  <!-- Base -->
  <T.Mesh position.y={baseH / 2}>
    <T.CylinderGeometry args={[0.3, 0.34, baseH, 6]} />
    <T.MeshStandardMaterial color={stone} roughness={0.85} />
  </T.Mesh>

  <!-- Shaft -->
  <T.Mesh position.y={baseH + shaftH / 2}>
    <T.CylinderGeometry args={[0.1, 0.11, shaftH, 6]} />
    <T.MeshStandardMaterial color={stoneDark} roughness={0.9} />
  </T.Mesh>

  <!-- Chamber -->
  <T.Mesh position.y={baseH + shaftH + chamberH / 2}>
    <T.BoxGeometry args={[0.5, chamberH, 0.5]} />
    <T.MeshStandardMaterial color={stone} roughness={0.8} />
  </T.Mesh>

  <!-- Roof -->
  <T.Mesh position.y={baseH + shaftH + chamberH + roofH / 2}>
    <T.ConeGeometry args={[0.4, roofH, 4]} />
    <T.MeshStandardMaterial color={stoneDark} roughness={0.85} />
  </T.Mesh>

  <!-- Finial -->
  <T.Mesh position.y={baseH + shaftH + chamberH + roofH + 0.06}>
    <T.SphereGeometry args={[0.07, 8, 6]} />
    <T.MeshStandardMaterial color={stone} roughness={0.8} />
  </T.Mesh>

  <!-- Warm glow -->
  <T.PointLight
    position.y={baseH + shaftH + chamberH * 0.4}
    color={lightColor}
    intensity={lightIntensity}
    distance={lightDistance}
    decay={1.8}
  />
</T.Group>
