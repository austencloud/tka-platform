<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-2-shifts" title="Type 2 - Shifts">
  <p>
    A <span class="type-shift"><strong>Shift</strong></span> (capital S) is when
    one hand shifts to an adjacent point while the other hand stays still.
    Shifts move you between gamma and alpha/beta.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Red shifts, blue stays</span>
      <GuideMotionVideo id="t2-red-shifts" label="Shift: right hand shifts while left hand stays static" />
    </div>
    <div class="motion-demo">
      <span class="motion-label">Blue shifts, red stays</span>
      <GuideMotionVideo id="t2-blue-shifts" label="Shift: left hand shifts while right hand stays static" />
    </div>
  </div>
</GuideSection>

<style>
  .motion-pair {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
    margin: 1.5rem 0;
    max-width: 600px;
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
