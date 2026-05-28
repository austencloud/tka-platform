<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionDemo from "../../_components/GuideMotionDemo.svelte";
  import { MotionType } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
</script>

<GuideSection id="hand-motions" title="Hand Motions">
  <p>
    There are three fundamental hand motions in the Alphabet.
  </p>

  <h3>Shift</h3>
  <p>
    A shift moves the hand to an adjacent point. Starting at the south
    point, we can shift to either of the two neighboring points.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Shift to East</span>
      <GuideMotionDemo start="s" end="e" motionType={MotionType.PRO} />
    </div>
    <div class="motion-demo">
      <span class="motion-label">Shift to West</span>
      <GuideMotionDemo start="s" end="w" motionType={MotionType.PRO} />
    </div>
  </div>

  <h3>Dash</h3>
  <p>
    A dash moves the hand straight through the center to the opposite
    point.
  </p>
  <div class="motion-single">
    <div class="motion-demo">
      <span class="motion-label">Dash to North</span>
      <GuideMotionDemo start="s" end="n" motionType={MotionType.DASH} />
    </div>
  </div>

  <h3>Static</h3>
  <p>
    A static motion means the hand stays at the current point.
  </p>
  <div class="motion-single">
    <div class="motion-demo">
      <span class="motion-label">Stay at South</span>
      <GuideMotionDemo start="s" end="s" motionType={MotionType.STATIC} />
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
  .motion-pair {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    margin: 1.5rem 0;
    max-width: 600px;
  }

  .motion-single {
    display: grid;
    grid-template-columns: 1fr;
    max-width: 280px;
    margin: 1.5rem 0;
  }

  .motion-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .motion-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: oklch(0.70 0.04 270);
  }
</style>
