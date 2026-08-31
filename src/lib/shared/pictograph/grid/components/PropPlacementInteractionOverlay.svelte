<script lang="ts">
  import type { GridLocation } from "../domain/enums/grid-enums";
  import type { PlacementGridPoint } from "../services/placement-grid-points";
  import type { PlacementGuideCoordinates } from "../services/prop-placement-view-model";
  import type { PropPlacementAimState } from "../state/prop-placement-aim-state.svelte";
  import type { PropPlacementState } from "../state/prop-placement-state.svelte";
  import { HandSide } from "../../shared/domain/enums/pictograph-enums";

  interface Props {
    placement: PropPlacementState;
    aim: PropPlacementAimState;
    activePoints: PlacementGridPoint[];
    hitTargetRadius: number;
    pulseColor: string;
    leftNoun: string;
    rightNoun: string;
    showGuideLines: boolean;
    guideLineType?: "alpha" | "beta" | "gamma";
    guideCoordinates: PlacementGuideCoordinates | null;
    gammaArc: string;
  }

  let {
    placement,
    aim,
    activePoints,
    hitTargetRadius,
    pulseColor,
    leftNoun,
    rightNoun,
    showGuideLines,
    guideLineType,
    guideCoordinates,
    gammaArc,
  }: Props = $props();

  function isLeftAt(location: GridLocation): boolean {
    return placement.leftLocation === location;
  }

  function isRightAt(location: GridLocation): boolean {
    return placement.rightLocation === location;
  }
</script>

<svelte:window
  onpointermove={aim.handlePointerMove}
  onpointerup={aim.handlePointerUp}
  onpointercancel={aim.handlePointerCancel}
/>

<svg
  viewBox="0 0 950 950"
  class="interaction-overlay"
  bind:this={aim.overlayElement}
