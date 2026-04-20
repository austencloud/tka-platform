<script lang="ts">
  import HybridPage from '../_lib/HybridPage.svelte';
</script>

<HybridPage
  pageNumber={31}
  title="Words"
  figureSrc="/guide/level-1/artboards/1.2 - Words.png"
  figureAlt="AABB example shown in three different starting thumb orientations"
>
  {#snippet intro()}
    <p class="center">
      Let's create more complex words using pictographs!
    </p>
    <p class="center">
      In order to perform the words in this section correctly without finger-spinning,
      <em>you must be familiar with negative space and body turns.</em>
      <br />
      If you finger-spin instead of using negative space, you'll lose precision and the ability
      to check your thumb orientation on each beat to see if you're still on track.
    </p>
    <p class="center">
      We'll use the word <strong>AABB</strong> as an example.
      Here are three variations on AABB, starting from different thumb orientations.
      <br />
      <em>Use staves or red/blue pens to follow along.</em>
    </p>
    <p class="center">
      Thumbs:
      <strong>in | in</strong> &nbsp;·&nbsp;
      <strong>out | out</strong> &nbsp;·&nbsp;
      <strong>in | out</strong>
    </p>
  {/snippet}

  {#snippet outro()}
    <p class="center">
      As you execute these with staves, notice that each of these sequences requires a different
      type of negative space, either above/below the shoulder or behind the elbow.
    </p>
    <p class="center">
      The execution of the same word can feel completely different depending on factors like
      the start position, rotation direction, and thumb orientation.
      That's why it's necessary to draw the full sequence with pictographs for complete clarity.
      The Alphabet is primarily a system of pictographs, organized by letters for convenient communication.
    </p>
    <p class="center">
      The letters do not give all of the information, and are merely intended to separate motion
      combinations into categories which can be further clarified with detailed pictographs.
    </p>
  {/snippet}
</HybridPage>
