<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
</script>

<GuideSection id="hand-motions" title="Hand Motions">
  <p>
    There are three fundamental hand motions in the Alphabet.
    The arrow shows the direction of motion. The hand shows the end position.
  </p>

  <h3>Shift</h3>
  <p>Move to an adjacent point.</p>

  <h3>Dash</h3>
  <p>Move to the opposite point.</p>

  <h3>Static</h3>
  <p>Stay at the current point.</p>

  <h3>Six Combinations</h3>
  <p>Using these, we can derive six combinations, named below:</p>
  <ol>
    <li><span class="type-dual-shift"><strong>Dual-Shift:</strong></span> Both hands travel to an adjacent point.</li>
    <li><span class="type-shift"><strong>Shift:</strong></span> One hand travels to an adjacent point and the other hand remains static.</li>
    <li><span class="type-cross-shift"><strong>Cross-Shift:</strong></span> One hand travels to an adjacent point and the other travels to the opposite point.</li>
    <li><span class="type-dash"><strong>Dash:</strong></span> One hand travels to the opposite point and the other hand remains static.</li>
    <li><span class="type-dual-dash"><strong>Dual-Dash:</strong></span> Both hands travel to the opposite point.</li>
    <li><span class="type-static"><strong>Static:</strong></span> Both hands remain static.</li>
  </ol>
</GuideSection>
