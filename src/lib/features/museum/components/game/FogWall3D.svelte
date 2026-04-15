<script lang="ts">
  import { T } from "@threlte/core";
  import { untrack } from "svelte";
  import { MeshBasicMaterial, DoubleSide, Color } from "three";

  interface Props {
    /** World-space X position of the fog wall center */
    x: number;
    /** World-space Z position of the fog wall center */
    z: number;
    /** Whether the wall is currently blocking */
    active: boolean;
    /** Width of the corridor (tiles * 0.5m) */
    width?: number;
  }

  const { x, z, active, width = 2 }: Props = $props();

  const WALL_HEIGHT = 4.5;
  const fogColor = new Color("#1a1008");

  let currentOpacity = $state(untrack(() => (active ? 0.6 : 0)));

  $effect(() => {
    // Snap to target for now — lerping can be added later via useTask
    currentOpacity = active ? 0.6 : 0;
  });

  const material = new MeshBasicMaterial({
    color: fogColor,
    transparent: true,
    opacity: 0.6,
    side: DoubleSide,
    depthWrite: false,
  });

  $effect(() => {
    material.opacity = currentOpacity;
    material.visible = currentOpacity > 0.01;
  });
</script>

{#if currentOpacity > 0.01}
  <T.Mesh position.x={x} position.y={WALL_HEIGHT / 2} position.z={z} {material}>
    <T.PlaneGeometry args={[width * 0.5, WALL_HEIGHT]} />
  </T.Mesh>
{/if}
