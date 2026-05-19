<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="type-1-caps" title="Type 1 CAPs">
  <p>
    In this example of DJII, the graphs in the second repetition (beats 5-8) mirror the graphs in
    the first repetition (beats 1-4), classifying it as a Mirrored CAP.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/type-1-caps/DJII.png"
    alt="DJII — Mirrored CAP"
    caption="DJII — Mirrored CAP"
  />

  <GuideDiagram
    src="/guide/level-1/images/type-1-caps/BBLF.png"
    alt="BBLF — Swapped & Rotated CAP"
    caption="BBLF — Swapped & Rotated CAP"
  />

  <p>
    In this example of KIEC, the colors are swapped in the second half, so it is classified as a
    Swapped & Mirrored CAP.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/type-1-caps/KIEC.png"
    alt="KIEC — Swapped & Mirrored CAP"
    caption="KIEC — Swapped & Mirrored CAP"
  />
</GuideSection>
