<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-1-gamma" title="Gamma">
  <p>
    When both hands start at a right angle to each other (gamma),
    dual-shifts create a different set of movements.
  </p>
  <p>
    In gamma, one hand is at a cardinal point and the other is at an
    adjacent cardinal point, forming a 90-degree angle through the center.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Gamma to gamma</span>
      <GuideMotionVideo id="t1-gamma-to-gamma" label="Dual-shift from gamma to gamma" />
    </div>
    <div class="motion-demo">
      <span class="motion-label">Gamma (opposite direction)</span>
      <GuideMotionVideo id="t1-gamma-opposite" label="Dual-shift at gamma, hands moving in opposite directions" />
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
