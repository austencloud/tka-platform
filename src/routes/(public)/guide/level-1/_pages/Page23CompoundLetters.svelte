<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={23}
  title="Compound Letters"
  figureSrc="/guide/level-1/artboards/1.1 - Compound Letters.png"
  figureAlt="Compound letters: Tog-Opp and Split-Opp variants forming DJ, EK, FL"
>
  {#snippet intro()}
    <p class="center">
      Now let's look at the letters that move from α↔β.
      All pictographs can be rotated or mirrored without changing letters.
      These can be either <em>Tog-Opp</em> or <em>Split-Opp</em> depending on which α/β you start from.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      These compound letters can't be self-combined like the previous letters.
      Instead, they combine with other compound letters to form the words <strong>DJ</strong>, <strong>EK</strong>, and <strong>FL</strong>.
    </p>
    <p class="center">
      Here they are along with cute phrases to help you remember:
      <br />
      <strong>DJ</strong> — Disco Jam &nbsp;&nbsp;
      <strong>EK</strong> — Exploding Kitten &nbsp;&nbsp;
      <strong>FL</strong> — Fruity Loops
    </p>
  {/snippet}
</HybridPage>
