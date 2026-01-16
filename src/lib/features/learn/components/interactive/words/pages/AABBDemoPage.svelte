<script lang="ts">
  import WordVisualizer from "../WordVisualizer.svelte";
  import WordsLessonNav from "../components/WordsLessonNav.svelte";
  import { wordAABB } from "../domain/demo-words";

  let {
    isAnimating,
    stepIndex,
    onBack,
    onNext,
    onToggleAnimation,
    onStepChange,
  } = $props<{
    isAnimating: boolean;
    stepIndex: number;
    onBack: () => void;
    onNext: () => void;
    onToggleAnimation: () => void;
    onStepChange: (index: number) => void;
  }>();
</script>

<div class="page">
  <h2>Words in Motion: AABB</h2>

  <p class="page-intro">
    Watch how the word <strong>AABB</strong> flows through 4 steps, returning to its
    starting position!
  </p>

  <div class="word-demo">
    <WordVisualizer
      letters={wordAABB}
      currentStepIndex={stepIndex}
      {isAnimating}
      animationSpeed={1200}
      showLetterLabel={true}
      showStepNumber={true}
      {onStepChange}
    />

    <div class="demo-controls">
      <button
        class="control-btn"
        class:playing={isAnimating}
        onclick={onToggleAnimation}
      >
        {#if isAnimating}
          <i class="fa-solid fa-pause" aria-hidden="true"></i>
          <span>Pause</span>
        {:else}
          <i class="fa-solid fa-play" aria-hidden="true"></i>
          <span>Animate</span>
        {/if}
      </button>
    </div>
  </div>

  <div class="beat-breakdown">
    <h4>Beat Breakdown</h4>
    <div class="steps-grid">
      <div class="beat-item" class:active={stepIndex === 0}>
        <span class="beat-num">1</span>
        <span class="beat-letter">A</span>
        <span class="beat-desc">Pro, α→α</span>
      </div>
      <div class="beat-item" class:active={stepIndex === 1}>
        <span class="beat-num">2</span>
        <span class="beat-letter">A</span>
        <span class="beat-desc">Pro, α→α</span>
      </div>
      <div class="beat-item" class:active={stepIndex === 2}>
        <span class="beat-num">3</span>
        <span class="beat-letter">B</span>
        <span class="beat-desc">Anti, α→α</span>
      </div>
      <div class="beat-item" class:active={stepIndex === 3}>
        <span class="beat-num">4</span>
        <span class="beat-letter">B</span>
        <span class="beat-desc">Anti, α→α</span>
      </div>
    </div>
  </div>

  <WordsLessonNav {onBack} {onNext} nextLabel="More Word Examples" />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
    animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
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
    background: linear-gradient(135deg, #50c878 0%, #3cb371 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
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
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
  }

  .page-intro {
    text-align: center;
    font-size: 1.0625rem;
  }

  .word-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .demo-controls {
    display: flex;
    gap: 0.75rem;
  }

  .control-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }

  .control-btn.playing {
    background: rgba(34, 211, 238, 0.2);
    border-color: rgba(34, 211, 238, 0.4);
    color: #22d3ee;
  }

  .beat-breakdown {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
  }

  .steps-grid {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 0.75rem;
    flex-wrap: wrap;
  }

  .beat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    padding: 0.625rem 1rem;
    background: var(--theme-card-bg);
    border: 2px solid transparent;
    border-radius: 10px;
    transition: all 0.2s ease;
    min-width: 80px;
  }

  .beat-item.active {
    background: rgba(80, 200, 120, 0.15);
    border-color: rgba(80, 200, 120, 0.5);
  }

  .beat-num {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  .beat-letter {
    font-size: 1.25rem;
    font-weight: 700;
    color: white;
  }

  .beat-desc {
    font-size: 0.6875rem;
    color: var(--theme-text-dim);
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
