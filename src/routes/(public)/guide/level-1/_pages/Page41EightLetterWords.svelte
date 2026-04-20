<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={41}
  title="8-Letter Words"
  figureSrc="/guide/level-1/artboards/1.2 - 8-Letter Words - IIΩXKEΣY, CΣNZIθVW.png"
  figureAlt="8-letter word examples — IIΩXKEΣY (Rotated LOOP) and CΣNZIθVW (Mirrored + Swapped LOOP)"
>
  {#snippet intro()}
    <p class="center">
      Words can be any length. These 8-letter words repeat twice, to create 16-count sequences.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      <strong>IIΩXKEΣY</strong> — <em>Rotated LOOP</em>
      <br />
      <strong>CΣNZIθVW</strong> — <em>Mirrored + Swapped LOOP</em>
    </p>
  {/snippet}
</HybridPage>
