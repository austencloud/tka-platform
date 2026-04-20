<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={27}
  figureSrc="/guide/level-1/artboards/1.1 - Type 2 - Shifts.png"
  figureAlt="Type 2 Shift letters W, X, Y, Z and Sigma, Delta, Theta, Omega"
>
  {#snippet intro()}
    <p class="center" style="font-size: 1.5rem; font-style: italic; font-weight: 500;">
      <span class="shift">Type 2</span> — <span class="shift">Shift</span>
    </p>
    <p class="center">
      So far we've learned how to move between α↔β and between Γ→Γ.
      In order to travel between these two modes, we can use a Type 2 Motion called a <span class="shift">Shift</span>.
    </p>
    <p class="center">
      A <span class="shift">Shift</span> (or single shift) is the combination of one shift and one static motion.
      Their letters are organized by end position: α, β, then Γ.
      These can also be categorized by opening or closing.
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      When we arrange them in continuous motions, we get the words <strong>WY</strong> and <strong>XZ</strong>.
    </p>
    <p class="center">
      Though simple at this stage, these motions become more complex as we dive deeper into the Alphabet
      and add rotations to static motions.
    </p>
  {/snippet}
</HybridPage>
