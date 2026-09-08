<script lang="ts">
  /**
   * StepPlaneStrip
   *
   * Horizontal timeline of small colored cells, one per beat.
   * Each cell is split top/bottom for blue/red hand plane assignments.
   * Color = plane (purple=Wall, blue=Wheel, green=Floor).
   * Clicking a cell navigates to that beat.
   */

  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";

  interface Props {
    totalSteps: number;
    currentStepIndex: number;
    beatPlaneOverrides: Map<number, { left?: Plane; right?: Plane }>;
    onStepClick: (index: number) => void;
  }

  let { totalSteps, currentStepIndex, beatPlaneOverrides, onStepClick }: Props = $props();

  function getColor(stepNumber: number, hand: "left" | "right"): string {
    const override = beatPlaneOverrides.get(stepNumber);
    const plane = hand === "left" ? override?.left : override?.right;
    // Default (WALL or no override) shows as a subtle base color
    if (!plane || plane === Plane.WALL) return PLANE_COLORS[Plane.WALL];
    return PLANE_COLORS[plane] ?? PLANE_COLORS[Plane.WALL];
  }

  function hasOverride(stepNumber: number): boolean {
    return beatPlaneOverrides.has(stepNumber);
  }

  // Build beat indices as a stable array
  const beatIndices = $derived(Array.from({ length: totalSteps }, (_, i) => i));
</script>

{#if totalSteps > 1}
  <div class="beat-plane-strip" role="group" aria-label="Per-step plane assignments">
    {#each beatIndices as i (i)}
      <button
        class="beat-cell"
        class:current={i === currentStepIndex}
        class:has-override={hasOverride(i)}
        onclick={() => onStepClick(i)}
        title="Step {i + 1}{hasOverride(i) ? ' (custom planes)' : ''}"
        aria-label="Step {i + 1}"
        aria-current={i === currentStepIndex ? "step" : undefined}
      >
        <div class="hand-half blue-half" style="background: {getColor(i, 'left')};"></div>
        <div class="hand-half red-half" style="background: {getColor(i, 'right')};"></div>
      </button>
    {/each}
  </div>
{/if}

<style>
  .beat-plane-strip {
    display: flex;
    gap: 2px;
    padding: 4px 8px;
    overflow-x: auto;
    scrollbar-width: none;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .beat-plane-strip::-webkit-scrollbar {
    display: none;
  }

  .hand-half {
    flex: 1;
  }

  .blue-half {
    border-radius: 2px 2px 0 0;
  }

  .red-half {
    border-radius: 0 0 2px 2px;
  }
</style>
