<script lang="ts">
  import GuideSection from "../../_components/GuideSection.svelte";
  import GuideMotionVideo from "../../_components/GuideMotionVideo.svelte";
</script>

<GuideSection id="hand-motions" title="Hand Motions">
  <p>
    There are three fundamental hand motions in the Alphabet.
    The arrow shows the direction of motion.
    The hand shows the end position.
  </p>

  <div class="motion-flowchart">
    <div class="start-cell">
      <div class="demo-box">
        <GuideMotionVideo id="hm-start" label="Hand resting static at west (starting position)" />
      </div>
      <span class="start-label">Start</span>
    </div>

    <div class="branches">
      <div class="branch">
        <div class="branch-label">
          <span class="branch-arrow">→</span>
          <div>
            <strong>shift</strong>
            <em>Move to an adjacent point</em>
          </div>
        </div>
        <div class="branch-results">
          <div class="demo-box">
            <GuideMotionVideo id="hm-shift-wn" label="Hand shifts from west to north" />
          </div>
          <span class="or-label">or</span>
          <div class="demo-box">
            <GuideMotionVideo id="hm-shift-ws" label="Hand shifts from west to south" />
          </div>
        </div>
      </div>

      <div class="branch">
        <div class="branch-label">
          <span class="branch-arrow">→</span>
          <div>
            <strong>dash</strong>
            <em>Move to the opposite point</em>
          </div>
        </div>
        <div class="branch-results">
          <div class="demo-box">
            <GuideMotionVideo id="hm-dash-we" label="Hand dashes straight across from west to east" />
          </div>
        </div>
      </div>

      <div class="branch">
        <div class="branch-label">
          <span class="branch-arrow">→</span>
          <div>
            <strong>static</strong>
            <em>Stay at the current point</em>
          </div>
        </div>
        <div class="branch-results">
          <div class="demo-box">
            <GuideMotionVideo id="hm-static-w" label="Hand stays static at west" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <p class="combinations-intro">
    Using these, we can derive six combinations, named below.
    We'll explore each one individually:
  </p>

  <div class="combinations-grid">
    <div class="combo-cell">
      <span class="combo-name type-dual-shift">Dual-Shift</span>
      <span class="combo-desc">Both hands travel to an adjacent point.</span>
    </div>
    <div class="combo-cell">
      <span class="combo-name type-shift">Shift</span>
      <span class="combo-desc">One hand travels to an adjacent point and the other hand remains static.</span>
    </div>

    <div class="combo-cell">
      <span class="combo-name type-cross-shift">Cross-Shift</span>
      <span class="combo-desc">One hand travels to an adjacent point and the other travels to the opposite point.</span>
    </div>
    <div class="combo-cell">
      <span class="combo-name type-dash">Dash</span>
      <span class="combo-desc">One hand travels to the opposite point and the other hand remains static.</span>
    </div>

    <div class="combo-cell">
      <span class="combo-name type-dual-dash">Dual-Dash</span>
      <span class="combo-desc">Both hands travel to the opposite point.</span>
    </div>
    <div class="combo-cell">
      <span class="combo-name type-static">Static</span>
      <span class="combo-desc">Both hands remain static.</span>
    </div>
  </div>
</GuideSection>

<style>
  .motion-flowchart {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin: 2rem 0;
  }

  .start-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .start-label {
    font-weight: 600;
    font-size: 0.9rem;
    color: oklch(0.45 0 0);
  }

  .demo-box {
    width: 140px;
    height: 140px;
    border: 1px solid oklch(0.35 0 0);
    border-radius: 4px;
    overflow: hidden;
  }

  .branches {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-left: 2px solid oklch(0.75 0 0);
  }

  .branch {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .branch-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 140px;
    flex-shrink: 0;
  }

  .branch-arrow {
    font-size: 1.4rem;
    color: oklch(0.55 0 0);
    line-height: 1;
  }

  .branch-label strong {
    display: block;
    font-size: 1.1rem;
    color: oklch(0.25 0 0);
  }

  .branch-label em {
    display: block;
    font-size: 0.85rem;
    font-style: italic;
    color: oklch(0.50 0 0);
  }

  .branch-results {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .or-label {
    font-size: 0.9rem;
    font-style: italic;
    color: oklch(0.55 0 0);
  }

  .combinations-intro {
    text-align: center;
    margin: 2.5rem 0 1.5rem;
  }

  .combinations-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    max-width: 700px;
    margin: 0 auto;
  }

  .combo-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid oklch(0.88 0 0);
  }

  .combo-cell:nth-child(odd) {
    border-right: 1px solid oklch(0.88 0 0);
  }

  .combo-cell:nth-last-child(-n+2) {
    border-bottom: none;
  }

  .combo-name {
    font-size: 1.4rem;
    font-weight: 700;
  }

  .combo-desc {
    font-size: 0.95rem;
    color: oklch(0.40 0 0);
    margin-top: 0.25rem;
    line-height: 1.4;
  }

  @media (max-width: 640px) {
    .motion-flowchart {
      flex-direction: column;
      align-items: center;
    }

    .branches {
      border-left: none;
      border-top: 2px solid oklch(0.75 0 0);
      padding-top: 1rem;
    }

    .branch {
      flex-direction: column;
      text-align: center;
    }

    .branch-label {
      min-width: unset;
      justify-content: center;
    }

    .branch-results {
      justify-content: center;
    }

    .demo-box {
      width: 120px;
      height: 120px;
    }
  }
</style>
