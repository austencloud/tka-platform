<script lang="ts">
  import type { EnvironmentTransitionPhase } from "../domain/environment-transition";

  interface Props {
    opacity: number;
    phase?: EnvironmentTransitionPhase;
  }

  let { opacity, phase = "idle" }: Props = $props();

  const clampedOpacity = $derived(Math.max(0, Math.min(1, opacity)));
</script>

<div
  class="environment-transition-veil"
  class:active={clampedOpacity > 0}
  style:opacity={clampedOpacity}
  data-environment-transition-veil
  data-phase={phase}
  aria-hidden="true"
></div>

<style>
  .environment-transition-veil {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    overflow: hidden;
    background: radial-gradient(
      ellipse at 50% 48%,
      #151d28 0%,
      #0a0e14 68%,
      #05070a 100%
    );
    opacity: 0;
    contain: strict;
  }

  .environment-transition-veil.active {
    will-change: opacity;
  }
</style>
