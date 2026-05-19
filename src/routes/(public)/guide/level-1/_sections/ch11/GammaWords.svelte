<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="gamma-words" title="Gamma Words">
  <p>
    These are the simplest 4-letter words created with continuous &#915; motions:
  </p>

  <h3>Opp</h3>
  <div class="word-row">
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/MP.png"
      alt="MP word sequence"
      caption="MP"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/NQ.png"
      alt="NQ word sequence"
      caption="NQ"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/OR.png"
      alt="OR word sequence"
      caption="OR"
    />
  </div>

  <h3>Same</h3>
  <div class="word-row">
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/S.png"
      alt="SS word sequence"
      caption="SS"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/T.png"
      alt="TT word sequence"
      caption="TT"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/U.png"
      alt="UU word sequence"
      caption="UU"
    />
    <GuideDiagram
      src="/guide/level-1/images/gamma-words/V.png"
      alt="VV word sequence"
      caption="VV"
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