>
  <g class="touch-indicators">
    {#each activePoints as point (point.location)}
      {#if placement.canPlace}
        <circle
          cx={point.x}
          cy={point.y}
          r="40"
          fill={pulseColor}
          class="point-glow"
        />
        <circle
          cx={point.x}
          cy={point.y}
          r="18"
          fill={pulseColor}
          opacity="0.5"
          class="point-solid"
        />
      {/if}
    {/each}
  </g>

  {#if aim.highlightColor && aim.dragColor === null && aim.hoverOutline}
    <polygon
      points={aim.hoverOutline}
      fill="none"
      class="aim-outline"
      stroke={aim.highlightStroke}
      aria-hidden="true"
    />
  {:else if aim.highlightCenter && aim.highlightColor}
    <circle
      cx={aim.highlightCenter.x}
      cy={aim.highlightCenter.y}
      r={aim.isBeta ? 44 : 56}
      fill="none"
      class="aim-halo"
      class:resting={aim.dragColor === null}
      stroke={aim.highlightStroke}
      aria-hidden="true"
    />
  {/if}

  {#if aim.dragPoint && aim.dragColor}
    <g class="aim-ticks" aria-hidden="true">
      {#each aim.aimDirections as direction (direction.orientation)}
        {@const radians = (direction.angle * Math.PI) / 180}
        {@const cos = Math.cos(radians)}
        {@const sin = Math.sin(radians)}
        <line
          x1={aim.dragPoint.x + cos * 72}
          y1={aim.dragPoint.y + sin * 72}
          x2={aim.dragPoint.x + cos * 138}
          y2={aim.dragPoint.y + sin * 138}
          class="aim-tick"
          class:aimed={direction.orientation === aim.dragAim}
          stroke={aim.dragColor === HandSide.RIGHT
            ? "var(--prop-red, #ef4444)"
            : "var(--prop-blue, #3b82f6)"}
        />
      {/each}
    </g>
  {/if}

  <g class="click-targets">
    {#each activePoints as point (point.location)}
      <circle
        cx={point.x}
        cy={point.y}
        r={hitTargetRadius}
        fill="transparent"
        class="click-target"
        class:tappable={aim.isPressable(point.location)}
        onpointerdown={(event) => aim.handlePointerDown(event, point.location)}
        onpointermove={(event) => aim.updateHover(event, point.location)}
        onpointerleave={aim.clearHover}
        onclick={() => aim.handleClick(point.location)}
        onkeydown={(event) => aim.handleKeydown(event, point.location)}
        role="button"
        tabindex={aim.isPressable(point.location) ? 0 : -1}
        aria-label="{point.label} point{isLeftAt(point.location)
          ? ` (${leftNoun})`
          : ''}{isRightAt(point.location) ? ` (${rightNoun})` : ''}"
        aria-disabled={!aim.isPressable(point.location)}
      />
    {/each}
  </g>

  {#if showGuideLines && guideLineType && guideCoordinates}
    <g class="guide-lines">
      {#if guideLineType === "alpha"}
        <line
          x1={guideCoordinates.left.x}
          y1={guideCoordinates.left.y}
          x2={guideCoordinates.right.x}
          y2={guideCoordinates.right.y}
          stroke="rgba(0, 0, 0, 0.4)"
          stroke-width="4"
          stroke-dasharray="15 10"
        />
        <circle cx="475" cy="475" r="10" fill="rgba(0, 0, 0, 0.3)" />
      {:else if guideLineType === "beta"}
        {#each [30, 50, 70] as radius, index}
          <circle
            cx={guideCoordinates.left.x}
            cy={guideCoordinates.left.y}
            r={radius}
            fill="none"
            stroke="rgba(0, 0, 0, 0.3)"
            stroke-width="2.5"
            class="beta-ripple"
            style:animation-delay={`${index * 0.3}s`}
          />
        {/each}
      {:else}
        <line
          x1="475"
          y1="475"
          x2={guideCoordinates.left.x}
          y2={guideCoordinates.left.y}
          stroke="rgba(0, 0, 0, 0.25)"
          stroke-width="2.5"
          stroke-dasharray="10 8"
        />
        <line
          x1="475"
          y1="475"
          x2={guideCoordinates.right.x}
          y2={guideCoordinates.right.y}
          stroke="rgba(0, 0, 0, 0.25)"
          stroke-width="2.5"
          stroke-dasharray="10 8"
        />
        <path
          d={gammaArc}
          fill="none"
          stroke="rgba(0, 0, 0, 0.4)"
          stroke-width="4"
        />
        <text
          x="475"
          y="450"
          text-anchor="middle"
          fill="rgba(0, 0, 0, 0.4)"
          font-size="32">90°</text
        >
      {/if}
    </g>
  {/if}
</svg>

<style>
  .interaction-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .point-glow {
    opacity: 0.15;
    animation: pulse-glow 1.5s ease-in-out infinite;
  }

  .point-solid {
    transition: opacity 0.15s ease;
  }

  .click-target {
    cursor: default;
    pointer-events: auto;
    touch-action: none;
  }

  .aim-halo {
    stroke-width: 22;
    filter: blur(9px);
    mix-blend-mode: screen;
    animation: halo-pulse 1.2s ease-in-out infinite;
    pointer-events: none;
  }

  .aim-outline {
    stroke-width: 10;
    stroke-linejoin: round;
    filter: blur(5px);
    mix-blend-mode: screen;
    opacity: 0.85;
    pointer-events: none;
  }

  .aim-halo.resting {
    stroke-width: 16;
    opacity: 0.75;
    animation: none;
  }

  .aim-tick {
    stroke-width: 6;
    stroke-linecap: round;
    opacity: 0.22;
    transition:
      opacity 0.12s ease,
      stroke-width 0.12s ease;
  }

  .aim-tick.aimed {
    stroke-width: 12;
    opacity: 0.95;
  }

  .click-target.tappable {
    cursor: pointer;
  }

  .click-target.tappable:hover {
    fill: color-mix(in srgb, var(--theme-text, white) 8%, transparent);
  }

  .click-target:focus-visible {
    outline: none;
    stroke: var(--theme-accent, #60a5fa);
    stroke-width: 4;
    stroke-dasharray: 10 5;
  }

  .beta-ripple {
    animation: ripple-expand 1.5s ease-out infinite;
  }

  @keyframes pulse-glow {
    0%,
    100% {
      opacity: 0.12;
    }

    50% {
      opacity: 0.3;
    }
  }

  @keyframes halo-pulse {
    0%,
    100% {
      opacity: 0.45;
    }

    50% {
      opacity: 0.8;
    }
  }

  @keyframes ripple-expand {
    0% {
      opacity: 0.4;
    }

    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .point-glow {
      animation: none;
      opacity: 0.2;
    }

    .beta-ripple {
      animation: none;
    }

    .point-solid,
    .aim-tick {
      transition: none;
    }

    .aim-halo {
      animation: none;
      opacity: 0.55;
    }
  }
</style>
