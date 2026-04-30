<!--
  RetroProgressBar - Chunky segmented progress indicator

  Renders a 98.css-styled progress bar. In segmented mode, individual
  blocks are rendered inside the track for the classic Win95 file-copy look.
  In smooth mode, a single continuous fill is used.
-->
<script lang="ts">
  let {
    value = 0,
    segmented = false,
  }: {
    value?: number;
    segmented?: boolean;
  } = $props();

  const clampedValue = $derived(Math.max(0, Math.min(100, value)));

  /**
   * Each segment is 8px wide with a 2px gap. We compute how many
   * segments fit in the bar and how many should be filled.
   */
  const SEGMENT_WIDTH = 8;
  const SEGMENT_GAP = 2;
  const SEGMENT_STEP = SEGMENT_WIDTH + SEGMENT_GAP;
</script>

<div
  class="retro-progress"
  role="progressbar"
  aria-valuenow={clampedValue}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Progress: {clampedValue}%"
>
  {#if segmented}
    <div class="retro-progress-track sunken-panel">
      <div class="retro-progress-segments" style="width: {clampedValue}%;">
        <!--
          CSS repeating-linear-gradient creates the segmented block pattern.
          The fill container clips to the percentage width, so only the
          appropriate number of blocks are visible.
        -->
      </div>
    </div>
  {:else}
    <div class="retro-progress-track sunken-panel">
      <div class="retro-progress-fill" style="width: {clampedValue}%;"></div>
    </div>
  {/if}
</div>

<style>
  .retro-progress {
    width: 100%;
  }

  .retro-progress-track {
    height: 16px;
    position: relative;
    overflow: hidden;
    background: var(--retro-field-bg, #fff);
  }

  .retro-progress-fill {
    height: 100%;
    background: var(--retro-navy, #000080);
  }

  .retro-progress-segments {
    height: 100%;
    background: repeating-linear-gradient(
      to right,
      var(--retro-navy, #000080) 0px,
      var(--retro-navy, #000080) 8px,
      var(--retro-field-bg, #fff) 8px,
      var(--retro-field-bg, #fff) 10px
    );
  }
</style>
