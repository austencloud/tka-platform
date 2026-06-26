<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
</script>

<GuideSection id="loops" title="LOOPs">
  <p>
    When a word ends on a variation of its start position, we can repeat it with a transformation
    applied, eventually returning back to the start position (aka home). This type of sequence is
    called a LOOP.
  </p>
  <p>LOOPs have six base transformation types:</p>
  <ul>
    <li><strong>Rotated:</strong> each repetition's pictographs are rotated (e.g. 90° or 180°) from the previous.</li>
    <li><strong>Mirrored:</strong> each repetition reflects the previous, changing rotation direction.</li>
    <li><strong>Swapped:</strong> each repetition swaps the roles of right and left hands.</li>
    <li><strong>Flipped:</strong> each repetition flips the previous across an axis.</li>
    <li><strong>Inverted:</strong> each repetition inverts the motion type (pro ↔ anti).</li>
    <li><strong>Rewound:</strong> each repetition retraces the previous in reverse order.</li>
  </ul>
  <p>
    These base types can combine into compound LOOPs like mirrored-swapped or rotated-inverted.
  </p>

  <h3>Rotated</h3>
  <p>
    In a rotated LOOP, each repetition ends in a rotated variation on its previous position. In this
    example, there is a 90° rotation, finally returning to the start position (aka "home").
  </p>

  <h3>Mirrored</h3>
  <p>
    In a mirrored LOOP, the second repetition's pictographs reflect the first, which changes their
    rotation direction. In this example, each column is reflected across a horizontal plane.
  </p>

  <h3>Swapped</h3>
  <p>
    In a swapped LOOP, each repetition swaps the roles of right/left. Though the prop's shapes look
    the same, this swap changes the body motion significantly.
  </p>
</GuideSection>
