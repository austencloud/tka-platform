<!--
  LOOP Labeler Loading State

  Full-screen loading spinner shown during initialization.
-->
<script lang="ts">
  // No props needed - purely presentational
</script>

<div class="loading" role="status" aria-live="polite" aria-busy="true">
  <div class="spinner" aria-hidden="true"></div>
  <p>Loading LOOP Labeler...</p>
</div>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-lg);
    height: 100vh;
    font-size: var(--font-size-lg);
    color: var(--muted);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--theme-stroke, var(--theme-stroke));
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
      border-top-color: var(--primary-color);
      border-right-color: var(--primary-color);
    }
  }
</style>
