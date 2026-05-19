<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="alpha-beta-words" title="Alpha/Beta Words">
  <h3>Same Direction</h3>
  <p>
    The first words we will learn correspond to VTG's 1:1 motions. To execute these,
    you'll need to use body turns and/or negative space. Practice each word once in both
    directions, then again starting with thumbs out.
  </p>

  <h3>Split-Same</h3>
  <div class="word-row">
    <GuideDiagram
      src="/guide/level-1/images/alpha-beta-words/A.png"
      alt="Word AAAA — four consecutive A letters"
      caption="AAAA"
    />
    <GuideDiagram
      src="/guide/level-1/images/alpha-beta-words/B.png"
      alt="Word BBBB — four consecutive B letters"
      caption="BBBB"
    />
    <GuideDiagram
      src="/guide/level-1/images/alpha-beta-words/C.png"
      alt="Word CCCC — four consecutive C letters"
      caption="CCCC"
    />
  </div>

  <h3>Tog-Same</h3>
  <div class="word-row">
    <GuideDiagram
      src="/guide/level-1/images/alpha-beta-words/G.png"
      alt="Word GGGG — four consecutive G letters"
      caption="GGGG"
    />
    <GuideDiagram
      src="/guide/level-1/images/alpha-beta-words/H.png"
      alt="Word HHHH — four consecutive H letters"
      caption="HHHH"
    />
    <GuideDiagram
      src="/guide/level-1/images/alpha-beta-words/I.png"
      alt="Word IIII — four consecutive I letters"
      caption="IIII"
    />
  </div>
</GuideSection>

<style>
  .word-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
    margin: 1rem 0;
  }
</style>
