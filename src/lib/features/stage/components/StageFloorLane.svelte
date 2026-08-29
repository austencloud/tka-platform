<script lang="ts">
  import type { StageFloorTravelSegment } from "../domain/stage-timeline-projection";

  interface Props {
    segments: readonly StageFloorTravelSegment[];
    currentBeat: number;
    pixelsPerBeat: number;
  }

  let { segments, currentBeat, pixelsPerBeat }: Props = $props();
</script>

<div class="floor-lane" aria-hidden="true">
  <div class="hold-rail"></div>
  {#each segments as segment (segment.id)}
    {@const width = Math.max(
      2,
      (segment.endBeat - segment.startBeat) * pixelsPerBeat
    )}
    {@const active =
      currentBeat >= segment.startBeat && currentBeat < segment.endBeat}
    <div
      class="travel"
      class:active
      class:stationary={segment.distanceMeters < 0.01}
      style:left="{segment.startBeat * pixelsPerBeat}px"
      style:width="{width}px"
    >
      <span class:visible={width >= 72}
        >{segment.distanceMeters < 0.01
          ? "Hold"
          : `Move to ${segment.label}`}</span
      >
    </div>
    <span
      class="arrival"
      class:active={Math.abs(currentBeat - segment.endBeat) < 0.5}
      style:left="{segment.endBeat * pixelsPerBeat}px"
      title="{segment.label} on count {segment.endBeat}"
      >{segment.setIndex + 1}</span
    >
  {/each}
</div>

<style>
  .floor-lane {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .hold-rail {
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    height: 2px;
    background: color-mix(in srgb, var(--performer-color) 28%, transparent);
    transform: translateY(-50%);
  }

  .travel {
    position: absolute;
    top: 50%;
    z-index: 1;
    display: flex;
    height: 0.75rem;
    min-width: 2px;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--performer-color) 18%, transparent),
      color-mix(in srgb, var(--performer-color) 72%, transparent)
    );
    transform: translateY(-50%);
    transition:
      height var(--duration-fast, 150ms) ease,
      filter var(--duration-fast, 150ms) ease,
      opacity var(--duration-fast, 150ms) ease;
  }

  .travel::after {
    position: absolute;
    right: 0.2rem;
    color: white;
    content: "›";
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
  }

  .travel.stationary {
    opacity: 0.28;
  }

  .travel.active {
    height: 1.1rem;
    filter: drop-shadow(0 0 0.45rem var(--performer-color));
  }

  .travel span {
    max-width: calc(100% - 1.6rem);
    overflow: hidden;
    color: white;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    opacity: 0;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px black;
    transition:
      opacity var(--duration-fast, 150ms) ease,
      visibility 0s linear var(--duration-fast, 150ms);
    visibility: hidden;
    white-space: nowrap;
  }

  .travel span.visible {
    opacity: 1;
    transition-delay: 0s;
    visibility: visible;
  }

  .arrival {
    position: absolute;
    top: 50%;
    z-index: 2;
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    place-items: center;
    border: 2px solid var(--performer-color);
    border-radius: 999px;
    background: #0d0f17;
    color: var(--performer-color);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    transform: translate(-50%, -50%);
    transition:
      background var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .arrival.active {
    background: var(--performer-color);
    color: #090a10;
    box-shadow: 0 0 0.7rem var(--performer-color);
    transform: translate(-50%, -50%) scale(1.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .travel,
    .arrival,
    .travel span {
      transition: none;
    }
  }
</style>
