<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import MotionVisualizer from "$lib/features/learn/components/interactive/motions/MotionVisualizer.svelte";
</script>

<GuideSection id="hand-motions" title="Hand Motions">
  <p>
    There are three fundamental hand motions in the Alphabet.
    The arrow shows the direction of motion. The hand shows the end position.
  </p>

  <div class="base-motions">
    <div class="motion-demo">
      <h3>Shift</h3>
      <p>Move to an adjacent point.</p>
      <MotionVisualizer
        leftStart="W" leftEnd="N"
        rightStart="W" rightEnd="N"
        leftMotion="shift" rightMotion="shift"
        showMotionType={false} showLabels
      />
    </div>
    <div class="motion-demo">
      <h3>Dash</h3>
      <p>Move to the opposite point.</p>
      <MotionVisualizer
        leftStart="N" leftEnd="S"
        rightStart="N" rightEnd="S"
        leftMotion="dash" rightMotion="dash"
        showMotionType={false} showLabels
      />
    </div>
    <div class="motion-demo">
      <h3>Static</h3>
      <p>Stay at the current point.</p>
      <MotionVisualizer
        leftStart="N" leftEnd="N"
        rightStart="S" rightEnd="S"
        leftMotion="static" rightMotion="static"
        showMotionType={false} showLabels
      />
    </div>
  </div>

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

<style>
  .base-motions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.5rem;
    margin: 1.5rem 0;
  }

  .motion-demo {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .motion-demo h3 {
    margin: 0;
  }

  .motion-demo p {
    margin: 0 0 0.5rem;
  }
</style>
