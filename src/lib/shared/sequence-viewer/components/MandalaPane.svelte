<script lang="ts">
  import SequenceMandala from "$lib/shared/mandala/components/SequenceMandala.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { UndulationEasing, MandalaPathShape } from "$lib/shared/mandala/components/SequenceMandala.svelte";

  interface Props {
    sequence: SequenceData;
    bluePropType?: string;
    redPropType?: string;
  }

  let { sequence, bluePropType, redPropType }: Props = $props();

  let containerEl: HTMLDivElement | undefined = $state();
  let containerSize: number = $state(400);

  let paused: boolean = $state(false);
  let pathShape: MandalaPathShape = $state("arc");
  let easing: UndulationEasing = $state("breathe");
  let rotation: number = $state(90);
  let period: number = $state(5);
  let rangeMin: number = $state(0);
  let rangeMax: number = $state(250);

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      containerSize = Math.floor(Math.min(width, height) - 32);
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });
</script>

<div class="mandala-pane" bind:this={containerEl}>
  <div class="mandala-stage">
    <SequenceMandala
      {sequence}
      animate={!paused}
      animateMin={rangeMin}
      animateMax={rangeMax}
      animatePeriod={period}
      animateEasing={easing}
      animateRotation={rotation}
      {pathShape}
      size={containerSize}
      {bluePropType}
      {redPropType}
      mode="gallery"
      style="stroke"
      show="both"
    />
  </div>
</div>

<style>
  .mandala-pane {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a1a;
    position: relative;
    overflow: hidden;
  }

  .mandala-stage {
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
