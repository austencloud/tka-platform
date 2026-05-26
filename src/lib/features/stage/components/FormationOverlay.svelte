<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);

  let containerEl: HTMLDivElement | null = $state(null);
  let svgWidth = $state(800);
  let svgHeight = $state(600);

  const margin = 48;

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]!;
      svgWidth = entry.contentRect.width;
      svgHeight = entry.contentRect.height;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  function stageToSvgX(x: number): number {
    return margin + (x / choreography.stageWidth) * (svgWidth - margin * 2);
  }

  function stageToSvgZ(z: number): number {
    return margin + (z / choreography.stageDepth) * (svgHeight - margin * 2);
  }

  function svgToStageX(svgX: number): number {
    return ((svgX - margin) / (svgWidth - margin * 2)) * choreography.stageWidth;
  }

  function svgToStageZ(svgZ: number): number {
    return ((svgZ - margin) / (svgHeight - margin * 2)) * choreography.stageDepth;
  }

  let draggingMarkId: string | null = $state(null);

  function handleMarkPointerDown(e: PointerEvent, markId: string, performerId: string) {
    e.preventDefault();
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    draggingMarkId = markId;
    editMode.isDragging = true;
    editMode.selectMark(performerId, markId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!draggingMarkId) return;
    const svg = containerEl?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgZ = e.clientY - rect.top;
    const stageX = svgToStageX(svgX);
    const stageZ = svgToStageZ(svgZ);
    stageState.updateMarkPosition(draggingMarkId, stageX, stageZ);
  }

  function handlePointerUp() {
    draggingMarkId = null;
    editMode.isDragging = false;
  }

  function handleStageClick(e: MouseEvent) {
    if (!editMode.selectedPerformerId) return;
    if (editMode.isDragging) return;
    const svg = containerEl?.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgZ = e.clientY - rect.top;
    const stageX = svgToStageX(svgX);
    const stageZ = svgToStageZ(svgZ);
    stageState.addMark(editMode.selectedPerformerId, stageX, stageZ);
  }

  const dotRadius = 24;
  const markRadius = 16;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="formation-overlay"
  bind:this={containerEl}
  role="region"
  aria-label="Stage formation overlay"
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
>
  <svg
    width={svgWidth}
    height={svgHeight}
    xmlns="http://www.w3.org/2000/svg"
    role="application"
    aria-label="Formation editor"
  >
    <!-- Stage boundary double ring -->
    <rect
      x={margin}
      y={margin}
      width={svgWidth - margin * 2}
      height={svgHeight - margin * 2}
      fill="none"
      stroke="rgba(255, 255, 255, 0.15)"
      stroke-width="2"
      rx="8"
    />
    <rect
      x={margin - 4}
      y={margin - 4}
      width={svgWidth - margin * 2 + 8}
      height={svgHeight - margin * 2 + 8}
      fill="none"
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width="1"
      rx="10"
    />

    <!-- Dot grid at 1m intervals -->
    {#each Array.from({ length: Math.floor(choreography.stageWidth) + 1 }, (_, i) => i) as x}
      {#each Array.from({ length: Math.floor(choreography.stageDepth) + 1 }, (_, i) => i) as z}
        <circle
          cx={stageToSvgX(x)}
          cy={stageToSvgZ(z)}
          r="1.5"
          fill="rgba(255, 255, 255, 0.12)"
        />
      {/each}
    {/each}

    <!-- Center crosshair -->
    <line
      x1={stageToSvgX(choreography.stageWidth / 2)}
      y1={margin}
      x2={stageToSvgX(choreography.stageWidth / 2)}
      y2={svgHeight - margin}
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width="1"
      stroke-dasharray="4 4"
    />
    <line
      x1={margin}
      y1={stageToSvgZ(choreography.stageDepth / 2)}
      x2={svgWidth - margin}
      y2={stageToSvgZ(choreography.stageDepth / 2)}
      stroke="rgba(255, 255, 255, 0.06)"
      stroke-width="1"
      stroke-dasharray="4 4"
    />

    <!-- Click target for adding marks -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <rect
      x={margin}
      y={margin}
      width={svgWidth - margin * 2}
      height={svgHeight - margin * 2}
      fill="transparent"
      onclick={handleStageClick}
      style="cursor: {editMode.selectedPerformerId ? 'crosshair' : 'default'}"
    />

    <!-- Per-performer paths and marks -->
    {#each choreography.performers as performer}
      {@const isSelected = editMode.multiSelectedPerformerIds.has(performer.id)}

      <!-- Path lines between marks -->
      {#each performer.marks as mark, i}
        {#if i > 0}
          {@const prevMark = performer.marks[i - 1]!}
          <line
            x1={stageToSvgX(prevMark.x)}
            y1={stageToSvgZ(prevMark.z)}
            x2={stageToSvgX(mark.x)}
            y2={stageToSvgZ(mark.z)}
            stroke={performer.color}
            stroke-width={isSelected ? 2 : 1}
            stroke-opacity={isSelected ? 0.8 : 0.3}
            stroke-dasharray={isSelected ? 'none' : '4 4'}
          />

          <!-- Beat label midpoint -->
          {#if isSelected}
            <text
              x={(stageToSvgX(prevMark.x) + stageToSvgX(mark.x)) / 2}
              y={(stageToSvgZ(prevMark.z) + stageToSvgZ(mark.z)) / 2 - 8}
              text-anchor="middle"
              fill={performer.color}
              font-size="12"
              font-weight="600"
              opacity="0.8"
            >{mark.beats}b</text>
          {/if}
        {/if}
      {/each}

      <!-- Marks -->
      {#each performer.marks as mark, i}
        {#if i === 0}
          <!-- Origin dot (48px diameter = 24 radius) -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            onpointerdown={(e) => handleMarkPointerDown(e, mark.id, performer.id)}
            style="cursor: grab; touch-action: none;"
            role="button"
            tabindex="0"
            aria-label="Performer {performer.label} origin at {mark.x.toFixed(1)}, {mark.z.toFixed(1)}"
          >
            <circle
              cx={stageToSvgX(mark.x)}
              cy={stageToSvgZ(mark.z)}
              r={dotRadius}
              fill={performer.color}
              fill-opacity="0.9"
              stroke={editMode.selectedMarkId === mark.id ? 'white' : 'none'}
              stroke-width="2"
            />
            <text
              x={stageToSvgX(mark.x)}
              y={stageToSvgZ(mark.z) + 5}
              text-anchor="middle"
              fill="white"
              font-size="16"
              font-weight="700"
              pointer-events="none"
            >{performer.label}</text>
          </g>
        {:else}
          <!-- Numbered mark -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            onpointerdown={(e) => handleMarkPointerDown(e, mark.id, performer.id)}
            style="cursor: grab; touch-action: none;"
            role="button"
            tabindex="0"
            aria-label="Performer {performer.label} mark {i} at {mark.x.toFixed(1)}, {mark.z.toFixed(1)}"
          >
            <circle
              cx={stageToSvgX(mark.x)}
              cy={stageToSvgZ(mark.z)}
              r={markRadius}
              fill={performer.color}
              fill-opacity="0.7"
              stroke={editMode.selectedMarkId === mark.id ? 'white' : 'none'}
              stroke-width="2"
            />
            <text
              x={stageToSvgX(mark.x)}
              y={stageToSvgZ(mark.z) + 4}
              text-anchor="middle"
              fill="white"
              font-size="12"
              font-weight="600"
              pointer-events="none"
            >{i}</text>
          </g>
        {/if}
      {/each}
    {/each}

    <!-- Labels -->
    <text
      x={svgWidth / 2}
      y={margin - 16}
      text-anchor="middle"
      fill="rgba(255, 255, 255, 0.35)"
      font-size="11"
      font-weight="600"
      letter-spacing="1"
    >AUDIENCE</text>
    <text
      x={svgWidth / 2}
      y={svgHeight - margin + 24}
      text-anchor="middle"
      fill="rgba(255, 255, 255, 0.35)"
      font-size="11"
      font-weight="600"
      letter-spacing="1"
    >BACKSTAGE</text>
  </svg>
</div>

<style>
  .formation-overlay {
    position: absolute;
    inset: 0;
    pointer-events: all;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    svg * {
      transition: none !important;
    }
  }
</style>
