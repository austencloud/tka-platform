<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={28}
  figureSrc="/guide/level-1/artboards/1.1 - Type 3 - Cross-Shifts.png"
  figureAlt="Type 3 Cross-Shift letters W-, X-, Y-, Z- and Sigma-, Delta-, Theta-, Omega- with halfway breakdowns"
>
  {#snippet intro()}
    <p class="center" style="font-size: 1.5rem; font-style: italic; font-weight: 500;">
      <span class="cross">Type 3</span> — <span class="cross">Cross</span><span class="shift">-Shift</span>
    </p>
    <p class="center">
      <span class="cross">Cross-Shifts</span> use the same letters as Shifts, but each letter is followed by a dash
      to indicate that the other hand is dashing into its end position.
      They are spoken as "W Dash" or "Sigma Dash".
      A dash symbol in the glyph equals a dash arrow on the graph.
      The end position for each Type 2/3 letter remains the same.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      <span class="cross">Cross-Shifts</span> can be tricky to remember.
      It helps to first picture the corresponding Type 2 pictograph,
      then add the dash arrow without changing any other variables.
    </p>
    <p class="center">
      When initially learning, it's useful to pause at the halfway point to ensure proper timing.
    </p>
  {/snippet}
</HybridPage>
