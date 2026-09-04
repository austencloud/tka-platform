<script lang="ts">
  import AnimatorCanvas from "$lib/shared/animation-engine/components/AnimatorCanvas.svelte";
  import { getThirdOrderContext } from "../context/third-order-context";
  import { THIRD_ORDER_VIEWBOX_SIZE } from "../domain/third-order-math";
  import ThirdOrderFlowerOverlay from "./ThirdOrderFlowerOverlay.svelte";
  import { thirdOrderFlowerPetals } from "../domain/third-order-flower-path";

  let { compact = false }: { compact?: boolean } = $props();
  const state = getThirdOrderContext();
  const flowerPetals = $derived(
    thirdOrderFlowerPetals(state.composition.carrierPath)
  );
  const flowerLabel = $derived(
    flowerPetals === 0 ? "circle" : `${flowerPetals}-lobe path`
  );

  function percent(value: number): string {
    return `${(value / THIRD_ORDER_VIEWBOX_SIZE) * 100}%`;
  }
</script>

<main class="stage-shell" aria-label="Third Order motion stage">
  <header class="stage-header">
    <div>
      <h1>Third Order</h1>
      <p>Move complete sequences through a larger coordinate system.</p>
    </div>
    {#if compact}
      <div class="compact-actions">
        <button
          type="button"
          aria-label="Open Third Order setup"
          onclick={() => state.setSetupDrawerOpen(true)}
        >
          <i class="fas fa-sliders" aria-hidden="true"></i><span>Setup</span>
        </button>
      </div>
    {/if}
  </header>

  <div class="canvas-well">
    <div class="stage-canvas">
      <div class="carrier-canvas" aria-hidden="true">
        <AnimatorCanvas
          leftProp={null}
          rightProp={null}
          sequenceData={state.composition.carrier}
          currentStep={state.frame.masterBeat}
          isPlaying={state.isPlaying}
          gridMode={state.composition.carrier.gridMode}
          backgroundAlpha={0}
          gridOpacity={0.5}
          hideTkaGlyph
          hideStepNumbers
          hideProgressBar
          hideHeader
          hidePathLines={state.composition.carrierPath.mode === "flower"}
          beatIndicators={false}
          disableContextMenu
          suppress2DOverlays
          fillContainer
        />
      </div>

      {#if state.composition.carrierPath.mode === "flower"}
        <ThirdOrderFlowerOverlay
          path={state.composition.carrierPath}
          children={state.frame.children}
        />
      {/if}

      {#each state.frame.children as child (child.id)}
        {#if child.visible}
          <div
            class="child-grid {child.id}"
            style:left={percent(child.pose.centerX)}
            style:top={percent(child.pose.centerY)}
            style:transform={`translate(-50%, -50%) rotate(${child.pose.rotation}rad) scale(${child.pose.scale})`}
            aria-hidden="true"
          >
            <AnimatorCanvas
              leftProp={child.props.left}
              rightProp={child.props.right}
              sequenceData={child.sequence}
              currentStep={child.step}
              isPlaying={state.isPlaying}
              gridMode={child.sequence.gridMode}
              backgroundAlpha={0}
              gridOpacity={state.selectedChildId === child.id ? 0.58 : 0.3}
              hideTkaGlyph
              hideStepNumbers
              hideProgressBar
              hideHeader
              hidePathLines={false}
              beatIndicators={false}
              disableContextMenu
              suppress2DOverlays
              fillContainer
            />
          </div>
          <button
            class="child-target {child.id}"
            class:selected={state.selectedChildId === child.id}
            style:left={percent(child.pose.centerX)}
            style:top={percent(child.pose.centerY)}
            type="button"
            aria-label={`Select ${child.label}`}
            aria-pressed={state.selectedChildId === child.id}
            onclick={() => state.selectChild(child.id)}
          >
            <span>{child.id === "grid-blue" ? "B" : "R"}</span>
          </button>
        {/if}
      {/each}

      <div class="center-caption" aria-hidden="true">
        <span>Parent center</span>
      </div>
    </div>
  </div>

  <div class="stage-legend" aria-label="Stage legend">
    <span>
      <i class="carrier-dot"></i>
      {state.composition.carrierPath.mode === "flower"
        ? `${state.composition.carrierPath.ratio} · ${flowerLabel}`
        : "Carrier sequence"}
    </span>
    <span><i class="blue-dot"></i> Blue child grid</span>
    <span><i class="red-dot"></i> Red child grid</span>
    <span class="stage-count"
      >Count {Math.floor(state.frame.masterBeat) + 1}
      <small>+ {(state.frame.masterBeat % 1).toFixed(2)}</small></span
    >
  </div>
</main>

<style>
  .stage-shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 12px;
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
    padding: 16px clamp(14px, 2vw, 22px) 12px;
    overflow: hidden;
    background: var(--theme-panel-elevated-bg, var(--theme-panel-bg));
  }
  .stage-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  .stage-header h1 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: clamp(20px, 1.5vw, 24px);
    font-weight: 650;
    letter-spacing: -0.015em;
  }
  .stage-header p {
    margin: 4px 0 0;
    color: var(--theme-text-dim, #9ca3af);
    font-size: var(--font-size-min, 14px);
  }
  .compact-actions {
    display: flex;
    gap: 8px;
  }
  .compact-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-width: 44px;
    min-height: 44px;
    padding: 8px 11px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: var(--border-radius-md, 8px);
    background: var(--theme-card-bg);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
  }
  .canvas-well {
    display: grid;
    place-items: center;
    min-height: 0;
    overflow: hidden;
    container-type: size;
  }
  .stage-canvas {
    position: relative;
    width: min(100cqw, 100cqh);
    height: min(100cqw, 100cqh);
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-stroke-strong, rgba(255, 255, 255, 0.2)) 80%,
        transparent
      );
    border-radius: var(--border-radius-lg, 12px);
    background: var(--theme-card-bg);
    isolation: isolate;
  }
  .carrier-canvas,
  .child-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .carrier-canvas {
    z-index: 1;
    opacity: 0.34;
  }
  .child-grid {
    z-index: 3;
    width: 100%;
    height: 100%;
    transform-origin: center;
    will-change: transform;
  }
  .child-grid.grid-blue {
    filter: drop-shadow(
      0 0 7px color-mix(in srgb, var(--prop-blue, #3b82f6) 22%, transparent)
    );
  }
  .child-grid.grid-red {
    filter: drop-shadow(
      0 0 7px color-mix(in srgb, var(--prop-red, #ef4444) 22%, transparent)
    );
  }
  .child-target {
    position: absolute;
    z-index: 4;
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    translate: -50% calc(-50% - 54px);
    border: 1px solid currentColor;
    border-radius: 50%;
    background: var(--theme-panel-bg);
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transition: box-shadow var(--transition-normal);
  }
  .child-target.grid-blue {
    color: var(--prop-blue, #60a5fa);
  }
  .child-target.grid-red {
    color: var(--prop-red, #f87171);
  }
  .child-target.selected {
    box-shadow:
      0 0 0 5px color-mix(in srgb, currentColor 18%, transparent),
      0 5px 20px rgba(0, 0, 0, 0.4);
  }
  .child-target:focus-visible {
    outline: 3px solid white;
    outline-offset: 4px;
  }
  .center-caption {
    position: absolute;
    z-index: 3;
    left: 50%;
    top: 50%;
    translate: -50% 15px;
    color: var(--theme-text-dim, #9ca3af);
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.04em;
    pointer-events: none;
  }
  .stage-legend {
    display: flex;
    align-items: center;
    gap: 15px;
    min-height: 28px;
    color: var(--theme-text-dim, #9ca3af);
    font-size: var(--font-size-compact, 12px);
  }
  .stage-legend > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .stage-legend i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .carrier-dot {
    background: #c084fc;
  }
  .blue-dot {
    background: var(--prop-blue, #3b82f6);
  }
  .red-dot {
    background: var(--prop-red, #ef4444);
  }
  .stage-count {
    margin-left: auto;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
  .stage-count small {
    color: var(--theme-text-dim, #9ca3af);
    font-size: inherit;
  }
  @container (max-width: 620px) {
    .stage-shell {
      gap: 7px;
      padding: 10px;
    }
    .stage-header p,
    .stage-legend > span:not(.stage-count),
    .center-caption {
      display: none;
    }
    .stage-header h1 {
      font-size: 18px;
    }
    .stage-canvas {
      border-radius: 15px;
    }
    .stage-legend {
      min-height: 20px;
    }
  }
  @container (max-height: 590px) {
    .stage-shell {
      gap: 6px;
      padding: 8px 14px 6px;
    }
    .stage-header p,
    .stage-legend > span:not(.stage-count),
    .center-caption {
      display: none;
    }
    .stage-header h1 {
      font-size: 18px;
    }
    .stage-legend {
      min-height: 20px;
    }
  }
  @media (max-width: 520px) {
    .compact-actions button span {
      display: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .child-target {
      transition: none;
    }
  }
</style>
