<script lang="ts">
  /**
   * MotionBlur Component
   *
   * Creates a ghost trail effect during fast prop movement.
   * Renders semi-transparent copies of the prop geometry at previous positions.
   * Uses a ring buffer to track position history.
   */

  import { T } from "@threlte/core";
  import { Vector3 } from "three";

  interface Props {
    /** Current prop position in world space */
    currentPosition: Vector3;
    /** Position from the previous frame */
    previousPosition: Vector3;
    /** Whether the effect is enabled */
    enabled?: boolean;
    /** Effect intensity (0-1), affects opacity */
    intensity?: number;
    /** Minimum velocity to show blur (units per frame) */
    threshold?: number;
    /** Trail color (hex string) */
    color?: string;
    /** Number of ghost copies to render */
    trailCount?: number;
    /** Size of ghost spheres */
    ghostSize?: number;
  }

  let {
    currentPosition,
    previousPosition,
    enabled = true,
    intensity = 0.6,
    threshold = 5,
    color = "#ffffff",
    trailCount = 5,
    ghostSize = 8,
  }: Props = $props();

  // Position history ring buffer
  let positionHistory = $state<Vector3[]>([]);
  // Max history length derived from trailCount prop
  const maxHistoryLength = $derived(trailCount + 1);

  // Calculate velocity (distance between frames)
  const velocity = $derived(currentPosition.distanceTo(previousPosition));

  // Normalize velocity for opacity calculation (cap at 50 units/frame)
  const normalizedVelocity = $derived(Math.min(velocity / 50, 1));

  // Only show blur above threshold
  const isActive = $derived(enabled && velocity > threshold);

  // Base opacity for the effect
  const baseOpacity = $derived(isActive ? normalizedVelocity * intensity : 0);

  // Update position history when position changes
  $effect(() => {
    if (!enabled) {
      positionHistory = [];
      return;
    }

    // Clone current position and add to history
    const newPosition = currentPosition.clone();

    // Create new history array with new position at the start
    const newHistory = [newPosition, ...positionHistory];

    // Trim to max length
    if (newHistory.length > maxHistoryLength) {
      newHistory.length = maxHistoryLength;
    }

    positionHistory = newHistory;
  });

  // Calculate ghost positions with interpolated opacities
  const ghosts = $derived.by(() => {
    if (!isActive || positionHistory.length < 2) return [];

    const result: Array<{
      position: [number, number, number];
      opacity: number;
      scale: number;
    }> = [];

    // Skip the first position (current), render trail from previous positions
    for (let i = 1; i < positionHistory.length; i++) {
      const pos = positionHistory[i];
      if (!pos) continue;

      // Opacity decreases for older positions
      const ageRatio = i / positionHistory.length;
      const opacity = baseOpacity * (1 - ageRatio) * 0.8;

      // Scale slightly decreases for older ghosts
      const scale = 1 - ageRatio * 0.3;

      if (opacity > 0.01) {
        result.push({
          position: [pos.x, pos.y, pos.z],
          opacity,
          scale,
        });
      }
    }

    return result;
  });
</script>

{#if isActive && ghosts.length > 0}
  {#each ghosts as ghost, index (index)}
    <T.Mesh position={ghost.position} scale={ghost.scale}>
      <T.SphereGeometry args={[ghostSize, 12, 12]} />
      <T.MeshBasicMaterial
        {color}
        transparent
        opacity={ghost.opacity}
        depthWrite={false}
      />
    </T.Mesh>
  {/each}

  <!-- Connecting line between ghosts for smoother trail -->
  {#if ghosts.length >= 2}
    <T.Line>
      <T.BufferGeometry>
        {#snippet children()}
          {@const positions = new Float32Array(
            ghosts.flatMap((g) => g.position)
          )}
          <T.BufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        {/snippet}
      </T.BufferGeometry>
      <T.LineBasicMaterial
        {color}
        transparent
        opacity={baseOpacity * 0.5}
        linewidth={2}
      />
    </T.Line>
  {/if}
{/if}
