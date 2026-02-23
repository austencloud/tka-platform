<script lang="ts">
  import WordVisualizer from "../WordVisualizer.svelte";
  import WordsLessonNav from "../components/WordsLessonNav.svelte";
  import { wordGGGG, wordCCCC } from "../domain/demo-words";

  let {
    ggggStepIndex,
    ccccStepIndex,
    onBack,
    onNext,
    onGGGGBeatChange,
    onCCCCBeatChange,
  } = $props<{
    ggggStepIndex: number;
    ccccStepIndex: number;
    onBack: () => void;
    onNext: () => void;
    onGGGGBeatChange: (index: number) => void;
    onCCCCBeatChange: (index: number) => void;
  }>();
</script>

<div class="page">
  <h2>More Word Patterns</h2>

  <p class="page-intro">
    Different letters create different visual patterns. Here are two more
    examples:
  </p>

  <div class="word-examples-grid">
    <div class="word-example">
      <h3>GGGG - Beta Circle</h3>
      <WordVisualizer
        letters={wordGGGG}
        currentStepIndex={ggggStepIndex}
        showLetterLabel={true}
        showStepNumber={true}
        compact={true}
        onStepChange={onGGGGBeatChange}
      />
      <p class="example-note">
        G uses <strong>Tog-Same</strong> (β→β) motion. Both hands stay together as
        they circle the grid!
      </p>
    </div>

    <div class="word-example">
      <h3>CCCC - Hybrid Flow</h3>
      <WordVisualizer
        letters={wordCCCC}
        currentStepIndex={ccccStepIndex}
        showLetterLabel={true}
        showStepNumber={true}
        compact={true}
        onStepChange={onCCCCBeatChange}
      />
      <p class="example-note">
        C is a <strong>hybrid</strong> - one hand pro, one anti. Creates a unique
        asymmetric look!
      </p>
    </div>
  </div>

  <div class="summary-box">
    <h4>Key Takeaways</h4>
    <ul>
      <li>Words are sequences of letters connected beat-by-beat</li>
      <li>End position of one letter = start position of the next</li>
      <li>Many words return to their starting position (LOOPs)</li>
      <li>
        Same word can look different based on rotation direction and thumb
        orientation
      </li>
    </ul>
  </div>

  <WordsLessonNav {onBack} {onNext} nextLabel="Take the Quiz" />
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

  h4 {
    font-size: 1rem;
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

  .word-examples-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .word-example {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
  }

  .example-note {
    font-size: 0.875rem;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .summary-box {
    padding: 1.25rem;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-success, #50c878) 8%, transparent) 0%,
      color-mix(in srgb, var(--semantic-success, #50c878) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--semantic-success, #50c878) 20%, transparent);
    border-radius: 12px;
  }

  .summary-box ul {
    margin: 0.75rem 0 0;
    padding-left: 1.25rem;
  }

  .summary-box li {
    font-size: 0.9375rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
    line-height: 1.6;
    margin-bottom: 0.375rem;
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }

    .word-examples-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
