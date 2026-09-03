<!--
  The canonical closed path for one ratio, drawn small.

  Deliberately the phase-zero form rather than whatever the live stage is
  currently showing. The index is a set of identity cards: 1:3 has to look like
  the same object every time it is seen, or it cannot be recognised on the way
  back. Orientation belongs to the live stage, where it is earned.
-->
<script lang="ts">
  import { tracePath, type QftKnobs } from "$lib/shared/notation/qft/qft-model";
  import type { SpinRatio, SpinStyle } from "@vtg/domain";

  interface Props {
    ratio: SpinRatio;
    spin: SpinStyle;
  }

  let { ratio, spin }: Props = $props();

  const trace = $derived.by(() => {
    const stationary = ratio.handCycles === 0;
    const knobs: QftKnobs = {
      radius: stationary ? 0 : 1,
      downbeats: stationary
        ? ratio.propRotations
        : ratio.propRotations / ratio.handCycles,
      ratio,
      spin: spin === "pro" ? "inspin" : "antispin",
      phase: ratio.propRotations === ratio.handCycles && spin === "pro" ? 4 : 0,
      handDirection: ratio.propRotations === 0 && spin === "anti" ? -1 : 1,
    };
    return tracePath(knobs);
  });

  /*
   * 1:1 pro collapses the entire path to a single point: the prop's inspin
   * exactly cancels the hand's carry, so the head sits on the axis of rotation
   * and never moves. It is a real result and the most surprising card in the
   * set, but a zero-length hairline reads as a failed render. Draw the dot.
   */
  const stillPoint = $derived.by(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of trace) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    if (Math.max(maxX - minX, maxY - minY) > 0.05) return null;
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  });

  const path = $derived(
    trace
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.x.toFixed(3)},${point.y.toFixed(3)}`
      )
      .join(" ")
  );
</script>

<svg class="thumb" viewBox="-2.25 -2.25 4.5 4.5" aria-hidden="true">
  {#if stillPoint}
    <circle cx={stillPoint.x} cy={stillPoint.y} r="0.3" />
  {:else}
    <path d={path} />
  {/if}
</svg>

<style>
  .thumb {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  circle {
    fill: currentColor;
  }

  path {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 0.08;
  }
</style>
