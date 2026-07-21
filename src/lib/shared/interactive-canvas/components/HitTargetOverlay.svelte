<!--
  Transparent SVG overlay with clickable circles at grid positions.
  Positioned absolutely over AnimatorCanvas. Uses 950x950 viewBox
  (same coordinate space as GridSvg, GlyphOverlay, and the canvas).

  pointer-events: none on the SVG root so canvas interactions
  (pinch, pan) pass through. pointer-events: auto only on the
  clickable circles themselves.
-->
<script lang="ts">
  import { getHitTargets, getHitTargetRadius } from "$lib/shared/assemble-lab/services/grid-hit-target-calculator";
  import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

  interface Props {
    gridMode: GridMode;
    activePhaseColor: "blue" | "red" | null;
    currentPosition: GridLocation | null;
    disabled: boolean;
    showCenter?: boolean;
    pulseTargets?: boolean;
    keyLabels?: Partial<Record<GridLocation, string>>;
    labelForLocation?: (location: GridLocation, defaultLabel: string) => string;
    onPointClick: (location: GridLocation) => void;
    onPointPreview?: (location: GridLocation | null) => void;
  }

  let {
    gridMode,
    activePhaseColor = null,
    currentPosition = null,
    disabled = false,
    showCenter = false,
    pulseTargets = true,
    keyLabels = {},
    labelForLocation,
    onPointClick,
    onPointPreview,
  }: Props = $props();

  const hitRadius = getHitTargetRadius();

  const hitTargets = $derived(getHitTargets(gridMode, showCenter));

  function handleClick(location: GridLocation): void {
    if (disabled) return;
    onPointClick(location);
  }

  function handleKeydown(e: KeyboardEvent, location: GridLocation): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(location);
    }
  }

  function getLabel(location: GridLocation, defaultLabel: string): string {
    if (labelForLocation) return labelForLocation(location, defaultLabel);
    const phase = activePhaseColor === "blue" ? "Blue" : activePhaseColor === "red" ? "Red" : "";
    return `${phase} ${defaultLabel}`.trim();
  }
</script>

<svg
  class="hit-target-overlay"
  viewBox="0 0 950 950"
  xmlns="http://www.w3.org/2000/svg"
  preserveAspectRatio="xMidYMid meet"
>
  {#each hitTargets as target (target.location)}
    {#if keyLabels[target.location]}
      <text
        x={target.x}
        y={target.y + 5}
        class="key-label"
        text-anchor="middle"
        dominant-baseline="middle"
        aria-hidden="true">{keyLabels[target.location]}</text
      >
    {/if}
    <circle
      cx={target.x}
      cy={target.y}
      r={hitRadius}
      class="hit-target"
      class:is-selected={currentPosition === target.location}
      class:phase-blue={activePhaseColor === "blue"}
      class:phase-red={activePhaseColor === "red"}
      class:pulse={pulseTargets}
      class:disabled={disabled}
      role="button"
      tabindex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={getLabel(target.location, target.label)}
      onclick={() => handleClick(target.location)}
      onkeydown={(e) => handleKeydown(e, target.location)}
      onpointerenter={() => onPointPreview?.(target.location)}
      onpointerleave={() => onPointPreview?.(null)}
      onfocus={() => onPointPreview?.(target.location)}
      onblur={() => onPointPreview?.(null)}
    />
  {/each}
</svg>

<style>
  .hit-target-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    pointer-events: none;
  }

  .hit-target {
    pointer-events: auto;
    fill: rgba(255, 255, 255, 0.04);
    stroke: rgba(255, 255, 255, 0.25);
    stroke-width: 2.5;
    cursor: pointer;
    transition: fill 0.14s ease, stroke 0.14s ease, stroke-width 0.14s ease;
  }

  .hit-target.disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.3;
  }

  .hit-target.phase-blue:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 8%, transparent);
    stroke: color-mix(in srgb, var(--prop-blue, #2e8bf0) 50%, transparent);
  }

  .hit-target.pulse.phase-blue:not(.is-selected):not(.disabled) {
    animation: pulse-blue 1.8s ease-in-out infinite;
  }

  .hit-target.phase-red:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 8%, transparent);
    stroke: color-mix(in srgb, var(--prop-red, #ed1c24) 50%, transparent);
  }

  .hit-target.pulse.phase-red:not(.is-selected):not(.disabled) {
    animation: pulse-red 1.8s ease-in-out infinite;
  }

  .hit-target.is-selected.phase-blue {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 22%, transparent);
    stroke: var(--prop-blue, #2e8bf0);
    stroke-width: 3;
    animation: none;
  }

  .hit-target.is-selected.phase-red {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 22%, transparent);
    stroke: var(--prop-red, #ed1c24);
    stroke-width: 3;
    animation: none;
  }

  .hit-target:hover:not(.is-selected):not(.disabled) {
    stroke-width: 3.5;
  }

  .hit-target.phase-blue:hover:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 20%, transparent);
    stroke: var(--prop-blue, #2e8bf0);
  }

  .hit-target.phase-red:hover:not(.is-selected):not(.disabled) {
    fill: color-mix(in srgb, var(--prop-red, #ed1c24) 20%, transparent);
    stroke: var(--prop-red, #ed1c24);
  }

  .hit-target:focus-visible {
    outline: none;
    stroke-width: 4;
    stroke: var(--theme-accent, #3b82f6);
  }

  .key-label {
    fill: var(--theme-text, #ffffff);
    font-size: 28px;
    font-weight: 800;
    font-family: var(--font-mono, monospace);
    pointer-events: none;
    user-select: none;
  }

  @keyframes pulse-blue {
    0%   { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
    50%  { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0) 18%, transparent); stroke-opacity: 0.90; stroke-width: 3.5; }
    100% { fill: color-mix(in srgb, var(--prop-blue, #2e8bf0)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
  }

  @keyframes pulse-red {
    0%   { fill: color-mix(in srgb, var(--prop-red, #ed1c24)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
    50%  { fill: color-mix(in srgb, var(--prop-red, #ed1c24) 18%, transparent); stroke-opacity: 0.90; stroke-width: 3.5; }
    100% { fill: color-mix(in srgb, var(--prop-red, #ed1c24)  5%, transparent); stroke-opacity: 0.40; stroke-width: 2; }
  }

  @media (prefers-reduced-motion: reduce) {
    .hit-target.phase-blue:not(.disabled),
    .hit-target.phase-red:not(.disabled) {
      animation: none;
    }
  }
</style>
