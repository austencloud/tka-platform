<!--
OptionPictograph.svelte - DEPRECATED, use PictographRenderer instead

This file re-exports PictographRenderer for backwards compatibility.
Update your imports to use:
  import PictographRenderer from "$lib/shared/pictograph/shared/components/PictographRenderer.svelte";
-->

<script lang="ts">
  import type { PreparedPictographData } from "../shared/domain/models/PreparedPictographData";
  import PictographRenderer from "../shared/components/PictographRenderer.svelte";

  // Re-export old prop names
  let {
    pictograph,
    blueReversal = false,
    redReversal = false,
    darkMode = false,
  } = $props<{
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
    darkMode: boolean;
  }>();
</script>

<PictographRenderer {pictograph} {blueReversal} {redReversal} {darkMode} />
