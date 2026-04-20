<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={36}
  figureSrc="/guide/level-1/artboards/1.2 - Guide pt. 3 - ACAC, BCBC.png"
  figureAlt="ACAC and BCBC sequences demonstrating prop-reversals required for hybrid combinations"
>
  {#snippet intro()}
    <p class="center">
      When combining a hybrid like <strong>C</strong> with a non-hybrid like <strong>A</strong> or <strong>B</strong>,
      a prop-reversal is necessary. Let's look at the word <strong>ACAC</strong>.
    </p>
    <p class="center">
      In this variation, the left hand does a reversal on every beat. Give it a try.
    </p>
    <p class="center">
      It would be impossible to execute ACAC without using a prop-reversal.
      The previous example shows the hands moving in a continuous path.
      Let's change that in the next example by including a full-reversal in the middle.
      In this example, the reversals alternate between left (R) and right (R).
    </p>
    <p class="center">
      <em>This example uses every type of reversal — hand, prop, and full.
      Challenge yourself to identify where each one occurs.</em>
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      Prop-reversals are also required with <strong>BCBC</strong>, as shown in this example.
      <br />
      Here, the right hand is prop-reversing after every beat. Eventually, it returns to home.
    </p>
  {/snippet}
</HybridPage>
