<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="sixteen-count" title="16-Count Sequences">
  <p>These 4-letter words repeat 4 times, giving us 16-count sequences.</p>

  <p>
    G&#x3B8;OZ: Here, each repetition of the word ends in a &#x393; that is 90° from its start.
    This means it will take 4 repetitions to return to home. (Rotated+Swapped LOOP)
  </p>
  <GuideDiagram
    src="/guide/level-1/images/16-count-sequences/GθOZ.png"
    alt="GθOZ: 16-count Rotated+Swapped LOOP"
    caption="G&#x3B8;OZ: Rotated+Swapped LOOP"
  />

  <p>
    E&#x394;QY: Here, the staves return to home after two word repetitions. To make it symmetrical,
    it repeats twice more, filling the rest of the quadrants. (Rotated + Mirrored + Swapped LOOP)
  </p>
  <GuideDiagram
    src="/guide/level-1/images/16-count-sequences/EΔQY.png"
    alt="EΔQY: 16-count Rotated + Mirrored + Swapped LOOP"
    caption="E&#x394;QY: Rotated + Mirrored + Swapped LOOP"
  />
</GuideSection>
