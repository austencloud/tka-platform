<!--
OptionPictographCell.svelte - Mobile option pictograph cell wrapper

Lightweight wrapper that receives darkMode from parent and delegates to shared primitive.
Used by mobile hierarchy: OptionViewerSwipeLayout → OptionViewerSection → OptionPictographCell

DESIGN PHILOSOPHY:
- Pure rendering component (no state polling, no lifecycle)
- Receives darkModefrom parent to avoid N subscriptions for N pictographs
- Delegates actual rendering to shared OptionPictograph
-->

<script lang="ts">
  import type { PreparedPictographData } from "$lib/shared/pictograph/option/PreparedPictographData";
  import OptionPictograph from "$lib/shared/pictograph/option/OptionPictograph.svelte";

  // Props - darkModeis passed from parent to avoid many subscriptions
  let {
    pictographData,
    blueReversal = false,
    redReversal = false,
    darkMode= false,
  } = $props<{
    pictographData: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
    darkMode: boolean;
  }>();
</script>

<div class="option-pictograph-cell">
  <OptionPictograph
    pictograph={pictographData}
    {blueReversal}
    {redReversal}
    {darkMode}
  />
</div>

<style>
  .option-pictograph-cell {
    width: 100%;
    height: 100%;
    display: block;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
</style>
