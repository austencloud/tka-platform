<script lang="ts">
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  let { pictographData }: { pictographData: PictographData } = $props();
</script>

<div
  data-testid="placement-pictograph"
  data-blue-location={pictographData.motions.blue?.endLocation}
  data-red-location={pictographData.motions.red?.endLocation}
  data-beta-swapped={pictographData.betaSwapped === true}
  data-letter={pictographData.letter}
  data-step-number={"stepNumber" in pictographData
    ? pictographData.stepNumber
    : undefined}
  data-grid-mode={pictographData.gridMode}
></div>
