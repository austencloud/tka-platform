<script lang="ts">
  import SpeedSection from '../../sections/SpeedSection.svelte';
  import OffsetSection from '../../sections/OffsetSection.svelte';

  let {
    currentSpeed = 1.0,
    currentOffset = 0,
    layerCount = 1,
    onSetSpeed,
    onSetOffset,
  }: {
    currentSpeed: number;
    currentOffset: number;
    layerCount?: number;
    onSetSpeed: (speed: number) => void;
    onSetOffset?: (offset: number) => void;
  } = $props();

  const showOffset = $derived(layerCount > 1);
</script>

<div class="playback-body">
  <span class="section-label">SPEED</span>
  <SpeedSection {currentSpeed} {onSetSpeed} />

  {#if showOffset && onSetOffset}
    <span class="section-label">LAYER OFFSET</span>
    <OffsetSection {currentOffset} onSetOffset={onSetOffset} />
  {/if}
</div>

<style>
  .playback-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-label {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.7);
  }
</style>
