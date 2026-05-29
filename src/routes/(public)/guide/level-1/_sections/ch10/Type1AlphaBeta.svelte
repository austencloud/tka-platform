<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-1-alpha-beta" title="Type 1 - Dual-Shifts">
  <p>
    When both hands shift to adjacent points at the same time, the combination
    is called a <span class="type-dual-shift"><strong>Dual-Shift</strong></span>.
  </p>

  <h3>Split-Same (Alpha to Alpha)</h3>
  <p>
    When both hands start apart (alpha) and end apart (alpha), they travel
    in parallel paths between two pairs of adjacent points.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Both hands shift (same direction)</span>
      <GuideMotionVideo id="t1-split-same" label="Dual-shift: both hands shift in parallel, alpha to alpha" />
    </div>
  </div>

  <h3>Together-Same (Beta to Beta)</h3>
  <p>
    When both hands start together (beta) and end together (beta),
    they shift from one shared point to another shared point.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Both hands shift from south</span>
      <GuideMotionVideo id="t1-together-same" label="Dual-shift: both hands shift from south, beta to beta" />
    </div>
  </div>

  <h3>Alpha and Beta (Split to Together)</h3>
  <p>
    Hands can also shift between alpha and beta. Starting apart,
    both shift toward the same point and end together, or vice versa.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Split to together</span>
      <GuideMotionVideo id="t1-split-to-together" label="Dual-shift: hands start apart and end together" />
    </div>
    <div class="motion-demo">
      <span class="motion-label">Together to split</span>
      <GuideMotionVideo id="t1-together-to-split" label="Dual-shift: hands start together and end apart" />
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
