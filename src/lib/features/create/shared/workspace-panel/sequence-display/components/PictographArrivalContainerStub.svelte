<script lang="ts">
  import { onMount } from "svelte";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

  let {
    pictographData,
    motionStartData = null,
    motionProgress = null,
    arrowOpacity = 0,
    onReady = () => {},
  }: {
    pictographData: StepData;
    motionStartData?: StepData | null;
    motionProgress?: number | null;
    arrowOpacity?: number;
    onReady?: () => void;
  } = $props();

  onMount(() => {
    const frame = requestAnimationFrame(onReady);
    return () => cancelAnimationFrame(frame);
  });
</script>

<div
  data-testid="arrival-pictograph"
  data-step-id={pictographData.id}
  data-motion-start-id={motionStartData?.id}
  data-motion-progress={motionProgress}
  data-arrow-opacity={arrowOpacity}
></div>
