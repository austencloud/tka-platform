<script lang="ts">
  import { getStageChoreographyState } from "../state/stage-choreography-state.svelte";
  import PerformerDot from "./PerformerDot.svelte";
  import PathLine from "./PathLine.svelte";

  const stageState = getStageChoreographyState();

  let containerEl: HTMLDivElement | null = $state(null);
  let canvasWidth = $state(800);
  let canvasHeight = $state(500);

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]!;
      canvasWidth = entry.contentRect.width;
      canvasHeight = entry.contentRect.height;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  const choreography = $derived(stageState.choreography);
  const activeFormationIndex = $derived(stageState.activeFormationIndex);
  const activeFormation = $derived(stageState.activeFormation);
  const nextFormation = $derived(stageState.nextFormation);
  const interpolatedPositions = $derived(stageState.interpolatedPositions);
  const isPlaying = $derived(stageState.isPlaying);
  const stageWidth = $derived(choreography.stageWidth);
  const stageDepth = $derived(choreography.stageDepth);
  const displayPositions = $derived(isPlaying ? interpolatedPositions : (activeFormation?.positions ?? []));
  const margin = 40;

  function stageToSvgX(x: number): number {
    return margin + (x / stageWidth) * (canvasWidth - margin * 2);
  }
  function stageToSvgY(z: number): number {
    return margin + (z / stageDepth) * (canvasHeight - margin * 2);
  }
</script>

<div class="stage-canvas-container" bind:this={containerEl}>
  <svg width={canvasWidth} height={canvasHeight} xmlns="http://www.w3.org/2000/svg">
    <defs>
      {#each choreography.performers as performer}
        <marker
          id="arrowhead-{performer.color.slice(1)}"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="{performer.color}88" />
        </marker>
      {/each}
    </defs>

    <rect
      x={margin}
      y={margin}
      width={canvasWidth - margin * 2}
      height={canvasHeight - margin * 2}
      fill="rgba(255, 255, 255, 0.02)"
      stroke="rgba(255, 255, 255, 0.1)"
      stroke-width="1.5"
      rx="4"
    />

    {#each Array.from({ length: Math.floor(stageWidth) + 1 }, (_, i) => i) as x}
      <line
        x1={stageToSvgX(x)}
        y1={margin}
        x2={stageToSvgX(x)}
        y2={canvasHeight - margin}
        stroke="rgba(255, 255, 255, 0.06)"
        stroke-width="0.5"
      />
    {/each}
    {#each Array.from({ length: Math.floor(stageDepth) + 1 }, (_, i) => i) as z}
      <line
        x1={margin}
        y1={stageToSvgY(z)}
        x2={canvasWidth - margin}
        y2={stageToSvgY(z)}
        stroke="rgba(255, 255, 255, 0.06)"
        stroke-width="0.5"
      />
    {/each}

    <text x={(canvasWidth) / 2} y={margin - 12} text-anchor="middle" fill="rgba(255, 255, 255, 0.35)" font-size="11" font-weight="600" letter-spacing="1">AUDIENCE</text>
    <text x={(canvasWidth) / 2} y={canvasHeight - margin + 18} text-anchor="middle" fill="rgba(255, 255, 255, 0.35)" font-size="11" font-weight="600" letter-spacing="1">BACKSTAGE</text>

    {#if activeFormation && nextFormation}
      {#each activeFormation.positions as fromPose, i}
        {@const toPose = nextFormation.positions[i]}
        {#if toPose}
          <PathLine
            from={fromPose}
            to={toPose}
            color={choreography.performers[i]?.color ?? "#888"}
            {stageWidth}
            {stageDepth}
            {canvasWidth}
            {canvasHeight}
          />
        {/if}
      {/each}
    {/if}

    {#each displayPositions as pose, i}
      <PerformerDot
        {pose}
        color={choreography.performers[i]?.color ?? "#888"}
        index={i}
        {stageWidth}
        {stageDepth}
        {canvasWidth}
        {canvasHeight}
        isSelected={stageState.selectedPerformerIndex === i}
        onDrag={(x, z) => stageState.updatePerformerPosition(activeFormationIndex, pose.performerId, x, z)}
        onSelect={() => { stageState.selectedPerformerIndex = i; }}
      />
    {/each}
  </svg>
</div>

<style>
  .stage-canvas-container {
    flex: 1;
    min-height: 300px;
    overflow: hidden;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
