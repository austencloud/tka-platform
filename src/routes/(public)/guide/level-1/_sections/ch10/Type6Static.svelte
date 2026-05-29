<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-6-static" title="Type 6 - Static">
  <p>
    <span class="type-static"><strong>Static</strong></span> means both hands
    remain at their current positions. No motion occurs.
  </p>
  <p>
    Later, static positions gain complexity when adding prop rotations.
  </p>
  <div class="motion-trio">
    <div class="motion-demo">
      <span class="motion-label">Static at alpha</span>
      <GuideMotionVideo id="t6-static-alpha" label="Static: both hands hold at alpha (opposite points)" />
    </div>
    <div class="motion-demo">
      <span class="motion-label">Static at beta</span>
      <GuideMotionVideo id="t6-static-beta" label="Static: both hands hold at beta (same point)" />
    </div>
    <div class="motion-demo">
      <span class="motion-label">Static at gamma</span>
      <GuideMotionVideo id="t6-static-gamma" label="Static: both hands hold at gamma (right angle)" />
    </div>
  </div>
</GuideSection>

<style>
  .motion-trio {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
    margin: 1.5rem 0;
    max-width: 700px;
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
