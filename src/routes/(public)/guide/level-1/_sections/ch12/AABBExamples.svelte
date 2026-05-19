<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideDiagram from "../../_components/GuideDiagram.svelte";
</script>

<GuideSection id="aabb-examples" title="Examples — AABB">
  <p>
    Let's practice reversals and permutations. We'll use AABB as an example to explore different
    reversal placements. These start from the same alpha start position. Interpret it from the first
    motions.
  </p>

  <p>
    Here's an AABB in which both staves execute prop-reversals after beats 2 and 4, notated by an
    "R/R" in between the pictographs. This requires negative space or a body turn to execute.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/abc-examples/AABB_prop_revs.png"
    alt="AABB with prop-reversals after beats 2 and 4"
    caption="AABB with prop-reversals after beats 2 and 4"
  />

  <p>
    Let's place the reversals in a different place. This time we'll put them after beat 1. This will
    put our left hand on top after beat 4, so we'll repeat the sequence again mirrored (with a
    reversal after beat 5) to return to our original home position. This is a Mirrored CAP.
  </p>
  <GuideDiagram
    src="/guide/level-1/images/abc-examples/AABB_mir_perm.png"
    alt="AABB mirrored CAP with reversals after beat 1"
    caption="AABB Mirrored CAP"
  />

  <p>Now let's look at another variation of AABB×2 with reversals after beats 3 & 7.</p>
  <GuideDiagram
    src="/guide/level-1/images/abc-examples/AABB_mir_perm_2.png"
    alt="AABB×2 with reversals after beats 3 and 7"
    caption="AABB×2 with reversals after beats 3 & 7"
  />

  <p>
    As demonstrated with these examples, a reversal in different locations in the word can lead to a
    notably different outcome. The word AABB is not limited to one presentation, it is a broad
    category of sequences that includes those letters with variations on reversals and thumb
    orientation.
  </p>
</GuideSection>
