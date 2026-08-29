<script lang="ts">
  import type { FormationPresetId } from "../domain/stage-types";
  import { PERFORMER_COLORS } from "../domain/stage-types";
  import { generatePresetPositions } from "../state/formation-presets";

  interface Props {
    formation: FormationPresetId;
    performerCount: number;
  }

  let { formation, performerCount }: Props = $props();

  const WIDTH = 120;
  const HEIGHT = 72;
  const PAD_X = 11;
  const PAD_Y = 9;
  const stageWidth = WIDTH - PAD_X * 2;
  const stageDepth = HEIGHT - PAD_Y * 2;

  const positions = $derived(
    generatePresetPositions(formation, performerCount, stageWidth, stageDepth)
  );
  const markerRadius = $derived(performerCount > 6 ? 5.5 : 6.5);

  function markerX(x: number): number {
    return PAD_X + x;
  }

  function markerY(z: number): number {
    return PAD_Y + z;
  }

  function facingDegrees(angle: number): number {
    return (angle * 180) / Math.PI;
  }
</script>

<svg
  class="formation-diagram"
  viewBox="0 0 {WIDTH} {HEIGHT}"
  preserveAspectRatio="xMidYMid meet"
  aria-hidden="true"
  data-formation={formation}
>
  <rect
    class="stage-floor"
    x={PAD_X}
    y={PAD_Y}
    width={stageWidth}
    height={stageDepth}
    rx="8"
  />
  <path
    class="stage-grid"
    d="M {PAD_X + stageWidth / 3} {PAD_Y} V {PAD_Y + stageDepth}
       M {PAD_X + (stageWidth * 2) / 3} {PAD_Y} V {PAD_Y + stageDepth}
       M {PAD_X} {PAD_Y + stageDepth / 2} H {PAD_X + stageWidth}"
  />
  <path
    class="audience-edge"
    d="M {PAD_X + 8} {PAD_Y + 1.5} H {PAD_X + stageWidth - 8}"
  />

  {#each positions as position, index (`${formation}-${performerCount}-${index}`)}
    <g
      class="performer-mark"
      transform="translate({markerX(position.x)} {markerY(position.z)})"
    >
      <circle
        class="performer-glow"
        r={markerRadius + 3}
        fill={PERFORMER_COLORS[index]}
      />
      <circle
        class="performer-body"
        r={markerRadius}
        fill={PERFORMER_COLORS[index]}
      />
      <text dy="0.35em">{String.fromCharCode(65 + index)}</text>
      {#if position.facingAngle !== undefined}
        <path
          class="facing-notch"
          transform="rotate({facingDegrees(position.facingAngle)})"
          d="M -2 {-markerRadius - 1} L 0 {-markerRadius -
            4.5} L 2 {-markerRadius - 1} Z"
        />
      {/if}
    </g>
  {/each}
</svg>

<style>
  .formation-diagram {
    display: block;
    width: 100%;
    min-width: 0;
    aspect-ratio: 5 / 3;
  }

  .stage-floor {
    fill: color-mix(in srgb, var(--theme-accent) 7%, var(--surface-inset-deep));
    stroke: color-mix(in srgb, var(--theme-accent) 26%, var(--theme-stroke));
    stroke-width: 1;
  }

  .stage-grid {
    fill: none;
    stroke: color-mix(in srgb, var(--theme-text-dim) 18%, transparent);
    stroke-width: 0.75;
  }

  .audience-edge {
    fill: none;
    stroke: color-mix(in srgb, var(--theme-accent) 72%, white 12%);
    stroke-linecap: round;
    stroke-width: 2;
  }

  .performer-glow {
    opacity: 0.18;
  }

  .performer-body {
    stroke: color-mix(in srgb, white 72%, transparent);
    stroke-width: 0.8;
  }

  .performer-mark text {
    fill: #07080d;
    font-size: 6.5px;
    font-weight: 800;
    text-anchor: middle;
  }

  .facing-notch {
    fill: var(--theme-text);
    opacity: 0.9;
  }
</style>
