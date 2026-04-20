<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={25}
  title="Gamma Letters"
  figureSrc="/guide/level-1/artboards/1.1 - Gamma Letters.png"
  figureAlt="Gamma letters: Quarter-Opp letters MP, NQ, OR + Quarter-Same letters STUV"
>
  {#snippet intro()}
    <p class="center">
      Γ→Γ motions can combine with any other Γ→Γ motion to create lots of words!
      <br />
      First let's look at the compound letters (Quarter-Opp).
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      When combined as a continuous motion, these form <strong>MP</strong>, <strong>NQ</strong>, and <strong>OR</strong>.
      Here they are along with a memorable phrase:
      <br />
      <strong>MP</strong> — Magic Potion &nbsp;&nbsp;
      <strong>NQ</strong> — Never Quit &nbsp;&nbsp;
      <strong>OR</strong> — Open Road
    </p>
    <p class="center">
      The final Γ→Γ group (Quarter-Same) has 4 instead of 3.
      It may seem like U and V contain the same information, but it's impossible to rotate or
      reflect U in order to turn it into V, and vice-versa, so they must be disambiguated.
    </p>
    <p class="center">
      Note that all four have a leading hand and a following hand.
      <br />
      <strong>U</strong> leads with an isolation (a round motion like the letter U).
      <strong>V</strong> leads with an antispin (a spiky motion like the letter V).
      <br />
      These self-combine to form the words <strong>SS</strong>, <strong>TT</strong>, <strong>UU</strong>, and <strong>VV</strong>.
    </p>
  {/snippet}
</HybridPage>
