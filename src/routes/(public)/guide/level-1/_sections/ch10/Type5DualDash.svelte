<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-5-dual-dash" title="Type 5 - Dual-Dash">
  <p>
    A <span class="type-dual-dash"><strong>Dual-Dash</strong></span> is when
    both hands dash simultaneously to their opposite points.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Both hands dash through center</span>
      <GuideMotionVideo id="t5-dual-dash" label="Dual-dash: both hands dash across the center" />
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
