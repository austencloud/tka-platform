<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={33}
  title="Reversals"
  figureSrc="/guide/level-1/artboards/1.2 - Reversals.png"
  figureAlt="Hand-reversal, Prop-reversal, and Full-reversal examples with R/R notation"
>
  {#snippet intro()}
    <p class="center">
      Reversals open up a huge number of possibilities! There are three types of reversals:
      <br />
      <strong>Hand-reversal</strong>, <strong>Prop-reversal</strong>, and <strong>Full-reversal</strong>.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center"><strong>Hand-reversal</strong> — Pro→Anti, Anti→Pro</p>
    <p class="center">
      With a hand reversal, the hand returns to the point it came from previously,
      without changing the prop's direction of spin.
      Relative to the center point, this changes a prospin to an antispin and vice-versa.
      <br />
      <em>This is the simplest and least disruptive reversal. We've already used it in the previous examples.</em>
    </p>
    <p class="center"><strong>Prop-reversal</strong> — Pro→Anti, Anti→Pro</p>
    <p class="center">
      With a prop reversal, the hand continues to the next point while the prop reverses direction.
      This reversal also changes a prospin into an antispin and vice-versa.
      <br />
      Since a prop reversal is less intuitive, an "<strong>R/R</strong>" is added in the corresponding color
      in between the pictographs to indicate it.
    </p>
    <p class="center"><strong>Full-reversal</strong> — Pro→Pro, Anti→Anti</p>
    <p class="center">
      With a full-reversal, the prop and hand retrace their paths and return to their previous position,
      as if going backwards in time.
      <br />
      Because this contains a prop reversal, the "<strong>R/R</strong>" draws attention to it.
      This succinctly indicates to the performer that something unusual is happening.
    </p>
  {/snippet}
</HybridPage>
