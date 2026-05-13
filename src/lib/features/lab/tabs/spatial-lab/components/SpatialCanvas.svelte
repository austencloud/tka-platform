<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { SpatialLabState } from "../state/spatial-lab-state.svelte";
  import { CANVAS_SIZE, BODY_CENTER } from "../state/spatial-lab-constants";
  import PlaneLines from "./canvas/PlaneLines.svelte";
  import BodyDiagram from "./canvas/BodyDiagram.svelte";
  import PropMarker from "./canvas/PropMarker.svelte";
  import ArmLine from "./canvas/ArmLine.svelte";
  import ReachEnvelope from "./canvas/ReachEnvelope.svelte";
  import CrossingIndicator from "./canvas/CrossingIndicator.svelte";

  interface Props {
    state: SpatialLabState;
  }

  let { state }: Props = $props();
  let svgEl: SVGSVGElement;
  let dragging: "left" | "right" | null = null;
  let dragOffset = { x: 0, y: 0 };
  let rafId: number;

  function getMousePos(e: MouseEvent) {
    const rect = svgEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * CANVAS_SIZE / rect.width,
      y: (e.clientY - rect.top) * CANVAS_SIZE / rect.height,
    };
  }

  function startDrag(side: "left" | "right", e: MouseEvent) {
    if (state.mode === "sequence") return;
    dragging = side;
    const pos = getMousePos(e);
    const prop = side === "left" ? state.leftProp : state.rightProp;
    dragOffset = { x: prop.x - pos.x, y: prop.y - pos.y };
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging) return;
    const pos = getMousePos(e);
    const nx = Math.max(80, Math.min(520, pos.x + dragOffset.x));
    const ny = Math.max(60, Math.min(540, pos.y + dragOffset.y));
    state.setPropPosition(dragging, { x: nx, y: ny });
  }

  function handleMouseUp() {
    if (!dragging) return;
    state.snapProp(dragging);
    dragging = null;
  }

  function tick() {
    state.tick();
    rafId = requestAnimationFrame(tick);
  }

  onMount(() => { rafId = requestAnimationFrame(tick); });
  onDestroy(() => { cancelAnimationFrame(rafId); });
</script>

<div class="canvas-area">
  <svg
    bind:this={svgEl}
    viewBox="0 0 {CANVAS_SIZE} {CANVAS_SIZE}"
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
  >
    <defs>
      <radialGradient id="reachL" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#4a9eff" stop-opacity="0.06" />
        <stop offset="80%" stop-color="#4a9eff" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#4a9eff" stop-opacity="0" />
      </radialGradient>
      <radialGradient id="reachR" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff4a4a" stop-opacity="0.06" />
        <stop offset="80%" stop-color="#ff4a4a" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#ff4a4a" stop-opacity="0" />
      </radialGradient>
      <marker id="arrowG" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6" fill="#66ff66" />
      </marker>
      <marker id="arrowO" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <path d="M0,0 L8,3 L0,6" fill="#ff8844" />
      </marker>
      <filter id="glow">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>

    <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="#0a0a18" />

    {#each [60, 120, 180, 240] as r}
      <circle cx={BODY_CENTER.x} cy={BODY_CENTER.y} {r} fill="none" stroke="#151525" stroke-width="0.5" />
    {/each}

    <line x1={120} y1={55} x2={480} y2={55} stroke="#333" stroke-width="1" />
    <text x={300} y={45} text-anchor="middle" fill="#555" font-size="12" font-family="system-ui">AUDIENCE</text>

    <PlaneLines gridPoints={state.gridPoints} planeSplitActive={state.planeSplitActive} />

    <ReachEnvelope
      cx={state.leftShoulder.x} cy={state.leftShoulder.y}
      radius={state.maxReach} gradientId="reachL" color="#4a9eff"
      visible={state.showReachEnvelopes}
    />
    <ReachEnvelope
      cx={state.rightShoulder.x} cy={state.rightShoulder.y}
      radius={state.maxReach} gradientId="reachR" color="#ff4a4a"
      visible={state.showReachEnvelopes}
    />

    <ArmLine
      shoulderX={state.leftShoulder.x} shoulderY={state.leftShoulder.y}
      propX={state.leftProp.x} propY={state.leftProp.y}
      color="#4a9eff" visible={state.showArmLines}
    />
    <ArmLine
      shoulderX={state.rightShoulder.x} shoulderY={state.rightShoulder.y}
      propX={state.rightProp.x} propY={state.rightProp.y}
      color="#ff4a4a" visible={state.showArmLines}
    />

    <CrossingIndicator crossing={state.crossing} visible={state.showCrossingAlert} />

    <BodyDiagram
      cx={BODY_CENTER.x} cy={BODY_CENTER.y}
      rotation={state.bodyRotation}
      locked={state.bodyLocked}
      rx={state.bodyEllipse.rx}
      ry={state.bodyEllipse.ry}
      onclick={() => state.toggleBodyLock()}
    />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g onmousedown={(e) => startDrag("left", e)}>
      <PropMarker x={state.leftProp.x} y={state.leftProp.y} label="L" color="#4a9eff" />
    </g>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g onmousedown={(e) => startDrag("right", e)}>
      <PropMarker x={state.rightProp.x} y={state.rightProp.y} label="R" color="#ff4a4a" />
    </g>

    <text x={300} y={585} text-anchor="middle" fill="#444" font-size="11" font-family="system-ui">
      {state.viewConfig.label}
    </text>
  </svg>
</div>

<style>
  .canvas-area {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a18;
    overflow: hidden;
  }
  .canvas-area svg {
    width: 100%;
    height: 100%;
    max-width: 700px;
    max-height: 700px;
  }
</style>
