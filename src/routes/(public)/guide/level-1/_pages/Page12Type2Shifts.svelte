<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={12}
  title="Type 2 — Shifts"
  figureSrc="/guide/level-1/artboards/1.0 - Type 1 - gamma and Type 2 copy 2.png"
  figureAlt="Type 2 Shift sequences — same direction and opposite direction examples"
>
  {#snippet intro()}
    <p class="center">
      To move between Γ and α/β, you can shift one hand and keep the other hand static.
      <br />
      This combination is called a <span class="shift"><strong>Shift</strong></span> (with a capital "S"). Here's a simple example:
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      <strong><span class="shift">Shifts</span></strong> seem mundane here, but they're very useful later for constructing dynamic sequences.
    </p>
  {/snippet}
</HybridPage>
