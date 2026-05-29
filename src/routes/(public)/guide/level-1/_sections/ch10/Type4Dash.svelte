<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="type-4-dash" title="Type 4 - Dash">
  <p>
    A <span class="type-dash"><strong>Dash</strong></span> (capital D) is when
    one hand dashes to the opposite point while the other stays still.
  </p>
  <div class="motion-pair">
    <div class="motion-demo">
      <span class="motion-label">Red dashes, blue stays</span>
      <GuideMotionVideo id="t4-dash" label="Dash: right hand dashes across while left hand stays static" />
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
