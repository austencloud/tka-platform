<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="type-1-loops" title="Type 1 LOOPs">
  <p>
    In this example of DJII, the graphs in the second repetition (steps 5-8) mirror the graphs in
    the first repetition (steps 1-4), classifying it as a Mirrored LOOP.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/type-1-caps/DJII.png"
    alt="DJII: Mirrored LOOP"
    caption="DJII: Mirrored LOOP"
  />

  <GuideDiagram
    src="/guide/level-1/images/type-1-caps/BBLF.png"
    alt="BBLF: Swapped & Rotated LOOP"
    caption="BBLF: Swapped & Rotated LOOP"
  />

  <p>
    In this example of KIEC, the colors are swapped in the second half, so it is classified as a
    Swapped & Mirrored LOOP.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/type-1-caps/KIEC.png"
    alt="KIEC: Swapped & Mirrored LOOP"
    caption="KIEC: Swapped & Mirrored LOOP"
  />
</GuideSection>
