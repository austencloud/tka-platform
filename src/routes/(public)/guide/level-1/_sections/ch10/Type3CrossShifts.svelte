<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-3-cross-shifts" title="Type 3 - Cross-Shifts">
  <p>
    A <span class="type-cross-shift"><strong>Cross-Shift</strong></span> combines
    a shift and a dash. One hand shifts to an adjacent point while the other
    dashes straight through the center to the opposite point.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Red shifts, blue dashes</span>
      <GuideMotionVideo id="t3-cross-shift" label="Cross-shift: right hand shifts while left hand dashes across" />
    </div>
  </div>
</GuideSection>

<style>
  .motion-pair {
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
