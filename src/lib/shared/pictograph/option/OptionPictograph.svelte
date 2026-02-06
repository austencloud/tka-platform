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
  // NOTE: darkMode removed - CSS-first approach uses :root.dark class
  let {
    pictograph,
    blueReversal = false,
    redReversal = false,
  } = $props<{
    pictograph: PreparedPictographData;
    blueReversal?: boolean;
    redReversal?: boolean;
  }>();
</script>

<PictographRenderer {pictograph} {blueReversal} {redReversal} />
