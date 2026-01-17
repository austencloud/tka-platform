<script lang="ts">
  let { onNext } = $props<{
    onNext: () => void;
  }>();
</script>

<div class="page">
  <h2>What is a Word?</h2>

  <div class="intro-section">
    <div class="concept-icon">
      <i class="fa-solid fa-spell-check" aria-hidden="true"></i>
    </div>
    <p class="intro-text">
      In TKA, a <strong>word</strong> is a sequence of letters that connect smoothly
      together, beat by beat.
    </p>
  </div>

  <div class="key-points">
    <div class="key-point">
      <div class="point-icon">
        <i class="fa-solid fa-link" aria-hidden="true"></i>
      </div>
      <div class="point-content">
        <h4>Letters Connect</h4>
        <p>
          Each letter's <em>end position</em> becomes the next letter's
          <em>start position</em>
        </p>
      </div>
    </div>

    <div class="key-point">
      <div class="point-icon">
        <i class="fa-solid fa-music" aria-hidden="true"></i>
      </div>
      <div class="point-content">
        <h4>Beat by Beat</h4>
        <p>One letter = one beat of music. Words create rhythmic flow!</p>
      </div>
    </div>

    <div class="key-point">
      <div class="point-icon">
        <i class="fa-solid fa-rotate" aria-hidden="true"></i>
      </div>
      <div class="point-content">
        <h4>Return Home</h4>
        <p>Many words loop back to their starting position</p>
      </div>
    </div>
  </div>

  <div class="example-preview">
    <p class="preview-label">Example: The word <strong>AABB</strong></p>
    <div class="letter-sequence">
      <span class="seq-letter">A</span>
      <span class="seq-arrow">→</span>
      <span class="seq-letter">A</span>
      <span class="seq-arrow">→</span>
      <span class="seq-letter">B</span>
      <span class="seq-arrow">→</span>
      <span class="seq-letter">B</span>
    </div>
  </div>

  <button class="next-button" onclick={onNext}>
    <span>Learn About Letter Types</span>
    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
  </button>
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
    background: linear-gradient(135deg, #50c878 0%, #3cb371 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  h4 {
    font-size: 1rem;
    font-weight: 600;
    color: white;
    margin: 0 0 0.25rem;
  }

  p {
    font-size: 1rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
  }

  .intro-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: linear-gradient(
      135deg,
      rgba(80, 200, 120, 0.1) 0%,
      rgba(80, 200, 120, 0.02) 100%
    );
    border: 1px solid rgba(80, 200, 120, 0.2);
    border-radius: 16px;
  }

  .concept-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(80, 200, 120, 0.2);
    border-radius: 50%;
    font-size: 1.75rem;
    color: #50c878;
  }

  .intro-text {
    font-size: 1.125rem;
    text-align: center;
  }

  .key-points {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .key-point {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .point-icon {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 211, 238, 0.15);
    border-radius: 10px;
    color: #22d3ee;
    flex-shrink: 0;
  }

  .point-content p {
    font-size: 0.875rem;
    color: var(--theme-text-dim);
  }

  .example-preview {
    text-align: center;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
  }

  .preview-label {
    margin-bottom: 0.75rem;
  }

  .letter-sequence {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1.5rem;
  }

  .seq-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    background: rgba(80, 200, 120, 0.2);
    border: 2px solid rgba(80, 200, 120, 0.4);
    border-radius: 10px;
    font-weight: 700;
    color: #50c878;
  }

  .seq-arrow {
    color: rgba(255, 255, 255, 0.4);
  }

  .next-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 1rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(80, 200, 120, 0.3) 0%,
      rgba(60, 179, 113, 0.3) 100%
    );
    border: 2px solid rgba(80, 200, 120, 0.5);
    border-radius: 12px;
    color: white;
    font-size: 1.0625rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-emphasis);
    min-height: var(--min-touch-target);
    margin-left: auto;
  }

  .next-button:hover {
    background: linear-gradient(
      135deg,
      rgba(80, 200, 120, 0.4) 0%,
      rgba(60, 179, 113, 0.4) 100%
    );
    border-color: rgba(80, 200, 120, 0.8);
    transform: translateY(-2px);
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }

    .letter-sequence {
      font-size: 1.25rem;
    }

    .seq-letter {
      width: 40px;
      height: 40px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
