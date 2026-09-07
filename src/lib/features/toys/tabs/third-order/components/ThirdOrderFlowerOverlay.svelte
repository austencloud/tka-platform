<script lang="ts">
  import type {
    ThirdOrderCarrierPathDraft,
    ThirdOrderSampledChild,
  } from "../domain/third-order-composition";
  import { traceThirdOrderFlowerPath } from "../domain/third-order-flower-path";
  import { THIRD_ORDER_VIEWBOX_SIZE } from "../domain/third-order-math";

  let {
    path,
    children,
  }: {
    path: ThirdOrderCarrierPathDraft;
    children: ThirdOrderSampledChild[];
  } = $props();

  const bluePoints = $derived(
    traceThirdOrderFlowerPath(path, "left")
      .map((point) => `${point.x},${point.y}`)
      .join(" ")
  );
  const redPoints = $derived(
    traceThirdOrderFlowerPath(path, "right")
      .map((point) => `${point.x},${point.y}`)
      .join(" ")
  );
</script>

<svg
  class="flower-overlay"
  viewBox={`0 0 ${THIRD_ORDER_VIEWBOX_SIZE} ${THIRD_ORDER_VIEWBOX_SIZE}`}
  role="img"
  aria-label="Flower carrier paths and orbit construction"
>
  <polyline class="flower-path blue-path" points={bluePoints}></polyline>
  <polyline class="flower-path red-path" points={redPoints}></polyline>

  {#if path.showConstruction}
    {#each children as child (child.id)}
      {@const geometry = child.decomposition}
      {#if child.visible && geometry}
        <g
          class:blue={child.id === "grid-blue"}
          class:red={child.id === "grid-red"}
        >
          <circle
            class="primary-orbit"
            cx={geometry.origin.x}
            cy={geometry.origin.y}
            r={geometry.primaryRadius}
          ></circle>
          <circle
            class="secondary-orbit"
            cx={geometry.pivot.x}
            cy={geometry.pivot.y}
            r={geometry.orbitRadius}
          ></circle>
          <line
            class="primary-vector"
            x1={geometry.origin.x}
            y1={geometry.origin.y}
            x2={geometry.pivot.x}
            y2={geometry.pivot.y}
          ></line>
          <line
            class="secondary-vector"
            x1={geometry.pivot.x}
            y1={geometry.pivot.y}
            x2={geometry.center.x}
            y2={geometry.center.y}
          ></line>
          <circle
            class="vector-joint"
            cx={geometry.pivot.x}
            cy={geometry.pivot.y}
            r="5"
          ></circle>
        </g>
      {/if}
    {/each}
  {/if}

  <circle
    class="parent-center"
    cx={THIRD_ORDER_VIEWBOX_SIZE / 2}
    cy={THIRD_ORDER_VIEWBOX_SIZE / 2}
    r="7"
  ></circle>
</svg>

<style>
  .flower-overlay {
    position: absolute;
    z-index: 2;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .flower-path,
  .primary-orbit,
  .secondary-orbit,
  .primary-vector,
  .secondary-vector {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .flower-path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .blue-path {
    stroke: var(--prop-blue, #3b82f6);
    stroke-width: 3;
    opacity: 0.56;
  }

  .red-path {
    stroke: var(--prop-red, #ef4444);
    stroke-width: 2.5;
    stroke-dasharray: 8 8;
    opacity: 0.72;
  }

  .primary-orbit,
  .secondary-orbit {
    stroke: currentColor;
    stroke-width: 1;
    stroke-dasharray: 4 7;
    opacity: 0.24;
  }

  .primary-vector,
  .secondary-vector {
    stroke: currentColor;
    stroke-width: 2;
    opacity: 0.66;
  }

  .blue {
    color: var(--prop-blue, #3b82f6);
  }

  .red {
    color: var(--prop-red, #ef4444);
  }

  .vector-joint {
    fill: var(--theme-panel-bg);
    stroke: currentColor;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  .parent-center {
    fill: var(--theme-panel-bg);
    stroke: var(--theme-text-dim);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
</style>
