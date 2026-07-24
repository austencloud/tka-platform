<script lang="ts">
  import { onMount } from "svelte";

  let {
    currentStep = 0,
    isPlaying = false,
    onInitialized = () => {},
  }: {
    currentStep?: number;
    isPlaying?: boolean;
    onInitialized?: () => void;
  } = $props();

  onMount(onInitialized);
</script>

<div
  data-testid="animator"
  data-current-step={currentStep}
  data-playing={isPlaying}
></div>
