<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="compound-words" title="Compound Words">
  <p>
    These are the simplest words that use the compound letters DJ, EK, and FL.
    For Tog-Opp, cross your arms or body turn to use the plane behind you.
    For Split-Opp, either body turn or use negative space.
    Both versions are equally valid. Try them yourself!
  </p>

  <div class="compound-words-grid">
    <div class="word-pair">
      <GuideDiagram
        src="/guide/level-1/images/compound-words/DJ_TogOpp.png"
        alt="DJ sequence in Tog-Opp"
        caption="DJ — Tog-Opp"
      />
      <GuideDiagram
        src="/guide/level-1/images/compound-words/DJ_SplitOpp.png"
        alt="DJ sequence in Split-Opp"
        caption="DJ — Split-Opp"
      />
    </div>

    <div class="word-pair">
      <GuideDiagram
        src="/guide/level-1/images/compound-words/EK_TogOpp.png"
        alt="EK sequence in Tog-Opp"
        caption="EK — Tog-Opp"
      />
      <GuideDiagram
        src="/guide/level-1/images/compound-words/EK_SplitOpp.png"
        alt="EK sequence in Split-Opp"
        caption="EK — Split-Opp"
      />
    </div>

    <div class="word-pair">
      <GuideDiagram
        src="/guide/level-1/images/compound-words/FL_TogOpp.png"
        alt="FL sequence in Tog-Opp"
        caption="FL — Tog-Opp"
      />
      <GuideDiagram
        src="/guide/level-1/images/compound-words/FL_SplitOpp.png"
        alt="FL sequence in Split-Opp"
        caption="FL — Split-Opp"
      />
    </div>
  </div>
</GuideSection>

<style>
  .compound-words-grid {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin: 1.5rem 0;
  }

  .word-pair {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
  }
</style>
