<!--
OptionCardContent.svelte - Desktop option card wrapper

Receives darkMode from parent and delegates rendering to shared primitive.
Used by the desktop hierarchy: OptionSection → OptionGrid → OptionCard → OptionCardContent

Note: darkModeis passed from parent to avoid race conditions where the DI
container's animator module might not be loaded yet when the component mounts.
-->
<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import OptionPictograph from "$lib/shared/pictograph/option/OptionPictograph.svelte";

  interface Props {
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
    // Dark mode state - passed from parent to ensure consistency
    darkMode: boolean;
  }

  const {
    pictograph,
    blueReversal = false,
    redReversal = false,
    darkMode = false,
  }: Props = $props();
</script>

<div class="option-card-content">
  <OptionPictograph {pictograph} {blueReversal} {redReversal} {darkMode} />
</div>

<style>
  .option-card-content {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
