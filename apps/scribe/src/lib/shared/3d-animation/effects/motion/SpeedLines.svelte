<script lang="ts">
  /**
   * SpeedLines Component
   *
   * Creates anime-style speed lines radiating backward from the prop.
   * Lines appear during fast movement and their length scales with velocity.
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
    /** Effect intensity (0-1), affects opacity and length */
    intensity?: number;
    /** Minimum velocity to show speed lines (units per frame) */
    threshold?: number;
    /** Line color (hex string) */
    color?: string;
    /** Number of speed lines to render */
    lineCount?: number;
    /** Maximum line length multiplier */
    maxLength?: number;
    /** Spread of lines perpendicular to motion direction */
    spread?: number;
  }

  let {
    currentPosition,
    previousPosition,
    enabled = true,
    intensity = 0.7,
    threshold = 5,
    color = "#ffffff",
    lineCount = 5,
    maxLength = 0.8,
    spread = 15,
  }: Props = $props();

  // Calculate velocity and direction
  const velocity = $derived(currentPosition.distanceTo(previousPosition));
  const normalizedVelocity = $derived(Math.min(velocity / 50, 1));
  const isActive = $derived(enabled && velocity > threshold);

  // Movement direction (normalized)
  const direction = $derived.by(() => {
    if (velocity < 0.001) return new Vector3(0, 0, 1);
    return currentPosition.clone().sub(previousPosition).normalize();
  });

  // Generate perpendicular vectors for line spread
  function getPerpendicularVectors(dir: Vector3): {
    up: Vector3;
    right: Vector3;
  } {
    // Find a vector not parallel to dir
    const arbitrary =
      Math.abs(dir.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);

    const right = new Vector3().crossVectors(dir, arbitrary).normalize();
    const up = new Vector3().crossVectors(right, dir).normalize();

    return { up, right };
  }

  // Calculate speed line data
  const speedLines = $derived.by(() => {
    if (!isActive) return [];

    const { up, right } = getPerpendicularVectors(direction);
    const lineLength = velocity * maxLength * intensity;
    const baseOpacity = normalizedVelocity * intensity;

    const lines: Array<{
      start: [number, number, number];
      end: [number, number, number];
      opacity: number;
    }> = [];

    // Center line (strongest)
    const centerStart = currentPosition.clone();
    const centerEnd = currentPosition
      .clone()
      .sub(direction.clone().multiplyScalar(lineLength));
    lines.push({
      start: [centerStart.x, centerStart.y, centerStart.z],
      end: [centerEnd.x, centerEnd.y, centerEnd.z],
      opacity: baseOpacity,
    });

    // Offset lines on each side
    const sideLineCount = Math.floor((lineCount - 1) / 2);
    for (let i = 1; i <= sideLineCount; i++) {
      const offsetDistance = (i / sideLineCount) * spread;
      const opacityFalloff = 1 - (i / (sideLineCount + 1)) * 0.5;

      // Lines offset in the "up" direction
      const upOffset = up.clone().multiplyScalar(offsetDistance);
      const upStart = currentPosition.clone().add(upOffset);
      const upEnd = upStart
        .clone()
        .sub(direction.clone().multiplyScalar(lineLength * (1 - i * 0.1)));
      lines.push({
        start: [upStart.x, upStart.y, upStart.z],
        end: [upEnd.x, upEnd.y, upEnd.z],
        opacity: baseOpacity * opacityFalloff,
      });

      // Lines offset in the "down" direction
      const downOffset = up.clone().multiplyScalar(-offsetDistance);
      const downStart = currentPosition.clone().add(downOffset);
      const downEnd = downStart
        .clone()
        .sub(direction.clone().multiplyScalar(lineLength * (1 - i * 0.1)));
      lines.push({
        start: [downStart.x, downStart.y, downStart.z],
        end: [downEnd.x, downEnd.y, downEnd.z],
        opacity: baseOpacity * opacityFalloff,
      });

      // Additional lines in the "right" direction for more depth
      if (i <= sideLineCount / 2) {
        const rightOffset = right.clone().multiplyScalar(offsetDistance * 0.7);
        const rightStart = currentPosition.clone().add(rightOffset);
        const rightEnd = rightStart
          .clone()
          .sub(direction.clone().multiplyScalar(lineLength * (1 - i * 0.15)));
        lines.push({
          start: [rightStart.x, rightStart.y, rightStart.z],
          end: [rightEnd.x, rightEnd.y, rightEnd.z],
          opacity: baseOpacity * opacityFalloff * 0.7,
        });

        const leftOffset = right.clone().multiplyScalar(-offsetDistance * 0.7);
        const leftStart = currentPosition.clone().add(leftOffset);
        const leftEnd = leftStart
          .clone()
          .sub(direction.clone().multiplyScalar(lineLength * (1 - i * 0.15)));
        lines.push({
          start: [leftStart.x, leftStart.y, leftStart.z],
          end: [leftEnd.x, leftEnd.y, leftEnd.z],
          opacity: baseOpacity * opacityFalloff * 0.7,
        });
      }
    }

    return lines;
  });
</script>

{#if isActive && speedLines.length > 0}
  {#each speedLines as line, index (index)}
    {@const positions = new Float32Array([...line.start, ...line.end])}
    <T.Line>
      <T.BufferGeometry>
        <T.BufferAttribute attach="attributes-position" args={[positions, 3]} />
      </T.BufferGeometry>
      <T.LineBasicMaterial
        {color}
        transparent
        opacity={line.opacity}
        depthWrite={false}
      />
    </T.Line>
  {/each}

  <!-- Optional glow effect at line tips -->
  {#each speedLines.slice(0, 3) as line, index (index)}
    <T.Mesh position={line.end}>
      <T.SphereGeometry args={[2, 6, 6]} />
      <T.MeshBasicMaterial
        {color}
        transparent
        opacity={line.opacity * 0.4}
        depthWrite={false}
      />
    </T.Mesh>
  {/each}
{/if}
