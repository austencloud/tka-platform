<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
</script>

<GuideSection id="caps" title="CAPs">
  <p>
    When a word ends on a variation of its start position, we can repeat it to trace a complementary
    pattern, eventually returning back to the start position (aka home). This type of sequence is
    called a CAP, aka Continuous Assembly Pattern.
  </p>
  <p>Three common types of CAPs are Mirrored, Rotated, and Swapped.</p>

  <h3>Mirrored</h3>
  <p>
    In a mirrored CAP, the second repetition's pictographs reflect the first, which changes their
    rotation direction. In this example, each column is reflected across a horizontal plane.
  </p>

  <h3>Rotated</h3>
  <p>
    In a rotated CAP, each repetition ends in a rotated variation on its previous position. In this
    example, there is a 90° rotation, finally returning to the start position (aka "home").
  </p>

  <h3>Swapped</h3>
  <p>
    In a swapped CAP, each repetition swaps the roles of right/left. Though the prop's shapes look
    the same, this swap changes the body motion significantly.
  </p>
</GuideSection>
