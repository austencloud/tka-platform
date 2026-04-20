<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={32}
  title="LOOPs"
  figureSrc="/guide/level-1/artboards/1.2 - Permutations.png"
  figureAlt="Mirrored, Rotated, and Swapped LOOP type examples"
>
  {#snippet intro()}
    <p class="center">
      When a word ends on a variation of its start position, we can repeat it to trace a complementary pattern,
      eventually returning back to the start position (aka <strong>home</strong>).
      <br />
      This type of sequence is called a <strong>LOOP</strong> — a Continuous Assembly Pattern.
    </p>
    <p class="center">
      Three common types of LOOPs are <strong>Mirrored</strong>, <strong>Rotated</strong>, and <strong>Swapped</strong>.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center"><strong>Mirrored</strong></p>
    <p class="center">
      In a <em>mirrored</em> LOOP, the second repetition's pictographs reflect the first,
      which changes their rotation direction.
      <br />
      In this example, each column is reflected across a horizontal plane.
    </p>
    <p class="center"><strong>Rotated</strong></p>
    <p class="center">
      In a <em>rotated</em> LOOP, each repetition ends in a rotated variation on its previous position.
      <br />
      In this example, there is a 90° rotation, finally returning to the start position (aka "home").
    </p>
    <p class="center"><strong>Swapped</strong></p>
    <p class="center">
      In a <em>swapped</em> LOOP, each repetition swaps the roles of right/left.
      <br />
      Though the prop's shapes look the same, this swap changes the body motion significantly.
    </p>
  {/snippet}
</HybridPage>
