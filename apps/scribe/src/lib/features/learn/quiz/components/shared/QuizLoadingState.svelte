<!--
QuizLoadingState - Loading spinner for quizzes
-->
<div class="loading-state" role="status" aria-live="polite" aria-busy="true">
  <div class="loading-spinner" aria-hidden="true"></div>
  <p class="loading-text">Loading...</p>
</div>

<style>
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .loading-spinner {
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border: 3px solid var(--theme-stroke);
    border-left-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
      border-left-color: var(--theme-accent);
      border-top-color: var(--theme-accent);
    }
  }

  .loading-text {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.9375rem;
    font-weight: 500;
    margin: 0;
  }
</style>
