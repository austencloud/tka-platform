<script lang="ts">
  import { LOOP_TYPES } from "../landing-content";
</script>

<section class="loops" id="loops">
  <div class="container">
    <h2>LOOPs: Algorithmic Composition</h2>
    <p class="section-intro">
      <strong>LOOPs (Linked Orbital Offset Patterns)</strong> are transformations
      that generate circular sequences automatically.
    </p>

    <div class="loop-explanation">
      <div class="loop-flow">
        <div class="flow-step">
          <div class="step-num">1</div>
          <div class="step-text">Start with one step</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">2</div>
          <div class="step-text">Apply a LOOP</div>
        </div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">
          <div class="step-num">3</div>
          <div class="step-text">Get a full circular sequence</div>
        </div>
      </div>
    </div>

    <div class="loop-types">
      <h3>13 LOOP Types</h3>
      <div class="loop-grid">
        {#each LOOP_TYPES as loop}
          <div class="loop-card">
            <span class="loop-name">{loop.name}</span>
            <span class="loop-desc">{loop.desc}</span>
          </div>
        {/each}
      </div>
    </div>

    <p class="loop-cta">
      This is where TKA starts <strong>creating patterns for you</strong>. Not just
      documenting what you know, but showing you patterns you've never tried.
    </p>
  </div>
</section>

<style>
  .loops {
    padding: 120px 24px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto 3rem;
  }

  .loop-explanation {
    margin-bottom: 48px;
  }

  .loop-flow {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .flow-step {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    padding: 16px 24px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .step-num {
    width: 32px;
    height: 32px;
    background: var(--theme-accent, #6366f1);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }

  .flow-arrow {
    font-size: 1.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .loop-types {
    text-align: center;
  }

  .loop-types h3 {
    margin-bottom: 24px;
  }

  .loop-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .loop-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    padding: 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .loop-name {
    font-weight: 600;
    color: var(--theme-accent-strong, #818cf8);
  }

  .loop-desc {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .loop-cta {
    text-align: center;
    margin-top: 48px;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  @media (max-width: 768px) {
    .flow-arrow {
      display: none;
    }

    .loop-flow {
      flex-direction: column;
    }
  }
</style>
