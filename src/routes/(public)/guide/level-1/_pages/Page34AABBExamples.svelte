<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={34}
  title="Examples"
  figureSrc="/guide/level-1/artboards/1.2 - Guide pt 1 - AABB.png"
  figureAlt="AABB sequences with different reversal placements forming a Mirrored LOOP"
>
  {#snippet intro()}
    <p class="center">
      Let's practice reversals and permutations.
      We'll use <strong>AABB</strong> as an example to explore different reversal placements.
      These start from the same alpha start position. Interpret it from the first motions.
    </p>
    <p class="center">
      Here's an AABB in which both staves execute prop-reversals after beats 2 and 4,
      notated by an "<strong>R/R</strong>" in between the pictographs.
      <br />
      <em>This requires negative space or a body turn to execute.</em>
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      Let's place the reversals in a different place. This time we'll put them after beat 1.
      <br />
      This will put our left hand on top after beat 4, so we'll repeat the sequence again mirrored
      (with a reversal after beat 5) to return to our original home position.
      <br />
      <em>This is a Mirrored LOOP.</em>
    </p>
    <p class="center">
      Now let's look at another variation of <strong>AABB×2</strong> with reversals after beats 3 &amp; 7.
    </p>
    <p class="center">
      As demonstrated with these examples, a reversal in different locations in the word
      can lead to a notably different outcome.
      <br />
      The word AABB is not limited to one presentation, it is a broad category of sequences
      that includes those letters with variations on reversals and thumb orientation.
    </p>
  {/snippet}
</HybridPage>
