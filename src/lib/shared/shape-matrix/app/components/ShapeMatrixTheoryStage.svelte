<script lang="ts">
  import { onMount } from "svelte";
  import {
    closedPathSteps,
    posesAt,
    tracePath,
    type QftKnobs,
  } from "$lib/shared/notation/qft/qft-model";
  import type { SpinRatio, SpinStyle } from "@vtg/domain";

  interface Props {
    ratio: SpinRatio;
    spin: SpinStyle;
  }

  let { ratio, spin }: Props = $props();
  const staticHand = ratio.handCycles === 0;
  const float = ratio.propRotations === 0;
  const radius = staticHand ? 0 : 1;
  const knobs: QftKnobs = {
    radius,
    downbeats: staticHand
      ? ratio.propRotations
      : ratio.propRotations / ratio.handCycles,
    ratio,
    spin: spin === "pro" ? "inspin" : "antispin",
    phase: ratio.propRotations === ratio.handCycles && spin === "pro" ? 4 : 0,
    handDirection: float && spin === "anti" ? -1 : 1,
  };
  const trace = tracePath(knobs);
  const path = trace
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${point.x.toFixed(4)},${point.y.toFixed(4)}`
    )
    .join(" ");
  const totalSteps = closedPathSteps(knobs);
  const cycleMilliseconds = Math.max(1, ratio.handCycles) * 1_500;
  let cursor = $state(totalSteps * 0.08);
  const pose = $derived(posesAt(knobs, cursor));
  const ratioLabel = `${ratio.propRotations}:${ratio.handCycles}`;

  onMount(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let start = performance.now();

    const draw = (now: number) => {
      if (!media.matches) {
        cursor =
          (((now - start) % cycleMilliseconds) / cycleMilliseconds) *
          totalSteps;
      }
      frame = requestAnimationFrame(draw);
    };

    const handleMotionChange = () => {
      start = performance.now();
      if (media.matches) cursor = totalSteps * 0.08;
    };

    media.addEventListener("change", handleMotionChange);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", handleMotionChange);
    };
  });
</script>

<svg
  class="ratio-stage"
  viewBox="-2.35 -2.35 4.7 4.7"
  role="img"
  aria-label={`${ratioLabel} ${spin} continuous ratio path`}
>
  <circle class="origin-ring" cx="0" cy="0" r="0.08" />
  {#if !staticHand}
    <circle class="hand-path" cx="0" cy="0" r={radius} />
    <line class="arm" x1="0" y1="0" x2={pose.hand.x} y2={pose.hand.y} />
  {/if}
  <path class="trace-halo" d={path} />
  <path class="trace" d={path} />
  <line
    class="prop"
    x1={pose.hand.x}
    y1={pose.hand.y}
    x2={pose.head.x}
    y2={pose.head.y}
  />
  <circle class="hand" cx={pose.hand.x} cy={pose.hand.y} r="0.085" />
  <circle class="head-halo" cx={pose.head.x} cy={pose.head.y} r="0.16" />
  <circle class="head" cx={pose.head.x} cy={pose.head.y} r="0.105" />
</svg>

<style>
  .ratio-stage {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .origin-ring {
    fill: color-mix(in srgb, var(--theme-text, #fff) 18%, transparent);
    stroke: color-mix(in srgb, var(--theme-text, #fff) 34%, transparent);
    stroke-width: 0.018;
  }

  .hand-path {
    fill: none;
    stroke: color-mix(in srgb, var(--theme-text, #fff) 18%, transparent);
    stroke-width: 0.018;
    stroke-dasharray: 0.055 0.075;
  }

  .trace-halo,
  .trace {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .trace-halo {
    stroke: color-mix(in srgb, var(--theme-accent, #f59e0b) 18%, transparent);
    stroke-width: 0.13;
  }

  .trace {
    stroke: color-mix(in srgb, var(--theme-accent, #f59e0b) 78%, white 8%);
    stroke-width: 0.035;
  }

  .arm {
    stroke: color-mix(in srgb, var(--theme-text, #fff) 24%, transparent);
    stroke-width: 0.025;
    stroke-dasharray: 0.055 0.055;
  }

  .prop {
    stroke: var(--theme-text, #fff);
    stroke-width: 0.045;
    stroke-linecap: round;
  }

  .hand {
    fill: var(--theme-text, #fff);
    stroke: var(--theme-panel-bg, #0a0f14);
    stroke-width: 0.025;
  }

  .head-halo {
    fill: color-mix(in srgb, var(--theme-accent, #f59e0b) 22%, transparent);
  }

  .head {
    fill: var(--theme-accent, #f59e0b);
    stroke: white;
    stroke-width: 0.025;
  }
</style>
