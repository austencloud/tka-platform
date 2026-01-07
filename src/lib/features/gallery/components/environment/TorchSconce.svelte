<script lang="ts">
  /**
   * TorchSconce
   *
   * Wall-mounted torch with fire particle effects and dynamic point light.
   * Creates atmospheric flickering illumination for the gallery.
   */

  import { T, useTask } from "@threlte/core";
  import { Vector3 } from "three";
  import FireEmitter from "$lib/shared/3d-animation/effects/particles/FireEmitter.svelte";
  import { TRIM_COLOR } from "../../domain/constants/gallery-dimensions";

  interface Props {
    /** Position of the sconce (wall mount point) */
    position: { x: number; y: number; z: number };
    /** Rotation around Y axis (radians) - torch faces this direction */
    rotation: number;
    /** Whether the torch is lit */
    enabled?: boolean;
    /** Fire intensity (0-1) */
    intensity?: number;
    /** Bracket/holder color */
    bracketColor?: string;
  }

  let {
    position,
    rotation,
    enabled = true,
    intensity = 0.8,
    bracketColor = TRIM_COLOR,
  }: Props = $props();

  // Torch geometry constants
  const BRACKET_SIZE = 15;
  const TORCH_LENGTH = 40;
  const TORCH_RADIUS = 6;
  const FIRE_OFFSET = 25; // How far fire extends from torch tip

  // Calculate fire emission position (tip of torch)
  const firePosition = $derived.by(() => {
    // Fire emits from the tip of the torch, which extends outward from the wall
    const offsetX = Math.sin(rotation) * (TORCH_LENGTH + FIRE_OFFSET);
    const offsetZ = Math.cos(rotation) * (TORCH_LENGTH + FIRE_OFFSET);
    return new Vector3(
      position.x + offsetX,
      position.y + 10,
      position.z + offsetZ
    );
  });

  // Calculate point light position (slightly above fire)
  const lightPosition = $derived([
    firePosition.x,
    firePosition.y + 30,
    firePosition.z,
  ] as [number, number, number]);

  // Flickering light intensity
  let flickerIntensity = $state(1.0);
  let flickerTime = 0;

  useTask((delta) => {
    if (!enabled) return;
    flickerTime += delta * 8;
    // Combine multiple sine waves for organic flicker
    flickerIntensity =
      0.85 +
      0.1 * Math.sin(flickerTime * 1.3) +
      0.05 * Math.sin(flickerTime * 3.7);
  });

  // Light color and intensity based on fire
  const baseLightIntensity = 150;
  const lightIntensity = $derived(
    enabled ? baseLightIntensity * intensity * flickerIntensity : 0
  );
</script>

<T.Group position={[position.x, position.y, position.z]} rotation.y={rotation}>
  <!-- Wall bracket (decorative mount) -->
  <T.Mesh castShadow receiveShadow>
    <T.BoxGeometry args={[BRACKET_SIZE, BRACKET_SIZE, BRACKET_SIZE / 2]} />
    <T.MeshStandardMaterial
      color={bracketColor}
      roughness={0.4}
      metalness={0.7}
    />
  </T.Mesh>

  <!-- Bracket arm extending from wall -->
  <T.Mesh position={[0, 0, BRACKET_SIZE / 2]} castShadow receiveShadow>
    <T.BoxGeometry args={[BRACKET_SIZE / 3, BRACKET_SIZE / 3, BRACKET_SIZE]} />
    <T.MeshStandardMaterial
      color={bracketColor}
      roughness={0.4}
      metalness={0.7}
    />
  </T.Mesh>

  <!-- Torch holder (cylinder angled upward) -->
  <T.Group position={[0, 5, TORCH_LENGTH / 2]} rotation.x={-0.3}>
    <!-- Torch body (dark wood) -->
    <T.Mesh castShadow>
      <T.CylinderGeometry args={[TORCH_RADIUS, TORCH_RADIUS * 0.8, TORCH_LENGTH, 8]} />
      <T.MeshStandardMaterial color="#2d1810" roughness={0.9} metalness={0} />
    </T.Mesh>

    <!-- Torch head (where fire burns) -->
    <T.Mesh position={[0, TORCH_LENGTH / 2 + 5, 0]} castShadow>
      <T.CylinderGeometry args={[TORCH_RADIUS * 1.2, TORCH_RADIUS, 15, 8]} />
      <T.MeshStandardMaterial color="#1a0f08" roughness={0.95} metalness={0} />
    </T.Mesh>
  </T.Group>
</T.Group>

<!-- Fire particles (positioned at torch tip) -->
{#if enabled}
  <FireEmitter
    position={firePosition}
    {enabled}
    {intensity}
    scale={2.5}
  />
{/if}

<!-- Dynamic point light (warm orange glow) -->
<!-- Note: castShadow disabled - PointLight shadows use cube maps which consume
     multiple texture units per light. With many torches, this exceeds GPU limits
     (typically 16 texture units) causing the scene to go dark. -->
<T.PointLight
  position={lightPosition}
  color="#ff6b35"
  intensity={lightIntensity}
  distance={400}
  decay={2}
/>
