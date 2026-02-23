<script lang="ts">
  import WordVisualizer from "../WordVisualizer.svelte";
  import WordsLessonNav from "../components/WordsLessonNav.svelte";
  import { singleA, singleB } from "../domain/demo-words";

  let { onBack, onNext } = $props<{
    onBack: () => void;
    onNext: () => void;
  }>();
</script>

<div class="page">
  <h2>Alpha & Beta Words</h2>

  <p class="page-intro">
    The simplest words use letters that stay within Alpha (α→α) or Beta (β→β)
    positions.
  </p>

  <div class="comparison-section">
    <div class="letter-card alpha">
      <h3>Letter A - Prospin</h3>
      <WordVisualizer
        letters={singleA}
        showLetterLabel={true}
        showStepNumber={false}
        compact={true}
      />
      <p class="letter-info">
        Both hands curve in the <em>same direction</em> as movement
      </p>
    </div>

    <div class="letter-card beta">
      <h3>Letter B - Antispin</h3>
      <WordVisualizer
        letters={singleB}
        showLetterLabel={true}
        showStepNumber={false}
        compact={true}
      />
      <p class="letter-info">
        Both hands curve <em>opposite</em> to movement direction
      </p>
    </div>
  </div>

  <div class="pattern-highlight">
    <h3>The Pro - Anti - Hybrid Pattern</h3>
    <div class="pattern-grid">
      <div class="pattern-item">
        <span class="pattern-letter">A, G, D</span>
        <span class="pattern-type pro">Prospin</span>
      </div>
      <div class="pattern-item">
        <span class="pattern-letter">B, H, E</span>
        <span class="pattern-type anti">Antispin</span>
      </div>
      <div class="pattern-item">
        <span class="pattern-letter">C, I, F</span>
        <span class="pattern-type hybrid">Hybrid</span>
      </div>
    </div>
    <p class="pattern-note">
      This pattern repeats throughout the alphabet. Memorize one letter in each
      group, and you know them all!
    </p>
  </div>

  <WordsLessonNav {onBack} {onNext} nextLabel="See Words in Motion" />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    animation: slideInUp var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
    padding-bottom: 3rem;
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    font-size: 1.875rem;
    font-weight: 700;
    color: white;
    margin: 0;
    text-align: center;
    background: linear-gradient(135deg, var(--semantic-success, #50c878) 0%, var(--semantic-success, #3cb371) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  p {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    margin: 0;
  }

  .page-intro {
    text-align: center;
    font-size: 1.0625rem;
  }

  .comparison-section {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(252px, 1fr));
    gap: 1rem;
  }

  .letter-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem;
    border-radius: 16px;
  }

  .letter-card.alpha {
    --alpha-color: #ff6b6b;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--alpha-color) 10%, transparent) 0%,
      color-mix(in srgb, var(--alpha-color) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--alpha-color) 20%, transparent);
  }

  .letter-card.beta {
    --beta-color: #4ecdc4;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--beta-color) 10%, transparent) 0%,
      color-mix(in srgb, var(--beta-color) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--beta-color) 20%, transparent);
  }

  .letter-info {
    font-size: 0.875rem;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .pattern-highlight {
    padding: 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    text-align: center;
  }

  .pattern-grid {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin: 1rem 0;
    flex-wrap: wrap;
  }

  .pattern-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.75rem 1.25rem;
    background: var(--theme-card-bg);
    border-radius: 10px;
  }

  .pattern-letter {
    font-weight: 700;
    font-size: 1.125rem;
    color: white;
  }

  .pattern-type {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .pattern-type.pro {
    background: color-mix(in srgb, var(--prop-blue, #4a9eff) 20%, transparent);
    color: var(--prop-blue, #4a9eff);
  }

  .pattern-type.anti {
    background: color-mix(in srgb, var(--prop-red, #ff4a9e) 20%, transparent);
    color: var(--prop-red, #ff4a9e);
  }

  .pattern-type.hybrid {
    --hybrid-color: #ffe66d;
    background: color-mix(in srgb, var(--hybrid-color) 20%, transparent);
    color: var(--hybrid-color);
  }

  .pattern-note {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
    font-style: italic;
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }

    .comparison-section {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
